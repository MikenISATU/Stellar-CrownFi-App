"use client";
import { useCallback, useEffect, useState } from "react";
import { Gift, Wallet, Crown, Ticket, Star, Image as ImageIcon, Share2, Users, Check } from "lucide-react";
import { useSession } from "@/session/SessionProvider";
import { Toast } from "@/components/ui";
import { messageFor } from "@/lib/messages";

type Task = { key: string; title: string; description: string; points: number; actionUrl: string | null; icon: string | null; completed: boolean };
type Reward = { key: string; title: string; description: string; cost: number; icon: string | null; stock: number | null; remaining: number | null };
type Loyalty = { points: number; history: { id: string; delta: number; reason: string; createdAt: string }[]; redemptions: { id: string; title: string; cost: number; code: string; status: string; createdAt: string }[] };

const ICON: Record<string, any> = { x: Share2, discord: Users, linkedin: Users, share: Share2, wallet: Wallet, crown: Crown, ticket: Ticket, star: Star, image: ImageIcon, gift: Gift };
function Ic({ name, className }: { name: string | null; className?: string }) {
  const C = (name && ICON[name]) || Gift;
  return <C className={className} size={18} strokeWidth={1.75} />;
}

function reasonLabel(reason: string): string {
  if (reason === "vote") return "Voted";
  if (reason === "collectible") return "Collected an NFT";
  if (reason.startsWith("task:")) return "Completed a task";
  if (reason.startsWith("redeem:")) return "Redeemed a reward";
  return reason;
}

export default function LoyaltyPage() {
  const { fan, connect, connecting } = useSession();
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shop, setShop] = useState<Reward[]>([]);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState({ msg: "", tone: "ok" as "ok" | "err" });

  function flash(msg: string, tone: "ok" | "err") {
    setToast({ msg, tone });
    setTimeout(() => setToast({ msg: "", tone: "ok" }), 3400);
  }

  const loadAll = useCallback(async () => {
    // Shop is public; balance + tasks require the fan session.
    const shopRes = await fetch("/api/loyalty/shop").then((r) => r.json()).catch(() => []);
    setShop(Array.isArray(shopRes) ? shopRes : []);
    if (!fan) { setLoyalty(null); setTasks([]); return; }
    const [l, t] = await Promise.all([
      fetch("/api/loyalty").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/loyalty/tasks").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    setLoyalty(l);
    setTasks(Array.isArray(t) ? t : []);
  }, [fan]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function completeTask(t: Task) {
    if (t.completed) return;
    setBusy(`task:${t.key}`);
    if (t.actionUrl) window.open(t.actionUrl, "_blank", "noopener,noreferrer");
    try {
      const r = await fetch("/api/loyalty/tasks/complete", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskKey: t.key }),
      });
      const d = await r.json();
      if (r.ok) { flash(`+${d.awarded} points!`, "ok"); await loadAll(); }
      else flash(messageFor(d.error, "Could not claim this task."), "err");
    } catch {
      flash("Could not claim task.", "err");
    } finally {
      setBusy("");
    }
  }

  async function redeem(rw: Reward) {
    setBusy(`reward:${rw.key}`);
    try {
      const r = await fetch("/api/loyalty/redeem", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ rewardKey: rw.key }),
      });
      const d = await r.json();
      if (r.ok) { flash(`Redeemed! Code ${d.code}`, "ok"); await loadAll(); }
      else flash(messageFor(d.error, "Could not redeem this reward."), "err");
    } catch {
      flash("Could not redeem.", "err");
    } finally {
      setBusy("");
    }
  }

  const points = loyalty?.points ?? fan?.points ?? 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Fan rewards</div>
          <h1 className="tracking-tight text-4xl font-semibold text-[#23252f] sm:text-5xl">Loyalty</h1>
          <p className="mt-2 max-w-xl text-sm text-[#5f6172]">Earn points by voting, collecting, and completing social tasks. Redeem them for perks. Support and points never change vote power.</p>
        </div>
        <div className="card-gold px-6 py-4 text-center">
          <div className="text-xs uppercase tracking-wider text-[#7a7768]">Your balance</div>
          <div className="font-display text-4xl font-semibold tabular-nums text-[#b8912f]">{points.toLocaleString()}</div>
          <div className="text-xs text-[#7a7768]">points</div>
        </div>
      </header>

      {!fan && (
        <div className="glass p-8 text-center">
          <div className="font-display text-xl text-[#23252f]">Connect to start earning</div>
          <p className="mt-2 text-sm text-[#7a7768]">Sign in with Freighter to track points, complete tasks, and redeem rewards.</p>
          <button onClick={connect} disabled={connecting} className="btn-gold mt-4">{connecting ? "Connecting…" : "Connect wallet"}</button>
        </div>
      )}

      {/* Social tasks */}
      {fan && (
        <section>
          <h2 className="mb-4 tracking-tight text-2xl font-semibold text-[#23252f]">Earn points</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {tasks.map((t) => (
              <div key={t.key} className="card-gold flex items-center gap-4 p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl surface-soft text-[#a97f16]"><Ic name={t.icon} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base text-[#23252f]">{t.title}</div>
                  <div className="truncate text-xs text-[#7a7768]">{t.description}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold text-[#a97f16]">+{t.points}</div>
                  {t.completed ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700"><Check size={13} /> Done</span>
                  ) : (
                    <button onClick={() => completeTask(t)} disabled={busy === `task:${t.key}`} className="btn-gold mt-1 !px-3 !py-1 text-xs">
                      {busy === `task:${t.key}` ? "…" : "Claim"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {tasks.length === 0 && <div className="glass p-6 text-center text-sm text-[#7a7768] sm:col-span-2">No tasks available right now.</div>}
          </div>
        </section>
      )}

      {/* Shop */}
      <section>
        <h2 className="mb-4 tracking-tight text-2xl font-semibold text-[#23252f]">Loyalty shop</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shop.map((rw) => {
            const soldOut = rw.remaining != null && rw.remaining <= 0;
            const cant = !fan || points < rw.cost || soldOut;
            return (
              <div key={rw.key} className="card-gold flex flex-col p-5">
                <div className="grid h-11 w-11 place-items-center rounded-xl surface-soft text-[#a97f16]"><Ic name={rw.icon} /></div>
                <div className="mt-3 font-display text-lg text-[#23252f]">{rw.title}</div>
                <div className="mt-1 flex-1 text-xs text-[#7a7768]">{rw.description}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold text-[#a97f16]">{rw.cost} pts</span>
                  {rw.remaining != null && <span className="text-[11px] text-[#7a7768]">{rw.remaining} left</span>}
                </div>
                <button onClick={() => redeem(rw)} disabled={cant || busy === `reward:${rw.key}`} className="btn-gold mt-3 !py-2 text-sm disabled:opacity-50">
                  {busy === `reward:${rw.key}` ? "Redeeming…" : soldOut ? "Sold out" : !fan ? "Connect to redeem" : points < rw.cost ? "Not enough points" : "Redeem"}
                </button>
              </div>
            );
          })}
          {shop.length === 0 && <div className="glass p-6 text-center text-sm text-[#7a7768] sm:col-span-2 lg:col-span-4">The shop is being stocked. Check back soon.</div>}
        </div>
      </section>

      {/* History */}
      {fan && loyalty && (loyalty.history.length > 0 || loyalty.redemptions.length > 0) && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 tracking-tight text-xl font-semibold text-[#23252f]">Points history</h2>
            <div className="glass divide-y divide-[#eee6d3]">
              {loyalty.history.map((h) => (
                <div key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-[#5f6172]">{reasonLabel(h.reason)}</span>
                  <span className={h.delta >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-[#9f1239]"}>{h.delta >= 0 ? "+" : ""}{h.delta}</span>
                </div>
              ))}
              {loyalty.history.length === 0 && <div className="px-4 py-4 text-sm text-[#7a7768]">No activity yet.</div>}
            </div>
          </div>
          <div>
            <h2 className="mb-3 tracking-tight text-xl font-semibold text-[#23252f]">Redemptions</h2>
            <div className="glass divide-y divide-[#eee6d3]">
              {loyalty.redemptions.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-[#5f6172]">{r.title}</span>
                  <span className="mono text-xs text-[#a97f16]">{r.code}</span>
                </div>
              ))}
              {loyalty.redemptions.length === 0 && <div className="px-4 py-4 text-sm text-[#7a7768]">No redemptions yet.</div>}
            </div>
          </div>
        </section>
      )}

      <Toast msg={toast.msg} tone={toast.tone} />
    </div>
  );
}
