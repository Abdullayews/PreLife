import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const t = await getTranslations("welcomePage.footer");
  const ta = await getTranslations("accountMenu");
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <strong>{t("brand")}</strong>
        <nav className="foot-links" aria-label={t("brand")}>
          <Link href="/terms">{ta("terms")}</Link>
          <Link href="/rules">{ta("rules")}</Link>
        </nav>
        <span>{t("tagline")}</span>
        <span>{t("rights")}</span>
      </div>
    </footer>
  );
}
