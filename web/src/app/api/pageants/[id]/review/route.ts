import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { PAGEANT_STATUS, isAdminActionable } from "@/lib/pageant";
import { sendEmail, pageantDecisionEmail } from "@/lib/email";

// POST — admin decision on a pageant submission.
// body: { decision: "in_review" | "approved" | "rejected" | "requires_changes", note?: string }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id } = await ctx.params;
  const b = await req.json().catch(() => null);
  const decision = String(b?.decision ?? "");
  const note = b?.note ? String(b.note).slice(0, 1000) : null;

  const pageant = await db.pageant.findUnique({ where: { id } });
  if (!pageant) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!isAdminActionable(pageant.status)) return NextResponse.json({ error: "not_actionable" }, { status: 409 });

  let data: Record<string, any>;
  switch (decision) {
    case "in_review":
      data = { status: PAGEANT_STATUS.IN_REVIEW };
      break;
    case "requires_changes":
      if (!note) return NextResponse.json({ error: "note_required" }, { status: 400 });
      data = { status: PAGEANT_STATUS.REQUIRES_CHANGES, reviewNote: note };
      break;
    case "rejected":
      data = { status: PAGEANT_STATUS.REJECTED, reviewNote: note };
      break;
    case "approved":
      // Publish now. Phase 2: deploy the NFT contract on approval and set nftContractId,
      // then send the organizer an email notification.
      data = { status: PAGEANT_STATUS.APPROVED, published: true, reviewNote: null };
      break;
    default:
      return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }

  const updated = await db.pageant.update({ where: { id }, data });

  // Notify the organizer on a final decision (best-effort — never blocks the response).
  if (["approved", "requires_changes", "rejected"].includes(decision) && pageant.email) {
    const mail = pageantDecisionEmail(decision, pageant.title, note);
    sendEmail({ to: pageant.email, ...mail }).catch(() => {});
  }
  return NextResponse.json(updated);
}
