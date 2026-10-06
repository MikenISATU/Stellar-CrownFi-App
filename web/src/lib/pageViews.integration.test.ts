import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { getPageViewCount, recordPageView, PAGE_VIEW_COUNTER_ID } from "./pageViews";

async function main() {
  // Opt-in and hard-bound to the disposable local database, never production.
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  assert.equal(process.env.CROWNFI_LOCAL_DB_TEST, "1");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/crownfi_ui_check");
  assert.equal(url.username, "crownfi_check");
  assert.equal(await db.platformSettings.count(), 0, "Run only on a fresh test database");
  const original = await db.platformSettings.create({ data: { id: "singleton", paymentsEnabled: true, activeProvider: "testnet_usdc", providerConfig: '{"untouched":true}' } });
  assert.equal(await getPageViewCount(), 0);
  const first = randomUUID();
  await recordPageView(first);
  await recordPageView(first);
  assert.equal(await getPageViewCount(), 1, "Repeated event must not increment twice");
  const ids = Array.from({ length: 150 }, () => randomUUID());
  await Promise.all(ids.map((id) => recordPageView(id)));
  assert.equal(await getPageViewCount(), 151, "Concurrent requests must not lose increments");
  const last = randomUUID();
  await Promise.all(Array.from({ length: 20 }, () => recordPageView(last)));
  assert.equal(await getPageViewCount(), 152, "Concurrent duplicate delivery must count once");
  const counter = await db.platformSettings.findUniqueOrThrow({ where: { id: PAGE_VIEW_COUNTER_ID } });
  const data = JSON.parse(counter.providerConfig!);
  assert.equal(data.recent.length, 128);
  assert.equal(data.recent.at(-1), last);
  assert.equal(new Set(data.recent).size, 128);
  const after = await db.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  assert.deepEqual(after, original, "Analytics must never modify payment settings");
  console.log("Local PostgreSQL: atomic counts, duplicate suppression, bounded storage and payment isolation passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
