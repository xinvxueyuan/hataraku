import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root = "C:/dev/dsh/projects/hataraku";
const require = createRequire(root + "/apps/web/package.json");
const openapi = await import(pathToFileURL(require.resolve("@orpc/openapi")).href);
const zod = await import(pathToFileURL(require.resolve("@orpc/zod/zod4")).href);
const api = await import(pathToFileURL(root + "/packages/api/src/index.ts").href);
const generator = new openapi.OpenAPIGenerator({ schemaConverters: [new zod.ZodToJsonSchemaConverter()] });
const doc = await generator.generate(api.appRouter, {
  components: {
    securitySchemes: {
      bearerToken: { bearerFormat: "hkr_...", scheme: "bearer", type: "http" },
    },
  },
  filter: (options) => api.isPublicApiProcedure(options.path),
  info: { title: "check", version: "1.0.0" },
});
for (const route of api.WRITE_API_ROUTES) {
  const pathItem = doc.paths?.[route.path];
  const operation = route.method === "POST" ? pathItem?.post : pathItem?.patch;
  if (operation !== undefined) operation.security = [...api.WRITE_API_SECURITY];
}
const operations = [];
for (const [path, item] of Object.entries(doc.paths ?? {})) {
  for (const method of ["get", "post", "patch"]) {
    if (item?.[method]) {
      operations.push({
        method,
        path,
        security: item[method].security ?? null,
        params: (item[method].parameters ?? []).map((parameter) => parameter.name),
      });
    }
  }
}
console.log(JSON.stringify({
  count: operations.length,
  securitySchemes: doc.components?.securitySchemes ?? null,
  operations,
}, null, 2));
