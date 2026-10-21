import type { NextRequest } from "next/server";

import { handleApiRequest } from "#src/server/api.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handle = async (request: NextRequest) =>
  await handleApiRequest(request, "/api");

export {
  handle as DELETE,
  handle as GET,
  handle as HEAD,
  handle as OPTIONS,
  handle as PATCH,
  handle as POST,
  handle as PUT,
};
