"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition, type ChangeEvent } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

function nativeName(locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}

export function LanguageSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <select
      aria-label={t("language")}
      value={locale}
      onChange={onChange}
      disabled={isPending}
      className="h-9 rounded-md border border-input bg-background px-2 text-sm font-medium text-foreground shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
    >
      {routing.locales.map((code) => (
        <option key={code} value={code}>
          {nativeName(code)}
        </option>
      ))}
    </select>
  );
}
