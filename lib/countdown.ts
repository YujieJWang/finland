import { siteConfig } from "@/config/site";

export function countdownMessage(today: string, daysRemaining: number) {
  if (daysRemaining < 0) return null;
  if (daysRemaining === 0) {
    return "good morning from singapore ♡ today is the day — we made it.";
  }

  const weeksRemaining = Math.ceil(daysRemaining / 7);
  const monthsRemaining = Math.ceil(daysRemaining / 30);
  const weekDecreased = weeksRemaining < Math.ceil((daysRemaining + 1) / 7);
  const monthDecreased = monthsRemaining < Math.ceil((daysRemaining + 1) / 30);
  const [year, month, day] = today.split("-").map(Number);
  const [anchorYear, anchorMonth] = siteConfig.monthsary.anchor.split("-").map(Number);
  const monthsary = day === siteConfig.monthsary.day
    ? siteConfig.monthsary.count + (year - anchorYear) * 12 + month - anchorMonth
    : null;
  const occasion = siteConfig.specialOccasions.find(({ date }) => today.endsWith(date));

  if (!weekDecreased && !monthDecreased && !monthsary && !occasion) return null;

  const lines = [
    `good morning from singapore ♡ only ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} until we're together again.`,
  ];
  if (weekDecreased) lines.push(`${weeksRemaining} week${weeksRemaining === 1 ? "" : "s"} left.`);
  if (monthDecreased) lines.push(`${monthsRemaining} month${monthsRemaining === 1 ? "" : "s"} left.`);
  if (monthsary) lines.push(`happy ${monthsary} months to us ♡`);
  if (occasion) lines.push(occasion.message);
  return lines.join("\n");
}
