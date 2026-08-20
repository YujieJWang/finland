import type { Metadata } from "next";
import Link from "next/link";
import { DeleteLetterButton } from "@/components/delete-letter-button";
import { HomepagePhotoManager } from "@/components/homepage-photo-manager";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { HomepagePhoto } from "@/lib/types";

export const metadata: Metadata = { title: "Your letters" };

type ManagedCard = {
  id: string; title: string; emoji: string; opened_at: string | null; read_at: string | null;
  created_at: string; card_responses: { count: number }[]; attachments: { count: number }[];
};

export default async function ManagePage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase.from("cards").select("id,title,emoji,opened_at,read_at,created_at,card_responses(count),attachments(count)").eq("creator_id", viewer.id).order("created_at", { ascending: false });
  const cards = (data || []) as ManagedCard[];
  const { saved, deleted } = await searchParams;
  const { data: photoRows } = viewer.role === "creator"
    ? await supabase.from("homepage_photos").select("id,storage_path,caption,alt_text").order("position").order("created_at")
    : { data: [] };
  const signedPhotos = await Promise.all((photoRows || []).map(async (photo) => {
    const { data: signed } = await supabase.storage.from("private-media").createSignedUrl(photo.storage_path, 3600);
    return signed?.signedUrl
      ? { id: photo.id, caption: photo.caption, alt_text: photo.alt_text, signed_url: signed.signedUrl }
      : null;
  }));
  const photos = signedPhotos.filter((photo): photo is HomepagePhoto => photo !== null);

  return (
    <div className="narrow-shell" style={{ paddingBlock: "42px 72px" }}>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 20 }}>
        <div><p className="eyebrow">From you</p><h1 className="serif" style={{ fontSize: "clamp(42px, 10vw, 60px)", margin: "8px 0 0", fontWeight: 500 }}>Your letters</h1></div>
        <Link className="button small" href="/create">＋ Leave one</Link>
      </div>
      {saved && <p className="status" role="status" style={{ marginTop: 20 }}>Your letter is tucked away safely. ♡</p>}
      {deleted && <p className="status" role="status" style={{ marginTop: 20 }}>The letter and everything tucked inside it have been removed.</p>}
      {viewer.role === "creator" && <HomepagePhotoManager photos={photos} />}
      <div style={{ display: "grid", gap: 14, marginTop: 28 }}>
        {cards.length ? cards.map((card) => (
          <article className="paper-card" key={card.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 16, padding: 20 }}>
            <span style={{ fontSize: 30 }}>{card.emoji}</span>
            <div><h2 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>{card.title}</h2><p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>{card.read_at ? `Read ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(card.read_at))}` : card.opened_at ? `Opened ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(card.opened_at))}` : "Still waiting to be opened"} · {card.card_responses[0]?.count || 0} responses</p></div>
            <div style={{ display: "grid", justifyItems: "end", gap: 7 }}>
              <Link className="button secondary small" href={`/create?id=${card.id}`}>Edit</Link>
              <DeleteLetterButton cardId={card.id} title={card.title} responseCount={card.card_responses[0]?.count || 0} attachmentCount={card.attachments[0]?.count || 0} />
            </div>
          </article>
        )) : <div className="paper-card" style={{ padding: 28, textAlign: "center" }}>No letters from you yet. The first one can be simple.</div>}
      </div>
    </div>
  );
}
