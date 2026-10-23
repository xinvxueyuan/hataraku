import { ORPCError, os } from "@orpc/server";

import { createEmailAllowlist } from "@hataraku/auth";

import type { Context } from "#src/context.ts";
import type { ApiScope } from "#src/tokens.ts";
import { hasScope } from "#src/tokens.ts";

export const publicProcedure = os.$context<Context>();

export const protectedProcedure = publicProcedure.use(
  async ({ context, next }) => {
    if (!context.session) {
      throw new ORPCError("UNAUTHORIZED");
    }

    return await next({ context: { session: context.session } });
  }
);

/**
 * Writing is for the site owner.
 *
 * `ADMIN_EMAILS` names them. Unset means the deployment is single-user, which is how sign-up already
 * behaves, so any signed-in account may write; with an allowlist configured, only those addresses
 * pass. The session is checked first, so an anonymous caller gets UNAUTHORIZED rather than a hint
 * that a body was rejected.
 */
export const adminProcedure = protectedProcedure.use(
  async ({ context, next }) => {
    const isAllowedEmail = createEmailAllowlist(context.adminEmails);

    if (
      isAllowedEmail !== undefined &&
      !isAllowedEmail(context.session.user.email)
    ) {
      throw new ORPCError("FORBIDDEN", {
        message: "This account is not allowed to write.",
      });
    }

    return await next();
  }
);

/**
 * A write authorized either by an admin session or by a scoped API token.
 *
 * A token is a distinct principal: a missing or revoked token is UNAUTHORIZED, while a valid token
 * that lacks the required scope is FORBIDDEN. A session keeps the same ADMIN_EMAILS rule as every
 * other admin procedure.
 */
export const writeProcedure = (scope: ApiScope) =>
  publicProcedure.use(async ({ context, next }) => {
    if (context.session) {
      const isAllowedEmail = createEmailAllowlist(context.adminEmails);

      if (
        isAllowedEmail !== undefined &&
        !isAllowedEmail(context.session.user.email)
      ) {
        throw new ORPCError("FORBIDDEN", {
          message: "This account is not allowed to write.",
        });
      }

      return await next({ context: { session: context.session } });
    }

    if (!context.apiToken) {
      throw new ORPCError("UNAUTHORIZED");
    }

    if (!hasScope(context.apiToken.scopes, scope)) {
      throw new ORPCError("FORBIDDEN", {
        message: `This token does not allow ${scope}.`,
      });
    }

    return await next();
  });
