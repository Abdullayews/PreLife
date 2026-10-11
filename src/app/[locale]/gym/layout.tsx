import type { ReactNode } from "react";

/**
 * GYM v2 -> v3.1: "Ember on Bone" (light) with "Ember Night" dark variant.
 * The warm paper base + espresso ink keep gym in the same light family as
 * diet/meditation/library, while EMBER (#E4572E) stays the energy accent and
 * MERLOT (#722F37) the deep heritage tone for bands and gradients.
 * All values live in globals.css (.pl-theme-gym + .dark .pl-theme-gym) so
 * the dark-mode toggle can rebalance surfaces without touching this file.
 */
const gymStyles = `
.gym-display { font-family: "Montserrat", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.gym-hero-ghost:hover { background-color: var(--on-hero-fill-strong) !important; }
@keyframes gym-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.gym-marquee-track { animation: gym-marquee 38s linear infinite; }
.gym-marquee:hover .gym-marquee-track { animation-play-state: paused; }
.gym-marquee-sep::before { content: "\\2726"; color: var(--gym-ember); font-size: 0.62em; letter-spacing: 0; }
@keyframes gym-rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .gym-marquee-track { animation: none; }
}
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .gym-reveal { animation: gym-rise linear both; animation-timeline: view(); animation-range: entry 5% cover 24%; }
  }
}
`;

export default function GymLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-module="gym"
      className="pl-theme-gym flex flex-1 flex-col bg-background text-foreground"
    >
      {/* The shared site nav (components/site-nav.tsx) serves gym too -
          globals.css retints its glass via body:has(). */}
      <style>{gymStyles}</style>
      {children}
    </div>
  );
}
