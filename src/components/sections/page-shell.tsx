import type { CSSProperties, ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

type PageShellProps = {
  pageId: string;
  /** Optional section accent — overrides --primary/--ring (capstone per-section palette). */
  accent?: string;
  children: ReactNode;
};

/**
 * Shared shell for example pages (capstone system). The base palette is
 * the welcome shell theme (.pl-theme-welcome in globals.css) applied as a
 * CLASS — inline style attributes would outrank the .dark overrides and
 * freeze the page in light mode. An optional `accent` only re-points
 * --primary/--ring via CSS variables: accent hues stay valid in both
 * modes, so the inline override is dark-mode safe.
 */
export async function PageShell({ pageId, accent, children }: PageShellProps) {
  const t = await getTranslations("sections");

  const accentOverrides = accent
    ? ({ "--primary": accent, "--ring": `${accent}66` } as CSSProperties)
    : undefined;

  return (
    <div
      data-page={pageId}
      style={accentOverrides}
      className="pl-theme-welcome flex flex-1 flex-col bg-background font-sans text-foreground"
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
