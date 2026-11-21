import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMeditationContent, getBookings } from "@/lib/api";
import { psyBySlug } from "@/lib/psychology";
import { BookingsActions } from "@/components/psych/BookingsActions";
import { PsychShell } from "@/components/psych/PsychShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "psychApp" });
  return { title: t("bookingsMetaTitle"), description: t("bookingsMetaDescription") };
}

export default async function BookingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, "/meditation/bookings");

  const t = await getTranslations({ locale, namespace: "psychApp" });
  const now = new Date();

  // The user's appointments + the psychologist catalog both come from
  // the Rust API (Supabase Postgres).
  const [contentData, bookingsData] = await Promise.all([
    getMeditationContent(), getBookings(),
  ]);
  const psychologists = contentData?.psychologists ?? [];
  const rows = (bookingsData?.appointments ?? []).map((r) => ({
    ...r,
    startAt: new Date(r.startAt),
  }));

  // v3.4 statuses: requested (awaiting the psychologist), confirmed
  // (payment due), upcoming (paid) — every future row is "active"; the
  // past list keeps cancelled + already-started sessions.
  const active = rows
    .filter((r) => ["requested", "confirmed", "upcoming"].includes(r.status) && r.startAt.getTime() > now.getTime())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const past = rows.filter((r) => r.status === "cancelled" || r.startAt.getTime() <= now.getTime());

  const fmt = new Intl.DateTimeFormat(locale, {
    weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baku",
  });
  const spent = rows.filter((r) => r.payment === "paid").reduce((sum, r) => sum + r.price, 0);
  const unpaid = active.filter((r) => r.payment === "unpaid").length;

  const psyName = (slug: string) => {
    const psy = psyBySlug(psychologists, slug);
    return psy ? t(psy.nameKey) : slug;
  };

  const statusKey = (s: string) =>
    s === "requested" ? "statusRequested"
    : s === "confirmed" ? "statusConfirmed"
    : s === "upcoming" ? "statusUpcoming"
    : "statusCancelled";

  return (
    <PsychShell locale={locale} active="bookings">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i /><Link href="/meditation" className="backlink" aria-label={t("backToSection")}><ArrowLeft size={14} aria-hidden /></Link>{t("bookingsEyebrow")}</p>
          <h1 className="display sm">{t("bookingsTitle")}</h1>
          <p className="lede">{t("bookingsSubtitle")}</p>
        </header>

        <section aria-label={t("statsEyebrow")}>
          <dl className="mini-stats">
            <div className="mini-stat"><dt>{t("bookingsUpcomingCount")}</dt><dd>{active.length}</dd></div>
            <div className="mini-stat"><dt>{t("bookingsUnpaidCount")}</dt><dd>{unpaid}</dd></div>
            <div className="mini-stat"><dt>{t("bookingsSpent")}</dt><dd>{spent} AZN</dd></div>
          </dl>
        </section>

        <section aria-labelledby="up-h" className="blk">
          <h2 id="up-h" className="eyebrow"><b>01</b>{t("bookingsUpcoming")}</h2>
          {active.length === 0 ? (
            <p className="lede">{t("bookingsEmptyUpcoming")}</p>
          ) : (
            <div className="bk-scroll">
              <table className="bk-table">
                <thead>
                  <tr>
                    <th scope="col">{t("colWhen")}</th>
                    <th scope="col">{t("colPsychologist")}</th>
                    <th scope="col">{t("colFormat")}</th>
                    <th scope="col">{t("colPrice")}</th>
                    <th scope="col">{t("colPayment")}</th>
                    <th scope="col">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((r) => (
                    <tr key={r.id}>
                      <td><b>{fmt.format(r.startAt)}</b></td>
                      <td>{psyName(r.psychologistSlug)}</td>
                      <td>{t(`format_${r.mode}`)}</td>
                      <td>{r.price} AZN</td>
                      <td>
                        <span className="paytag">{t(statusKey(r.status))}</span>
                        {r.status === "upcoming" && (
                          <>{" "}<span className="paytag" data-pay={r.payment}>{t(r.payment === "paid" ? "payPaid" : "payUnpaid")}</span></>
                        )}
                      </td>
                      <td>
                        <BookingsActions id={r.id} payment={r.payment} status={r.status} canCancel />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="past-h" className="blk">
          <h2 id="past-h" className="eyebrow"><b>02</b>{t("bookingsPast")}</h2>
          {past.length === 0 ? (
            <p className="lede">{t("bookingsEmptyPast")}</p>
          ) : (
            <div className="bk-scroll">
              <table className="bk-table">
                <thead>
                  <tr>
                    <th scope="col">{t("colWhen")}</th>
                    <th scope="col">{t("colPsychologist")}</th>
                    <th scope="col">{t("colFormat")}</th>
                    <th scope="col">{t("colPrice")}</th>
                    <th scope="col">{t("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((r) => (
                    <tr key={r.id}>
                      <td><b>{fmt.format(r.startAt)}</b></td>
                      <td>{psyName(r.psychologistSlug)}</td>
                      <td>{t(`format_${r.mode}`)}</td>
                      <td>{r.price} AZN</td>
                      <td>
                        <span className="paytag" data-pay={r.status === "cancelled" ? undefined : r.payment}>
                          {r.status === "cancelled" ? t("statusCancelled")
                            : r.status === "upcoming" ? t("statusCompleted")
                            : t(statusKey(r.status))}
                        </span>
                        {r.status !== "cancelled" && (
                          <>{" "}<span className="paytag" data-pay={r.payment}>{t(r.payment === "paid" ? "payPaid" : "payUnpaid")}</span></>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="note">{t("bookingsNote")}</p>
        </section>
      </div>
    </PsychShell>
  );
}
