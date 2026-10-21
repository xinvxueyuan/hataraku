import "server-only";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";

import { appRouter } from "@hataraku/api";
import type { Context } from "@hataraku/api";
import { createAuth } from "@hataraku/auth";
import type { Auth } from "@hataraku/auth";
import { createDb } from "@hataraku/db";
import type { Database } from "@hataraku/db";

import { readEnv } from "#src/server/env.ts";

/**
 * The web deployment serves the API itself. A single deployment used to proxy these routes to
 * `SERVER_URL`, which is the deployment's own origin there: the function called itself and the edge
 * answered 508 INFINITE_LOOP_DETECTED. This module is the one place that owns the database, the
 * Better Auth instance and the two transports, so both the route handlers and server components
 * reach them in process.
 */

/** The API prefix that serves the OpenAPI document and the procedures exposed over HTTP. */
const API_PREFIX = "/api";

/** Better Auth owns everything under this path; it is matched before the OpenAPI transport. */
const AUTH_PREFIX = `${API_PREFIX}/auth`;

const logServerError = (cause: unknown) => {
  if (!(cause instanceof ORPCError) || cause.status >= 500) {
    console.error(cause);
  }
};

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [onError(logServerError)],
});

// The document and the reference UI stay reachable at /api, exactly as the standalone server serves
// them; dropping them would silently remove the HTTP surface the web proxy used to forward.
const openApiHandler = new OpenAPIHandler(appRouter, {
  interceptors: [onError(logServerError)],
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "hataraku",
          version: "0.0.0",
        },
      },
    }),
  ],
});

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
 * `/api/auth/*` belongs to Better Auth, `/rpc/*` to the RPC transport, and the rest of `/api/*` to
 * the OpenAPI transport. The context is built per request, so a procedure sees the visitor's
 * session and no other request's.
 */
export const handleApiRequest = async (
  request: Request,
  prefix: typeof API_PREFIX | "/rpc"
) => {
  const { pathname } = new URL(request.url);

  if (
    prefix === API_PREFIX &&
    (pathname === AUTH_PREFIX || pathname.startsWith(`${AUTH_PREFIX}/`))
  ) {
    return await getAuth().handler(request);
  }

  const context: Context = {
    adminEmails: readEnv().ADMIN_EMAILS,
    db: getDb(),
    session: await getAuth().api.getSession({ headers: request.headers }),
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

  return matched ? response : notFound();
};
