import { createAuth } from "@hataraku/auth";
import { createDb } from "@hataraku/db";

import { env } from "#src/env.ts";

export const db = createDb(env.DATABASE_URL);

export const auth = createAuth({
  adminEmails: env.ADMIN_EMAILS,
  baseURL: env.BETTER_AUTH_URL,
  db,
  secret: env.BETTER_AUTH_SECRET,
  turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
});
