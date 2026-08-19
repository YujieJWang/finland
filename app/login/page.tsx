import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Come in" };

export default async function LoginPage() {
  const configured = hasSupabaseEnv();
  if (configured && (await getViewer())) redirect("/");

  return (
    <main className="narrow-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", paddingBlock: 40 }}>
      <section className="paper-card fade-up" style={{ width: "min(100%, 470px)", padding: "clamp(28px, 8vw, 52px)" }}>
        <div aria-hidden style={{ fontSize: 42, marginBottom: 22 }}>💌</div>
        <p className="eyebrow">Just for us</p>
        <h1 className="serif" style={{ fontSize: "clamp(38px, 10vw, 58px)", fontWeight: 500, lineHeight: 1.02, margin: "12px 0 18px" }}>
          A little place between here and there.
        </h1>
        <p className="muted" style={{ lineHeight: 1.7, marginBottom: 28 }}>
          Use the email address that was invited. We’ll send you a private way in—no password to remember.
        </p>
        {configured ? (
          <LoginForm />
        ) : (
          <div className="status" role="alert">
            This app is ready for its Supabase keys. Copy <code>.env.example</code> to <code>.env.local</code> to begin.
          </div>
        )}
      </section>
    </main>
  );
}
