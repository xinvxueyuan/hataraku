import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    published: boolean().notNull().default(true),
    publishedAt: timestamp({ withTimezone: true }),
    readingMinutes: integer(),
    slug: text(),
    slugOnly: boolean().notNull().default(false),
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
    uniqueIndex("posts_slug_key")
      .on(table.slug)
      .where(sql`${table.slug} is not null`),
    check(
      "posts_slug_only_requires_slug",
      sql`not (${table.slugOnly} and ${table.slug} is null)`
    ),
  ]
);

export type Post = typeof posts.$inferSelect;

export type NewPost = typeof posts.$inferInsert;
