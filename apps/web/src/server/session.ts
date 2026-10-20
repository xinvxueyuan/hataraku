import "server-only";
import { headers } from "next/headers";
import { cache } from "react";

import { getAuth } from "#src/server/api.ts";

// The web server owns both halves of the session now: Better Auth runs in this process, so a page
// reads the cookie the same request handler would have verified.
export const getSession = cache(async () => {
  // Read the request headers first: during a production build this throws the dynamic-rendering
  // bailout, and Next must see that before the auth instance reads the environment it needs.
  const requestHeaders = await headers();

  return await getAuth().api.getSession({ headers: requestHeaders });
});
