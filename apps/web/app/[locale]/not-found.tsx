"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFoundPage() {
  const t = useTranslations("notFound");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center sm:px-6">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {t("description")}
      </p>
      <Button asChild size="lg" className="mt-2">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </div>
  );
}
