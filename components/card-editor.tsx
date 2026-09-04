"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { saveCard } from "@/app/(private)/create/actions";
import { Media } from "@/components/media";
import { siteConfig } from "@/config/site";
import { zonedDateTime } from "@/lib/domain";
import type { Attachment } from "@/lib/types";

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
  attachments: Attachment[];
};

export function CardEditor({
  card,
  recipients,
}: {
  card: EditableCard | null;
  recipients: { id: string; display_name: string }[];
}) {
  const [state, action, pending] = useActionState(saveCard, { message: "" });
  const [title, setTitle] = useState(card?.title || "");
  const [subtitle, setSubtitle] = useState(card?.subtitle || "");
  const [emoji, setEmoji] = useState(card?.emoji || "💌");
  const [content, setContent] = useState(card?.content || "");
  const [songUrl, setSongUrl] = useState(card?.song_url || "");
  const [files, setFiles] = useState<File[]>([]);
  const [unlockType, setUnlockType] = useState(
    card?.unlock_type || "immediate",
  );
  const [unlockAt, setUnlockAt] = useState(
    card?.unlock_at
      ? zonedDateTime(card.unlock_at, siteConfig.people.finland.timezone)
      : "",
  );
  const preview = useRef<HTMLDialogElement>(null);
  const selectedAttachments = useMemo<Attachment[]>(
    () => files.map((file, index) => ({
      id: `selected-${index}`,
      storage_path: "",
      type: file.type.startsWith("image/") ? "image" : "audio",
      alt_text: file.type.startsWith("image/") ? `Photo attached to ${title}` : null,
      signed_url: URL.createObjectURL(file),
    })),
    [files, title],
  );
  useEffect(
    () => () => selectedAttachments.forEach(({ signed_url: url }) => url && URL.revokeObjectURL(url)),
    [selectedAttachments],
  );

  return (
    <div
      style={{
        display: "grid",
        gap: 28,
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
        alignItems: "start",
      }}
    >
      <form
        action={action}
        className="paper-card"
        style={{ display: "grid", gap: 18, padding: "clamp(22px, 5vw, 34px)" }}
      >
        <input type="hidden" name="id" value={card?.id || ""} />
        <label className="field">
          <span>For</span>
          <select
            className="input"
            name="recipientId"
            defaultValue={card?.recipient_id}
            required
          >
            {recipients.map((person) => (
              <option key={person.id} value={person.id}>
                {person.display_name}
              </option>
            ))}
          </select>
        </label>
        <div
          style={{ display: "grid", gridTemplateColumns: "82px 1fr", gap: 12 }}
        >
          <label className="field">
            <span>Emoji</span>
            <input
              className="input"
              name="emoji"
              maxLength={16}
              value={emoji}
              onChange={(event) => setEmoji(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Title</span>
            <input
              className="input"
              name="title"
              maxLength={140}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Read me when…"
              required
            />
          </label>
        </div>
        <label className="field">
          <span>Short note on the front</span>
          <input
            className="input"
            name="subtitle"
            maxLength={240}
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            placeholder="Whenever you need a little piece of home."
          />
        </label>
        <label className="field">
          <span>Your letter</span>
          <textarea
            className="input"
            name="content"
            maxLength={50_000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            style={{ minHeight: 280 }}
            required
          />
        </label>
        <label className="field">
          <span>
            Song link <small>(optional)</small>
          </span>
          <input
            className="input"
            name="songUrl"
            type="url"
            pattern="https://.*"
            value={songUrl}
            onChange={(event) => setSongUrl(event.target.value)}
            placeholder="https://…"
          />
        </label>
        <label className="field">
          <span>When can it open?</span>
          <select
            className="input"
            name="unlockType"
            value={unlockType}
            onChange={(event) =>
              setUnlockType(event.target.value as typeof unlockType)
            }
          >
            <option value="immediate">Right away</option>
            <option value="date">On a date</option>
            <option value="mystery">Mystery until a date</option>
          </select>
        </label>
        {unlockType !== "immediate" && (
          <label className="field">
            <span>Unlock date and time</span>
            <input
              className="input"
              name="unlockAt"
              type="datetime-local"
              value={unlockAt}
              onChange={(event) => setUnlockAt(event.target.value)}
              required
            />
            <small className="muted">Finland time</small>
          </label>
        )}
        <label className="field">
          <span>Photos or audio</span>
          <input
            className="input"
            name="files"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,audio/*"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
          />
          <small className="muted">Private, up to 10 MB each.</small>
        </label>
        {card?.attachments.length ? (
          <div>
            <p className="muted" style={{ fontSize: 13 }}>Already attached</p>
            <Media attachments={card.attachments} />
          </div>
        ) : null}
        <button className="button secondary" type="button" onClick={() => preview.current?.showModal()}>
          Preview as her
        </button>
        <button className="button" disabled={pending}>
          {pending
            ? "Saving your letter…"
            : card
              ? "Save changes"
              : "Seal this letter"}
        </button>
        <p className="status" role="status">
          {state.message}
        </p>
      </form>

      <aside style={{ position: "sticky", top: 86 }}>
        <p className="eyebrow">A peek at the front</p>
        <article
          className={`letter-card${unlockType !== "immediate" ? " locked" : ""}`}
          style={{ marginTop: 12, maxWidth: 360 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="letter-card-emoji">
              {unlockType === "mystery" ? "🔒" : emoji || "💌"}
            </span>
            <span className="card-stamp">preview</span>
          </div>
          <div>
            <h3>
              {unlockType === "mystery" ? "???" : title || "Read me when…"}
            </h3>
            <p>
              {unlockType === "mystery"
                ? "Not yet, be patient babe 😌"
                : subtitle || "Your note will appear here."}
            </p>
          </div>
        </article>
      </aside>

      <dialog ref={preview} className="letter-preview-dialog">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <p className="eyebrow">Preview as her</p>
          <button className="button secondary small" type="button" onClick={() => preview.current?.close()}>Close</button>
        </div>
        <article className="paper-card" style={{ marginTop: 14, padding: "clamp(24px, 8vw, 58px)" }}>
          <div aria-hidden style={{ fontSize: 46 }}>{emoji || "💌"}</div>
          <h1 className="serif" style={{ fontSize: "clamp(38px, 10vw, 62px)", lineHeight: 1.02, fontWeight: 500, margin: "26px 0 14px" }}>{title || "Read me when…"}</h1>
          {subtitle && <p className="muted" style={{ fontSize: 17, lineHeight: 1.6 }}>{subtitle}</p>}
          <div style={{ height: 1, background: "var(--line)", marginBlock: 32 }} />
          <div className="letter-body">{content || "Your letter will appear here."}</div>
          {songUrl.startsWith("https://") && <p style={{ marginTop: 28 }}><a href={songUrl} target="_blank" rel="noreferrer" style={{ color: "var(--berry)", fontWeight: 700 }}>♫ Listen to the song I left with this</a></p>}
          <div style={{ marginTop: 36 }}><Media attachments={[...(card?.attachments || []), ...selectedAttachments]} /></div>
        </article>
      </dialog>
    </div>
  );
}
