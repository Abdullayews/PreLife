import type { ReactNode } from "react";
import "./welcome-theme.css";

/**
 * Welcome v3.1: "Warm Bone" (light) / "Espresso Night" (dark).
 * The palette lives in globals.css (.pl-theme-welcome + .dark override) —
 * as a CLASS, never an inline style: inline style attributes outrank the
 * .dark overrides and would freeze the page in light mode.
 */
export default function WelcomeLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-page="welcome"
      className="pl-theme-welcome flex flex-1 flex-col bg-background font-sans text-foreground"
    >
      {children}
    </div>
  );
}
