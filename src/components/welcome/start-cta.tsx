"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

export const ACCOUNT_FLAG = "prelife.account-active";

type StartCtaProps = {
  /** Button variant — "default" (dark pill on light) or "secondary" (light pill on dark band). */
  variant?: ComponentProps<typeof Button>["variant"];
  /** Override the label (defaults to the hero CTA text). */
  label?: string;
  /** Button size — "lg" for hero/band placements, "sm" for headers. */
  size?: ComponentProps<typeof Button>["size"];
  /** Extra classes appended to the button (default: "rounded-full px-8"). */
  className?: string;
  /** Show the trailing arrow (default true). */
  withArrow?: boolean;
};

/**
 * Sets the account stub flag and opens the Home dashboard.
 * (Test-only funnel until Phase 0 auth lands.)
 */
export function StartCta({
  variant = "default",
  label,
  size = "lg",
  className = "rounded-full px-8",
  withArrow = true,
}: StartCtaProps) {
  const t = useTranslations("welcomePage.cta");
  const router = useRouter();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        try {
          window.localStorage.setItem(ACCOUNT_FLAG, "1");
        } catch {
          /* storage unavailable — continue */
        }
        router.push("/home");
      }}
    >
      {label ?? t("start")}
      {withArrow && <ArrowRight className="size-4" aria-hidden="true" />}
    </Button>
  );
}
