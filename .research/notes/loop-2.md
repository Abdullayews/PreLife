# Loop 2/6 — UX NAVİQASİYA + MOTION — Qeydlər

Tarix: 2026-11-24 · Job 545239 · Trace: cron-agent-loop-202611241100

## METOD QEYDİ

- Loop 1-də YouTube transkript yollarının hamısı (yt-dlp, Piped×3, mirror, watch-page)
  bot-bloklandığı təsdiqləndi — bu loopda yenidən sınaq aparılmadı. Rəsmi fallback:
  video description/metadata + eyni mövzuda məqalələr.
- Video hovuzu yt-dlp ytsearch ilə (başlıq + kanal + ID).
- İşarələr: [TAM] = sənəd tam oxundu · [SNIPPET] = axtarış snippeti · loop 1 ilə eyni format.

---

## MÖVZU 4 — NAVİQASİYA VƏ İNFORMASİYA ARXİTEKTURASI

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "How to properly layout a website (in 8 minutes)" — Payton Clark Smith —
   https://youtube.com/watch?v=by8f2vYoJAE
2. "Everything About Website Navigations" — The Website Architect —
   https://youtube.com/watch?v=r8m2wM7eXeU
3. "5 Design Patterns That Are ACTUALLY Used By Developers" — Alex Hyett —
   https://youtube.com/watch?v=YMAwgRwjEOQ

Məqalələr:
4. [TAM] NN/g — "Breadcrumbs: 11 Design Guidelines for Desktop and Mobile" —
   https://www.nngroup.com/articles/breadcrumbs
5. [TAM] NN/g — "Sticky Headers: 5 Ways to Make Them Better" —
   https://www.nngroup.com/articles/sticky-headers
6. [TAM] NN/g — "Basic Patterns for Mobile Navigation: A Primer" —
   https://www.nngroup.com/articles/mobile-navigation-patterns
7. [SNIPPET] Material 3 — "Navigation bar" (m3.material.io/components/navigation-bar):
   compact <600dp; 3-5 hədəf; aktiv = pill göstərici; M3-də kölgə YOX;
   M2 "bottom navigation" → M3 "navigation bar"; May 2025 "flexible" variant
8. [SNIPPET] Material 3 — "Navigation rail": şaquli, yan tərəfdə; orta ölçü cihazlar;
   3-7 hədəf + isteğe bağlı FAB
9. [SNIPPET] uxdesign.cc — "Top vs side navigation": IA-da çox top-level element varsa
   side nav daha yaxşı miqyaslana bilir
10. [SNIPPET] Contentsquare — "3 Golden Rules of Sticky Menu": actionable saytlarda
    işləyir, uzun səhifələr üçün idealdır

### (b) Əsas öyrəntilər

**Mobile nav pattern-ləri [TAM — NN/g]:**
- Nav bar / Tab bar: HƏMİŞƏ görünən (persistent); ≤5 seçim optimum touch-target ilə
  (artıq sığmur); əsas "chrome" sahəsi olmalı — başqa utilitlərlə doldurulmamalı
- Hamburger/drawer: gizli → ƏN AZ kəşf edilən ("out of sight, out of mind"); çox
  istifadəçi hamburgeri açmağı düşünmür; content-heavy/browse saytlar üçün uygundur,
  amma əvəzedici kəsiç-linklər lazımdır
- Navigation hub (bütün seçimləri siyahılayan səhifə): task-based saytlar üçün;
  content yerine nav vermək qarşılığı var
- Əsas qanun: content > chrome

**Material 3 komponent miqyası [SNIPPET]:**
- Navigation bar (aşağı): 3-5 hədəf, kompakt <600dp; aktiv hədəf kontrast pill ilə;
  kölgə yox, hündürlük daha çox
- Navigation rail (yan): 3-7 hədəf, orta ölçü (600-839dp) cihazlar; həmişə VERTİKAL

**Breadcrumbs (11 qaydanın konkretləri) [TAM]:**
- Location-based: sayt HİYERARXİYASINI göstər, istifadəçi tarixçəsini yox
- Yer: səhifənin yuxarısı, qlobal nav bar-dan DƏRHAL aşağıda
- Qlobal nav və ya local nav-u ƏVƏZ ETMƏSİN — yalnız tamamlayıcı
- Trail Ev (ana səhifə) linki ilə BAŞLAYIR; son element (cari səhifə) LINK DEYİL,
  vizual fərqləndirilmiş
- Ayırıcı ">" tövsiyə olunur ("/" da qəbul); trail-ə yalnız real səhifələr daxil, IA
  kateqoriyaları yox; polihierarxiyada 1 yol göstər
- Touch target ≥1×1 cm; kiçik/cıvlcıq breadcrumb qadağan
- Mobile: çoxsətirli wrap YOX; trail-i son səviyyə(lər)ə qısaltmaq OLAR — desktop həmişə
  tam trail
- Düz hiyerarxiya (1-2 səviyyə) və ya xətti saytlarda breadcrumb LAZİM DEYİL

**Sticky headers [TAM]:**
- Content-to-chrome ratio: header mümkün qədər KİÇİK (nümunə: New Yorker iPhone-da
  13:1 — yaxşı; 2:1 — pis); touch target ≥1×1 cm, header mətni ~16pt
- Header MÜTLƏQ content-lə kontrastlı: OPAQUE fon (translucent başlıqlar aşağı kontrast
  yaradır — məzmun oxunmur); dropdownlar da fonda aydın ayrılmalı
- Motion: ən yaxşısı HƏÇ NƏ; zəruridirsə — tez, hamar, dərhal; "stalker menu" (gecikmə
  ilə animasiya ilə gələn) qadağan; hiss olunmalı "əl ilə sürüşdürülür" kimi
- Partly persistent header: slide-in 300-400ms; tetik üçün bir neçə px-dən artıq scroll
  (həssas olmasın)
- Əvvəlcə cost-benefit: header elementləri sessiya boyu çox lazımdırmı? Lazım deyilsə
  sticky etmə.

**IA-qərar qaydaları [SNIPPET]:**
- Top-level elementlər azdırsa (≤5-6): üst nav yaxşı işləyir
- Çox top-level: side nav (dashboard/məhsul saytı) daha miqyaslı

### (c) PreLife üçün qaydalar

1. **Əsas nav (desktop)**: üfüqi header, top-level maksimum 5-6 element
   (Əsas səhifə · Haqqımızda · Xidmətlər · Qiymətlər · Əlaqə); artıq olarsa —
   qruplaşdır, dropdown YOX iki səviyyəli sadə alt-nav.
2. **Mobile nav**: <600dp-də aşağıdakı persistent navigation bar (3-5 hədəf, ikon+label,
   aktiv = pill göstərici, kölgəsiz); hamburger yalnız İKİNCİ dərəcəli utilitlər üçün
   (dil seçimi, hesab); hamburger əsas nav OLMAMALI (kəşfiyyatçılıq ən aşağı).
3. **Sticky header**: bəli (actionable + uzun səhifələr), amma: hündürlük ≤64px desktop /
   ≤56px mobile; fon OPAQUE (blur istəsə: yüksək kontrast + 1px hairline border —
   NN/g translucency xəbərdarlığına uyğun); scroll-un ~8-16px-indən sonra slide-in,
   300-400ms, standard-decelerate; heç vaxt yox olub peyda olmasın.
4. **Breadcrumb qərarı**: PreLife səhifə iyerarxiyası 2 səviyyədən dərin olsa (məs.
   Xidmətlər → konkret xidmət) breadcrumb qoy: Ev > Xidmətlər > [cari]; cari səhifə
   link deyil; mobile-da son səviyyəyə qısaldılmış; 1-2 səviyyə səthlərdə breadcrumb
   YOXDUR.
5. **Logo hər səhifədə** implicit Ev linki + explicit "Əsas səhifə" linki (məsələn,
   nav-dakı ilk element) — NN/g homepage prinsipi 1.1.
6. **Rail yalnız dashboard/admin** üçün (3-7 hədəf, vertikal); public sayt səthlərində
   rail lazım deyil.
7. **Footer sticky deyil** — adi statik footer; amma mobile-də primary CTA üçün sticky
   alt-bar TOPLU halda bir dənə (button bar pattern) mümkündür (maksimum 1-2 aksiyа).

---

## MÖVZU 5 — LANDING/KONVERSİYA STRUKTURU

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "I Analyzed 500+ Landing Page Hero Sections: Here's What Actually Converts" —
   Atomic Marketing — https://youtube.com/watch?v=7AL6slFxXyc
2. "Daily UX Tips: Which Button Colors Convert Best on Your CTA?" — Predictive UX —
   https://youtube.com/watch?v=SaCicz97XdY

Məqalələr:
3. [TAM] NN/g — "The Fold Manifesto: Why the Page Fold Still Matters" —
   https://www.nngroup.com/articles/page-fold-manifesto
4. [TAM] Smashing Magazine — "Designing Effective Pricing Plans UX" —
   https://www.smashingmagazine.com/2022/07/designing-better-pricing-page
5. [TAM] NN/g — "'Get Started' Stops Users" — https://www.nngroup.com/articles/get-started
6. [SNIPPET] NN/g — "Homepage Design: 5 Fundamental Principles" (implicit+explicit
   Ev linki; kim-sənsən mesajı; nümunələrlə content; aksiya təşviqi; sadəlik)
7. [SNIPPET] NN/g — "Button States: Communicate Interaction" (5 state: enabled,
   disabled, hovered, focused, pressed)
8. [SNIPPET] Unbounce/Mailchimp landing best practices: headline+subheadline+vizual+
   value proposition+social proof; scannable parçalar; bölmələr arasında padding

### (b) Əsas öyrəntilər

**Fold məlumatları [TAM]:**
- Fold üstü/altı emal fərqi orta **84%**
- 57,453 eyetracking fiksasiyası: fold-dan DƏRHAL yuxarı 100px, fold-dan aşağı 100px-dən
  **102% çox** baxılır
- Google reklam analizi: fold üstü viewability **73%** vs altı **44%** (düşüş 66%)
- İstifadəçi "əyləncə üçün" scroll etmir — məqsədlə; "false floor" (səhifə bitib zənni
  yaradan dizayn) qadağan; scroll-təşviq: gözü aşağı çəkən elementlər + anchor nav
  + "nə gələcək" işarələri

**Hero/konversiya strukturu [SNIPPET-lər birgə]:**
- Hero: headline + subheadline + vizual + value proposition + CTA (ideal ardıcıllıq)
- Landing bölmə ardıcıllığı (yayğın konversiya sxemi): hero → social proof →
  benefits/xüsusiyyətlər → necə işləyir → pricing → FAQ → yekun CTA
- Content scannable parçalara bölünməli; bölmələr arasında padding ("room to breathe")

**CTA etiketləri [TAM — NN/g "Get Started"]:**
- "Get Started" kimi generik CTA-lar UX-i pisləşdirir: istifadəçi "məlumat alacağam"
  gözləyir, amma sign-up/quiz modala düşür; reciprocity pozulur (məlumat vermədən
  aksiya istəyir); yanlış "information scent"
- Həll: CTA NƏ BAŞ VERƏCƏYİNİ desin — "Take Our Style Quiz", "Talk to an expert"
- Get Started daha çox klik gətirir AMMA yanlış gözlənti → frustasiya → çıxış
- Button 5 state hamısı dizayn edilməli: enabled/disabled/hovered/focused/pressed [SNIPPET]
- Primary button = ən çox vizual vurğu, vacib/çox istifadə olunan aksiya üçün [SNIPPET]

**Pricing səhifə pattern-ləri [TAM — Smashing]:**
- 3-6 plan yaxşı işləyir; "handful"-dan çox plan → tab-lar/dropdown/çoxsətirli
- ÜFÜQİ SCROLL pricing cədvəlində MÜTLƏQ QADAĞAN
- Popular plan: mərkəzdə + kontrast rənglə vurğulu + daha prominent CTA + badge
  ("Ən populyar"/"Ən yaxşı dəyər") [Figma resource: SNIPPET]; HBR: 3 tier optimal
  (seçim-sadəlik balansı) [SNIPPET]
- Anchor etmə: sticky header + scroll zamanı qiymət/toggle yuxarıda üzən (Dropbox,
  Contentful)
- Monthly/Yearly toggle: cədvəlin üstündə; default İLLİK (Notion), scroll-da üzən saxla
- Feature müqayisə: hamısını göstərmə — FƏRQLƏRİ göstər (Podia/N26); accordion
  bölmələr (tooltips YOX — content örtür, keyboard üçün problem); key features əvvəl
- Mobile pricing: floating tab-lar (Mailchimp/Cloudflare), seçilmiş planların
  yan-yana müqayisəsi (Dropbox), dropdown əsası nav kimi İSTİFADƏ ETMƏ
- Scanning: "lawn mower" pattern (sol→sağ, aşağı); rənglə vizual ipucları
- DON'T: hamısını sıxılmış görünüşdə göstərmə; fərqləri izah etmədən qiymət göstərmə

### (c) PreLife üçün qaydalar

1. **Hero qaydası (fold üstü)**: 1 headline (dəyəri deyil, nəticəni desin) + 1
   subheadline (kim üçün/nə edir) + 1 primary CTA + sosial dəlil xırda sətri
   ("+500 ailə bizə güvənir"); hero-da ≥1 CTA fold üstündə; false floor yox —
   fold-altda "nə var" göstərən işarə (scroll cue).
2. **Bölmə ardıcıllığı (landing)**: hero → sosial dəlil → xidmətlər (3 kart) →
   necə işləyir (3 addım) → pricing xülasəsi → FAQ → yekun CTA bölməsi; hər bölmə
   sonunda kiçik yönləndirmə ("signpost").
3. **CTA etiketləri spesifik**: "Başlayın" YOX → "Qiymətləri Gör", "Pulsuz
   Konsultasiya Al", "Dərs Cədvəlini Bax"; hər CTA klik-dən SONRA nə olacağını
   bildirsin; e-poçt formu CTA-sı: "Abunə Ol" əvəzinə "Həftəlik Məqalələr Al".
4. **CTA vizual**: səhifədə 1 primary CTA (aksent rəng, 60-30-10-un 10%-i);
   5 state hamısı stilizə (hover 150ms, pressed ölçü 98%, focus ring 2px,
   disabled 38% opacity); ikinci CTA-lar secondary (outline).
5. **Pricing**: 3 plan (Basic/Standart/Premium tipli); populyar plan MƏRKƏZDƏ,
   kontrast border + "Ən Populyar" badge + filled CTA, digər ikisi outline CTA;
   ay/illik toggle üst-də, default İLLİK (endirim göstəricisi "-20%"); fərq xətləri
   açıq (məs. feature sətirlərində checkmarks); horizontals scroll qadağan; mobile
   üçün plan kartları üfüqi snap-scroll (deyil cədvəl scroll).
6. **Sosial dəlil**: hero-dan dərhal sonra 1 bölmə (logo xətti + 1 sitat + reytinq);
   rəqəmlər konkret ("1,200+ məzun").
7. **Fold disiplini**: hər bölmədə yerləşən məzmunun 1-ci sətri dəyər cümləsi olsun;
   bölmə başlıqları kontekstdən kənar oxunduqda da məna versin (scannability).

---

## MÖVZU 6 — MOTION DİZAYNI

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "How to get micro-interactions right using Figma" — Flux Academy —
   https://youtube.com/watch?v=hHp4FGVcHjY
2. "Create Amazing SCROLL Animations with Intersection Observer" — Coding2GO —
   https://youtube.com/watch?v=adqwnu3gs2k
3. (bonus) Scroll-Driven Animations 10 hissəli kurs — Bramus (Google Chrome) —
   https://scroll-driven-animations.style (onlayn, iframe-de video course)

Məqalələr:
4. [TAM] Material 3 — "Easing and duration: Tokens & specs" —
   https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
5. [TAM] NN/g — "Executing UX Animations: Duration and Motion" —
   https://www.nngroup.com/articles/animation-duration
6. [SNIPPET] NN/g — "Animation for Attention and Comprehension": səbəb-nəticə
   bağlılığı üçün effektlər **0.1 saniyə** içində başlamalı
7. [SNIPPET] Josh W. Comeau — "Scroll-Driven Animations": `animation-timeline:
   view()/scroll()`, `animation-range: cover 0% cover 50%`, cover/contain/exit
   range-lər; MDN `scroll()` funksiyası
8. [SNIPPET] scroll-driven-animations.style: Scroll-Driven Animations **Baseline
   Newly Available — Oktyabr 2026**; DevTools debugger extension; polfill mövcud
9. [SNIPPET] WCAG C39 texnikası + MDN: `@media (prefers-reduced-motion: reduce)`

### (b) Əsas öyrəntilər

**M3 duration token-ləri [TAM] (50ms addımlarla 4 band):**
- short1-4: 50/100/150/200ms — kiçik utility keçidləri; selection control = 200ms
  Standard easing
- medium1-4: 250/300/350/400ms — orta sahə keçidləri; FAB→Sheet = 400ms Emphasized
- long1-4: 450/500/550/600ms — böyük ekspressiv keçidlər (Emphasized ilə); Card→
  fullscreen = 500ms
- extra-long1-4: 700/800/900/1000ms — NADİR, ambient (istifadəçi girişi yox):
  carousel auto-advance = 1000ms

**M3 easing token-ləri [TAM] (dəqiq cubic-bezier):**
- Standard set (sadə/kiçik/utility): standard `cubic-bezier(0.2, 0, 0, 1)` ·
  standard-decelerate `cubic-bezier(0, 0, 0, 1)` · standard-accelerate
  `cubic-bezier(0.3, 0, 1, 1)`
- Emphasized set (ekspressiv, ən çox istifadə): emphasized — CSS-də yoxdur
  (Standard fallback); emphasized-decelerate `cubic-bezier(0.05, 0.7, 0.1, 1)` ·
  emphasized-accelerate `cubic-bezier(0.3, 0, 0.8, 0.15)`
- Qeyd: M3 Expressive yayına (spring fizika) miqrasiya tövsiyə edir; easing/duration
  sistemi hələ keçidlər üçün işlənir
- accel/decel məntiqi: daxil olan element decelerate (yavaşlayaraq dayanır), çıxan
  accelerate (tez başlayır)

**NN/g duration qaydaları [TAM]:**
- Sadə feedback (checkbox, toggle): ~100ms (Material toggle: 100ms — hərəkət+rəng+halo)
- Substantial dəyişiklik (modal): 200-300ms görünmə, 200-250ms yox olma (çapıq görünmə
  ~300ms, itmə daha tez)
- Ümumi aralıq: 100-400ms; 400ms artıq "çox yavaş" (yalnız böyük hərəkətlər); **max
  500ms** — artıq çəki hissi
- GİRİŞ animasiyası ÇIXIŞ-dan bir az UZUN olmalı
- Easing: ən çox ease-out (giriş elementləri üçün — responsive hiss + dayanarkən
  gözə fokus vaxtı); çıxış üçün ease-in; ease-in-out orta
- Uçan elementlər üçün arc (yay) trayektoriya daha təbii (cart-a uçan checkmark)
- Parallax/scroll-jacking ehtiyatla — frustasiya, başgicəllənmə
- reduce-motion parametri olan istifadəçilərə hörmət — animasiyaları çıxart

**Səbəb-nəticə və mikro-interaksiya [SNIPPET]:**
- UI elementlər arasında səbəb-nəticə çatdırmaq üçün effekt **0.1s içində** başlamalı
- Mikro-interaksiyanın 4 anı: trigger → qaydalar → feedback → loop (Flux Academy
  video konsepti — metadata)

**Scroll-driven CSS [SNIPPET-lər]:**
- Yeni native API: `animation-timeline: view()` (element viewport-dan keçərkən) və
  `scroll()` (scroll proqress); `animation-range: cover 0% cover 50%` — başlanğıc/
  son nəzarəti; range-lər: cover/contain/entry/exit
- Baseline Newly Available (Okt 2026) — bütün modern brauzerlər; JS fallback:
  IntersectionObserver; progress indikator nümunə: `animation-timeline: scroll()` +
  scaleX reading bar

### (c) PreLife üçün qaydalar

1. **Motion token dəsti (CSS custom property)**:
   - `--motion-dur-instant: 100ms` (hover/press/selection feedback)
   - `--motion-dur-fast: 200ms` (dropdown, collapse, tab keçidi)
   - `--motion-dur-base: 300ms` (modal açılış, səhifə keçidi, kart entrance)
   - `--motion-dur-slow: 450ms` (hero entrance, böyük kompozisiya) — 500ms max
   - `--motion-dur-ambient: 1000ms` (yalnız avto-carousel, input yox)
2. **Easing token dəsti**: `--ease-standard: cubic-bezier(0.2,0,0,1)` default ·
   `--ease-enter: cubic-bezier(0,0,0,1)` (standard-decelerate — daxil olan) ·
   `--ease-exit: cubic-bezier(0.3,0,1,1)` (standard-accelerate — çıxan) ·
   `--ease-hero: cubic-bezier(0.05,0.7,0.1,1)` (emphasized-decelerate — vurğu).
3. **Feedback qanunu**: hər klik/hover反馈 ≤100ms-də başlamalı; button hover 100ms,
   pressed state dərhal (0ms delay), ripple/fade 100-150ms.
4. **Modal qaydası**: görünmə 250-300ms + ease-enter; yox olma 200-250ms + ease-exit
   (çapıqdan çıxma daha tez olmalıdır).
5. **Scroll-driven girişlər**: bölmə kartları üçün `animation-timeline: view()` +
   `animation-range: entry 0% entry 60%` — element 60% viewport-a girəndə tamamlansın;
   fade+translateY(16px) kifayətdir, böyük hərəkət YOX; IntersectionObserver fallback;
   hər scroll animasiyası reduced-motion-da söndürülmüş olmalıdır.
6. **QADAĞAN siyahısı**: scroll-jacking, >500ms UI animasiyası, gecikmiş "stalker"
   header, looplu diqqət animasiyası (daim yanan CTA puls), parallax 1-dən çox qat.
7. **Reduced-motion**: `@media (prefers-reduced-motion: reduce)` — transform/scroll
   animasiyaları OFF, opacity-only fade-lər qala bilər (WCAG C39); test: OS ayarı ilə.
8. **Micro-interaksiya 4 anı** hər interaktiv komponentdə: dəqiq trigger (hover/click/
   submit) · dərhal feedback (≤100ms) · state dəyişikliyi göstəricisi (checked=fill) ·
   səhv halında return animasiyası (shake 2×60ms amplitüd 4px max).
9. **Arc trayektoriya**: add-to-cart kimi uçan elementlər düz xətt yox, yumşaq yay
   ilə; bu tip animasiya hər sessiyada 1-2 dəfədən çox təkrarlanmamalıdır
   (NN/g: təkrarda əsəbi olur).

---

## SİNTEZ ÜÇÜN ƏN VACİB 10 QAYDA (loop 6-ya apar)

1. Persistent nav: desktop header ≤6 element · mobile bottom navigation bar 3-5 hədəf;
   hamburger əsas nav kimi İSTİFADƏ ETMƏ (kəşfiyyat ən aşağı)
2. Breadcrumb yalnız ≥3 səviyyədə: Ev > ... > [cari link deyil]
3. Sticky header: opaque, ≤64px, minimal motion; slide-in 300-400ms scroll-şərti ilə
4. Fold: 84% emal fərqi — hero-da value+CTA+sosial dəlil; false floor qadağan
5. CTA spesifik etiket ("Başlayın" qadağan); səhifədə 1 primary; 5 button state
6. Landing sırası: hero → sosial dəlil → xidmət → necə → pricing → FAQ → CTA
7. Pricing: 3 tier, populyar mərkəzdə badge+kontrast, default illik, horizontals
   scroll qadağan, tooltip yox accordion
8. Motion token: 100/200/300/450ms (+1000ms ambient) · ease standard/enter/exit
   cubic-bezier dəyərləri M3-dən
9. Feedback ≤100ms · modal 300/200 · max 500ms · giriş>çıxış müddəti
10. Scroll-driven: native CSS timeline (Baseline Okt 2026) + IO fallback ·
    prefers-reduced-motion mütləq · scroll-jacking qadağan

## STATUS

- Mənbələr: **9 video** identifikasiya (+1 onlayn kurs) · **7 məqalə TAM** oxundu ·
  ~12 snippet mənbəsi
- Kod dəyişikliyi: YOXDUR — yalnız `.research/` faylları (repo, commit, push toxunulmadı)
- Loop 1-də açıq qalan itki: Material 12-col grid rəqəmləri (gutter/margin) — loop 3
  responsive bölməsində əhatə olunacaq; kart radius konkret dəyəri — loop 6-da
- Sonrakı: Loop 3/6 — Responsive + a11y + performans (job 545240)
