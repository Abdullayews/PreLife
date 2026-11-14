"use client";

import { useEffect, useState, type CSSProperties, type FocusEvent } from "react";
import { Pause, Play } from "lucide-react";

/**
 * Hero photo gallery. Frames are stacked layers; the incoming frame is raised
 * over the outgoing one and fades in (CSS only, see `.gal-pic`). Dots are the
 * only frame control. Autoplay is slow (30s) and pauses while the pointer
 * rests on the dots, while any control inside has focus, or when the visitor
 * flips the visible Pause button (WCAG 2.2.2). It never runs under reduced
 * motion — and the Pause control is hidden then, because there is nothing
 * left to pause.
 */
const AUTOPLAY_MS = 30_000;

export function Gallery({
  images, positions, label, pauseLabel, playLabel,
}: {
  images: readonly string[];
  positions?: readonly string[];
  label: string;
  pauseLabel: string;
  playLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState(0); // bumps on manual pick to restart the timer
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const count = images.length;
  const paused = userPaused || hoverPaused || focusPaused;

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, count, pick]);

  // focus-within emulation for the two floating controls (dots pill + toggle)
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
      <div
        role="group"
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
      </div>
      <button
        type="button"
        className="icon-btn gal-toggle"
        aria-pressed={userPaused}
        aria-label={userPaused ? playLabel : pauseLabel}
        onClick={() => setUserPaused((v) => !v)}
        onFocusCapture={onFocusIn}
        onBlurCapture={onFocusOut}
      >
        {userPaused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
      </button>
    </>
  );
}
