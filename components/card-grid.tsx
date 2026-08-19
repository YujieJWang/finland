import Link from "next/link";
import type { CardPreview } from "@/lib/types";

function unlockLabel(card: CardPreview) {
  if (!card.is_locked) return card.read_at ? "kept close" : card.opened_at ? "opened" : card.is_mine ? "from you" : "waiting for you";
  if (card.unlock_type === "mystery") return "a little secret";
  return card.unlock_at
    ? `opens ${new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "Europe/Helsinki" }).format(new Date(card.unlock_at))}`
    : "not just yet";
}

function CardInner({ card }: { card: CardPreview }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span className="letter-card-emoji" aria-hidden>{card.emoji}</span>
        <span className="card-stamp">{unlockLabel(card)}</span>
      </div>
      <div>
        <h3>{card.title}</h3>
        <p>{card.subtitle || (card.is_mine ? `For ${card.creator_name === "You" ? "her" : "them"}` : `From ${card.creator_name}`)}</p>
      </div>
    </>
  );
}

export function CardGrid({ cards }: { cards: CardPreview[] }) {
  if (!cards.length) {
    return (
      <div className="paper-card" style={{ padding: 28, textAlign: "center" }}>
        <div aria-hidden style={{ fontSize: 36 }}>✉️</div>
        <p className="serif" style={{ fontSize: 22, margin: "12px 0 6px" }}>The letter box is quiet for now.</p>
        <Link href="/create" style={{ color: "var(--berry)", fontWeight: 700 }}>Leave the first one</Link>
      </div>
    );
  }
  return (
    <div className="card-grid">
      {cards.map((card) => {
        const className = `letter-card${card.is_locked ? " locked" : ""}${card.opened_at ? " opened" : ""}`;
        return card.is_locked ? (
          <article className={className} key={card.id} aria-label={`${card.title}, locked`}><CardInner card={card} /></article>
        ) : (
          <Link className={className} href={`/cards/${card.id}`} key={card.id}><CardInner card={card} /></Link>
        );
      })}
    </div>
  );
}
