import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { loginAttempts } from "@hataraku/db/schema/audit";
import { session } from "@hataraku/db/schema/auth";

import { adminProcedure, protectedProcedure } from "#src/procedures.ts";

/**
 * The security overview reads two tables with different visibility rules.
 *
 * A session row names its user, so the page can list a visitor's own sessions and nothing else:
 * every query here filters on `context.session.user.id`, and the procedure never accepts an id a
 * caller could use to reach somebody else's row.
 *
 * A login attempt does not name a user. `login_attempts` is deployment-wide rate-limit audit data
 * keyed by HMAC digests of the address and the email (the raw values never reach the database), so
 * there is no row that could be scoped to one account. That is why the attempt list is
 * `adminProcedure` and not a per-user query: a signed-in account outside `ADMIN_EMAILS` gets
 * FORBIDDEN, which is the same gate every other deployment-wide read uses.
 */

/** Enough sessions to cover a person's devices without turning the page into an archive. */
const MAX_SESSIONS = 20;

/** Recent attempts are an at-a-glance signal, not an audit export. */
const MAX_ATTEMPTS = 50;

/**
 * A stored digest is 64 hex characters. Showing its first 12 keeps enough to tell two attempts
 * apart and correlate a burst, while the digest stays a pseudonym rather than an identifier.
 */
const DIGEST_PREFIX = 12;

const sessionViewSchema = z.object({
  createdAt: z.date(),
  expiresAt: z.date(),
  id: z.string(),
  ipAddress: z.string().nullable(),
  isCurrent: z.boolean(),
  userAgent: z.string().nullable(),
});

const overviewOutputSchema = z.object({
  activeSessions: z.array(sessionViewSchema),
  twoFactorEnabled: z.boolean(),
});

const attemptViewSchema = z.object({
  createdAt: z.date(),
  durationMs: z.int().nullable(),
  id: z.uuid(),
  /** The first 12 characters of the stored IP digest; the raw address is not in the database. */
  ipDigest: z.string().nullable(),
  outcome: z.string(),
});

export const securityRouter = {
  /** Deployment-wide sign-in attempts, newest first. The site owner sees them; nobody else does. */
  attempts: adminProcedure
    .output(z.array(attemptViewSchema))
    .handler(async ({ context }) => {
      const rows = await context.db
        .select({
          createdAt: loginAttempts.createdAt,
          durationMs: loginAttempts.durationMs,
          id: loginAttempts.id,
          ipHash: loginAttempts.ipHash,
          outcome: loginAttempts.outcome,
        })
        .from(loginAttempts)
        .orderBy(desc(loginAttempts.createdAt))
        .limit(MAX_ATTEMPTS);

      return rows.map((row) => ({
        createdAt: row.createdAt,
        durationMs: row.durationMs,
        id: row.id,
        ipDigest: row.ipHash?.slice(0, DIGEST_PREFIX) ?? null,
        outcome: row.outcome,
      }));
    }),

  /** The caller's active sessions, newest first, with the one serving this request marked. */
  overview: protectedProcedure
    .output(overviewOutputSchema)
    .handler(async ({ context }) => {
      const userId = context.session.user.id;

      const rows = await context.db
        .select({
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          id: session.id,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
        })
        .from(session)
        .where(
          and(eq(session.userId, userId), gt(session.expiresAt, new Date()))
        )
        .orderBy(desc(session.createdAt))
        .limit(MAX_SESSIONS);

      return {
        activeSessions: rows.map((row) => ({
          ...row,
          isCurrent: row.id === context.session.session.id,
        })),
        twoFactorEnabled: context.session.user.twoFactorEnabled === true,
      };
    }),
};
