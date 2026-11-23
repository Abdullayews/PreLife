# PreLife Professional Sayt İnkişafı — ARAŞDIRMA DÖVRÜ PLANU

## Task ID-ləri (cron)
- Loop 1 — job 545235 (expr 06:00) → vizual dizayn
- Loop 2 — job 545239 (07:00) → UX naviqasiya + motion
- Loop 3 — job 545240 (08:00) → responsive + a11y + performans
- Loop 4 — job 545238 (09:00) → backend API + təhlükəsizlik
- Loop 5 — job 545237 (10:00) → SEO + i18n + PWA + deploy
- Loop 6 — job 545236 (11:00) → SİNTEZ + skills/pro-site-craft/SKILL.md

VAQT QEYDİ: cron servisi naive datetime-i öz lokal saatı (UTC+8) ilə
şərh edir, Asia/Baku (UTC+4) yox. Expr-lər bilərəkdən +4h sürülüb:
istənilən şərhdə looplar TAM 1 saat ara ilə ardıcıl işə düşür (ya
02:00–07:00 Baku, ya 06:00–11:00 Baku — hər ikisi qəbul olunandır).
Loop başlayanda vaxt fərqi nəzərə alınmaz — sadəcə işi gör.

Məqsəd: professional sayt dizaynı və backend biliklərini toplaq (YouTube
videolarının altyazı/transkriptləri + məqalələr), loop 6-da bütün
öyrəntiləri özüm üçün SKILL faylında sintez etmək.

Struktur: 5 araşdırma loopu + 1 sintez loopu (hərəsi 1 saat ara ilə).
Qeydlər: `.research/notes/loop-N.md`
Son məhsul: `skills/pro-site-craft/SKILL.md` (istifadəçiyə çatda göndərilir)

QAYDA: Bu dövr SAF ARAŞDIRMADIR — saytın koduna dəyişiklik YOX,
commit/push YOX. Yalnız qeyd faylları yazılır.

## Loop 1 — Vizual dizayn əsasları
1. Professional rəng sistemləri: semantik token-lər, dark mode pattern-ləri,
   kontrast qaydaları, brend palitrası qurulması
2. Tipoqrafiya sistemləri: modular scale, font cütləşdirmə, variable fonts,
   oxunaqlılıq metrikləri, AZ hərfləri (ə, ş, ç, ğ) üçün font dəstəyi
3. Layout və spacing: grid sistemləri, 8pt spacing, whitespace iyerarxiyası,
   visual hierarchy, Apple-estetikası minimalizm qaydaları

## Loop 2 — UX naviqasiya + motion
4. Naviqasiya və informasiya arxitekturası: rail/tab pattern-ləri,
   sticky footer, mobile nav, breadcrumb
5. Landing/konversiya strukturu: hero, bölmə ardıcıllığı, CTA dizaynı,
   pricing səhifə pattern-ləri
6. Motion dizaynı: mikro-interaksiyalar, scroll-driven animasiyalar,
   easing/tempo qaydaları, motion token-lər, reduced-motion

## Loop 3 — Responsive + a11y + performans
7. Mobile-first responsive: breakpoint strategiyası, safe area, 44px touch
   target, adaptive images
8. Accessibility: WCAG 2.2, ARIA pattern-ləri, klaviatura naviqasiyası,
   kontrast/vibrasiya, screen reader
9. Performans: Core Web Vitals (LCP/INP/CLS) hədəfləri, SSR/streaming/ISR,
   şəkil/şrift optimallaşdırma, keşləmə strategiyaları

## Loop 4 — Backend + təhlükəsizlik
10. Professional API dizaynı: error kontraktları, validasiya, versiyalama,
    rate limiting (Rust/axum kontekstində)
11. Auth və session təhlükəsizliyi: cookie pattern-ləri, OWASP 10,
    CSRF/XSS müdafiəsi, session lifecycle
12. Database pattern-ləri: Postgres/Supabase, RLS, indeksləmə, migration,
    keşləmə qatları

## Loop 5 — SEO + i18n + PWA + deploy
13. SEO və metadata: structured data, OG tags, sitemap, hreflang
14. i18n best practices: AZ/EN/RU, mesaj kataloqları, locale routing
15. PWA və offline: service worker, offline səhifələr, install prompt
16. Deployment və observability: Render, git-push CI/CD, monitoring,
    error tracking

## Loop 6 — Sintez (son)
- Bütün loop-*.md qeydlərini topla (itkin mövzular varsa qısa araşdırma ilə doldur)
- `skills/pro-site-craft/SKILL.md` yaz: "PreLife kimi professional sayt necə
  dizayn və inşa olunmalıdır" biblesi — bütün bölmələrdə KONKRET qaydalar
  (dəyərlər, pattern adları, et/yox-et siyahıları)
- SKILL.md-in TAM məzmununu çatda istifadəçiyə göndər

## Qeyd formatı (hər loop eyni strukturda yazır)
Hər mövzu üçün:
- **Mənbələr**: video başlığı + URL (və ya məqalə)
- **Əsas öyrəntilər**: konkret faktlar (rəqəmlər, alət/qayda adları)
- **PreLife üçün qaydalar**: tətbiqedilən spesifik göstərişlər
