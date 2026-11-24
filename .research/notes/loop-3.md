# Loop 3/6 — RESPONSIVE + A11Y + PERFORMANS — Qeydlər

Tarix: 2026-11-24 (Baku 19:2x) · Job 545240 (manual davam — cron 08:00-də işə düşmüşdü) ·
Trace: cron-agent-loop-202611241100 → davam sessiyası

## METOD QEYDİ

- Loop 1-2-də YouTube transkript bloku təsdiqləndi — bu loopda da sınaq aparılmadı.
  Video hovuzu yt-dlp ytsearch metadata ilə (başlıq + kanal + ID); dərinlik məqalələrlə.
- Alət: z-ai-web-dev-sdk `web_search` + `page_reader` funksiyaları (.research/tools/research.mjs).
- İşarələr: [TAM] = sənəd tam oxundu · [SNIPPET] = axtarış snippeti · loop 1-2 ilə eyni format.

---

## MÖVZU 7 — MOBILE-FIRST RESPONSIVE

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "Make Your Web Design Responsive in 10 Minutes | Figma Tutorial" — DesignWithArash —
   https://youtube.com/watch?v=gwiX0oASlEw
2. "The Easy Way to Build Responsive Websites" — Sajid —
   https://youtube.com/watch?v=l04dDYW-QaI
3. "#29 Tailwind CSS Responsive Design | Mobile-First Layouts Made Easy" — Can Boz —
   https://youtube.com/watch?v=bCoGSt9zn4Y

Məqalələr/sənədlər:
4. [TAM] web.dev — "Learn Responsive Design" kursu (17 fəsil) — https://web.dev/learn/design
5. [TAM] web.dev — "Responsive images" fəsli — https://web.dev/learn/design/responsive-images
6. [TAM] Material Design — "Understanding layout" (12-col grid rəqəmləri — Loop 1-dən
   qalan borc BAĞLANDI) — https://m2.material.io/design/layout/understanding-layout.html
7. [TAM] W3C WAI — Understanding SC 2.5.8 Target Size (Minimum) —
   https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
8. [SNIPPET] Polypane — "Using safe-area-inset to build mobile-safe layouts" —
   https://polypane.app/blog/using-safe-area-inset-to-build-mobile-safe-layouts
9. [SNIPPET] MDN — ARIA / Apple HIG və Material touch-target rəqəmləri (44pt / 48dp)

### (b) Əsas öyrəntilər

**Material breakpoint + grid cədvəli [TAM]:**
```
Ekran                Margin   Body        Sütun
Extra-small (phone)  0-599dp  16dp  fluid   4
Small (tablet)       600-904  32dp  fluid   8
                     905-1239 32dp  840dp  12
Medium (laptop)      1240-1439 200dp fluid 12
Large (desktop)      1440+    fluid 1040dp 12
```
- Ölçü cəmi 8dp-ə uyğun; ikonlar 4dp grid; tipoqrafiya 4dp baseline grid
- İdeal sətir uzunluğu Material-a görə 40-60 simvol (Baymard/NNg: 50-75 — loop 1 qeydi ilə
  uzlaşır: 50-75-ə 40-60 üst-düşür)
- Naviqasiya regionu: açıq 256dp / yığılmış (rail) 72dp

**Touch target standartları:**
- WCAG 2.2 SC 2.5.8 (Level AA, yenilik): hədəf ≥ **24×24 CSS px**; 5 istisna — Spacing
  (24px-dairə kəsişmirsə keçər), Equivalent, Inline (sətir içi link), User Agent Control,
  Essential [TAM]
- SC 2.5.5 (Enhanced, AAA): **44×44 CSS px**
- Apple HIG: 44×44pt minimum; Material: 48×48dp [SNIPPET]
- 2.5.8 spesifikasiya qeydi: zoom FW-dən asılı deyil — "zoom edəndə böyüyür" arqumenti
  QEYBOLUNUR

**Safe area (notch / home indicator) [SNIPPET]:**
- `<meta name="viewport" content="..., viewport-fit=cover">` — yalnız bundan sonra
  `env(safe-area-inset-*)` real dəyər verir (Safari iOS)
- 4 tərəf: `env(safe-area-inset-top|-right|-bottom|-left)`
- Pattern: `padding-bottom: calc(16px + env(safe-area-inset-bottom))` — sticky alt bar /
  footer üçün; fallback: `@supports (padding: env(safe-area-inset-bottom))`

**Responsive şəkillər [TAM — web.dev]:**
- CSS: `max-inline-size: 100%; block-size: auto;` + `aspect-ratio` + `object-fit: cover/contain`
  (+ `object-position` kəsim nöqtəsi)
- HTML: `width`/`height` atributları HƏMİŞƏ → brauzer yer rezervasiya edir (layout jump
  yox — CLS); `loading="lazy"` fold-altı; hero üçün `loading="eager"` (lazy QADAĞAN);
  LCP şəklinə `fetchpriority="high"` (yalnız həqiqətən vacib şəkilə — başqa resursları
  sıxışdırır); `decoding="async"`
- `srcset` w-descriptor + `sizes` media-şərtləri: `srcset="s.png 300w, m.png 600w, l.png 1200w"`
- JS/CSS fon şəkilləri üçün: `<link rel="preload" as="image" fetchpriority="high">`
  (+ imagesrcset); preload-dan artıq istifadə özəllikləri pozur — ehtiyatlı

**Mobile-first metodologiya:**
- Əsas üslublar kiçik ekran üçün; `min-width` media query-lərlə təkmilləşmə (progressive
  enhancement); Tailwind sm/md/lg/xl prefiksləri bu modeli işlədir
- Sütun sayı mobildə məhdud (Material: 4) → desktop 12; CSS grid `repeat(auto-fit, minmax())`

### (c) PreLife üçün qaydalar

1. **Mobile-first yaz**: bütün komponentlər mobil ölçüdə tam funksional; sonra
   `sm: md: lg: xl:` ilə zənginləşdir. `max-width` media query yalnız istisna halda.
2. **Breakpoint dəsti** (Tailwind standartı): sm 640 · md 768 · lg 1024 · xl 1280 ·
   2xl 1536. Fərdi breakpoint QADAĞAN — bu dəstdən kənar rəqəm yox.
3. **Touch target qaydası**: bütün kliklənən elementlər ≥44×44px (Apple+AAA hədəfi);
   heç vaxt 24×24-dən kiçik; kiçik ikon düymələri padding/hit-area ilə böyüdülür
   (`::before` genişləndirici YOX — padding).
4. **Safe area**: sticky alt elementlərdə (mobile nav bar, footer CTA bar)
   `env(safe-area-inset-bottom)` əlavəsi; viewport metasinda `viewport-fit=cover`.
5. **Şəkil intizamı**: hər `<img>`/next/image-də width+height; hero `priority`, fold-altı
   `loading="lazy"`; LCP şəkli heç vaxt lazy YOX.
6. **Grid**: səhifə səviyyəsində 12-col (lg+), mobil 1-2 col; kart listləri
   `auto-fill, minmax(280px, 1fr)`.
7. **Mətn blokları** max-width 65-70ch (loop 1 qaydası responsive-də də qüvvədə —
   geniş ekranda mətn sütunu genişlənmir).

---

## MÖVZU 8 — ACCESSIBILITY (WCAG 2.2 + ARIA + KLAVİATURA)

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "H5P and Web Accessibility: Step-by-Step Guide to WCAG 2.2 AA Compliance" —
   Olexandr Khan — https://youtube.com/watch?v=Yy4l5jRMJAo
2. "Accessibility for UI Designers: WCAG 2.2 Checklist" — UX Intelligence —
   https://youtube.com/watch?v=6NeC3e0ZqV8
3. "The Ultimate Accessibility Checklist: WCAG 2.2 A/AA/AAA" — Azul Coding —
   https://youtube.com/watch?v=njN4xEMC-PM

Məqalələr/sənədlər:
4. [TAM] W3C WAI — Understanding SC 2.5.8 (yuxarıda) — 24×24 + 5 istisna
5. [SNIPPET] W3C — Technique G1 "Adding a link at the top of each page" (bypass blocks) —
   https://www.w3.org/WAI/WCAG22/Techniques/general/G1
6. [SNIPPET] WebAIM — "Skip Navigation Links" — https://webaim.org/techniques/skipnav
7. [SNIPPET] MDN — "ARIA" (First Rule of ARIA) —
   https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA
8. [SNIPPET] W3C — "ARIA in HTML" (native semantics + aria-* konflikti) —
   https://www.w3.org/TR/html-aria
9. [SNIPPET] Siteimprove + Vispero — skip link yerləşdirmə qaydaları

### (b) Əsas öyrəntilər

**Skip link (bypass blocks) [SNIPPET-lər]:**
- Səhifənin İLK fokuslanabilən elementi olmalıdır (G1 texnikası); Tab-a ilk basanda
  görünən olur; hədəf `#main`/`<main>`; mətn "Əsas məzmun-a keç"
- Klaviatura istifadəçiləri hər səhifədə nav-dan keçmə məcburiyyətində qalmır

**First Rule of ARIA [SNIPPET — MDN]:**
- "Lazımi semantika və davranışı artıq daxilində olan native HTML elementi işlətə
  bilirsən — ARIA İŞLƏTMƏ"
- Native semantics ilə çakışan aria-* atributları istifadəçi agenti tərəfindən İGNOR
  edilir (w3.org html-aria)
- ARIA yalnız native yoxdursa (custom widget): accordion → `aria-expanded`,
  `aria-controls`; dialoq → `role="dialog"` + `aria-modal`

**Klaviatura naviqasiyası:**
- Tab ardıcıllığı = DOM ardıcıllığı; vizual qayda kod qaydası ilə üst-üstə düşsün
- Görünən focus indikatoru (SC 2.4.7): `outline: 0` QADAĞAN; `:focus-visible` ilə
  yalnız klaviatura fokusunda ring (2px + offset)
- Klaviatura tələsi YOX (SC 2.4.3); modal: Esc ilə bağlanma + focus trap + bağlananda
  focus geri qaytarılır
- WCAG 2.2 yeni: SC 2.4.11 Focus Not Obscured — sticky header/footer fokuslu elementi
  ÖRTMƏMƏLİDİR (sticky alt-bar dizaynında scroll-padding lazım ola bilər)

**Formlar və screen reader:**
- Hər input-un görünən `<label for>`; placeholder label ƏVƏZİ DEYİL
- Xətalar: `aria-describedby` + `role="alert"`/aria-live=polite ilə duyurulur
- Dekorativ şəkil `alt=""`; məzmun şəkli konkret AZ alt
- sr-only/visually-hidden patterni (skrin reader üçün mətn, vizual gizli)
- Landmark-lar: `<header> <nav> <main> <footer>` — native HTML (ARIA ehtiyacı yox)
- Test alətləri: NVDA (Win), VoiceOver (macOS/iOS), TalkBack (Android); klaviatura-only
  walkthrough (mouse gizlədib)

### (c) PreLife üçün qaydalar

1. **Skip link** hər səhifədə: `<a href="#main" class="skip-link">Əsas məzmun</a>` —
   ilk element; `main`-də `tabindex="-1"`; focus-da görünən (yuxarıdan slide-in).
2. **Native-first siyasəti**: `<a>` naviqasiya üçün, `<button>` aksiya üçün; ARIA
   yalnız custom widgetlarda (accordion `aria-expanded`, dialog `role="dialog" aria-modal`).
   `<div onclick>` QADAĞAN.
3. **Focus görünən**: `:focus-visible` + 2px ring `--color-primary` + 2px offset;
   `outline: none` heç bir yerdə təkbaşına YOX.
4. **Modal protokolu**: açılan zaman focus ilk elementə, trap (Tab dövrü modal daxilində),
   Esc bağır, bağlananda trigger-ə qaytar.
5. **Form a11y**: label hər field-də; xəta mətni `aria-describedby`; xülasə xəta
   `role="alert"`; autocomplete atributları (ad/e-poçt) — SC 1.3.5.
6. **Kontrast** loop 1 qaydaları (4.5:1/3:1) burada da məcburidir.
7. **Touch target** ≥44px (mövzu 7 qaydası ilə birgə).
8. **Qəbul testi** hər böyük səhifə üçün: (1) Tab-only gəzintisi, (2) VoiceOver/NVDA
   ilə hero + forma + pricing, (3) 200% zoom (mətn yenidən axmalı, SC 1.4.4/1.4.10).

---

## MÖVZU 9 — PERFORMANS (CORE WEB VITALS + NEXT.JS)

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "Fix LCP in Next.js: Boost Core Web Vitals Fast | Next.js Optimization Tips #4" —
   Blazity — https://youtube.com/watch?v=owKXh_OsBkQ
2. "10 Core Web Vitals Mistakes Ruining Your Next.js Performance" — Pagepro —
   https://youtube.com/watch?v=UCrWwfF63Ug
3. "The ultimate guide to web performance" — Beyond Fireship —
   https://youtube.com/watch?v=0fONene3OIA

Məqalələr/sənədlər:
4. [TAM] web.dev — "Web Vitals" (Philip Walton, upd. 2024-10) —
   https://web.dev/articles/vitals
5. [TAM] web.dev — "Optimize Largest Contentful Paint" (upd. 2025-03) —
   https://web.dev/articles/optimize-lcp
6. [SNIPPET] Next.js docs — Partial Prerendering platform guide —
   https://nextjs.org/docs/app/guides/ppr-platform-guide
7. [SNIPPET] imadattif.com / dev.to — "Next.js Rendering: CSR, SSR, SSG, ISR, PPR"
   (RSC + streaming sxemləri)
8. [SNIPPET] web-vitals JS kitabxanası (sendBeacon ilə RUM) — web.dev məqaləsindən

### (b) Əsas öyrəntilər

**Core Web Vitals hədləri [TAM]:**
```
Metric  Good  Zəif          Ölçü
LCP     ≤2.5s 2.5-4.0s     yükləmə (ən böyük məzmun elementi)
INP     ≤200ms 200-500ms    interaktivlik (bütün interaksiyaların ən pisə yaxını)
CLS     ≤0.1  0.1-0.25      vizual stabillik
```
- Hədəf: **75-ci persentil**, mobile və desktop AYRI segmentlənmiş (bir keçid =
  bütün 3 göstərici 75%-də good olmalıdır)
- INP FID-i ƏVƏZ ETDİ (2024-də stable) — giriş teqliyi deyil, cavab gecikməsi
- Ölçmə: CrUX (real istifadəçi) > Lighthouse (lab); `web-vitals` JS lib +
  `navigator.sendBeacon` ilə öz RUM-un

**LCP 4 alt-hissəsi [TAM]:**
```
TTFB → resource load delay → resource load duration → element render delay
```
- Yüksək TTFB = 2.5s LCP-qeyri-mümkün (redirect-lər, uzaq server, keşsizlik)
- FCP-LCP böyük fərq = LCP resursu prioritet deyil (JS-managed məzmun / lazy yüklənmə)
- Düzəlişlər: LCP şəklini preload/fetchpriority=high; lazy YOX; eyni origin;
  SSR (client-render gecikməsi aradan qalxır); render-blocking CSS minimal;
  şəkil formatı optimallaşdır (AVIF/WebP); CDN

**CLS mənbələri və dərmanları:**
- Şəkil width/height (mövzu 7-də) — ən böyük səbəb
- Web font mübadiləsi: `font-display: swap` + `size-adjust`/`ascent-override` fallback
  metrikləri (next/font avtomatik edir)
- Dinamik məzmun (banner/cookie) yerləşəndə rezervasiya: `min-height` ilə boşluq
- Transformativ reklam/embed: sabit en

**INP optimallaşdırma:**
- Uzun tapşırıqları böl (`scheduler.yield()` / setTimeout chunk); event handler-ləri
  yüngül saxla; layout thrashing (read-write-read) azalt; üçüncü tərəf script-lər
  defer/async

**Next.js App Router render strategiyaları [SNIPPET]:**
- RSC default: server komponentləri JS bundle-a düşmür
- **Streaming SSR**: Suspense sərhədləri ilə hazır hissələr dərhal göndərilir,
  yavaş hissələr (əlaqə formaları, canlı data) sonra axır
- **ISR**: statik səhifə + `revalidate` müddəti ilə yenidən qurulma
- **PPR**: statik shell + dinamik "deşiklər" (bir səhifədə SSG TTFB + SSR dəqiqliyi)
- `next/font`: self-host, avtomatik `size-adjust` (CLS yox), preload
- `next/image`: AVIF/WebP avtomatik, srcset, `placeholder="blur"`, `priority` (LCP)

### (c) PreLife üçün qaydalar

1. **Performans büdcəsi (qəbul meyarları)**: LCP ≤2.5s · INP ≤200ms · CLS ≤0.1 —
   75-ci persentil, mobile. Hər deploy sonrası PageSpeed Insights + Lighthouse yoxlaması.
2. **Hero/LCP qaydası**: hero başlıq + CTA mətn-başlıqlı LCP olsun (şəkilsiz) YA DA
   hero şəkli `priority` ilə next/image; heç bir vəziyyətdə LCP elementi lazy YOX.
3. **Font**: yalnız `next/font` (Inter) — self-hosted, swap, size-adjust avtomatik;
   Google Fonts `<link>` QADAĞAN; 2 çəki ssenarisi: 400 + 600/700.
4. **Render strategiyası**: landing/pricing/haqqımızda = statik (SSG/ISR,
   `revalidate` 24h-yə qədər); əlaqə forması və canlı hissələr = Suspense ilə
   dinamik deşik; client komponenti ("use client") yalnız real interaktiv yerlərdə.
5. **Şəkil**: next/image hər yerdə; AVIF/WebP; width/height məcburi; fold-altı lazy;
   böyük şəkil YOX (hero ≤200KB hədəfi).
6. **JS intizamı**: üçüncü tərəf script-lər yalnız zərurət halında + `next/script`
   strategy=lazyOnload; paket analizində 200KB+ client chunk qırmızı xətt.
7. **RUM**: `web-vitals` lib → `/api/vitals` endpoint (sendBeacon) — real istifadəçi
   göstəricilərini topla (CrUPS-də az trafik var).
8. **Keşləmə**: statik asset-lər immutable hash adları + `Cache-Control: public,
   max-age=31536000, immutable`; HTML `no-store`/kısa; API cavabları `private, short`.

---

## SİNTEZ ÜÇÜN ƏN VACİB 10 QAYDA (loop 6-ya apar)

1. Mobile-first: base mobil + min-width mq; breakpoint dəsti 640/768/1024/1280/1536
   (fərdi rəqəm qadağan)
2. Touch target ≥44×44px (WCAG AA 24×24 absolute minimum); safe-area-inset-bottom
   sticky alt elementlərdə + viewport-fit=cover
3. Hər şəkildə width/height (CLS); hero priority/eager, fold-altı lazy;
   fetchpriority yalnız LCP-yə
4. Skip link ilk fokus elementi; native HTML first (First Rule of ARIA);
   `<div onclick>` qadağan
5. Klaviatura: görünən :focus-visible ring 2px; modal focus-trap + Esc + focus return;
   sticky element fokus örtməsin (SC 2.4.11)
6. Formlar: label for + aria-describedby xəta + autocomplete; xəta yalnız rənglə YOX
7. CWV büdcəsi: LCP 2.5s / INP 200ms / CLS 0.1 @ 75-ci persentil (mobile ayrı)
8. LCP 4-alt-hissə intizamı: SSR + preload/priority + render-blocking CSS minimal;
   INP üçün uzun task böl
9. next/font (self-host, swap, size-adjust) + next/image (AVIF/WebP) — xüsiz font/img
   tag QADAĞAN
10. Render: statik (ISR revalidate) + Suspense dinamik deşiklər; "use client" yalnız
    real interaktiv komponentlərdə; web-vitals RUM quraşdır

## STATUS

- Mənbələr: **9 video** identifikasiya edildi · **6 məqalə/sənəd TAM** (web.dev×3,
  Material layout, WCAG 2.5.8 Understanding, + kurs indeksi) · ~10 snippet
- Loop 1-dən qalan borc BAĞLANDI: Material 12-col grid margin/gutter/body rəqəmləri
  (yuxarıdakı cədvəl) — kart radius dəyəri hələ də açıqdur (loop 6-da synth qərarı:
  16px-24px aralığının konkretləşdirilməsi)
- Kod dəyişikliyi: YOXDUR — yalnız `.research/` faylları (repo, commit, push toxunulmadı)
- Sonrakı: Loop 4/6 — backend API + təhlükəsizlik (job 545238)
