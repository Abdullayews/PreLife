import { getTranslations } from "next-intl/server";

export async function WelcomeFooter() {
  const t = await getTranslations("welcomePage.footer");

  return (
    <footer className="mt-auto border-t border-border/60">
      {/* Same container as every section (max-w-6xl + page gutters) so
          the footer's text lines up with the content grid site-wide. */}
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-10 text-sm text-muted-foreground sm:flex-row md:px-8">
        <p className="font-semibold tracking-tight text-foreground">
          {t("brand")}
        </p>
        <p>{t("tagline")}</p>
        <p>{t("rights")}</p>
      </div>
    </footer>
  );
}
