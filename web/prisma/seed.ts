import { PrismaClient } from "@prisma/client";
import { ROSTER } from "../src/lib/roster";
const db = new PrismaClient();

async function main() {
  // Delete in FK-safe order (children first) so reseeding never trips a constraint.
  await db.taskCompletion.deleteMany();
  await db.loyaltyTransaction.deleteMany();
  await db.redemption.deleteMany();
  await db.purchase.deleteMany();
  await db.vote.deleteMany();
  await db.checkpoint.deleteMany();
  await db.ticket.deleteMany();
  await db.collectible.deleteMany();
  await db.contestant.deleteMany();
  await db.votingRound.deleteMany();

  // Seed the full delegate roster with the real candidate photos (see /public/candidates).
  const contestants = await Promise.all(
    ROSTER.map((r) => db.contestant.create({ data: { name: r.name, country: r.country, sash: r.sash, portraitUrl: r.photo } })),
  );

  await db.votingRound.create({ data: { title: "People's Choice — Preliminary" } });

  for (let i = 0; i < contestants.length; i++) {
    const c = contestants[i];
    const r = ROSTER[i];
    await db.collectible.create({
      data: { contestantId: c.id, title: `${c.name} — Official Portrait`, metadataUri: `ipfs://demo/${r.id}.json`, priceUsdc: r.priceUsdc, edition: 1 },
    });
  }

  // Loyalty: social tasks (earn) + shop rewards (spend).
  await db.taskCompletion.deleteMany();
  await db.socialTask.deleteMany();
  await db.redemption.deleteMany();
  await db.reward.deleteMany();

  await db.socialTask.createMany({
    data: [
      { key: "follow_x", title: "Follow CrownFi on X", description: "Follow @CrownFi for the latest pageant drops.", points: 25, actionUrl: "https://x.com/", icon: "x", order: 1 },
      { key: "join_discord", title: "Join the Discord", description: "Join the community server and say hello.", points: 25, actionUrl: "https://discord.com/", icon: "discord", order: 2 },
      { key: "follow_linkedin", title: "Follow on LinkedIn", description: "Follow CrownFi for partnership news.", points: 15, actionUrl: "https://www.linkedin.com/", icon: "linkedin", order: 3 },
      { key: "share_vote", title: "Share your vote", description: "Share the CrownFi vote link with a friend.", points: 20, actionUrl: null, icon: "share", order: 4 },
      { key: "connect_wallet", title: "Connect your wallet", description: "Sign in with Freighter to secure your identity.", points: 10, actionUrl: null, icon: "wallet", order: 5 },
    ],
  });

  await db.reward.createMany({
    data: [
      { key: "vip_badge", title: "VIP Fan Badge", description: "A digital badge shown on your profile.", cost: 50, stock: null, icon: "crown", order: 1 },
      { key: "ticket_10", title: "10% Ticket Discount", description: "One-time 10% off any ticket tier.", cost: 120, stock: 200, icon: "ticket", order: 2 },
      { key: "backstage_raffle", title: "Backstage Raffle Entry", description: "One entry into the backstage meet & greet raffle.", cost: 200, stock: 100, icon: "star", order: 3 },
      { key: "signed_portrait", title: "Signed Portrait Drop", description: "Eligibility for a limited signed collectible drop.", cost: 500, stock: 25, icon: "image", order: 4 },
    ],
  });

  // Competition categories (extensible — add a row, no code change).
  for (const c of [
    { key: "swimsuit", name: "Swimsuit Competition", order: 1 },
    { key: "long_gown", name: "Long Gown Competition", order: 2 },
  ]) {
    await db.category.upsert({ where: { key: c.key }, update: { name: c.name, order: c.order }, create: c });
  }

  console.log("Seeded contestants, a round, collectibles, loyalty tasks, rewards, and categories. No demo fan accounts.");
}
main().finally(() => db.$disconnect());
