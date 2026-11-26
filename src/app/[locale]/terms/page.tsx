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
  return { title: t("termsTitle"), description: t("termsDescription") };
}

/** The section order — the catalog stores them keyed, code fixes the order. */
const SECTION_ORDER = [
  "accept", "service", "account", "notmedical", "ai", "sessions", "payments",
  "content", "fairuse", "ip", "data", "changes", "liability", "terminate",
  "law", "contact",
] as const;

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "termsPage" });

  /* v2.2: signed-in users have no top Nav, so they get the left
   * management rail around the page (the same shell /help uses);
   * guests keep the plain marketing layout. */
  const user = await getSessionUser();

  const sections = t.raw("sections") as Record<string, never>;
  const ordered = SECTION_ORDER.map((k) => sections[k]).filter(Boolean);

  const body = (
    <div className="wrap">
      <header className="page-head">
        <p className="eyebrow"><i />PreLife</p>
        <h1 className="display sm">{t("title")}</h1>
      </header>
      <div className="legal">
        <LegalHead updated={t("updated")} intro={t("intro")} />
        {ordered.map((sec, i) => (
          <LegalSectionBlock key={i} sec={sec} />
        ))}
        <LegalRelated
          label={t("seeAlso")}
          links={[
            <Link key="cookies" href="/cookies">{t("seeCookies")}</Link>,
            <Link key="rules" href="/rules">{t("seeRules")}</Link>,
          ]}
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
