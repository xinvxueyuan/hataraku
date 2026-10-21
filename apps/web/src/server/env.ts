import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const readEnv = () =>
  createEnv({
    emptyStringAsUndefined: true,
    runtimeEnv: process.env,
    server: {
      ADMIN_EMAILS: z.string().optional(),
      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: z.url(),
      DATABASE_URL: z.url(),
      // The password-reset mail. Both are optional so a deployment without mail still runs; the
      // reset callback reports the missing configuration instead of failing to start.
      EMAIL_FROM: z.string().optional(),
      RESEND_API_KEY: z.string().optional(),
      // The web server renders against the database in process and no longer reaches an API over
      // HTTP; SERVER_URL stays declared for deployments that still configure the standalone API and
      // for the mobile client's origin.
      SERVER_URL: z.url().default("http://localhost:3001"),
      TURNSTILE_SECRET_KEY: z.string().optional(),
    },
  });
