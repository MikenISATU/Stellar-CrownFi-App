import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFanSession, requireFan } from "@/lib/fanAuth";
import { readAdminSession } from "@/lib/adminAuth";
import { slugify, PAGEANT_STATUS } from "@/lib/pageant";

// GET — scoped listing:
//   default        → public: approved + published pageants
//   ?mine=1        → the signed-in organizer's own pageants (any status)
//   ?all=1         → admin: every pageant
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  try {
    if (url.searchParams.get("all")) {
      if (!readAdminSession(req)) return NextResponse.json({ error: "admin_auth_required" }, { status: 401 });
      const rows = await db.pageant.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { candidates: true } }, categories: { include: { category: true } } },
      });
      return NextResponse.json(rows);
    }
    if (url.searchParams.get("mine")) {
      const fan = readFanSession(req);
      if (!fan) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });
      const rows = await db.pageant.findMany({
        where: { ownerFanId: fan.fanId },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { candidates: true } } },
      });
      return NextResponse.json(rows);
    }
    const rows = await db.pageant.findMany({
      where: { status: PAGEANT_STATUS.APPROVED, published: true },
      orderBy: { eventDate: "asc" },
      include: { _count: { select: { candidates: true } }, categories: { include: { category: true } } },
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await db.pageant.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

// POST — organizer creates a draft pageant.
export async function POST(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const b = await req.json().catch(() => null);
  const title = String(b?.title ?? "").trim().slice(0, 160);
  const orgName = String(b?.orgName ?? "").trim().slice(0, 160);
  const contactName = String(b?.contactName ?? "").trim().slice(0, 160);
  const email = String(b?.email ?? "").trim().slice(0, 200);
  if (!title || !orgName || !contactName || !email) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    const pageant = await db.pageant.create({
      data: {
        slug: await uniqueSlug(title),
        ownerFanId: auth.fanId,
        title,
        orgName,
        contactName,
        email,
        website: b?.website ? String(b.website).slice(0, 300) : null,
        facebook: b?.facebook ? String(b.facebook).slice(0, 300) : null,
        instagram: b?.instagram ? String(b.instagram).slice(0, 300) : null,
        socials: b?.socials ? String(b.socials).slice(0, 500) : null,
        verification: b?.verification ? String(b.verification).slice(0, 500) : null,
        driveUrl: b?.driveUrl ? String(b.driveUrl).slice(0, 500) : null,
        description: b?.description ? String(b.description).slice(0, 2000) : null,
        venue: b?.venue ? String(b.venue).slice(0, 300) : null,
        eventDate: b?.eventDate ? new Date(b.eventDate) : null,
        status: PAGEANT_STATUS.DRAFT,
      },
    });
    return NextResponse.json(pageant);
  } catch (e) {
    console.error("[api/pageants] create failed:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
