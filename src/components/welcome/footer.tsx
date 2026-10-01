import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function WelcomeFooter() {
  const t = await getTranslations("welcomePage.footer");

  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-10 text-sm text-muted-foreground sm:flex-row md:px-8">
        <p className="font-semibold tracking-tight text-foreground">
          {t("brand")}
        </p>
        <div className="flex items-center gap-4">
          <p>{t("tagline")}</p>
          <span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
          <Link
            href="/ui"
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {t("design")}
          </Link>
        </div>
        <p>{t("rights")}</p>
      </div>
    </footer>
  );
}
