import type { Metadata } from "next";
import { MemoryBox } from "@/components/memory-box";
import { MemoryForm } from "@/components/memory-form";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Attachment, Memory } from "@/lib/types";

export const metadata: Metadata = { title: "Our memory box" };

export default async function MemoriesPage() {
  await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase.from("memories").select("*, attachments:memory_attachments(*)").order("memory_date", { ascending: false, nullsFirst: false });
  const memories = await Promise.all(((data || []) as Memory[]).map(async (memory) => ({
    ...memory,
    attachments: await Promise.all((memory.attachments || []).map(async (item: Attachment) => {
      const { data: signed } = await supabase.storage.from("private-media").createSignedUrl(item.storage_path, 3600);
      return { ...item, signed_url: signed?.signedUrl };
    })),
  })));
  return (
    <div className="narrow-shell" style={{ paddingBlock: "48px 72px" }}>
      <header style={{ textAlign: "center", marginBottom: 34 }}>
        <div aria-hidden style={{ fontSize: 42 }}>📦</div>
        <p className="eyebrow" style={{ marginTop: 18 }}>Pull one out whenever you need it</p>
        <h1 className="serif" style={{ fontSize: "clamp(43px, 11vw, 67px)", lineHeight: 1, fontWeight: 500, margin: "10px 0" }}>Our memory box</h1>
      </header>
      <MemoryBox memories={memories} />
      <MemoryForm />
    </div>
  );
}
