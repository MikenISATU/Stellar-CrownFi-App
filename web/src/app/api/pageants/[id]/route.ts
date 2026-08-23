import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFanSession } from "@/lib/fanAuth";
import { readAdminSession } from "@/lib/adminAuth";
import { PAGEANT_STATUS, canOrganizerSubmit, isEditableByOrganizer } from "@/lib/pageant";

async function load(id: string) {
  return db.pageant.findUnique({
    where: { id },
    include: {
      categories: { include: { category: true } },
      candidates: { orderBy: { number: "asc" }, include: { images: true } },
    },
  });
}

// GET — public if approved+published, otherwise owner or admin only.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const pageant = await load(id);
    if (!pageant) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const isPublic = pageant.status === PAGEANT_STATUS.APPROVED && pageant.published;
    if (!isPublic) {
      const fan = readFanSession(req);
      const admin = readAdminSession(req);
      const isOwner = fan && pageant.ownerFanId === fan.fanId;
      if (!admin && !isOwner) return NextResponse.json({ error: "not_authorized" }, { status: 403 });
    }
    return NextResponse.json(pageant);
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

const EDITABLE_FIELDS = ["title", "orgName", "contactName", "email", "website", "facebook", "instagram", "socials", "verification", "driveUrl", "description", "venue", "bannerUrl"] as const;

// PATCH — organizer edits (while editable) or submits for review.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const fan = readFanSession(req);
  if (!fan) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });

  const pageant = await db.pageant.findUnique({ where: { id } });
  if (!pageant) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (pageant.ownerFanId !== fan.fanId) return NextResponse.json({ error: "not_authorized" }, { status: 403 });

  const b = await req.json().catch(() => null);

  // Submit for review.
  if (b?.action === "submit") {
    if (!canOrganizerSubmit(pageant.status)) return NextResponse.json({ error: "not_submittable" }, { status: 409 });
    const count = await db.candidate.count({ where: { pageantId: id } });
    if (count < 1) return NextResponse.json({ error: "no_candidates" }, { status: 400 });
    const updated = await db.pageant.update({ where: { id }, data: { status: PAGEANT_STATUS.SUBMITTED, reviewNote: null } });
    return NextResponse.json(updated);
  }

  // Field edits (only while editable).
  if (!isEditableByOrganizer(pageant.status)) return NextResponse.json({ error: "not_editable" }, { status: 409 });
  const data: Record<string, any> = {};
  for (const f of EDITABLE_FIELDS) if (f in (b ?? {})) data[f] = b[f] == null ? null : String(b[f]).slice(0, 2000);
  if ("eventDate" in (b ?? {})) data.eventDate = b.eventDate ? new Date(b.eventDate) : null;
  const updated = await db.pageant.update({ where: { id }, data });
  return NextResponse.json(updated);
}

// DELETE — organizer removes a draft.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const fan = readFanSession(req);
  if (!fan) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });
  const pageant = await db.pageant.findUnique({ where: { id } });
  if (!pageant) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (pageant.ownerFanId !== fan.fanId) return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  if (pageant.status !== PAGEANT_STATUS.DRAFT) return NextResponse.json({ error: "only_draft_deletable" }, { status: 409 });
  await db.pageant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
