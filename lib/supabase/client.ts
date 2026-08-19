"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicSupabaseEnv } from "@/lib/supabase/env";

export function createClient() {
  const { url, key } = publicSupabaseEnv();
  return createBrowserClient(url, key);
}
