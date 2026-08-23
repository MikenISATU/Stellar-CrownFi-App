import { NextResponse } from "next/server";
import { clearFanCookie } from "@/lib/fanAuth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearFanCookie(res);
  return res;
}
