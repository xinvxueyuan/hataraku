import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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

import type { AnalyticsConfig, HeroMeta } from "#src/schema/json.ts";

const textArray = () =>
  text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`);

export const diaryEntries = snakeCase.table(
  "diary_entries",
  {
    content: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    date: date(),
    id: uuid().primaryKey().defaultRandom(),
    imageKeys: textArray(),
    images: textArray(),
    location: text(),
    mood: text(),
    published: boolean().notNull().default(true),
    publishedAt: timestamp({ withTimezone: true }),
    slug: text().notNull(),
    sourceHash: text(),
    sourcePath: text(),
    tags: textArray(),
    title: text(),
    weather: text(),
  },
  (table) => [
    index("diary_entries_date_idx").on(table.date),
    uniqueIndex("diary_entries_slug_key").on(table.slug),
  ]
);

export const timelineEntries = snakeCase.table(
  "timeline_entries",
  {
    category: text().notNull().default("milestone"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    date: date(),
    description: text(),
    highlight: boolean().notNull().default(false),
    icon: text(),
    id: uuid().primaryKey().defaultRandom(),
    link: text(),
    published: boolean().notNull().default(true),
    slug: text().notNull(),
    sortOrder: integer().notNull().default(0),
    sourceHash: text(),
    sourcePath: text(),
    title: text().notNull(),
  },
  (table) => [
    index("timeline_entries_date_idx").on(table.date),
    index("timeline_entries_sort_order_idx").on(table.sortOrder),
    uniqueIndex("timeline_entries_slug_key").on(table.slug),
  ]
);

/**
 * Exactly one row, pinned to id = 1 by the check constraint, so a reader can address the site
 * profile without a lookup key.
 */
export const siteProfile = snakeCase.table(
  "site_profile",
  {
    /**
     * Third-party analytics, off unless the owner turns it on. Stored with a full default object so
     * a row that predates the column reads as "disabled" rather than as an absent value.
     */
    analytics: jsonb().$type<AnalyticsConfig>().notNull().default({
      enabled: false,
      provider: "none",
      respectDnt: true,
      scriptSrc: "",
      siteId: "",
    }),
    author: text(),
    avatarKey: text(),
    avatarUrl: text(),
    description: text(),
    email: text(),
    hero: jsonb().$type<HeroMeta>(),
    id: integer().primaryKey().default(1),
    name: text().notNull(),
    nameEn: text(),
    social: jsonb().$type<Record<string, string>>(),
    tagline: text(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("site_profile_single_row", sql`${table.id} = 1`)]
);

export type DiaryEntry = typeof diaryEntries.$inferSelect;

export type NewDiaryEntry = typeof diaryEntries.$inferInsert;

export type TimelineEntry = typeof timelineEntries.$inferSelect;

export type NewTimelineEntry = typeof timelineEntries.$inferInsert;

export type SiteProfile = typeof siteProfile.$inferSelect;

export type NewSiteProfile = typeof siteProfile.$inferInsert;
