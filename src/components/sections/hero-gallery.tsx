"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Hero picture switcher (BetterMe-store-style). The hero photo becomes a
 * small gallery: stacked .pl-hero-pic layers cross-dissolve — the incoming
 * frame is raised above the outgoing one and dissolves over it while the
 * old frame clears underneath (see globals.css; only opacity/transform
 * animate, so nothing re-filters per frame). The only control is a
 * liquid-glass dot pill pinned to the middle of the fold's bottom edge:
 * no prev/next arrows — tapping a dot IS the jump. Auto-advances every
 * 30s (a deliberate, calm drift rather than a carousel); hovering the
 * pill or tapping a dot pauses/restarts the cycle.
 * prefers-reduced-motion disables autoplay.
 *
 * Rendered inside the hero <section> (relative isolate): the photo stack
 * is absolutely positioned behind the scrims (-z-20), the dot pill above
 * them. The default anchor is centered along the bottom edge; heroes can
 * re-anchor it via controlsClassName if their layout needs the band.
 */
type HeroGalleryProps = {
  /** Photo URLs (first is the initial frame). */
  images: readonly string[];
  /** Optional per-photo background-position, e.g. "center 35%". */
  positions?: readonly string[];
  /** i18n label (moduleCommon.galleryLabel). */
  label: string;
  /** Override the dot pill's anchor classes. */
  controlsClassName?: string;
};

const AUTO_ADVANCE_MS = 30000;

export function HeroGallery({
  images,
  positions,
  label,
  controlsClassName = "absolute inset-x-0 bottom-5 justify-center md:bottom-7",
}: HeroGalleryProps) {
  const [index, setIndex] = useState(0);
  const [manualTick, setManualTick] = useState(0);
  const [hovering, setHovering] = useState(false);
  const count = images.length;

  useEffect(() => {
    if (hovering || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      AUTO_ADVANCE_MS,
    );
    return () => window.clearInterval(id);
  }, [hovering, count, manualTick]);

  return (
    <>
      {/* Photo stack — behind the scrims */}
      <div aria-hidden className="absolute inset-0 -z-20 overflow-hidden">
        {images.map((src, i) => (
          <div
            key={src}
            className="pl-hero-pic"
            data-active={i === index}
            style={
              {
                backgroundImage: `url(${src})`,
                "--pic-pos": positions?.[i] ?? "center",
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* Liquid-glass dot pill — the switcher's only control, centered at
          the bottom edge of the fold. Each dot is a 32px hit target
          (past WCAG 2.5.8's 24px minimum, on the 4px grid); the active
          dot stretches into a small bar. */}
      <div
        role="group"
        aria-label={label}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        className={cn("z-10 flex items-center", controlsClassName)}
      >
        <div className="pl-liquid flex items-center gap-1 rounded-full p-1.5">
          {images.map((src, i) => {
            const active = i === index;
            return (
              <button
                key={src}
                type="button"
                onClick={() => {
                  setIndex(i);
                  setManualTick((t) => t + 1);
                }}
                aria-label={`${label} ${i + 1}/${count}`}
                aria-current={active}
                className="grid size-8 place-items-center rounded-full transition-transform duration-300 hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-accent)"
              >
                <span
                  aria-hidden
                  className="block h-2 rounded-full transition-all duration-300"
                  style={{
                    width: active ? "1.6rem" : "0.5rem",
                    backgroundColor: active
                      ? "var(--site-accent)"
                      : "color-mix(in srgb, var(--on-hero) 42%, transparent)",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
