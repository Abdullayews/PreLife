import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppPageShell } from "@/components/AppPageShell";
import { LegalHead, LegalRelated, LegalSectionBlock } from "@/components/LegalDoc";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("cookiesTitle"), description: t("cookiesDescription") };
}

/**
 * The cookie policy — the honest inventory of every cookie, localStorage
 * key, and Cache API entry the site writes. Technical names are constants
 * kept in code (they are locale-independent facts); kind, purpose, and
 * lifetime are translated per catalog.
 */

/** The storage entries in display order (message keys under cookiesPage.cookies). */
const COOKIE_ORDER = [
  "pl_session", "pl_oauth", "pl_cookies", "NEXT_LOCALE",
  "pl_theme", "pl_motion", "sw_cache",
] as const;

/** The literal browser-storage name each entry is written under. */
const COOKIE_NAMES: Record<(typeof COOKIE_ORDER)[number], string> = {
  pl_session: "pl_session",
  pl_oauth: "pl_oauth",
  pl_cookies: "pl_cookies",
  NEXT_LOCALE: "NEXT_LOCALE",
  pl_theme: "pl-theme",
  pl_motion: "pl-motion",
  sw_cache: "prelife-offline-v1",
};

/** Sections before the inventory table. */
const PRE_TABLE = ["what", "principle"] as const;

/** Sections after the inventory table. */
const POST_TABLE = ["thirdparty", "control", "law", "contact"] as const;

export default async function CookiesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "cookiesPage" });

  const user = await getSessionUser();

  const sections = t.raw("sections") as Record<string, never>;
  const pre = PRE_TABLE.map((k) => sections[k]).filter(Boolean);
  const post = POST_TABLE.map((k) => sections[k]).filter(Boolean);
  const table = sections.table as { h: string; p1: string } | undefined;

  const body = (
    <div className="wrap">
      <header className="page-head">
        <p className="eyebrow"><i />PreLife</p>
        <h1 className="display sm">{t("title")}</h1>
      </header>
      <div className="legal">
        <LegalHead updated={t("updated")} intro={t("intro")} />
        {pre.map((sec, i) => (
          <LegalSectionBlock key={i} sec={sec} />
        ))}
        {table && (
          <section>
            <h2>{table.h}</h2>
            <p>{table.p1}</p>
            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead>
                  <tr>
                    <th scope="col">{t("tableHead.name")}</th>
                    <th scope="col">{t("tableHead.kind")}</th>
                    <th scope="col">{t("tableHead.purpose")}</th>
                    <th scope="col">{t("tableHead.life")}</th>
                  </tr>
                </thead>
                <tbody>
                  {COOKIE_ORDER.map((k) => (
                    <tr key={k}>
                      <td data-label={t("tableHead.name")}><code>{COOKIE_NAMES[k]}</code></td>
                      <td data-label={t("tableHead.kind")}>{t(`cookies.${k}.kind`)}</td>
                      <td data-label={t("tableHead.purpose")}>{t(`cookies.${k}.purpose`)}</td>
                      <td data-label={t("tableHead.life")}>{t(`cookies.${k}.life`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {post.map((sec, i) => (
          <LegalSectionBlock key={i} sec={sec} />
        ))}
        <LegalRelated
          label={t("seeAlso")}
          links={[<Link key="terms" href="/terms">{t("seeTerms")}</Link>]}
        />
      </div>
    </div>
  );

  if (user) {
    return <AppPageShell locale={locale}>{body}</AppPageShell>;
  }

  return (
    <div data-world="shell" className="world page">{body}</div>
  );
}
