// Seeds the scratch database the browser probe runs against: one published post to redirect to,
// one draft, and two sign-in attempts so the security page has rows to render.
import { createRequire } from "node:module";

const require = createRequire(new URL("../../packages/db/package.json", import.meta.url));
const postgres = require("postgres");

const url = process.env.DATABASE_URL;

if (url === undefined) {
  throw new Error("DATABASE_URL is not set");
}

const db = postgres(url);

/** Both digests are shaped like the auth layer's HMAC output: 64 hex characters. */
const IP_HASH = "0123456789abcdef".repeat(4);
const EMAIL_HASH = "e".repeat(64);

await db`insert into posts (slug, title, body_md, published, published_at)
  values ('legacy-article', '旧地址文章', '正文', true, now())
  on conflict (slug) do nothing`;

await db`insert into posts (slug, title, body_md, published, draft)
  values ('legacy-draft', '草稿', '正文', false, true)
  on conflict (slug) do nothing`;

await db`insert into login_attempts (ip_hash, email_hash, outcome, duration_ms, created_at)
  values (${IP_HASH}, ${EMAIL_HASH}, 'sent', 123, now() - interval '1 hour')`;

await db`insert into login_attempts (ip_hash, email_hash, outcome)
  values (${IP_HASH}, ${EMAIL_HASH}, 'password_fail')`;

const [posts] = await db`select count(*)::int as count from posts`;
const [attempts] = await db`select count(*)::int as count from login_attempts`;

console.log("seeded", posts.count, "posts and", attempts.count, "login attempts");

await db.end();
