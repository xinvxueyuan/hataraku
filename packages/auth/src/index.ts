import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { captcha, twoFactor } from "better-auth/plugins";

import type { Database } from "@hataraku/db";
import * as schema from "@hataraku/db/schema/auth";

import { createEmailAllowlist } from "./allowlist.ts";

/**
 * Sign-in budget per client address. The acceptance criterion carried over from the
 * previous stack is that 20 concurrent sign-ins admit exactly 5.
 */
const SIGN_IN_WINDOW_SECONDS = 15 * 60;
const SIGN_IN_MAX_ATTEMPTS = 5;

/**
 * Sign-up budget. Better Auth's built-in rule for `/sign-up*` is 3 per 10 seconds, which a
 * test run that creates several users trips over; a per-hour budget still bounds abuse.
 */
const SIGN_UP_WINDOW_SECONDS = 60 * 60;
const SIGN_UP_MAX_ATTEMPTS = 20;

interface AuthOptions {
  db: Database;
  baseURL: string;
  secret: string;
  /** Name shown in the authenticator app when enrolling TOTP. */
  issuer?: string | undefined;
  /**
   * Cloudflare Turnstile secret key. The captcha plugin cannot verify anything without it,
   * so it is registered only when one is configured: a deployment without a key has no
   * captcha, and `apps/server/.env` deliberately carries none so the e2e stack runs without it.
   */
  turnstileSecretKey?: string | undefined;
  /** `ADMIN_EMAILS`: when set, only these addresses may create an account. */
  adminEmails?: string | undefined;
}

export const createAuth = ({
  db,
  baseURL,
  secret,
  issuer = "hataraku",
  turnstileSecretKey,
  adminEmails,
}: AuthOptions) => {
  const isAllowedEmail = createEmailAllowlist(adminEmails);

  const hasTurnstile =
    turnstileSecretKey !== undefined && turnstileSecretKey !== "";

  return betterAuth({
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    databaseHooks: {
      user: {
        create: {
          // Returns a promise without `async`: the signature requires one, and the body never awaits.
          before: (user) => {
            if (isAllowedEmail !== undefined && !isAllowedEmail(user.email)) {
              throw new APIError("FORBIDDEN", {
                message:
                  "This deployment is limited to an allowlist of addresses.",
              });
            }

            return Promise.resolve({ data: user });
          },
        },
      },
    },
    emailAndPassword: { enabled: true },
    plugins: [
      // The mobile app sends its scheme as the origin; the plugin also trusts exp:// when NODE_ENV is development.
      expo(),
      twoFactor({ issuer }),
      ...(hasTurnstile
        ? [
            captcha({
              provider: "cloudflare-turnstile",
              secretKey: turnstileSecretKey,
            }),
          ]
        : []),
    ],
    rateLimit: {
      customRules: {
        "/sign-in/email": {
          max: SIGN_IN_MAX_ATTEMPTS,
          window: SIGN_IN_WINDOW_SECONDS,
        },
        "/sign-up/email": {
          max: SIGN_UP_MAX_ATTEMPTS,
          window: SIGN_UP_WINDOW_SECONDS,
        },
      },
      // Off by default outside production, and the acceptance criterion has to hold everywhere.
      enabled: true,
      max: 100,
      window: 60,
    },
    secret,
    trustedOrigins: ["hataraku://"],
  });
};

export type Auth = ReturnType<typeof createAuth>;

export type Session = Auth["$Infer"]["Session"];
