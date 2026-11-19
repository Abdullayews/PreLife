import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Crown, Settings } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AppPageShell } from "@/components/AppPageShell";
import { ProfileEditor } from "@/components/ProfileEditor";
import { requireUser } from "@/lib/auth";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("profileTitle") };
}

/** Profile — own-data editing: avatar, body metrics, goal, plus the
 *  weight history. Signed-in only; ProfileEditor does the client work. */
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/profile");
  const t = await getTranslations({ locale, namespace: "profilePage" });

  return (
    <AppPageShell locale={locale}>
      <div className="wrap profile-wrap">
        <header className="page-head">
          <p className="eyebrow"><i />{t("eyebrow")}</p>
          <h1 className="display sm">{t("title")}</h1>
          <p className="lede">{t("subtitle")}</p>
        </header>

        <section className="set-panel profile-panel" aria-label={t("title")}>
          <ProfileEditor user={{ name: user.name, email: user.email }} />

          <div className="set-rows">
            <div className="set-row">
              <span className="set-info"><b>{t("plan")}</b></span>
              <span className="set-val">{t("planFree")}</span>
            </div>
          </div>

          <div className="profile-actions">
            <Link href="/settings" className="btn">
              <Settings size={16} aria-hidden />{t("settings")}
            </Link>
            <Link href="/subscription" className="btn btn-ghost">
              <Crown size={16} aria-hidden />{t("subscription")}
            </Link>
          </div>

          <p className="set-note">{t("note")}</p>
        </section>
      </div>
    </AppPageShell>
  );
}
