import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFanSession } from "@/lib/fanAuth";
import { isEditableByOrganizer } from "@/lib/pageant";

// Owner + editable-status guard shared by candidate mutations.
async function guard(req: NextRequest, pageantId: string) {
  const fan = readFanSession(req);
  if (!fan) return { error: NextResponse.json({ error: "fan_auth_required" }, { status: 401 }) };
  const pageant = await db.pageant.findUnique({ where: { id: pageantId } });
  if (!pageant) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (pageant.ownerFanId !== fan.fanId) return { error: NextResponse.json({ error: "not_authorized" }, { status: 403 }) };
  if (!isEditableByOrganizer(pageant.status)) return { error: NextResponse.json({ error: "not_editable" }, { status: 409 }) };
  return { pageant };
}

// POST — add a candidate to a pageant.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guard(req, id);
  if ("error" in g) return g.error;

  const b = await req.json().catch(() => null);
  const fullName = String(b?.fullName ?? "").trim().slice(0, 160);
  if (!fullName) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const candidate = await db.candidate.create({
    data: {
      pageantId: id,
      fullName,
      number: b?.number != null ? Number(b.number) : null,
      bio: b?.bio ? String(b.bio).slice(0, 2000) : null,
      age: b?.age != null ? Number(b.age) : null,
      location: b?.location ? String(b.location).slice(0, 200) : null,
      profileUrl: b?.profileUrl ? String(b.profileUrl).slice(0, 400) : null,
      nftArtworkUrl: b?.nftArtworkUrl ? String(b.nftArtworkUrl).slice(0, 400) : null,
      maxSupply: b?.maxSupply != null ? Math.max(1, Math.min(100000, Number(b.maxSupply))) : 100,
    },
  });
  return NextResponse.json(candidate);
}
