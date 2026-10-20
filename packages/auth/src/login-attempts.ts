import { createHmac } from "node:crypto";

import { z } from "zod";

import type { Database } from "@hataraku/db";
import { loginAttempts } from "@hataraku/db/schema/audit";

/**
 * Sign-in auditing for `login_attempts`.
 *
 * **Why the handler and not `hooks.after`.** Two refusal paths never reach an endpoint: the
 * rate limiter rejects before dispatch, and the sign-in allowlist throws from a `before` hook. The
 * after hooks only run once dispatch has produced a response, so they would miss exactly the
 * attempts a site owner most wants to see. `auth.handler` is the one place every HTTP auth request
 * passes through, and it yields the status the caller actually received, so the wrapper below records
 * success, wrong password, rate-limit refusals and allowlist refusals alike.
 *
 * **Why the table has no user column.** A row is deployment-wide rate-limit audit data keyed by
 * digests of the address and the email; it is not owned by an account, and this writer does not add
 * a user reference.
 */

/** The only endpoint this audit covers: the password step of a sign-in. */
const SIGN_IN_PATH = "/sign-in/email";

const DIGEST_ALGORITHM = "sha256";

/**
 * A stored digest is 64 hex characters of an HMAC-SHA256 over the identifier, keyed by the
 * deployment secret. The raw address and the raw email never reach the database.
 */
const hashIdentifier = (value: string, secret: string) =>
  createHmac(DIGEST_ALGORITHM, secret).update(value).digest("hex");

/**
 * 401 is one outcome on purpose: the allowlist answers with the same response as a wrong password,
 * so the audit draws the same line the caller sees and does not become a distinguishing oracle.
 */
const classify = (status: number) => {
  if (status >= 200 && status < 300) {
    return "success";
  }

  if (status === 401) {
    return "invalid";
  }

  if (status === 403) {
    return "not_allowed";
  }

  if (status === 429) {
    return "throttled";
  }

  return "failed";
};

/** The only part of a sign-in body the audit reads; the auth layer validates the rest. */
const signInBodySchema = z.object({ email: z.string() });

/** The email a sign-in names, read from a clone so the handler still receives the body. */
const readEmail = async (request: Request): Promise<string | null> => {
  try {
    const body: unknown = await request.clone().json();
    const parsed = await signInBodySchema.safeParseAsync(body);

    return parsed.success ? parsed.data.email : null;
  } catch {
    // A body that is not JSON is not a sign-in attempt this table can attribute; the auth layer
    // rejects it on its own.
    return null;
  }
};

/**
 * The client address the platform forwarded. Vercel and the dev server both set
 * `x-forwarded-for`; the header is hashed, never stored, so trusting it costs no privacy.
 */
const readClientAddress = (headers: Headers): string | null => {
  const forwarded = headers.get("x-forwarded-for");

  if (forwarded !== null) {
    const [first] = forwarded.split(",");
    const address = first?.trim();

    if (address !== undefined && address !== "") {
      return address;
    }
  }

  const realIp = headers.get("x-real-ip");

  if (realIp !== null && realIp.trim() !== "") {
    return realIp.trim();
  }

  return null;
};

interface AuditContext {
  db: Database;
  durationMs: number;
  email: string | null;
  request: Request;
  secret: string;
  status: number;
}

const writeAttempt = async ({
  db,
  durationMs,
  email,
  request,
  secret,
  status,
}: AuditContext) => {
  const address = readClientAddress(request.headers);

  await db.insert(loginAttempts).values({
    durationMs: Math.max(durationMs, 0),
    emailHash:
      email === null
        ? null
        : hashIdentifier(email.trim().toLowerCase(), secret),
    ipHash: address === null ? null : hashIdentifier(address, secret),
    outcome: classify(status),
  });
};

export interface LoginAttemptAuditOptions {
  db: Database;
  secret: string;
}

/** The one property this wrapper reads and replaces; kept structural so it does not import better-auth. */
interface HandlerOwner {
  handler: (request: Request) => Promise<Response>;
}

/**
 * Wraps the auth handler so every password sign-in leaves one audit row.
 *
 * The write is a side channel: it is awaited (a serverless invocation may freeze once the response
 * is returned) but its failure is caught and logged, because a broken audit table must never turn a
 * successful sign-in into a 500.
 */
export const withLoginAttempts = <TAuth extends HandlerOwner>(
  auth: TAuth,
  options: LoginAttemptAuditOptions
): TAuth => {
  const handle = auth.handler.bind(auth);

  auth.handler = async (request) => {
    const { pathname } = new URL(request.url);

    if (!pathname.endsWith(SIGN_IN_PATH)) {
      return await handle(request);
    }

    const startedAt = performance.now();
    const email = await readEmail(request);
    const response = await handle(request);
    const durationMs = Math.round(performance.now() - startedAt);

    try {
      await writeAttempt({
        ...options,
        durationMs,
        email,
        request,
        status: response.status,
      });
    } catch (error) {
      // The audit row is an observation, not a step of the sign-in; log it and let the caller's
      // response stand.
      console.error("login attempt audit failed", error);
    }

    return response;
  };

  return auth;
};
