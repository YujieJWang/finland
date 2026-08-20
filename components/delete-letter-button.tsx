"use client";

import { useActionState, useRef } from "react";
import { deleteCard } from "@/app/(private)/manage/actions";

export function DeleteLetterButton({
  cardId,
  title,
  responseCount,
  attachmentCount,
}: {
  cardId: string;
  title: string;
  responseCount: number;
  attachmentCount: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(deleteCard.bind(null, cardId), { message: "" });

  return (
    <>
      <button className="danger-link" type="button" onClick={() => dialog.current?.showModal()}>
        delete letter
      </button>
      <dialog ref={dialog} className="confirm-dialog">
        <div aria-hidden style={{ fontSize: 34 }}>🕯️</div>
        <h2 className="serif">delete “{title}”?</h2>
        <p className="muted">
          this permanently removes the letter, {responseCount} {responseCount === 1 ? "response" : "responses"}, and {attachmentCount} private {attachmentCount === 1 ? "attachment" : "attachments"}. this cannot be undone.
        </p>
        <form action={action} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
          <button className="button danger" disabled={pending}>{pending ? "removing everything…" : "yes, delete permanently"}</button>
          <button className="button secondary" type="button" onClick={() => dialog.current?.close()} disabled={pending}>keep the letter</button>
        </form>
        <p className="status" role="status" aria-live="polite">{state.message}</p>
      </dialog>
    </>
  );
}
