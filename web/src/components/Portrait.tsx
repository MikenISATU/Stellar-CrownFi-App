"use client";
import { useEffect, useState } from "react";
import { gradientFromId, initials } from "@/lib/format";
import { Flag } from "./Flag";

export function Portrait({
  id,
  name,
  sash,
  size = "lg",
  portraitUrl,
  fallbackUrl,
}: {
  id: string;
  name: string;
  sash: string;
  size?: "sm" | "lg";
  portraitUrl?: string | null;
  fallbackUrl?: string | null; // tried if portraitUrl fails (e.g. category image → base portrait)
}) {
  const dim = size === "lg" ? "aspect-[4/5]" : "aspect-square";
  // Ordered list of web-loadable candidate URLs; on error we advance to the next, then to initials.
  const sources = [portraitUrl, fallbackUrl].filter((u): u is string => Boolean(u && /^(https?:\/\/|\/)/.test(u)));
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [portraitUrl, fallbackUrl]); // retry primary when the image changes (e.g. category switch)
  const src = sources[idx];

  return (
    <div className={`relative ${dim} w-full overflow-hidden rounded-2xl`} style={{ background: gradientFromId(id) }}>
      {/* Initials fallback layer — always present, covered by the image when it loads. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-5xl font-semibold text-[#2a2d3a] drop-shadow">{initials(name)}</span>
      </div>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(212,175,55,0.28),transparent_55%)]" />
      <div className="absolute left-3 top-3 rounded-full bg-black/30 px-2 py-1 leading-none backdrop-blur"><Flag sash={sash} className="!h-4 !w-6" /></div>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
    </div>
  );
}
