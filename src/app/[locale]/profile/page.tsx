import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Crown, Settings } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("profileTitle") };
}

/** Profile — a light account overview for now; grows into goals,
 *  history and progress later. Signed-in only. */
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/profile");
  const t = await getTranslations({ locale, namespace: "profilePage" });

  const initials =
    (user.name?.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") ??
      user.email.slice(0, 2)).toUpperCase();

  return (
    <div data-world="shell" className="world page">
      <div className="wrap profile-wrap">
        <header className="page-head">
          <p className="eyebrow"><i />{t("eyebrow")}</p>
          <h1 className="display sm">{t("title")}</h1>
          <p className="lede">{t("subtitle")}</p>
        </header>

        <section className="set-panel profile-panel" aria-label={t("title")}>
          <div className="profile-top">
            <span className="avatar" style={{ "--px": "4rem" } as React.CSSProperties}>
              {initials}
            </span>
            <div>
              <h2 className="h3">{user.name ?? user.email}</h2>
              <p className="profile-mail">{user.email}</p>
            </div>
          </div>

          <div className="set-rows">
            <div className="set-row">
              <span className="set-info"><b>{t("name")}</b></span>
              <span className="set-val">{user.name ?? "—"}</span>
            </div>
            <div className="set-row">
              <span className="set-info"><b>{t("email")}</b></span>
              <span className="set-val">{user.email}</span>
            </div>
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
    </div>
  );
}
