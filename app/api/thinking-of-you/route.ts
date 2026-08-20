import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { cooldownRemaining } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const messages = [
  "❤️ she’s thinking about you.",
  "💌 someone in finland misses you.",
  "🫶 you’ve just received some love from finland.",
  "🌍 a little love travelled all the way from finland.",
  "💗 love delivery from finland.",
  "🚨 girlfriend attention requested immediately.",
] as const;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Please come back inside first." }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: viewer }, { data: recipient }] = await Promise.all([
    admin.from("profiles").select("id").eq("id", user.id).maybeSingle(),
    admin.from("profiles").select("id").neq("id", user.id).limit(1).maybeSingle(),
  ]);
  if (!viewer || !recipient) return NextResponse.json({ message: "Your person isn’t connected yet." }, { status: 403 });

  const cooldownSeconds = siteConfig.lovePingCooldownSeconds;
  const { data: recent } = await admin
    .from("love_pings")
    .select("created_at")
    .eq("sender_id", user.id)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const elapsed = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
    if (elapsed < cooldownSeconds) {
      const retryAfter = cooldownRemaining(recent.created_at, cooldownSeconds);
      return NextResponse.json(
        { message: "Your last little love note is still travelling. ♡", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

  const { data: inserted, error: insertError } = await admin
    .from("love_pings")
    .insert({ sender_id: user.id, recipient_id: recipient.id, direction: "outbound" })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("love_ping insert failed", insertError);
    return NextResponse.json({ message: "This love note couldn’t leave just yet." }, { status: 400 });
  }
  const pingId = inserted.id;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
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
        reply_markup: { inline_keyboard: [[{ text: "send some love back 💗", callback_data: `love_back:${pingId}` }]] },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!response.ok || !result.ok) throw new Error(result.description || "Telegram rejected the message.");
    await admin.from("love_pings").update({ delivered_at: new Date().toISOString(), telegram_message_id: result.result?.message_id }).eq("id", pingId);
    return NextResponse.json({ delivered: true });
  } catch {
    console.error("Telegram notification delivery failed.");
    await admin.from("love_pings").delete().eq("id", pingId);
    return NextResponse.json({ message: "Couldn’t send your love just yet." }, { status: 502 });
  }
}
