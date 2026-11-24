# Loop 1/6 — VİZUAL DİZAYN ƏSASLARI — Qeydlər

Tarix: 2026-11-24 · Job 545235 · Trace: cron-agent-loop-202611241000

## METOD QEYDİ (vacib, loop 6 sintezində nəzərə alın)

- **YouTube transkriptləri oxunmadı** — sandbox IP-si YouTube ekosistemində bot-flagged:
  1. yt-dlp: "Sign in to confirm you're not a bot"
  2. Piped API (3 instansiya): eyni LOGIN_REQUIRED / Cloudflare
  3. youtubetotranscript.com: Cloudflare verify
  4. youtube.com/watch (description): CAPTCHA səhifəsi
  → Tapşırıqdakı **rəsmi fallback** tətbiq olundu: video description/metadata + eyni
  mövzuda məqalələrdən öyrənilmə. Video hovuzu axtarış metadata ilə (yt-dlp ytsearch)
  müəyyən olundu: başlıq + kanal + video ID qeyd edildi.
- **BONUS fakt yoxlaması**: AZ hərf dəstəyi REAL font faylları üzərində fontTools
  ilə yoxlanıldı (`scripts/check_az_fonts.py`, Google Fonts API → TTF → cmap).

İşarə: [TAM] = sənəd tam oxundu · [SNIPPET] = axtarış snippetindən · [FAYL] = real fayl yoxlaması

---

## MÖVZU 1 — PROFESSIONAL RƏNG SİSTEMLƏRİ

### (a) Mənbələr

Videolar (identifikasiya edildi; transkript bloklandı, description/metadata ilə):
1. "How to create a colour palette for your Figma Design system UI" — Brom Sulaiman —
   https://youtube.com/watch?v=DTYGF_OXRe4
2. "How to Apply a Color Palette to Your Design – Tutorial" — The Futur Academy —
   https://youtube.com/watch?v=eXcKOqviLE0
3. "Dark Mode Website Design | 6 Tips For Better Dark UI Design" — WPTuts —
   https://youtube.com/watch?v=JNhG2T6dGOY
4. "How I make UI color palettes" (5 addımlıq sistem) — WebSearch tapıntısı (ID maskalı)

Məqalələr:
5. [TAM] Refactoring UI — rəng bölməsi — https://refactoringui.com
6. [TAM] WCAG 2.2 Understanding SC 1.4.3 Contrast (Minimum) —
   https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
7. [TAM] Material Design — Dark theme — https://m2.material.io/design/color/dark-theme.html
8. [TAM] uinkits — "Dark Mode in UI Design – Best Practices for Better UX" —
   https://www.uinkits.com/blog-post/dark-mode-in-ui-design-best-practices-for-better-ux
9. [SNIPPET] WebAIM Contrast Checker — https://webaim.org/resources/contrastchecker
10. [SNIPPET] Atmos.style — "How to Build a Color System for UI Design" (3 qat arxitektura)
11. [SNIPPET] paletacolorpro — "UI/UX Palettes: Design Tokens" (9-11 shade)
12. [SNIPPET] NN/g — "Using Color to Enhance Your Design" (60-30-10)

### (b) Əsas öyrəntilər

**Token arxitekturası:**
- 3 qat: primitive (xam shade scale-lər, 50-950 və ya 100-900) → semantic (rol adları:
  surface, text, primary...) → component (komponent-səviyyəli: card-bg, button-hover) [SNIPPET: Atmos]
- Rəng başına 8-10 shade (Refactoring UI: "10 shades for each color"); başqa tövsiyə:
  9-11 shade (50-900) — subtle bg / border / hover / mətn üçün müxtəlif pillələr [SNIPPET]

**Refactoring UI rəng qaydaları [TAM]:**
- Hex-dən imtina et, HSL işlət (hue bir yerə toplanır, scale qurmaq asanlaşır)
- "Need more colors than you think" — 1 rəngə bir shade yetməz
- Shade-ləri ƏVVƏLCƏDƏN təyin et (uçma anında icad etmə)
- Lightness dəyişəndə saturasiyanı öldürmə ("don't let lightness kill your saturation")
- Greylər "gri" olmaq məcburiyyətində deyil — brend hue ilə azca tonlanır
- Yalnız rəngə güvənmə: error-a yalnız qırmızı deyil, ikon/mətn də əlavə et
- "Accessible doesn't have to mean ugly" — kontrast ilə estetika birlikdə gedir

**WCAG 2.2 kontrast hədləri [TAM]:**
- Normal mətn: ≥ 4.5:1
- Large text: ≥ 3:1 — large = ≥18pt (≈24px) normal və YA ≥14pt (≈18.5-18.66px) bold
- AAA: ≥ 7:1 (normal), ≥ 4.5:1 (large)
- İstisnalar: inaktiv UI komponentləri, dekorativ elementlər, logo mətni
- WebAIM təsdiqi: AAA normal 7:1, large 4.5:1 [SNIPPET]

**Dark mode (Material spesifikasiyası) [TAM]:**
- Surface: #121212 (təmiz qara YOX)
- Mətn/işarə ağ opacity: high-emphasis 87% · medium/hint 60% · disabled 38%
- Elevation = yarımşəffaf AĞ overlay: 00dp 0% · 01dp 5% · 02dp 7% · 04dp 9% · 08dp 12% ·
  12dp 14% · 16dp 15% · 24dp 16% (yəni qaranlıqda yuxarıda olan səth AÇIQ olur)
- Primary rəngi desaturasiya et — WCAG AA 4.5:1 üçün; doyğun rəng qaranlıq fonla
  "visual vibration" yaradır; 900-500 tonları əvəzinə 200-50 (açığ) tonları işlət
- Rəng iyerarxiyası sırası: background → surface → primary → secondary → on-* varyantları
- Error: light #B00020 → dark #CF6679
- Disabled konteyner: 12% ağ; label/işarə: 38% ağ
- uinkits [TAM]: təmiz qara fon göz yorğunluğu, təmiz ağ mətn qamaşma yaradır;
  light→dark İNVERSİYA YOX, xüsusi dark palitra qur; fon = brend primary-nin tünd shade-ləri
  (tünd göy/mavi-gri); istifadəçiyə mode toggle təklif et
- Dark mode-un 5 işi [SNIPPET]: hər tokenə qaranlıq dəyər · hər cütlük üçün kontrast
  yoxlaması · qalxan (raised) səthlər açıq · logo/qrafiklərin dark versiyası · toggle

**Palitra nisbəti:**
- 60-30-10 (NN/g [SNIPPET]): 60% dominant, 30% secondary, 10% accent

### (c) PreLife üçün qaydalar

1. **Primitive qat**: primary brend rəng üçün HSL ilə 50→950 scale qur (11 pillə);
   grey/neutral scale-i sıfır neutral YOX — primary hue ilə azca tonla.
2. **Semantic qat (minimal dəst)**: `--color-bg`, `--color-surface`, `--color-surface-raised`,
   `--color-text`, `--color-text-muted`, `--color-text-disabled`, `--color-primary`,
   `--color-primary-hover`, `--color-border`, `--color-success`, `--color-error`,
   `--color-warning`. Ad DƏYƏR deyil ROL bildirsin (dark mode hazır olsun).
3. **Kontrast büdcəsi**: body mətn ≥4.5:1; ≥24px başlıq / ≥18.66px bold ≥3:1;
   input border, ikon kimi UI komponentlər ≥3:1; AAA hədəfi yalnız hero mətnlərdə.
4. **Status rəngləri hazır cüt**: error light #B00020 / dark #CF6679; success/warning
   üçün də light+dark cütü tokenləşdir.
5. **Dark mode blueprint (indidən tokenləşdir)**: fon #121212-nin primary-türevi
   (tünd mavi-gri); mətn ağ 87%/60%/38%; kart elevation = %5→16 ağ overlay;
   primary-nin 200-50 arası tonları link/aktiv üçün; təmiz qara/ağ qadağan.
6. **60-30-10**: 60% neytral fon, 30% ikincil səth (kart/panel), 10% primary aksent
   (yalnız CTA + aktiv state).
7. **Rəng tək siqnal deyil**: error/success həmişə ikon + mətn ilə dəstəklənsin.

---

## MÖVZU 2 — TİPOQRAFİYA SİSTEMLƏRİ

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "The ULTIMATE Guide To Typography For Beginners" — DesignSpo —
   https://youtube.com/watch?v=AXpxZMRM1EY
2. "Typography Editor - Scale" — CodyHouse — https://youtube.com/watch?v=KZd_U03ldkA
3. "How to pair typefaces in Web Design like a pro" — https://youtube.com/watch?v=W4Vt-Y78hg4
4. "Variable Fonts for Web Design | FREE COURSE" — Envato Tuts+ —
   https://youtube.com/watch?v=9IFqv5uVP_c

Məqalələr:
5. [TAM] web.dev — "Variable fonts" — https://web.dev/articles/variable-fonts
6. [TAM] Baymard Institute — "Readability: The Optimal Line Length" —
   https://baymard.com/research-articles/line-length-readability
7. [TAM] Apple HIG — "Typography" —
   https://developer.apple.com/design/human-interface-guidelines/typography
8. [SNIPPET] typographymaster.com — "Type Scale Systems" (ratio cədvəli)
9. [SNIPPET] Medium/Sketch — "Exploring Responsive Type Scales" (Perfect Fourth 1.333)
10. [SNIPPET] Font pairing qaydaları: supercharge.design, premast.com, designhost (9 golden rules)
11. [FAYL] AZ hərf dəstəyi: 8 Google Font-un real TTF cmap yoxlaması
    (`scripts/check_az_fonts.py` — Google Fonts API → TTF → fontTools cmap)

### (b) Əsas öyrəntilər

**Modular type scale [SNIPPET]:**
- Base 16px; standart ratio-lar: 1.067 (minor second) · 1.25 Major Third (+25%/addım,
  ən restrained/iyerarxiya fərqi incə) · 1.333 Perfect Fourth (klassik, aydın kontrast) ·
  1.414 Augmented Fourth · 1.618 Golden Ratio
- Məqsəd: bütün ölçülər bir ritmdə — ixtisası ölçü icadı yox, hesablanmış pillələr

**Oxunaqlılıq metrikləri [TAM: Baymard]:**
- Optimal sətir uzunluğu: 50-75 simvol (CPL); Emil Ruder klassik ölçüsü 50-60;
  geniş istinad: 66 CPL ideal hədəf [SNIPPET]; WCAG 1.4.8: ≤80 simvol
- 100+ simvol sətirlər "intimidating" — istifadəçi oxumamağa keçir
- CSS həlli: `max-width: 70ch` (≈34em)
- A11y mətn tərzləməsi: line-height 1.5em · paraqraf arası 2em · word spacing 0.16em ·
  letter spacing 0.12em
- Desktop body line-height: 1.5-1.6 [SNIPPET]

**Variable fonts [TAM: web.dev]:**
- 5 rəsmi ox: wght (çəki) · wdth (eni) · slnt (maili) · opsz (optik ölçü) · ital;
  custom okslar BÖYÜK hərflə (məs. GRAD)
- Monotype eksperimenti: 48 statik fayl → 1 variable fayl = **-88% ölçü**
- 6 statik fayl (Oswald 200-700) əvəzinə 1 fayl; köhnə brauzerlər statik fallback alır
- @font-face: `font-weight: 100 1000;` aralığı + `format('woff2') tech('variations')`
- `font-variation-settings` İNHERTİS EDİLMİR — CSS variable-lərlə saxla
- Roboto Flex aralıqları: wght 100-1000 · wdth 25%-151% · GRAD -200..150 · slnt -10°

**AZ hərf dəstəyi [FAYL — real cmap yoxlaması]:**
```
TAM DƏSTƏK (ə ə ş ş ç ç ğ ğ İ ı ö ö ü ü hamısı):
  Inter · Noto Sans · Poppins · Montserrat · Roboto
ƏSKİK:
  Manrope: Ə (U+018F) yoxdur
  Open Sans: Ə yoxdur
  Rubik: Ə + ə (U+0259) YOXDUR — tam qadağan
```

**Font cütləşdirmə [SNIPPET]:**
- Maksimum 2-3 ailə; heading + body rolları bölüşdür; lazım olsa 3-cü yalnız vurğu üçün
- Əsas şərt KONTRAST: oxşar üslublu fontları cütləşdirmə (iki humanist sans = düz görünür);
  ya ya ox yox, ya çəki/ölçü kontrastı, ya serif+sans
- "Don't use too many fonts" · "Introduce hierarchy" · "Keep styles consistent"

**Apple tipoqrafiyası [TAM: HIG]:**
- SF Pro sistem şrifti; ailələr: SF Pro, SF Compact, SF Arabic, **SF Armenian**, SF Georgian,
  SF Hebrew, SF Mono; variable + optik ölçü dəstəyi (opsz)
- Dynamic Type (default): Large Title 34pt · Title1 28 · Title2 22 · Title3 20 ·
  Headline 17 · Body 17 · Callout 16 · Subhead 15 · Footnote 13 · Caption1 12 · Caption2 11
- AX a11y ölçüləri: 28→53pt (5 pillə)
- Minimum: iOS 11pt · macOS 10pt; iOS default body 17pt
- Ultralight/Thin/Light çəkilər kiçik mətndə oxunaqlı deyil — istifadə etmə
- SF Symbols çəkiləri SF Pro çəkiləri ilə bərabər tutulmalı

### (c) PreLife üçün qaydalar

1. **Şrift qərarı: Inter** — AZ hərf dəstəyi real fayl üzərində TƏSDİQLƏNDİ; 1 ailə,
   400/500/600/700 çəkilər. Body alternativi: Noto Sans. Fallback zənciri:
   `Inter, "Noto Sans", system-ui, sans-serif`
2. **YASAK (AZ üçün)**: Rubik (ə yox), Manrope və Open Sans (böyük Ə yox) —
   hero başlıqda "Ə" düşəndə dizayn sınır.
3. **Type scale: Major Third 1.25, base 16px** — incə, professional iyerarxiya:
   12 / 16 / 20 / 25 / 31 / 39 / 49 / 61 (yuvarlaqlaşdırılmış). Body 16px.
   (Əgər daha kəskin hero lazımdırsa yalnız hero üçün 1.333 addımı: 64px.)
4. **Body qaydası**: 16px, line-height 1.5-1.6, `max-width: 65-70ch` (≈34em);
   paraqraf arası ~1.5-2em; başlıq line-height 1.2-1.25.
5. **Variable woff2 + `font-display: swap`**; `@font-face`-də `font-weight: 400 700`
   aralığı; 1 fayl = bütün çəkilər (performans + AZ dəstək birlikdə).
6. **Hər AZ səhifəni test stringi ilə yoxla**: `Əə Şş Çç Ğğ İı Öö Üü` —
   fallback zəncirinə düşən hərf dərhal görünməlidir.
7. **Çəki qaydası (Apple-dan)**: kiçik mətndə Light/Thin YOX; minimum body 16px web-də
   (11pt iOS qaydasının web ekvivalenti 14px-altı mətn yalnız caption üçün).
8. **Cütləşdirmə tək ailə ilə**: Inter-in çəki + ölçü kontrastı (700 başlıq vs 400 body)
   kifayətdir; ikinci ailə yalnız monokod (kod blokları üçün) kimi funksional rollarda.

---

## MÖVZU 3 — LAYOUT VƏ SPACING

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "Why Product Designers (UX/UI) should be using a 8pt grid system | Tutorial" —
   Gemma Helyer — https://youtube.com/watch?v=ak_zNvESZL8
2. "Principles of VISUAL HIERARCHY: Redesigning a UI in Figma!" — Design Pilot —
   https://youtube.com/watch?v=crGNE8cKQ9o
3. "Premium Web Design & Apple-Style UI/UX" — Cueball Agency —
   https://youtube.com/watch?v=hrUaY2D753Q

Məqalələr:
4. [TAM] spec.fm — "Intro to the 8pt Grid System" — https://spec.fm/specifics/8-pt-grid
5. [SNIPPET] NN/g — "Visual Hierarchy in UX: Definition" + "Good Visual Design" +
   "5 Principles of Visual Design"
6. [SNIPPET] Tailwind CSS spacing scale (4px əsas, proporsional: 16 = 2×8)
7. [SNIPPET] Apple whitespace analizləri: prezlab.com, saltechsystems.com

### (b) Əsas öyrəntilər

**8pt grid [TAM: spec.fm]:**
- Bütün ölçü/padding/margin 8-in qatları; mətn üçün 4pt baseline grid ilə birləşir
  (Material 4pt grid işlədir); root font 16px-də .5rem artımları = 8px
- 7/8 spacing seçimi kənarlaşdırılır → daha az qərar, daha çox konsistensia
- Populyar ekranlar ən azı bir oxda 8-ə bölünür (iPhone 375×667 nümunəsi)
- Hard grid (görünən grid-ə yerləşdir) vs Soft grid (elementlər arasında 8 ölç)
- @1x dizayn et, 2x/3x asset-lər çıxarılır

**Spacing scale [SNIPPET: Tailwind]:**
- 4px əsas artım; proporsional (16 = 2×8) → klassik zəncir: 4 / 8 / 12 / 16 / 24 / 32 /
  48 / 64 / 96 (mikro → element → komponent → bölmə → hero)

**Vizual iyerarxiya [SNIPPET: NN/g]:**
- İyerarxiya yaradan atributlar: ölçü (scale — böyük diqqət cəlb edir), kontrast,
  çəki, pozisiya, spacing
- "Good Visual Design" düsturu: grid-ə düzülüş + aydın iyerarxiya + intensional rəng +
  konsistensia
- Proximity / Common Region: əlaqəli elementlər birlikdə və konteynerdə — whitespace
  özü "qruplaşdırma alətidir"

**Apple estetikası [SNIPPET: analizlər]:**
- Whitespace = premium hissi: fokus, oxunaqlılıq, sakit, clutter-free təcrübə
- Restrained rəng + clean tipoqrafiya + böyük başlıqlar
- XƏBƏRDARLIQ (saltech): Apple-ın "ən az məzmun" mesaj strategiyası hər brendə
  tərcümə olunmur — whitespace estetikasını götür, kontent azlığını götürmə

**Apple ölçü referansı [TAM: HIG]:** body 17pt (iOS), min 11pt — mobile-first ölçüdə
default body heç vaxt 16px-dən kiçik olmamalıdır.

### (c) PreLife üçün qaydalar

1. **Spacing tokenləri (px; 4px əsas)**: 4, 8, 12, 16, 24, 32, 48, 64, 96.
   Tətbiq: mikro 4 · element daxili 8-12 · element arası 16-24 · kart padding 16-24 ·
   bölmə daxili boşluq 24-32 · bölmə arası 48-96.
2. **Bölmə vertical padding**: desktop 80-96px · mobile 48-64px — hər bölmə "nəfəs alsın".
3. **Container**: max-width 1200-1280px, mərkəzləşdirilmiş; mətn blokları 65-70ch ilə
   məhdud (Mövzu 2 qaydası ilə birləşir).
4. **8pt disiplin**: bütün margin/padding/height token zəncirindən seçilir —
   xüsusi rəqəm (məs. 13px) qadağan; borderline yeganə istisna (1px).
5. **Vizual iyerarxiya ≥3 səviyyə**: H1 → H2/H3 → body → caption; ölçü fərqi minimum
   2 scale addımı; hər səhifədə YALNIZ 1 primary CTA (aksent rəng + ən böyük düymə).
6. **Proximity qaydası (formlar)**: label↔field 8px · field↔field 16-24px ·
   field qrupları arası 32px+ — əlaqə spacing ilə oxunmalıdır.
7. **Kart estetikası**: radius 16-24px aralığı (Apple-vari yumşaqlıq — dəqiq dəyər
   loop 2/6-da komponent səviyyəsində dəqiqləşəcək); 1px hairline border (açık rəng)
   + 2 səviyyə kölgə (sm/lg).
8. **Minimalizm qaydası**: 1 bölmə = 1 mesaj = 1 CTA; boşluğu "məzmun azlığı" kimi
   yox, "vurğu vasitəsi" kimi işlət; hero bölgəsində maksimum whitespace.

---

## SİNTEZ ÜÇÜN ƏN VACİB 10 QAYDA (loop 6-ya apar)

1. Token 3 qatı: primitive (50-950) → semantic (rol adları) → component
2. Kontrast büdcəsi: 4.5:1 normal / 3:1 large+UI / 7:1 AAA
3. Dark mode blueprint: #121212-vari fon · ağ mətn 87/60/38 · elevation +%5→16 ağ
   · primary 200-50 tonu — semantic tokenlər ilə indidən hazır tut
4. Şrift: Inter (AZ tam dəstək təsdiqli); Rubik/Manrope/Open Sans AZ-də qadağan
5. Major Third 1.25 scale, base 16 · body 16px/1.5 · max 65-70ch
6. 8pt grid + 4px mikro; spacing zənciri 4→96; xüsusi rəqəm qadağan
7. 60-30-10 rəng payı: 60 neytral / 30 ikincil / 10 aksent
8. İyerarxiya: ölçü+kontrast+çəki+pozisiya+spacing; ≥3 səviyyə, 1 primary CTA
9. Apple minimalizmi: whitespace = premium; 1 bölmə = 1 mesaj = 1 CTA
10. AZ render testi: `Əə Şş Çç Ğğ İı Öö Üü` hər səhifədə keçməlidir

## STATUS

- Mənbələr: **14 video** identifikasiya edildi (transkriptlər bot-bloklu — fallback
  məqalələr ilə) · **12 məqalə/sənəd** oxundu (7 tam + 9 snippet) · **8 font faylı**
  real cmap yoxlaması
- Kod dəyişikliyi: YOXDUR — yalnız `.research/` qeydləri + `scripts/check_az_fonts.py`
  (repo, commit, push toxunulmadı)
- Yoxlanılmamış sahələr (loop 2/6-da dəqiqələşər): Material 12-col grid rəqəmləri
  (gutter/margin), kart radius konkret dəyəri
- Sonrakı: Loop 2/6 — UX naviqasiya + motion (job 545239)
