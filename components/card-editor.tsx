"use client";

import { useActionState, useState } from "react";
import { saveCard } from "@/app/(private)/create/actions";

type EditableCard = {
  id: string;
  recipient_id: string;
  title: string;
  subtitle: string | null;
  emoji: string;
  content: string;
  song_url: string | null;
  unlock_type: "immediate" | "date" | "mystery";
  unlock_at: string | null;
};

export function CardEditor({ card, recipients }: { card: EditableCard | null; recipients: { id: string; display_name: string }[] }) {
  const [state, action, pending] = useActionState(saveCard, { message: "" });
  const [title, setTitle] = useState(card?.title || "");
  const [subtitle, setSubtitle] = useState(card?.subtitle || "");
  const [emoji, setEmoji] = useState(card?.emoji || "💌");
  const [unlockType, setUnlockType] = useState(card?.unlock_type || "immediate");
  const localUnlockAt = card?.unlock_at ? new Date(new Date(card.unlock_at).getTime() - new Date(card.unlock_at).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";

  return (
    <div style={{ display: "grid", gap: 28, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", alignItems: "start" }}>
      <form action={action} className="paper-card" style={{ display: "grid", gap: 18, padding: "clamp(22px, 5vw, 34px)" }}>
        <input type="hidden" name="id" value={card?.id || ""} />
        <label className="field"><span>For</span><select className="input" name="recipientId" defaultValue={card?.recipient_id} required>{recipients.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
        <div style={{ display: "grid", gridTemplateColumns: "82px 1fr", gap: 12 }}>
          <label className="field"><span>Emoji</span><input className="input" name="emoji" maxLength={16} value={emoji} onChange={(event) => setEmoji(event.target.value)} required /></label>
          <label className="field"><span>Title</span><input className="input" name="title" maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Read me when…" required /></label>
        </div>
        <label className="field"><span>Short note on the front</span><input className="input" name="subtitle" maxLength={240} value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="Whenever you need a little piece of home." /></label>
        <label className="field"><span>Your letter</span><textarea className="input" name="content" maxLength={50_000} defaultValue={card?.content || ""} style={{ minHeight: 280 }} required /></label>
        <label className="field"><span>Song link <small>(optional)</small></span><input className="input" name="songUrl" type="url" pattern="https://.*" defaultValue={card?.song_url || ""} placeholder="https://…" /></label>
        <label className="field"><span>When can it open?</span><select className="input" name="unlockType" value={unlockType} onChange={(event) => setUnlockType(event.target.value as typeof unlockType)}><option value="immediate">Right away</option><option value="date">On a date</option><option value="mystery">Mystery until a date</option></select></label>
        {unlockType !== "immediate" && <label className="field"><span>Unlock date and time</span><input className="input" name="unlockAt" type="datetime-local" defaultValue={localUnlockAt} required /></label>}
        <label className="field"><span>Photos or audio</span><input className="input" name="files" type="file" accept="image/jpeg,image/png,image/webp,image/heic,audio/*" multiple /><small className="muted">Private, up to 10 MB each.</small></label>
        <button className="button" disabled={pending}>{pending ? "Saving your letter…" : card ? "Save changes" : "Seal this letter"}</button>
        <p className="status" role="status">{state.message}</p>
      </form>

      <aside style={{ position: "sticky", top: 86 }}>
        <p className="eyebrow">A peek at the front</p>
        <article className={`letter-card${unlockType !== "immediate" ? " locked" : ""}`} style={{ marginTop: 12, maxWidth: 360 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span className="letter-card-emoji">{unlockType === "mystery" ? "🔒" : emoji || "💌"}</span><span className="card-stamp">preview</span></div>
          <div><h3>{unlockType === "mystery" ? "???" : title || "Read me when…"}</h3><p>{unlockType === "mystery" ? "Not yet, impatient 😌" : subtitle || "Your note will appear here."}</p></div>
        </article>
      </aside>
    </div>
  );
}
