"use client";

import { useState } from "react";
import { Media } from "@/components/media";
import type { Memory } from "@/lib/types";

export function MemoryBox({ memories }: { memories: Memory[] }) {
  const [index, setIndex] = useState<number | null>(null);
  function pick() {
    if (!memories.length) return;
    if (memories.length === 1) return setIndex(0);
    let next = Math.floor(Math.random() * memories.length);
    if (next === index) next = (next + 1) % memories.length;
    setIndex(next);
  }
  const memory = index === null ? null : memories[index];
  return (
    <section style={{ textAlign: "center" }}>
      <button className="button" onClick={pick} disabled={!memories.length}>I just want a little piece of us</button>
      {!memories.length && <p className="muted">Your memory box is waiting for its first photograph or note.</p>}
      {memory && (
        <article className="paper-card fade-up" key={memory.id} style={{ marginTop: 30, padding: "clamp(22px, 7vw, 44px)", textAlign: "left" }}>
          <Media attachments={memory.attachments} />
          <p className="serif" style={{ whiteSpace: "pre-wrap", fontSize: 22, lineHeight: 1.7, margin: "28px 0 12px" }}>{memory.caption}</p>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {memory.memory_date && new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${memory.memory_date}T00:00:00Z`))}
            {memory.memory_date && memory.location_label && " · "}{memory.location_label}
          </p>
        </article>
      )}
    </section>
  );
}
