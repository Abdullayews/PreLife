"use client";

/**
 * The scrolling word band between hero and content. The CSS animation
 * pauses on hover and on focus-within — no visible control needed.
 * Under prefers-reduced-motion the band is a static wrapped list.
 *
 * No aria-label on the band: ARIA prohibits aria-label on a plain <div>
 * (axe: aria-prohibited-attr) and screen readers gain nothing from it —
 * the words are a decorative repetition of section themes.
 */
export function Marquee({ items }: { items: string[] }) {
  return (
    <div className="marquee">
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden="true">
            {items.map((word) => <li key={word}>{word}</li>)}
          </ul>
        ))}
      </div>
    </div>
  );
}
