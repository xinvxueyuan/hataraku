import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
  server: {
    // Comma separated allowlist. Unset means the deployment is open to any visitor.
    ADMIN_EMAILS: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    DATABASE_URL: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
    PORT: z.coerce.number().int().positive().default(3001),
    // Cloudflare Turnstile secret. Unset means no captcha is enforced.
    TURNSTILE_SECRET_KEY: z.string().optional(),
  },
});
