"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { ACCOUNT_FLAG } from "./start-cta";

/**
 * Welcome funnel: if the visitor already "uses" the site (account flag in
 * browser storage), quietly move them to Home. Static stub until Phase 0 auth.
 */
export function FlagCheck() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(ACCOUNT_FLAG) === "1") {
        router.replace("/home");
      }
    } catch {
      /* storage unavailable — stay on welcome */
    }
  }, [router]);

  return null;
}
