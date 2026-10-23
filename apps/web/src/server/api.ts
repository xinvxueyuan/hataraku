import "server-only";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";

import {
  appRouter,
  isPublicApiProcedure,
  PUBLIC_API_TAGS,
  publicApiCorsHeaders,
  resolveApiToken,
  WRITE_API_ROUTES,
  WRITE_API_SECURITY,
} from "@hataraku/api";
import type { Context } from "@hataraku/api";
import { createAuth } from "@hataraku/auth";
import type { Auth } from "@hataraku/auth";
import { createDb } from "@hataraku/db";
import type { Database } from "@hataraku/db";

import { SITE_AUTHOR, SITE_EMAIL, siteOrigin } from "#src/components/site.ts";
import { readEnv } from "#src/server/env.ts";

/**
 * The web deployment serves the API itself. A single deployment used to proxy these routes to
 * SERVER_URL, which is the deployment's own origin there: the function called itself and the edge
 * answered 508 INFINITE_LOOP_DETECTED. This module is the one place that owns the database, the
 * Better Auth instance and the two transports, so both the route handlers and server components
 * reach them in process.
 *
 * Two surfaces leave this module. The RPC transport is the first-party channel: the web app calls
 * it in process and the mobile client will call it over HTTP. The OpenAPI transport is the public
 * contract; its document is curated from the allowlist in the API package, because the router also
 * carries admin and per-user procedures that are internal.
 */

/** The API prefix that serves the OpenAPI document and the procedures exposed over HTTP. */
const API_PREFIX = "/api";

/** Better Auth owns everything under this path; it is matched before the OpenAPI transport. */
const AUTH_PREFIX = `${API_PREFIX}/auth`;

/** The two document spellings are equivalent; external tools expect both. */
const SPEC_PATHS = new Set(["/spec.json", "/openapi.json"]);

/** Where the reference UI lives, under the API prefix. */
const DOCS_PATH = "/";

/** The reference UI fetches the document from this same origin. */
const PUBLIC_SPEC_PATH = `${API_PREFIX}/openapi.json`;

const logServerError = (cause: unknown) => {
  if (!(cause instanceof ORPCError) || cause.status >= 500) {
    console.error(cause);
  }
};

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [onError(logServerError)],
});

// No plugins: the document and the reference UI are served below, where the cache and the curated
// allowlist are visible in one place instead of inside a handler interceptor.
const openApiHandler = new OpenAPIHandler(appRouter, {
  interceptors: [onError(logServerError)],
});

const openApiGenerator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

type OpenApiDocument = Awaited<ReturnType<OpenAPIGenerator["generate"]>>;

/**
 * One document per origin, generated once.
 *
 * The document is a function of the router and its route metadata, not of database rows, so a
 * process can keep it for its lifetime: a deploy starts a new process and a dev edit reloads this
 * module, which is also the invalidation story. The origin is part of the key because previews and
 * local runs fall back to the request host when BETTER_AUTH_URL is unset.
 */
const documents = new Map<string, Promise<OpenApiDocument>>();

const buildDocument = async (origin: string): Promise<OpenApiDocument> => {
  const document = await openApiGenerator.generate(appRouter, {
    components: {
      securitySchemes: {
        bearerToken: {
          bearerFormat: "hkr_...",
          scheme: "bearer",
          type: "http",
        },
      },
    },
    externalDocs: {
      description: "API 使用指南",
      url: new URL("/docs/api", origin).toString(),
    },
    filter: (options) => isPublicApiProcedure(options.path),
    info: {
      contact: { email: SITE_EMAIL, name: SITE_AUTHOR },
      description:
        "夜行栈 API：公开只读接口与 Bearer 令牌写入。读取无需鉴权；写入使用带作用域的 API 令牌。跨域请求仍只允许公开 GET、HEAD 与预检。",
      // The repository ships no LICENSE file, so the contract does not claim an open licence.
      license: { name: "All rights reserved" },
      title: "夜行栈 API",
      version: "1.0.0",
    },
    servers: [
      {
        description: "当前站点",
        url: new URL("/api", origin).toString(),
      },
    ],
    tags: [...PUBLIC_API_TAGS],
  });

  for (const route of WRITE_API_ROUTES) {
    const pathItem = document.paths?.[route.path];

    const operation =
      route.method === "POST" ? pathItem?.post : pathItem?.patch;

    if (operation !== undefined) {
      operation.security = [...WRITE_API_SECURITY];
    }
  }

  return document;
};

const openApiDocument = async (origin: string): Promise<OpenApiDocument> => {
  const cached = documents.get(origin);

  if (cached !== undefined) {
    return await cached;
  }

  const document = (async (): Promise<OpenApiDocument> => {
    try {
      return await buildDocument(origin);
    } catch (error) {
      // A rejected promise must not poison the cache for the next request.
      documents.delete(origin);
      throw error;
    }
  })();

  documents.set(origin, document);

  return await document;
};

const docsHtml = (title: string): string =>
  [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${title}</title>`,
    "  </head>",
    "  <body>",
    '    <div id="app"></div>',
    '    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>',
    "    <script>",
    `      Scalar.createApiReference("#app", { url: "${PUBLIC_SPEC_PATH}" });`,
    "    </script>",
    "  </body>",
    "</html>",
  ].join("\n");

const withHeaders = (
  response: Response,
  headers: Record<string, string>
): Response => {
  const merged = new Headers(response.headers);

  for (const [name, value] of Object.entries(headers)) {
    merged.set(name, value);
  }

  return new Response(response.body, {
    headers: merged,
    status: response.status,
    statusText: response.statusText,
  });
};

/**
 * The document and its reference UI are GET-only and need no database, so they are answered before
 * a session lookup. A HEAD request keeps the headers and drops the body.
 */
const documentationResponse = async (
  request: Request,
  relativePath: string
): Promise<Response | undefined> => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return undefined;
  }

  const isSpec = SPEC_PATHS.has(relativePath);
  const isDocs = relativePath === DOCS_PATH;

  if (!isSpec && !isDocs) {
    return undefined;
  }

  const document = await openApiDocument(await siteOrigin());
  const headers = new Headers(publicApiCorsHeaders("GET", relativePath) ?? {});

  headers.set("cache-control", "public, max-age=60");

  if (isSpec) {
    headers.set("content-type", "application/json; charset=utf-8");

    return new Response(
      request.method === "HEAD" ? null : JSON.stringify(document),
      { headers }
    );
  }

  headers.set("content-type", "text/html; charset=utf-8");

  return new Response(
    request.method === "HEAD" ? null : docsHtml("夜行栈 API 参考"),
    { headers }
  );
};

/**
 * The database is created on first use rather than at import: a production build imports this
 * module without a database, and connecting is the request handler's job, not the bundler's.
 */
let database: Database | undefined;

export const getDb = (): Database => {
  database ??= createDb(readEnv().DATABASE_URL);

  return database;
};

/** One Better Auth instance per process, configured exactly as the standalone API configures it. */
let auth: Auth | undefined;

export const getAuth = (): Auth => {
  if (auth === undefined) {
    const env = readEnv();

    auth = createAuth({
      adminEmails: env.ADMIN_EMAILS,
      baseURL: env.BETTER_AUTH_URL,
      db: getDb(),
      emailFrom: env.EMAIL_FROM,
      resendApiKey: env.RESEND_API_KEY,
      secret: env.BETTER_AUTH_SECRET,
      turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
    });
  }

  return auth;
};

const notFound = () => new Response("Not Found", { status: 404 });

/**
 * Handles one request for a catch-all transport route without leaving the process.
 *
 * /api/auth/* belongs to Better Auth, /rpc/* to the RPC transport, and the rest of /api/* to the
 * OpenAPI transport. The context is built per request, so a procedure sees the visitor's session
 * and no other request's.
 *
 * CORS is deliberately narrow: only the public read allowlist (and the document itself) answers
 * preflight, and only GET/HEAD carry a wildcard origin. Admin and auth paths fall through with no
 * CORS headers, and /rpc never gets one, so a browser on another origin cannot use the first-party
 * channel. Native apps call /rpc without a browser origin and do not need CORS.
 */
export const handleApiRequest = async (
  request: Request,
  prefix: typeof API_PREFIX | "/rpc"
) => {
  const { pathname } = new URL(request.url);

  const relativePath =
    prefix === API_PREFIX
      ? pathname.slice(API_PREFIX.length) || DOCS_PATH
      : pathname;

  if (prefix === API_PREFIX) {
    if (request.method === "OPTIONS") {
      const headers = publicApiCorsHeaders(
        "OPTIONS",
        relativePath,
        request.headers.get("access-control-request-method") ?? undefined
      );

      return headers === null
        ? notFound()
        : new Response(null, { headers, status: 204 });
    }

    const documentation = await documentationResponse(request, relativePath);

    if (documentation !== undefined) {
      return documentation;
    }
  }

  if (
    prefix === API_PREFIX &&
    (pathname === AUTH_PREFIX || pathname.startsWith(`${AUTH_PREFIX}/`))
  ) {
    return await getAuth().handler(request);
  }

  const db = getDb();

  const session = await getAuth().api.getSession({
    headers: request.headers,
  });

  const context: Context = {
    adminEmails: readEnv().ADMIN_EMAILS,
    apiToken:
      session === null
        ? await resolveApiToken(db, request.headers.get("authorization"))
        : null,
    db,
    session,
  };

  if (prefix === "/rpc") {
    const { matched, response } = await rpcHandler.handle(request, {
      context,
      prefix: "/rpc",
    });

    return matched ? response : notFound();
  }

  const { matched, response } = await openApiHandler.handle(request, {
    context,
    prefix: API_PREFIX,
  });

  if (!matched) {
    return notFound();
  }

  const cors = publicApiCorsHeaders(request.method, relativePath);

  return cors === null ? response : withHeaders(response, cors);
};
