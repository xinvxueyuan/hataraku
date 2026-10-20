import { and, desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { posts } from "@hataraku/db/schema/posts";
import { searchIndex } from "@hataraku/db/schema/search";

import type { Context } from "#src/context.ts";
import { paginate } from "#src/pagination.ts";
import { publicProcedure } from "#src/procedures.ts";
import { searchInput, searchResultSchema } from "#src/schemas.ts";

/** Terms are capped so a pathological query cannot build an enormous tsquery. */
const MAX_TERM_LENGTH = 256;

/** Above this many terms the OR fallback is skipped: see the precision note below. */
const MAX_FALLBACK_TERMS = 3;

const visible = sql`${posts.published} = true and ${posts.draft} = false`;

/**
 * Runs one retrieval pass.
 *
 * `ns_tsquery_text` and `ns_tsquery_text_or` live in the database (the hand-written full-text
 * migration) and segment Chinese the same way the stored vector was built. PostgreSQL's built-in
 * parser does not segment Chinese — `to_tsvector('simple','限流网关与')` is a single lexeme — so
 * without that shared segmentation a search for 「限流」 matches nothing.
 */
const runSearch = async (
  db: Context["db"],
  options: {
    mode: "and" | "or";
    page: number;
    pageSize: number;
    term: string;
  }
) => {
  const tsquery =
    options.mode === "and"
      ? sql`websearch_to_tsquery('simple', ns_tsquery_text(${options.term}))`
      : sql`websearch_to_tsquery('simple', ns_tsquery_text_or(${options.term}))`;

  const match: SQL = sql`${searchIndex.tsv} @@ ${tsquery}`;
  const rank = sql<number>`ts_rank(${searchIndex.tsv}, ${tsquery})`.as("rank");
  const where = and(match, visible);

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        categorySlug: posts.categorySlug,
        description: posts.description,
        publishedAt: posts.publishedAt,
        rank,
        slug: posts.slug,
        title: posts.title,
      })
      .from(searchIndex)
      .innerJoin(posts, eq(posts.id, searchIndex.postId))
      .where(where)
      .orderBy(desc(rank), desc(posts.publishedAt))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
    db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(searchIndex)
      .innerJoin(posts, eq(posts.id, searchIndex.postId))
      .where(where),
  ]);

  return {
    items: rows.map((row) => ({ ...row, rank: row.rank })),
    total: totalRow[0]?.total ?? 0,
  };
};

export const searchRouter = {
  /**
   * Full-text search, replacing the old site's Pagefind index.
   *
   * Two passes: the AND pass requires every 2-gram of each Chinese run (precision first), and only
   * when it finds nothing and the query has at most three terms does the OR pass relax it. The gate
   * is what keeps a query like 「不存在的词xyz」 at zero results — an unconditional OR pass would
   * match any document sharing a single 2-gram such as 「存在」 or 「的词」.
   */
  query: publicProcedure
    .input(searchInput)
    .output(searchResultSchema)
    .handler(async ({ context, input }) => {
      const term = input.q.trim().slice(0, MAX_TERM_LENGTH);

      if (term === "") {
        return { ...paginate([], 0, input), fallback: false, query: term };
      }

      const primary = await runSearch(context.db, {
        ...input,
        mode: "and",
        term,
      });

      if (primary.total > 0) {
        return {
          ...paginate(primary.items, primary.total, input),
          fallback: false,
          query: term,
        };
      }

      const [terms] = await context.db
        .select({ terms: sql<string[] | null>`ns_tsquery_terms(${term})` })
        .from(searchIndex)
        .limit(1);

      const termCount = terms?.terms?.length ?? 0;

      if (termCount === 0 || termCount > MAX_FALLBACK_TERMS) {
        return { ...paginate([], 0, input), fallback: false, query: term };
      }

      const relaxed = await runSearch(context.db, {
        ...input,
        mode: "or",
        term,
      });

      return {
        ...paginate(relaxed.items, relaxed.total, input),
        fallback: true,
        query: term,
      };
    }),
};
