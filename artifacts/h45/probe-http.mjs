/**
 * H45 HTTP probe: serves the real web app against the real database on a private port, then checks
 * the curated spec, the two document paths, CORS on public vs admin vs RPC, the docs page and the
 * spec cache timing.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const root = "C:/dev/dsh/projects/hataraku";
const envFile = readFileSync(root + "/apps/server/.env", "utf8");
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (match !== null) {
    env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
}

const webPort = "3320";
// Deliberately different from the request origin: the spec must derive servers from configuration,
// not from the host header.
const configuredOrigin = "https://hataraku.example";
const base = "http://localhost:" + webPort;

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", webPort], {
  cwd: root + "/apps/web",
  env: {
    ...process.env,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: configuredOrigin,
    DATABASE_URL: env.DATABASE_URL,
    NEXT_DIST_DIR: ".next-test-" + webPort,
  },
  stdio: "ignore",
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (url, timeoutMs = 180_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      if (response.ok) {
        return;
      }
    } catch {}
    await sleep(500);
  }
  throw new Error("timed out waiting for " + url);
};

const pick = (response) => ({
  acao: response.headers.get("access-control-allow-origin"),
  acam: response.headers.get("access-control-allow-methods"),
  acah: response.headers.get("access-control-allow-headers"),
  cacheControl: response.headers.get("cache-control"),
  contentType: response.headers.get("content-type"),
  status: response.status,
});

const timing = async (url) => {
  const started = performance.now();
  const response = await fetch(url);
  const body = await response.text();
  return { body, ms: Number((performance.now() - started).toFixed(1)), status: response.status };
};

const result = {};

try {
  await waitFor(base + "/api/health");

  const spec = await timing(base + "/api/openapi.json");
  const specAgain = await timing(base + "/api/spec.json");
  const specJson = JSON.parse(spec.body);
  const specAgainJson = JSON.parse(specAgain.body);
  const paths = Object.keys(specJson.paths ?? {});
  const methods = [...new Set(paths.flatMap((path) => Object.keys(specJson.paths[path]).map((method) => method.toUpperCase())))];
  const adminNeedles = ["adminList", "adminStats", "updateProfile", "uploads", "todos", "security", "/auth"];
  const adminMatches = adminNeedles.filter((needle) => spec.body.includes(needle));

  result.spec = {
    adminMatches,
    info: specJson.info,
    methods,
    openapi: specJson.openapi,
    paths,
    pathsCount: paths.length,
    servers: specJson.servers,
    specJson: { bytes: specAgain.body.length, status: specAgain.status },
    status: spec.status,
  };
  result.specSame = spec.body === specAgain.body;
  result.timing = {
    coldMs: spec.ms,
    hotMs: specAgain.ms,
    specBytes: spec.body.length,
  };

  const publicGet = await fetch(base + "/api/posts?page=1&pageSize=1", {
    headers: { origin: "https://example.com" },
  });
  const publicGetBody = await publicGet.text();
  result.publicGet = {
    ...pick(publicGet),
    bodyHead: publicGetBody.slice(0, 200),
  };

  let firstSlug = null;
  try {
    firstSlug = JSON.parse(publicGetBody).items?.[0]?.slug ?? null;
  } catch {}
  if (firstSlug !== null) {
    const bySlug = await fetch(base + "/api/posts/" + encodeURIComponent(firstSlug), {
      headers: { origin: "https://example.com" },
    });
    result.bySlug = pick(bySlug);
    await bySlug.arrayBuffer();

    const invalidGet = await fetch(base + "/api/posts?pageSize=999", {
      headers: { origin: "https://example.com" },
    });
    result.invalidGet = {
      ...pick(invalidGet),
      bodyHead: (await invalidGet.text()).slice(0, 200),
    };

    const missingGet = await fetch(base + "/api/posts/no-such-post-h45", {
      headers: { origin: "https://example.com" },
    });
    result.missingGet = {
      ...pick(missingGet),
      bodyHead: (await missingGet.text()).slice(0, 200),
    };

    const searchGet = await fetch(
      base + "/api/search?q=" + encodeURIComponent("限流"),
      { headers: { origin: "https://example.com" } }
    );
    result.searchGet = {
      ...pick(searchGet),
      bodyHead: (await searchGet.text()).slice(0, 200),
    };

    const taxonomyGet = await fetch(base + "/api/taxonomy", {
      headers: { origin: "https://example.com" },
    });
    result.taxonomyGet = pick(taxonomyGet);
    await taxonomyGet.arrayBuffer();
  }

  const publicSpec = await fetch(base + "/api/openapi.json", {
    headers: { origin: "https://example.com" },
  });
  result.publicSpec = pick(publicSpec);
  await publicSpec.arrayBuffer();

  const adminPost = await fetch(base + "/api/posts/adminList", {
    body: JSON.stringify({ json: {} }),
    headers: { "content-type": "application/json", origin: "https://example.com" },
    method: "POST",
  });
  result.adminPost = pick(adminPost);
  await adminPost.arrayBuffer();

  const publicPreflight = await fetch(base + "/api/posts", {
    headers: {
      "access-control-request-method": "GET",
      origin: "https://example.com",
    },
    method: "OPTIONS",
  });
  result.publicPreflight = pick(publicPreflight);
  await publicPreflight.arrayBuffer();

  const adminPreflight = await fetch(base + "/api/posts/adminList", {
    headers: {
      "access-control-request-method": "POST",
      origin: "https://example.com",
    },
    method: "OPTIONS",
  });
  result.adminPreflight = pick(adminPreflight);
  await adminPreflight.arrayBuffer();

  const rpcPost = await fetch(base + "/rpc/posts/list", {
    body: JSON.stringify({ json: { page: 1, pageSize: 1 } }),
    headers: { "content-type": "application/json", origin: "https://example.com" },
    method: "POST",
  });
  const rpcBody = await rpcPost.text();
  result.rpc = {
    ...pick(rpcPost),
    bodyHead: rpcBody.slice(0, 160),
  };

  const rpcWrong = await fetch(base + "/rpc/content.posts.list", {
    body: JSON.stringify({ json: {} }),
    headers: { "content-type": "application/json", origin: "https://example.com" },
    method: "POST",
  });
  result.rpcWrong = pick(rpcWrong);
  await rpcWrong.arrayBuffer();

  const docs = await fetch(base + "/docs/api");
  const docsHtml = await docs.text();
  result.docsPage = {
    hasCodeBlock: docsHtml.includes("<pre"),
    hasTable: docsHtml.includes("<table"),
    hasTitle: docsHtml.includes("API 使用指南"),
    status: docs.status,
  };

  const docsUi = await fetch(base + "/api");
  const docsUiHtml = await docsUi.text();
  result.referenceUi = {
    hasScalar: docsUiHtml.includes("Scalar.createApiReference"),
    hasSpecUrl: docsUiHtml.includes("/api/openapi.json"),
    status: docsUi.status,
  };
} finally {
  if (child.pid !== undefined) {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    await sleep(700);
  }
}

console.log(JSON.stringify(result, null, 2));
