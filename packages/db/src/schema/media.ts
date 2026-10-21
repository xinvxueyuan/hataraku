import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const textArray = () =>
  text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`);

export const albums = snakeCase.table(
  "albums",
  {
    coverKey: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    date: date(),
    description: text(),
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    published: boolean().notNull().default(true),
    publishedAt: timestamp({ withTimezone: true }),
    slug: text(),
    slugOnly: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
    sourceHash: text(),
    sourcePath: text(),
    tags: textArray(),
    title: text().notNull(),
  },
  (table) => [
    index("albums_date_idx").on(table.date),
    index("albums_sort_order_idx").on(table.sortOrder),
    uniqueIndex("albums_slug_key")
      .on(table.slug)
      .where(sql`${table.slug} is not null`),
    check(
      "albums_slug_only_requires_slug",
      sql`not (${table.slugOnly} and ${table.slug} is null)`
    ),
  ]
);

export const albumPhotos = snakeCase.table(
  "album_photos",
  {
    albumId: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    description: text(),
    height: integer(),
    id: uuid().primaryKey().defaultRandom(),
    imageKey: text().notNull(),
    slug: text(),
    sortOrder: integer().notNull().default(0),
    takenAt: timestamp({ withTimezone: true }),
    thumbKey: text(),
    title: text(),
    width: integer(),
  },
  (table) => [
    index("album_photos_album_idx").on(table.albumId, table.sortOrder),
    foreignKey({
      columns: [table.albumId],
      foreignColumns: [albums.id],
      name: "album_photos_album_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const devices = snakeCase.table(
  "devices",
  {
    brand: text(),
    category: text().notNull().default("gear"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    description: text(),
    id: uuid().primaryKey().defaultRandom(),
    imageKey: text(),
    link: text(),
    name: text().notNull(),
    published: boolean().notNull().default(true),
    slug: text().notNull(),
    sortOrder: integer().notNull().default(0),
    sourceHash: text(),
    sourcePath: text(),
    specs: jsonb().$type<Record<string, string>>(),
    status: text().notNull().default("active"),
    tags: textArray(),
  },
  (table) => [
    index("devices_category_idx").on(table.category),
    index("devices_sort_order_idx").on(table.sortOrder),
    uniqueIndex("devices_slug_key").on(table.slug),
  ]
);

export type Album = typeof albums.$inferSelect;

export type NewAlbum = typeof albums.$inferInsert;

export type AlbumPhoto = typeof albumPhotos.$inferSelect;

export type NewAlbumPhoto = typeof albumPhotos.$inferInsert;

export type Device = typeof devices.$inferSelect;

export type NewDevice = typeof devices.$inferInsert;
