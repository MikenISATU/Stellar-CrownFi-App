import assert from "node:assert/strict";
import { validRanking, parseMarketTags, validPublicPath, validAmendment } from "./predictionUpdates";
import { NextRequest } from "next/server";
import { POST as checkout } from "../app/api/payments/gcash/checkout/route";
import { gcashConfigured, createGcashCheckout } from "./payments/gcash";
import { db } from "./db";
import { createFanSession } from "./fanAuth";
import { GET as getRanking, PUT as saveRanking } from "../app/api/markets/[id]/ranking/route";
import { POST as amend } from "../app/api/markets/[id]/amend/route";
import { POST as recordView } from "../app/api/page-views/route";
import { supportsMarketAmendment, predictionMarketContractId } from "./stellar";

async function main() {
  assert(validRanking(3, [2, 0, 1], 4));
  for (const invalid of [[0, 0, 1], [-1, 1, 2], [0, 1, 9], [0, 1], [0, 1, 1.5]]) assert(!validRanking(3, invalid, 4));
  assert(!validRanking(4, [0, 1, 2, 3], 4));
  assert.deepEqual(parseMarketTags(["Female", "female", "#Local", "LGBTQIA+"]), ["Female", "Local", "LGBTQIA+"]);
  assert.equal(parseMarketTags(["<script>"]), null);
  assert.equal(parseMarketTags(Array(9).fill("Local")), null);
  assert(validPublicPath("/predictions/test-market"));
  for (const path of ["/me", "/organizer", "/admin", "/api/markets", "/?email=private", "https://external.example/"]) assert(!validPublicPath(path));
  const old = { options: ["A", "B"], flags: ["PH", null], closeTime: new Date(Date.now() + 3600_000) };
  assert(validAmendment(old, { ...old, options: ["A", "B", "C"], flags: ["PH", null, "IN"] }));
  assert(!validAmendment(old, { ...old, options: ["B", "A"] }));
  assert(!validAmendment(old, { ...old, flags: ["US", null] }));
  assert(!validAmendment(old, { ...old, closeTime: new Date(old.closeTime.getTime() - 1000) }));

  const previousV3 = process.env.PREDICTION_MARKET_CONTRACT_ID_V3;
  process.env.PREDICTION_MARKET_CONTRACT_ID_V3 = "new-v3-test-reference";
  assert(supportsMarketAmendment("pm2:new-v3-test-reference:tx"));
  assert(!supportsMarketAmendment("pm2:old-v2-test-reference:tx"));
  assert(!supportsMarketAmendment("legacy-tx"));
  const oldContract = "CDOSOKE2MMFRZ6WR4DKASL3YQ56ALOE6S36BPVBVVOYYYIH2CHVBRBGE";
  assert.equal(predictionMarketContractId(`pm2:${oldContract}:tx`), oldContract);
  if (previousV3 === undefined) delete process.env.PREDICTION_MARKET_CONTRACT_ID_V3;
  else process.env.PREDICTION_MARKET_CONTRACT_ID_V3 = previousV3;

  process.env.PAYMONGO_SECRET_KEY = "test-value-never-transmitted";
  assert.equal(gcashConfigured(), false);
  assert.equal((await checkout(new NextRequest("http://localhost/api/payments/gcash/checkout", { method: "POST" }))).status, 503);
  await assert.rejects(createGcashCheckout({ amountUsd: 1, description: "test", referenceNumber: "test", successUrl: "http://localhost", cancelUrl: "http://localhost" }), /gcash_disabled/);

  // In-memory route fixtures: these tests cannot contact a database or submit a chain transaction.
  const market = { id: "m1", creatorFanId: "owner", status: "open", optionsJson: '["A","B","C"]', optionFlagsJson: '[null,null,null]', closeTime: new Date(Date.now() + 3600_000), chainMarketId: null, amendmentJson: null, question: "Winner?", category: "overall" };
  let lookup: any;
  let written: any;
  (db.predictionMarket as any).findUnique = async () => market;
  (db.predictionMarket as any).updateMany = async ({ data }: any) => { Object.assign(market, data); return { count: 1 }; };
  (db.personalRanking as any).findMany = async (args: any) => { lookup = args; return []; };
  (db.personalRanking as any).upsert = async (args: any) => { written = args; return args.create; };
  (db as any).$transaction = async (fn: any) => fn(db);
  const ctx = { params: Promise.resolve({ id: "m1" }) };
  const request = (method: string, body?: unknown, fan = "owner") => new NextRequest("http://localhost/api/markets/m1", {
    method, headers: fan ? { cookie: `crownfi_fan=${createFanSession(fan, "test-address")}`, "Content-Type": "application/json" } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await saveRanking(request("PUT", {}, ""), ctx)).status, 401);
  await getRanking(request("GET", undefined, "other-user"), ctx);
  assert.equal(lookup.where.fanId, "other-user");
  assert.equal((await saveRanking(request("PUT", { size: 3, options: [2, 0, 1], labels: ["C", "A", "B"], fanId: "forged-user" }), ctx)).status, 200);
  assert.equal(written.create.fanId, "owner");
  assert.equal((await saveRanking(request("PUT", { size: 3, options: [2, 0, 1], labels: ["wrong", "A", "B"] }), ctx)).status, 409);
  market.status = "closed";
  assert.equal((await saveRanking(request("PUT", { size: 3, options: [2, 0, 1], labels: ["C", "A", "B"] }), ctx)).status, 409);
  market.status = "open";
  const amendment = { options: ["A", "B", "C", "D"], optionFlags: [null, null, null, null], closeTime: market.closeTime.toISOString() };
  assert.equal((await amend(request("POST", amendment, "not-owner"), ctx)).status, 403);
  assert.equal((await amend(request("POST", { ...amendment, options: ["X", "B", "C", "D"] }), ctx)).status, 400);
  assert.equal((await amend(request("POST", amendment), ctx)).status, 200);
  assert.equal(market.optionsJson, '["A","B","C","D"]');
  assert.equal(market.status, "open");
  assert.equal(market.amendmentJson, null);

  // An interrupted database confirmation retains its journal and can be retried.
  const pending = { options: ["A", "B", "C", "D", "E"], optionFlags: [null, null, null, null, null], closeTime: market.closeTime.toISOString() };
  market.status = "amending";
  Object.assign(market, { amendmentJson: JSON.stringify(pending) });
  assert.equal((await amend(request("POST", { retry: true }), ctx)).status, 200);
  assert.equal(market.status, "open");
  assert.equal(market.optionsJson, JSON.stringify(pending.options));

  Object.assign(market, { chainMarketId: 7, createTxHash: `pm2:${oldContract}:tx` });
  assert.equal((await amend(request("POST", amendment), ctx)).status, 409);
  assert.equal(market.optionsJson, JSON.stringify(pending.options));
  Object.assign(market, { chainMarketId: null });

  let views = 0;
  const ids = new Set<string>();
  (db.pageView as any).createMany = async ({ data }: any) => { if (!ids.has(data[0].id)) views++; ids.add(data[0].id); };
  const event = { id: "12345678-1234-1234-1234-123456789012", path: "/predictions" };
  assert.equal((await recordView(request("POST", event))).status, 204);
  assert.equal((await recordView(request("POST", event))).status, 204);
  assert.equal(views, 1);
  assert.equal((await recordView(request("POST", { ...event, path: "/admin" }))).status, 400);
  console.log("Prediction updates: ranking ownership, validation, amendments, tracking and GCash checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
