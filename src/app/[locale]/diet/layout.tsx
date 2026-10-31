import type { ReactNode } from "react";

/**
 * DIET v2 = "Golden Harvest" palette (light) + "Amber Night" dark variant.
 * Warm cream base + espresso ink, AMBER (#D97706) as the appetite accent.
 * All values live in globals.css (.pl-theme-diet + .dark .pl-theme-diet) so
 * the dark-mode toggle can rebalance surfaces without touching this file.
 * Shared reveal/glass/display helpers live in globals.css (PreLife v3).
 */
export default function DietLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-module="diet"
      className="pl-theme-diet flex flex-1 flex-col bg-background text-foreground"
    >
      {children}
    </div>
  );
}

