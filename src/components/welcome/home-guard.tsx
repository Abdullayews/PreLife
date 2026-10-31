"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { ACCOUNT_FLAG } from "./start-cta";

/**
 * Home guard: visitors without the account flag go back to Welcome.
 * Static stub until Phase 0 auth.
 */
export function HomeGuard() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(ACCOUNT_FLAG) !== "1") {
        router.replace("/welcome");
      }
    } catch {
      /* storage unavailable — let them stay */
    }
  }, [router]);

  return null;
}
