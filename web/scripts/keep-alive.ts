// Supabase keep-alive. Runs a trivial query so the free-tier project registers activity
// and doesn't auto-pause after ~7 idle days. Run locally with `npm run keep-alive`, or on
// a schedule via .github/workflows/supabase-keepalive.yml.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

(async () => {
  try {
    const rows = await db.$queryRaw`SELECT 1 as ok`;
    console.log(`[keep-alive] ${new Date().toISOString()} — Supabase ping OK`, rows);
  } catch (e) {
    console.error("[keep-alive] ping FAILED:", e);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
})();
