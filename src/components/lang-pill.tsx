"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Globe } from "lucide-react";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Region pill shared by the welcome and home headers: shows the active
 * locale, wraps a hidden <select> so the whole pill is clickable. Keeps the
 * current pathname when switching languages.
 *
 * variant="region" — ultrahuman.com spec (28px tall, hairline black/15
 * border, transparent background, 14px/500 label).
 * variant="default" — compact pill used by the dashboard (home) header.
 */
export function LangPill({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "region";
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function languageName(code: string) {
    try {
      return (
        new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code
      );
    } catch {
      return code;
    }
  }

  return (
    <label
      className={cn(
        "relative inline-flex cursor-pointer items-center rounded-full",
        variant === "region"
          ? "h-7 gap-1.5 border border-black/15 bg-transparent px-1.5 text-sm font-medium text-[#111]"
          : "h-9 gap-1.5 border border-border bg-secondary/50 px-3 text-xs font-medium text-foreground/90",
      )}
    >
      <Globe
        className={cn(
          "text-black/50",
          variant === "region" ? "size-4" : "size-3.5 text-muted-foreground",
        )}
        aria-hidden="true"
      />
      {locale.toUpperCase()}
      <select
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
        value={locale}
        onChange={(event) =>
          router.replace(pathname, { locale: event.target.value })
        }
        aria-label={label}
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {languageName(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
