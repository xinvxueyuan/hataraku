import {
  boolean,
  index,
  integer,
  snakeCase,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const user = snakeCase.table("user", {
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  id: text().primaryKey(),
  image: text(),
  name: text().notNull(),
  // Better Auth's two-factor plugin owns this column; it is not user input.
  twoFactorEnabled: boolean().notNull().default(false),
  ...timestamps,
});

export const session = snakeCase.table(
  "session",
  {
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    id: text().primaryKey(),
    ipAddress: text(),
    token: text().notNull().unique(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
);

export const account = snakeCase.table(
  "account",
  {
    accessToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    accountId: text().notNull(),
    id: text().primaryKey(),
    idToken: text(),
    password: text(),
    providerId: text().notNull(),
    refreshToken: text(),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("account_user_id_idx").on(table.userId)]
);

/**
 * Better Auth's `twoFactor` plugin model: one row per enrolled second factor.
 * Field set and defaults mirror the plugin's own schema.
 */
export const twoFactor = snakeCase.table(
  "two_factor",
  {
    backupCodes: text().notNull(),
    failedVerificationCount: integer().notNull().default(0),
    id: text().primaryKey(),
    lockedUntil: timestamp({ withTimezone: true }),
    secret: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("two_factor_secret_idx").on(table.secret),
    index("two_factor_user_id_idx").on(table.userId),
  ]
);

export const verification = snakeCase.table(
  "verification",
  {
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    ...timestamps,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);
