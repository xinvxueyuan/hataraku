import {
  index,
  integer,
  snakeCase,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Admin login attempts, kept as HMAC digests only: the raw IP and email never reach the database.
 * It is the shared source of truth for rate limiting, which a per-instance counter cannot be on a
 * multi-instance deployment.
 */
export const loginAttempts = snakeCase.table(
  "login_attempts",
  {
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    durationMs: integer(),
    emailHash: text(),
    id: uuid().primaryKey().defaultRandom(),
    ipHash: text(),
    outcome: text().notNull(),
  },
  (table) => [
    index("login_attempts_created_idx").on(table.createdAt),
    index("login_attempts_email_created_idx").on(
      table.emailHash,
      table.createdAt
    ),
    index("login_attempts_ip_created_idx").on(table.ipHash, table.createdAt),
    index("login_attempts_outcome_created_idx").on(
      table.outcome,
      table.createdAt
    ),
  ]
);

export type LoginAttempt = typeof loginAttempts.$inferSelect;

export type NewLoginAttempt = typeof loginAttempts.$inferInsert;
