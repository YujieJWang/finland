import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  isAllowedTelegramParticipant,
  parseAllowedTelegramUserIds,
} from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const userSchema = z.object({
  id: z.union([z.string(), z.number()]),
  is_bot: z.boolean(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

const messageSchema = z.object({
  message_id: z.number().int(),
  chat: z.object({
    id: z.union([z.string(), z.number()]),
    type: z.string(),
  }),
  from: userSchema.optional(),
  text: z.string().optional(),
});

const updateSchema = z.object({
  update_id: z.number().int(),
  message: messageSchema.optional(),
  callback_query: z.object({
    id: z.string().min(1),
    from: userSchema,
    data: z.string().optional(),
    message: messageSchema.optional(),
  }).optional(),
});

async function handleLoveBack(callback: z.infer<typeof updateSchema>["callback_query"], token: string, chatId: string) {
  if (!callback?.data?.match(/^love_back:[0-9a-f-]{36}$/)) return NextResponse.json({ ok: true });

  const pingId = callback.data.slice("love_back:".length);
  const admin = createAdminClient();
  const { data: ping } = await admin
    .from("love_pings")
    .select("id,sender_id,recipient_id")
    .eq("id", pingId)
    .eq("direction", "outbound")
    .not("delivered_at", "is", null)
    .maybeSingle();
  if (!ping) return NextResponse.json({ ok: true });

  const { data: sender } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", ping.recipient_id)
    .maybeSingle();

  const { error } = await admin.from("love_pings").upsert({
    sender_id: ping.recipient_id,
    recipient_id: ping.sender_id,
    direction: "return",
    reply_to_ping_id: ping.id,
    delivered_at: new Date().toISOString(),
  }, { onConflict: "reply_to_ping_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  const location = sender?.timezone === "Asia/Singapore" ? "Singapore" : "Finland";
  const messages = [
    `💗 love sent back from ${location}.`,
    `🫶 some love returned from ${location}.`,
    `💌 a reply from ${location}: thinking of you too.`,
  ];
  const text = messages[Math.floor(Math.random() * messages.length)];

  await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: callback.id, text: "sent some love back 💗" }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => undefined),
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => undefined),
  ]);
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });

  const chatId = process.env.TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedUserIds = parseAllowedTelegramUserIds(process.env.TELEGRAM_ALLOWED_USER_IDS);
  if (!chatId || !token || allowedUserIds.size !== 2) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const callback = parsed.data.callback_query;
  if (callback) {
    if (
      !callback.message ||
      !isAllowedTelegramParticipant(callback.message.chat, callback.from, chatId, allowedUserIds)
    ) return NextResponse.json({ ok: true });
    return handleLoveBack(callback, token, chatId);
  }

  const message = parsed.data.message;
  if (
    !message?.from ||
    !message.text?.trim() ||
    !isAllowedTelegramParticipant(message.chat, message.from, chatId, allowedUserIds)
  ) return NextResponse.json({ ok: true });

  // LLM replies are disabled; ordinary group messages need no bot action.
  return NextResponse.json({ ok: true });
}
