"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { ACCOUNT_FLAG } from "@/lib/shell";

/** Static stub of the account funnel (until real auth): a flag in localStorage. */
function useFlagRedirect(wantFlag: boolean, to: "/home" | "/welcome") {
  const router = useRouter();
  useEffect(() => {
    try {
      const has = window.localStorage.getItem(ACCOUNT_FLAG) === "1";
      if (has === wantFlag) router.replace(to);
    } catch { /* storage unavailable — stay put */ }
  }, [router, wantFlag, to]);
}

/** /welcome: visitors who already "use" the site move on to /home. */
export function SkipIfActive() { useFlagRedirect(true, "/home"); return null; }
/** /home: visitors without the flag go back to /welcome. */
export function RequireActive() { useFlagRedirect(false, "/welcome"); return null; }

/** Sets the flag and opens /home. */
export function StartButton({ className = "btn", label }: { className?: string; label?: ReactNode }) {
  const t = useTranslations("welcomePage.cta");
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        try { window.localStorage.setItem(ACCOUNT_FLAG, "1"); } catch { /* continue */ }
        router.push("/home");
      }}
    >
      {label ?? t("start")}
      <ArrowRight size={16} aria-hidden />
    </button>
  );
}
