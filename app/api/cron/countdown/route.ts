import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { daysBetweenDates, zonedDate } from "@/lib/domain";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();
  const timezone = siteConfig.people.finland.timezone;
  const todayInHelsinki = zonedDate(timezone, now);
  const daysRemaining = daysBetweenDates(todayInHelsinki, siteConfig.reunionDate);

  if (daysRemaining < 0) {
    return NextResponse.json({ ok: true, skipped: "post-reunion" });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("countdown_deliveries")
    .select("finland_date")
    .eq("finland_date", todayInHelsinki)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, skipped: "already-sent" });
  }

  const message =
    daysRemaining === 0
      ? "good morning from finland ♡ today is the day — we made it."
      : `good morning from finland ♡ only ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} until we're together again.`;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return NextResponse.json({ ok: false, error: "telegram-not-configured" }, { status: 503 });
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
    signal: AbortSignal.timeout(10_000),
  });
  const result = (await response.json()) as { ok: boolean; result?: { message_id: number } };

  if (!response.ok || !result.ok) {
    console.error("Countdown Telegram delivery failed.");
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const { error: insertError } = await admin.from("countdown_deliveries").insert({
    finland_date: todayInHelsinki,
    days_remaining: daysRemaining,
    telegram_message_id: result.result?.message_id ?? null,
  });

  if (insertError && insertError.code !== "23505") {
    console.error("Countdown delivery record insert failed.");
  }

  return NextResponse.json({ ok: true, delivered: true, daysRemaining });
}
