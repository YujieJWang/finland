"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import { zonedHour } from "@/lib/domain";

type DayPart = "morning" | "day" | "evening" | "night";

function timeIn(timezone: string, now: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
}

function dayPart(timezone: string, now: Date): DayPart {
  const hour = zonedHour(timezone, now);
  if (hour < 6 || hour >= 22) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "day";
  return "evening";
}

const colors: Record<DayPart, string> = {
  morning: "#efe4c8",
  day: "#e5ece8",
  evening: "#e8d9d2",
  night: "#dce0e6",
};

export function Clocks() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const people = [siteConfig.people.singapore, siteConfig.people.finland];
  return (
    <section aria-label="Our local times" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
      {people.map((person, index) => {
        const part = now ? dayPart(person.timezone, now) : "day";
        return (
          <div key={person.timezone} style={{ display: "contents" }}>
            {index === 1 && (
              <div aria-hidden className="serif" style={{ textAlign: "center", color: "var(--berry)", fontSize: 24 }}>
                ♡
                <small className="muted" style={{ display: "block", width: 70, fontFamily: "ui-sans-serif", fontSize: 11 }}>
                  {siteConfig.distanceKm.toLocaleString()} km
                </small>
              </div>
            )}
            <div style={{ borderRadius: 20, padding: "18px 12px", textAlign: "center", background: colors[part], border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{person.flag} {person.location}</div>
              <time style={{ display: "block", marginTop: 6, fontFamily: "Georgia, serif", fontSize: "clamp(21px, 5.5vw, 29px)" }}>
                {now ? timeIn(person.timezone, now) : "—:—"}
              </time>
              <small className="muted">{part}</small>
            </div>
          </div>
        );
      })}
    </section>
  );
}
