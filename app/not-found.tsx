import Link from "next/link";

export default function NotFound() {
  return (
    <main className="narrow-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div><div aria-hidden style={{ fontSize: 48 }}>✉️</div><h1 className="serif" style={{ fontSize: 44, fontWeight: 500 }}>No letter at this address.</h1><Link className="button secondary" href="/">Back home</Link></div>
    </main>
  );
}
