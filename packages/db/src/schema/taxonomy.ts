import {
  index,
  integer,
  primaryKey,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const categories = snakeCase.table(
  "categories",
  {
    accent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    description: text(),
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull(),
    sortOrder: integer().notNull().default(0),
  },
  (table) => [
    index("categories_sort_order_idx").on(table.sortOrder),
    uniqueIndex("categories_slug_key").on(table.slug),
  ]
);

export const tags = snakeCase.table(
  "tags",
  {
    accent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    description: text(),
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull(),
  },
  (table) => [uniqueIndex("tags_slug_key").on(table.slug)]
);

/**
 * Join table between posts and tags. The old site carried no foreign keys here, and the composite
 * primary key is what keeps a pair unique.
 */
export const postTags = snakeCase.table(
  "post_tags",
  {
    postId: uuid().notNull(),
    tagId: uuid().notNull(),
  },
  (table) => [
    index("post_tags_tag_idx").on(table.tagId),
    primaryKey({
      columns: [table.postId, table.tagId],
      name: "post_tags_pkey",
    }),
  ]
);

export type Category = typeof categories.$inferSelect;

export type NewCategory = typeof categories.$inferInsert;

export type Tag = typeof tags.$inferSelect;

export type NewTag = typeof tags.$inferInsert;

export type PostTag = typeof postTags.$inferSelect;
