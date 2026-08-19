"use client";

import { useTransition } from "react";
import { markRead } from "@/app/(private)/cards/actions";

export function MarkReadButton({ cardId, readAt }: { cardId: string; readAt: string | null }) {
  const [pending, startTransition] = useTransition();
  if (readAt) return <p style={{ color: "var(--sage)", fontWeight: 800 }}>✓ Kept close on {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(readAt))}</p>;
  return (
    <button className="button secondary" disabled={pending} onClick={() => startTransition(() => markRead(cardId))}>
      {pending ? "Tucking it away…" : "✓ Mark as read"}
    </button>
  );
}
