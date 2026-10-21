import { z } from "zod";

/**
 * Zod contracts for the blog API. Every procedure declares its input and output here, so the
 * client type is the runtime check: oRPC carries no codegen step.
 *
 * Timestamps are `z.date()`. oRPC's standard serializer encodes `Date` on the wire and restores
 * it on the client, so a reader gets a real `Date` from both the in-process and HTTP transports.
 */

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;

/**
 * GET query values arrive as strings. Coercing here keeps the shared schemas usable by both the RPC
 * transport (numbers and booleans) and the OpenAPI GET transport (strings); a value of the wrong
 * shape still fails validation.
 */
const queryBoolean = z.preprocess((value) => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}, z.boolean());

/** Shared page/pageSize fields. `pageSize` is capped so no caller can pull a whole table. */
const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
};

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.int(),
    pageSize: z.int(),
    total: z.int(),
    totalPages: z.int(),
  });

/* -------------------------------------------------------------------------- */
/* Shared payload shapes                                                       */
/* -------------------------------------------------------------------------- */

const musicMetaSchema = z.object({
  album: z.string().optional(),
  artist: z.string().optional(),
  coverKey: z.string().optional(),
  track: z.string().optional(),
  url: z.string().optional(),
});

const heroMetaSchema = z.object({
  badge: z.string().optional(),
  cta: z.string().optional(),
  ctaHref: z.string().optional(),
  description: z.string().optional(),
  meta: z.string().optional(),
  title: z.string().optional(),
});

/**
 * A date the editor sends for "went live": a calendar day, not an instant. The procedures store it at
 * midnight UTC, so the day the author picked is the day a reader sees on a date-only surface.
 */
const publishedDateSchema = z.iso.date().nullable();

/** A taxonomy slug from the form: trimmed, lowercased, whitespace collapsed to single dashes. */
const taxonomySlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform((value) => value.toLowerCase().replaceAll(/\s+/gu, "-"));

/* -------------------------------------------------------------------------- */
/* posts                                                                       */
/* -------------------------------------------------------------------------- */

export const postSummarySchema = z.object({
  categorySlug: z.string().nullable(),
  coverKey: z.string().nullable(),
  description: z.string().nullable(),
  featured: z.boolean(),
  id: z.int(),
  publishedAt: z.date().nullable(),
  readingMinutes: z.int().nullable(),
  slug: z.string().nullable(),
  slugOnly: z.boolean(),
  tags: z.array(z.string()),
  title: z.string(),
  updatedAt: z.date().nullable(),
});

export const postDetailSchema = postSummarySchema.extend({
  bodyMd: z.string().nullable(),
  category: z
    .object({
      accent: z.string().nullable(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable(),
  comment: z.boolean(),
  views: z.int(),
});

const postOrderFieldSchema = z.enum([
  "publishedAt",
  "updatedAt",
  "views",
  "title",
]);

const sortDirectionSchema = z.enum(["asc", "desc"]);

export const listPostsInput = z.object({
  categorySlug: z.string().min(1).optional(),
  direction: sortDirectionSchema.optional(),
  featuredOnly: queryBoolean.optional(),
  orderBy: postOrderFieldSchema.optional(),
  tagSlugs: z.array(z.string().min(1)).min(1).optional(),
  ...paginationFields,
});

export const slugInput = z.object({ slug: z.string().min(1) });

/** One public content segment: digits address the id, anything else addresses the slug. */
export const refInput = z.object({ segment: z.string().min(1) });

export const relatedPostsInput = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(3),
  segment: z.string().min(1),
});

export const adjacentPostsSchema = z.object({
  next: postSummarySchema.nullable(),
  previous: postSummarySchema.nullable(),
});

/* -------------------------------------------------------------------------- */
/* posts: the write path                                                       */
/* -------------------------------------------------------------------------- */

/** The only two states an editor writes. The read path shows `published` and hides `draft`. */
const postStatusSchema = z.enum(["draft", "published"]);

export const adminPostSummarySchema = z.object({
  id: z.int(),
  publishedAt: z.date().nullable(),
  slug: z.string().nullable(),
  slugOnly: z.boolean(),
  status: postStatusSchema,
  title: z.string(),
  updatedAt: z.date().nullable(),
});

export const adminPostDetailSchema = adminPostSummarySchema.extend({
  bodyMd: z.string(),
  categorySlug: z.string().nullable(),
  coverKey: z.string().nullable(),
  description: z.string().nullable(),
  featured: z.boolean(),
  tagSlugs: z.array(z.string()),
});

export const postIdInput = z.object({ id: z.int() });

/** Kebab-case, so a URL stays predictable and two titles cannot collide on case alone. */
const postSlug = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u,
    "Use lowercase letters, digits and single dashes"
  );

/**
 * The editable fields, without defaults: a default on an omitted field would overwrite it.
 *
 * The taxonomy travels as slugs, not ids, because that is what a URL addresses and what an author
 * types; the procedure resolves (and, for a new one, creates) the row behind the slug.
 */
const postFields = {
  bodyMd: z.string(),
  /** Read only when `categorySlug` names a category that does not exist yet. */
  categoryName: z.string().trim().min(1).max(80).optional(),
  categorySlug: taxonomySlugSchema.nullable(),
  coverKey: z.string().trim().max(300).nullable(),
  description: z.string().max(999).nullable(),
  featured: z.boolean(),
  publishedAt: publishedDateSchema,
  slug: postSlug.nullable(),
  slugOnly: z.boolean(),
  status: postStatusSchema,
  tagSlugs: z.array(taxonomySlugSchema).max(24),
  title: z.string().trim().min(1).max(200),
};

export const createPostInput = z
  .object({
    ...postFields,
    bodyMd: postFields.bodyMd.default(""),
    categorySlug: postFields.categorySlug.default(null),
    coverKey: postFields.coverKey.default(null),
    description: postFields.description.default(null),
    featured: postFields.featured.default(false),
    publishedAt: postFields.publishedAt.default(null),
    slug: postFields.slug.default(null),
    slugOnly: postFields.slugOnly.default(false),
    status: postFields.status.default("draft"),
    tagSlugs: postFields.tagSlugs.default([]),
  })
  .superRefine((value, context) => {
    if (value.slugOnly && value.slug === null) {
      context.addIssue({
        code: "custom",
        message: "slugOnly requires a slug",
        path: ["slug"],
      });
    }
  });

/** Every field but the id is optional, and an omitted field is left as stored. */
export const updatePostInput = z
  .object(postFields)
  .partial()
  .extend(postIdInput.shape)
  .superRefine((value, context) => {
    if (value.slugOnly === true && value.slug === null) {
      context.addIssue({
        code: "custom",
        message: "slugOnly requires a slug",
        path: ["slug"],
      });
    }
  });

/* -------------------------------------------------------------------------- */
/* taxonomy                                                                    */
/* -------------------------------------------------------------------------- */

export const categoryWithCountSchema = z.object({
  accent: z.string().nullable(),
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  postCount: z.int(),
  slug: z.string(),
  sortOrder: z.int(),
});

export const tagWithCountSchema = z.object({
  accent: z.string().nullable(),
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  postCount: z.int(),
  slug: z.string(),
});

export const listTagsInput = z.object({
  minCount: z.coerce.number().int().min(0).default(1),
  orderBy: z.enum(["count", "name"]).default("count"),
});

export const taxonomyOverviewSchema = z.object({
  categories: z.array(categoryWithCountSchema),
  tags: z.array(tagWithCountSchema),
  totalPosts: z.int(),
});

/* -------------------------------------------------------------------------- */
/* search                                                                      */
/* -------------------------------------------------------------------------- */

const searchSnippetSchema = z.object({
  /** Plain text only; the client renders it as text and marks the ranges itself. */
  matches: z.array(
    z.object({ length: z.int().positive(), start: z.int().nonnegative() })
  ),
  text: z.string(),
});

const searchHitSchema = z.object({
  categorySlug: z.string().nullable(),
  description: z.string().nullable(),
  id: z.int(),
  publishedAt: z.date().nullable(),
  rank: z.number(),
  slug: z.string().nullable(),
  slugOnly: z.boolean(),
  /** Body evidence when neither title nor summary carries the query; null otherwise. */
  snippet: searchSnippetSchema.nullable(),
  title: z.string(),
});

export const searchInput = z.object({
  q: z.string(),
  ...paginationFields,
});

export const searchResultSchema = paginatedSchema(searchHitSchema).extend({
  query: z.string(),
});

/* -------------------------------------------------------------------------- */
/* site                                                                        */
/* -------------------------------------------------------------------------- */

/*
 * The editable half of the profile. Every text field is trimmed, and an empty box is not an empty
 * string on the wire: the procedure stores NULL, which is the value the readers treat as "use the
 * constant fallback". `name` is the exception — the column is NOT NULL, so it is required.
 *
 * `social` and `hero` arrive as flat strings because that is what a form edits; the procedure
 * drops the empty ones and stores NULL when none is left, so a cleared section cannot linger as {}.
 */

/** An http(s) URL, or an empty box. A site-relative path is not accepted here. */
const profileUrl = z.union([z.url({ protocol: /^https?$/u }), z.literal("")]);

/** An http(s) URL, a path on this site, or an empty box (a hero CTA may point either way). */
const profileLink = z.union([
  z.url({ protocol: /^https?$/u }),
  z
    .string()
    .trim()
    .regex(/^\/(?!\/)/u, "Use an http(s) URL or a path on this site"),
  z.literal(""),
]);

/**
 * Third-party analytics, configured by the owner and off by default.
 *
 * The write side is strict about what a provider needs; the read side is deliberately lenient (plain
 * strings), because a value hand-edited in the database must not break the profile read — the
 * injector re-checks the URL before it renders a script.
 */
const analyticsProviderSchema = z.enum([
  "custom",
  "google",
  "none",
  "plausible",
  "umami",
]);

/** A provider-issued site id: letters, digits and the separators ids actually contain. */
const analyticsSiteId = z
  .string()
  .trim()
  .max(80)
  .regex(
    /^[A-Za-z0-9._:-]*$/u,
    "Use letters, digits, dots, dashes, colons or underscores"
  );

/**
 * An https URL or an empty box. `javascript:` and `data:` fail the protocol check, and so does a
 * site-relative path: the browser must not fetch a script from anywhere but the named https host.
 */
const analyticsScriptSrc = z.union([
  z.literal(""),
  z.url({ message: "Use an https URL", protocol: /^https$/u }),
]);

const analyticsFields = z.object({
  enabled: z.boolean(),
  provider: analyticsProviderSchema,
  respectDnt: z.boolean(),
  scriptSrc: analyticsScriptSrc,
  siteId: analyticsSiteId,
});

/** The checks one field cannot make: which fields the chosen provider actually needs. */
const analyticsInputSchema = analyticsFields
  .refine((value) => value.provider !== "custom" || value.scriptSrc !== "", {
    message: "The custom provider needs an https script URL",
    path: ["scriptSrc"],
  })
  .refine(
    (value) =>
      value.provider === "custom" ||
      value.provider === "none" ||
      value.siteId !== "",
    { message: "This provider needs the site id it issued", path: ["siteId"] }
  );

/** What a stored row reads back as. Lenient on purpose; see the comment above. */
const analyticsConfigSchema = z.object({
  enabled: z.boolean(),
  provider: analyticsProviderSchema,
  respectDnt: z.boolean(),
  scriptSrc: z.string(),
  siteId: z.string(),
});

export const updateSiteProfileInput = z.object({
  analytics: analyticsInputSchema,
  author: z.string().trim().max(80),
  avatarUrl: profileUrl,
  description: z.string().trim().max(400),
  email: z.union([z.string().trim().pipe(z.email()), z.literal("")]),
  hero: z.object({
    badge: z.string().trim().max(60),
    cta: z.string().trim().max(60),
    ctaHref: profileLink,
    description: z.string().trim().max(400),
    meta: z.string().trim().max(120),
    title: z.string().trim().max(120),
  }),
  name: z.string().trim().min(1, "The site name is required").max(80),
  nameEn: z.string().trim().max(80),
  // A social entry may be a site path (the migrated row carries `rss: /rss.xml`), so the form can
  // save a profile it just read instead of refusing the row it was handed.
  social: z.record(z.string().trim().min(1).max(40), profileLink),
  tagline: z.string().trim().max(200),
});

export const siteProfileSchema = z.object({
  analytics: analyticsConfigSchema,
  author: z.string().nullable(),
  avatarKey: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  description: z.string().nullable(),
  email: z.string().nullable(),
  hero: heroMetaSchema.nullable(),
  id: z.int(),
  name: z.string(),
  nameEn: z.string().nullable(),
  social: z.record(z.string(), z.string()).nullable(),
  tagline: z.string().nullable(),
  updatedAt: z.date(),
});

/* -------------------------------------------------------------------------- */
/* content                                                                     */
/* -------------------------------------------------------------------------- */

export const projectSchema = z.object({
  bodyMd: z.string().nullable(),
  coverKey: z.string().nullable(),
  createdAt: z.date(),
  description: z.string().nullable(),
  featured: z.boolean(),
  id: z.string(),
  link: z.string().nullable(),
  published: z.boolean(),
  publishedAt: z.date().nullable(),
  repo: z.string().nullable(),
  slug: z.string(),
  sortOrder: z.int(),
  status: z.string(),
  tags: z.array(z.string()),
  title: z.string(),
  updatedAt: z.date(),
});

export const microPostSchema = z.object({
  content: z.string(),
  createdAt: z.date(),
  id: z.string(),
  imageKeys: z.array(z.string()),
  images: z.array(z.string()),
  music: musicMetaSchema.nullable(),
  published: z.boolean(),
  publishedAt: z.date().nullable(),
  slug: z.string(),
  tags: z.array(z.string()),
  type: z.string(),
});

export const changelogEntrySchema = z.object({
  bodyMd: z.string().nullable(),
  changes: z.array(z.string()),
  createdAt: z.date(),
  highlight: z.boolean(),
  id: z.string(),
  releasedAt: z.string().nullable(),
  slug: z.string(),
  title: z.string().nullable(),
  version: z.string(),
});

export const toolSchema = z.object({
  category: z.string(),
  createdAt: z.date(),
  description: z.string().nullable(),
  featured: z.boolean(),
  iconKey: z.string().nullable(),
  id: z.string(),
  link: z.string().nullable(),
  name: z.string(),
  published: z.boolean(),
  slug: z.string(),
  sortOrder: z.int(),
  tags: z.array(z.string()),
});

export const friendSchema = z.object({
  avatarKey: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.date(),
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  published: z.boolean(),
  slug: z.string(),
  sortOrder: z.int(),
  tags: z.array(z.string()),
  url: z.string(),
});

export const skillSchema = z.object({
  category: z.string(),
  createdAt: z.date(),
  description: z.string().nullable(),
  iconKey: z.string().nullable(),
  id: z.string(),
  level: z.int(),
  levelLabel: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
  sortOrder: z.int(),
});

export const listProjectsInput = z.object({
  featuredOnly: queryBoolean.optional(),
  status: z.string().min(1).optional(),
  ...paginationFields,
});

export const listMicroInput = z.object({
  type: z.string().min(1).optional(),
  ...paginationFields,
});

export const listChangelogInput = z.object({
  highlightOnly: queryBoolean.optional(),
  ...paginationFields,
});

export const listToolsInput = z.object({
  category: z.string().min(1).optional(),
  featuredOnly: queryBoolean.optional(),
  ...paginationFields,
});

/* content: the write path                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A slug as the form sends it. Free text on purpose: the procedure runs it through `resolveSlug`,
 * which collapses accents, spaces and punctuation, so an empty box means "derive one" and a pasted
 * title still stores a URL-safe slug. What lands in the column is what the pattern would accept.
 */
const slugSchema = z.string().trim().max(200);

const tagListSchema = z.array(z.string().trim().min(1).max(40)).max(24);

const imageKeyListSchema = z.array(z.string().trim().min(1).max(300)).max(12);

/** The note kinds the editor offers; the admin list filters on the same closed set. */
const microPostTypeSchema = z.enum([
  "text",
  "code",
  "image",
  "dialogue",
  "music",
  "link",
]);

const microFields = {
  content: z.string().trim().min(1).max(2000),
  imageKeys: imageKeyListSchema,
  published: z.boolean(),
  publishedAt: publishedDateSchema,
  slug: slugSchema,
  tags: tagListSchema,
  type: microPostTypeSchema,
};

export const microPostIdInput = z.object({ id: z.uuid() });

export const createMicroPostInput = z.object({
  ...microFields,
  imageKeys: microFields.imageKeys.default([]),
  published: microFields.published.default(true),
  publishedAt: microFields.publishedAt.default(null),
  slug: microFields.slug.optional(),
  tags: microFields.tags.default([]),
  type: microFields.type.default("text"),
});

export const updateMicroPostInput = z
  .object(microFields)
  .partial()
  .extend(microPostIdInput.shape);

/** The project states the editor offers; the admin list filters on the same closed set. */
const projectStatusSchema = z.enum(["active", "wip", "planned", "archived"]);

const projectFields = {
  bodyMd: z.string().max(200_000),
  coverKey: z.string().trim().max(300).nullable(),
  description: z.string().trim().max(999).nullable(),
  featured: z.boolean(),
  link: z.url().nullable(),
  published: z.boolean(),
  publishedAt: publishedDateSchema,
  repo: z.url().nullable(),
  slug: slugSchema,
  sortOrder: z.int().min(0).max(10_000),
  status: projectStatusSchema,
  tags: tagListSchema,
  title: z.string().trim().min(1).max(200),
};

export const projectIdInput = z.object({ id: z.uuid() });

export const createProjectInput = z.object({
  ...projectFields,
  bodyMd: projectFields.bodyMd.default(""),
  coverKey: projectFields.coverKey.default(null),
  description: projectFields.description.default(null),
  featured: projectFields.featured.default(false),
  link: projectFields.link.default(null),
  published: projectFields.published.default(true),
  publishedAt: projectFields.publishedAt.default(null),
  repo: projectFields.repo.default(null),
  slug: projectFields.slug.optional(),
  sortOrder: projectFields.sortOrder.default(0),
  status: projectFields.status.default("active"),
  tags: projectFields.tags.default([]),
});

export const updateProjectInput = z
  .object(projectFields)
  .partial()
  .extend(projectIdInput.shape);

const changelogFields = {
  bodyMd: z.string().max(200_000),
  changes: tagListSchema,
  highlight: z.boolean(),
  releasedAt: z.iso.date().nullable(),
  slug: slugSchema,
  title: z.string().trim().max(200).nullable(),
  version: z.string().trim().min(1).max(40),
};

export const changelogEntryIdInput = z.object({ id: z.uuid() });

export const createChangelogEntryInput = z.object({
  ...changelogFields,
  bodyMd: changelogFields.bodyMd.default(""),
  changes: changelogFields.changes.default([]),
  highlight: changelogFields.highlight.default(false),
  releasedAt: changelogFields.releasedAt.default(null),
  slug: changelogFields.slug.optional(),
  title: changelogFields.title.default(null),
});

export const updateChangelogEntryInput = z
  .object(changelogFields)
  .partial()
  .extend(changelogEntryIdInput.shape);

/* -------------------------------------------------------------------------- */
/* admin lists                                                                 */
/* -------------------------------------------------------------------------- */

const ADMIN_MAX_PAGE_SIZE = 50;

/**
 * Paging shared by the four admin lists.
 *
 * An out-of-range `page` or `pageSize` is rejected with BAD_REQUEST instead of being clamped: a
 * shared link that points at page 0 is a broken link, and quietly showing page 1 would hide that.
 * `pageSize` is capped so no caller can pull a whole table in one request.
 */
const adminPagingFields = {
  page: z.int().min(1).default(1),
  pageSize: z.int().min(1).max(ADMIN_MAX_PAGE_SIZE).default(10),
};

/** A search term, matched server-side against the text that identifies a row. */
const adminQueryField = z.string().trim().min(1).max(120);

export const adminPostsListInput = z.object({
  ...adminPagingFields,
  query: adminQueryField.optional(),
  sort: z.enum(["updated", "published"]).default("updated"),
  status: postStatusSchema.optional(),
});

export const adminMicroListInput = z.object({
  ...adminPagingFields,
  published: z.boolean().optional(),
  query: adminQueryField.optional(),
  sort: z.enum(["published", "created"]).default("published"),
  type: microPostTypeSchema.optional(),
});

export const adminProjectsListInput = z.object({
  ...adminPagingFields,
  published: z.boolean().optional(),
  query: adminQueryField.optional(),
  sort: z.enum(["updated", "published"]).default("updated"),
  status: projectStatusSchema.optional(),
});

export const adminChangelogListInput = z.object({
  ...adminPagingFields,
  highlight: z.boolean().optional(),
  query: adminQueryField.optional(),
  sort: z.enum(["released", "created"]).default("released"),
});

/** Counts for the admin index; one query, so the four numbers agree with each other. */
export const adminPostStatsSchema = z.object({
  drafts: z.int(),
  published: z.int(),
  total: z.int(),
});

/* -------------------------------------------------------------------------- */
/* uploads                                                                     */
/* -------------------------------------------------------------------------- */

export const uploadTicketSchema = z.object({
  contentType: z.string(),
  expiresIn: z.int(),
  key: z.string(),
  maxBytes: z.int(),
  publicUrl: z.string(),
  uploadUrl: z.string(),
});

export const uploadPolicySchema = z.object({
  allowedMimeTypes: z.array(z.string()),
  maxBytes: z.int(),
  prefixes: z.array(z.string()),
});

/* -------------------------------------------------------------------------- */
/* media                                                                       */
/* -------------------------------------------------------------------------- */

const albumPhotoSchema = z.object({
  albumId: z.int(),
  createdAt: z.date(),
  description: z.string().nullable(),
  height: z.int().nullable(),
  id: z.string(),
  imageKey: z.string(),
  slug: z.string().nullable(),
  sortOrder: z.int(),
  takenAt: z.date().nullable(),
  thumbKey: z.string().nullable(),
  title: z.string().nullable(),
  width: z.int().nullable(),
});

export const albumSchema = z.object({
  coverKey: z.string().nullable(),
  createdAt: z.date(),
  date: z.string().nullable(),
  description: z.string().nullable(),
  id: z.int(),
  published: z.boolean(),
  publishedAt: z.date().nullable(),
  slug: z.string().nullable(),
  slugOnly: z.boolean(),
  sortOrder: z.int(),
  tags: z.array(z.string()),
  title: z.string(),
});

export const albumWithPhotosSchema = albumSchema.extend({
  photoCount: z.int(),
  photos: z.array(albumPhotoSchema),
});

export const deviceSchema = z.object({
  brand: z.string().nullable(),
  category: z.string(),
  createdAt: z.date(),
  description: z.string().nullable(),
  id: z.string(),
  imageKey: z.string().nullable(),
  link: z.string().nullable(),
  name: z.string(),
  published: z.boolean(),
  slug: z.string(),
  sortOrder: z.int(),
  specs: z.record(z.string(), z.string()).nullable(),
  status: z.string(),
  tags: z.array(z.string()),
});

export const diaryEntrySchema = z.object({
  content: z.string(),
  createdAt: z.date(),
  date: z.string().nullable(),
  id: z.string(),
  imageKeys: z.array(z.string()),
  images: z.array(z.string()),
  location: z.string().nullable(),
  mood: z.string().nullable(),
  published: z.boolean(),
  publishedAt: z.date().nullable(),
  slug: z.string(),
  tags: z.array(z.string()),
  title: z.string().nullable(),
  weather: z.string().nullable(),
});

export const timelineEntrySchema = z.object({
  category: z.string(),
  createdAt: z.date(),
  date: z.string().nullable(),
  description: z.string().nullable(),
  highlight: z.boolean(),
  icon: z.string().nullable(),
  id: z.string(),
  link: z.string().nullable(),
  published: z.boolean(),
  slug: z.string(),
  sortOrder: z.int(),
  title: z.string(),
});

export const listAlbumsInput = z.object({
  tag: z.string().min(1).optional(),
  ...paginationFields,
});

export const listDevicesInput = z.object({
  category: z.string().min(1).optional(),
  ...paginationFields,
});

export const listDiaryInput = z.object({
  from: z.iso.date().optional(),
  tag: z.string().min(1).optional(),
  to: z.iso.date().optional(),
  ...paginationFields,
});

export const listTimelineInput = z.object({
  category: z.string().min(1).optional(),
  ...paginationFields,
});
