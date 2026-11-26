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
  // v5.5: the provider callback now OPENS accounts (existing — including
  // pending mail registrations — confirmed on the spot; brand-new
  // identities provisioned directly), so it no longer redirects here with
  // a notice. The ?email=…&notice=mail_sent / oauth_new / unconfirmed
  // shapes below are legacy links from older deployments only.
  const prefillRaw = Array.isArray(sp.email) ? sp.email[0] : sp.email;
  const prefillEmail = typeof prefillRaw === "string" ? prefillRaw.trim().slice(0, 120) : "";
  const notice =
    sp.notice === "mail_sent"
      ? "mail_sent"
      : sp.notice === "oauth_new"
        ? "oauth_new"
        : sp.notice === "unconfirmed"
          ? "unconfirmed"
          : null;
  // The sandbox dev link — only trusted when it is a link back into
  // this site (never a javascript: payload from a crafted URL).
  const devRaw = Array.isArray(sp.devlink) ? sp.devlink[0] : sp.devlink;
  const devLink =
    notice === "mail_sent" && typeof devRaw === "string"
      && (/^https?:\/\//i.test(devRaw) || devRaw.startsWith("/"))
      ? devRaw.slice(0, 2048)
      : null;

  return (
    <div data-world="shell" className="world page">
      <div className="wrap auth-wrap">
        <AuthForm
          mode="login"
          next={safeNext(raw)}
          oauthError={oauthError}
          prefillEmail={prefillEmail}
          notice={notice}
          mailDevLink={devLink}
        />
      </div>
    </div>
  );
}
