import { getTranslations } from "next-intl/server";
import { ArrowLeft, HardHat } from "lucide-react";
import { Link } from "@/i18n/navigation";

/** Placeholder for the main pages that are still being built. */
export async function UnderConstruction({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "underConstruction" });
  return (
    <div className="wrap uc">
      <span className="chip-ico solid"><HardHat size={26} aria-hidden /></span>
      <p className="eyebrow"><i />{t("eyebrow")}</p>
      <h1 className="h2">{t("title")}</h1>
      <p className="lede">{t("text")}</p>
      <Link href="/home" className="btn btn-ghost">
        <ArrowLeft size={16} aria-hidden />{t("backHome")}
      </Link>
    </div>
  );
}
