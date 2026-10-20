import { ORPCError, os } from "@orpc/server";

import { createEmailAllowlist } from "@hataraku/auth";

import type { Context } from "#src/context.ts";

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
