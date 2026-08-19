import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cooldownRemaining, daysUntil, isCardUnlocked, zonedHour } from "../lib/domain";

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

test("love ping cooldown returns an exact retry window", () => {
  const now = new Date("2026-08-19T12:04:10Z");
  assert.equal(cooldownRemaining("2026-08-19T12:00:00Z", 300, now), 50);
  assert.equal(cooldownRemaining("2026-08-19T11:00:00Z", 300, now), 0);
});

test("migration keeps authorization, read receipts, storage, and cooldown server-side", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202608190001_initial.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.cards enable row level security/);
  assert.match(sql, /recipient_id = auth\.uid\(\) and public\.card_is_unlocked\(cards\)/);
  assert.match(sql, /c\.recipient_id = auth\.uid\(\) and public\.card_is_unlocked\(c\)/);
  assert.match(sql, /create or replace function public\.mark_card_read/);
  assert.match(sql, /where c\.id = target_id and c\.recipient_id = auth\.uid\(\) and public\.card_is_unlocked\(c\)/);
  assert.match(sql, /create trigger cards_protect_receipts/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /create policy "authenticated users upload to own folder"/);
  assert.match(sql, /before insert on auth\.users/);
});

test("Telegram routes require an authenticated user or webhook secret", async () => {
  const ping = await readFile(new URL("../app/api/thinking-of-you/route.ts", import.meta.url), "utf8");
  const webhook = await readFile(new URL("../app/api/telegram/webhook/route.ts", import.meta.url), "utf8");
  assert.match(ping, /supabase\.auth\.getUser\(\)/);
  assert.match(ping, /status: 401/);
  assert.match(webhook, /x-telegram-bot-api-secret-token/);
  assert.match(webhook, /status: 401/);
});
