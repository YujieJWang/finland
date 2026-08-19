import Link from "next/link";

export default function CardNotFound() {
  return (
    <div className="narrow-shell" style={{ paddingBlock: 80, textAlign: "center" }}>
      <div aria-hidden style={{ fontSize: 48 }}>🔒</div>
      <h1 className="serif" style={{ fontSize: 42, fontWeight: 500 }}>This one isn’t ready to be opened.</h1>
      <p className="muted">Some letters are worth waiting for.</p>
      <Link className="button secondary" href="/" style={{ marginTop: 20 }}>Back to the letter box</Link>
    </div>
  );
}
