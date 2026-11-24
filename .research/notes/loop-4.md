# Loop 4/6 — BACKEND API + TƏHLÜKƏSİZLİK — Qeydlər

Tarix: 2026-11-24 (Baku 19:3x) · Job 545238 (manual davam — cron 09:00-da işə düşmüşdü)

## METOD QEYDİ

- Loop 1-3 qaydaları eynilə: YouTube transkriptlər bloklu — video hovuzu ytsearch
  metadata ilə; dərinlik məqalə/sənədlərlə (web_search + page_reader).
- İşarələr: [TAM] / [SNIPPET] — əvvəlki looplar ilə eyni.

---

## MÖVZU 10 — PROFESSIONAL API DİZAYNI

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "Deep Dive into REST API Design and Implementation Best Practices" — Software
   Developer Diaries — https://youtube.com/watch?v=7nm1pYuKAhY
2. "RESTful API Design Best Practices You Need To Know" — apiguru —
   https://youtube.com/watch?v=BB1Y_wHyKGM
3. "Session vs Token Authentication in 100 Seconds" — Fireship —
   https://youtube.com/watch?v=UBUNrFtufWo
4. "Session Vs JWT: The Differences You May Not Know!" — ByteByteGo —
   https://youtube.com/watch?v=fyTxwIa-1U0

Məqalələr/sənədlər:
5. [TAM] Microsoft Learn — "Web API Design Best Practices" (Azure Architecture
   Center, upd. 2026-10) — https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design
6. [SNIPPET] RFC 9457 "Problem Details for HTTP APIs" (RFC Editor) —
   https://www.rfc-editor.org/info/rfc9457
7. [SNIPPET] Swagger.io — "Problem Details (RFC 9457): Doing API Errors Well" (2024)
8. [SNIPPET] GeeksforGeeks + dev.to — "Rate Limiting Algorithms" (token/leaky bucket,
   fixed/sliding window)

### (b) Əsas öyrəntilər

**REST strukturu [TAM — Microsoft]:**
- URI-lər RESURS ətrafında: isimlər, CƏM isimlər (`/orders`, `/customers/5`);
  fel URI-də YOX (`/create-order` QADAĞAN — fel HTTP metodu ilə ifadə olunur)
- Kolleksiya + element iyerarxiyası: `/customers` → `/customers/{id}` →
  `/customers/{id}/orders`; GET/POST/PUT/PATCH/DELETE semantikası
- Stateless: hər sorğu müstəqil; state yalnız resursda
- Səhifələmə: `?limit=25&cursor=...` (və ya offset); filtr `?status=active`;
  hissəvi cavab `?fields=`; versiyalama `/api/v1/` path-də (ən sadə və açıq)
- HATEOAS: opsiyonal (links massivi) — praktikada v1 üçün məcburi deyil

**Status kod intizamı [TAM + SNIPPET]:**
```
200 OK            uğurlu GET/PUT/PATCH
201 Created       POST yaradır → Location header
202 Accepted      asinxron əməliyyat başladı
204 No Content    uğurlu DELETE
400 Bad Request   sintaksis/validasiya xətası
401 Unauthorized  autentifikasiya yox/keçərsiz (identity problemi)
403 Forbidden     autentikdir, icazə YOX (authorization)
404 Not Found      resurs yoxdur (və ya gizlədilir)
409 Conflict       durum konflikti (duplicate e-poçt)
422 Unprocessable  semantik validasiya (422 vs 400 — POST gövdəsi düzdür, məzmun yanlış)
429 Too Many       limit aşımı → Retry-After header
500/503            server xətası / bakımda
```

**Error kontraktı — RFC 9457 problem+json [SNIPPET]:**
- `Content-Type: application/problem+json`
- Standart üzvlər: `type` (problem URI), `title` (qısa), `status` (kod), `detail`
  (insan üçün), `instance` (konkret sorğu)
- Genişlənmə: `errors: [{field, message}]` kimi əlavə üzvlər seriyalı şəkildə
- Bir format bütün endpoint-lərdə — client üçün proqramlaşdırıla bilən xəta emalı

**Rate limiting alqoritmləri [SNIPPET]:**
```
Token bucket    — kova tokenlə dolur, hər sorğu 1 token; BURST-ə icazə (common, HTTP-ə uyğun)
Leaky bucket     — sabit sürətlə "sızır", hamar axın
Fixed window     — pəncərə başına sayğac; pəncərə kənarında 2x burst problemi
Sliding window   — üst-üstə düşən pəncərələr; dəqiq, yaddaş bir az çox
```
- Cavab header-ləri: `X-RateLimit-Limit / -Remaining / -Reset` + 429-da `Retry-After`
- Səviyyələr: per-IP (anon) + per-user (auth) + qlobal; login/parol bərpa kimi
  həssas endpoint-lərdə daha sıx limit

### (c) PreLife üçün qaydalar

1. **Yol qaydası**: `/api/v1/<resource>` — cəm isimlər; feil-qollar qadağan
   (`/api/v1/leads` ✓, `/api/v1/create-lead` ✗). Query-də: `limit`, `cursor`,
   `sort`, `fields`.
2. **Status kod cədvəli** yuxarıdakı kimi MÜTLƏQ; xüsusən 401 (kimliyin yoxluğu)
   ilə 403 (icazənin yoxluğu) qarışdırma; 500 heç vaxt validasiya xətası üçün.
3. **Error kontraktı**: bütün xətalar `application/problem+json`:
   `{type, title, status, detail, instance, errors:[{field,message}]}` — `type`
   sabit URI (dokumentasiya səhifəsinə), `detail` dilinə görə AZ/EN/RU.
4. **Validasiya**: server tərəfdə HƏMİŞƏ (client yoxlaması yalnız UX üçün); naməlum
   field-lər rədd; e-poçt format + uzunluq limitləri; validasiya xətası 400/422 +
   field-səviyyəli `errors`.
5. **Rate limit dəstı**: əlaqə formaları 5 sorğu/dəq (per-IP); auth cəhdləri
   10/dəq + uğursuz ardıcıllıqda artan gecikmə; health/ping limitsiz; hamısında
   429 + `Retry-After`. Rust/axum: tower səviyyəsində qlobal + per-route.
6. **Versiyalama**: path `/v1/` — breaking change YALNIZ `/v2/` ilə; mövcud v1
   minimum 6 ay yaşayır.

---

## MÖVZU 11 — AUTH VƏ SESSION TƏHLÜKƏSİZLİYİ

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "OWASP Top 10 2025: Your complete guide to securing your applications" — Aikido
   Security — https://youtube.com/watch?v=Jzr0Jdnq_EI
2. "OWASP top 10 Explained" — Awesome — https://youtube.com/watch?v=U_tsCjOrcK4
   (mövczu 10-un video mənbələri ilə kəsişir — Fireship/ByteByteGo session videoları
   da bu mövzuya aiddir)

Məqalələr/sənədlər:
3. [TAM] OWASP Cheat Sheet Series — "Session Management" —
   https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
4. [TAM] MDN — "Set-Cookie header" —
   https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
5. [SNIPPET] OWASP — Top 10:2025 — https://top10.owasp.org/2025/en
   (2025 versiyası təsdiqləndi: 2 yeni kateqoriya — A03 Supply Chain, A10
   Exceptional Conditions)
6. [SNIPPET] OWASP Cheat Sheet-lər: CSRF Prevention, Password Storage (Argon2id),
   Content Security Policy

### (b) Əsas öyrəntilər

**Session ID xassələri [TAM — OWASP]:**
- Minimum **64 bit entropiya**; CSPRNG ilə generasiya (statistik analizə davamlı)
- Cookie adı generic + fingerprint-lənməyən (`PHPSESSID`/`JSESSIONID` kimi
  texnoloji ad QADAĞAN — "id" kimi neytral ad)
- Session ID == müvəqqəti olaraq ən güclü autentifikasiya metodu — sızması =
  tam impersonasiya (hijacking/sidejacking)
- Login/privilegiya dəyişikliyi zamanında ID YENİLƏNMƏLİDİR (fixation qarşısı)
- Vaxtlar: idle timeout + absolute timeout (hər ikisi); həssas tətbiq üçün idle daha
  qısa; logout düyməsi + server tərəfli ləğv (cookie silinməsi kifayət etmər)

**Cookie atributları [TAM — MDN]:**
```
HttpOnly        JS document.cookie girişini qadağan edir (XSS oğurluq qarşısı)
Secure          yalnız HTTPS-da göndərilir
SameSite=Strict eyni sayt + top-level naviqasiya da YOX (ən sıx)
SameSite=Lax    eyni sayt + top-level GET naviqasiyaları (default, CSRF-ə qarşı əsas müdafiə)
SameSite=None   cross-site AJAX üçün — MÜTLƏQ Secure ilə
Domain          qeyd olunarsa subdomain-lərə açılır (host-only daha dar = daha yaxşı)
Path            təhlükəsizlik vasitəsi DEYİL
Max-Age > Expires (uyğunluqda Max-Age qalır); 0/negative = dərhal silinir
Partitioned     CHIPS üçün (3-cü tərəf kontekst) — PreLife-da lazım deyil
Prefix-lər: __Host- (Domain YOX, Path=/, Secure) və __Secure- (Secure) — subdomain
saxtakarlığına qarşı güclü zəmanət
```
- `localStorage`/`sessionStorage`-da token saxlama QADAĞAN (XSS ilə oxunur;
  OWASP: Web Storage API session tokeni üçün uyğun deyil)
- CORS + credentials: `Set-Cookie` yalnız `credentials: 'include'` ilə işləyir —
  CORS siyasəti dar saxlanmalı

**OWASP Top 10:2025 [SNIPPET]:**
```
A01 Broken Access Control              (yenə #1 — məntiq yoxlaması)
A02 Security Misconfiguration         (yuxarı qalxdı)
A03 Software Supply Chain Failures     (YENİ — asılılıqlar/CI-CD zəhərlənməsi)
A04 Cryptographic Failures
A05 Injection
A06 Insecure Design
A07 Authentication Failures
A08 Software or Data Integrity Failures
A09 Logging & Alerting Failures
A10 Mishandling of Exceptional Conditions  (YENİ)
```
- A01 dərsi: hər endpoint-də server tərəfli authorization YOXLANIŞI — gizli link
  (`/admin`) təhlükəsizlik deyil (IDOR: `/api/v1/leads/42` başqasının ID-si ilə)

**CSRF/XSS müdafiəsi [SNIPPET]:**
- CSRF: SameSite=Lax baza + state dəyişən POST-larda double-submit cookie və ya
  custom header (`X-Requested-With`) yoxlaması; hər zaman origin/referer yoxla
- XSS: çıxışın kodlaşdırılması (output encoding), parametrləşdirilmiş sorğular
  (SQLi qarşısı), CSP başlığı (`default-src 'self'` + lazımi istisnalar)
- Parol: **Argon2id** saxlama (bcrypt fallback); plaintext/md5 QADAĞAN
- Log: autentifikasiya hadisələri (uğur/uğursuz) yazılır; xətalarda stack trace
  cavabda aşkarlanmır

### (c) PreLife üçün qaydalar

1. **Session cookie kontraktı**: `Set-Cookie: __Host-prel_session=<64+bit>; Path=/;
   Secure; HttpOnly; SameSite=Lax` — `__Host-` prefiksi ilə (Domain qadağası daxil);
   JWT-ni localStorage-da saxlama QADAĞAN; server tərəfli session store (Rust tərəfdə
   imza+expiry idarəetməsi).
2. **Login axını**: uğurlu autentifikasiyadan dərhal sonra session ID yenilə;
   uğursuz cəhdlərdə ümumi mesaj ("e-poçt və ya parol yanlışdır" — hansının
   yanlış olduğunu ifşa etmə); 10 uğursuz cəhd → 15 dəq blok + log.
3. **Timeout dəsti**: idle 24 saat; absolute 7 gün; "məni yadda saxla" yalnız
   absolute-i 30 günə uzadır; hər logoutda server store-da ləğv.
4. **CSRF**: bütün POST/PUT/DELETE-lərdə SameSite=Lax + double-submit token
   (`X-CSRF-Token` header, cookie-dən oxunub təsdiqlənir); CORS `Origin` whitelist.
5. **A01-ə qarşı**: hər API handler-ində rol/Ownership yoxlaması — `lead_id`-nin
   sahibliyi DB-də yoxlanılır; admin route-ları ayrıca RBAC qatında.
6. **Başlıqlar tənzimi**: `Strict-Transport-Security` (max-age 31536000,
   includeSubDomains), `X-Content-Type-Options: nosniff`, `Referrer-Policy:
   strict-origin-when-cross-origin`, `Content-Security-Policy` (`default-src
   'self'` + next/image üçün data:/blob: istisnaları).
7. **Parollar**: Argon2id (memory 19MiB, iterations 2, parallelism 1 tövsiyəsi
   oxşar dəyərlər); minimum 10 simvol; şübhəli parol siyahısı yoxlaması.
8. **Log və audit**: autentifikasiya + rate-limit hadisələri struktur log;
   cavabda heç vaxt stack trace / DB xətası (`detail`-də yalnız istifadəçi-mesajı).

---

## MÖVZU 12 — DATABASE PATTERN-LƏRİ

### (a) Mənbələr

Videolar (identifikasiya edildi):
1. "Implement Authorization using Row Level Security (RLS) with Supabase (Step By
   Step Guide)" — Supabase — https://youtube.com/watch?v=Ow_Uzedfohk
2. "Row Level Security with @Supabase — Course part 10 (2025)" — Codewithguillaume —
   https://youtube.com/watch?v=Vx1q8Nfp0BE
3. "PostgreSQL indexes. B-Tree, GIN, BRIN. What's the difference?" — JaneExplainsIT —
   https://youtube.com/watch?v=_HG2eB27j00
4. "PostgreSQL Indexing: How, why, and when" — PyCon AU —
   https://youtube.com/watch?v=clrtT_4WBAw

Məqalələr/sənədlər:
5. [TAM] Supabase Docs — "Row Level Security" (upd. 2026-11-19) —
   https://supabase.com/docs/guides/database/postgres/row-level-security
6. [SNIPPET] PostgreSQL Docs §11.2 "Index Types" —
   https://www.postgresql.org/docs/current/indexes-types.html
7. [SNIPPET] mojtabaazad (Medium) + mydba.dev — Postgres index seçim təlimatı

### (b) Əsas öyrəntilər

**RLS modeli [TAM — Supabase]:**
- Policy = hər sorğuya öz-özünə əlavə olunan `WHERE` şərti:
  `create policy ... on todos for select to authenticated using (auth.uid() = user_id)`
- 2 qat yoxlama: **grants** (əməliyyat icazəsi) + **policies** (hansı sətirlər);
  policy əlavəsi default grant-ları GERİ ALMIR — anon-a `insert` grantı qalıbsa
  yazma yolu açıqdır!
- Rollar: `anon` (imzalanmamış) · `authenticated` (JWT-li) · `service_role`
  (RLS-i BYPASS edir — yalnız server tərəfdə!)
- Təhlükəsizlik proseduru: (1) `enable row level security` (2) default
  grant-ları REVOKE (3) yalnız lazımi əməliyyatları GRANT (4) hər əməliyyat üçün
  policy (5) `supabase/tests/*_rls_test.sql` — pgTAP allow/deny testləri
  (`supabase test db`)
- **Views default olaraq RLS-i bypass edir** (security definer) — view üzərindən
  sızma qarşısı üçün view-a da policy lazımdır
- RLS-in gücü: DB primitivi olduğu üçün API/CLI/3-cü tərəf alət hər yoldan
  qorunur — defense in depth

**Postgres indeks növləri [SNIPPET]:**
```
B-tree   default; =, <, >, BETWEEN, ORDER BY, LIKE 'abc%' (prefix)
Hash     yalnız =; B-tree-nin alt qrupu kimi az istifadə
GIN      jsonb, array, full-text search; yazma bahalı, oxu güclü
BRIN     çox BÖYÜK, fiziki-sıralı cədvəllər (timestamp sütunu) — kiçik, öz-özünə
Composite birdən çox sütun; SIRA vacibdir (leftmost prefix qaydası)
Partial   WHERE şərtli alt çoxluq (`WHERE status='active'`) — ölçü azalır
Expression funksiya üzərində (lower(email))
```
- `EXPLAIN (ANALYZE, BUFFERS)` ilə plan yoxlaması; `pg_stat_statements` ilə
  real yükdə yavaş sorğuların tapılması; hər FK sütunu və tez filtr edilən
  sütun indeks namizədidir; amma hər indeks yazışı yavaşladır — 6-8-ə qədər
  cədvəldə saxla

**Migration + keş qatları:**
- Migration-lar: forward-only, versiyonlu fayllar, repo-da; grants + RLS policy-ləri
  HƏMİN migration-da (mühitlər arasında fərq yaranmasın)
- Keş iyerarxiyası: brauzer (immutable statik) → CDN → server app-memory
  (qısa TTL) → DB; invalidasiya qaydası əvvəlcədən yazılmalı

### (c) PreLife üçün qaydalar

1. **RLS cədvəli**: exposed olan HƏR cədvəldə RLS enable + `revoke all` + yalnız
   lazımi grant-lar; anon üçün yalnız public-oxu (`announcements` tipli) seçilir,
   anon yazma QADAĞAN; `service_role` açarı yalnız Rust backend-də (frontend-ə
   heç vaxt).
2. **Policy nümunə şablonu** (leads): `authenticated`-ə `using (auth.uid() =
   owner_id)` select/update; insert `with check (auth.uid() = owner_id)`;
   admin roluna ayrıca policy.
3. **RLS testləri**: hər secure cədvəl üçün pgTAP allow/deny faylı — anon/auth/
   sahiblik ssenariləri; CI-da `supabase test db` şərti.
4. **İndeks planı**: hər FK (`user_id`, `lead_id`), `email` (unikikal + axtarış),
   `status`+`created_at` kompozit (siyahı filtri), jsonb sahələrdə GIN; yeni
   sorğu → `EXPLAIN ANALYZE` məcburi addım.
5. **Migration intizamı**: `supabase/migrations/NNN_ad.sql` forward-only;
   revert skripti YOX (geri dönüş yeni migration-la); grant+RLS+index eyni
   faylda; production-a keçməmiş emulatorda tam dövrə test.
6. **Keş qatları**: public məzmun (landing/pricing) CDN+browser immutable;
   istifadəşiyə məxsus data HEÇ VAXT shared keşdə; app-memory keş yalnız
   referans məlumat (plan siyahısı kimi) üçün, TTL ≤5 dəq.

---

## SİNTEZ ÜÇÜN ƏN VACİB 10 QAYDA (loop 6-ya apar)

1. API: cəm-isim resurs yolları `/api/v1/...`; feil-qol qadağan; stateless
2. Status kod cədvəli dəqiq: 200/201/202/204 · 400/401/403/404/409/422/429 · 5xx
   yalnız server; 401≠403
3. Error kontraktı: RFC 9457 problem+json (type/title/status/detail/instance +
   field errors) — bütün endpoint-lərdə vahid
4. Rate limit: token bucket; həssas endpoint-lərdə sıx; 429 + Retry-After +
   X-RateLimit header-ləri
5. Session: `__Host-` prefiksli cookie, Secure+HttpOnly+SameSite=Lax, ≥64bit
   entropiya, login-da ID yenilə, localStorage QADAĞAN
6. CSRF: SameSite baza + double-submit token state-dəyişən sorğularda; CORS
   whitelist; HSTS + nosniff + CSP başlıqları
7. A01 (Broken Access Control) №1 təhlükə: hər handler-də ownership/rol yoxlaması;
   IDOR testləri
8. RLS: enable + revoke default grants + minimal grant + policy + pgTAP testlər;
   service_role yalnız backend; views bypass təhlükəsi
9. İndeks: FK + tez-filtr sütunlar; B-tree default, GIN jsonb, BRIN böyük
   sıralı; composite-də sıra vacib; EXPLAIN ANALYZE məcburi
10. Migration: forward-only, repo-da, grant/RLS/index eyni faylda; keş:
    public=CDN immutable, private=heç vaxt shared

## STATUS

- Mənbələr: **10 video** identifikasiya edildi · **4 sənəd TAM** (Microsoft API
  design, OWASP Session Management, MDN Set-Cookie, Supabase RLS) · ~7 snippet
  (RFC 9457, OWASP Top 10:2025, Postgres docs, rate-limit alqoritmləri)
- Kod dəyişikliyi: YOXDUR — yalnız `.research/` faylları
- Sonrakı: Loop 5/6 — SEO + i18n + PWA + deploy (job 545237)
