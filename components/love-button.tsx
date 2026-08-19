"use client";

import { useEffect, useState } from "react";

type State = "idle" | "sending" | "sent" | "cooldown" | "error";

export function LoveButton({ latestReturn }: { latestReturn: string | null }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [latestReturnLabel, setLatestReturnLabel] = useState("recently");

  useEffect(() => {
    if (!latestReturn) return;
    const update = () => setLatestReturnLabel(new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      -Math.max(1, Math.round((Date.now() - new Date(latestReturn).getTime()) / 60_000)),
      "minute",
    ));
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [latestReturn]);

  async function sendLove() {
    setState("sending");
    setMessage("sending to Singapore…");
    try {
      const response = await fetch("/api/thinking-of-you", { method: "POST" });
      const body = (await response.json()) as { message?: string; retryAfter?: number };
      if (response.status === 429) {
        setState("cooldown");
        setMessage(body.message || "Your last little love note is still travelling. ♡");
      } else if (!response.ok) {
        throw new Error(body.message);
      } else {
        setState("sent");
        setMessage("delivered ♡");
      }
    } catch {
      setState("error");
      setMessage("Couldn’t send your love just yet. Try again in a moment. ❤️");
    }
  }

  return (
    <aside className="paper-card" style={{ marginTop: 40, padding: "22px 20px", textAlign: "center" }}>
      {latestReturn && (
        <p style={{ margin: "0 0 14px", color: "var(--berry-dark)" }}>
          💗 He sent some love back <time dateTime={latestReturn}>{latestReturnLabel}</time>
        </p>
      )}
      <button onClick={sendLove} disabled={state === "sending" || state === "sent"} className="button secondary" style={{ minWidth: 190 }}>
        <span className={state === "sending" || state === "sent" ? "heart-beat" : ""} aria-hidden style={{ color: "var(--berry)", fontSize: 28 }}>
          {state === "sent" ? "💗" : "♡"}
        </span>
        {state === "idle" ? "send me some love" : state === "sending" ? "on its way…" : state === "sent" ? "delivered" : "send again"}
      </button>
      <p className="status" role="status" aria-live="polite" style={{ margin: "10px 0 0" }}>{message}</p>
    </aside>
  );
}
