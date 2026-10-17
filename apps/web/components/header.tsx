import { Link } from "@/i18n/navigation";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MobileNav, NavLinks } from "@/components/nav-links";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight"
          aria-label="PreLife home"
        >
          PreLife<span className="text-primary">.</span>
        </Link>
        <div className="flex items-center gap-2">
          <NavLinks />
          <LanguageSwitcher />
        </div>
      </div>
      <MobileNav />
    </header>
  );
}
