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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000"),
  title: "CrownFi — Crown your queen, on-chain",
  description: "Blockchain-powered voting, ticketing, and fan experience for pageants, built on Stellar.",
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
      <head>
        {/*
          Night mode is hidden for now — the app is light-only. This clears the `dark` class and
          any saved choice before paint, so anyone already in night mode (or on an OS that prefers
          dark) lands on the light theme instead of being stuck with no toggle to escape it.

          To bring night mode back: restore the line below and re-add <ThemeToggle /> in AppShell.
          The html.dark rules in globals.css and ThemeToggle.tsx are left intact for that.
            var t=localStorage.getItem('crownfi.theme');
            if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.classList.remove('dark');localStorage.removeItem('crownfi.theme');}catch(e){}})();`,
          }}
        />
      </head>
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
