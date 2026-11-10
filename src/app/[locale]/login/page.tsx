import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AuthForm } from "@/components/AuthForm";
import { safeNext } from "@/lib/next-url";
import { getSessionUser } from "@/lib/auth";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("loginTitle") };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in? Straight to the app.
  const user = await getSessionUser();
  if (user) redirect({ href: "/home", locale });

  const sp = await searchParams;
  const raw = Array.isArray(sp.next) ? sp.next[0] : sp.next;

  return (
    <div data-world="shell" className="world page">
      <div className="wrap auth-wrap">
        <AuthForm mode="login" next={safeNext(raw)} />
      </div>
    </div>
  );
}
