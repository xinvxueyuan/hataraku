import type { RouterClient } from "@orpc/server";

import { contentRouter } from "#src/routers/content.ts";
import { health } from "#src/routers/health.ts";
import { mediaRouter } from "#src/routers/media.ts";
import { postsRouter } from "#src/routers/posts.ts";
import { searchRouter } from "#src/routers/search.ts";
import { securityRouter } from "#src/routers/security.ts";
import { siteRouter } from "#src/routers/site.ts";
import { taxonomyRouter } from "#src/routers/taxonomy.ts";
import { todosRouter } from "#src/routers/todos.ts";

export type { Context } from "#src/context.ts";

export const appRouter = {
  content: contentRouter,
  health,
  media: mediaRouter,
  posts: postsRouter,
  search: searchRouter,
  security: securityRouter,
  site: siteRouter,
  taxonomy: taxonomyRouter,
  todos: todosRouter,
};

export type AppRouter = typeof appRouter;

export type AppRouterClient = RouterClient<AppRouter>;
