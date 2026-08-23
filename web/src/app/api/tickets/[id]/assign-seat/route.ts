import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mockTicketsStore } from "@/lib/mockStore";
import { requireAdmin } from "@/lib/adminAuth";
import { readFanSession } from "@/lib/fanAuth";
import { normalizeSeatLabel } from "@/lib/tickets/seat";

const SEAT_RE = /^(Diamond|Platinum|Gold|Silver)?\s*([A-Z]+-\d{1,3}|Row\s+\d{1,3}\s+Seat\s+\d{1,3}|Unassigned)$/i;

// Authorized if an admin session, OR the verified fan session owns this ticket.
// Ownership is read from the session — never from a body fanId (which GET /api/tickets leaks).
function isAuthorizedOwnerOrAdmin(req: NextRequest, ticketFanId: string): boolean {
  const admin = requireAdmin(req);
  if (!(admin instanceof NextResponse)) return true;
  const fan = readFanSession(req);
  return Boolean(fan && fan.fanId === ticketFanId);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  // Normalize the middot/bullet separator the SeatMap renders ("Row 1 · Seat 4")
  // to the canonical space form ("Row 1 Seat 4") the validator + storage expect.
  const seat = normalizeSeatLabel(String(body?.seat ?? "").trim());

  if (!seat) return NextResponse.json({ error: "missing_seat" }, { status: 400 });
  if (!SEAT_RE.test(seat)) return NextResponse.json({ error: "invalid_seat" }, { status: 400 });

  try {
    const existing = await db.ticket.findUnique({ where: { id }, include: { fan: true } });
    if (!existing) return NextResponse.json({ error: "ticket_not_found" }, { status: 404 });
    if (!isAuthorizedOwnerOrAdmin(req, existing.fanId)) {
      return NextResponse.json({ error: "not_ticket_owner_or_admin" }, { status: 403 });
    }

    // Prevent two tickets from holding the same seat at the same event.
    if (seat !== "Unassigned") {
      const clash = await db.ticket.findFirst({
        where: { eventName: existing.eventName, seat, NOT: { id } },
        select: { id: true },
      });
      if (clash) return NextResponse.json({ error: "seat_taken" }, { status: 409 });
    }

    const ticket = await db.ticket.update({ where: { id }, data: { seat }, include: { fan: true } });

    const storedIdx = mockTicketsStore.findIndex((t: any) => t.id === id);
    if (storedIdx !== -1) mockTicketsStore[storedIdx] = { ...mockTicketsStore[storedIdx], seat };

    return NextResponse.json({ ok: true, ticket });
  } catch {
    const storedIdx = mockTicketsStore.findIndex((t: any) => t.id === id);
    if (storedIdx === -1) return NextResponse.json({ error: "ticket_not_found" }, { status: 404 });

    const stored = mockTicketsStore[storedIdx] as any;
    if (!isAuthorizedOwnerOrAdmin(req, stored.fanId)) {
      return NextResponse.json({ error: "not_ticket_owner_or_admin" }, { status: 403 });
    }

    // Same-seat guard for the in-memory mock store.
    if (seat !== "Unassigned") {
      const clash = mockTicketsStore.some(
        (t: any) => t.id !== id && t.eventName === stored.eventName && t.seat === seat,
      );
      if (clash) return NextResponse.json({ error: "seat_taken" }, { status: 409 });
    }

    mockTicketsStore[storedIdx] = { ...stored, seat };
    return NextResponse.json({ ok: true, ticket: mockTicketsStore[storedIdx] });
  }
}
