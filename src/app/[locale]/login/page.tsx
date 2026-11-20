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
  // /api/auth/callback redirects here with ?error=oauth when the Google /
  // Apple flow fails (provider not configured in Supabase, denied consent…).
  const oauthError = sp.error === "oauth";
  // v4.4: it also redirects here with ?email=…&notice=oauth_new when a
  // Google/Apple LOGIN found no account — the mail registration starts
  // right on this page (the e-mail arrives prefilled).
  const prefillRaw = Array.isArray(sp.email) ? sp.email[0] : sp.email;
  const prefillEmail = typeof prefillRaw === "string" ? prefillRaw.trim().slice(0, 120) : "";
  const notice = sp.notice === "oauth_new" ? "oauth_new" : null;

  return (
    <div data-world="shell" className="world page">
      <div className="wrap auth-wrap">
        <AuthForm
          mode="login"
          next={safeNext(raw)}
          oauthError={oauthError}
          prefillEmail={prefillEmail}
          notice={notice}
        />
      </div>
    </div>
  );
}
