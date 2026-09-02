import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { readFanSession } from "@/lib/fanAuth";
import { isEditableByOrganizer } from "@/lib/pageant";
import { CANDIDATE_ASSET_KINDS } from "@/lib/assets";
import { rateLimit } from "@/lib/ratelimit";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_DIM = 1600;

// POST (multipart) — upload a candidate image of a given kind. Stored in Postgres and served
// from /api/images/[id] (disk writes don't survive on serverless — same fix as /api/upload).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await ctx.params;

  const fan = readFanSession(req);
  if (!fan) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });
  const limiter = rateLimit(`candidate-upload:${fan.fanId}`, 30, 60 * 60 * 1000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const pageant = await db.pageant.findUnique({ where: { id } });
  if (!pageant) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (pageant.ownerFanId !== fan.fanId) return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  if (!isEditableByOrganizer(pageant.status)) return NextResponse.json({ error: "not_editable" }, { status: 409 });

  const candidate = await db.candidate.findUnique({ where: { id: cid } });
  if (!candidate || candidate.pageantId !== id) return NextResponse.json({ error: "candidate_not_found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  const kind = String(form?.get("kind") ?? "");
  if (!file) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (!CANDIDATE_ASSET_KINDS.includes(kind as any)) return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

  try {
    const raw = Buffer.from(await file.arrayBuffer());
    // Decode and re-encode every accepted file so mislabeled/polyglot content is rejected.
    const mime = "image/webp";
    const out = await sharp(raw)
      .rotate()
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const img = await db.storedImage.create({
      data: { id: randomBytes(12).toString("hex"), mime, bytes: out },
      select: { id: true },
    });
    const url = `/api/images/${img.id}`;

    // Record the image + set the convenience fields the UI reads directly.
    await db.candidateImage.upsert({
      where: { candidateId_categoryKey: { candidateId: cid, categoryKey: kind } },
      update: { url },
      create: { candidateId: cid, categoryKey: kind, url },
    });
    if (kind === "profile") await db.candidate.update({ where: { id: cid }, data: { profileUrl: url } });
    if (kind === "nft_artwork") await db.candidate.update({ where: { id: cid }, data: { nftArtworkUrl: url } });

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("[upload] failed:", e);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
