import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowUpRight, Clock, MapPin, Star } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDietContent } from "@/lib/api";
import { ContentUnavailable } from "@/components/ContentUnavailable";
import { DietShell } from "@/components/diet/DietShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dietApp" });
  return { title: t("placesTitle"), description: t("placesSubtitle") };
}

export default async function DietPlacesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/diet/places");

  const t = await getTranslations({ locale, namespace: "dietApp" });
  // v3.4: venues respect the user's location choice (global / Azerbaijan).
  const dietContent = await getDietContent(user.location);
  if (!dietContent) return <ContentUnavailable locale={locale} />;
  const { places: dietPlaces, venueDetails: VENUE_DETAILS } = dietContent;

  return (
    <DietShell locale={locale} active="places">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow">
            <i />
            <Link href="/diet" className="backlink" aria-label={t("backToSection")}><ArrowLeft size={14} aria-hidden /></Link>
            {t("rail_places")}
          </p>
          <h1 className="display sm">{t("placesTitle")}</h1>
          <p className="lede">{t("placesSubtitle")}</p>
        </header>

        <ul className="gyms-grid">
          {/* detail rows are DB-driven — skip any list item the catalog
               has no details for instead of crashing the page */}
          {dietPlaces.filter((place) => VENUE_DETAILS[place.id]).map((place) => {
            const detail = VENUE_DETAILS[place.id]!;
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detail.mapQuery)}`;
            return (
              <li key={place.id} className="gplace">
                <div className="gplace-img">
                  <img src={place.image} alt={t(place.nameKey)} width={800} height={533} loading="lazy" decoding="async" />
                </div>
                <div className="gplace-body">
                  <div className="place-top">
                    <h3>{t(place.nameKey)}</h3>
                    <span className="score" role="img" aria-label={`${place.rating}/5`}>
                      <Star size={14} fill="currentColor" aria-hidden />{place.rating.toFixed(1)}
                    </span>
                  </div>
                  <p>{t(place.descKey)}</p>
                  <ul className="chips">
                    {place.featureKeys.map((k) => <li key={k}>{t(k)}</li>)}
                  </ul>
                  <div className="gplace-meta">
                    <span className="gplace-line"><MapPin size={15} aria-hidden />{detail.address}</span>
                    <span className="gplace-line">
                      <span className="sr-only">{t("placeHours")}: </span>
                      <Clock size={15} aria-hidden />{detail.hours}
                    </span>
                  </div>
                  <div className="gplace-foot">
                    <span className="tag">{t("placeHours")} · {detail.hours}</span>
                    <a className="btn btn-sm btn-ghost" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                      {t("placeMaps")}<ArrowUpRight size={15} aria-hidden />
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </DietShell>
  );
}
