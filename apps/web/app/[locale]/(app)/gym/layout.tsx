import type { CSSProperties, ReactNode } from "react";

import { getModule } from "@/lib/modules";

const mod = getModule("gym");

/**
 * Per-page theme: the visual identity of this module is defined HERE and
 * applies only inside this subtree - nothing global moves. Override any
 * design token (--primary, --ring, --radius, ...); every component using
 * bg-primary / text-primary-foreground / ring-ring etc. picks it up
 * automatically at runtime. Change values freely - no other file is affected.
 */
const gymTheme = {
  "--primary": mod.accent,
  "--primary-foreground": "#ffffff",
  "--ring": mod.accent,
} as CSSProperties;

export default function GymLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-module="gym"
      style={gymTheme}
      className="flex flex-1 flex-col"
    >
      {children}
    </div>
  );
}
