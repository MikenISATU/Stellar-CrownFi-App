"use client";
import { useEffect, useState } from "react";
import { Icons } from "./icons";

// Night / light toggle. The initial class is set by an inline script in <head> (no flash);
// this just reflects + flips it, persisting the choice.
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("crownfi.theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to night mode"}
      title={dark ? "Light mode" : "Night mode"}
      className="grid h-9 w-9 place-items-center rounded-full border border-[#e7e2d3] bg-white text-[#7a7768] transition hover:border-[#c9a227] hover:text-[#a97f16]"
    >
      {dark ? <Icons.Sun size={16} strokeWidth={2} /> : <Icons.Moon size={16} strokeWidth={2} />}
    </button>
  );
}
