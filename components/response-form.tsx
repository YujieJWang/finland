"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveResponse } from "@/app/(private)/cards/actions";
import { VoiceRecorder } from "@/components/voice-recorder";

const moods = ["🥺", "😭", "🙂", "🥰", "❤️"] as const;

export function ResponseForm({ cardId }: { cardId: string }) {
  const [state, action, pending] = useActionState(saveResponse.bind(null, cardId), { message: "" });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state.ok]);

  return (
    <form ref={form} action={action} style={{ display: "grid", gap: 18 }}>
      <label className="field">
        <span>Your note</span>
        <textarea className="input" name="message" maxLength={10_000} placeholder="Leave a little something for the two of you…" />
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="muted" style={{ fontSize: 14, fontWeight: 700, marginBottom: 9 }}>How are you feeling?</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {moods.map((mood) => (
            <label key={mood} style={{ cursor: "pointer" }}>
              <input className="sr-only peer" type="radio" name="mood" value={mood} />
              <span style={{ display: "grid", width: 48, height: 48, placeItems: "center", border: "1px solid var(--line)", borderRadius: 14, background: "rgba(255,255,255,.55)", fontSize: 23 }}>{mood}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>Photos or audio</span>
        <input className="input" name="files" type="file" accept="image/jpeg,image/png,image/webp,image/heic,audio/*" multiple />
        <small className="muted">Up to 10 MB each. Photos and audio stay private.</small>
      </label>
      <VoiceRecorder />
      <button className="button" disabled={pending}>{pending ? "Keeping this safe…" : "Leave this here for us"}</button>
      <p className="status" role="status" aria-live="polite">{state.message}</p>
    </form>
  );
}
