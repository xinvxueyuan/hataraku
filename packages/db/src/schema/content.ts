import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { CoverMeta, MusicMeta } from "#src/schema/json.ts";

const textArray = () =>
  text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`);

const createdAt = timestamp({ withTimezone: true }).notNull().defaultNow();

export const microPosts = snakeCase.table(
  "micro_posts",
  {
    content: text().notNull(),
    createdAt,
    id: uuid().primaryKey().defaultRandom(),
    imageKeys: textArray(),
    images: textArray(),
    music: jsonb().$type<MusicMeta>(),
    published: boolean().notNull().default(true),
    publishedAt: timestamp({ withTimezone: true }),
    slug: text().notNull(),
    sourceHash: text(),
    sourcePath: text(),
    tags: textArray(),
    type: text().notNull().default("text"),
  },
  (table) => [
    index("micro_posts_published_at_idx").on(table.publishedAt),
    uniqueIndex("micro_posts_slug_key").on(table.slug),
  ]
);

export const projects = snakeCase.table(
  "projects",
  {
    bodyMd: text(),
    cover: jsonb().$type<CoverMeta>(),
    coverKey: text(),
    createdAt,
    description: text(),
    featured: boolean().notNull().default(false),
    id: uuid().primaryKey().defaultRandom(),
    link: text(),
    published: boolean().notNull().default(true),
    publishedAt: timestamp({ withTimezone: true }),
    repo: text(),
    slug: text().notNull(),
    sortOrder: integer().notNull().default(0),
    sourceHash: text(),
    sourcePath: text(),
    status: text().notNull().default("active"),
    tags: textArray(),
    title: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("projects_featured_idx").on(table.featured),
    index("projects_sort_order_idx").on(table.sortOrder),
    uniqueIndex("projects_slug_key").on(table.slug),
  ]
);

export const changelogEntries = snakeCase.table(
  "changelog_entries",
  {
    bodyMd: text(),
    changes: textArray(),
    createdAt,
    highlight: boolean().notNull().default(false),
    id: uuid().primaryKey().defaultRandom(),
    releasedAt: date(),
    slug: text().notNull(),
    sourceHash: text(),
    sourcePath: text(),
    title: text(),
    version: text().notNull(),
  },
  (table) => [
    index("changelog_entries_released_at_idx").on(table.releasedAt),
    uniqueIndex("changelog_entries_slug_key").on(table.slug),
  ]
);

export const tools = snakeCase.table(
  "tools",
  {
    category: text().notNull().default("dev"),
    createdAt,
    description: text(),
    featured: boolean().notNull().default(false),
    iconKey: text(),
    id: uuid().primaryKey().defaultRandom(),
    link: text(),
    name: text().notNull(),
    published: boolean().notNull().default(true),
    slug: text().notNull(),
    sortOrder: integer().notNull().default(0),
    sourceHash: text(),
    sourcePath: text(),
    tags: textArray(),
  },
  (table) => [
    index("tools_category_idx").on(table.category),
    index("tools_sort_order_idx").on(table.sortOrder),
    uniqueIndex("tools_slug_key").on(table.slug),
  ]
);

export const friends = snakeCase.table(
  "friends",
  {
    avatarKey: text(),
    avatarUrl: text(),
    createdAt,
    description: text(),
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    published: boolean().notNull().default(true),
    slug: text().notNull(),
    sortOrder: integer().notNull().default(0),
    sourceHash: text(),
    sourcePath: text(),
    tags: textArray(),
    url: text().notNull(),
  },
  (table) => [
    index("friends_sort_order_idx").on(table.sortOrder),
    uniqueIndex("friends_slug_key").on(table.slug),
  ]
);

export const skills = snakeCase.table(
  "skills",
  {
    category: text().notNull().default("general"),
    createdAt,
    description: text(),
    iconKey: text(),
    id: uuid().primaryKey().defaultRandom(),
    level: integer().notNull().default(0),
    levelLabel: text(),
    name: text().notNull(),
    slug: text().notNull(),
    sortOrder: integer().notNull().default(0),
  },
  (table) => [
    index("skills_category_idx").on(table.category),
    index("skills_sort_order_idx").on(table.sortOrder),
    uniqueIndex("skills_slug_key").on(table.slug),
  ]
);

export type MicroPost = typeof microPosts.$inferSelect;

export type NewMicroPost = typeof microPosts.$inferInsert;

export type Project = typeof projects.$inferSelect;

export type NewProject = typeof projects.$inferInsert;

export type ChangelogEntry = typeof changelogEntries.$inferSelect;

export type NewChangelogEntry = typeof changelogEntries.$inferInsert;

export type Tool = typeof tools.$inferSelect;

export type NewTool = typeof tools.$inferInsert;

export type Friend = typeof friends.$inferSelect;

export type NewFriend = typeof friends.$inferInsert;

export type Skill = typeof skills.$inferSelect;

export type NewSkill = typeof skills.$inferInsert;
