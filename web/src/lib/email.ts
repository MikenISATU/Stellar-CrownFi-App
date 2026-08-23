// Email via Resend (https://resend.com) — free tier (100/day, 3k/mo), simple REST API,
// no SDK needed. Configure with env vars; if RESEND_API_KEY is unset this is a safe no-op
// (logs and returns false) so the app never breaks without email configured.
//
//   RESEND_API_KEY=re_...            (server-only)
//   EMAIL_FROM="CrownFi <onboarding@resend.dev>"   (use onboarding@resend.dev for testing,
//                                                    or a verified-domain sender in production)

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] RESEND_API_KEY not set — skipping "${subject}" → ${to}`);
    return false;
  }
  const from = process.env.EMAIL_FROM || "CrownFi <onboarding@resend.dev>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!r.ok) {
      console.warn("[email] send failed", r.status, await r.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[email] error", e);
    return false;
  }
}

const wrap = (title: string, body: string) =>
  `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#23252f">
     <div style="background:linear-gradient(180deg,#eacb63,#b8912f);color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
       <div style="font-size:20px;font-weight:700">👑 CrownFi</div>
     </div>
     <div style="border:1px solid #eee6d3;border-top:0;border-radius:0 0 12px 12px;padding:24px">
       <h2 style="margin:0 0 12px">${title}</h2>
       ${body}
       <p style="color:#7a7768;font-size:12px;margin-top:24px">CrownFi — pageant platform on Stellar (testnet/demo).</p>
     </div>
   </div>`;

// Pageant decision emails to the organizer.
export function pageantDecisionEmail(decision: string, pageantTitle: string, note?: string | null) {
  if (decision === "approved") {
    return {
      subject: `Your pageant "${pageantTitle}" is approved 🎉`,
      html: wrap("Your pageant is approved", `<p>Great news — <b>${pageantTitle}</b> has been approved and is now live on CrownFi.</p>`),
    };
  }
  if (decision === "requires_changes") {
    return {
      subject: `Changes requested for "${pageantTitle}"`,
      html: wrap("Changes requested", `<p>Your submission <b>${pageantTitle}</b> needs a few changes before it can be approved:</p><p style="background:#fff8e6;border:1px solid #f0d9a0;border-radius:8px;padding:12px">${note ?? ""}</p><p>Please update it in your organizer dashboard and resubmit.</p>`),
    };
  }
  return {
    subject: `Update on your pageant "${pageantTitle}"`,
    html: wrap("Submission not approved", `<p>Thank you for your submission <b>${pageantTitle}</b>. After review it was not approved${note ? `:</p><p style="background:#fbe9ef;border-radius:8px;padding:12px">${note}` : ""}.</p>`),
  };
}
