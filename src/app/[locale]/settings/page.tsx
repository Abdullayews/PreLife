import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SettingsPage } from "@/components/SettingsPage";
import { AppPageShell } from "@/components/AppPageShell";
import { requireUser } from "@/lib/auth";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("settingsTitle") };
}

/** Settings — signed-in only; lives at /[locale]/settings. */
export default async function SettingsRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/settings");

  return (
    <AppPageShell locale={locale}>
      <SettingsPage user={{ name: user.name, email: user.email }} />
    </AppPageShell>
  );
}
