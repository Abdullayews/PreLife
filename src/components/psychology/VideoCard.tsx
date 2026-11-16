"use client";

import { useEffect, useRef } from "react";

/** Quiet video card. Reports one completed-watch to
 *  /api/psychology/progress when the video ends. */
export function VideoCard({ id, src, poster, title, desc }: {
  id: string; src: string; poster: string; title: string; desc: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const ended = () => {
      // With preload="none" the metadata may not be loaded yet (duration
      // NaN/0) — a completed-watch can't be measured then, so skip the
      // report instead of sending seconds=0, which the API rightly rejects.
      const seconds = Math.round(video.duration);
      if (!Number.isFinite(seconds) || seconds < 1) return;
      void fetch("/api/psychology/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceId: id, seconds, completed: true }),
      }).catch(() => {});
    };
    video.addEventListener("ended", ended);
    return () => video.removeEventListener("ended", ended);
  }, [id]);

  return (
    <figure className="media-card">
      {/* Calm ambience loops — no speech track, captions don't apply. */}
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={ref} src={src} poster={poster} controls preload="none" playsInline />
      <figcaption className="media-body">
        <h3>{title}</h3>
        <p>{desc}</p>
      </figcaption>
    </figure>
  );
}
