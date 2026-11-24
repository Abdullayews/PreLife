# Loop 6/6 — SİNTEZ QEYDİ (loop-6-synthesis.md)

Tarix: 2026-11-24 (Baku ~19:5x) · Job 545236 (manual davam — cron 11:00-də işə düşmüşdü)

## Giriş vəziyyəti

Bu sessiya əvvəlki söhbətin kəsilməsindən davam etdi:
- Loop 1-2 əvvəlki sessiyada tamamlanmışdı (loop-1.md 305 sətir, loop-2.md 340
  sətir, PLAN.md statusları güncəl idi)
- Loop 3-6 cron işləri (job 545240/545238/545237/545236) vaxtında işə düşmüşdü
  (08:00-11:00 Baku) amma kontekst kəsintisi səbəbiylə icra olunmamışdı — istifadəçi
  "davam" komandası ilə qalan 4 loopu bu sessiyada ardıcıl icra etdim.

## Sintez məntiqi

1. **Mənbə qəbulu**: 5 qeyd faylındakı (a) Mənbələr (b) Əsas öyrəntilər (c) PreLife
   qaydaları blokları oxundu. Hər loopun "SİNTEZ ÜÇÜN 10 QAYDA" siyahısı əsas
   xammal oldu (5×10 = 50 qayda).
2. **Deduplikasiya**: mövzular arası təkrarlar birləşdirildi (məs: kontrast
   loop 1-də rəng, loop 3-də a11y qaydası kimi — bir dəfə göstərildi; CLS loop
   3 şəkil/performans qaydaları birgə).
3. **Struktur**: Loop 6 tapşırığındakı 11 bölməli plan qəbul olundu:
   1 Vizual dil (L1) · 2 Naviqasiya+landing (L2) · 3 Motion (L2) · 4 Responsive+touch
   (L3) · 5 A11y (L3) · 6 Performans (L3) · 7 API (L4) · 8 Auth (L4) · 9 DB (L4) ·
   10 SEO+i18n+PWA (L5) · 11 Deploy (L5).
4. **"On iki dəmir qayda"**: 50 sintez qaydasından ən yüksək etki-li 12-si
   identifikasi edildi — SKILL.md girişində xülasə kimi.
5. **Et/et-mə cədvəli**: bütün qeydlərdəki QADAĞAN ifadələri müsbət qarşılığı
   ilə cütləşdirildi.
6. **Açıq qalan sonuncu qərar bağlandı**: kart radius dəsti 8pt-uyğun şəkildə
   8/12/16/24px (sm/md/lg/xl) kimi qərarlaşdırıldı — 16px kart default.

## Çatdırılan fayllar

- `skills/pro-site-craft/SKILL.md` — əsas məhsul (YAML frontmatter: name/
  description/license MIT; 11 bölmə + 12 dəmir qayda + et/etmə cədvəli)
- `.research/notes/loop-3.md` (responsive+a11y+performans)
- `.research/notes/loop-4.md` (API+auth+DB)
- `.research/notes/loop-5.md` (SEO+i18n+PWA+deploy)
- `.research/PLAN.md` — bütün 6 loop TAMAMLANDI statusu
- `.research/tools/research.mjs` — web_search/page_reader köməkçisi (loop 3-5-də istifadə)

## Ümumi hesabat

- **16 mövzu** araşdırıldı, **~90 mənbə** (43 video identifikasiya + ~24 sənəd
  tam oxunuş + ~23 snippet), 8 font faylı real cmap yoxlaması
- Kod bazası, commit, push: TOXUNULMADI (yalnız .research/ + skills/ — ikisi də
  repo xarici/gitignored)
- YouTube transkript bloku bütün looplarda qüvvədə qaldı — rəsmi fallback
  (metadata + məqalə dərinliyi) işlədildi

## Qeyd

Loop 2-nin qısa icmalı əvvəlki sessiyada itmiş ola bilər — bu sənədin
 müşayiət edən çat cavabında Loop 2 xülasəsi də verildi (naviqasiya/landing/
 motion əsas qaydaları).
