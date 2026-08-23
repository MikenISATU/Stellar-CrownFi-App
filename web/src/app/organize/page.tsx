"use client";
import { useState } from "react";

export default function OrganizePage() {
  const [f, setF] = useState({ orgName: "", contactName: "", email: "", pageantName: "", country: "", message: "" });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const valid = f.orgName && f.contactName && f.email && f.pageantName && f.country;

  async function submit() {
    setBusy(true); setErr("");
    const res = await fetch("/api/organizer-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    if (res.ok) setSent(true);
    else { const d = await res.json().catch(() => ({})); setErr(d.error ?? "Something went wrong"); }
  }

  if (sent) {
    return (
      <div className="glass mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full surface-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="CrownFi" className="h-7 w-7 object-contain" />
        </div>
        <h1 className="mt-3 tracking-tight text-2xl text-[#23252f]">Request received</h1>
        <p className="mt-2 text-sm text-[#5f6172]">Thanks — we’ll review your pageant and reply at {f.email}, usually within 2–3 business days.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <div className="eyebrow mb-2">For organizers</div>
        <h1 className="tracking-tight text-4xl font-semibold text-[#23252f]">Run your pageant on CrownFi</h1>
        <p className="mt-2 text-sm text-[#5f6172]">Apply to host voting, ticketing, and collectibles for your event. We review every request before granting access.</p>
      </div>
      <div className="glass grid gap-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm"><div className="mb-1 text-[#5f6172]">Organization</div><input className="field" value={f.orgName} onChange={set("orgName")} placeholder="Miss Universe Philippines" /></label>
          <label className="text-sm"><div className="mb-1 text-[#5f6172]">Pageant name</div><input className="field" value={f.pageantName} onChange={set("pageantName")} placeholder="Coronation Night 2026" /></label>
          <label className="text-sm"><div className="mb-1 text-[#5f6172]">Contact name</div><input className="field" value={f.contactName} onChange={set("contactName")} placeholder="Your name" /></label>
          <label className="text-sm"><div className="mb-1 text-[#5f6172]">Email</div><input className="field" type="email" value={f.email} onChange={set("email")} placeholder="you@org.com" /></label>
          <label className="text-sm sm:col-span-2"><div className="mb-1 text-[#5f6172]">Country</div><input className="field" value={f.country} onChange={set("country")} placeholder="Philippines" /></label>
          <label className="text-sm sm:col-span-2"><div className="mb-1 text-[#5f6172]">Tell us about your event (optional)</div><textarea className="field min-h-24" value={f.message} onChange={set("message")} placeholder="Scale, dates, what you need..." /></label>
        </div>
        {err && <p className="text-sm text-ruby">{err}</p>}
        <button className="btn-gold w-fit" disabled={busy || !valid} onClick={submit}>{busy ? "Submitting..." : "Submit request"}</button>
      </div>
    </div>
  );
}