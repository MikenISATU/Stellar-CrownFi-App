import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Serves uploaded images from Postgres (see /api/upload). Ids are random and content never
// changes after upload, so responses are immutable — browsers and the Vercel edge cache them.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{16,32}$/i.test(id) && !/^c[a-z0-9]{20,30}$/i.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    const img = await db.storedImage.findUnique({ where: { id } });
    if (!img) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return new NextResponse(new Uint8Array(img.bytes), {
      headers: {
        "content-type": img.mime,
        "cache-control": "public, max-age=31536000, immutable",
        "content-security-policy": "default-src 'none'; sandbox",
        "cross-origin-resource-policy": "same-origin",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[api/images] failed:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
