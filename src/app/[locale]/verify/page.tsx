import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VerifyPanel } from "@/components/VerifyPage";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "verifyPage" });
  return { title: t("title") };
}

/** /verify — the landing page of the e-mail confirmation link. The API
 * route (/api/auth/verify) redirects here with ?status=ok|expired|invalid
 * (and ?email= when known, to prefill the resend form). */
export default async function VerifyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div data-world="shell" className="world page">
      <div className="wrap auth-wrap">
        <VerifyPanel />
      </div>
    </div>
  );
}
