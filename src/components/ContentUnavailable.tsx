import { ArrowLeft, CloudOff } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * Graceful shell for "the content API is unreachable right now".
 *
 * Rendered by content pages when their fetch to the Rust backend fails
 * (build-time prerender or runtime regeneration with the API down). The
 * strings are hardcoded per locale ON PURPOSE: the i18n catalog is
 * database-driven, so this shell must not depend on the API that is down.
 * Once the API recovers, ISR (fetch revalidate: 60) replaces these pages
 * with the real content within a minute.
 */

const STRINGS = {
  az: {
    eyebrow: "Şəbəkə xətası",
    title: "Məzmun müvəqqəti əlçatmazdır",
    text: "Xidmətə qoşulmaq mümkün olmadı. Bir azdan yenidən cəhd edin — məzmun avtomatik bərpa olunacaq.",
    backHome: "Ana səhifəyə qayıt",
  },
  en: {
    eyebrow: "Network issue",
    title: "Content is temporarily unavailable",
    text: "The service could not be reached. Please try again soon — content restores automatically.",
    backHome: "Back to home",
  },
  ru: {
    eyebrow: "Проблема сети",
    title: "Контент временно недоступен",
    text: "Не удалось связаться с сервисом. Попробуйте позже — контент восстановится автоматически.",
    backHome: "На главную",
  },
} as const;

export function ContentUnavailable({ locale }: { locale: string }) {
  const s =
    locale === "az" ? STRINGS.az : locale === "ru" ? STRINGS.ru : STRINGS.en;

  return (
    <div className="wrap uc">
      <span className="chip-ico solid"><CloudOff size={26} aria-hidden /></span>
      <p className="eyebrow"><i />{s.eyebrow}</p>
      <h1 className="h2">{s.title}</h1>
      <p className="lede">{s.text}</p>
      <Link href="/home" className="btn btn-ghost">
        <ArrowLeft size={16} aria-hidden />{s.backHome}
      </Link>
    </div>
  );
}
