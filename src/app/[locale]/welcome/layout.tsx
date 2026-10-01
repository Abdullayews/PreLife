import type { CSSProperties, ReactNode } from "react";
import "./welcome-theme.css";

const welcomeTheme = {
  /* Capstone: ana sayfa = single light tone, large scale. Warm bone single-tone. */
  "--background": "#F6F3ED",
  "--foreground": "#1F1D1A",
  "--card": "#FCFBF8",
  "--card-foreground": "#1F1D1A",
  "--popover": "#FCFBF8",
  "--popover-foreground": "#1F1D1A",
  "--primary": "#1F1D1A",
  "--primary-foreground": "#F6F3ED",
  "--secondary": "#EBE7DE",
  "--secondary-foreground": "#3A362F",
  "--muted": "#EBE7DE",
  "--muted-foreground": "#6E695E",
  "--accent": "#E5E0D5",
  "--accent-foreground": "#1F1D1A",
  "--destructive": "#B3261E",
  "--border": "rgba(31,29,26,0.12)",
  "--input": "rgba(31,29,26,0.16)",
  "--ring": "rgba(31,29,26,0.4)",
  "--on-accent": "#FFFFFF",
} as CSSProperties;

export default function WelcomeLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-page="welcome"
      style={welcomeTheme}
      className="flex flex-1 flex-col bg-background font-sans text-foreground"
    >
      {children}
    </div>
  );
}
