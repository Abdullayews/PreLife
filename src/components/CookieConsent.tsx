"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { acceptCookies, persistLocale, setThemeChoice } from "@/lib/consent";

/**
 * Cookie consent bar — fixed to the bottom of every page until the
 * visitor answers. Acceptance is stored in a cookie (read server-side
 * in the locale layout, so accepted visitors never see a flash).
 *
 * Accepting also promotes the preferences already chosen this visit
 * (theme, language) from visit-scoped to persistent storage, and from
 * then on every change is persisted — see lib/consent.ts.
 *
 * REJECTING stores nothing at all — not even a “said no” cookie —
 * because the pre-consent zero-storage promise forbids any write
 * before acceptance. The bar is dismissed for THIS visit (in-memory
 * state) and will reappear on the next one. That compromise is
 * deliberate: it is the only behavior compatible with the promise.
 */
export function CookieConsent({ initialAccepted }: { initialAccepted: boolean }) {
  const t = useTranslations("cookieBar");
  const locale = useLocale();
  const [accepted, setAccepted] = useState(initialAccepted);
  const [rejected, setRejected] = useState(false); // this visit only — memory
  const barRef = useRef<HTMLDivElement>(null);

  // While the bar is up, reserve its height on <body> so the fixed banner
  // can never cover page content — its height varies a lot between locales
  // (Russian strings wrap to 2–3 lines on phones) and with the safe-area.
  useEffect(() => {
    if (accepted || rejected) return;
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
  }, [accepted, rejected]);

  // Keep the locale cookie in sync for consented visitors who arrive on a
  // different language than the one remembered (e.g. following a shared
  // /ru link) — their latest visited language is the one that sticks.
  useEffect(() => {
    if (accepted) persistLocale(locale);
  }, [accepted, locale]);

  if (accepted || rejected) return null;

  const accept = () => {
    try {
      acceptCookies();
      // Promote this visit's choices to persistent storage. The consent
      // cookie is set now, so setThemeChoice also writes localStorage.
      setThemeChoice(document.documentElement.classList.contains("dark"));
      persistLocale(locale);
    } catch {
      /* storage unavailable — hide for this visit anyway */
    }
    setAccepted(true);
  };

  const reject = () => {
    // Zero-storage rule: no cookie, no localStorage, no sessionStorage —
    // the dismissal lives in React state and dies with the tab.
    setRejected(true);
  };

  return (
    <section ref={barRef} className="cookie-bar" aria-label={t("text")}>
      <div className="cookie-in">
        <p>
          {t("text")} <Link href="/cookies">{t("learnMore")}</Link>
        </p>
        <div className="cookie-actions">
          <button type="button" className="btn btn-sm" onClick={accept}>
            {t("accept")}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={reject}>
            {t("reject")}
          </button>
        </div>
      </div>
    </section>
  );
}
