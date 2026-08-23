import { setListing } from "../src/lib/stellar";
import { TICKET_TIERS } from "../src/lib/tiers";

// Register the four ticket-tier listings (101–104) on the sale-splitter so live ticket buys work.
const PAYOUT = process.env.DEMO_CONTESTANT_PAYOUT!;
async function main() {
  if ((process.env.STELLAR_MODE ?? "mock") !== "live") throw new Error("STELLAR_MODE must be live");
  for (const [name, t] of Object.entries(TICKET_TIERS)) {
    console.log(`tier ${name} -> listing #${t.listingId} @ ${t.priceUsdc} USDC ...`);
    const { txHash } = await setListing({ listingId: t.listingId, priceUsdc: t.priceUsdc, contestantAddress: PAYOUT });
    console.log(`   ok (tx ${txHash.slice(0, 12)}...)`);
  }
  console.log("All tier listings registered.");
}
main();
