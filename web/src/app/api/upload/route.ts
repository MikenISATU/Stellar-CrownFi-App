import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { readFanSession } from "@/lib/fanAuth";
import { readAdminSession } from "@/lib/adminAuth";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB (client downscales first; this is a safety net for GIFs/fallbacks)
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_DIM = 1600; // banners never need to be wider than this

// Generic image upload (banners, etc.), any signed-in fan or admin. Images are stored in
// Postgres and served from /api/images/[id] — NOT written to disk, because the filesystem is
// read-only on serverless (Vercel) and public/ is frozen into the CDN at build time.
export async function POST(req: NextRequest) {
  const fan = readFanSession(req);
  const admin = readAdminSession(req);
  if (!fan && !admin) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

  const raw = Buffer.from(await file.arrayBuffer());

  try {
    // Animated GIFs are passed through untouched (re-encoding would flatten them).
    // Everything else is downscaled + re-encoded to WebP so banners stay lightweight.
    let mime: string;
    let out: Buffer;
    if (file.type === "image/gif") {
      mime = "image/gif";
      out = raw;
    } else {
      mime = "image/webp";
      out = await sharp(raw)
        .rotate() // honor EXIF orientation
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    }

    const img = await db.storedImage.create({
      data: { id: randomBytes(12).toString("hex"), mime, bytes: out },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, url: `/api/images/${img.id}` });
  } catch (e) {
    console.error("[api/upload] failed:", e);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
