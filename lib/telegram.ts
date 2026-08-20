export type TelegramChat = {
  id: string | number;
  type: string;
};

export type TelegramUser = {
  id: string | number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  entities?: Array<{ type: string; offset: number; length: number }>;
  reply_to_message?: { from?: TelegramUser };
};

export type TelegramContextMessage = {
  role: "user" | "assistant";
  sender_name: string;
  content: string;
};

export function parseAllowedTelegramUserIds(value: string | undefined) {
  return new Set(
    (value || "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id)),
  );
}

export function isAllowedTelegramParticipant(
  chat: TelegramChat,
  user: TelegramUser | undefined,
  chatId: string | undefined,
  allowedUserIds: ReadonlySet<string>,
) {
  return Boolean(
    chatId &&
      (chat.type === "group" || chat.type === "supergroup") &&
      String(chat.id) === chatId &&
      user &&
      !user.is_bot &&
      allowedUserIds.has(String(user.id)),
  );
}

export function telegramDisplayName(user: TelegramUser) {
  return ([user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.username || "someone").slice(0, 80);
}

export function telegramResetRequested(text: string, configuredUsername: string | undefined) {
  const match = text.trim().match(/^\/reset(?:@([a-z0-9_]+))?$/i);
  if (!match) return false;
  return !match[1] || match[1].toLowerCase() === configuredUsername?.replace(/^@/, "").toLowerCase();
}

export function parseTelegramInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export function redactTelegramSecrets(text: string, secrets: Array<string | undefined>) {
  return secrets.reduce<string>(
    (safe, secret) => secret && secret.length >= 4 ? safe.split(secret).join("[redacted]") : safe,
    text,
  );
}

export function formatTelegramContext(
  messages: TelegramContextMessage[],
  maximumMessages = 10,
  maximumCharacters = 6_000,
) {
  const lines = messages
    .slice(-maximumMessages)
    .map(({ sender_name: name, content }) => `${name}: ${content.slice(0, 1_000)}`);
  const kept: string[] = [];
  let length = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (length + line.length + (kept.length ? 1 : 0) > maximumCharacters) break;
    kept.unshift(line);
    length += line.length + (kept.length > 1 ? 1 : 0);
  }
  return kept.join("\n");
}
