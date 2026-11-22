import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { AppPageShell } from "@/components/AppPageShell";
import { AdminPanel } from "@/components/admin/AdminPanel";

type Props = { params: Promise<{ locale: string }> };

/**
 * The administrator's console (v5.4 role system) — the platform's
 * read-only management overview: open sessions, the appointment funnel,
 * content counts and user activity. Non-admin accounts get a no-access
 * notice instead.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "adminApp" });
  return { title: t("title") };
}

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/admin");
  const t = await getTranslations({ locale, namespace: "adminApp" });

  return (
    <AppPageShell locale={locale}>
      {user.role === "admin" ? (
        <AdminPanel />
      ) : (
        <div className="wrap">
          <header className="page-head">
            <h1 className="display sm">{t("title")}</h1>
          </header>
          <p className="lede">{t("noAccess")}</p>
        </div>
      )}
    </AppPageShell>
  );
}
