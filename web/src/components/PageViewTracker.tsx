"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { validPublicPath } from "@/lib/predictionUpdates";

export function PageViewTracker() {
  const path = usePathname();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (previous.current === path) return;
    previous.current = path;
    if (!validPublicPath(path)) return;
    void fetch("/api/page-views", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: crypto.randomUUID(), path }), keepalive: true,
    }).catch(() => {});
  }, [path]);
  return null;
}
