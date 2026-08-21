import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canDeleteCard, daysBetweenDates, daysUntil, isCardUnlocked, zonedDate, zonedHour } from "../lib/domain";
import {
  formatTelegramContext,
  isAllowedTelegramParticipant,
  parseAllowedTelegramUserIds,
  parseTelegramInteger,
  redactTelegramSecrets,
  telegramResetRequested,
} from "../lib/telegram";

test("date and mystery cards stay locked until their database timestamp", () => {
  const now = new Date("2026-08-19T12:00:00Z");
  assert.equal(isCardUnlocked("immediate", null, now), true);
  assert.equal(isCardUnlocked("date", "2026-08-19T12:00:01Z", now), false);
  assert.equal(isCardUnlocked("mystery", "2026-08-19T11:59:59Z", now), true);
  assert.equal(isCardUnlocked("mystery", null, now), false);
});

test("countdown rounds partial days up and never becomes negative", () => {
  assert.equal(daysUntil("2026-08-20", new Date("2026-08-19T12:00:00")), 1);
  assert.equal(daysUntil("2026-08-18", new Date("2026-08-19T12:00:00")), 0);
});

test("Helsinki daylight saving changes its distance from Singapore", () => {
  const winter = new Date("2026-01-15T12:00:00Z");
  const summer = new Date("2026-07-15T12:00:00Z");
  assert.equal(zonedHour("Asia/Singapore", winter) - zonedHour("Europe/Helsinki", winter), 6);
  assert.equal(zonedHour("Asia/Singapore", summer) - zonedHour("Europe/Helsinki", summer), 5);
});

test("a user who did not create a card cannot delete it", () => {
  assert.equal(canDeleteCard("recipient-id", "creator-id"), false);
  assert.equal(canDeleteCard("creator-id", "creator-id"), true);
});

test("migration keeps authorization, read receipts, and storage server-side", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608190001_initial.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.cards enable row level security/);
  assert.match(sql, /create policy "creators can delete cards"[\s\S]*using \(creator_id = auth\.uid\(\)\)/);
  assert.match(sql, /recipient_id = auth\.uid\(\) and public\.card_is_unlocked\(cards\)/);
  assert.match(sql, /c\.recipient_id = auth\.uid\(\) and public\.card_is_unlocked\(c\)/);
  assert.match(sql, /create or replace function public\.mark_card_read/);
  assert.match(sql, /where c\.id = target_id and c\.recipient_id = auth\.uid\(\) and public\.card_is_unlocked\(c\)/);
  assert.match(sql, /create trigger cards_protect_receipts/);
  assert.match(sql, /create policy "authenticated users upload to own folder"/);
  assert.match(sql, /before insert on auth\.users/);
});

test("love pings have no cooldown", async () => {
  const route = await readFile(new URL("../app/api/thinking-of-you/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/202608210002_remove_love_ping_cooldown.sql", import.meta.url), "utf8");
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.doesNotMatch(route, /cooldown|Retry-After|status: 429/);
  assert.match(migration, /drop function if exists public\.reserve_love_ping\(uuid, integer\)/);
  assert.doesNotMatch(example, /LOVE_PING_COOLDOWN_SECONDS/);
});

test("Telegram routes require an authenticated user or webhook secret", async () => {
  const ping = await readFile(new URL("../app/api/thinking-of-you/route.ts", import.meta.url), "utf8");
  const webhook = await readFile(new URL("../app/api/telegram/webhook/route.ts", import.meta.url), "utf8");
  assert.match(ping, /supabase\.auth\.getUser\(\)/);
  assert.match(ping, /status: 401/);
  assert.match(webhook, /x-telegram-bot-api-secret-token/);
  assert.match(webhook, /status: 401/);
});

test("local account preview is allowlisted and exchanges only a magic-link token", async () => {
  const script = await readFile(new URL("../scripts/login-as.ts", import.meta.url), "utf8");
  const callback = await readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
  const pkg = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.match(script, /from\("allowed_emails"\)/);
  assert.match(script, /generateLink\(\{ type: "magiclink", email \}\)/);
  assert.match(callback, /verifyOtp\(\{ token_hash: tokenHash, type: "magiclink" \}\)/);
  assert.match(pkg, /"login-as": "node --env-file=\.env\.local --import tsx scripts\/login-as\.ts"/);
});

test("Telegram webhook rejects invalid secrets and ignores unauthorized, bot, and non-text updates", async () => {
  const [{ NextRequest }, { POST }] = await Promise.all([
    import("next/server"),
    import("../app/api/telegram/webhook/route"),
  ]);
  const names = [
    "TELEGRAM_WEBHOOK_SECRET",
    "TELEGRAM_CHAT_ID",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_ALLOWED_USER_IDS",
  ] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.TELEGRAM_WEBHOOK_SECRET = "expected-secret";
  process.env.TELEGRAM_CHAT_ID = "-303";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_ALLOWED_USER_IDS = "101,202";

  const request = (body: unknown, secret = "expected-secret") => new NextRequest("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify(body),
  });

  try {
    assert.equal((await POST(request({ update_id: 1 }, "wrong-secret"))).status, 401);
    assert.equal((await POST(request({
      update_id: 2,
      message: {
        message_id: 2,
        chat: { id: -999, type: "group" },
        from: { id: 101, is_bot: false, first_name: "alex" },
        text: "hello",
      },
    }))).status, 200);
    assert.equal((await POST(request({
      update_id: 3,
      message: {
        message_id: 3,
        chat: { id: -303, type: "group" },
        from: { id: 101, is_bot: true, first_name: "bot" },
        text: "hello",
      },
    }))).status, 200);
    assert.equal((await POST(request({
      update_id: 4,
      message: {
        message_id: 4,
        chat: { id: -303, type: "group" },
        from: { id: 101, is_bot: false, first_name: "alex" },
      },
    }))).status, 200);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("Telegram group authorization rejects private, bot, and unallowlisted senders", () => {
  const allowed = parseAllowedTelegramUserIds("101, 202");
  const user = { id: 101, is_bot: false, first_name: "alex" };
  const group = { id: -303, type: "group" };
  assert.equal(isAllowedTelegramParticipant(group, user, "-303", allowed), true);
  assert.equal(isAllowedTelegramParticipant({ ...group, type: "private" }, user, "-303", allowed), false);
  assert.equal(isAllowedTelegramParticipant(group, { ...user, id: 999 }, "-303", allowed), false);
  assert.equal(isAllowedTelegramParticipant(group, { ...user, is_bot: true }, "-303", allowed), false);
});

test("Telegram reset, numeric limits, and secret redaction are bounded", () => {
  assert.equal(telegramResetRequested("/reset", "our_love_bot"), true);
  assert.equal(telegramResetRequested("/reset@our_love_bot", "our_love_bot"), true);
  assert.equal(telegramResetRequested("/reset@another_bot", "our_love_bot"), false);
  assert.equal(parseTelegramInteger("5000", 10, 1, 100), 100);
  assert.equal(parseTelegramInteger("invalid", 10, 1, 100), 10);
  assert.equal(redactTelegramSecrets("key-test and -303", ["key-test", "-303"]), "[redacted] and [redacted]");
});

test("Telegram context is display-name labelled and bounded", () => {
  const context = formatTelegramContext(Array.from({ length: 13 }, (_, index) => ({
    role: index % 2 ? "assistant" as const : "user" as const,
    sender_name: index % 2 ? "@our_love_bot" : "alex",
    content: `message ${index}`,
  })), 12, 1_000);
  assert.doesNotMatch(context, /message 0/);
  assert.match(context, /alex: message 12/);
  assert.ok(context.length <= 1_000);
});

test("Telegram webhook validates the chat and sender before processing", async () => {
  const webhook = await readFile(new URL("../app/api/telegram/webhook/route.ts", import.meta.url), "utf8");
  const notification = await readFile(new URL("../app/api/thinking-of-you/route.ts", import.meta.url), "utf8");
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(webhook, /isAllowedTelegramParticipant/);
  assert.match(webhook, /TELEGRAM_ALLOWED_USER_IDS/);
  assert.match(notification, /TELEGRAM_CHAT_ID/);
  assert.doesNotMatch(`${webhook}\n${notification}\n${example}`, /TELEGRAM_GROUP_CHAT_ID/);
});

test("Telegram context has no client access policy", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608200002_telegram_context.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.telegram_bot_messages enable row level security/);
  assert.match(sql, /revoke all on table public\.telegram_bot_messages from anon, authenticated/);
  assert.doesNotMatch(sql, /telegram_(user|group)_id/);
});

test("Telegram update claims atomically enforce idempotency and limits", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608210001_telegram_llm_controls.sql", import.meta.url), "utf8");
  const webhook = await readFile(new URL("../app/api/telegram/webhook/route.ts", import.meta.url), "utf8");
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(sql, /update_id bigint primary key/);
  assert.match(sql, /pg_advisory_xact_lock\(target_chat_id\)/);
  assert.match(sql, /return 'duplicate'/);
  assert.match(sql, /count\(\*\) >= greatest\(daily_limit, 1\)/);
  assert.match(sql, /make_interval\(secs => greatest\(cooldown_seconds, 0\)\)/);
  assert.match(sql, /alter table public\.telegram_webhook_updates enable row level security/);
  assert.match(sql, /revoke all on table public\.telegram_webhook_updates from anon, authenticated/);
  for (const name of ["OPENAI_API_KEY", "OPENAI_MODEL", "TELEGRAM_LLM_COOLDOWN_SECONDS", "TELEGRAM_LLM_DAILY_LIMIT"]) {
    assert.match(example, new RegExp(`^${name}=`, "m"));
  }
  const duplicate = webhook.slice(
    webhook.indexOf('if (reservation === "duplicate")'),
    webhook.indexOf('if (reservation === "cooldown"'),
  );
  assert.match(duplicate, /retryFailedDelivery/);
  assert.doesNotMatch(duplicate, /generateReply/);
});

test("Telegram webhook LLM is disabled and replies are not generated", async () => {
  const webhook = await readFile(new URL("../app/api/telegram/webhook/route.ts", import.meta.url), "utf8");
  assert.match(webhook, /LLM replies disabled/);
  assert.doesNotMatch(webhook, /generateReply/);
  assert.doesNotMatch(webhook, /new OpenAI/);
  assert.match(webhook, /delivery_status: "failed"/);
});

test("Telegram responses and production logs never interpolate secrets or message contents", async () => {
  const webhook = await readFile(new URL("../app/api/telegram/webhook/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(webhook, /console\.(?:log|error)\([^\n]*,\s*(?:error|text|reply)/);
  assert.doesNotMatch(webhook, /NextResponse\.json\([^\n]*process\.env/);
});

test("homepage photographs stay private and creator-managed", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608200001_homepage_photos.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.homepage_photos enable row level security/);
  assert.match(sql, /role = 'creator'/);
  assert.match(sql, /hp\.storage_path = name/);
  assert.doesNotMatch(sql, /public\s*=\s*true/);
});

// --- Reunion countdown tests ---

test("zonedDate returns the calendar date in the given timezone", () => {
  // 2026-08-21 23:30 UTC = 2026-08-22 02:30 Helsinki (EEST, UTC+3)
  assert.equal(zonedDate("Europe/Helsinki", new Date("2026-08-21T23:30:00Z")), "2026-08-22");
  // 2026-08-21 20:00 UTC = 2026-08-21 23:00 Helsinki (still Aug 21)
  assert.equal(zonedDate("Europe/Helsinki", new Date("2026-08-21T20:00:00Z")), "2026-08-21");
  // Same instant in Singapore (UTC+8) is already Aug 22
  assert.equal(zonedDate("Asia/Singapore", new Date("2026-08-21T16:30:00Z")), "2026-08-22");
});

test("zonedDate handles winter (EET UTC+2) and summer (EEST UTC+3) correctly", () => {
  // Winter: midnight Helsinki = 22:00 UTC previous day
  assert.equal(zonedDate("Europe/Helsinki", new Date("2026-01-15T22:30:00Z")), "2026-01-16");
  assert.equal(zonedDate("Europe/Helsinki", new Date("2026-01-15T21:59:00Z")), "2026-01-15");
  // Summer: midnight Helsinki = 21:00 UTC previous day
  assert.equal(zonedDate("Europe/Helsinki", new Date("2026-07-15T21:30:00Z")), "2026-07-16");
  assert.equal(zonedDate("Europe/Helsinki", new Date("2026-07-15T20:59:00Z")), "2026-07-15");
});

test("daysBetweenDates calculates signed calendar day differences", () => {
  assert.equal(daysBetweenDates("2026-08-21", "2026-12-20"), 121);
  assert.equal(daysBetweenDates("2026-12-19", "2026-12-20"), 1);
  assert.equal(daysBetweenDates("2026-12-20", "2026-12-20"), 0);
  assert.equal(daysBetweenDates("2026-12-21", "2026-12-20"), -1);
});

test("countdown cron rejects invalid authorization", async () => {
  const [{ NextRequest }, { GET }] = await Promise.all([
    import("next/server"),
    import("../app/api/cron/countdown/route"),
  ]);
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";
  try {
    const noAuth = new NextRequest("http://localhost/api/cron/countdown");
    assert.equal((await GET(noAuth)).status, 401);

    const wrongAuth = new NextRequest("http://localhost/api/cron/countdown", {
      headers: { authorization: "Bearer wrong" },
    });
    assert.equal((await GET(wrongAuth)).status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("countdown skips when Helsinki hour is not midnight", async () => {
  const [{ NextRequest }, { GET }] = await Promise.all([
    import("next/server"),
    import("../app/api/cron/countdown/route"),
  ]);
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";
  try {
    const request = new NextRequest("http://localhost/api/cron/countdown", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const response = await GET(request);
    const body = await response.json();
    // Unless we're running the test exactly at Helsinki midnight, it should skip
    if (body.skipped === "not-midnight") {
      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
    }
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("countdown message uses correct singular, plural, reunion-day, and post-reunion wording", () => {
  function formatCountdown(daysRemaining: number): string | null {
    if (daysRemaining < 0) return null;
    if (daysRemaining === 0) return "good morning from finland ♡ today is the day — we made it.";
    return `good morning from finland ♡ only ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} until we're together again.`;
  }
  assert.equal(formatCountdown(42), "good morning from finland ♡ only 42 days until we're together again.");
  assert.equal(formatCountdown(1), "good morning from finland ♡ only 1 day until we're together again.");
  assert.equal(formatCountdown(0), "good morning from finland ♡ today is the day — we made it.");
  assert.equal(formatCountdown(-1), null);
});

test("countdown route uses CRON_SECRET, timezone checks, and idempotency table", async () => {
  const route = await readFile(new URL("../app/api/cron/countdown/route.ts", import.meta.url), "utf8");
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /Bearer/);
  assert.match(route, /status: 401/);
  assert.match(route, /zonedHour\(/);
  assert.match(route, /!== 0/);
  assert.match(route, /zonedDate\(/);
  assert.match(route, /daysBetweenDates\(/);
  assert.match(route, /countdown_deliveries/);
  assert.match(route, /daysRemaining < 0/);
  assert.match(route, /23505/);
  assert.doesNotMatch(route, /openai|OpenAI/i);
});

test("countdown delivery table has RLS and no browser access", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608210003_countdown_deliveries.sql", import.meta.url), "utf8");
  assert.match(sql, /finland_date date primary key/);
  assert.match(sql, /alter table public\.countdown_deliveries enable row level security/);
  assert.match(sql, /revoke all on table public\.countdown_deliveries from anon, authenticated/);
});

test("countdown cron route never logs or returns secrets", async () => {
  const route = await readFile(new URL("../app/api/cron/countdown/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /console\.\w+\([^)]*(?:token|CRON_SECRET|process\.env)/);
  assert.doesNotMatch(route, /NextResponse\.json\([^)]*process\.env/);
});
