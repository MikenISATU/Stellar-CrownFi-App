"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/session/SessionProvider";
import { Toast } from "@/components/ui";
import { messageFor } from "@/lib/messages";
import { STATUS_LABEL, STATUS_CHIP, isEditableByOrganizer, canOrganizerSubmit } from "@/lib/pageant";

type Candidate = { id: string; fullName: string; number: number | null; bio: string | null; age: number | null; location: string | null; profileUrl: string | null; nftArtworkUrl: string | null; maxSupply: number; images: { categoryKey: string; url: string }[] };
type Pageant = any;

// NFT collectible artwork is produced by the platform team (Phase 2 → Pinata/IPFS),
// so organizers only upload the competition photos here.
const UPLOAD_KINDS: { key: string; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "swimsuit", label: "Swimsuit" },
  { key: "long_gown", label: "Long Gown" },
];

export default function OrganizerDashboard() {
  const { fan, connect, connecting } = useSession();
  const [mine, setMine] = useState<Pageant[]>([]);
  const [sel, setSel] = useState<Pageant | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState({ msg: "", tone: "ok" as "ok" | "err" });
  const flash = (msg: string, tone: "ok" | "err" = "ok") => { setToast({ msg, tone }); setTimeout(() => setToast({ msg: "", tone: "ok" }), 3200); };

  const loadMine = useCallback(async () => {
    const r = await fetch("/api/pageants?mine=1");
    if (r.ok) setMine(await r.json());
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    const r = await fetch(`/api/pageants/${id}`);
    if (r.ok) setSel(await r.json());
  }, []);

  useEffect(() => { if (fan) loadMine(); }, [fan, loadMine]);

  if (!fan) {
    return (
      <div className="space-y-8">
        <div className="glass mx-auto max-w-md p-8 text-center">
          <div className="eyebrow mb-2">Organizer</div>
          <h1 className="tracking-tight text-2xl text-[#23252f]">Run your pageant on CrownFi</h1>
          <p className="mt-2 text-sm text-[#5f6172]">
            Connect your wallet to register an event, add candidates and track your review. Here’s what to prepare
            before you start.
          </p>
          <button className="btn-gold mt-4" onClick={connect}>{connecting ? "Connecting…" : "Connect wallet"}</button>
        </div>
        <SubmissionGuide />
      </div>
    );
  }

  // ── Editor view ──
  if (sel) {
    return (
      <>
        <PageantEditor pageant={sel} onBack={() => { setSel(null); loadMine(); }} reload={() => loadDetail(sel.id)} flash={flash} />
        <Toast msg={toast.msg} tone={toast.tone} />
      </>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Organizer dashboard</div>
          <h1 className="tracking-tight text-4xl font-semibold text-[#23252f]">Your pageants</h1>
          <p className="mt-2 max-w-xl text-sm text-[#5f6172]">
            Register your event, add your candidates, and send it in for review. Once approved, your pageant opens for
            voting, tickets and collectibles on CrownFi.
          </p>
        </div>
        <button className="btn-gold" onClick={() => setCreating((c) => !c)}>{creating ? "Close" : "New pageant"}</button>
      </div>

      <SubmissionGuide />

      {creating && <CreateForm onCreated={(p) => { setCreating(false); loadMine(); setSel(p); }} flash={flash} />}

      <div className="grid gap-3 sm:grid-cols-2">
        {mine.map((p) => (
          <button key={p.id} onClick={() => loadDetail(p.id)} className="glass glass-hover p-4 text-left">
            <div className="flex items-center justify-between">
              <div className="font-display text-lg text-[#23252f]">{p.title}</div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CHIP[p.status]}`}>{STATUS_LABEL[p.status]}</span>
            </div>
            <div className="mt-1 text-xs text-[#7a7768]">{p.orgName} · {p._count?.candidates ?? 0} candidates</div>
            {p.status === "requires_changes" && p.reviewNote && <div className="mt-2 rounded-lg bg-[#fbeede] px-2 py-1 text-xs text-[#9a5a12]">Changes requested: {p.reviewNote}</div>}
          </button>
        ))}
        {mine.length === 0 && !creating && <div className="glass p-6 text-center text-sm text-[#7a7768] sm:col-span-2">No pageants yet. Click “New pageant” to start.</div>}
      </div>

      <Toast msg={toast.msg} tone={toast.tone} />
    </div>
  );
}

function Field({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="text-sm">
      <div className="mb-1 text-[#5f6172]">{label}</div>
      <input className="field" {...props} />
      {hint && <div className="mt-1 text-xs text-[#7a7768]">{hint}</div>}
    </label>
  );
}

const STEPS = [
  { n: "1", t: "Register the event", d: "Organization, contact person, venue and date." },
  { n: "2", t: "Add candidates and files", d: "Upload each candidate’s photos and link your Drive folder." },
  { n: "3", t: "Submit for review", d: "We verify the details, then approve or reply with what to fix." },
];

const DRIVE_CHECKLIST = [
  "Proof the organization is real — registration, permit, or an official letter",
  "Final candidate roster with sash country and number",
  "Hi-res photos per candidate: profile, swimsuit, long gown (1200px or larger)",
  "Event schedule, venue and date",
];

function SubmissionGuide() {
  return (
    <section className="glass p-6">
      <h2 className="tracking-tight text-xl font-semibold text-[#23252f]">How a submission works</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="card-gold p-4">
            <div className="flex items-center gap-2">
              <span className="num-gold">{s.n}</span>
              <span className="font-display text-base text-[#23252f]">{s.t}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#5f6172]">{s.d}</p>
          </li>
        ))}
      </ol>

      <div className="card-gold mt-5 p-4">
        <div className="font-display text-base text-[#23252f]">What goes in your Google Drive folder</div>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {DRIVE_CHECKLIST.map((c) => (
            <li key={c} className="flex gap-2 text-sm text-[#5f6172]">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4af37]" />
              {c}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-[#7a7768]">
          Share it as <b>Anyone with the link can view</b> and paste the link on your pageant page. Files stay in your
          Drive. Review takes 2–3 business days.
        </p>
      </div>
    </section>
  );
}

function CreateForm({ onCreated, flash }: { onCreated: (p: any) => void; flash: (m: string, t?: "ok" | "err") => void }) {
  const [f, setF] = useState({ title: "", orgName: "", contactName: "", email: "", website: "", facebook: "", instagram: "", verification: "", driveUrl: "", venue: "", eventDate: "", description: "" });
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  const [busy, setBusy] = useState(false);
  const valid = f.title && f.orgName && f.contactName && f.email;

  async function create() {
    setBusy(true);
    const r = await fetch("/api/pageants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    if (r.ok) { flash("Pageant created — add your candidates."); onCreated(await r.json()); }
    else { const d = await r.json().catch(() => ({})); flash(messageFor(d.error, "Could not create pageant."), "err"); }
  }

  return (
    <div className="glass grid gap-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event title *" value={f.title} onChange={set("title")} placeholder="Miss Universe Philippines 2027" />
        <Field label="Organization *" value={f.orgName} onChange={set("orgName")} placeholder="Miss Universe Philippines" />
        <Field label="Contact person *" value={f.contactName} onChange={set("contactName")} placeholder="Your name" />
        <Field label="Official email *" type="email" value={f.email} onChange={set("email")} placeholder="you@org.com" />
        <Field label="Official website" value={f.website} onChange={set("website")} placeholder="https://…" />
        <Field label="Facebook" value={f.facebook} onChange={set("facebook")} placeholder="https://facebook.com/…" />
        <Field label="Instagram" value={f.instagram} onChange={set("instagram")} placeholder="https://instagram.com/…" />
        <Field label="Verification links" value={f.verification} onChange={set("verification")} placeholder="Any links that prove legitimacy" />
        <Field label="Venue" value={f.venue} onChange={set("venue")} placeholder="Event venue" />
        <Field label="Event date" type="date" value={f.eventDate} onChange={set("eventDate")} />
        <div className="sm:col-span-2">
          <Field
            label="Google Drive folder — required files"
            value={f.driveUrl}
            onChange={set("driveUrl")}
            placeholder="https://drive.google.com/drive/folders/…"
            hint="Permits, candidate roster and hi-res photos. Share it as “Anyone with the link can view”. You can add this later."
          />
        </div>
        <label className="text-sm sm:col-span-2"><div className="mb-1 text-[#5f6172]">Description</div><textarea className="field min-h-24" value={f.description} onChange={set("description")} placeholder="About the event" /></label>
      </div>
      <button className="btn-gold w-fit" disabled={busy || !valid} onClick={create}>{busy ? "Creating…" : "Create pageant"}</button>
    </div>
  );
}

function PageantEditor({ pageant, onBack, reload, flash }: { pageant: any; onBack: () => void; reload: () => void; flash: (m: string, t?: "ok" | "err") => void }) {
  const editable = isEditableByOrganizer(pageant.status);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function addCandidate() {
    if (!name.trim()) return;
    setBusy(true);
    const r = await fetch(`/api/pageants/${pageant.id}/candidates`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: name }) });
    setBusy(false);
    if (r.ok) { setName(""); reload(); } else { const d = await r.json().catch(() => ({})); flash(messageFor(d.error, "Could not add candidate."), "err"); }
  }
  async function submit() {
    const r = await fetch(`/api/pageants/${pageant.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "submit" }) });
    if (r.ok) { flash("Submitted for review!"); reload(); } else { const d = await r.json().catch(() => ({})); flash(d.error === "no_candidates" ? "Add at least one candidate first." : messageFor(d.error, "Could not submit."), "err"); }
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-[#7a7768] hover:text-[#23252f]">← Back to my pageants</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="tracking-tight text-3xl font-semibold text-[#23252f]">{pageant.title}</h1>
          <div className="mt-1 text-sm text-[#7a7768]">{pageant.orgName}</div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CHIP[pageant.status]}`}>{STATUS_LABEL[pageant.status]}</span>
      </div>

      {pageant.status === "requires_changes" && pageant.reviewNote && (
        <div className="rounded-xl border border-[#f0d9a0] bg-[#fff8e6] px-4 py-3 text-sm text-[#6b5410]">Admin requested changes: {pageant.reviewNote}</div>
      )}
      {!editable && pageant.status !== "requires_changes" && (
        <div className="glass p-3 text-sm text-[#7a7768]">This pageant is <b>{STATUS_LABEL[pageant.status].toLowerCase()}</b> and can’t be edited right now.</div>
      )}

      <RequiredFiles pageant={pageant} editable={editable} reload={reload} flash={flash} />

      {/* Candidates */}
      <section>
        <h2 className="mb-3 tracking-tight text-xl font-semibold text-[#23252f]">Candidates</h2>
        <p className="mb-3 text-sm text-[#5f6172]">Add every candidate, then upload their profile, swimsuit and long gown photo. These are the images fans see when they vote.</p>
        {editable && (
          <div className="glass mb-4 flex flex-col gap-3 p-4 sm:flex-row">
            <input className="field" placeholder="Candidate full name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCandidate()} />
            <button className="btn-gold shrink-0" disabled={busy || !name.trim()} onClick={addCandidate}>Add candidate</button>
          </div>
        )}
        <div className="grid gap-4">
          {(pageant.candidates ?? []).map((c: Candidate) => (
            <CandidateCard key={c.id} pageantId={pageant.id} candidate={c} editable={editable} reload={reload} flash={flash} />
          ))}
          {(pageant.candidates ?? []).length === 0 && <div className="glass p-6 text-center text-sm text-[#7a7768]">No candidates yet.</div>}
        </div>
      </section>

      {editable && canOrganizerSubmit(pageant.status) && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!pageant.driveUrl && <span className="text-xs text-[#9a5a12]">Add your Drive link above so we can verify the event.</span>}
          <button className="btn-gold !px-8 !py-3" onClick={submit}>Submit for review</button>
        </div>
      )}
    </div>
  );
}

// The Drive folder is where the paperwork lives — permits, roster, hi-res photos.
function RequiredFiles({ pageant, editable, reload, flash }: { pageant: any; editable: boolean; reload: () => void; flash: (m: string, t?: "ok" | "err") => void }) {
  const [url, setUrl] = useState<string>(pageant.driveUrl ?? "");
  const [busy, setBusy] = useState(false);
  const saved = pageant.driveUrl ?? "";
  const dirty = url.trim() !== saved;

  async function save() {
    setBusy(true);
    const r = await fetch(`/api/pageants/${pageant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ driveUrl: url.trim() || null }),
    });
    setBusy(false);
    if (r.ok) { flash(url.trim() ? "Drive link saved." : "Drive link removed."); reload(); }
    else { const d = await r.json().catch(() => ({})); flash(messageFor(d.error, "Could not save the link."), "err"); }
  }

  return (
    <section className="glass p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="tracking-tight text-xl font-semibold text-[#23252f]">Required files</h2>
        {saved
          ? <span className="tag-on">Link added</span>
          : <span className="tag-off">Not linked yet</span>}
      </div>
      <p className="mt-1 max-w-2xl text-sm text-[#5f6172]">
        Put the permits, final candidate roster and hi-res photos in one Google Drive folder, share it as{" "}
        <b>Anyone with the link can view</b>, and paste the link here. Reviewers open it straight from your submission.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          className="field"
          type="url"
          inputMode="url"
          placeholder="https://drive.google.com/drive/folders/…"
          value={url}
          disabled={!editable}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && editable && dirty && save()}
        />
        {editable && (
          <button className="btn-gold shrink-0" disabled={busy || !dirty} onClick={save}>
            {busy ? "Saving…" : "Save link"}
          </button>
        )}
      </div>

      {saved && (
        <a href={saved} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-[#a97f16] hover:underline">
          Open the folder ↗
        </a>
      )}
    </section>
  );
}

function CandidateCard({ pageantId, candidate, editable, reload, flash }: { pageantId: string; candidate: Candidate; editable: boolean; reload: () => void; flash: (m: string, t?: "ok" | "err") => void }) {
  const imgByKind = (k: string) => candidate.images?.find((i) => i.categoryKey === k)?.url;

  async function del() {
    if (!confirm(`Remove ${candidate.fullName}?`)) return;
    const r = await fetch(`/api/pageants/${pageantId}/candidates/${candidate.id}`, { method: "DELETE" });
    if (r.ok) reload();
  }

  return (
    <div className="glass p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg text-[#23252f]">{candidate.fullName}</div>
          <div className="text-xs text-[#7a7768]">{candidate.location ?? "—"} · supply {candidate.maxSupply}</div>
        </div>
        {editable && <button onClick={del} className="text-xs text-[#9f1239] hover:underline">Remove</button>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {UPLOAD_KINDS.map((k) => (
          <UploadSlot key={k.key} pageantId={pageantId} cid={candidate.id} kind={k.key} label={k.label} url={imgByKind(k.key)} editable={editable} reload={reload} flash={flash} />
        ))}
      </div>
    </div>
  );
}

function UploadSlot({ pageantId, cid, kind, label, url, editable, reload, flash }: { pageantId: string; cid: string; kind: string; label: string; url?: string; editable: boolean; reload: () => void; flash: (m: string, t?: "ok" | "err") => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const r = await fetch(`/api/pageants/${pageantId}/candidates/${cid}/upload`, { method: "POST", body: fd });
    setBusy(false);
    if (r.ok) { reload(); } else { const d = await r.json().catch(() => ({})); flash(messageFor(d.error, "Upload failed."), "err"); }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-[#7a7768]">{label}</div>
      <button
        onClick={() => editable && inputRef.current?.click()}
        disabled={!editable || busy}
        className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-dashed ${url ? "border-transparent" : "border-[#d9d3c3]"} bg-[#faf7ef] text-xs text-[#7a7768] ${editable ? "hover:border-[#c9a227]" : "opacity-70"}`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span>{busy ? "Uploading…" : editable ? "+ Upload" : "—"}</span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
