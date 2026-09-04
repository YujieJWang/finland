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

export function zonedDateTime(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function zonedDateTimeToIso(value: string, timezone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error("Choose a valid unlock date and time.");
  const [, year, month, day, hour, minute] = match.map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = zonedDateTime(new Date(instant).toISOString(), timezone);
    const [shownDate, shownTime] = shown.split("T");
    const [shownYear, shownMonth, shownDay] = shownDate.split("-").map(Number);
    const [shownHour, shownMinute] = shownTime.split(":").map(Number);
    instant += target - Date.UTC(shownYear, shownMonth - 1, shownDay, shownHour, shownMinute);
  }
  const result = new Date(instant).toISOString();
  if (zonedDateTime(result, timezone) !== value) throw new Error("That Finland time does not exist.");
  return result;
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
