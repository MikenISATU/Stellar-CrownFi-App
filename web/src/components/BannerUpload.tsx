"use client";
import { useRef, useState } from "react";

// Downscale an image in the browser BEFORE upload so even huge photos (20MB+) become a small
// WebP (~a few hundred KB). This keeps uploads fast and avoids the server size limit. Animated
// GIFs are left untouched (canvas would flatten them). Falls back to the raw file if anything fails.
async function downscaleImage(file: File, maxDim = 1600, quality = 0.82): Promise<{ blob: Blob; name: string }> {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return { blob: file, name: file.name };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, name: file.name };
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/webp", quality));
    if (!blob) return { blob: file, name: file.name };
    return { blob, name: file.name.replace(/\.[^.]+$/, "") + ".webp" };
  } catch {
    return { blob: file, name: file.name };
  }
}

// Upload an image → returns its served URL via onUploaded. Used for market banners.
export function BannerUpload({ value, onUploaded }: { value?: string | null; onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr("");
    setNote("");
    try {
      // Shrink big images client-side first (any dimensions/size → lightweight WebP).
      const { blob, name } = await downscaleImage(file);
      const fd = new FormData();
      fd.append("file", blob, name);
      fd.append("folder", "markets");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) {
        onUploaded(d.url);
        const orig = file.size / 1024, now = blob.size / 1024;
        setNote(orig > now * 1.1 ? `Optimized ${orig > 1024 ? (orig / 1024).toFixed(1) + "MB" : Math.round(orig) + "KB"} → ${Math.round(now)}KB` : "");
      } else {
        setErr(d.error === "file_too_large" ? "Image too large (max 15MB). Try a smaller file." : d.error === "invalid_file_type" ? "Use a PNG, JPG, WebP, or GIF." : "Upload failed. Please try again.");
      }
    } catch {
      setErr("Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-dashed border-[#d9d3c3] bg-[#faf7ef]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="banner" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-[10px] text-[#9a968b]">No banner</div>
          )}
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="btn-ghost !px-4 !py-2 text-sm">
          {busy ? "Optimizing…" : value ? "Change banner" : "Upload banner image"}
        </button>
      </div>
      <div className="mt-1 text-[11px] text-[#9a968b]">Any size works — large images are auto-shrunk to a fast web banner.</div>
      {note && <div className="mt-0.5 text-[11px] text-[#0f6e56]">{note}</div>}
      {err && <div className="mt-0.5 text-xs text-[#9f1239]">{err}</div>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
