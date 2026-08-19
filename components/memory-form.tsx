"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveMemory } from "@/app/(private)/memories/actions";

export function MemoryForm() {
  const [state, action, pending] = useActionState(saveMemory, { message: "" });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state.ok]);
  return (
    <details className="paper-card" style={{ marginTop: 42, padding: "20px clamp(18px, 5vw, 30px)" }}>
      <summary style={{ cursor: "pointer", fontWeight: 800, minHeight: 44, paddingTop: 10 }}>＋ Add something to the memory box</summary>
      <form ref={form} action={action} style={{ display: "grid", gap: 16, paddingBlock: 20 }}>
        <label className="field"><span>What do you want to remember?</span><textarea className="input" name="caption" maxLength={2000} required /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="field"><span>Date</span><input className="input" name="date" type="date" /></label>
          <label className="field"><span>Place</span><input className="input" name="location" maxLength={120} placeholder="Helsinki" /></label>
        </div>
        <label className="field"><span>Photo or audio</span><input className="input" name="files" type="file" accept="image/jpeg,image/png,image/webp,image/heic,audio/*" multiple /></label>
        <button className="button" disabled={pending}>{pending ? "Keeping it…" : "Add to the box"}</button>
        <p className="status" role="status">{state.message}</p>
      </form>
    </details>
  );
}
