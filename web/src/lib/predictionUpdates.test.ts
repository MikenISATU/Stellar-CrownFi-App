import assert from "node:assert/strict";
import { validRanking, validPublicPath, readDeviceRankings } from "./predictionUpdates";
import { NextRequest } from "next/server";
import { db } from "./db";
import { POST as recordView } from "../app/api/page-views/route";
import { GET as stats } from "../app/api/stats/route";
import { invalidate } from "./serverCache";
import { getPageViewCount, PAGE_VIEW_COUNTER_ID, pageViewIncrementQuery } from "./pageViews";

async function main() {
  assert(validRanking(3, [2, 0, 1], 4));
  for (const invalid of [[0, 0, 1], [-1, 1, 2], [0, 1, 9], [0, 1], [0, 1, 1.5]]) assert(!validRanking(3, invalid, 4));
  assert(!validRanking(4, [0, 1, 2, 3], 4));
  const saved = { size: 3, options: [2, 0, 1], labels: ["C", "A", "B"] };
  assert.deepEqual(readDeviceRankings(JSON.stringify([saved]), ["A", "B", "C"]), [saved]);
  assert.deepEqual(readDeviceRankings(JSON.stringify([saved]), ["Changed", "B", "C"]), []);
  assert.deepEqual(readDeviceRankings(null, []), []);
  assert.deepEqual(readDeviceRankings('[null,{},5]', []), []);
  assert.throws(() => readDeviceRankings("invalid JSON", []));
  assert(validPublicPath("/predictions/test-market"));
  for (const path of ["/me", "/organizer", "/admin", "/api/markets", "/?email=private", "https://external.example/"]) assert(!validPublicPath(path));

  // In-memory fixtures only; this suite never writes to a real database.
  let query: any;
  (db as any).$executeRaw = async (value: unknown) => { query = value; return 1; };
  const event = { id: "12345678-1234-1234-1234-123456789012", path: "/predictions" };
  const req = (body: unknown, ua = "Browser") => new NextRequest("http://localhost/api/page-views", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": ua }, body: JSON.stringify(body) });
  assert.equal((await recordView(req(event))).status, 204);
  assert(query.values.includes(event.id));
  assert(query.values.includes(PAGE_VIEW_COUNTER_ID));
  assert(!query.text.includes(event.id), "Events must be parameterized, not interpolated SQL");
  assert.equal((await recordView(req({ ...event, path: "/admin" }))).status, 400);
  query = null;
  assert.equal((await recordView(req(event, "test-bot"))).status, 204);
  assert.equal(query, null);
  assert(pageViewIncrementQuery(event.id).text.includes('ON CONFLICT ("id") DO UPDATE'));
  (db as any).$executeRaw = async () => { throw new Error("storage unavailable"); };
  assert.equal((await recordView(req(event))).status, 503);

  (db.platformSettings as any).findUnique = async () => null;
  assert.equal(await getPageViewCount(), 0);
  (db.platformSettings as any).findUnique = async () => ({ providerConfig: '{"count":42}' });
  assert.equal(await getPageViewCount(), 42);
  (db.platformSettings as any).findUnique = async () => { throw new Error("telemetry unavailable"); };
  (db.vote as any).count = async () => 21;
  (db.ticket as any).count = async () => 3;
  (db.ticket as any).findMany = async () => [{ priceUsdc: 10 }];
  (db.purchase as any).findMany = async () => [{ priceUsdc: 50 }, { priceUsdc: 50 }];
  (db.contestant as any).findMany = async () => [];
  (db.votingRound as any).count = async () => 4;
  (db.fan as any).count = async () => 12;
  (db.prediction as any).count = async () => 9;
  (db.vote as any).groupBy = async () => [];
  invalidate("stats");
  const result = await stats();
  assert.equal(result.status, 200, "Telemetry failure must not break platform totals");
  const counts = await result.json();
  assert.equal(counts.pageViews, null);
  assert.equal(counts.fans, 12);
  assert.equal(counts.votes, 21);
  assert.equal(counts.predictions, 9);
  assert.equal(counts.collectiblesSold, 2);
  console.log("Device rankings, page-view validation and independent platform totals passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
