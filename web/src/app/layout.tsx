import "./globals.css";
import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { SessionProvider } from "@/session/SessionProvider";
import { PrivyWrapper } from "@/session/PrivyWrapper";
import { AppShell } from "@/components/AppShell";

// Typography: Playfair Display for headlines/numbers (the fashion-editorial serif the gold
// design wants), Inter for body/UI (crisp at small sizes). Self-hosted via next/font — no
// CDN request, no layout shift, and every device sees the same fonts (Android ships no
// Times New Roman, so the old setup rendered differently per platform).
const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const metadataOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(metadataOrigin),
  applicationName: "CrownFi",
  title: "CrownFi — Crown your queen, on-chain",
  description: "Blockchain-powered voting, ticketing, and fan experience for pageants, built on Stellar.",
  authors: [{ name: "CrownFi", url: "https://github.com/MikenISATU/Stellar-CrownFi-App" }],
  creator: "CrownFi",
  publisher: "CrownFi",
  category: "technology",
  robots: { index: true, follow: true },
  openGraph: {
    title: "CrownFi — Crown your queen, on-chain",
    description: "Vote, predict, and collect — every result sealed on Stellar.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "CrownFi — crown your queen, on-chain" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CrownFi — Crown your queen, on-chain",
    description: "Vote, predict, and collect — every result sealed on Stellar.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <PrivyWrapper>
          <SessionProvider>
            <AppShell>{children}</AppShell>
          </SessionProvider>
        </PrivyWrapper>
      </body>
    </html>
  );
}
