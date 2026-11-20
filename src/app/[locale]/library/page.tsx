import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowUpRight, BookOpen, Clock, LibraryBig, Landmark, MapPin, Star,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { getLibraryContent } from "@/lib/api";
import { ContentUnavailable } from "@/components/ContentUnavailable";
import { iconByName } from "@/lib/icons";

type Props = {
  params: Promise<{ locale: string }>;
  /** ?tab=<library subtab> — drives the rail's active tab. */
  searchParams: Promise<{ tab?: string | string[] }>;
};

/** The library section's subtabs — one page, three panels. */
const TABS = [
  { id: "collections", icon: "library" },
  { id: "books", icon: "book" },
  { id: "venues", icon: "landmark" },
] as const;

const isTabId = (v: string): v is (typeof TABS)[number]["id"] =>
  TABS.some((t) => t.id === v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "libraryApp" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** level keys: levelBeginner / levelIntermediate / levelAdvanced. */
const cap = (l: string) => l[0]!.toUpperCase() + l.slice(1);

export default async function LibraryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const active = tabParam && isTabId(tabParam) ? tabParam : "collections";
  const user = await requireUser(
    locale,
    tabParam ? `/library?tab=${encodeURIComponent(Array.isArray(tabParam) ? tabParam[0] : tabParam)}` : "/library",
  );

  const t = await getTranslations({ locale, namespace: "libraryApp" });
  const tr = await getTranslations({ locale, namespace: "libraryHome" });
  const r = await getTranslations({ locale, namespace: "sectionRail" });
  const s = await getTranslations({ locale, namespace: "sections" });

  // v3.4: venues respect the user's location choice (global / Azerbaijan).
  const libraryContent = await getLibraryContent(user.location);
  if (!libraryContent) return <ContentUnavailable locale={locale} />;
  const {
    collections: libraryCollections, books: libraryBooks, places: libraryPlaces,
    bookDetails: BOOK_DETAILS, venueDetails: LIB_VENUE_DETAILS,
  } = libraryContent;

  const tabs = TABS.map(({ id, icon }) => ({ id, label: tr(`rail_${id}`), icon }));
  const hrefs = Object.fromEntries(
    TABS.map(({ id }) => [id, `/library?tab=${id}`]),
  );

  return (
    <div data-world="library" className="world app-page">
      <AppShell
        mode="link"
        tabs={tabs}
        activeId={active}
        hrefs={hrefs}
        user={{
          name: user.name,
          email: user.email,
          avatar: user.avatar ?? null,
          railFolded: user.railFolded ?? false,
          role: user.role ?? "user",
          psychSlug: user.psychSlug ?? null,
        }}
        ui={{ label: r("label"), open: r("open"), close: r("close"), current: r("current"), title: s("library.name") }}
      >
        <div className="wrap">
          {active === "collections" && (
            <>
              <header className="page-head">
                <p className="eyebrow"><i /><LibraryBig size={14} aria-hidden />PreLife Library</p>
                <h1 className="display sm">{t("collectionsTitle")}</h1>
                <p className="lede">{t("collectionsSubtitle")}</p>
              </header>
              <ul className="gshop-grid">
                {libraryCollections.map((c) => (
                  <li key={c.id} className="card dplan-card">
                    <div className="dplan-img">
                      <img src={c.image} alt={t(c.nameKey)} width={800} height={500} loading="lazy" decoding="async" />
                    </div>
                    <div className="dplan-body">
                      <span className="card-top">
                        <span className="tag">{t(`level${cap(c.level)}`)}</span>
                        {c.featured && <span className="tag tag-solid">{t("plansBadgeFeatured")}</span>}
                      </span>
                      <h3 className="h4">{t(c.nameKey)}</h3>
                      <p>{t(c.descKey)}</p>
                      <ul className="facts">
                        {c.meta.map(([key, count]) => <li key={key}>{t(key, { count })}</li>)}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {active === "books" && (
            <>
              <header className="page-head">
                <p className="eyebrow"><i /><BookOpen size={14} aria-hidden />PreLife Library</p>
                <h1 className="display sm">{t("booksTitle")}</h1>
                <p className="lede">{t("booksSubtitle")}</p>
              </header>
              <ul className="drecipes">
                {/* detail rows are DB-driven — skip items without details */}
                {libraryBooks.filter((b) => BOOK_DETAILS[b.id]).map((b) => {
                  const d = BOOK_DETAILS[b.id]!;
                  const BookIcon = iconByName(b.icon);
                  return (
                    <li key={b.id} className="card drecipe-card">
                      <div className="card-top">
                        <span className="chip-ico tinted"><BookIcon size={20} aria-hidden /></span>
                        <span className="tag">{t(`level${cap(b.level)}`)}</span>
                      </div>
                      <h3 className="h4">{t(b.nameKey)}</h3>
                      <p className="dbook-target">{t(b.targetKey)}</p>
                      <p className="dbook-author">{t("bookAuthor")}: <b>{d.author}</b></p>
                      <div className="drecipe-facts">
                        <span><BookOpen size={14} aria-hidden />{t("bookPages", { count: d.pages })}</span>
                        <span><Clock size={14} aria-hidden />{t("bookMinutes", { count: d.minutes })}</span>
                      </div>
                      <p className="dbook-blurb">{t(d.blurbKey)}</p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {active === "venues" && (
            <>
              <header className="page-head">
                <p className="eyebrow"><i /><Landmark size={14} aria-hidden />PreLife Library</p>
                <h1 className="display sm">{t("venuesTitle")}</h1>
                <p className="lede">{t("venuesSubtitle")}</p>
              </header>
              <ul className="gyms-grid">
                {/* detail rows are DB-driven — skip items without details */}
                {libraryPlaces.filter((place) => LIB_VENUE_DETAILS[place.id]).map((place) => {
                  const d = LIB_VENUE_DETAILS[place.id]!;
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.mapQuery)}`;
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
                          <span className="gplace-line"><MapPin size={15} aria-hidden />{d.address}</span>
                          <span className="gplace-line"><Clock size={15} aria-hidden />{d.hours}</span>
                        </div>
                        <div className="gplace-foot">
                          <span className="tag">{t("venueHours")} · {d.hours}</span>
                          <a className="btn btn-sm btn-ghost" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                            {t("venueMaps")}<ArrowUpRight size={15} aria-hidden />
                          </a>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </AppShell>
    </div>
  );
}
