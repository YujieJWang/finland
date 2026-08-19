import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardEditor } from "@/components/card-editor";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Leave a letter" };

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: recipients } = await supabase.from("profiles").select("id,display_name").neq("id", viewer.id);
  const cardResult = id
    ? await supabase.from("cards").select("id,recipient_id,title,subtitle,emoji,content,song_url,unlock_type,unlock_at").eq("id", id).eq("creator_id", viewer.id).maybeSingle()
    : { data: null };
  if (id && !cardResult.data) notFound();

  return (
    <div className="page-shell" style={{ paddingBlock: "32px 72px" }}>
      <Link href="/manage" className="muted">← Your letters</Link>
      <header style={{ margin: "24px 0 30px" }}>
        <p className="eyebrow">A little something for later</p>
        <h1 className="serif" style={{ margin: "8px 0", fontSize: "clamp(40px, 10vw, 64px)", fontWeight: 500 }}>{id ? "Tend to this letter" : "Leave one for them"}</h1>
        <p className="muted">Write it now. Let it be found exactly when it’s needed.</p>
      </header>
      <CardEditor card={cardResult.data as Parameters<typeof CardEditor>[0]["card"]} recipients={(recipients || []) as { id: string; display_name: string }[]} />
    </div>
  );
}
