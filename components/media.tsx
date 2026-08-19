import type { Attachment } from "@/lib/types";

export function Media({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null;
  return (
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
      {attachments.map((item) => item.type === "image" ? (
        <figure className="polaroid" key={item.id}>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed private URLs are short-lived and unknown to image optimization. */}
          <img className="photo" src={item.signed_url} alt={item.alt_text || "A memory attached to this letter"} />
        </figure>
      ) : (
        <audio key={item.id} controls preload="metadata" src={item.signed_url} style={{ width: "100%" }}>
          Your browser cannot play this voice note.
        </audio>
      ))}
    </div>
  );
}
