import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const updateSchema = z.object({
  callback_query: z.object({
    id: z.string().min(1),
    data: z.string().regex(/^love_back:[0-9a-f-]{36}$/),
    message: z.object({ chat: z.object({ id: z.union([z.string(), z.number()]) }) }),
  }),
});

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { callback_query: callback } = parsed.data;
  if (String(callback.message.chat.id) !== process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const pingId = callback.data.slice("love_back:".length);
  const admin = createAdminClient();
  const { data: ping } = await admin.from("love_pings").select("id,sender_id,recipient_id").eq("id", pingId).eq("direction", "outbound").not("delivered_at", "is", null).maybeSingle();
  if (!ping) return NextResponse.json({ ok: false }, { status: 404 });

  const { error } = await admin.from("love_pings").upsert({
    sender_id: ping.recipient_id,
    recipient_id: ping.sender_id,
    direction: "return",
    reply_to_ping_id: ping.id,
    delivered_at: new Date().toISOString(),
  }, { onConflict: "reply_to_ping_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: callback.id, text: "Sent some love back 💗" }),
    });
  }
  return NextResponse.json({ ok: true });
}
