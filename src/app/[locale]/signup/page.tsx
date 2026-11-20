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
  return { title: t("signupTitle") };
}

export default async function SignupPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in? Straight to the app.
  const user = await getSessionUser();
  if (user) redirect({ href: "/home", locale });

  const sp = await searchParams;
  const raw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  // v4.3: e-mail prefills — from the login form (no account + password
  // typed) or from a Google/Apple login that found no account.
  const prefillRaw = Array.isArray(sp.email) ? sp.email[0] : sp.email;
  const prefillEmail = typeof prefillRaw === "string" ? prefillRaw.trim().slice(0, 120) : "";
  const notice = sp.notice === "oauth_new" ? "oauth_new" : null;

  return (
    <div data-world="shell" className="world page">
      <div className="wrap auth-wrap">
        <AuthForm mode="signup" next={safeNext(raw)} prefillEmail={prefillEmail} notice={notice} />
      </div>
    </div>
  );
}
