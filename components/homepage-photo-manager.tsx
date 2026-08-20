"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  moveHomepagePhoto,
  removeHomepagePhoto,
  uploadHomepagePhoto,
  type ManageState,
} from "@/app/(private)/manage/actions";
import type { HomepagePhoto } from "@/lib/types";

export function HomepagePhotoManager({ photos }: { photos: HomepagePhoto[] }) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadHomepagePhoto, { message: "" });
  const [manageState, setManageState] = useState<ManageState>({ message: "" });
  const [selected, setSelected] = useState<HomepagePhoto | null>(null);
  const [pending, startTransition] = useTransition();
  const uploadForm = useRef<HTMLFormElement>(null);
  const removeDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => { if (uploadState.ok) uploadForm.current?.reset(); }, [uploadState.ok]);

  function move(id: string, direction: "up" | "down") {
    startTransition(async () => setManageState(await moveHomepagePhoto(id, direction)));
  }

  function askToRemove(photo: HomepagePhoto) {
    setSelected(photo);
    removeDialog.current?.showModal();
  }

  function remove() {
    if (!selected) return;
    startTransition(async () => {
      setManageState(await removeHomepagePhoto(selected.id));
      removeDialog.current?.close();
      setSelected(null);
    });
  }

  return (
    <section className="paper-card" style={{ marginTop: 30, padding: "clamp(22px, 6vw, 34px)" }}>
      <p className="eyebrow">homepage photographs</p>
      <h2 className="serif" style={{ margin: "8px 0", fontSize: 32, fontWeight: 500 }}>the little gallery at the top</h2>
      <p className="muted" style={{ lineHeight: 1.6 }}>choose a few photographs that feel like home. the first one here appears first.</p>

      <form ref={uploadForm} action={uploadAction} style={{ display: "grid", gap: 14, marginTop: 22 }}>
        <label className="field"><span>photograph</span><input className="input" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic" required /></label>
        <label className="field"><span>alt text</span><input className="input" name="altText" maxLength={240} placeholder="us by the water on a cloudy afternoon" required /><small className="muted">describe what is visible for someone who cannot see the photograph.</small></label>
        <label className="field"><span>caption <small>(optional)</small></span><input className="input" name="caption" maxLength={240} placeholder="one of my favourite days" /></label>
        <button className="button small" disabled={uploading}>{uploading ? "keeping this safe…" : "add photograph"}</button>
        <p className="status" role="status" aria-live="polite">{uploadState.message}</p>
      </form>

      <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
        {photos.map((photo, index) => (
          <article key={photo.id} className="photo-manage-row">
            {/* eslint-disable-next-line @next/next/no-img-element -- private signed URLs are short-lived. */}
            <img src={photo.signed_url} alt={photo.alt_text} />
            <div style={{ minWidth: 0 }}><strong>{photo.caption || photo.alt_text}</strong><small className="muted" style={{ display: "block", marginTop: 4 }}>position {index + 1}</small></div>
            <div className="photo-manage-actions">
              <button type="button" onClick={() => move(photo.id, "up")} disabled={pending || index === 0} aria-label={`move ${photo.caption || "photograph"} earlier`}>↑</button>
              <button type="button" onClick={() => move(photo.id, "down")} disabled={pending || index === photos.length - 1} aria-label={`move ${photo.caption || "photograph"} later`}>↓</button>
              <button type="button" className="remove" onClick={() => askToRemove(photo)} disabled={pending} aria-label={`remove ${photo.caption || "photograph"}`}>remove</button>
            </div>
          </article>
        ))}
        {!photos.length && <p className="muted" style={{ margin: 0 }}>no homepage photographs yet—the page remains calm without one.</p>}
      </div>
      <p className="status" role="status" aria-live="polite">{manageState.message}</p>

      <dialog ref={removeDialog} className="confirm-dialog">
        <h2 className="serif">remove this photograph?</h2>
        <p className="muted">the private file and its caption will be permanently removed from the homepage.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
          <button className="button danger" type="button" onClick={remove} disabled={pending}>remove permanently</button>
          <button className="button secondary" type="button" onClick={() => removeDialog.current?.close()} disabled={pending}>keep it</button>
        </div>
      </dialog>
    </section>
  );
}
