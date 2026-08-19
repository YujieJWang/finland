"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { fileKind, safeFileName } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export type ResponseState = { message: string; ok?: boolean };

export async function recordOpen(cardId: string) {
  const parsed = z.string().uuid().safeParse(cardId);
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.rpc("open_card", { target_id: parsed.data });
  revalidatePath(`/cards/${parsed.data}`);
  revalidatePath("/");
}

export async function markRead(cardId: string) {
  const parsed = z.string().uuid().safeParse(cardId);
  if (!parsed.success) throw new Error("That letter could not be found.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_card_read", { target_id: parsed.data });
  if (error) throw new Error("Only the person this letter is for can mark it as read.");
  revalidatePath(`/cards/${parsed.data}`);
  revalidatePath("/");
}

export async function saveResponse(
  cardId: string,
  _: ResponseState,
  formData: FormData,
): Promise<ResponseState> {
  const input = z.object({
    cardId: z.string().uuid(),
    message: z.string().trim().max(10_000),
    mood: z.enum(["🥺", "😭", "🙂", "🥰", "❤️"]).or(z.literal("")),
  }).safeParse({ cardId, message: formData.get("message") || "", mood: formData.get("mood") || "" });
  if (!input.success) return { message: "That note is a little too long or couldn’t be understood." };

  const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
  if (!input.data.message && !input.data.mood && !files.length) {
    return { message: "Leave a note, a feeling, or something from your camera roll." };
  }

  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const { data: response, error } = await supabase.from("card_responses").insert({
      card_id: input.data.cardId,
      user_id: viewer.id,
      message: input.data.message || null,
      mood: input.data.mood || null,
    }).select("id").single();
    if (error || !response) throw error || new Error("Response was not saved.");

    for (const file of files) {
      const type = fileKind(file);
      const path = `${viewer.id}/cards/${input.data.cardId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("private-media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: attachmentError } = await supabase.from("attachments").insert({
        card_id: input.data.cardId,
        response_id: response.id,
        uploader_id: viewer.id,
        storage_path: path,
        type,
        alt_text: type === "image" ? "A photo left with this response" : null,
      });
      if (attachmentError) throw attachmentError;
    }

    revalidatePath(`/cards/${input.data.cardId}`);
    revalidatePath("/finland");
    return { ok: true, message: "Kept safely here for both of you. ♡" };
  } catch (error) {
    console.error("Response save failed", error);
    return { message: error instanceof Error ? error.message : "This couldn’t be tucked away just yet." };
  }
}
