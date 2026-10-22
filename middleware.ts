import { NextResponse, type NextRequest } from "next/server";
import { isProjectPaused } from "@/lib/project-status";

export function middleware(request: NextRequest) {
  if (!isProjectPaused) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { status: "paused", message: "EdDash тимчасово на паузі." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (request.nextUrl.pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|brand/|favicon.ico|robots.txt|sitemap.xml).*)"]
};
