"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="narrow-shell" style={{ minHeight: "65vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div><div aria-hidden style={{ fontSize: 40 }}>💔</div><h1 className="serif" style={{ fontSize: 38, fontWeight: 500 }}>This page got a little lost between here and there.</h1><p className="muted">Nothing you left here has been lost.</p><button className="button secondary" onClick={reset}>Try finding it again</button></div>
    </div>
  );
}
