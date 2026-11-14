"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * The scrolling word band between hero and content (WCAG 2.2.2): the CSS
 * animation pauses on hover, on focus-within (the toggle itself), and while
 * the visitor has pressed the visible Pause button — `data-paused` carries
 * that state to the stylesheet. Under prefers-reduced-motion the band is a
 * static wrapped list and the toggle is hidden (nothing to pause).
 */
export function Marquee({
  items, pauseLabel, playLabel,
}: {
  items: string[];
  pauseLabel: string;
  playLabel: string;
}) {
  const [paused, setPaused] = useState(false);
  return (
    <div className="marquee" data-paused={paused || undefined} aria-label={items.join(", ")}>
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden="true">
            {items.map((word) => <li key={word}>{word}</li>)}
          </ul>
        ))}
      </div>
      <button
        type="button"
        className="icon-btn marquee-toggle"
        aria-pressed={paused}
        aria-label={paused ? playLabel : pauseLabel}
        onClick={() => setPaused((v) => !v)}
      >
        {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
      </button>
    </div>
  );
}
