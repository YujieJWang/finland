"use client";

import { useActionState } from "react";
import { requestMagicLink } from "@/app/login/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(requestMagicLink, { message: "" });
  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      <label className="field">
        <span>Your email</span>
        <input className="input" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </label>
      <button className="button" disabled={pending}>
        {pending ? "Sending your way in…" : "Send me a magic link"}
      </button>
      <p className="status" role="status" aria-live="polite">{state.message}</p>
    </form>
  );
}
