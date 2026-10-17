import type { CSSProperties, ReactNode } from "react";

import { getModule } from "@/lib/modules";

const mod = getModule("library");

/**
 * Per-page theme: the visual identity of this module is defined HERE and
 * applies only inside this subtree - nothing global moves. Override any
 * design token (--primary, --ring, --radius, ...); every component using
 * bg-primary / text-primary-foreground / ring-ring etc. picks it up
 * automatically at runtime. Change values freely - no other file is affected.
 */
const libraryTheme = {
  "--primary": mod.accent,
  "--primary-foreground": "#ffffff",
  "--ring": mod.accent,
} as CSSProperties;

export default function LibraryLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-module="library"
      style={libraryTheme}
      className="flex flex-1 flex-col"
    >
      {children}
    </div>
  );
}
