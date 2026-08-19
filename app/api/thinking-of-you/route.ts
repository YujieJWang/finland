import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { cooldownRemaining } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const messages = [
  "❤️ She’s thinking about you.",
  "💌 Someone in Finland misses you.",
  "🫶 You’ve just received some love from Finland.",
  "🌍 A little love travelled all the way from Finland.",
  "💗 Love delivery from Finland.",
  "🚨 Girlfriend attention requested immediately.",
] as const;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Please come back inside first." }, { status: 401 });

  const [{ data: viewer }, { data: recipient }] = await Promise.all([
    supabase.from("profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id").neq("id", user.id).limit(1).maybeSingle(),
  ]);
  if (!viewer || !recipient) return NextResponse.json({ message: "Your person isn’t connected yet." }, { status: 403 });

  const { data: pingId, error: reserveError } = await supabase.rpc("reserve_love_ping", {
    target_recipient: recipient.id,
    cooldown_seconds: siteConfig.lovePingCooldownSeconds,
  });
  if (reserveError?.message.includes("COOLDOWN")) {
    const { data: latest } = await supabase.from("love_pings").select("created_at").eq("sender_id", user.id).eq("direction", "outbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const retryAfter = cooldownRemaining(latest?.created_at || null, siteConfig.lovePingCooldownSeconds);
    return NextResponse.json({ message: "Your last little love note is still travelling. ♡", retryAfter }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }
  if (reserveError || !pingId) return NextResponse.json({ message: "This love note couldn’t leave just yet." }, { status: 400 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const admin = createAdminClient();
  if (!token || !chatId) {
    await admin.from("love_pings").delete().eq("id", pingId);
    return NextResponse.json({ message: "Telegram isn’t connected yet." }, { status: 503 });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messages[Math.floor(Math.random() * messages.length)],
        reply_markup: { inline_keyboard: [[{ text: "Send some love back 💗", callback_data: `love_back:${pingId}` }]] },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!response.ok || !result.ok) throw new Error(result.description || "Telegram rejected the message.");
    await admin.from("love_pings").update({ delivered_at: new Date().toISOString(), telegram_message_id: result.result?.message_id }).eq("id", pingId);
    return NextResponse.json({ delivered: true });
  } catch (error) {
    console.error("Telegram send failed", error);
    await admin.from("love_pings").delete().eq("id", pingId);
    return NextResponse.json({ message: "Couldn’t send your love just yet." }, { status: 502 });
  }
}
