"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const CONSENT_COOKIE = "pl_cookies";

/**
 * Cookie consent bar — fixed to the bottom of every page until the
 * visitor accepts. Acceptance is stored in a cookie (read server-side
 * in the locale layout, so accepted visitors never see a flash).
 */
export function CookieConsent({ initialAccepted }: { initialAccepted: boolean }) {
  const t = useTranslations("cookieBar");
  const [accepted, setAccepted] = useState(initialAccepted);

  if (accepted) return null;

  const accept = () => {
    try {
      document.cookie = `${CONSENT_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* storage unavailable — hide for this visit anyway */
    }
    setAccepted(true);
  };

  return (
    <div className="cookie-bar" role="region" aria-label={t("text")}>
      <div className="cookie-in">
        <p>
          {t("text")} <Link href="/terms">{t("learnMore")}</Link>
        </p>
        <div className="cookie-actions">
          <button type="button" className="btn btn-sm" onClick={accept}>
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
