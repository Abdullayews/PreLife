import type { ReactNode } from "react";

/**
 * LIBRARY v2 = "Paper & Teal" palette (light) + "Pine Night" dark variant.
 * Warm paper base + deep pine ink, TEAL (#0D9488) as the reading accent.
 * All values live in globals.css (.pl-theme-library + .dark .pl-theme-library)
 * so the dark-mode toggle can rebalance surfaces without touching this file.
 * Shared reveal/glass/display helpers live in globals.css (PreLife v3).
 */
export default function LibraryLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-module="library"
      className="pl-theme-library flex flex-1 flex-col bg-background text-foreground"
    >
      {children}
    </div>
  );
}

