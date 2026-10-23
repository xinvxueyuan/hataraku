import { ORPCError } from "@orpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@hataraku/db";
import { apiTokens } from "@hataraku/db/schema/api-tokens";

import { adminProcedure } from "#src/procedures.ts";
import {
  API_SCOPES,
  generateToken,
  hashToken,
  isApiScope,
} from "#src/tokens.ts";

const scopeSchema = z.enum(API_SCOPES);

const tokenRecordSchema = z.object({
  createdAt: z.date(),
  expiresAt: z.date().nullable(),
  id: z.uuid(),
  lastUsedAt: z.date().nullable(),
  name: z.string(),
  prefix: z.string(),
  revokedAt: z.date().nullable(),
  scopes: z.array(scopeSchema),
});

const createInput = z.object({
  expiresInDays: z.int().positive().max(3650).optional(),
  name: z.string().trim().min(1).max(120),
  scopes: z.array(scopeSchema).min(1).max(API_SCOPES.length),
});

const createOutput = tokenRecordSchema.extend({ token: z.string() });

const revokeInput = z.object({ id: z.uuid() });

const tokenColumns = {
  createdAt: apiTokens.createdAt,
  expiresAt: apiTokens.expiresAt,
  id: apiTokens.id,
  lastUsedAt: apiTokens.lastUsedAt,
  name: apiTokens.name,
  prefix: apiTokens.prefix,
  revokedAt: apiTokens.revokedAt,
  scopes: apiTokens.scopes,
};

interface TokenRow {
  createdAt: Date;
  expiresAt: Date | null;
  id: string;
  lastUsedAt: Date | null;
  name: string;
  prefix: string;
  revokedAt: Date | null;
  scopes: string[];
}

const toRecord = (row: TokenRow) => ({
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
  id: row.id,
  lastUsedAt: row.lastUsedAt,
  name: row.name,
  prefix: row.prefix,
  revokedAt: row.revokedAt,
  scopes: row.scopes.filter(isApiScope),
});

const findToken = async (
  db: Database,
  id: string
): Promise<TokenRow | undefined> => {
  const [row] = await db
    .select(tokenColumns)
    .from(apiTokens)
    .where(eq(apiTokens.id, id))
    .limit(1);

  return row;
};

/**
 * Token management is session-admin only. The plaintext token exists in the create response and
 * nowhere else: the list/revoke reads use toRecord, which never selects tokenHash.
 */
export const apiTokensRouter = {
  create: adminProcedure
    .input(createInput)
    .output(createOutput)
    .handler(async ({ context, input }) => {
      const generated = generateToken();

      const expiresAt =
        input.expiresInDays === undefined
          ? null
          : new Date(Date.now() + input.expiresInDays * 86_400_000);

      const [row] = await context.db
        .insert(apiTokens)
        .values({
          expiresAt,
          name: input.name,
          prefix: generated.prefix,
          scopes: input.scopes,
          tokenHash: hashToken(generated.token),
        })
        .returning(tokenColumns);

      if (row === undefined) {
        throw new Error("The API token was not stored.");
      }

      return { ...toRecord(row), token: generated.token };
    }),

  list: adminProcedure
    .output(z.array(tokenRecordSchema))
    .handler(async ({ context }) => {
      const rows = await context.db
        .select(tokenColumns)
        .from(apiTokens)
        .orderBy(desc(apiTokens.createdAt));

      return rows.map(toRecord);
    }),

  revoke: adminProcedure
    .input(revokeInput)
    .output(tokenRecordSchema)
    .handler(async ({ context, input }) => {
      const existing = await findToken(context.db, input.id);

      if (existing === undefined) {
        throw new ORPCError("NOT_FOUND", {
          message: "API token not found",
        });
      }

      if (existing.revokedAt === null) {
        await context.db
          .update(apiTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(apiTokens.id, input.id), isNull(apiTokens.revokedAt)));
      }

      const row = await findToken(context.db, input.id);

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", {
          message: "API token not found",
        });
      }

      return toRecord(row);
    }),
};
