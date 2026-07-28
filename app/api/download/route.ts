import { NextRequest, NextResponse } from "next/server";

/** Uploaded files only ever live in one of two places (see lib/cloudinary.ts):
 * Cloudinary, or this app's own /uploads (local-dev fallback, same origin).
 * Allowlisting those two — instead of proxying any URL a caller supplies —
 * keeps this route from being an open SSRF relay. */
function isAllowedTarget(target: URL, origin: string): boolean {
  if (!["http:", "https:"].includes(target.protocol)) return false;
  return target.hostname === "res.cloudinary.com" || target.origin === origin;
}

/**
 * Streams an uploaded file (gallery photo, news attachment, …) back through
 * our own origin with `Content-Disposition: attachment` — the browser only
 * honours `<a download>` for same-origin URLs, so cross-origin Cloudinary
 * links otherwise just open in a new tab instead of downloading.
 */
export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("url");
  const name = req.nextUrl.searchParams.get("name") || "download";
  if (!src) return NextResponse.json({ error: "url is required" }, { status: 400 });

  let target: URL;
  try {
    // Local uploads are stored as origin-relative paths (e.g. "/uploads/…").
    target = new URL(src, req.nextUrl.origin);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (!isAllowedTarget(target, req.nextUrl.origin)) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const upstream = await fetch(target.toString());
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
  }

  const safeName = name.replace(/[\r\n"]/g, "").trim() || "download";
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
    },
  });
}
