import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("welcomePage.footer");
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <strong>{t("brand")}</strong>
        <span>{t("tagline")}</span>
        <span>{t("rights")}</span>
      </div>
    </footer>
  );
}
