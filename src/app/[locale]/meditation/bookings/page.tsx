import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
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
  const user = await requireUser(locale, "/meditation/bookings");

  const t = await getTranslations({ locale, namespace: "psychApp" });
  const now = new Date();

  const rows = await db.appointment.findMany({
    where: { userId: user.id },
    orderBy: { startAt: "desc" },
    take: 60,
  });

  const upcoming = rows
    .filter((r) => r.status === "upcoming" && r.startAt.getTime() > now.getTime())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const past = rows.filter((r) => r.status === "cancelled" || r.startAt.getTime() <= now.getTime());

  const fmt = new Intl.DateTimeFormat(locale, {
    weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baku",
  });
  const spent = rows.filter((r) => r.payment === "paid").reduce((sum, r) => sum + r.price, 0);
  const unpaid = upcoming.filter((r) => r.payment === "unpaid").length;

  const psyName = (slug: string) => {
    const psy = psyBySlug(slug);
    return psy ? t(psy.nameKey) : slug;
  };

  return (
    <PsychShell locale={locale} active="bookings">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i /><Link href="/diet" className="backlink"><ArrowLeft size={14} aria-hidden /></Link>{t("bookingsEyebrow")}</p>
          <h1 className="display sm">{t("bookingsTitle")}</h1>
          <p className="lede">{t("bookingsSubtitle")}</p>
        </header>

        <section aria-label={t("statsEyebrow")}>
          <dl className="mini-stats">
            <div className="mini-stat"><dt>{t("bookingsUpcomingCount")}</dt><dd>{upcoming.length}</dd></div>
            <div className="mini-stat"><dt>{t("bookingsUnpaidCount")}</dt><dd>{unpaid}</dd></div>
            <div className="mini-stat"><dt>{t("bookingsSpent")}</dt><dd>{spent} AZN</dd></div>
          </dl>
        </section>

        <section aria-labelledby="up-h" className="blk">
          <h2 id="up-h" className="eyebrow"><b>01</b>{t("bookingsUpcoming")}</h2>
          {upcoming.length === 0 ? (
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
                    <th scope="col"><span className="hide-sm">{t("colActions")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((r) => (
                    <tr key={r.id}>
                      <td><b>{fmt.format(r.startAt)}</b></td>
                      <td>{psyName(r.psychologistSlug)}</td>
                      <td>{t(`format_${r.mode}`)}</td>
                      <td>{r.price} AZN</td>
                      <td><span className="paytag" data-pay={r.payment}>{t(r.payment === "paid" ? "payPaid" : "payUnpaid")}</span></td>
                      <td>
                        <BookingsActions id={r.id} payment={r.payment} canCancel />
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
                          {r.status === "cancelled" ? t("statusCancelled") : t("statusCompleted")}
                        </span>
                        {" "}
                        <span className="paytag" data-pay={r.payment}>{t(r.payment === "paid" ? "payPaid" : "payUnpaid")}</span>
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
