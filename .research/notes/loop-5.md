# Loop 5/6 — SEO + İ18N + PWA + DEPLOY — Qeydlər

Tarix: 2026-11-24 (Baku 19:4x) · Job 545237 (manual davam — cron 10:00-da işə düşmüşdü)
QEYD: Bu son araşdırma loopudur; əvvəlki loopların zəif qalan yerləri də yoxlanıldı
(Material grid rəqəmləri → loop 3-də bağlandı; kart radiusu → loop 6 synth qərarı).

## METOD QEYDİ

- Eyni qayda: YouTube transkript bloklu (loop 1-3 təsdiqi); video hovuzu ytsearch
  metadata ilə; dərinlik sənədlərlə (web_search + page_reader).
- İşarələr: [TAM] / [SNIPPET] — əvvəlki looplar ilə eyni.

---

## MÖVZU 13 — SEO VƏ METADATA

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "9 Must-Know Technical SEO Practices for 2026" — Rank Math SEO —
   https://youtube.com/watch?v=o7miIuomJoE
2. "Technical SEO Secrets I learned After 200+ Sites" — Ghulam Ali SEO —
   https://youtube.com/watch?v=r5KkaiKedF8
3. "What is schema.org structured data in SEO?" — Yoast —
   https://youtube.com/watch?v=eiLYXDhL22o
4. "A Beginners Guide to Schema.org" — SMA Marketing —
   https://youtube.com/watch?v=_HFRnsv7wFA

Məqalələr/sənədlər:
5. [TAM] Google Search Central — "Tell Google about localized versions of your
   page" (hreflang) — https://developers.google.com/search/docs/specialty/international/localized-versions
6. [TAM] ogp.me — "The Open Graph protocol" (tam spesifikasiya) — https://ogp.me
7. [SNIPPET] Next.js docs — "How to implement JSON-LD in your Next.js
   application" (2026-03) — https://nextjs.org/docs/app/guides/json-ld
8. [SNIPPET] schema.org — Organization type — https://schema.org/Organization

### (b) Əsas öyrəntilər

**hreflang (AZ/EN/RU üçün kritik) [TAM]:**
- 3 ekvivalent metod: HTML `<link rel="alternate" hreflang=...>` başlıqları ·
  HTTP `Link` header-i · XML sitemap `<xhtml:link>` — BİRİNİ seç (3-ü birgə idarə
  etmək çətin, faydası yox)
- Hər versiya ÖZÜNÜ + BÜTÜN digər versiyaları siyahılamalıdır; qarşılıqlı
  (bidirectional) işarələməyən cütlük İGNOR olunur
- URL-lər tam-qualify (`https://prelife.net/en`, `/en` YOX)
- Dil kodları ISO 639-1 (`az`, `en`, `ru`); region lazımsız — saf dil kodu üstünlük
- `x-default` — tutulmayan dillər üçün (dil seçici / default landing)
- Google hreflang-i dilin AŞKARLANMASI üçün YOX, uyğun versiyanın göstərilməsi
  üçün işlədir — dil aşkarlanması məzmun alqoritmi ilə
- Sitemap metodu 100-lərlə URL üçün ən idarəolunandır

**OG protokolu [TAM]:**
- 4 MƏCBURİ: `og:title` · `og:type` (website/article) · `og:image` · `og:url`
  (canonical daimi ID kimi)
- Tövsiyə: `og:description` (1-2 cümlə) · `og:site_name` · `og:locale` (format
  `language_TERRITORY` → `az_AZ`, default `en_US`) · `og:locale:alternate`
  (digər dillər üçün təkrarlanan taq)
- Strukturlaşdırılmış şəkil: `og:image:width/height/type/alt` — `og:image` varsa
  `og:image:alt` DƏ QOYULMALI; çoxşəkilli: eyni taq təkrarı, ilk üstünlük daşıyır
- Twitter: `twitter:card` (summary_large_image) əlavəsi

**Structured data (JSON-LD) [SNIPPET]:**
- Next.js: server komponentdə `<script type="application/ld+json">` — metadata API
  ilə birgə; Google/AI axtarışı məzmun struktrunu başa düşsün
- PreLife-relevant növlər: `Organization` (+`EducationalOrganization`) · `Course`
  (proqramlar üçün) · `FAQPage` (FAQ bölməsi) · `BreadcrumbList` (≥3 səviyyə) ·
  `LocalBusiness` (ünvan/saat)
- Validasiya: Google Rich Results Test + Search Console

**Texniki SEO əsasları [SNIPPET + praktika]:**
- `app/sitemap.ts` (dynamik, locale-lər hreflang alternate-ləri ilə) + `robots.txt`
  (admin/api disallow); hər səhifənin canonical URL-i; title ~50-60 simvol,
  meta description ~150-160; preview-lərin yoxlanması

### (c) PreLife üçün qaydalar

1. **Metadata API**: hər səhifədə `generateMetadata` — title (AZ default:
   "PreLife — ..."), description, canonical, OG 4-lüyü + og:locale `az_AZ` +
   `og:locale:alternate` (en, ru) + twitter:card; OG şəkli 1200×630 hər 3 dil üçün.
2. **hreflang**: sitemap metodu — `sitemap.ts`-də hər URL üçün az/en/ru + x-default
   (az versiyası) alternateləri; bütün URL-lər tam; qarşılıqlılıq mexaniki avtomatik
   qurulur (tək mənbədən generasiya).
3. **JSON-LD**: səhifə başına 1 `<script type="application/ld+json">`: ana səhifə
   Organization (logo, sameAs sosial linklər) + xidmət səhifələrində Course/Offer ·
   FAQ səhifəsində FAQPage · breadcrumb olan səhifələrdə BreadcrumbList.
4. **Title/description intizamı**: title ≥1 dəfə brend + əsas açar söz ("İngilis dili
   kursları Bakı | PreLife"); description CTA-li, 150 simvola uyğun AZ mətn.
5. **robots.txt**: `/api/`, admin yolları disallow; sitemap referansı; canonical
   hər render-də locale-uyğun.

---

## MÖVZU 14 — İ18N BEST PRACTICES

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "Implement Awesome Next.js 14 Internationalization (i18n) with App Router and
   next-intl" — Tobi Mey — https://youtube.com/watch?v=I9kiZvBBIs4
2. "Next.js i18n: App Router + next-intl Tutorial" — Frontend Basics —
   https://youtube.com/watch?v=h3IA_Iax-dk

Məqalələr/sənədlər:
3. [TAM-index + SNIPPET-config] next-intl docs — Routing (index) + Routing
   configuration (localePrefix strategiyaları) — https://next-intl.dev/docs/routing
4. [SNIPPET] StackOverflow/Reddit — default locale without URL prefix (as-needed
   nümunələri)

### (b) Əsas öyrəntilər

**next-intl arxitekturası [SNIPPET]:**
- 2 inteqrasiya nöqtəsi: **proxy/middleware** (locale negotiasiyası + redirect/rewrite,
  `/` → `/en` kimi) və **Navigation API** (`<Link href="/about">` — locale avtomatik
  prefikslənir, lokalizə olunmuş pathnamelər `/de/über-uns` mümkün)
- `localePrefix` strategiyaları: `always` (hamısı prefiksli: `/az`, `/en`, `/ru`) ·
  `as-needed` (DEFAULT locale prefikssiz `/`, digərləri `/en`, `/ru`) · `never`
- Message catalog: `messages/{locale}.json` — adlandırılmış açarlar, namespace-lər;
  ICU MessageFormat (cəm/qeyri-müəyyənlik üçün)
- Dil seçimi: `Accept-Language` + cookie yaddaşı; server-side redirect

**Tərcümə keyfiyyəti qaydaları (praktika + mənbələr):**
- `lang` atributu hər versiyada düzgün (`az`, `en`, `ru`) — ekran oxuyucusu və
  brauzer tərcüməsi üçün kritik
- Mətn interpolasiyası (`{name}`) kataloqda, koddа birjalı sətirlər QADAĞAN
- Tarix/rəqəm formatları locale-ə görə (Intl API) — manual format yox
- AZ xüsusi: hərfaq diakritikləri (`Əə Şş Çç Ğğ İı`) loop 1 font qaydaları ilə;
  `az_AZ` OG locale kodu; machine-translation yalnız qaralama — əsas səhifələr
  insan redaktəsindən keçir

### (c) PreLife üçün qaydalar

1. **Strategiya: `as-needed`** — AZ default prefikssiz (`/`), EN `/en`, RU `/ru`:
   əsas auditoriya AZ-dır, URL qısa qalır, hreflang x-default=AZ kök.
2. **Kataloq strukturu**: `messages/az.json`, `en.json`, `ru.json` — namespace-lər
   səhifələr üzrə (`home.hero.title`); 3 fayl strukturu bağından eyni; lint
   yoxlaması (itkin açar CI-da xəta).
3. **Locale seçimi**: middleware — cookie (seçim yaddaşı) > Accept-Language > AZ;
   dil dəyişəndə cari səhifənin müvafiq versiyasına keçid.
4. **Hard-coded mətn QADAĞAN**: bütün istifadəçi-mətnləri kataloqdan; tarix/rəqəm
   `Intl` ilə; `lang` atributu `[locale]` layoutundan.
5. **Tərcümə keyfiyyət axını**: əsas səhifələr (hero, pricing, FAQ) insan tərcüməsi;
   RU/EN machine-translation qaralaması redaktəsiz canlıya ÇIXMIR.

---

## MÖVZU 15 — PWA VƏ OFFLINE

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "Progressive Web Apps (PWA) Explained | Service Workers, Caching & Manifest
   (Complete Guide)" — BMR EDUCATION — https://youtube.com/watch?v=mTqGIL8XamU
2. "Easily Convert Your Website into a Progressive Web App PWA" — CodeGuff —
   https://youtube.com/watch?v=jgcdkIYiG6w

Məqalələr/sənədlər:
3. [TAM] web.dev — "The service worker lifecycle" (Jake Archibald) —
   https://web.dev/articles/service-worker-lifecycle
4. [SNIPPET] web.dev — "Web app manifest" (Learn PWA) —
   https://web.dev/learn/pwa/web-app-manifest
5. [SNIPPET] Chrome for Developers — "Installing web applications" (install
   criteria, 2026-11 upd.) —

### (b) Əsas öyrəntilər

**Service worker lifecycle [TAM]:**
- `register('/sw.js')` → download/parse/execute → **install** (`waitUntil` içində
  precache; promise reject → SW atılır, heç vaxt control etmir) → **waiting**
  (köhnə SW 0 client-idə düşənə qədər) → **activate** (köhnə cache-lərin
  təmizliyi; `clients.claim()` ilk yükləmədə də kontrol almaq üçün) → fetch/push
- Default: page SW olmadıqsa yüklənibsə subresursları da SW ALMIR — bir refresh
  lazım; `clients.claim()` bunu dəyişir
- **Update = bayt-fərqli script**; SW URL-ni DƏYİŞMƏ (update aşkarlaması pozulur);
  versiyalı cache adları (`static-v1`, `static-v2`) + activate-də köhnələrin silinməsi;
  `skipWaiting()` yeni versiyanın dərhal aktivləşməsi (user prompt ilə)
- Məqsəd: offline-first mümkün + eyni anda yalnız 1 versiya işləsin (data zədəsiz)

**Manifest + install [SNIPPET]:**
- Məcburi/ağır sahələr: `name`, `short_name`, `start_url`, `display: standalone`,
  `id`, `icons` (192 + 512 + `purpose: "maskable"`), `theme_color`,
  `background_color`
- Chrome install meyarları: HTTPS + fetch handler-li SW + düzgün manifest;
  `beforeinstallprompt` hadisəsi tutulub saxlanılır → öz "Tətbiqi Quraşdır"
  düyməndə göstərilir (brauzer avto-bannerinə təslim olmaq yox)

**Cache strategiyaları (PWA ənənəsi):**
```
precache (install)  app shell + offline səhifə
cache-first         şrift/ikon/övəvlənmiş asset
stale-while-revalidate  CSS/JS (cavab dərhal, arxada yenilə)
network-first       HTML (uğursuzsa cache, sonra /offline)
network-only        auth/ödəniş/API POST
```

### (c) PreLife üçün qaydalar

1. **PWA prioriteti**: marketing saytı üçün PWA İKİNCİL — ilk mərhələdə sadə
   "installable" dəsti (manifest + minimal SW) kifayətdir; offline app-shell
   qurmaq gələcək mərhələdir.
2. **Manifest**: `name: PreLife`, `short_name: PreLife`, `start_url: "/"`,
   `display: standalone`, `theme_color` = brend primary, `background_color` =
   açıq fon; ikonlar 192/512 + maskable; `/manifest.webmanifest` metadata-ilə.
3. **SW v1**: (a) statik asset-lər cache-first (versiyalı adlar `prel-static-v{N}`)
   (b) HTML network-first + offline fallback `/offline` səhifəsi (c) API-lər
   network-only; `skipWaiting` yalnız istifadəçi təsdiqi ilə.
4. **SW intizamı**: URL heç vaxt dəyişmir (`/sw.js`); cache adı hər deploy-da
   yeni versiya; activate-də köhnə cache silinir; development-da
   `updateViaCache: 'none'`.
5. **Install prompt**: `beforeinstallprompt` tut → hero/footer-də 1 dəfənazik
   "Tətbiq kimi quraşdır" təklifi (dismiss yaddaşı cookie ilə); iOS üçün ayrıca
   "Əsas ekrana əlavə et" təlimatı (Safari beforeinstallprompt vermir).

---

## MÖVZU 16 — DEPLOYMENT VƏ OBSERVABILITY

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "How to Deploy Next.js App on Render for Free | Next.js Deployment Tutorial" —
   Tech with Kumaresan — https://youtube.com/watch?v=kfYX1R-1_NQ
2. "How to deploy a next js app on render" — I-Tech Academy —
   https://youtube.com/watch?v=gkSkZbHvbXQ

Məqalələr/sənədlər:
3. [SNIPPET] Render docs — "Deploying on Render" (zero-downtime sequence) +
   "Web Services" (env, health check) — https://render.com/docs/deploys
4. [SNIPPET] Render.com əsas səhifə (auto-deploy on push) + CircleCI məqaləsi
5. [SNIPPET] Sentry/monitoring praktikaları (error tracking + RUM web-vitals ilə
   birləşməsi — loop 3 qeydləri ilə)

### (b) Əsas öyrəntilər

**Render deploy modeli [SNIPPET]:**
- Git push → avtomatik deploy (auto-deploy); build + start komandası; sıfır-
  dayandırılma ardıcıllığı (yeni instansiya hazırlanır → health check keçir →
  trafik keçirilir)
- Health check path-i (məs. `/api/health`) — keçməyən deploy rolloutdan düşür
- Env var-lar dashboard-da (aksessuarlar heç vaxt repoda); rollback = əvvəlki
  commit-in yenidən deploy-u
- PreLife artıq işləyən arxitekturası (v5.3): TƏK web servisi — Rust backend
  (:3030) + Next standalone; `/api/*` next.config.ts proksi; hamısı
  `scripts/start-production.mjs` nəzarətçisi altında

**Observability qatları:**
- Uptime: Render health check + xarici uptime monitor (ping hər 1-5 dəq)
- Error tracking: Sentry SDK (server + client) — sourcemap upload; xəta
  səviyyələri: 5xx-lər dərhal alert
- RUM: `web-vitals` → `/api/vitals` (loop 3) — LCP/INP/CLS trendi
- Loglar: struktur log (JSON) — autentifikasiya + rate-limit + 5xx hadisələri;
  gizli məlumat (parol/token) logda QADAĞAN
- Metrikalar: build vaxtı, deploy tezliyi, CWV p75, xəta dərəcəsi — aylıq icmal

### (c) PreLife üçün qaydalar

1. **Deploy axını**: `git push origin main` → Render avto-deploy → health check
   `/api/health` keçməlidir; keçməyən deploy avtomatik rollback-a hazırlanır
   (əvvəlki instansiya işləməyə davam edir).
2. **Env intizamı**: production gizli kodları YALNIZ Render dashboard-da
   (SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, GEMINI_API_KEY); sandbox `.env` heç
   vaxt real service-role/Brevo açarı almır (emulator + mail_outbox) — mövcud
   qayda qüvvədədir.
3. **Migration şərti**: DB migration-lı deploy-lərdə əvvəlcə migration (backward-
   compatible), sonra kod — iki mərhələli rollout; migration tərsine-uyğun olmayan
   dəyişikliklər iki deploy-ilə (köhnə kod yeni sxema dözür → sonra təmizləmə).
4. **Monitoring minimumu**: (a) xarici uptime ping `/` + `/api/health` (b) Sentry
   (server 5xx + client JS xətaları) (c) web-vitals RUM (d) aylıq CWV p75 icmalı.
5. **Backup/rollback**: Postgres gündəlik backup (Supabase avtomatik) + hər
   deploy-da tag (`deploy-YYYYMMDD-HHmm`) — geri dönüş = tag-i checkout edib push.

---

## SİNTEZ ÜÇÜN ƏN VACİB 10 QAYDA (loop 6-ya apar)

1. Metadata API: hər səhifədə title/description/canonical + OG 4-lüyü +
   og:locale (az_AZ) + alternates + twitter:card
2. hreflang sitemap metodu: hər URL az/en/ru + x-default; tam URL-lər; qarşılıqlılıq
   tək mənbədən avtomatik
3. JSON-LD: Organization + Course/FAQPage/BreadcrumbList — səhifə başına 1 script,
   Rich Results Test ilə validasiya
4. i18n: next-intl `as-needed` (AZ prefikssiz default, /en /ru); messages/*.json
   kataloqları; hard-coded mətn qadağan; insan redaktəsi olmadan canlıya çıxış yox
5. lang atributu hər versiyada; Intl formatları (tarix/rəqəm); AZ diakritik testi
6. Manifest: name/short_name/start_url/display:standalone/icons 192+512 maskable/
   theme_color; beforeinstallprompt tutulub öz düyməsində
7. SW: URL sabit `/sw.js`, versiyalı cache adları, activate-də təmizlik; HTML
   network-first + /offline; API network-only; reduced-motion kimi ehtiyatlı om
8. Cache strategiyası cədvəli: precache shell / cache-first asset / SWR css-js /
   network-first HTML / network-only auth-api
9. Deploy: git push → auto-deploy + health check şərti; env yalnız dashboard-da;
   iki mərhələli migration rollout
10. Observability 4-lüyü: uptime ping + Sentry + web-vitals RUM + struktur log
    (gizli məlumat logda qadağan)

## STATUS

- Mənbələr: **10 video** identifikasiya edildi · **3 sənəd TAM** (Google hreflang,
  ogp.me, SW lifecycle) · ~8 snippet (next-intl config, manifest, Render, JSON-LD)
- Zəif qalan sonuncu açıqlıq: kart radius konkret dəyəri — loop 6 sintezində
  qərarlaşdırılacaq (16/20/24px variantları arasında)
- Kod dəyişikliyi: YOXDUR — yalnız `.research/` faylları
- Sonrakı: Loop 6/6 — SİNTEZ (job 545236): bütün qeydlərdən
  `skills/pro-site-craft/SKILL.md` + istifadəçiyə göndər
