import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function pickMessage(senderLocation: string) {
  const messages = [
    `❤️ someone in ${senderLocation} is thinking about you.`,
    `💌 a little love note from ${senderLocation}.`,
    `🫶 you've just received some love from ${senderLocation}.`,
    `🌍 a little love travelled all the way from ${senderLocation}.`,
    `💗 love delivery from ${senderLocation}.`,
    `🚨 partner attention requested immediately.`,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Please come back inside first." }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: viewer }, { data: recipient }] = await Promise.all([
    admin.from("profiles").select("id,timezone").eq("id", user.id).maybeSingle(),
    admin.from("profiles").select("id").neq("id", user.id).limit(1).maybeSingle(),
  ]);
  if (!viewer || !recipient) return NextResponse.json({ message: "Your person isn't connected yet." }, { status: 403 });

  const { data: inserted, error: insertError } = await admin
    .from("love_pings")
    .insert({ sender_id: user.id, recipient_id: recipient.id, direction: "outbound" })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("love_ping insert failed", insertError);
    return NextResponse.json({ message: "This love note couldn't leave just yet." }, { status: 400 });
  }
  const pingId = inserted.id;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    await admin.from("love_pings").delete().eq("id", pingId);
    return NextResponse.json({ message: "Telegram isn't connected yet." }, { status: 503 });
  }

  const senderLocation = viewer.timezone === "Asia/Singapore"
    ? siteConfig.people.singapore.location
    : siteConfig.people.finland.location;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: pickMessage(senderLocation),
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
    return NextResponse.json({ message: "Couldn't send your love just yet." }, { status: 502 });
  }
}
