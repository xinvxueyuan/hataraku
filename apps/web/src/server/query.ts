import "server-only";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient } from "@tanstack/react-query";
import { cache } from "react";

import { appRouter } from "@hataraku/api";
import type { AppRouterClient } from "@hataraku/api";

import { getDb } from "#src/server/api.ts";
import { readEnv } from "#src/server/env.ts";
import { getSession } from "#src/server/session.ts";

/**
 * Server Components call the router in this process, through the same middleware and validation a
 * request takes, with the visitor's session.
 *
 * The context is a function because oRPC resolves it per call: the session belongs to the request
 * being rendered, and a module-level client cannot hold one request's session for the next.
 */
const serverClient: AppRouterClient = createRouterClient(appRouter, {
  context: async () => ({
    adminEmails: readEnv().ADMIN_EMAILS,
    db: getDb(),
    session: await getSession(),
  }),
});

/**
 * The typed client itself, for server components that render data and hydrate nothing.
 *
 * `serverApi` exists for the prefetch-then-hydrate path: a client component reads the same query
 * from the cache. A page that only prints data on the server does not need that machinery, and
 * calling the procedure directly says so.
 */
export const serverCall = serverClient;

export const serverApi = createTanstackQueryUtils(serverClient);

export const getQueryClient = cache(() => new QueryClient());
