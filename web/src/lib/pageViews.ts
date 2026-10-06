import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// A separate namespaced metadata row in an EXISTING table, not the payment-settings
// singleton. No schema migration, wallet address, IP, or browsing history is stored.
export const PAGE_VIEW_COUNTER_ID = "analytics:page-views:v1";

export function pageViewIncrementQuery(eventId: string) {
  const first = JSON.stringify({ count: 1, recent: [eventId] });
  // Atomic across concurrent requests/server instances. Retain only 128 recent
  // event IDs to suppress normal transport retries without unbounded row growth.
  return Prisma.sql`
    INSERT INTO "PlatformSettings" AS counter
      ("id", "paymentsEnabled", "kycEnabled", "kycMandatory", "environment",
       "activeProvider", "maintenanceMode", "winnersAnnounced", "providerConfig", "updatedAt")
    VALUES (${PAGE_VIEW_COUNTER_ID}, false, false, false, 'testnet', 'testnet_usdc', false, false, ${first}, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO UPDATE SET
      "providerConfig" = jsonb_build_object(
        'count', (counter."providerConfig"::jsonb->>'count')::bigint + 1,
        'recent', (SELECT jsonb_agg(recent.value ORDER BY recent.ordinality)
          FROM (SELECT value, ordinality
            FROM jsonb_array_elements((counter."providerConfig"::jsonb->'recent') || jsonb_build_array(${eventId}::text)) WITH ORDINALITY
            ORDER BY ordinality DESC LIMIT 128) AS recent)
      )::text,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE NOT ((counter."providerConfig"::jsonb->'recent') ? ${eventId}::text)
  `;
}

export async function recordPageView(eventId: string): Promise<void> {
  await db.$executeRaw(pageViewIncrementQuery(eventId));
}

export async function getPageViewCount(): Promise<number> {
  const row = await db.platformSettings.findUnique({ where: { id: PAGE_VIEW_COUNTER_ID }, select: { providerConfig: true } });
  if (!row) return 0;
  const count = JSON.parse(row.providerConfig ?? "{}").count;
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("invalid_page_view_counter");
  return count;
}
