import { sql } from "drizzle-orm";
import {
  customType,
  index,
  snakeCase,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Postgres' built-in tsvector. Drizzle has no wrapper, and the column type has to match the
 * database so the schema snapshot stays free of drift.
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});

/**
 * One row per post, maintained by the triggers in the hand-written full-text migration. A reader
 * matches with `websearch_to_tsquery('simple', ...)` against the GIN index.
 */
export const searchIndex = snakeCase.table(
  "search_index",
  {
    body: text(),
    description: text(),
    postId: uuid().primaryKey(),
    publishedAt: timestamp({ withTimezone: true }),
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    title: text().notNull(),
    tsv: tsvector(),
  },
  (table) => [
    index("search_index_published_at_idx").on(table.publishedAt),
    index("search_index_tsv_gin").using("gin", table.tsv),
  ]
);

export type SearchIndexRow = typeof searchIndex.$inferSelect;
