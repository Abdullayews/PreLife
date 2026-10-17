import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type Props = {
  title: string;
  description: string;
};

export async function ModulePlaceholder({ title, description }: Props) {
  const t = await getTranslations("modulePage");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:px-6">
      <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
        {t("comingSoon")}
      </span>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      <p className="max-w-xl text-muted-foreground">{description}</p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/">
          <ArrowLeft aria-hidden="true" />
          {t("backHome")}
        </Link>
      </Button>
    </div>
  );
}
