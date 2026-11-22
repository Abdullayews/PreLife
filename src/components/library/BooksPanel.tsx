"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, BookmarkCheck, BookmarkPlus, Clock, LoaderCircle } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { iconByName } from "@/lib/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * The library "books" panel with the personal bookshelf (v3.5).
 *
 * Server-rendered data (books + details) arrives as props; the shelf
 * state is the client's — GET /api/library/shelf on mount, optimistic
 * add/remove on click. Filter chips: every book / "Rəfim ({count})".
 */

type BookItem = {
  id: string;
  nameKey: string;
  targetKey: string;
  icon: string;
  level: "beginner" | "intermediate" | "advanced";
};

type BookDetail = { author: string; pages: number; minutes: number; blurbKey: string };

const cap = (l: string) => l[0]!.toUpperCase() + l.slice(1);

export function BooksPanel({
  books,
  details,
  initialShelf,
}: {
  books: BookItem[];
  details: Record<string, BookDetail>;
  /** The shelf slugs resolved server-side (first paint, no flash). */
  initialShelf: string[];
}) {
  const t = useTranslations("libraryApp");
  const [shelf, setShelf] = useState<string[]>(initialShelf);
  const [mineOnly, setMineOnly] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  // Unshelving asks first — { slug, name } of the book about to leave.
  const [askRemove, setAskRemove] = useState<{ slug: string; name: string } | null>(null);

  const shelved = useCallback((id: string) => shelf.includes(id), [shelf]);

  const toggleShelf = async (id: string) => {
    const on = shelved(id);
    setBusySlug(id);
    // Optimistic — a failed toggle rolls back on the next load.
    setShelf((prev) => (on ? prev.filter((s) => s !== id) : [...prev, id]));
    try {
      const res = on
        ? await fetch(apiUrl(`/api/library/shelf/${encodeURIComponent(id)}`), { method: "DELETE" })
        : await fetch(apiUrl("/api/library/shelf"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: id }),
          });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { books?: string[] };
        if (Array.isArray(body.books)) setShelf(body.books);
      }
    } catch {
      /* offline — keep the optimistic state */
    } finally {
      setBusySlug(null);
    }
  };

  const list = books.filter((b) => details[b.id] && (!mineOnly || shelved(b.id)));

  return (
    <>
      <header className="page-head">
        <p className="eyebrow"><i /><BookOpen size={14} aria-hidden />PreLife Library</p>
        <h1 className="display sm">{t("booksTitle")}</h1>
        <p className="lede">{t("booksSubtitle")}</p>
      </header>

      <div className="shelf-filter" role="group" aria-label={t("shelfFilterA11y")}>
        <button
          type="button"
          className={`filter-btn${mineOnly ? "" : " active"}`}
          aria-pressed={!mineOnly}
          onClick={() => setMineOnly(false)}
        >
          {t("shelfAll")}
        </button>
        <button
          type="button"
          className={`filter-btn${mineOnly ? " active" : ""}`}
          aria-pressed={mineOnly}
          onClick={() => setMineOnly(true)}
        >
          <BookmarkCheck size={14} aria-hidden />
          {t("shelfMine", { count: shelf.length })}
        </button>
      </div>

      {mineOnly && list.length === 0 ? (
        <p className="shelf-empty">{t("shelfEmpty")}</p>
      ) : (
        <ul className="drecipes">
          {list.map((b) => {
            const d = details[b.id]!;
            const BookIcon = iconByName(b.icon);
            const on = shelved(b.id);
            return (
              <li key={b.id} className={`card drecipe-card${on ? " shelved" : ""}`}>
                <div className="card-top">
                  <span className="chip-ico tinted"><BookIcon size={20} aria-hidden /></span>
                  {on
                    ? <span className="tag tag-solid">{t("shelfOn")}</span>
                    : <span className="tag">{t(`level${cap(b.level)}`)}</span>}
                </div>
                <h3 className="h4">{t(b.nameKey)}</h3>
                <p className="dbook-target">{t(b.targetKey)}</p>
                <p className="dbook-author">{t("bookAuthor")}: <b>{d.author}</b></p>
                <div className="drecipe-facts">
                  <span><BookOpen size={14} aria-hidden />{t("bookPages", { count: d.pages })}</span>
                  <span><Clock size={14} aria-hidden />{t("bookMinutes", { count: d.minutes })}</span>
                </div>
                <p className="dbook-blurb">{t(d.blurbKey)}</p>
                <button
                  type="button"
                  className={`btn btn-sm ${on ? "btn-ghost" : "btn-solid"} shelf-btn`}
                  onClick={() => (on ? setAskRemove({ slug: b.id, name: t(b.nameKey) }) : toggleShelf(b.id))}
                  disabled={busySlug === b.id}
                  aria-pressed={on}
                >
                  {busySlug === b.id
                    ? <LoaderCircle size={14} className="spin" aria-hidden />
                    : on
                      ? <BookmarkCheck size={14} aria-hidden />
                      : <BookmarkPlus size={14} aria-hidden />}
                  {on ? t("shelfRemove") : t("shelfAdd")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={askRemove !== null}
        onClose={() => setAskRemove(null)}
        onConfirm={() => {
          const slug = askRemove?.slug;
          setAskRemove(null);
          if (slug) void toggleShelf(slug);
        }}
        message={askRemove ? t("shelfRemoveConfirm", { name: askRemove.name }) : ""}
        confirmLabel={t("shelfRemove")}
        busy={askRemove !== null && busySlug === askRemove.slug}
      />
    </>
  );
}
