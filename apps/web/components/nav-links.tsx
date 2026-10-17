"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { MODULES } from "@/lib/modules";
import { cn } from "@/lib/utils";

function useNavItems() {
  const t = useTranslations("nav");
  return [
    { href: "/", label: t("home") },
    ...MODULES.map((module) => ({
      href: `/${module.slug}`,
      label: t(module.slug),
    })),
  ];
}

export function NavLinks() {
  const items = useNavItems();
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {items.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
            pathname === href ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const items = useNavItems();
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:hidden"
    >
      {items.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "whitespace-nowrap rounded-full border px-3 py-2 text-xs font-medium transition-colors",
            pathname === href
              ? "border-primary bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
