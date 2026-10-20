import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { captcha, twoFactor } from "better-auth/plugins";
import { z } from "zod";

import type { Database } from "@hataraku/db";
import * as schema from "@hataraku/db/schema/auth";

import { createEmailAllowlist } from "./allowlist.ts";
import { withLoginAttempts } from "./login-attempts.ts";

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

/**
 * One message for every rejected credential, so a response never reveals whether an account
 * exists or whether it merely fell outside the allowlist.
 */
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

/** The only part of a sign-in body this hook reads; Better Auth validates the rest. */
const signInBodySchema = z.object({ email: z.string() });

/**
 * v2 enforced at least 16 characters and at most 200
 * (nightstack/src/lib/supabase/password-policy.ts). Better Auth enforces the same two bounds on
 * sign-up, set-password, change-password and reset-password; sign-in only checks the ceiling, so an
 * account created under the old eight-character default can still sign in and raise its password.
 *
 * Better Auth has no option for a local common-password blocklist, so v2's weak-password list and
 * its "must not contain your email" rule have no counterpart here. The supported alternative is the
 * `haveIBeenPwned` plugin (a breached-password check that calls an external service); it is not
 * enabled — see artifacts/h26/README.md for the tradeoff.
 */
export const PASSWORD_MIN_LENGTH = 16;
export const PASSWORD_MAX_LENGTH = 200;

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

  const auth = betterAuth({
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (isAllowedEmail !== undefined && !isAllowedEmail(user.email)) {
              throw new APIError("FORBIDDEN", {
                message:
                  "This deployment is limited to an allowlist of addresses.",
              });
            }

            return { data: user };
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      minPasswordLength: PASSWORD_MIN_LENGTH,
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (isAllowedEmail === undefined || ctx.path !== "/sign-in/email") {
          return;
        }

        // `safeParseAsync` keeps the hook honestly async and narrows the untyped request body
        // without an assertion; a body the endpoint will reject on its own is simply ignored here.
        const parsed = await signInBodySchema.safeParseAsync(ctx.body);

        if (parsed.success && !isAllowedEmail(parsed.data.email)) {
          throw new APIError("UNAUTHORIZED", {
            message: INVALID_CREDENTIALS_MESSAGE,
          });
        }
      }),
    },
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

  // Every deployment reaches Better Auth through this handler, so the audit lives there rather than
  // in one app's route handler; see login-attempts.ts for why the hooks cannot see all refusals.
  return withLoginAttempts(auth, { db, secret });
};

export type Auth = ReturnType<typeof createAuth>;

export type Session = Auth["$Infer"]["Session"];

/** The allowlist itself, so the API can decide who may write without re-parsing `ADMIN_EMAILS`. */
export { createEmailAllowlist } from "./allowlist.ts";
