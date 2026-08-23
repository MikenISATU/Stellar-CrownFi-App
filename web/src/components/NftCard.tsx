"use client";
import { Flag } from "./Flag";

// A luxury "NFT trading card" that mirrors the CrownFi collectible design: a gold
// circuit-board frame on a dark ground, the delegate's photo on the right, and a
// Name / Country / Continent / Height plate on the left. Fully dynamic per delegate.
export function NftCard({
  name,
  country,
  sash,
  continent,
  height,
  photo,
  edition = 1,
  supply = 1,
  tokenId,
}: {
  name: string;
  country: string;
  sash: string;
  continent: string;
  height: string;
  photo?: string | null;
  edition?: number;
  supply?: number;
  tokenId?: string | null;
}) {
  const idLabel = (tokenId ?? "CROWNFI").toString().slice(0, 10).toUpperCase();
  return (
    <div className="w-full rounded-[1.4rem] bg-gradient-to-br from-[#f4e29a] via-[#d4af37] to-[#9c7a1f] p-[3px] shadow-[0_30px_70px_-30px_rgba(184,145,47,0.7)]">
      <div className="relative overflow-hidden rounded-[1.2rem] bg-gradient-to-br from-[#151007] via-[#231803] to-[#0f0b04]">
        {/* Circuit texture */}
        <div className="pointer-events-none absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(212,175,55,0.5) 1px, transparent 0)", backgroundSize: "18px 18px" }} />
        {/* Inner gold hairline */}
        <div className="pointer-events-none absolute inset-2 rounded-[1rem] border border-[#d4af37]/40" />

        <div className="relative flex min-h-[15rem] items-stretch gap-3 p-4 sm:min-h-[17rem] sm:p-6">
          {/* Left: name + plate */}
          <div className="flex flex-1 flex-col justify-center">
            <div className="font-display text-sm text-[#e6cf8f]">Name:</div>
            <div className="font-display text-2xl font-semibold leading-tight text-[#f4e29a] drop-shadow sm:text-4xl">{name}</div>
            <div className="mt-3 max-w-[15rem] rounded-lg border border-[#d4af37]/50 bg-[#faf7ef] px-3 py-2 text-xs text-[#23252f] sm:text-sm">
              <div><span className="font-semibold">Country:</span> <Flag sash={sash} /> {country}</div>
              <div><span className="font-semibold">Continent:</span> {continent}</div>
              <div><span className="font-semibold">Height:</span> {height}</div>
            </div>
          </div>
          {/* Right: photo */}
          <div className="relative w-2/5 shrink-0 overflow-hidden rounded-xl">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={name} className="absolute inset-0 h-full w-full object-cover object-top" />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-[#2a1f08] font-display text-3xl text-[#d4af37]">{name.slice(0, 1)}</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#150f05]/40" />
          </div>
        </div>

        {/* Bottom strip */}
        <div className="relative flex items-center justify-between border-t border-[#d4af37]/30 px-5 py-2 text-[10px] uppercase tracking-wider text-[#e6cf8f]/80 sm:text-xs">
          <span>Edition {edition} of {supply}</span>
          <span className="font-display text-lg text-[#f4e29a]">∞</span>
          <span className="mono">ID: {idLabel}</span>
        </div>
      </div>
    </div>
  );
}
