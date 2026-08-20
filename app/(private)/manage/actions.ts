"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { canDeleteCard, fileKind, safeFileName } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ManageState = { message: string; ok?: boolean };

export async function deleteCard(
  cardId: string,
  previousState: ManageState,
  formData: FormData,
): Promise<ManageState> {
  void previousState;
  void formData;
  const parsed = z.string().uuid().safeParse(cardId);
  if (!parsed.success) return { message: "This letter could not be found." };

  const viewer = await requireViewer();
  const supabase = await createClient();
  try {
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("creator_id,title")
      .eq("id", parsed.data)
      .maybeSingle();
    if (cardError) throw cardError;
    if (!card || !canDeleteCard(viewer.id, card.creator_id)) {
      return { message: "Only the person who wrote this letter can delete it." };
    }

    const { data: attachments, error: attachmentError } = await supabase
      .from("attachments")
      .select("storage_path")
      .eq("card_id", parsed.data);
    if (attachmentError) throw attachmentError;

    const paths = (attachments || []).map((attachment) => attachment.storage_path);
    if (paths.length) {
      const { error: storageError } = await createAdminClient().storage
        .from("private-media")
        .remove(paths);
      if (storageError) {
        console.error("Card media cleanup failed", storageError);
        return { message: "The letter is still here because some private keepsakes could not be removed. Please try again." };
      }
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("cards")
      .delete()
      .eq("id", parsed.data)
      .eq("creator_id", viewer.id)
      .select("id")
      .maybeSingle();
    if (deleteError || !deleted) {
      console.error("Card database deletion failed", deleteError);
      return { message: "The letter could not be fully removed. Its private media is gone; try deleting the letter once more." };
    }
  } catch (error) {
    console.error("Card deletion failed", error);
    return { message: "This letter could not be removed just yet. Nothing else was changed." };
  }

  revalidatePath("/");
  revalidatePath("/manage");
  revalidatePath("/finland");
  revalidatePath(`/cards/${parsed.data}`);
  redirect("/manage?deleted=1");
}

export async function uploadHomepagePhoto(
  _: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const viewer = await requireViewer();
  if (viewer.role !== "creator") return { message: "Only the creator can tend to the homepage photographs." };

  const input = z.object({
    caption: z.string().trim().max(240),
    altText: z.string().trim().min(1).max(240),
  }).safeParse({ caption: formData.get("caption") || "", altText: formData.get("altText") || "" });
  const file = formData.get("file");
  if (!input.success || !(file instanceof File) || !file.size) {
    return { message: "Choose a photograph and describe what is in it." };
  }

  try {
    if (fileKind(file) !== "image") return { message: "Homepage keepsakes need to be photographs." };
    const supabase = await createClient();
    const { data: last, error: orderError } = await supabase
      .from("homepage_photos")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderError) throw orderError;

    const path = `${viewer.id}/homepage/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("private-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase.from("homepage_photos").insert({
      uploader_id: viewer.id,
      storage_path: path,
      caption: input.data.caption || null,
      alt_text: input.data.altText,
      position: (last?.position ?? -1) + 1,
    });
    if (insertError) {
      await supabase.storage.from("private-media").remove([path]);
      throw insertError;
    }
    revalidatePath("/");
    revalidatePath("/manage");
    return { ok: true, message: "The photograph is now part of the homepage. ♡" };
  } catch (error) {
    console.error("Homepage photo upload failed", error);
    return { message: error instanceof Error ? error.message : "This photograph could not be kept just yet." };
  }
}

export async function moveHomepagePhoto(
  photoId: string,
  direction: "up" | "down",
): Promise<ManageState> {
  const viewer = await requireViewer();
  if (viewer.role !== "creator") return { message: "Only the creator can reorder these photographs." };
  const parsed = z.string().uuid().safeParse(photoId);
  if (!parsed.success) return { message: "This photograph could not be found." };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("homepage_photos")
      .select("id,position")
      .order("position")
      .order("created_at");
    if (error) throw error;
    const current = (data || []).findIndex((photo) => photo.id === parsed.data);
    const neighbor = direction === "up" ? current - 1 : current + 1;
    if (current < 0 || neighbor < 0 || neighbor >= (data || []).length) return { ok: true, message: "Already in place." };

    const first = data![current];
    const second = data![neighbor];
    const [{ error: firstError }, { error: secondError }] = await Promise.all([
      supabase.from("homepage_photos").update({ position: second.position }).eq("id", first.id),
      supabase.from("homepage_photos").update({ position: first.position }).eq("id", second.id),
    ]);
    if (firstError || secondError) throw firstError || secondError;
    revalidatePath("/");
    revalidatePath("/manage");
    return { ok: true, message: "The photographs have been reordered." };
  } catch (error) {
    console.error("Homepage photo reorder failed", error);
    return { message: "The photographs could not be reordered just yet." };
  }
}

export async function removeHomepagePhoto(photoId: string): Promise<ManageState> {
  const viewer = await requireViewer();
  if (viewer.role !== "creator") return { message: "Only the creator can remove these photographs." };
  const parsed = z.string().uuid().safeParse(photoId);
  if (!parsed.success) return { message: "This photograph could not be found." };

  try {
    const supabase = await createClient();
    const { data: photo, error: photoError } = await supabase
      .from("homepage_photos")
      .select("storage_path,uploader_id")
      .eq("id", parsed.data)
      .maybeSingle();
    if (photoError) throw photoError;
    if (!photo || photo.uploader_id !== viewer.id) return { message: "Only the person who added this photograph can remove it." };

    const { error: storageError } = await createAdminClient().storage
      .from("private-media")
      .remove([photo.storage_path]);
    if (storageError) return { message: "The photograph is still here because its private file could not be removed." };

    const { data: deleted, error: deleteError } = await supabase
      .from("homepage_photos")
      .delete()
      .eq("id", parsed.data)
      .eq("uploader_id", viewer.id)
      .select("id")
      .maybeSingle();
    if (deleteError || !deleted) return { message: "The photograph’s file was removed. Try removing its empty place once more." };
    revalidatePath("/");
    revalidatePath("/manage");
    return { ok: true, message: "The photograph has been removed." };
  } catch (error) {
    console.error("Homepage photo removal failed", error);
    return { message: "This photograph could not be removed just yet." };
  }
}
