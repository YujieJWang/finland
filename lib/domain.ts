export type UnlockType = "immediate" | "date" | "mystery";

export function isCardUnlocked(
  unlockType: UnlockType,
  unlockAt: string | null,
  now = new Date(),
) {
  if (unlockType === "immediate") return true;
  return Boolean(unlockAt && new Date(unlockAt).getTime() <= now.getTime());
}

export function daysUntil(date: string, now = new Date()) {
  const target = new Date(`${date}T00:00:00`);
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000));
}

export function cooldownRemaining(
  lastSentAt: string | null,
  cooldownSeconds: number,
  now = new Date(),
) {
  if (!lastSentAt) return 0;
  return Math.max(
    0,
    Math.ceil(cooldownSeconds - (now.getTime() - new Date(lastSentAt).getTime()) / 1000),
  );
}

export function zonedHour(timezone: string, now: Date) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
}

export function fileKind(file: Pick<File, "type" | "size">) {
  const kind = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("audio/")
      ? "audio"
      : null;
  if (!kind) throw new Error("Only images and audio can be kept here.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Each file must be under 10 MB.");
  return kind;
}

export function safeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "") || "upload";
}

export function canDeleteCard(viewerId: string, creatorId: string) {
  return viewerId === creatorId;
}
