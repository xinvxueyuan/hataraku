import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

import type { Database } from "@hataraku/db";
import { apiTokens } from "@hataraku/db/schema/api-tokens";

/** Scopes a token may carry. */
export const API_SCOPES = [
  "posts:write",
  "notes:write",
  "projects:write",
  "changelog:write",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export interface GeneratedToken {
  /** Short, non-secret prefix shown in the settings list. */
  prefix: string;
  /** The one and only time the plaintext leaves the server. */
  token: string;
}

const TOKEN_PREFIX = "hkr_";
const TOKEN_PATTERN = /^Bearer (?<token>hkr_[A-Za-z0-9_-]{43})$/u;

/** 32 random bytes as base64url: 43 characters, no padding. */
export const generateToken = (): GeneratedToken => {
  const secret = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;

  return { prefix: `${TOKEN_PREFIX}${secret.slice(0, 8)}`, token };
};

/** The only representation persisted for a token. */
export const hashToken = (plain: string): string =>
  createHash("sha256").update(plain).digest("hex");

/**
 * Accepts exactly one scheme and one shape: `Bearer hkr_` plus 43 base64url characters.
 * Basic, empty, padded and differently-spaced headers are rejected without a database lookup.
 */
export const parseBearer = (header?: string | null): string | null => {
  if (header === null || header === undefined) {
    return null;
  }

  return TOKEN_PATTERN.exec(header)?.groups?.token ?? null;
};

export const hasScope = (
  scopes: readonly ApiScope[],
  scope: ApiScope
): boolean => scopes.includes(scope);

const SCOPE_SET: ReadonlySet<string> = new Set(API_SCOPES);

export const isApiScope = (value: string): value is ApiScope =>
  SCOPE_SET.has(value);

export interface ApiTokenPrincipal {
  id: string;
  scopes: readonly ApiScope[];
}

/**
 * Resolves the Bearer header against the token table. A revoked or expired token is null, never an
 * error; the write procedure turns that absence into UNAUTHORIZED. The usage stamp is conditional
 * so a busy token does not write last_used_at on every request.
 */
export const resolveApiToken = async (
  db: Database,
  authorization: string | null | undefined
): Promise<ApiTokenPrincipal | null> => {
  const plain = parseBearer(authorization);

  if (plain === null) {
    return null;
  }

  const now = new Date();

  const [row] = await db
    .select({
      id: apiTokens.id,
      scopes: apiTokens.scopes,
    })
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.tokenHash, hashToken(plain)),
        isNull(apiTokens.revokedAt),
        or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now))
      )
    )
    .limit(1);

  if (row === undefined) {
    return null;
  }

  await db
    .update(apiTokens)
    .set({ lastUsedAt: now })
    .where(
      and(
        eq(apiTokens.id, row.id),
        or(
          isNull(apiTokens.lastUsedAt),
          lt(apiTokens.lastUsedAt, sql`now() - interval '1 minute'`)
        )
      )
    );

  return { id: row.id, scopes: row.scopes.filter(isApiScope) };
};
