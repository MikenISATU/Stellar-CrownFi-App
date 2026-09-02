import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";

const externalLinks = [
  ["MetaMask synchronization PR #287320", "https://github.com/MetaMask/eth-phishing-detect/pull/287320"],
  ["First blocklist commit d5f88c9", "https://github.com/MetaMask/eth-phishing-detect/commit/d5f88c9c09419cdb7d46d52e9efe57c343018e6b"],
  ["Current ChainPatrol lookup", "https://app.chainpatrol.io/search?content=https%3A%2F%2Fstellar-crown-fi-ap-jr77.vercel.app%2F"],
] as const;

export const metadata = {
  title: "Phishing false-positive review — CrownFi",
  description: "Public evidence and remediation record for the CrownFi Stellar Testnet deployment.",
};

const fixes = [
  "Upgraded Next.js, Stellar SDK, Privy, Sharp, PostCSS, and vulnerable transitive packages; complete and production npm audits report zero known vulnerabilities.",
  "Replaced deprecated Privy server authentication with the maintained Privy Node SDK.",
  "Bound fan and admin wallet challenges to exact server-generated content, address, expiry, and canonical deployment origin.",
  "Added same-origin protection for unsafe browser API requests and fail-closed PayMongo webhook verification with timestamp freshness checks.",
  "Decode and re-encode uploaded PNG, JPEG, and WebP files; reject unsupported formats and apply upload rate limits.",
  "Published CSP, HSTS, anti-framing, MIME-sniffing, referrer, permissions, and cross-domain-policy headers.",
  "Removed nonfunctional social links, a simulated newsletter response, raw authentication errors, and user-identifying debug logs.",
] as const;

export default function RemediationPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <div className="eyebrow mb-2">Public review record</div>
        <h1 className="tracking-tight text-4xl font-semibold text-[#23252f] sm:text-5xl">Phishing false-positive remediation</h1>
        <p className="mt-4 text-base leading-relaxed text-[#5f6172]">
          This record documents why the official CrownFi hostname is requesting human blocklist review, what was audited, and what was hardened on September 3, 2026.
        </p>
      </header>

      <section className="card-gold p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#faf0d2] text-[#8a6d1f]"><ShieldCheck size={20} /></span>
          <h2 className="font-display text-2xl font-semibold text-[#23252f]">Verified scope</h2>
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold text-[#23252f]">Official hostname</dt><dd className="mt-1 break-all text-[#5f6172]">stellar-crown-fi-ap-jr77.vercel.app</dd></div>
          <div><dt className="font-semibold text-[#23252f]">Network</dt><dd className="mt-1 text-[#5f6172]">Stellar Testnet; no real-value assets</dd></div>
          <div><dt className="font-semibold text-[#23252f]">Wallet providers</dt><dd className="mt-1 text-[#5f6172]">Freighter and optional Privy authentication</dd></div>
          <div><dt className="font-semibold text-[#23252f]">Secret handling</dt><dd className="mt-1 text-[#5f6172]">No recovery phrase, seed phrase, private key, or wallet password collection</dd></div>
        </dl>
      </section>

      <section className="glass p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-[#23252f]">Listing timeline</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#5f6172]">
          The exact hostname was absent from MetaMask’s configuration at commit <code>c956215</code> on August 26, 2026 at 17:11:28 UTC. It first appeared three minutes later in automated synchronization commit <code>d5f88c9</code>, authored by <code>security-alliance-bot</code>. The public synchronization PR does not include a malicious path, captured credential form, transaction hash, impersonated brand, malware sample, or reporter evidence for this hostname. ChainPatrol lists this exact subdomain as blocked while the parent <code>vercel.app</code> asset is allowed.
        </p>
        <div className="mt-5 flex flex-col items-start gap-3">
          {externalLinks.map(([label, href]) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-[#a97f16] hover:underline">
              {label} <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </section>

      <section className="surface-soft rounded-2xl p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-[#23252f]">Audit and remediation</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-[#5f6172]">
          {fixes.map((fix) => <li key={fix}>{fix}</li>)}
        </ul>
        <p className="mt-5 text-sm leading-relaxed text-[#5f6172]">
          Local validation passed TypeScript checks, Merkle receipt tests, security regression tests, both npm audits, and the optimized production build. Live validation confirmed HTTP 200 for the trust page, security.txt, robots, and sitemap; cross-site API mutation attempts return HTTP 403. Freighter and Privy remain available, and Privy’s real login dialog loads under the deployed Content Security Policy.
        </p>
      </section>

      <section className="rounded-2xl border border-[#eadcae] bg-[#fffaf0] p-6 text-sm leading-relaxed text-[#6b5410]">
        <h2 className="font-display text-xl font-semibold text-[#3b2512]">Request to security providers</h2>
        <p className="mt-2">Please perform a human review and remove this official hostname from the ChainPatrol, SEAL, and MetaMask blocklists. If non-public incident evidence exists, please provide the owner with a sanitized path, timestamp, or indicator so it can be investigated and remediated.</p>
      </section>

      <p className="text-sm"><Link href="/security" className="font-semibold text-[#a97f16] hover:underline">Back to wallet safety</Link></p>
    </div>
  );
}
