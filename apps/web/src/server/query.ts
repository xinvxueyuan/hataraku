import "server-only";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient } from "@tanstack/react-query";
import { headers } from "next/headers";
import { cache } from "react";

import type { AppRouterClient } from "@hataraku/api";

import { readEnv } from "#src/server/env.ts";

// Server Components call the API server directly, with the visitor's cookies.
const serverClient: AppRouterClient = createORPCClient(
  new RPCLink({
    headers: async () => {
      const requestHeaders = await headers();

      return { cookie: requestHeaders.get("cookie") ?? "" };
    },
    url: () => `${readEnv().SERVER_URL}/rpc`,
  })
);

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
