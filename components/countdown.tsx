import { siteConfig } from "@/config/site";
import { daysUntil } from "@/lib/domain";

export function Countdown() {
  const days = daysUntil(siteConfig.reunionDate);
  return (
    <div style={{ textAlign: "center", paddingBlock: 28 }}>
      <strong className="serif" style={{ display: "block", color: "var(--berry-dark)", fontSize: "clamp(48px, 14vw, 76px)", fontWeight: 500 }}>
        {days} {days === 1 ? "day" : "days"}
      </strong>
      <span className="muted">until we’re together again <span aria-hidden>❤️</span></span>
    </div>
  );
}
