"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api-url";
import { Trash2 } from "lucide-react";

export type JournalRow = { id: string; createdAt: string; prompt: string | null; content: string };

/** Journal archive list — server passes pre-translated prompt labels and
 *  pre-formatted dates; the client only wires the delete action. */
export function JournalList({ entries }: { entries: JournalRow[] }) {
  const t = useTranslations("psychApp");
  const router = useRouter();
  const [pending, start] = useTransition();

  const remove = (id: string) =>
    start(async () => {
      await fetch(apiUrl(`/api/psych/journal/${id}`), { method: "DELETE" });
      router.refresh();
    });

  if (entries.length === 0) {
    return <p className="lede">{t("journalEmpty")}</p>;
  }

  return (
    <ul className="jrnl" aria-live="polite">
      {entries.map((e) => (
        <li key={e.id} className="jrnl-entry">
          <div className="row">
            <time>{e.createdAt}</time>
            {e.prompt && <span className="tag tinted">{e.prompt}</span>}
            <button
              type="button"
              className="icon-btn"
              style={{ marginLeft: "auto" }}
              onClick={() => remove(e.id)}
              disabled={pending}
              aria-label={t("journalDelete")}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
          <p>{e.content}</p>
        </li>
      ))}
    </ul>
  );
}
