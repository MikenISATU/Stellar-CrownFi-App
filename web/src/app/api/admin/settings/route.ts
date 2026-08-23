import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { getSettings, updateSettings } from "@/lib/settings";
import { PROVIDERS } from "@/lib/payments";

// GET — admin: current settings + provider catalog + recent payment/KYC logs.
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const [settings, paymentLogs, kycLogs] = await Promise.all([
    getSettings(),
    db.paymentLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 }).catch(() => []),
    db.kycLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 }).catch(() => []),
  ]);
  return NextResponse.json({ settings, providers: PROVIDERS, paymentLogs, kycLogs });
}

// PUT — admin: update settings.
export async function PUT(req: NextRequest) {
  const admin = requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  try {
    const settings = await updateSettings(body);
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    console.error("[api/admin/settings] update failed:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
