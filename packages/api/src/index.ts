import type { RouterClient } from "@orpc/server";

import { apiTokensRouter } from "#src/routers/api-tokens.ts";
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

export {
  API_SCOPES,
  generateToken,
  hashToken,
  hasScope,
  isApiScope,
  parseBearer,
  resolveApiToken,
} from "#src/tokens.ts";

export type {
  ApiScope,
  ApiTokenPrincipal,
  GeneratedToken,
} from "#src/tokens.ts";

export {
  isPublicApiPath,
  isPublicApiProcedure,
  PUBLIC_API_ROUTES,
  PUBLIC_API_TAGS,
  publicApiCorsHeaders,
  publicRoute,
  WRITE_API_ROUTES,
  WRITE_API_SECURITY,
  writeRoute,
} from "#src/openapi-public.ts";

export const appRouter = {
  apiTokens: apiTokensRouter,
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
