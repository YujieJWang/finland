"use client";

import { useEffect, useState } from "react";

type State = "idle" | "sending" | "sent" | "error";

export function LoveButton({ latestReturn, initialCount }: { latestReturn: string | null; initialCount: number }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [count, setCount] = useState(initialCount);
  const [latestReturnLabel, setLatestReturnLabel] = useState("recently");

  useEffect(() => {
    if (!latestReturn) return;
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const update = () => {
      const diffMs = Date.now() - new Date(latestReturn).getTime();
      const diffMin = Math.round(diffMs / 60_000);
      let label: string;
      if (diffMin < 60) {
        label = rtf.format(-Math.max(1, diffMin), "minute");
      } else if (diffMin < 1440) {
        label = rtf.format(-Math.round(diffMin / 60), "hour");
      } else {
        label = rtf.format(-Math.round(diffMin / 1440), "day");
      }
      setLatestReturnLabel(label);
    };
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [latestReturn]);

  async function sendLove() {
    setState("sending");
    setMessage("sending…");
    try {
      const response = await fetch("/api/thinking-of-you", { method: "POST" });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(body.message);
      } else {
        setState("sent");
        setMessage("delivered ♡");
        setCount((c) => c + 1);
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
      <button onClick={sendLove} disabled={state === "sending"} className="button secondary" style={{ minWidth: 190 }}>
        <span className={state === "sending" || state === "sent" ? "heart-beat" : ""} aria-hidden style={{ color: "var(--berry)", fontSize: 28 }}>
          {state === "sent" ? "💗" : "♡"}
        </span>
        {state === "idle" ? "send me some love" : state === "sending" ? "on its way…" : "send again"}
      </button>
      <p className="status" role="status" aria-live="polite" style={{ margin: "10px 0 0" }}>{message}</p>
      <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
        {count} little {count === 1 ? "reminder" : "reminders"} sent across the distance <span aria-hidden>❤️</span>
      </p>
    </aside>
  );
}
