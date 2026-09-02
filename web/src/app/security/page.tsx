import Link from "next/link";
import { ShieldCheck, Wallet, FileCheck2, ExternalLink } from "lucide-react";

const REPORT_URL = "mailto:napilanmileskenneth@gmail.com?subject=CrownFi%20security%20report";

export const metadata = {
  title: "Security & wallet safety — CrownFi",
  description: "How CrownFi uses Stellar wallets, what it will ask users to sign, and how to report a security concern.",
};

const cards = [
  {
    Icon: Wallet,
    title: "No secret collection",
    body: "CrownFi never asks for, receives, or stores a Secret Recovery Phrase, seed phrase, or private key. Freighter and Privy keep key material inside the wallet provider.",
  },
  {
    Icon: FileCheck2,
    title: "Readable approvals",
    body: "Wallet sign-in uses a short CrownFi challenge containing the wallet address, this site's origin, a unique nonce, and an expiry. Transactions are presented by the wallet before approval.",
  },
  {
    Icon: ShieldCheck,
    title: "Stellar Testnet only",
    body: "This deployment is a demonstration on Stellar Testnet. Test XLM and test USDC have no real-world value, and the app must not be used as production voting or financial infrastructure.",
  },
];

export default function SecurityPage() {
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <div className="eyebrow mb-2">Trust center</div>
        <h1 className="tracking-tight text-4xl font-semibold text-[#23252f] sm:text-5xl">Security & wallet safety</h1>
        <p className="mt-4 text-base leading-relaxed text-[#5f6172]">
          CrownFi is a Stellar Testnet demo. This page documents the wallet prompts you should expect and the checks built into the application.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Wallet safety promises">
        {cards.map(({ Icon, title, body }) => (
          <article key={title} className="card-gold p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#faf0d2] text-[#8a6d1f]"><Icon size={20} /></span>
            <h2 className="mt-4 font-display text-xl font-semibold text-[#23252f]">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5f6172]">{body}</p>
          </article>
        ))}
      </section>

      <section className="glass max-w-4xl p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-[#23252f]">Before approving a wallet prompt</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-[#5f6172]">
          <li>Confirm the browser address is an official CrownFi deployment.</li>
          <li>For sign-in, confirm the message begins with <b>CrownFi sign-in</b> and shows the same origin as the browser.</li>
          <li>For a transaction, confirm Freighter shows <b>Stellar Testnet</b> and review the asset, amount, and destination.</li>
          <li>Reject any prompt asking you to reveal a recovery phrase, private key, or password.</li>
        </ol>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="surface-soft rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold text-[#23252f]">Review the remediation</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5f6172]">The public review record documents the blocklist timeline, wallet behavior, dependency audit, security controls, and repeatable checks.</p>
          <Link href="/security/remediation" className="mt-4 inline-flex items-center gap-2 font-semibold text-[#a97f16] hover:underline">
            Read the review record
          </Link>
        </article>
        <article className="surface-soft rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold text-[#23252f]">Report a vulnerability</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5f6172]">Email the project owner with a concise reproduction. Never include private keys, recovery phrases, tokens, personal data, or live credentials.</p>
          <a href={REPORT_URL} className="mt-4 inline-flex items-center gap-2 font-semibold text-[#a97f16] hover:underline">
            Email a security report <ExternalLink size={15} />
          </a>
        </article>
      </section>

      <p className="text-xs text-[#7a7768]">Security information last reviewed September 3, 2026. <Link href="/faq#legal" className="underline">Terms and privacy notice</Link>.</p>
    </div>
  );
}
