import {
  boolean,
  index,
  integer,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const posts = snakeCase.table(
  "posts",
  {
    bodyMd: text(),
    categoryId: uuid(),
    categorySlug: text(),
    comment: boolean().notNull().default(true),
    coverKey: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    description: text(),
    draft: boolean().notNull().default(false),
    featured: boolean().notNull().default(false),
    id: uuid().primaryKey().defaultRandom(),
    published: boolean().notNull().default(true),
    publishedAt: timestamp({ withTimezone: true }),
    readingMinutes: integer(),
    slug: text().notNull(),
    sourceHash: text(),
    sourcePath: text(),
    title: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }),
    views: integer().notNull().default(0),
  },
  (table) => [
    index("posts_category_idx").on(table.categoryId),
    index("posts_draft_published_idx").on(table.draft, table.published),
    index("posts_published_at_idx").on(table.publishedAt),
    index("posts_views_idx").on(table.views),
    uniqueIndex("posts_slug_key").on(table.slug),
  ]
);

export type Post = typeof posts.$inferSelect;

export type NewPost = typeof posts.$inferInsert;
