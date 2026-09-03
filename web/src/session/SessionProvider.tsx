"use client";
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { connectFreighter, getConnectedAddress, getConnectedNetworkPassphrase, signFanMessage, TESTNET_PASSPHRASE } from "@/wallet/freighter";
import { connectFreighterMobile, disconnectFreighterMobile, isMobileDevice, signFreighterMobileMessage } from "@/wallet/freighterMobile";
import { messageFor } from "@/lib/messages";

export type Fan = { id: string; handle: string; walletAddress: string; points: number; authProvider?: string | null };

type Ctx = {
  fan: Fan | null;
  address: string | null;
  isAdmin: boolean;
  ready: boolean;
  connecting: boolean;
  error: string;
  needsInstall: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  clearError: () => void;
};

const C = createContext<Ctx | null>(null);
// Admin is decided by an allowlist of Stellar addresses. Set NEXT_PUBLIC_ADMIN_WALLETS in .env.
// Note: this is a UI hint only — admin routes are enforced server-side (see adminAuth).
const ADMIN = (process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [fan, setFan] = useState<Fan | null>(null);
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [needsInstall, setNeedsInstall] = useState(false);

  const addressRef = useRef<string | null>(null);
  addressRef.current = address;
  const wrongNetwork = useRef(false);

  // Full wallet sign-in: prove control of the address with a Freighter signature,
  // then the server issues an httpOnly fan-session cookie. Returns true on success.
  async function signInWithAddress(
    addr: string,
    signMessage: (message: string, address: string) => Promise<{ signature?: string; error?: string }> = signFanMessage,
  ): Promise<boolean> {
    // 1) Ask the server for a one-time challenge message.
    let message: string;
    try {
      const r = await fetch("/api/fans/challenge", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      if (!r.ok) { setError("Could not start sign-in. Try again."); return false; }
      message = (await r.json()).message;
    } catch {
      setError("Could not reach the server. Is the dev server running?");
      return false;
    }
    // 2) Sign it in Freighter (proves wallet ownership).
    const signed = await signMessage(message, addr);
    if (signed.error || !signed.signature) {
      setError(signed.error ?? "Sign-in signature was cancelled.");
      return false;
    }
    // 3) Server verifies + sets the session cookie, returns the fan.
    let res: Response;
    try {
      res = await fetch("/api/fans/connect", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: addr, message, signature: signed.signature }),
      });
    } catch {
      setError("Could not reach the server. Is the dev server running?");
      return false;
    }
    if (res.ok) {
      setFan(await res.json());
      setAddress(addr);
      localStorage.setItem("crownfi.addr", addr);
      return true;
    }
    if (res.status === 503) {
      setError("Wallet verified — but the database isn't set up yet. Follow SUPABASE.md, then reconnect.");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(messageFor(body?.error, "We couldn’t sign you in. Please try again."));
    }
    return false;
  }

  // On load, silently restore a valid session from the httpOnly cookie (no wallet popup).
  // We optimistically show the last-known address from localStorage first so navigating or
  // opening a new tab never flashes "Connect Wallet" while /api/fans/me confirms in the background.
  useEffect(() => {
    try {
      const cached = localStorage.getItem("crownfi.addr");
      if (cached) setAddress(cached);
    } catch { /* ignore */ }
    (async () => {
      try {
        const r = await fetch("/api/fans/me");
        if (r.ok) {
          const f = await r.json();
          setFan(f);
          setAddress(f.walletAddress);
          try { localStorage.setItem("crownfi.addr", f.walletAddress); } catch { /* ignore */ }
        } else {
          // Session genuinely gone — clear the optimistic address so we don't show stale state.
          setFan(null);
          setAddress(null);
          try { localStorage.removeItem("crownfi.addr"); } catch { /* ignore */ }
        }
      } catch {
        /* offline — keep the optimistic address, don't force a reconnect */
      }
      setReady(true);
    })();
  }, []);

  // Cross-tab sync: when another tab signs in or out (it writes/clears crownfi.addr),
  // mirror that here so every open tab shows the same wallet without a manual reload.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== "crownfi.addr") return;
      if (e.newValue) {
        // Another tab signed in — adopt the shared cookie session.
        refresh();
      } else {
        // Another tab signed out — clear locally (that tab already hit the logout API).
        setFan(null);
        setAddress(null);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While signed in, watch Freighter for two things that silently invalidate the session:
  //
  //   1. An account switch — the server session belongs to the previous wallet, so sign in again.
  //   2. A network switch — connect() enforces Testnet, but nothing stops the user changing it
  //      afterwards. Every signature we request is pinned to the Testnet passphrase, so on the
  //      wrong network they'd fail with a raw wallet error at the worst moment (mid-purchase).
  //      Say so up front instead.
  //
  // A locked wallet reports neither, and is ignored — the server session stays the source of truth.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const iv = setInterval(async () => {
      const cur = await getConnectedAddress();
      if (cancelled) return;
      if (cur && cur !== addressRef.current) {
        setFan(null);
        setAddress(null);
        localStorage.removeItem("crownfi.addr");
        fetch("/api/fans/logout", { method: "POST" }).catch(() => {});
        setError("Freighter account changed — connect again to sign in as the new wallet.");
        return;
      }

      const net = await getConnectedNetworkPassphrase();
      if (cancelled || !net) return;
      const wrong = net !== TESTNET_PASSPHRASE;
      // Only fire on the transition, so a dismissed banner doesn't reappear every 4s.
      if (wrong && !wrongNetwork.current) {
        wrongNetwork.current = true;
        setError("Freighter is on the wrong network. Switch it back to Testnet — signing won’t work until you do.");
      } else if (!wrong && wrongNetwork.current) {
        wrongNetwork.current = false;
        setError("");
      }
    }, 4000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [address]);

  async function connect() {
    setConnecting(true); setError(""); setNeedsInstall(false);
    try {
      if (isMobileDevice()) {
        const mobile = await connectFreighterMobile();
        if (mobile.error || !mobile.address) { setError(mobile.error ?? "Could not connect Freighter Mobile."); return; }
        await signInWithAddress(mobile.address, (message) => signFreighterMobileMessage(message));
        return;
      }
      const res = await connectFreighter();
      if (res.notInstalled) {
        setNeedsInstall(true);
        setError(res.error ?? "Freighter not detected. Install it from freighter.app, then reload this page.");
        return;
      }
      if (res.error || !res.address) { setError(res.error ?? "Could not connect."); return; }
      await signInWithAddress(res.address);
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    fetch("/api/fans/logout", { method: "POST" }).catch(() => {});
    disconnectFreighterMobile().catch(() => {});
    setFan(null); setAddress(null); setError("");
    localStorage.removeItem("crownfi.addr");
  }

  async function refresh() {
    try {
      const r = await fetch("/api/fans/me");
      if (r.ok) {
        const f = await r.json();
        setFan(f);
        setAddress(f.walletAddress);
      }
    } catch {
      /* ignore */
    }
  }

  function clearError() { setError(""); setNeedsInstall(false); }

  const isAdmin = !!address && ADMIN.includes(address);

  return (
    <C.Provider value={{ fan, address, isAdmin, ready, connecting, error, needsInstall, connect, disconnect, refresh, clearError }}>
      {children}
    </C.Provider>
  );
}

export function useSession() {
  const c = useContext(C);
  if (!c) throw new Error("useSession must be used within SessionProvider");
  return c;
}
