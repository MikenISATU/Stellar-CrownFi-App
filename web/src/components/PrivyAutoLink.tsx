"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy, useUser } from "@privy-io/react-auth";
import { useSession } from "@/session/SessionProvider";
import { messageFor } from "@/lib/messages";

// Persistent: after Privy email/Google auth, exchanges the access token for a CrownFi
// session (server verifies the token + provisions the Stellar wallet). Lives outside the
// connect chooser so it keeps running after the chooser closes. Renders only an error, if any.
export function PrivyAutoLink() {
  const { authenticated, logout, getAccessToken } = usePrivy();
  const { refreshUser } = useUser();
  const { fan, refresh } = useSession();
  const [err, setErr] = useState("");
  const attempted = useRef(false);

  const linkSession = useCallback(async () => {
    setErr("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/fans/privy-connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        // The server may have provisioned this user's Stellar wallet during the exchange.
        // Refresh Privy's client-side user before a paid action calls useSignRawHash;
        // without this, first-time Google users had to reload before their first stake.
        await refreshUser().catch(() => {});
        await refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setErr(messageFor(d.error, "Could not finish sign-in."));
        await logout().catch(() => {}); // reset so the user can retry cleanly
      }
    } catch {
      setErr("Could not finish sign-in.");
    }
  }, [getAccessToken, refresh, refreshUser, logout]);

  useEffect(() => {
    if (!authenticated) { attempted.current = false; return; }
    if (fan || attempted.current) return;
    attempted.current = true;
    linkSession();
  }, [authenticated, fan, linkSession]);

  if (!err) return null;
  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-60 rounded-lg border border-[#f0d9a0] bg-[#fff8e6] px-3 py-2 text-xs text-[#6b5410] shadow">
      {err}
    </div>
  );
}
