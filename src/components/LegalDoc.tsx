import type { ReactNode } from "react";

/**
 * The shared renderer for the legal documents (Terms of Use, Cookie
 * Policy). The catalog stores each section as a nested object — never an
 * array — because the DB-driven i18n layer flattens keys to dot-paths and
 * rebuilds plain objects on the way back (src/i18n/request.ts deepMerge +
 * the backend's set_nested). Paragraphs and bullets are therefore keyed
 * p1…pN / li1…liN and picked in code order.
 */

/** Paragraph keys in order (a section may use any contiguous subset). */
const P_KEYS = ["p1", "p2", "p3", "p4", "p5", "p6"] as const;

/** Bullet keys in order (rendered as a <ul> when present). */
const LI_KEYS = ["li1", "li2", "li3", "li4", "li5", "li6", "li7", "li8"] as const;

/** One legal section: a heading plus its keyed paragraphs/bullets. */
export type LegalSection = { h: string } & Record<string, string>;

/** The document header: the intro paragraph and the last-updated line. */
export function LegalHead({ updated, intro }: { updated: string; intro: string }) {
  return (
    <>
      <p className="legal-updated">{updated}</p>
      <p className="legal-intro">{intro}</p>
    </>
  );
}

/** A single numbered section: h2 + paragraphs + optional bullet list. */
export function LegalSectionBlock({ sec }: { sec: LegalSection }) {
  const paras = P_KEYS.filter((k) => sec[k]).map((k) => sec[k]);
  const bullets = LI_KEYS.filter((k) => sec[k]).map((k) => sec[k]);
  return (
    <section>
      <h2>{sec.h}</h2>
      {paras.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {bullets.length > 0 && (
        <ul>
          {bullets.map((li, i) => (
            <li key={i}>{li}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Related-document links under the document body (seeAlso label). */
export function LegalRelated({ label, links }: { label: string; links: ReactNode[] }) {
  return (
    <aside className="legal-related" aria-label={label}>
      <p>{label}</p>
      <nav>
        {links.map((node, i) => (
          <span key={i} className="legal-related-link">
            {node}
          </span>
        ))}
      </nav>
    </aside>
  );
}
