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

/** Shared page/pageSize fields. `pageSize` is capped so no caller can pull a whole table. */
const paginationFields = {
  page: z.int().min(1).default(1),
  pageSize: z.int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
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

const coverMetaSchema = z.object({
  alt: z.string().optional(),
  height: z.number().optional(),
  src: z.string(),
  width: z.number().optional(),
});

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

const navMetaSchema = z.object({
  cta: z.object({ href: z.string(), label: z.string() }).optional(),
});

/* -------------------------------------------------------------------------- */
/* posts                                                                       */
/* -------------------------------------------------------------------------- */

export const postSummarySchema = z.object({
  categorySlug: z.string().nullable(),
  cover: coverMetaSchema.nullable(),
  coverKey: z.string().nullable(),
  description: z.string().nullable(),
  featured: z.boolean(),
  id: z.string(),
  publishedAt: z.date().nullable(),
  readingMinutes: z.int().nullable(),
  slug: z.string(),
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
  featuredOnly: z.boolean().optional(),
  orderBy: postOrderFieldSchema.optional(),
  tagSlugs: z.array(z.string().min(1)).min(1).optional(),
  ...paginationFields,
});

export const slugInput = z.object({ slug: z.string().min(1) });

export const relatedPostsInput = z.object({
  limit: z.int().min(1).max(10).default(3),
  slug: z.string().min(1),
});

export const adjacentPostsSchema = z.object({
  next: postSummarySchema.nullable(),
  previous: postSummarySchema.nullable(),
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
  minCount: z.int().min(0).default(1),
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

const searchHitSchema = z.object({
  categorySlug: z.string().nullable(),
  description: z.string().nullable(),
  publishedAt: z.date().nullable(),
  rank: z.number(),
  slug: z.string(),
  title: z.string(),
});

export const searchInput = z.object({
  q: z.string(),
  ...paginationFields,
});

export const searchResultSchema = paginatedSchema(searchHitSchema).extend({
  /** True when the AND query found nothing and the OR fallback was used. */
  fallback: z.boolean(),
  query: z.string(),
});

/* -------------------------------------------------------------------------- */
/* site                                                                        */
/* -------------------------------------------------------------------------- */

export const siteProfileSchema = z.object({
  author: z.string().nullable(),
  avatarKey: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  description: z.string().nullable(),
  email: z.string().nullable(),
  hero: heroMetaSchema.nullable(),
  id: z.int(),
  name: z.string(),
  nameEn: z.string().nullable(),
  nav: navMetaSchema.nullable(),
  social: z.record(z.string(), z.string()).nullable(),
  tagline: z.string().nullable(),
  updatedAt: z.date(),
});

/* -------------------------------------------------------------------------- */
/* content                                                                     */
/* -------------------------------------------------------------------------- */

export const projectSchema = z.object({
  bodyMd: z.string().nullable(),
  cover: coverMetaSchema.nullable(),
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
  featuredOnly: z.boolean().optional(),
  status: z.string().min(1).optional(),
  ...paginationFields,
});

export const listMicroInput = z.object({
  type: z.string().min(1).optional(),
  ...paginationFields,
});

export const listChangelogInput = z.object({
  highlightOnly: z.boolean().optional(),
  ...paginationFields,
});

export const listToolsInput = z.object({
  category: z.string().min(1).optional(),
  featuredOnly: z.boolean().optional(),
  ...paginationFields,
});

/* -------------------------------------------------------------------------- */
/* media                                                                       */
/* -------------------------------------------------------------------------- */

const albumPhotoSchema = z.object({
  albumId: z.string(),
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
  cover: coverMetaSchema.nullable(),
  coverKey: z.string().nullable(),
  createdAt: z.date(),
  date: z.string().nullable(),
  description: z.string().nullable(),
  id: z.string(),
  published: z.boolean(),
  publishedAt: z.date().nullable(),
  slug: z.string(),
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
