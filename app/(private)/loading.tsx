export default function Loading() {
  return (
    <div className="narrow-shell" style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div><div aria-hidden className="heart-beat" style={{ fontSize: 40 }}>💌</div><p className="serif" style={{ fontSize: 22 }}>Finding your letters…</p></div>
    </div>
  );
}
