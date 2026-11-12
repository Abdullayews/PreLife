"use client";

import { useEffect, useRef, useState } from "react";
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
  const barRef = useRef<HTMLDivElement>(null);

  // While the bar is up, reserve its height on <body> so the fixed banner
  // can never cover page content — its height varies a lot between locales
  // (Russian strings wrap to 2–3 lines on phones) and with the safe-area.
  useEffect(() => {
    if (accepted) return;
    const bar = barRef.current;
    if (!bar) return;
    const reserve = () => {
      document.body.style.paddingBottom = `${bar.offsetHeight + 12}px`;
    };
    reserve();
    const ro = new ResizeObserver(reserve);
    ro.observe(bar);
    window.addEventListener("resize", reserve);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", reserve);
      document.body.style.paddingBottom = "";
    };
  }, [accepted]);

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
    <div ref={barRef} className="cookie-bar" role="region" aria-label={t("text")}>
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
