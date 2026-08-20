import type { Metadata } from "next";
import { Media } from "@/components/media";
import { siteConfig } from "@/config/site";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Attachment } from "@/lib/types";

export const metadata: Metadata = { title: "Our Finland Chapter" };

type TimelineResponse = {
  id: string;
  message: string | null;
  mood: string | null;
  created_at: string;
  cards: { title: string; emoji: string };
  attachments: Attachment[];
};

export default async function FinlandPage() {
  await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_responses")
    .select(
      "id,message,mood,created_at,cards!inner(title,emoji),attachments!attachments_response_id_fkey(*)",
    )
    .order("created_at", { ascending: false });
  const entries = await Promise.all(
    ((data || []) as unknown as TimelineResponse[]).map(async (entry) => ({
      ...entry,
      attachments: await Promise.all(
        (entry.attachments || []).map(async (item) => {
          const { data: signed } = await supabase.storage
            .from("private-media")
            .createSignedUrl(item.storage_path, 3600);
          return { ...item, signed_url: signed?.signedUrl };
        }),
      ),
    })),
  );

  return (
    <div className="narrow-shell" style={{ paddingBlock: "48px 80px" }}>
      <header style={{ marginBottom: 48 }}>
        <p className="hand" style={{ color: "var(--berry)", fontSize: 18 }}>
          written between Finland and Singapore
        </p>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(45px, 11vw, 72px)",
            lineHeight: 0.98,
            fontWeight: 500,
            margin: "12px 0",
          }}
        >
          {siteConfig.chapterName} 🇫🇮
        </h1>
        <p className="muted" style={{ lineHeight: 1.7 }}>
          our story
        </p>
      </header>
      {entries.length ? (
        <div style={{ display: "grid", gap: 38 }}>
          {entries.map((entry, index) => {
            const date = new Date(entry.created_at);
            return (
              <article
                key={entry.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "58px 1fr",
                  gap: 15,
                }}
              >
                <time
                  style={{
                    color: "var(--berry)",
                    textAlign: "center",
                    fontWeight: 800,
                    lineHeight: 1.1,
                  }}
                >
                  <small
                    style={{
                      display: "block",
                      fontSize: 11,
                      letterSpacing: ".1em",
                    }}
                  >
                    {new Intl.DateTimeFormat("en", { month: "short" })
                      .format(date)
                      .toLowerCase()}
                  </small>
                  <strong className="serif" style={{ fontSize: 27 }}>
                    {date.getDate()}
                  </strong>
                </time>
                <div
                  className="paper-card"
                  style={{
                    padding: "clamp(20px, 6vw, 34px)",
                    transform: `rotate(${index % 2 ? ".18" : "-.16"}deg)`,
                  }}
                >
                  <p className="eyebrow">Opened: {entry.cards.title}</p>
                  <div style={{ fontSize: 31, marginBlock: 14 }}>
                    {entry.mood || entry.cards.emoji}
                  </div>
                  {entry.message && (
                    <p
                      className="serif"
                      style={{
                        whiteSpace: "pre-wrap",
                        fontSize: 20,
                        lineHeight: 1.7,
                      }}
                    >
                      {entry.message}
                    </p>
                  )}
                  <Media attachments={entry.attachments} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div
          className="paper-card"
          style={{ padding: 32, textAlign: "center" }}
        >
          <p className="serif" style={{ fontSize: 22 }}>
            our finland era is waiting for its first page.
          </p>
          <p className="muted">
            Responses left on letters will gather here automatically.
          </p>
        </div>
      )}
    </div>
  );
}
