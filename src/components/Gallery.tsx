"use client";

import { useEffect, useState, type CSSProperties, type FocusEvent } from "react";

/**
 * Hero photo gallery. Frames are stacked layers; the incoming frame is raised
 * over the outgoing one and fades in (CSS only, see `.gal-pic`). Dots are the
 * only frame control. Autoplay is slow (30s) and pauses while the pointer
 * rests on the dots or any control inside has focus — no visible pause
 * button, the band just quietly waits. It never runs under reduced motion.
 */
const AUTOPLAY_MS = 30_000;

export function Gallery({
  images, positions, label,
}: {
  images: readonly string[];
  positions?: readonly string[];
  label: string;
}) {
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState(0); // bumps on manual pick to restart the timer
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const count = images.length;
  const paused = hoverPaused || focusPaused;

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, count, pick]);

  // focus-within emulation for the dots pill
  const onFocusIn = () => setFocusPaused(true);
  const onFocusOut = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusPaused(false);
  };

  return (
    <>
      <div className="gal" aria-hidden>
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className="gal-pic"
            data-active={i === index}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            style={{ "--pos": positions?.[i] ?? "center" } as CSSProperties}
          />
        ))}
      </div>
      {/* v5.2 (loop iter 3): native fieldset (was div role="group"). */}
      <fieldset
        aria-label={label}
        className="gal-dots"
        onPointerEnter={() => setHoverPaused(true)}
        onPointerLeave={() => setHoverPaused(false)}
        onFocusCapture={onFocusIn}
        onBlurCapture={onFocusOut}
      >
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            aria-label={`${label} ${i + 1}/${count}`}
            aria-current={i === index}
            onClick={() => { setIndex(i); setPick((n) => n + 1); }}
          >
            <span />
          </button>
        ))}
      </fieldset>
    </>
  );
}
