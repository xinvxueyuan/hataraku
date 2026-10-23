import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = "C:/dev/dsh/projects/hataraku";
const url = readFileSync(root + "/apps/server/.env", "utf8")
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith("DATABASE_URL="))
  .split("=")
  .slice(1)
  .join("=")
  .trim();
const dbModule = await import(pathToFileURL(root + "/packages/db/src/index.ts").href);
const tokens = await import(pathToFileURL(root + "/packages/api/src/tokens.ts").href);
const schema = await import(pathToFileURL(root + "/packages/db/src/schema/api-tokens.ts").href);
const db = dbModule.createDb(url);
await db.$client.unsafe("delete from api_tokens where name = 'h77-http'");
const generated = tokens.generateToken();
const [row] = await db.insert(schema.apiTokens).values({
  name: "h77-http",
  prefix: generated.prefix,
  scopes: ["posts:write"],
  tokenHash: tokens.hashToken(generated.token),
}).returning({ id: schema.apiTokens.id });
writeFileSync(process.env.TEMP + "/h77-http-token.txt", generated.token);
console.log(JSON.stringify({ id: row?.id, prefix: generated.prefix }));
await db.$client.end();
