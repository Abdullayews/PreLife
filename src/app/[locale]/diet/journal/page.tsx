import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todaysPromptKey, JOURNAL_PROMPT_KEYS } from "@/lib/diet";
import { JournalCard } from "@/components/diet/JournalCard";
import { JournalList } from "@/components/diet/JournalList";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dietApp" });
  return { title: t("journalMetaTitle"), description: t("journalMetaDescription") };
}

export default async function JournalPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "dietApp" });
  const user = await requireUser(locale, "/diet/journal");

  const rows = await db.journalEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" });
  const promptKey = todaysPromptKey();

  return (
    <div data-world="diet" className="world page">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i /><Link href="/diet" className="backlink"><ArrowLeft size={14} aria-hidden /></Link>{t("journalPageEyebrow")}</p>
          <h1 className="display sm">{t("journalPageTitle")}</h1>
          <p className="lede">{t("journalPageSubtitle")}</p>
        </header>

        <section aria-labelledby="write-h" className="blk">
          <h2 id="write-h" className="eyebrow"><b>01</b>{t("journalEyebrow")}</h2>
          <JournalCard prompt={t(promptKey)} promptKey={promptKey} />
        </section>

        <section aria-labelledby="archive-h" className="blk">
          <h2 id="archive-h" className="eyebrow"><b>02</b>{t("journalArchive")}</h2>
          <JournalList
            entries={rows.map((r) => ({
              id: r.id,
              createdAt: fmt.format(r.createdAt),
              // Translate the stored prompt message key server-side; legacy
              // rows that predate real keys (or unknown values) show no tag.
              prompt: r.promptKey && JOURNAL_PROMPT_KEYS.includes(r.promptKey as (typeof JOURNAL_PROMPT_KEYS)[number])
                ? t(r.promptKey as (typeof JOURNAL_PROMPT_KEYS)[number])
                : null,
              content: r.content,
            }))}
          />
        </section>
      </div>
    </div>
  );
}
