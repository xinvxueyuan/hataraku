import { paginate } from "#src/pagination.ts";
import { publicProcedure } from "#src/procedures.ts";
import { searchInput, searchResultSchema } from "#src/schemas.ts";
import { searchPosts } from "#src/search/orama.ts";

/**
 * Full-text search over the in-process Orama index.
 *
 * The public contract is unchanged: q/page/pageSize in, a page of hits and a total out. Ranking,
 * prefix matching and the Chinese tokenizer live in #src/search/orama.ts. The previous Postgres
 * full-text path is no longer read; that module documents the transitional state and the removal
 * plan for the old database objects.
 */
export const searchRouter = {
  query: publicProcedure
    .input(searchInput)
    .output(searchResultSchema)
    .handler(async ({ context, input }) => {
      const result = await searchPosts(context.db, input);

      return {
        ...paginate(result.items, result.total, input),
        query: result.query,
      };
    }),
};
