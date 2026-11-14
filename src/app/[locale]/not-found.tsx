"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, Compass } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * Custom 404 — rendered whenever the DOMAIN is right but the ROUTE is
 * not: unknown paths under a valid locale (/en/xyz, /az/welcome/xyz …).
 * Invalid-locale paths are redirected by the middleware first, so this
 * one boundary covers every case. Client component: not-found renders
 * inside the locale layout, so next-intl works through useTranslations.
 */
export default function NotFound() {
  const t = useTranslations("notFoundPage");

  return (
    <div data-world="shell" className="world page">
      <div className="wrap uc nf">
        <span className="nf-ghost" aria-hidden>404</span>
        <span className="chip-ico solid"><Compass size={26} aria-hidden /></span>
        <p className="eyebrow"><i />{t("eyebrow")}</p>
        <h1 className="h2">{t("title")}</h1>
        <p className="lede">{t("text")}</p>
        <Link href="/welcome" className="btn btn-ghost">
          <ArrowLeft size={16} aria-hidden />{t("backHome")}
        </Link>
      </div>
    </div>
  );
}
