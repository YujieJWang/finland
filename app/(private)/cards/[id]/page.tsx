import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardOpenTracker } from "@/components/card-open-tracker";
import { MarkReadButton } from "@/components/mark-read-button";
import { Media } from "@/components/media";
import { ResponseForm } from "@/components/response-form";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Attachment, Card } from "@/lib/types";

export const metadata: Metadata = { title: "A letter for you" };

async function signed(supabase: Awaited<ReturnType<typeof createClient>>, items: Attachment[]) {
  return Promise.all(items.map(async (item) => {
    const { data } = await supabase.storage.from("private-media").createSignedUrl(item.storage_path, 3600);
    return { ...item, signed_url: data?.signedUrl };
  }));
}

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase
    .from("cards")
    .select("*, attachments!attachments_card_id_fkey(*), card_responses(*, attachments!attachments_response_id_fkey(*))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const raw = data as Card & { attachments: (Attachment & { response_id?: string | null })[] };
  raw.attachments = await signed(
    supabase,
    (raw.attachments as (Attachment & { response_id?: string | null })[]).filter((item) => !item.response_id),
  );
  raw.card_responses = await Promise.all((raw.card_responses || []).map(async (response) => ({
    ...response,
    attachments: await signed(supabase, response.attachments || []),
  })));
  const isRecipient = raw.recipient_id === viewer.id;

  return (
    <div className="narrow-shell fade-up" style={{ paddingBlock: "28px 72px" }}>
      <Link href="/" className="muted" style={{ display: "inline-flex", minHeight: 44, alignItems: "center" }}>← Back to your letters</Link>
      {isRecipient && <CardOpenTracker cardId={raw.id} />}
      <article className="paper-card" style={{ marginTop: 14, padding: "clamp(24px, 8vw, 58px)" }}>
        <div aria-hidden style={{ fontSize: 46 }}>{raw.emoji}</div>
        <p className="eyebrow" style={{ marginTop: 26 }}>{new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(raw.created_at))}</p>
        <h1 className="serif" style={{ fontSize: "clamp(38px, 10vw, 62px)", lineHeight: 1.02, fontWeight: 500, margin: "12px 0 14px" }}>{raw.title}</h1>
        {raw.subtitle && <p className="muted" style={{ fontSize: 17, lineHeight: 1.6 }}>{raw.subtitle}</p>}
        <div style={{ height: 1, background: "var(--line)", marginBlock: "32px" }} />
        <div className="letter-body">{raw.content}</div>
        {raw.song_url && <p style={{ marginTop: 28 }}><a href={raw.song_url} target="_blank" rel="noreferrer" style={{ color: "var(--berry)", fontWeight: 700 }}>♫ Listen to the song I left with this</a></p>}
        <div style={{ marginTop: 36 }}><Media attachments={raw.attachments} /></div>
        {isRecipient && <div style={{ marginTop: 38 }}><MarkReadButton cardId={raw.id} readAt={raw.read_at} /></div>}
      </article>

      <section style={{ marginTop: 46 }}>
        <p className="eyebrow">Our side of the page</p>
        <h2 className="serif" style={{ margin: "9px 0 22px", fontSize: "clamp(31px, 8vw, 44px)", fontWeight: 500 }}>Leave something here for us</h2>
        <div className="paper-card" style={{ padding: "clamp(22px, 6vw, 34px)" }}><ResponseForm cardId={raw.id} /></div>
      </section>

      {raw.card_responses.length > 0 && (
        <section aria-label="Things we left here" style={{ display: "grid", gap: 28, marginTop: 42 }}>
          {raw.card_responses.map((response, index) => (
            <article key={response.id} className="paper-card" style={{ padding: "clamp(22px, 6vw, 36px)", transform: `rotate(${index % 2 ? ".25" : "-.2"}deg)` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <span style={{ fontSize: 30 }} aria-label={response.mood ? `Feeling ${response.mood}` : "A note"}>{response.mood || "💌"}</span>
                <time className="muted" style={{ fontSize: 13 }}>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(response.created_at))}</time>
              </div>
              {response.message && <p className="serif" style={{ whiteSpace: "pre-wrap", fontSize: 20, lineHeight: 1.75, marginBlock: 20 }}>{response.message}</p>}
              <Media attachments={response.attachments} />
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
