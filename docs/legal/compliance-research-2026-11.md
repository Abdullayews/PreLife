# PreLife — Hüquqi uyğunluq araşdırması (noyabr 2026)

Bu sənəd prelife.net-in real funksiyalarına əsasən aparılmış hüquqi araşdırmanın
birinci tam versiyasıdır. Məqsəd: hansı funksiya hansı hüquqi tələbə toxunur və
nəyə, hansı ardıcıllıqla diqqət yetirməliyik.

Araşdırma 4 paralel iz üzrə aparılıb: (1) EU/UK, (2) Azərbaycan, (3) Rusiya +
Qazaxıstan, (4) vendor/prossesor zənciri (Google Gemini, z.ai, Supabase, Brevo,
Render). Hər fakt etibarlılıq etiketi daşıyır:

- **[V]** — birbaşa rəsmi mənbədən yoxlanıb (URL siyahıda)
- **[R]** — etibarlı ikinci dərəcəli mənbədən / peşəkar bilikdən, canlı URL
  alınmayıb (yerli hüquq məsləhətçisi ilə təsdiqlənməlidir)
- **[U]** — yoxlanıla bilməyib, mütləq yerli məsləhətçi təsdiqi lazımdır

**Bu sənəd hüquqi məsləhət deyil** — texniki komandanın addım planıdır; hər
bölmənin hüquqi təsdiqi AZ-barəli hüquq firmasından alınmalıdır.

---

## 1. Metodologiya qısa

- Kodbazadan funksiya inventarı çıxarıldı (route-lar, DB sxeması, AI prompt-ları,
  cookie-lər, mail axınları) — bütün tapıntılar real data axınlarına bağlanır.
- EU mənbələri birbaşa oxundu: EUR-Lex, gdpr-info.eu, EDPB, AI Act mətnləri,
  vendor şərtləri (ai.google.dev, supabase.com, render.com, brevo.com, docs.z.ai).
- Azərbaycan/Rusiya mənbələri: e-qanun.az və pravo.gov.ru bu şəbəkədən çatılmır;
  axtarış motorları boş nəticə qaytardığından AZ/RU tapıntılarının çoxu [R]/[U]
  səviyyəsində qalır. Bu boşluq sənədin 8-ci bölməsində "açıq suallar" kimi
  siyahılanıb.

---

## 2. Funksiya inventarı (hüquqi baxımdan əhəmiyyətli data axınları)

| Funksiya | Toplanan/göndərilən data | Xüsusi diqqət |
|---|---|---|
| Auth (email+parol, Google/Apple OAuth) | email, ad, avatar, device adı, user-agent, session token | parol scrypt; session `pl_session` HttpOnly |
| Profil | ad, username, avatar, dil, fitness səviyyəsi, həftəlik məşq, oxu hədəfi, **çəki jurnalı (kq)**, boy/məqsəd (AI kontekstində) | çəki/boy = sağlamlıq-əlaqəli |
| Gym | AI planları (sorğu: təcrübə, avadanlıq, günlər, fokus, **fiziki məhdudiyyətlər/zədələr**), progress | məhdudiyyət sahələri sağlamlıq datasıdır |
| Diet | yemək planları, reseptlər, su izləmə, çəki izləmə | — |
| Psixologiya | **mood jurnalı (mood/enerji/yuxu keyfiyyəti 1–5 + teqlər + qeyd)**, **gündəlik (sərbəst mətn)**, meditasiya progressi, **test nəticələri**, psixoloq kataloqu + bron (onlayn/ofline, AZN/50 dəq, manual ödəniş təsdiqi) | ən həssas blok — mental sağlamlıq |
| Library | kitab rəfi, oxu hədəfləri | — |
| AI köməkçi (Gemini primary, z.ai fallback) | sistem prompt-ları + **kontekst: ad, email, profil (çəki/boy/məqsəd daxil), cari səhifə, aktiv plan, abunəlik** + tam söhbət tarixi | AI hesabda **hərəkət edə bilir** (ad/çəki/boy/məqsəd/dil dəyişmə, plan qurma, paket yaratma) |
| Abunəliklər | plus/pro/ultra AZN/ay, custom paketlər (server tərəfli qiymət), 1/3/6/12 ay endirimləri, sorğu əsaslı aktivləşdirmə | onlayn ödəniş qapısı hələ yoxdur |
| Cookie-lər | pl_session, pl_oauth, pl_cookies, NEXT_LOCALE, pl-theme, pl-motion, prelife-offline-v1 (hamısı first-party) | analytics/tracking yoxdur; bar: bərabər Qəbul/Et |
| Email (Brevo) | yalnız transaksiya: təsdiq, ödəniş-xatırlatma, soruş-dəyi | marketinq email-i yoxdur |
| İnfrastruktur | Render (US), Supabase (region yoxlanılmalı) | lokallaşdırma mövzusu — bax 6.5 |
| Boşluqlar | **hesab silinməsi endpoint-i yoxdur, data export yoxdur**, yaş yoxlaması yoxdur, DPO yoxdur, DPIA yoxdur | ən vacib qəluq bölgəsi |

Texniki fakt (kod yoxlaması): z.ai fallback yalnız `.z-ai-config` faylı
olduqda aktivləşir; fayl repoda commit olunmayıb və yalnız sandbox-da
(`/etc/.z-ai-config`) mövcuddur — **istehsalatda (Render) fallback ölüdür**.
Gemini isə hər halda primary provider-dir.

---

## 3. EU/UK tapıntıları

### 3.1 GDPR tətbiqi və sağlamlıq datası (Art. 9)

- GDPR Art. 3(2) üzrə tətbiq olunur: EN versiyası EU istifadəçilərinə xidmət
  təklif edir. **[V]**
- Mood jurnalları, gündəlik, testlər və psixoloq-yoldaşı konteksti **"data
  concerning health"** kimi qiymətləndirilmə riski yüksəkdir: Recital 35 mental
  sağlamlığı açıq göstərir; CJEU (*GC and Others*, C-560/22; *OQ v Gunvor*,
  C-590/22) kontekst/korrelyasiya yolu ilə də xüsusi kateqoriya statusu verir.
  **[V — mətn; C-560/22/C-590/22 tam mətni alınmadı: R]**
- Nəticə: bu blok üçün **ayrıca, granulyar, açıq razılıq (explicit consent)**
  qatı lazımdır — müqavilə əsası (Art. 6(1)(b)) Art. 9 üçün heç vaxt kifayət
  etmir. Çəki/boy təkbaşına sərhəddi datasayılır, amma "fiziki məhdudiyyətlər"
  (gym sorğusu) və mood qeydləri ilə birlikdə təsnifat güclənir. **[V]**

### 3.2 AI Act (Regulation 2024/1689) — cari status

- Ümumi tətbiq **2 avqust 2026-dan qüvvədədir**; qadağalar + AI-savamlılıq
  (Art. 4) 02.02.2025-dən, GPAI 02.08.2025-dən. **[V]**
- "Digital Omnibus on AI" (Regulation (EU) 2026/1744, qüvvədə 27.07.2026)
  yüksək-risk öhdəliklərini Annex III üçün 02.12.2027-yə, Annex I üçün
  02.08.2028-ə təxirə salır; Art. 5-ə yeni qadağalar 02.12.2026-dan. **[V]**
- **Art. 50(1)**: AI sistemi ilə qarşılıqlı təsir barədə istifadəçini
  məlumatlandırmaq — bizim üçün hazırda tətbiq olunur (2.08.2026-dan). Biz
  yalnız deployer deyil, öz prompt/brendinqimizlə **provider da sayıla
  bilərik** → çat UI-da ilk interaksiyada açıq "AI" bildirişi + davamlı etiket.
  **[V]**
- **Art. 50(2)**: sintetik mətnin machine-readable işarələnməsi — 02.12.2026-ya
  qədər keçid müddəti (bizim köhnə sistemlər üçün); müvəqqəti olaraq çat
  bazamızda `ai_generated` bayrağı + AI Office code of practice izləməsi.
  **[V]**
- Art. 5(1)(a)/(b) (manipulyasiya): dürüst etiketlənmiş, destekləyici wellness
  çatbotu qadağan sinirə düşmür; risk **engagement-maksimallaşdıran dizayn**
  psixoloji distress kontekstində yaradır (streak-guilt, "peşəkara deyil, mənə
  yaz" yönləndirməsi). Art. 5(1)(f) emosiya tanıma qadağası yalnız iş yeri/təhsil
  üçündür — self-report mood jurnalı toxunmur. **[V]**
- Bizim AI xüsusiyyətləri (hazırda) yüksək-risk deyil: Annex III kateqoriyaları
  (əmək, təhsil, əsas xidmətlər, kredit) wellness istehlakçısını əhatə etmir.
  Diaqnoz/tedavi iddiası əlavə olunarsa yenidən təsnifat lazımdır. **[V]**

### 3.3 Kənar ölkələrə ötürülmə (Ch. V) — ən yüksək riskli axın

- **Gemini API free tier**: Google prompt/cavabları ML təkmilləşdirmə üçün
  istifadə edir, **insan reviewer-lər oxuya bilər**; "Do not submit sensitive,
  confidential, or personal information to the Unpaid Services". **[V]**
- **Kritik şərt**: "You may use only Paid Services when making API Clients
  available to users in the European Economic Area, Switzerland, or the United
  Kingdom" — EEA/UK istifadəçiləri üçün free tier **müqavilə ilə qadağandır**.
  **[V]**
- Paid tier: promptlar təlim üçün istifadə olunmur, Google DPA (processor
  rejimi) tətbiq olunur, SCC modulları daxildir; promptlar yalnız abuse-qarşı
  müvəqqəti loglanır. **[V]**
- **z.ai** (Jingsheng Hengxing Technology Pte. Ltd., Sinqapur; Zhipu AI ilə
  əlaqəsi geniş xəbər olunur [R]): DPA-sı **SCC daxil etmir, subprocessor
  siyahısı yoxdur, təhlükəsizlik əlavəsi yoxdur**. Sinqapurun EU adequacy qərarı
  yoxdur → EU istifadəçilərinin datası üçün yararsız. **[V]**
- Supabase DPA: SCC 2021/914 (Module 1–3), region tövsiyəsi tanınır; EU
  regionları: eu-central-1 (Frankfurt), eu-west-3 (Paris), eu-west-1, eu-north-1.
  **[V]**
- Render DPA: SCC 2021/914 + UK Addendum; regionlar: Frankfurt (yeganə EU).
  **[V]**
- EDPB ChatGPT Taskforce hesabatı (23.05.2024) və Opinion 28/2024: mərhələ-mərhələ
  qanuni əsas; AI çıxışlarının fakt dəqiqliyi; prompt-da data minimizasiyası;
  DPIA gözləntisi; çat loglarında asan silmə/çatışdırma. **[V]**

### 3.4 ePrivacy + cookie-lər

- Mövcud setimiz (session, consent-state, locale, theme, motion, PWA cache)
  first-party və əsasən "strictly necessary" tiplidir → banner labüd olmaya
  bilər, amma hər cookie üçün məqsəd sənədləşməsi lazımdır. **[V]**
- **Reject yalnız yaddaşda qalır** (visit-only) — bu, EDPB Guidelines 03/2022
  "nagging" dark-pattern oxuması riskidir: reject seçimi saxlanılmalıdır.
  **[V]**
- Bərabər Qəbul/Et düymələri — artıq qaydalığa uyğundur. Analytics əlavə
  olunarsa granulyar consent məcburi olacaq (C-252/21 Meta əsassız "hamısı
  və ya heç biri" modelinə qarşı). **[V]**
- UK: PECR reg 6 05.02.2026-da Data (Use and Access) Act 2025 ilə əvəz
  olunub — yeni Schedule A1 first-party statistik cookie-lərə consent olmadan
  (məlumat + opt-out) icazə verir, "seçimlərin saxlanması" (theme/locale/motion)
  açıq şəkildə strictly necessary-ə daxildir. UK-da mövcud cookie setimiz üçün
  bar qanuni və faktiki lazımsızdır. **[V]**

### 3.5 İstehlakçı hüququ

- CRD 2011/83/EU: məsafədən müqavilə üçün 14 gün geri çəkilmə; dərhal ifa
  üçün **ayrıca açıq razılıq + ləğv hüququndan məhrum olma etirafı** (Art.
  16(l) məntiqi) — abunəlik aktivləşdirmə və psixoloq seansı bronunda bu axın
  lazımdır. **[V]**
- Directive 2019/770: rəqəmsal xidmətlərin uyğunluğu/remediləri — **"data ilə
  ödənilən" pulsuz hesablar da daxildir**. **[V]**
- Directive 2019/2161: qiymət endirimi elanı qaydaları; ümumi ön-müqavilə
  informasiyası. **[V]**
- Regulation 2018/302 (geo-blocking): AZ-əsaslı trader üçün AZN qiymət EU
  istifadəçilərinə qanunidir; ümumi qiymət (vergi daxil) ön-müqavilədə
  göstərilməlidir. **[V]**
- Avto-yenilənmə üzrə horizontal EU qanunu hələ yoxdur; "Digital Fairness
  Act" təklifi danışıqdadır — izlənilməli. **[U]**

### 3.6 DSA, EAA, minors, nümayəndə

- DSA (2022/2065): gündəlik/mood məzmunu istifadəçi məzmunudur → PreLife
  **hosting service**-dir (online platform deyil — məzmun dərc olunmur). Tətbiq
  olunanlar: Art. 14 (ToS-də məzmun qaydaları/aydın dildə moderasiya), Art. 16
  (qanunsuz məzmun bildiriş kanalı), şikayət mexanizmi. Art. 28 (minors)
  tətbiq olunmur. **[V]**
- EAA (2019/882, 28.06.2025-dən): abunəlik/bron ödəniş axını e-commerce
  xidmətidir → EN 301 549 / WCAG 2.1 AA + accessibility statement.
  **[V]**
- GDPR Art. 8: consent-əsaslı emal üçün 16 yaş (member state 13-ə endirə
  bilər); signup-da yaş yoxlaması yoxdur → age gate + valideyn razılığı axını
  lazımdır. **[V]**
- **Art. 27 EU nümayəndəsi**: AZ-əsaslı controller, EU istifadəçilərinə fasiləsiz
  xüsusi-kateqoriya emalı təqdim edir → yazılı EU nümayəndə təyin etmək
  **lazımdır** (istisna tətbiq olunmur). Main establishment olmadığından
  one-stop-shop yoxdur — hər üzv dövlət DPA-sının yurisdiksiyası var. **[V]**

### 3.7 Subyekt hüquqları, pozuntu, DPIA

- Art. 15–22 (1 ay cavab, identifikasiya yoxlaması ilə); Art. 33 (72 saat DPA),
  Art. 34 (yüksək riskdə subyektə bildiriş). **[V]**
- **Hesab silinməsi və data export endpoint-lərinin olmaması** Art. 17/20-nin
  birbaşa pozuntusudur (email ilə əl ilə idarə hüquqi olaraq mümkündür, amma
  loglanmalıdır). **[V]**
- DPIA məcburidir (Art. 35(3)(b) + WP248 meyarları: xüsusi kateqoriya + yeni
  texnologiya + qiymətləndirmə + həssas subyektlər). Əhatə: AI kontekst axını,
  Gemini/z.ai ötürmələri, cookie-lər, minors, bronlar. **[V]**

---

## 4. Azərbaycan tapıntıları

**Vacib xatırlatma**: bu bölmədə əksər konkret maddə nömrələri canlı mənbədən
təsdiqlənə bilmədi ([R]/[U]); e-qanun.az bu şəbəkədən açılmır. Sonrakı addım
yerli hüquq firması ilə tam mətn təsdiqidir.

- **Şəxsi məlumatlar haqqında Qanun** (11.05.2018, qüvvədə 01.05.2019 [R]);
  2024–2025 dəyişiklikləri və yeni nəzarət strukturu haqqında məlumatlar
  təsdiqlənməli [U]. 2022 statusu üzrə [V — DLA Piper]: nəzarət orqanı **Rəqəmsal
  İnkişaf və Nəqliyyat Nazirliyi** idi; personal-data informasiya sistemlərinin
  **DPA-da qeydiyyatı** tələb olunur (məhdud istisnalarla); beynəlxalq ötürmə
  üçün subyektin əvvəlcədən yazılı razılığı (açıq kateqoriya istisna); pozuntu
  bildirişi öhdəliyi yox idi (2022 statusu). 2024+ dəyişikliklər (72 saat
  bildiriş, DPO tipli rollar, cərimələrin artırılması) **[U]**.
- **Lokallaşdırma**: "İnformasiya, informasiya texnologiyaları və informasiyanın
  mühafizəsi haqqında" Qanun (2012) üzrə internet-informasiya resurs
  sahiblərinin AZ istifadəçilərinin şəxsi məlumatlarını AZ ərazisində saxlamağı
  tələb edən müddəa [R — maddə nömrəsi təsdiqlənmədi]. Əməliyyatda əsasən
  AZ-qeydiyyatlı subyektlərə tətbiq olunur; xarici hostinqə qarşı icra
  qeyri-müntəzəmdir [U]. Bizim üçün **struktur qərarını müəyyən edir**: AZ hüquqi
  şəxsi ilə işləyiriksə, Supabase/Render US arxitekturası ilə uyğunsuzluq riski var.
- **İstehlakçı hüququ**: 1995 qanunu əvəz edən yeni istehlakçıların hüquqlarının
  müdafiəsi qanunu [R — tarix/maddələr təsdiqlənmədi] məsafədən müqavilələr,
  ön-müqavilə informasiyası və geri çəkilmə hüququ gətirir; tənzimləyici —
  Dövlət Antimonopiya və İstehlak Bazarına Nəzarət Xidməti [R].
- **Psixologiya xidmətləri**: tibbi fəaliyyət Səhiyyə Nazirliyi lisenziyası
  tələb edir; psixoterapiya tibbi xidmət sayılır; **qeyri-tibbi psixoloji
  məsləhət lisenziya boşluğundadır** [U]. Partnyor psixoloqların diplom/lisenziya
  sənədlərinin faylda saxlanması + müqavilələrdə "qeyri-tibbi dəstək" çərçivəsi
  tələb olunur.
- **Reklam haqqında Qanun** (2015 [R]): sağlamlıq/tibbi xidmət reklamına
  məhdudiyyətlər — müalicə vədi, diaqnoz iddiaları qadağan dairəsindədir;
  kataloq və marketinq mətnlərindən "müalicə edir" tipli ifadələr təmizlənməlidir.
- **AI**: AZ süni intellekt strategiyası (2025–2028, prezident sərəncamı ilə
  [R]) ekosistem/öyrənməyə yönəlib; AI chatbot-a xüsusi öhdəlik qoyan qanun
  bilinmir [U]. UI-da AI açıqlaması (EU AI Act ilə paralel) ən yaxşı təcrübədir.
- **Onlayn müqavilələr**: clickwrap ToS ümumiyyətlə icra olunur, sübut üçün
  versiyalı qəbul + zaman damğası audit qeydi lazımdır; "Elektron imza və
  elektron sənəd haqqında" Qanun (15.04.2021 [R]) təkmilləşdirilmiş imzanı
  əl-imzasına bərabər sayır — partnyor müqavilələri üçün.
- **Ödənişlərə hazırlıq**: kassa/e-kassa öhdəlikləri (2024–2025 vergi
  dəyişiklikləri [R]), e-qaimə-faktura (ƏDV qeydiyyatında), nağdsız qəbul
  öhdəliyi — real ödəniş qapısı qoşulmazdan əvvəl mühasib rəyi alınmalıdır.
- **Email**: AZ-da e-marketinq üçün razılıq tələb olunmur, amma **opt-out
  (abunədən-çıxma) sistemi tələb olunur** [V — 2022 statusu]. Bizim mail-lər
  transaksiyadır; marketinq əlavə olunarsa opt-out registry lazımdır.

---

## 5. Rusiya + Qazaxıstan tapıntıları

**Metodoloji xatırlatma**: RU/KZ mənbələri bu sessiyada canlı təsdiq almadı
(Bing bu şəbəkədən HK bazarı qaytarır, Google JS tələb edir); aşağıdakılar
peşəkar bilik əsasında [R]/[U] səviyyəsindədir. RU bazarı qərarı (7-ci addım)
qəbul olunmazdan əvvəl RU-üzlü hüquq firması ilə təsdiq şərtdir.

- **152-ФЗ eksterritorialdır**: RU dilində versiya + RU istifadəçiləri = operator
  statusu; LinkedIn (2016–17 məhkəmə/bloklama) presedenti varlıq tələb etmir.
  **[R]**
- **Lokallaşdırma (m. 18 hissə 5, 242-ФЗ)**: RF vətəndaşlarının şəxsi
  məlumatlarının **ilkin bazası RF ərazisində** olmalıdır; 2021–2024-cü illərdə
  Google, Airbnb, Booking, Apple, WhatsApp-a məruzə cərimələr; imtina =
  bloklama (Art. 15.5). US stack ilə strukturuyğun deyilik. **[R]**
- **Kənar ötürmələr**: 01.03.2023-dən Roskomnadzora əvvəlcədən bildiriş;
  "qeyri-dost" ölkələrə (ABŞ, Fransa, UK daxil) ötürmələrə artan nəzarət;
  Sinqapur siyahıda deyil. Pozuntu bildirişi: **24 saat RKN + 72 saat nəticə**
  (266-ФЗ). Mood/journal/çəki datası 152-ФЗ m.10 üzrə xüsusi kateqoriyadır —
  yazılı razılıq rejimi. **[R]**
- **Reklam**: öz xidmətlərinin təbliği saytın öz səhifələrində faktiki
  olduqda reklam sayılmır; saytdan kənar pullu təbliğ ERID token + ОРД öhdəliyi
  tələb edir — RU auditoriyasına hər hansı pullu kampaniyadan əvvəl. **[R]**
- **Onlayn psixologiya**: qeyri-tibbi psixoloji yardım lisenziya tələb etmir;
  psixoterapiya tibbidir (804н nomenklaturası). 436-ФЗ üzrə yaş işarələnməsi:
  moderasiyasız sərbəst mətn + AI çat olan sayt üçün təhlükəsiz etiket 18+.
  Rəqəmsal razılıq yaşı: 18 (valideyn nümayəndəliyi). **[R]**
- **Qazaxıstan**: yeni "О персональных данных и цифровых данных" Qanunu
  (№ 105-VIII, 2024, mərhələli qüvvəyəmin 2025-dən [R]) — KZ vətəndaşlarının
  datasının KZ ərazisində saxlanması tələbi saxlanılır, ötürmələr təsdiqlənmiş
  ölkələr siyahısı ilə məhdudlaşır, pozuntu bildirişi öhdəliyi gəlir [U —
  spesifikalar təsdiqlənmədi]. KZ push-edilməzdən əvvəl tam mətn yoxlanılmalıdır.
- **Ödəniş reallığı**: RU-buraxılmış kartlar xarici saytlara ödəyə bilmir —
  RU istiqamətində monetizasiya əslində bağlıdır. **[R]**

---

## 6. Funksiya → hüquqi risk xəritəsi

| # | Funksiya | Ən yüksək risk | Tələb edən normalar | Nə edilməli |
|---|---|---|---|---|
| 1 | AI köməkçi + psixoloq-yoldaşı + plan qurucu | **Kritik**: mood-kontekstli söhbət xarici LLM-ə gedir; free tier = training + insan oxuyur | Gemini ToS [V]; GDPR Art. 9/44 [V]; AI Act Art. 50 [V] | Paid tier-ə keçid (bu həftə); prompt-dan ad/email çıxarışı; UI-da AI bildirişi; `ai_generated` bayrağı |
| 2 | Mood jurnalı, gündəlik, testlər | **Kritik**: xüsusi kateqoriya (sağlamlıq) datası, explicit consent qatı yoxdur | GDPR Art. 9 [V]; 152-ФЗ m.10 [R]; AZ PDPA razılığı [R] | Granulyar consent ekranı (default: off); geri çəkilə bilən; loglanan |
| 3 | Hesabın öz-özünə silinməsi/exportu | **Kritik**: mövcud deyil | GDPR Art. 17/20 [V]; AZ PDPA [R]; 152-ФЗ [R] | `/api/me/export` (JSON/CSV) + `/api/me/delete` + 30 günlük grace period |
| 4 | Cookie barı | Orta: reject yaddaşda qalır | ePrivacy Art. 5(3) + EDPB 03/2022 [V] | Reject-i persist et; cookie başına məqsəd sənədi (/cookies-da var) |
| 5 | Abunəliklər + custom paketlər + psixoloq bronu | Orta: geri çəkilmə hüququ axını yoxdur; qiymət şəffaflığı | CRD 2011/83 Art. 16(l) [V]; 2019/770 [V]; AZ istehlakçı qanunu [R] | 14 gün geri çəkilmə məlumatı + dərhal ifa üçün ayrıca consent + etiraf checkbox; vergi daxil ümumi qiymət |
| 6 | Auth + yaş yoxlaması | Orta: yaş gate yoxdur; minors üçün mental-health datası | GDPR Art. 8 [V]; 436-ФЗ [R]; AZ valideyn razılığı [U] | Signup-da doğum tarixi/yaş beyanı; <16 üçün valideyn axını; <18 üçün AI kontekst bağlantısı |
| 7 | Hosting/DB (Render US, Supabase region?) | **Struktur**: lokallaşdırma normaları ilə konflikt | AZ İnformasiya Qanunu [R]; 152-ФЗ m.18(5) [R]; KZ 105-VIII [U] | Bazar qərarı (P1-7); EU istifadəçiləri üçün Supabase EU region + Render Frankfurt |
| 8 | Gündəlik/mood (istifadəçi məzmunu) | Aşağı-orta: DSA hosting öhdəlikləri | DSA Art. 14/16 [V] | ToS-də məzmun qaydaları aydın dildə; bildiriş kanalı; şikayət mexanizmi |
| 9 | Email (Brevo) | Aşağı: transaksiya məzmunu xidmət istifadəsini ifşa edir ("ödəniş gözlənilir" psixoloq üçün) | GDPR minimallaşdırma [V]; Brevo DPA [R] | Email mətnlərində xidmət-çıxarımlarını azalt; Brevo DPA-sını yazılı istə |
| 10 | Psixoloq kataloqu + marketing | Aşağı: müalicə iddiası riski | AZ Reklam Qanunu [R]; RU 804н [R]; Gemini tibbi sərhədi [V] | "Müalicə" sözünün təmizlənməsi; partnyor diplom/lisenziya faylları; müqavilə çərçivəsi |
| 11 | Ödəniş axını (hazırda manual) | Gələcək: kassa/ƏDV/nağdsız öhdəliklər | AZ vergi/qanunvericilik [R]; RU ödəniş reallığı [R] | Gateway qoşulmazdan əvvəl mühasib + hüquq rəyi |
| 12 | Accessibility | Aşağı: EAA tətbiqindən sonra e-commerce üçün məcburi | EAA 2019/882 [V] | EN 301 549 / WCAG 2.1 AA audit + accessibility statement |

---

## 7. Prioritetli yol xəritəsi

### P0 — dərhal (bu həftə)

1. **Gemini API paid tier-ə keçid**: GCP layihəsində billing aktivləşdirilməsi və
   açarın paid rejimə düşməsinin təsdiqi. EEA/UK istifadəçiləri üçün müqavilə
   baxımından məcburidir; free tier-də mental-health məzmunlu söhbətlər
   training-korpor sərhəddən keçir.
2. **AI kontekst minimallaşdırılması**: PROMPT_CONTEXT-dən ad/email (və mümkünsə
   çəki/boy) çıxarılması — GDPR data minimization + Taskforce prinsipi; crisis
   əlamətli mesajların fallback provider-ə heç vaxt düşməməsi.
3. **Consent arxitekturasının layihəsi**: mood/gündəlik/test/AI-kontekst üçün
   granulyar, geri çəkilə bilən, loglanan explicit consent (default: rədd).
4. **Hesab silinməsi + data export endpoint-lərinin implementasiyası** — hər üç
   yurisdiksiyada ən aydın pozuntudur.

### P1 — 30–60 gün

5. **DPIA** (Art. 35): AI axınları, ötürmələr, cookie-lər, minors, bronlar;
   yüksək qalıq riskdə Art. 36 məsləhətləşməsi.
6. **AI Act Art. 50 paketi**: çat UI-da ilk interaksiyada AI bildirişi +
   davamlı "AI" etiketi (aiDisclaimer açarını gücləndir); çat bazasında
   `ai_generated` bayrağı; komanda üçün Art. 4 AI-savamlılıq təlimatı;
   02.12.2026-ya machine-readable marking planı.
7. **Bazar/qurum qərarı**: rəsmi xidmət ərazisi təyini — EU/UK (nümayəndə
   Art. 27 + Supabase EU region + Render Frankfurt), RU (ToS ilə RF
   rezidentlərinin çıxarılması və ya tam uyğunluq proqramı), KZ (mətn təsdiqi
   olmadan push yox).
8. **İstehlakçı axını**: 14 gün geri çəkilmə məlumatı + dərhal ifa consent
   etirafı + vergi daxil qiymət göstəricisi; 2019/770 uyğunluq siyasəti.
9. **Yaş gate**: signup-da doğum ili/yaş beyanı + <16 valideyn razılığı axını +
   minors üçün AI kontekst bağlanması.
10. **Cookie bar**: reject-in persist edilməsi; cookie məqsəd sənədlərinin
    /cookies səhifəsində saxlanması (artıq var — təsdiq).
11. **DSA + EAA**: ToS-də məzmun qaydaları/moderasiya bölməsi; bildiriş kanalı;
    şikayət mexanizmi; WCAG 2.1 AA audit + accessibility statement.

### P2 — 60–120 gün

12. **Vendor reyestri + DPA-lar**: Google (paid tier DPA avtomatik — sənədlə),
    Supabase DPA qəbulu, Render DPA, Brevo DPA yazılı istənməsi; z.ai prod-da
    qeyri-aktiv saxlanmasının təminatı (config yoxdursa ölüdür — belə qalsın).
13. **AZ qeydiyyat/nəzarətçi təsdiqi**: cari nəzarət orqanının (2024+ strukturu)
    və personal-data IS qeydiyyatının müəyyən edilməsi; yerli hüquq firması
    ilə tam mətn auditi (bax bölmə 8).
14. **Psixoloq partnyor vetting paketi**: diplom/lisenziya sənədləri, illik
    yenidən yoxlama, müqavilə çərçivəsi ("qeyri-tibbi psixoloji dəstək"),
    kataloq/marketinq mətnlərində "müalicə" ifadələrinin təmizlənməsi.
15. **Pozuntu playbook-u**: 72h (EU/AZ ehtimal)/24h+72h (RU) bildiriş
    şablonları; vendor incident feed-lərinin (Brevo/Render/Supabase)
    abunəliyi.
16. **Email məzmun minimallaşdırılması** + gələcək marketinq üçün opt-out
    registry hazırlığı.
17. **Clickwrap sübut sistemi**: versiyalı ToS qəbul qeydləri (timestamp, versiya,
    IP) — AZ məhkəmələrində icra üçün.

---

## 8. Açıq suallar (yerli məsləhətçi üçün sorğu siyahısı)

1. AZ: 2024–2026 Şəxsi məlumatlar Qanunu dəyişikliklərinin tam mətni — pozuntu
   bildirişi müddəti, DPO/insan resursu tələbi, cərimələr, nəzarət orqanının
   cari statusu və qeydiyyat proseduru.
2. AZ: İnformasiya Qanunundakı lokallaşdırma müddəasının dəqiq maddəsi və
   AZ-əsaslı operatorun xarici bulud (Supabase/Render) arxitekturasına tətbiqi;
   "həssas sahələri AZ-da, qalanını consent ilə xaricdə" hibrid modelinin
   qanuniliyi.
3. AZ: qeyri-tibbi psixoloji məsləhət xidmətinin lisenziya statusu (2026);
   partnyor psixoloq üçün minimum sənəd dəsti.
4. AZ: yeni istehlakçı qanununun məsafədən müqavilə/abunəlik müddəaları və
   geri çəkilmə müddəti.
5. RU: RF bazarından formal çıxışın (ToS + geo) kifayət edib-etməməsi;
   152-ФЗ üzrə "operator" statusundan yayınma riskləri.
6. KZ: 105-VIII-nin tam mətni, lokallaşdırma və ötürmə normalarının xarici
   sayta tətbiqi.
7. EU: AZ şirkəti üçün Art. 27 nümayəndəliyinin təşkili (hansı üzv dövlətdə).

---

## 9. Mənbələr

**Birbaşa oxunmuş rəsmi mənbələr [V]:**

- GDPR mətni (Art. 3, 4, 8, 9, 17, 20, 27, 33–35, 56): gdpr-info.eu
- AI Act (Regulation 2024/1689) tam mətn + Art. 5, Art. 50, Recital 18/179:
  eur-lex.europa.eu (CELEX:32024R1689); artificialintelligenceact.eu
- Digital Omnibus on AI (Regulation 2026/1744): eur-lex.europa.eu (OJ:L_202601744)
- ePrivacy 2002/58/EC Art. 5(3): eur-lex.europa.eu (CELEX:32002L0058)
- CRD 2011/83/EU (Art. 9–16); Regulation 2018/302; Directive 2019/770;
  Directive 2019/2161; DSA 2022/2065 (Art. 2, 3, 14); EAA 2019/882:
  eur-lex.europa.eu
- EDPB: Guidelines 03/2022 (deceptive design v2.0); Guidelines 05/2020
  (consent); Opinion 28/2024 (AI modelləri); ChatGPT Taskforce Report
  (23.05.2024): edpb.europa.eu
- WP248 DPIA meyarları: ec.europa.eu/newsroom/just/document.cfm?doc_id=47711
- PECR (UK) reg 6 + Schedule A1 (DUAA 2025 ilə, 05.02.2026-dan):
  legislation.gov.uk/uksi/2003/2426
- Gemini API Additional Terms (eff. 23.03.2026 — unpaid/paid data governance,
  EEA/UK məhdudiyyəti): ai.google.dev/gemini-api/terms; Google Processor DPA:
  business.safety.google/processorterms/
- z.ai Privacy Policy (29.09.2025) + Terms of Use (14.04.2026) + DPA for API
  Services: docs.z.ai/legal-agreement/
- Supabase DPA (v1, 01.08.2026) + Regions (22.11.2026) + Security:
  supabase.com/legal/...
- Render DPA (19.12.2024) + Regions + Logging: render.com/dpa, render.com/docs
- Brevo Privacy Policy: brevo.com/legal/privacypolicy/ (DPA URL tapılmadı —
  yazılı istənilməlidir)
- AZ 2022 statusu: dlapiperdataprotection.com (Azerbaijan, last reviewed 2022)

**İkinci dərəcəli / təsdiq gözləyən [R]:** CJEU C-560/22, C-590/22, C-307/22
(qısa xülasələr; tam mətnlər çatılmadı); Garante v OpenAI (dekabr 2024) qərarı;
RU 152-ФЗ/242-ФЗ/266-ФЗ/347-ФЗ/436-ФЗ/804н praktikaları; KZ 105-VIII xüsusiyyətləri;
AZ 2024+ dəyişiklikləri və yeni istehlakçı qanunu.

---

*Sənədin tarixi: 2026-11-27. Növbəti gözdən keçirmə: P0 addımları bağlananda
və ya 2027-02-01-də (hər hansı biri əvvəl olsa).*
