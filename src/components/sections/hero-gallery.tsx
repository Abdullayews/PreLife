"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hero picture switcher (BetterMe-store-style). The hero photo becomes a
 * small gallery: stacked .pl-hero-pic layers crossfade (plus a slow scale
 * settle — see globals.css; only opacity/transform animate, so nothing
 * re-filters per frame), and a cluster of liquid-glass controls sits at
 * the hero's bottom-right: two circular arrows flanking a dot pill.
 * Auto-advances every 7s; hovering the controls or pressing one
 * pauses/restarts the cycle. prefers-reduced-motion disables autoplay.
 *
 * Rendered inside the hero <section> (relative isolate): the photo stack
 * is absolutely positioned behind the scrims (-z-20), the controls above
 * them. The default anchor is bottom-right; the welcome hero re-anchors
 * the cluster via controlsClassName (top-right on mobile, where its
 * liquid-glass copy panel owns the bottom of the fold).
 */
type HeroGalleryProps = {
  /** Photo URLs (first is the initial frame). */
  images: readonly string[];
  /** Optional per-photo background-position, e.g. "center 35%". */
  positions?: readonly string[];
  /** i18n labels (moduleCommon.gallery*). */
  label: string;
  prevLabel: string;
  nextLabel: string;
  /** Override the switcher cluster's anchor classes. */
  controlsClassName?: string;
};

const AUTO_ADVANCE_MS = 7000;

export function HeroGallery({
  images,
  positions,
  label,
  prevLabel,
  nextLabel,
  controlsClassName = "absolute bottom-8 right-4 md:right-6",
}: HeroGalleryProps) {
  const [index, setIndex] = useState(0);
  const [manualTick, setManualTick] = useState(0);
  const [hovering, setHovering] = useState(false);
  const count = images.length;

  const go = (direction: 1 | -1) => {
    setIndex((i) => (i + direction + count) % count);
    setManualTick((t) => t + 1);
  };

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

      {/* Liquid-glass switcher (BetterMe-style circular arrows + dots) */}
      <div
        role="group"
        aria-label={label}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        className={cn(
          "z-10 flex items-center gap-2.5",
          controlsClassName,
        )}
      >
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label={prevLabel}
          className="pl-liquid grid size-11 place-items-center rounded-full text-(--on-hero) transition-transform duration-300 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-accent)"
        >
          <ChevronLeft aria-hidden className="size-5" strokeWidth={2} />
        </button>

        <div className="pl-liquid flex items-center gap-1.5 rounded-full px-3 py-2">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                setIndex(i);
                setManualTick((t) => t + 1);
              }}
              aria-label={`${label} ${i + 1}/${count}`}
              aria-current={i === index}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? "1.25rem" : "0.375rem",
                backgroundColor:
                  i === index
                    ? "var(--site-accent)"
                    : "color-mix(in srgb, var(--on-hero) 45%, transparent)",
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label={nextLabel}
          className="pl-liquid grid size-11 place-items-center rounded-full text-(--on-hero) transition-transform duration-300 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-accent)"
        >
          <ChevronRight aria-hidden className="size-5" strokeWidth={2} />
        </button>
      </div>
    </>
  );
}
