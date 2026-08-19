"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { message: string; ok?: boolean };

export async function requestMagicLink(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.string().trim().email().safeParse(formData.get("email"));
  if (!parsed.success) return { message: "Please enter the email address your invitation was sent to." };

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("allowed_emails")
      .select("email")
      .eq("email", parsed.data.toLowerCase())
      .maybeSingle();
    if (!data) return { message: "That email isn’t part of this little space." };

    const requestHeaders = await headers();
    const origin = requestHeaders.get("origin") || `https://${requestHeaders.get("host")}`;
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: true },
    });
    if (error) throw error;
    return { ok: true, message: "Your little door home is waiting in your inbox. ♡" };
  } catch (error) {
    console.error("Magic link request failed", error);
    return { message: "The letter couldn’t be sent just yet. Try again in a moment." };
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
