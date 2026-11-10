"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

/**
 * The welcome-page CTA. Signed-in visitors go straight to their Home;
 * everyone else starts the account flow (signup) — no more fake
 * localStorage "account" flag.
 */
export function StartButton({
  className = "btn",
  signedIn = false,
  label,
}: {
  className?: string;
  signedIn?: boolean;
  label?: ReactNode;
}) {
  const t = useTranslations("welcomePage.cta");
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => router.push(signedIn ? "/home" : "/signup?next=/home")}
    >
      {label ?? t("start")}
      <ArrowRight size={16} aria-hidden />
    </button>
  );
}
