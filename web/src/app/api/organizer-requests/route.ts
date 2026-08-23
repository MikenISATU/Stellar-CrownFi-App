import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/adminAuth";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/ip";

const MAX = { orgName: 120, contactName: 120, email: 160, pageantName: 120, country: 80, message: 1000 };
function capped(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  return readJson(() => db.organizerRequest.findMany({ orderBy: { createdAt: "desc" } }));
}

// Public: an organizer submits an application to run a pageant. Rate-limited + length-capped
// to prevent spam/abuse. Stored fields are escaped by React on render (admin panel).
export async function POST(req: NextRequest) {
  const rl = rateLimit(`organizer:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const b = await req.json().catch(() => null);
  const need = ["orgName", "contactName", "email", "pageantName", "country"];
  for (const k of need) if (!String(b?.[k] ?? "").trim()) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  const created = await db.organizerRequest.create({
    data: {
      orgName: capped(b.orgName, MAX.orgName),
      contactName: capped(b.contactName, MAX.contactName),
      email: capped(b.email, MAX.email),
      pageantName: capped(b.pageantName, MAX.pageantName),
      country: capped(b.country, MAX.country),
      message: b.message ? capped(b.message, MAX.message) : null,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}

// Admin: approve or reject a request.
export async function PATCH(req: NextRequest) {
  const admin = requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const b = await req.json().catch(() => null);
  if (!b?.id || !["approved", "rejected"].includes(b?.status))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const updated = await db.organizerRequest.update({ where: { id: String(b.id) }, data: { status: b.status } });
  return NextResponse.json(updated);
}
