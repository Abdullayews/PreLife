import type { ReactNode } from "react";

/**
 * MEDITATION v2 = "Lavender Haze" palette (light) + "Violet Night" dark
 * variant. Cool lavender-white base + deep indigo ink, VIOLET (#7C3AED) as
 * the calm accent. All values live in globals.css (.pl-theme-meditation +
 * .dark .pl-theme-meditation) so the dark-mode toggle can rebalance surfaces
 * without touching this file. Shared helpers live in globals.css (v3).
 */
export default function MeditationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      data-module="meditation"
      className="pl-theme-meditation flex flex-1 flex-col bg-background text-foreground"
    >
      {children}
    </div>
  );
}

