import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your letters" };

type ManagedCard = {
  id: string; title: string; emoji: string; opened_at: string | null; read_at: string | null;
  created_at: string; card_responses: { count: number }[];
};

export default async function ManagePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase.from("cards").select("id,title,emoji,opened_at,read_at,created_at,card_responses(count)").eq("creator_id", viewer.id).order("created_at", { ascending: false });
  const cards = (data || []) as ManagedCard[];
  const saved = (await searchParams).saved;

  return (
    <div className="narrow-shell" style={{ paddingBlock: "42px 72px" }}>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 20 }}>
        <div><p className="eyebrow">From you</p><h1 className="serif" style={{ fontSize: "clamp(42px, 10vw, 60px)", margin: "8px 0 0", fontWeight: 500 }}>Your letters</h1></div>
        <Link className="button small" href="/create">＋ Leave one</Link>
      </div>
      {saved && <p className="status" role="status" style={{ marginTop: 20 }}>Your letter is tucked away safely. ♡</p>}
      <div style={{ display: "grid", gap: 14, marginTop: 28 }}>
        {cards.length ? cards.map((card) => (
          <article className="paper-card" key={card.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 16, padding: 20 }}>
            <span style={{ fontSize: 30 }}>{card.emoji}</span>
            <div><h2 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>{card.title}</h2><p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>{card.read_at ? `Read ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(card.read_at))}` : card.opened_at ? `Opened ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(card.opened_at))}` : "Still waiting to be opened"} · {card.card_responses[0]?.count || 0} responses</p></div>
            <Link className="button secondary small" href={`/create?id=${card.id}`}>Edit</Link>
          </article>
        )) : <div className="paper-card" style={{ padding: 28, textAlign: "center" }}>No letters from you yet. The first one can be simple.</div>}
      </div>
    </div>
  );
}
