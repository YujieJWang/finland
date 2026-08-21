const integer = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const siteConfig = {
  title: "Read Me When You Need Me",
  description: "A private little place for two people, even when they are far apart.",
  people: {
    singapore: {
      name: process.env.NEXT_PUBLIC_PERSON_ONE_NAME || "You",
      location: "Singapore",
      timezone: "Asia/Singapore",
      flag: "🇸🇬",
    },
    finland: {
      name: process.env.NEXT_PUBLIC_PERSON_TWO_NAME || "Her",
      location: "Finland",
      timezone: "Europe/Helsinki",
      flag: "🇫🇮",
    },
  },
  reunionDate: process.env.NEXT_PUBLIC_REUNION_DATE || "2026-12-20",
  distanceKm: integer(process.env.NEXT_PUBLIC_DISTANCE_KM, 9000),
  homepageMessage:
    process.env.NEXT_PUBLIC_HOMEPAGE_MESSAGE ||
    "No matter how far away, there’s always something here for you.",
  chapterName: process.env.NEXT_PUBLIC_CHAPTER_NAME || "Our Finland Chapter",
} as const;
