import { getTranslations } from "next-intl/server";
import { MOOD_TAGS, bakuParts } from "@/lib/psychology";

export type MoodRow = {
  date: string; mood: number; energy: number; sleepQ: number; tags: string;
};

/** Class for a heatmap cell: average of the three metrics → 0–4 level. */
const heatLevel = (r: MoodRow) => {
  const avg = (r.mood + r.energy + r.sleepQ) / 3;
  if (avg < 1.5) return 1;
  if (avg < 2.5) return 2;
  if (avg < 3.8) return 3;
  return 4;
};

/**
 * Server-rendered mood charts — no JS, no chart library, straight SVG in
 * the design system's palette: a 14-day line chart (three series), a
 * 5-week heatmap of check-in intensity and a tag distribution bar list.
 */
export async function MoodCharts({ logs, locale }: { logs: MoodRow[]; locale: string }) {
  const t = await getTranslations({ locale, namespace: "meditationApp" });

  const series = logs.slice(-14);
  const max = 5;
  const W = 560;
  const H = 180;
  const pad = { l: 22, r: 8, t: 10, b: 18 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => (series.length > 1 ? pad.l + (i * iw) / (series.length - 1) : pad.l + iw / 2);
  const y = (v: number) => pad.t + ih - ((v - 0.5) / max) * ih;
  const line = (key: "mood" | "energy" | "sleepQ") =>
    series.map((r, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(" ");

  // Heatmap: last 35 days aligned to weekday columns (Mon-first).
  const today = bakuParts(new Date()).date;
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const cells: { date: string; level: number }[] = [];
  for (let i = 34; i >= 0; i -= 1) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = byDate.get(key);
    cells.push({ date: key, level: row ? heatLevel(row) : 0 });
  }

  const tagCounts = MOOD_TAGS.map((tag) => ({
    tag,
    count: logs.reduce((sum, l) => sum + (l.tags.split(",").includes(tag) ? 1 : 0), 0),
  }));
  const tagMax = Math.max(1, ...tagCounts.map((c) => c.count));

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="chart-card">
        <h3>{t("chartLineTitle")}</h3>
        {series.length < 2 ? (
          <p>{t("chartEmpty")}</p>
        ) : (
          <>
            <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("chartLineTitle")}>
              {[1, 3, 5].map((v) => (
                <g key={v}>
                  <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 4" />
                  <text x={2} y={y(v) + 3} fontSize="9" fill="var(--muted)">{v}</text>
                </g>
              ))}
              <path d={line("mood")} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
              <path d={line("energy")} fill="none" stroke="var(--accent-text)" strokeWidth="1.75" strokeDasharray="5 4" opacity=".8" />
              <path d={line("sleepQ")} fill="none" stroke="var(--muted)" strokeWidth="1.75" strokeDasharray="1.5 3.5" opacity=".9" />
            </svg>
            <ul className="chips" style={{ marginTop: ".25rem" }}>
              <li key="mood"><i aria-hidden style={{ width: ".9rem", height: ".25rem", borderRadius: "999px", background: "var(--accent)", display: "inline-block" }} /> {t("seriesMood")}</li>
              <li key="energy"><i aria-hidden style={{ width: ".9rem", height: ".25rem", borderRadius: "999px", background: "var(--accent-text)", display: "inline-block" }} /> {t("seriesEnergy")}</li>
              <li key="sleep"><i aria-hidden style={{ width: ".9rem", height: ".25rem", borderRadius: "999px", background: "var(--muted)", display: "inline-block" }} /> {t("seriesSleep")}</li>
            </ul>
          </>
        )}
      </div>

      <div className="chart-card">
        <h3>{t("chartHeatTitle")}</h3>
        <div>
          <div className="heat-head" aria-hidden>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="heat" role="img" aria-label={t("chartHeatTitle")}>
            {cells.map((c) => (
              <i key={c.date} data-l={c.level} title={`${c.date}${c.level > 0 ? ` · ${c.level}/4` : ""}`} />
            ))}
          </div>
        </div>
        <p>{t("chartHeatNote")}</p>
      </div>

      <div className="chart-card">
        <h3>{t("chartTagsTitle")}</h3>
        <div className="tagbars">
          {tagCounts.map((c) => (
            <div className="tagbar" key={c.tag}>
              <small>{t(`moodTag_${c.tag}`)}</small>
              <span className="bar"><i style={{ width: `${(c.count / tagMax) * 100}%` }} /></span>
              <b>{c.count}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
