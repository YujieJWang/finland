"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { fileKind, safeFileName } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export type MemoryState = { message: string; ok?: boolean };

export async function saveMemory(_: MemoryState, formData: FormData): Promise<MemoryState> {
  const input = z.object({
    caption: z.string().trim().min(1).max(2000),
    date: z.string().or(z.literal("")),
    location: z.string().trim().max(120),
  }).safeParse({ caption: formData.get("caption"), date: formData.get("date") || "", location: formData.get("location") || "" });
  if (!input.success) return { message: "Add a short caption before keeping this memory." };
  const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const { data: memory, error } = await supabase.from("memories").insert({
      creator_id: viewer.id,
      caption: input.data.caption,
      memory_date: input.data.date || null,
      location_label: input.data.location || null,
    }).select("id").single();
    if (error || !memory) throw error || new Error("Memory was not saved.");
    for (const file of files) {
      const type = fileKind(file);
      const path = `${viewer.id}/memories/${memory.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("private-media").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: attachmentError } = await supabase.from("memory_attachments").insert({
        memory_id: memory.id,
        uploader_id: viewer.id,
        storage_path: path,
        type,
        alt_text: type === "image" ? "A photo from this memory" : null,
      });
      if (attachmentError) throw attachmentError;
    }
    revalidatePath("/memories");
    return { ok: true, message: "Added to your memory box. ♡" };
  } catch (error) {
    console.error("Memory save failed", error);
    return { message: error instanceof Error ? error.message : "This memory couldn’t be kept just yet." };
  }
}
