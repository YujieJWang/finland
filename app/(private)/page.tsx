import Link from "next/link";
import { CardGrid } from "@/components/card-grid";
import { Clocks } from "@/components/clocks";
import { Countdown } from "@/components/countdown";
import { LoveButton } from "@/components/love-button";
import { HomepagePhotos } from "@/components/homepage-photos";
import { siteConfig } from "@/config/site";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CardPreview, HomepagePhoto } from "@/lib/types";

export default async function HomePage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const [
    { data: cards },
    { count },
    { data: latestReturn },
    { data: photoRows },
  ] = await Promise.all([
    supabase.rpc("list_card_previews"),
    supabase
      .from("love_pings")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", viewer.id)
      .not("delivered_at", "is", null),
    supabase
      .from("love_pings")
      .select("created_at")
      .eq("recipient_id", viewer.id)
      .eq("direction", "return")
      .not("delivered_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("homepage_photos")
      .select("id,storage_path,caption,alt_text")
      .order("position")
      .order("created_at"),
  ]);
  const latestReturnAt =
    (latestReturn as { created_at: string } | null)?.created_at || null;
  const signedPhotos = await Promise.all(
    (photoRows || []).map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from("private-media")
        .createSignedUrl(photo.storage_path, 3600);
      return signed?.signedUrl
        ? {
            id: photo.id,
            caption: photo.caption,
            alt_text: photo.alt_text,
            signed_url: signed.signedUrl,
          }
        : null;
    }),
  );
  const photos = signedPhotos.filter(
    (photo): photo is HomepagePhoto => photo !== null,
  );

  return (
    <div
      className="page-shell"
      style={{ paddingBlock: "clamp(44px, 9vw, 88px) 64px" }}
    >
      <header className="narrow-shell" style={{ textAlign: "center" }}>
        <p
          className="hand"
          style={{
            color: "var(--berry)",
            fontSize: 17,
            transform: "rotate(-1deg)",
          }}
        >
          for whenever you need a little piece of home, or me :)
        </p>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(47px, 13vw, 84px)",
            fontWeight: 500,
            lineHeight: 0.98,
            margin: "14px 0 20px",
            letterSpacing: "-.035em",
          }}
        >
          Read me when
          <br />
          you need me <span aria-label="love">❤️</span>
        </h1>
        <p
          className="muted"
          style={{
            maxWidth: 520,
            margin: "0 auto",
            fontSize: 17,
            lineHeight: 1.7,
          }}
        >
          {siteConfig.homepageMessage}
        </p>
      </header>

      <HomepagePhotos photos={photos} />

      <div className="narrow-shell" style={{ marginTop: 44 }}>
        <Clocks />
        <Countdown />
      </div>

      <section style={{ marginTop: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <div>
            <p className="eyebrow">Your letter box</p>
            <h2
              className="serif"
              style={{
                margin: "7px 0 0",
                fontSize: "clamp(32px, 8vw, 47px)",
                fontWeight: 500,
              }}
            >
              Pick the one you need today.
            </h2>
          </div>
          <Link className="button secondary small" href="/memories">
            Memory box
          </Link>
        </div>
        <CardGrid cards={(cards || []) as CardPreview[]} />
      </section>

      <LoveButton latestReturn={latestReturnAt} />
      <p
        className="muted"
        style={{ textAlign: "center", fontSize: 13, marginTop: 16 }}
      >
        {count || 0} little {(count || 0) === 1 ? "reminder" : "reminders"} sent
        across the distance <span aria-hidden>❤️</span>
      </p>
    </div>
  );
}
