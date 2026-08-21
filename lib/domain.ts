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

export function zonedHour(timezone: string, now: Date) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
}

export function zonedDate(timezone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function daysBetweenDates(from: string, to: string): number {
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((toMs - fromMs) / 86_400_000);
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
