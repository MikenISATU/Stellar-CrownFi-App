import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFanSession } from "@/lib/fanAuth";
import { isEditableByOrganizer } from "@/lib/pageant";

async function guard(req: NextRequest, pageantId: string, cid: string) {
  const fan = readFanSession(req);
  if (!fan) return { error: NextResponse.json({ error: "fan_auth_required" }, { status: 401 }) };
  const pageant = await db.pageant.findUnique({ where: { id: pageantId } });
  if (!pageant) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (pageant.ownerFanId !== fan.fanId) return { error: NextResponse.json({ error: "not_authorized" }, { status: 403 }) };
  if (!isEditableByOrganizer(pageant.status)) return { error: NextResponse.json({ error: "not_editable" }, { status: 409 }) };
  const candidate = await db.candidate.findUnique({ where: { id: cid } });
  if (!candidate || candidate.pageantId !== pageantId) return { error: NextResponse.json({ error: "candidate_not_found" }, { status: 404 }) };
  return { candidate };
}

const FIELDS = ["fullName", "bio", "location", "profileUrl", "nftArtworkUrl"] as const;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await ctx.params;
  const g = await guard(req, id, cid);
  if ("error" in g) return g.error;

  const b = await req.json().catch(() => null);
  const data: Record<string, any> = {};
  for (const f of FIELDS) if (f in (b ?? {})) data[f] = b[f] == null ? null : String(b[f]).slice(0, 2000);
  if ("number" in (b ?? {})) data.number = b.number != null ? Number(b.number) : null;
  if ("age" in (b ?? {})) data.age = b.age != null ? Number(b.age) : null;
  if ("maxSupply" in (b ?? {})) data.maxSupply = Math.max(1, Math.min(100000, Number(b.maxSupply)));

  const updated = await db.candidate.update({ where: { id: cid }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await ctx.params;
  const g = await guard(req, id, cid);
  if ("error" in g) return g.error;
  await db.candidate.delete({ where: { id: cid } });
  return NextResponse.json({ ok: true });
}
