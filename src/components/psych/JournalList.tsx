"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api-url";
import { toast } from "@/components/Toaster";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Trash2 } from "lucide-react";

export type JournalRow = { id: string; createdAt: string; prompt: string | null; content: string };

/** Journal archive list — server passes pre-translated prompt labels and
 *  pre-formatted dates; the client only wires the delete action (behind
 *  the shared confirm guard since entries are deleted for good). */
export function JournalList({ entries }: { entries: JournalRow[] }) {
  const t = useTranslations("psychApp");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [askId, setAskId] = useState<string | null>(null);

  const remove = (id: string) =>
    start(async () => {
      const res = await fetch(apiUrl(`/api/psych/journal/${id}`), { method: "DELETE" });
      if (!res.ok) {
        toast(t("errorGeneric"), "error");
        return; // keep the entry — refresh would flash the unchanged list
      }
      router.refresh();
    });

  if (entries.length === 0) {
    return <p className="lede">{t("journalEmpty")}</p>;
  }

  return (
    <>
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
                onClick={() => setAskId(e.id)}
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
      <ConfirmDialog
        open={askId !== null}
        onClose={() => setAskId(null)}
        onConfirm={() => {
          const id = askId;
          setAskId(null);
          if (id) remove(id);
        }}
        message={t("journalDeleteConfirm")}
        confirmLabel={t("journalDelete")}
        busy={pending}
      />
    </>
  );
}
