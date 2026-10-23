import { sql } from "drizzle-orm";
import { snakeCase, text, timestamp, uuid } from "drizzle-orm/pg-core";

const textArray = () =>
  text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`);

/**
 * A scoped API credential for external writers. The plaintext token is never stored: only its
 * SHA-256 hash is, plus a short prefix for the settings UI to identify the row.
 */
export const apiTokens = snakeCase.table("api_tokens", {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp({ withTimezone: true }),
  id: uuid().primaryKey().defaultRandom(),
  lastUsedAt: timestamp({ withTimezone: true }),
  name: text().notNull(),
  prefix: text().notNull(),
  revokedAt: timestamp({ withTimezone: true }),
  scopes: textArray(),
  tokenHash: text().notNull().unique(),
});

export type ApiToken = typeof apiTokens.$inferSelect;

export type NewApiToken = typeof apiTokens.$inferInsert;
