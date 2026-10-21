import { describe, expect, it } from "vite-plus/test";

import {
  isPublicApiPath,
  isPublicApiProcedure,
  PUBLIC_API_ROUTES,
  PUBLIC_API_TAGS,
  publicApiCorsHeaders,
  publicRoute,
} from "#src/openapi-public.ts";

const EXCLUDED_KEYS = [
  "posts.adminList",
  "posts.adminStats",
  "posts.byId",
  "posts.create",
  "posts.publish",
  "posts.remove",
  "posts.unpublish",
  "posts.update",
  "content.changelog.adminList",
  "content.changelog.create",
  "content.changelog.remove",
  "content.micro.adminList",
  "content.micro.create",
  "content.micro.publish",
  "content.projects.adminList",
  "content.projects.byId",
  "content.projects.create",
  "media.uploads.policy",
  "media.uploads.presign",
  "security.attempts",
  "security.overview",
  "site.updateProfile",
  "todos.create",
  "todos.delete",
  "todos.list",
  "todos.update",
];

const PUBLIC_PATHS = [
  ["/", true],
  ["/spec.json", true],
  ["/openapi.json", true],
  ["/posts", true],
  ["/posts/hello", true],
  ["/posts/hello/adjacent", true],
  ["/posts/hello/related", true],
  ["/posts/hello/other", false],
  ["/albums/hello", true],
  ["/todos", false],
  ["/posts/adminList/extra", false],
  ["/auth/sign-in/email", false],
] as const;

const GET_CORS = [
  ["GET", "/posts", { "access-control-allow-origin": "*" }],
  ["HEAD", "/spec.json", { "access-control-allow-origin": "*" }],
  ["GET", "/openapi.json", { "access-control-allow-origin": "*" }],
  ["POST", "/posts", null],
  ["POST", "/posts/adminList", null],
  ["GET", "/auth/sign-in/email", null],
  ["GET", "/rpc/posts/list", null],
  ["OPTIONS", "/todos/list", null],
] as const;

describe("public API contract", () => {
  it("curates exactly the public read procedures", () => {
    expect(PUBLIC_API_ROUTES).toHaveLength(22);
    expect(new Set(PUBLIC_API_ROUTES.map((route) => route.key)).size).toBe(22);
    expect(new Set(PUBLIC_API_ROUTES.map((route) => route.path)).size).toBe(22);
  });

  it("keeps every admin and per-user procedure out", () => {
    const offenders = EXCLUDED_KEYS.filter(
      (key) =>
        PUBLIC_API_ROUTES.some((route) => route.key === key) ||
        isPublicApiProcedure(key.split("."))
    );

    expect(offenders).toStrictEqual([]);
  });

  it("marks every curated procedure public and everything else private", () => {
    const failures = PUBLIC_API_ROUTES.filter((route) => {
      const metadata = publicRoute(route.key);

      return (
        metadata.method !== "GET" ||
        metadata.path !== route.path ||
        metadata.tags.length !== 1 ||
        metadata.tags[0] !== route.tag ||
        !isPublicApiProcedure(route.key.split("."))
      );
    });

    expect(failures).toStrictEqual([]);
    expect(isPublicApiProcedure(["posts", "list"])).toBeTruthy();
    expect(isPublicApiProcedure(["posts", "adminList"])).toBeFalsy();
    expect(isPublicApiProcedure(["health", "extra"])).toBeFalsy();
  });

  it("fails a route key the contract does not define", () => {
    expect(() => publicRoute("posts.missing")).toThrow(
      "Unknown public API route: posts.missing"
    );
  });

  it("describes every tag used by a route", () => {
    const described = new Set(PUBLIC_API_TAGS.map((tag) => tag.name));

    const missing = PUBLIC_API_ROUTES.filter(
      (route) => !described.has(route.tag)
    ).map((route) => route.tag);

    expect(missing).toStrictEqual([]);
    expect(
      PUBLIC_API_TAGS.every((tag) => tag.description.length > 0)
    ).toBeTruthy();
  });

  it.each(PUBLIC_PATHS)("matches %s as public: %s", (path, expected) => {
    expect(isPublicApiPath(path)).toBe(expected);
  });

  it.each(GET_CORS)("CORS for %s %s", (method, path, expected) => {
    expect(publicApiCorsHeaders(method, path)).toStrictEqual(expected);
  });

  it("answers a GET preflight on a public path", () => {
    expect(publicApiCorsHeaders("OPTIONS", "/posts", "GET")).toMatchObject({
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-origin": "*",
    });
  });

  it("refuses a write preflight even when the path looks public", () => {
    expect(publicApiCorsHeaders("OPTIONS", "/posts", "POST")).toBeNull();
    expect(
      publicApiCorsHeaders("OPTIONS", "/posts/adminList", "POST")
    ).toBeNull();
  });
});
