import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Exposes the request path to the server settings layout. A layout cannot read the pathname
 * directly, and the shared shell must know where to redirect an unauthenticated visitor.
 */
export const proxy = (request: NextRequest) => {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);

  return NextResponse.next({ request: { headers } });
};

export const config = {
  matcher: "/settings/:path*",
};
