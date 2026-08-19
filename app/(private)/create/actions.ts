"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { fileKind, safeFileName } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export type CardState = { message: string };

const schema = z.object({
  id: z.string().uuid().or(z.literal("")),
  recipientId: z.string().uuid(),
  title: z.string().trim().min(1).max(140),
  subtitle: z.string().trim().max(240),
  emoji: z.string().trim().min(1).max(16),
  content: z.string().trim().min(1).max(50_000),
  songUrl: z.string().trim().url().refine((url) => url.startsWith("https://")).or(z.literal("")),
  unlockType: z.enum(["immediate", "date", "mystery"]),
  unlockAt: z.string(),
});

export async function saveCard(_: CardState, formData: FormData): Promise<CardState> {
  const parsed = schema.safeParse({
    id: formData.get("id") || "",
    recipientId: formData.get("recipientId"),
    title: formData.get("title"),
    subtitle: formData.get("subtitle") || "",
    emoji: formData.get("emoji") || "💌",
    content: formData.get("content"),
    songUrl: formData.get("songUrl") || "",
    unlockType: formData.get("unlockType"),
    unlockAt: formData.get("unlockAt") || "",
  });
  if (!parsed.success) return { message: "Check the title, letter, recipient, and any link before saving." };
  if (parsed.data.unlockType !== "immediate" && !parsed.data.unlockAt) {
    return { message: "Choose when this locked letter should open." };
  }

  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const values = {
      recipient_id: parsed.data.recipientId,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      emoji: parsed.data.emoji,
      content: parsed.data.content,
      song_url: parsed.data.songUrl || null,
      unlock_type: parsed.data.unlockType,
      unlock_at: parsed.data.unlockType === "immediate" ? null : new Date(parsed.data.unlockAt).toISOString(),
    };

    const result = parsed.data.id
      ? await supabase.from("cards").update(values).eq("id", parsed.data.id).eq("creator_id", viewer.id).select("id").single()
      : await supabase.from("cards").insert({ ...values, creator_id: viewer.id }).select("id").single();
    if (result.error || !result.data) throw result.error || new Error("Letter was not saved.");

    const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    for (const file of files) {
      const type = fileKind(file);
      const path = `${viewer.id}/cards/${result.data.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("private-media").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: attachmentError } = await supabase.from("attachments").insert({
        card_id: result.data.id,
        uploader_id: viewer.id,
        storage_path: path,
        type,
        alt_text: type === "image" ? `Photo attached to ${parsed.data.title}` : null,
      });
      if (attachmentError) throw attachmentError;
    }
  } catch (error) {
    console.error("Card save failed", error);
    return { message: error instanceof Error ? error.message : "This letter couldn’t be saved just yet." };
  }

  revalidatePath("/");
  revalidatePath("/manage");
  redirect("/manage?saved=1");
}
