import type { ReactNode } from "react";

import { requireSession } from "#src/server/admin.ts";

/**
 * Authentication sits above the loading boundary. If it ran in the page, a redirect after the
 * skeleton has streamed would become a client-side meta refresh; here the request still ends in a
 * 307 to login.
 */
const ApiLayout = async ({ children }: { children: ReactNode }) => {
  await requireSession("/settings/api");

  return await children;
};

export default ApiLayout;
