"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Award, Clock, Globe, GraduationCap, MapPin, ScrollText, Star } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ScheduleBook } from "@/components/psych/ScheduleBook";
import { SPECIALTY_ICONS } from "@/lib/psychology";
import type { DayColumn, PsySpecialty } from "@/lib/psychology";

/** Everything the card + its about-dialog render, fully resolved
 *  server-side (labels pre-translated, no message keys cross the
 *  RSC boundary for the static parts). */
export type PsyCardView = {
  slug: string;
  name: string;
  title: string;
  image: string;
  rating: number;
  ratingA11y: string;
  price: number;
  sessionUnit: string;
  specialties: PsySpecialty[];
  formats: string[];
  languages: string;
  /* ── About-dialog content ── */
  since: string;
  edu: string;
  certs: string[];
  rules: string;
  /* ── Booking grid ── */
  columns: DayColumn[];
};

export function PsyCard({
  psy, dayNames, monthNames, fitTag,
}: {
  psy: PsyCardView;
  dayNames: Record<string, string>;
  monthNames: Record<string, string>;
  /** Pre-rendered fit line ("2 gününüz üst-üstə düşür…"). */
  fitTag: string;
}) {
  const t = useTranslations("psychApp");
  const [open, setOpen] = useState(false);

  return (
    <li className="psy-card">
      <div className="psy-main">
        <img className="psy-photo" src={psy.image} alt="" width={640} height={640} loading="lazy" decoding="async" />
        <div className="psy-id">
          <div className="place-top">
            <h3>{psy.name}</h3>
            <span className="score" role="img" aria-label={psy.ratingA11y}>
              <Star size={14} fill="currentColor" aria-hidden />
              {psy.rating.toFixed(1)}
            </span>
          </div>
          <p className="tag tinted">{psy.title}</p>
          <ul className="chips">
            {psy.specialties.map((s) => {
              const Icon = SPECIALTY_ICONS[s];
              return <li key={s}><Icon size={13} aria-hidden />{t(`specialty_${s}`)}</li>;
            })}
          </ul>
          <div className="psy-meta">
            <span><Clock size={13} aria-hidden /> <b>{psy.price} AZN</b> / {psy.sessionUnit}</span>
            <span><MapPin size={13} aria-hidden /> {psy.formats.join(" · ")}</span>
            <span><Globe size={13} aria-hidden /> {psy.languages}</span>
          </div>
          <div className="psy-actions">
            <span className="fit-tag">{fitTag}</span>
            <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
              {t("psyAboutCta")}
            </button>
          </div>
        </div>
      </div>

      {/* ── "Haqqında": past, certificates, rules, schedule + booking ── */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={psy.name}
        closeLabel={t("psyCloseDialog")}
        wide
      >
        <div className="psy-about">
          <div className="psy-about-head">
            <img className="psy-photo" src={psy.image} alt="" width={640} height={640} loading="lazy" decoding="async" />
            <div className="psy-about-id">
              <span className="tag tinted">{psy.title}</span>
              <span className="score">
                <Star size={14} fill="currentColor" aria-hidden />{psy.rating.toFixed(1)}
              </span>
              <p className="psy-since">{psy.since}</p>
              <div className="psy-meta">
                <span><Clock size={13} aria-hidden /> <b>{psy.price} AZN</b> / {psy.sessionUnit}</span>
                <span><MapPin size={13} aria-hidden /> {psy.formats.join(" · ")}</span>
                <span><Globe size={13} aria-hidden /> {psy.languages}</span>
              </div>
            </div>
          </div>

          <section className="psy-about-sec" aria-label={t("psyEduEyebrow")}>
            <h4><GraduationCap size={16} aria-hidden />{t("psyEduEyebrow")}</h4>
            <p>{psy.edu}</p>
          </section>

          <section className="psy-about-sec" aria-label={t("psyCertsEyebrow")}>
            <h4><Award size={16} aria-hidden />{t("psyCertsEyebrow")}</h4>
            <ul className="chips">
              {psy.certs.map((c) => <li key={c}><Award size={13} aria-hidden />{c}</li>)}
            </ul>
          </section>

          <section className="psy-about-sec" aria-label={t("psyRulesEyebrow")}>
            <h4><ScrollText size={16} aria-hidden />{t("psyRulesEyebrow")}</h4>
            <p>{psy.rules}</p>
          </section>

          <section className="psy-about-sec" aria-label={t("psyScheduleEyebrow")}>
            <h4>{t("psyScheduleEyebrow")}</h4>
            <ScheduleBook
              slug={psy.slug}
              price={psy.price}
              columns={psy.columns}
              dayNames={dayNames}
              monthNames={monthNames}
            />
          </section>
        </div>
      </Modal>
    </li>
  );
}
