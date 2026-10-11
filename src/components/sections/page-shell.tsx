import type { CSSProperties, ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import "../../app/[locale]/welcome/welcome-theme.css";

type PageShellProps = {
  pageId: string;
  /** Optional section accent — overrides --primary/--ring (capstone per-section palette). */
  accent?: string;
  children: ReactNode;
};

/**
 * Light single-tone shell for example pages (capstone system).
 * When `accent` is set, primary actions and focus rings take the section color.
 */
export async function PageShell({ pageId, accent, children }: PageShellProps) {
  const t = await getTranslations("sections");

  const theme: CSSProperties = {
    "--background": "#F6F3ED",
    "--foreground": "#1F1D1A",
    "--card": "#FCFBF8",
    "--card-foreground": "#1F1D1A",
    "--popover": "#FCFBF8",
    "--popover-foreground": "#1F1D1A",
    "--primary": accent ?? "#1F1D1A",
    "--primary-foreground": "#FFFFFF",
    "--secondary": "#EBE7DE",
    "--secondary-foreground": "#3A362F",
    "--muted": "#EBE7DE",
    "--muted-foreground": "#6E695E",
    "--accent": "#E5E0D5",
    "--accent-foreground": "#1F1D1A",
    "--destructive": "#B3261E",
    "--border": "rgba(31,29,26,0.12)",
    "--input": "rgba(31,29,26,0.16)",
    "--ring": accent ? `${accent}66` : "rgba(31,29,26,0.4)",
  };

  return (
    <div
      data-page={pageId}
      style={theme}
      className="flex flex-1 flex-col bg-background font-sans text-foreground"
    >
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8 md:py-12">
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("backHome")}
        </Link>
        {children}
      </main>
    </div>
  );
}
