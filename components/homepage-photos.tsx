"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { FocusEvent } from "react";
import type { HomepagePhoto } from "@/lib/types";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const subscribe = (listener: () => void) => {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
const reducedMotion = () => window.matchMedia(reducedMotionQuery).matches;

export function HomepagePhotos({ photos }: { photos: HomepagePhoto[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useSyncExternalStore(subscribe, reducedMotion, () => true);

  useEffect(() => {
    if (photos.length < 2 || paused || reduceMotion) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % photos.length), 6_000);
    return () => window.clearInterval(timer);
  }, [paused, photos.length, reduceMotion]);

  if (!photos.length) return null;
  const active = photos[index] || photos[0];
  const leaveFocus = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
  };

  return (
    <section
      className="homepage-photos"
      aria-label="our photographs"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={leaveFocus}
    >
      <figure className="homepage-photo-frame">
        <div className="homepage-photo-stage">
          {photos.map((photo, photoIndex) => (
            // eslint-disable-next-line @next/next/no-img-element -- private signed URLs cannot use stable image optimization.
            <img
              key={photo.id}
              className={photoIndex === index ? "active" : ""}
              src={photo.signed_url}
              alt={photoIndex === index ? photo.alt_text : ""}
              aria-hidden={photoIndex !== index}
            />
          ))}
        </div>
        {active.caption && <figcaption className="hand">{active.caption}</figcaption>}
      </figure>
      {photos.length > 1 && (
        <div className="homepage-photo-controls">
          <button type="button" onClick={() => setIndex((current) => (current - 1 + photos.length) % photos.length)} aria-label="previous photograph">←</button>
          <span>{index + 1} / {photos.length}</span>
          <button type="button" onClick={() => setIndex((current) => (current + 1) % photos.length)} aria-label="next photograph">→</button>
        </div>
      )}
    </section>
  );
}
