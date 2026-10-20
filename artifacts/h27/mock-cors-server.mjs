/**
 * Mock of the Cloudflare R2 CORS API for exercising the apply path of
 * scripts/configure-r2-cors.ts without touching a real bucket.
 *
 * GET  /accounts/:account/r2/buckets/:bucket/cors  -> the current policy, or the "not configured" error
 * PUT  /accounts/:account/r2/buckets/:bucket/cors  -> replaces the policy and records the body
 *
 * Environment:
 *   MOCK_PORT     listen port (default 3399)
 *   MOCK_INITIAL  initial policy JSON; unset means "no CORS policy" (404 + code 10059)
 *   MOCK_LOG      request log path; every request appends one JSON line, PUT includes the body
 *   MOCK_BROKEN   set to 1 to answer GET with a non-JSON body (error-path test)
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const port = Number(process.env.MOCK_PORT ?? "3399");
const logPath = process.env.MOCK_LOG ?? "";
const broken = process.env.MOCK_BROKEN === "1";
let policy = process.env.MOCK_INITIAL === undefined ? null : JSON.parse(process.env.MOCK_INITIAL);

if (logPath !== "") {
  writeFileSync(logPath, "");
}

const log = (entry) => {
  if (logPath !== "") {
    appendFileSync(logPath, JSON.stringify(entry) + "\n");
  }
};

const send = (response, status, payload) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(payload === undefined ? "" : JSON.stringify(payload));
};

const readBody = async (request) => {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
};

const server = createServer(async (request, response) => {
  if (request.method === "GET") {
    log({ method: "GET", url: request.url });

    if (broken) {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("this is not json");

      return;
    }

    if (policy === null) {
      send(response, 404, {
        errors: [{ code: 10059, message: "The CORS configuration does not exist." }],
        messages: [],
        result: null,
        success: false,
      });

      return;
    }

    send(response, 200, { result: policy, success: true });

    return;
  }

  if (request.method === "PUT") {
    const body = await readBody(request);
    const parsed = JSON.parse(body);

    policy = parsed;
    log({ body: parsed, method: "PUT" });
    send(response, 200, { result: parsed, success: true });

    return;
  }

  log({ method: request.method, url: request.url });
  send(response, 405, { errors: [{ code: 0, message: "method not allowed" }], success: false });
});

server.listen(port, "127.0.0.1", () => {
  console.log("mock listening on " + String(port) + (policy === null ? " (no policy)" : " (policy set)"));
});
