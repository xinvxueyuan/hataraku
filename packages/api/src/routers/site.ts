import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

import type { HeroMeta } from "@hataraku/db/schema/json";
import { siteProfile } from "@hataraku/db/schema/pages";

import { publicRoute } from "#src/openapi-public.ts";
import { adminProcedure, publicProcedure } from "#src/procedures.ts";
import { siteProfileSchema, updateSiteProfileInput } from "#src/schemas.ts";

/** The single site profile row, pinned to id = 1 by the table's check constraint. */
const SITE_PROFILE_ID = 1;

/** An empty box clears the column; the readers fall back to their constants. */
const orNull = (value: string): string | null => (value === "" ? null : value);

/**
 * Drops the empty hero fields; no field left means "no hero", not an empty object.
 *
 * A stored `{}` would read as a hero that exists and is blank, so the reader could not fall back.
 */
const compactHero = (hero: {
  badge: string;
  cta: string;
  ctaHref: string;
  description: string;
  meta: string;
  title: string;
}): HeroMeta | null => {
  const compacted: HeroMeta = {};

  if (hero.badge !== "") {
    compacted.badge = hero.badge;
  }

  if (hero.cta !== "") {
    compacted.cta = hero.cta;
  }

  if (hero.ctaHref !== "") {
    compacted.ctaHref = hero.ctaHref;
  }

  if (hero.description !== "") {
    compacted.description = hero.description;
  }

  if (hero.meta !== "") {
    compacted.meta = hero.meta;
  }

  if (hero.title !== "") {
    compacted.title = hero.title;
  }

  return Object.keys(compacted).length === 0 ? null : compacted;
};

/** The same rule for the social links: an empty value removes the entry. */
const compactSocial = (
  social: Record<string, string>
): Record<string, string> | null => {
  const entries = Object.entries(social).filter(([, url]) => url !== "");

  return entries.length === 0 ? null : Object.fromEntries(entries);
};

/**
 * Writes the profile row: the site's name, tagline, social links and hero belong to the owner.
 *
 * `avatarKey` is deliberately absent — it is the object key the uploader stores, not something a
 * form types — and so is `nav`, which has no reader yet. Leaving them out of the `set` means an
 * update never erases them.
 */
export const siteRouter = {
  profile: publicProcedure
    .route(publicRoute("site.profile"))
    .output(siteProfileSchema)
    .handler(async ({ context }) => {
      const [row] = await context.db
        .select()
        .from(siteProfile)
        .where(eq(siteProfile.id, SITE_PROFILE_ID))
        .limit(1);

      if (!row) {
        throw new ORPCError("NOT_FOUND", {
          message: "Site profile is not set",
        });
      }

      return row;
    }),

  updateProfile: adminProcedure
    .input(updateSiteProfileInput)
    .output(siteProfileSchema)
    .handler(async ({ context, input }) => {
      const values = {
        author: orNull(input.author),
        avatarUrl: orNull(input.avatarUrl),
        description: orNull(input.description),
        email: orNull(input.email),
        hero: compactHero(input.hero),
        name: input.name,
        nameEn: orNull(input.nameEn),
        social: compactSocial(input.social),
        tagline: orNull(input.tagline),
        updatedAt: new Date(),
      };

      const [row] = await context.db
        .insert(siteProfile)
        .values({ id: SITE_PROFILE_ID, ...values })
        .onConflictDoUpdate({ set: values, target: siteProfile.id })
        .returning();

      if (!row) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "The site profile could not be written",
        });
      }

      return row;
    }),
};
