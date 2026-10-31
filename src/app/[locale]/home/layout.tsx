import type { ReactNode } from "react";
import "../welcome/welcome-theme.css";

/**
 * Home v3.1: shares the welcome shell system ("Warm Bone" light /
 * "Espresso Night" dark) — the two tabs are one surface. The palette
 * lives in globals.css (.pl-theme-welcome + .dark override) so the dark
 * toggle can rebalance it (inline styles would outrank .dark).
 */
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-page="home"
      className="pl-theme-welcome flex flex-1 flex-col bg-background font-sans text-foreground"
    >
      {children}
    </div>
  );
}
