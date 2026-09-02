import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { createFanChallenge, verifyFanSignature } from "./fanAuth";
import { createAdminChallenge, verifyAdminSignature } from "./adminAuth";
import { middleware } from "../middleware";
import { POST as paymongoWebhook } from "../app/api/payments/paymongo/webhook/route";

const SEP53_PREFIX = "Stellar Signed Message:\n";
const expectedOrigin = "https://stellar-crown-fi-ap-jr77.vercel.app";

function request(headers: Record<string, string> = {}) {
  return new NextRequest(`${expectedOrigin}/api/test`, {
    method: "POST",
    headers: {
      "x-forwarded-host": "stellar-crown-fi-ap-jr77.vercel.app",
      "x-forwarded-proto": "https",
      ...headers,
    },
  });
}

function signMessage(keypair: Keypair, message: string): string {
  const hash = createHash("sha256").update(SEP53_PREFIX).update(Buffer.from(message, "utf8")).digest();
  return keypair.sign(hash).toString("base64");
}

async function walletChallengeTests() {
  const fan = Keypair.random();
  const fanChallenge = createFanChallenge(fan.publicKey(), request({ origin: "https://attacker.example" }));
  assert.match(fanChallenge.message, new RegExp(`Origin: ${expectedOrigin}`));
  assert.doesNotMatch(fanChallenge.message, /attacker\.example/);

  const fanVerified = await verifyFanSignature({
    address: fan.publicKey(),
    message: fanChallenge.message,
    signature: signMessage(fan, fanChallenge.message),
  });
  assert.deepEqual(fanVerified, { ok: true });

  const tamperChallenge = createFanChallenge(fan.publicKey(), request());
  const tamperedMessage = tamperChallenge.message.replace("CrownFi sign-in", "Approve unlimited access");
  const tampered = await verifyFanSignature({
    address: fan.publicKey(),
    message: tamperedMessage,
    signature: signMessage(fan, tamperedMessage),
  });
  assert.equal(tampered.ok, false);
  if (!tampered.ok) assert.equal(tampered.error, "challenge_message_mismatch");

  const admin = Keypair.random();
  process.env.ADMIN_WALLETS = admin.publicKey();
  const adminChallenge = createAdminChallenge(admin.publicKey(), request());
  const adminVerified = await verifyAdminSignature({
    address: admin.publicKey(),
    message: adminChallenge.message,
    signature: signMessage(admin, adminChallenge.message),
  });
  assert.deepEqual(adminVerified, { ok: true });
}

async function requestProtectionTests() {
  const crossSite = middleware(request({ origin: "https://attacker.example", "sec-fetch-site": "cross-site" }));
  assert.equal(crossSite.status, 403);

  const mismatched = middleware(request({ origin: "https://attacker.example", "sec-fetch-site": "same-site" }));
  assert.equal(mismatched.status, 403);

  const sameOrigin = middleware(request({ origin: expectedOrigin, "sec-fetch-site": "same-origin" }));
  assert.equal(sameOrigin.headers.get("x-middleware-next"), "1");

  const serverToServer = middleware(request());
  assert.equal(serverToServer.headers.get("x-middleware-next"), "1");
}

async function webhookTests() {
  delete process.env.PAYMONGO_WEBHOOK_SECRET;
  const req = new NextRequest(`${expectedOrigin}/api/payments/paymongo/webhook`, {
    method: "POST",
    body: JSON.stringify({ data: { attributes: { type: "checkout_session.payment.paid" } } }),
  });
  const response = await paymongoWebhook(req);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "webhook_not_configured" });
}

async function main() {
  await walletChallengeTests();
  await requestProtectionTests();
  await webhookTests();
  console.log("security tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
