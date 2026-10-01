import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Bell,
  Dumbbell,
  Heart,
  Info,
  Loader2,
  Play,
  Plus,
  Search,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { PageShell } from "@/components/sections/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { capstoneSections } from "@/lib/capstone";

/* Core tone swatches — values mirror the PageShell token map (code data,
   language-neutral, so hex lives here and only names are translated). */
const CORE_TONES = [
  { key: "background", value: "#F6F3ED" },
  { key: "card", value: "#FCFBF8" },
  { key: "ink", value: "#1F1D1A" },
  { key: "muted", value: "#6E695E" },
  { key: "border", value: "rgba(31,29,26,0.12)" },
] as const;

const STATUS_PILLS = [
  { key: "live", accent: "#7D8F6D", tint: "#EEF1E7" },
  { key: "new", accent: "#8A6A45", tint: "#F3ECE0" },
  { key: "soon", accent: "#6E695E", tint: "#EBE7DE" },
] as const;

const FILTER_KEYS = ["yoga", "plates", "videolar"] as const;

function initials(name: string) {
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("uiTitle"), description: t("uiDescription") };
}

export default async function UiPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("uiPage");
  const tw = await getTranslations("welcomePage");
  const ts = await getTranslations("sections");
  const th = await getTranslations("homePage");

  const people = [1, 2, 3, 4].map((i) => t(`avatars.person${i}`) as string);
  const sport = capstoneSections.find((s) => s.id === "sport")!;
  const SportIcon = sport.icon;
  const sage = capstoneSections[0];

  return (
    <PageShell pageId="ui">
      {/* Page header */}
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t("intro")}</p>

      {/* 1 — Color system */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("sections.colors")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sections.colorsDesc")}
        </p>
        <Separator className="my-5" />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("colors.core")}
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CORE_TONES.map((tone) => (
            <li key={tone.key}>
              <div className="overflow-hidden rounded-xl border border-border">
                <div
                  className="h-16 border-b border-border"
                  style={{ backgroundColor: tone.value }}
                />
                <div className="bg-card p-3">
                  <p className="text-sm font-medium">
                    {t(`colors.toneNames.${tone.key}`)}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {tone.value}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("colors.accents")}
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {capstoneSections.map((section) => {
            const Icon = section.icon;
            return (
              <li key={section.id}>
                <div className="h-full rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-flex size-9 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: section.tint,
                        color: section.accent,
                      }}
                    >
                      <Icon className="size-4.5" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-medium">
                      {ts(`${section.id}.name`)}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: section.accent, color: "#fff" }}
                    >
                      {t("colors.accentUse")}
                    </span>
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: section.tint,
                        color: section.accent,
                      }}
                    >
                      {t("colors.tintUse")}
                    </span>
                  </div>
                  <p className="mt-2.5 font-mono text-xs text-muted-foreground">
                    {section.accent} / {section.tint}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 2 — Typography */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("sections.typography")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sections.typographyDesc")}
        </p>
        <Separator className="my-5" />
        <dl className="space-y-5">
          <div className="grid gap-1.5 md:grid-cols-[180px_1fr] md:gap-6">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:pt-3">
              {t("typography.display")}
            </dt>
            <dd className="text-3xl font-bold tracking-tight md:text-5xl">
              {tw("hero.title")}
            </dd>
          </div>
          <div className="grid gap-1.5 md:grid-cols-[180px_1fr] md:gap-6">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:pt-2">
              {t("typography.heading")}
            </dt>
            <dd className="text-2xl font-bold tracking-tight md:text-3xl">
              {tw("modules.title")}
            </dd>
          </div>
          <div className="grid gap-1.5 md:grid-cols-[180px_1fr] md:gap-6">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:pt-1">
              {t("typography.subheading")}
            </dt>
            <dd className="text-lg font-semibold md:text-xl">
              {tw("footer.tagline")}
            </dd>
          </div>
          <div className="grid gap-1.5 md:grid-cols-[180px_1fr] md:gap-6">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:pt-1">
              {t("typography.body")}
            </dt>
            <dd className="max-w-xl leading-relaxed text-muted-foreground">
              {tw("hero.subtitle")}
            </dd>
          </div>
          <div className="grid gap-1.5 md:grid-cols-[180px_1fr] md:gap-6">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:pt-1">
              {t("typography.caption")}
            </dt>
            <dd className="text-sm text-muted-foreground">{tw("cta.note")}</dd>
          </div>
          <div className="grid gap-1.5 md:grid-cols-[180px_1fr] md:gap-6">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:pt-1">
              {t("typography.label")}
            </dt>
            <dd className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {tw("hero.eyebrow")}
            </dd>
          </div>
        </dl>
      </section>

      {/* 3 — Buttons */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("sections.buttons")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sections.buttonsDesc")}
        </p>
        <Separator className="my-5" />

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("buttons.variants")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button className="rounded-full px-6">{t("buttons.save")}</Button>
          <Button className="rounded-full bg-[#112BAF] px-6 hover:bg-[#0D2187]">
            {tw("header.getStarted")}
          </Button>
          <Button variant="secondary" className="rounded-full px-6">
            {t("buttons.save")}
          </Button>
          <Button variant="outline" className="rounded-full px-6">
            {t("buttons.save")}
          </Button>
          <Button variant="ghost" className="rounded-full">
            {tw("modules.explore")}
          </Button>
          <Button variant="link">{tw("hero.seeAll")}</Button>
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("buttons.sizes")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" className="rounded-full">
            {t("buttons.save")}
          </Button>
          <Button className="rounded-full px-6">{t("buttons.save")}</Button>
          <Button size="lg" className="rounded-full px-8">
            {t("buttons.save")}
          </Button>
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("buttons.withIcon")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button className="rounded-full px-6">
            <Play className="size-4" aria-hidden="true" />
            {t("buttons.play")}
          </Button>
          <Button variant="outline" className="rounded-full px-6">
            {tw("cta.start")}
          </Button>
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("buttons.iconOnly")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" aria-label={t("buttons.play")}>
            <Play className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon" aria-label={tw("header.menu")}>
            <Bell className="size-4" aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            className="rounded-full"
            aria-label={t("buttons.save")}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={tw("brand")}>
            <Heart className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("buttons.disabled")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button disabled className="rounded-full px-6">
            {t("buttons.save")}
          </Button>
          <Button disabled variant="outline" className="rounded-full px-6">
            {t("buttons.play")}
          </Button>
        </div>
      </section>

      {/* 4 — Badges & chips */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("sections.badges")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sections.badgesDesc")}
        </p>
        <Separator className="my-5" />

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("badges.sectionChips")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {capstoneSections.map((section) => {
            const Icon = section.icon;
            return (
              <span
                key={section.id}
                className="inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-medium"
                style={{ backgroundColor: section.tint, color: section.accent }}
              >
                <span
                  className="inline-flex size-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: section.accent, color: "#fff" }}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                {ts(`${section.id}.name`)}
              </span>
            );
          })}
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("badges.status")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {STATUS_PILLS.map((pill) => (
            <span
              key={pill.key}
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium"
              style={{ backgroundColor: pill.tint, color: pill.accent }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: pill.accent }}
                aria-hidden="true"
              />
              {t(`badges.${pill.key}`)}
            </span>
          ))}
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("badges.filters")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {FILTER_KEYS.map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground/90"
            >
              {ts(`sport.subs.${key}`)}
              <X
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
          ))}
        </div>
      </section>

      {/* 5 — Form controls */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("sections.forms")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sections.formsDesc")}
        </p>
        <Separator className="my-5" />

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("forms.labels")}
        </p>
        <div className="mt-3 grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ui-name">{t("forms.name")}</Label>
            <Input id="ui-name" placeholder={t("forms.namePlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ui-email">{t("forms.email")}</Label>
            <Input
              id="ui-email"
              type="email"
              placeholder={t("forms.emailPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ui-search">{t("forms.search")}</Label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="ui-search"
                className="pl-9"
                placeholder={t("forms.searchPlaceholder")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ui-difficulty">{t("forms.select")}</Label>
            <Select defaultValue="medium">
              <SelectTrigger id="ui-difficulty" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">{t("forms.selectEasy")}</SelectItem>
                <SelectItem value="medium">{t("forms.selectMedium")}</SelectItem>
                <SelectItem value="hard">{t("forms.selectHard")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ui-message">{t("forms.message")}</Label>
            <Textarea
              id="ui-message"
              rows={3}
              placeholder={t("forms.messagePlaceholder")}
            />
          </div>
        </div>

        <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("forms.checkboxes")}
            </p>
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2.5">
                <Checkbox id="ui-notify-email" defaultChecked />
                <Label htmlFor="ui-notify-email" className="font-normal">
                  {t("forms.notifyEmail")}
                </Label>
              </div>
              <div className="flex items-center gap-2.5">
                <Checkbox id="ui-notify-push" />
                <Label htmlFor="ui-notify-push" className="font-normal">
                  {t("forms.notifyPush")}
                </Label>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("forms.radios")}
            </p>
            <RadioGroup defaultValue="premium" className="mt-3 gap-3">
              <div className="flex items-center gap-2.5">
                <RadioGroupItem value="free" id="ui-plan-free" />
                <Label htmlFor="ui-plan-free" className="font-normal">
                  {t("forms.planFree")}
                </Label>
              </div>
              <div className="flex items-center gap-2.5">
                <RadioGroupItem value="premium" id="ui-plan-premium" />
                <Label htmlFor="ui-plan-premium" className="font-normal">
                  {t("forms.planPremium")}
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("forms.switches")}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-sm font-medium">{t("forms.switchDaily")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("forms.switchDailyDesc")}
              </p>
            </div>
            <Switch defaultChecked aria-label={t("forms.switchDaily")} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-sm font-medium">{t("forms.switchAI")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("forms.switchAIDesc")}
              </p>
            </div>
            <Switch aria-label={t("forms.switchAI")} />
          </div>
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("forms.slider")}
        </p>
        <div className="mt-4 max-w-md rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("forms.sliderLabel")}</p>
            <p className="text-sm text-muted-foreground">
              {t("forms.sliderValue")} {t("forms.sliderUnit")}
            </p>
          </div>
          <Slider
            defaultValue={[45]}
            min={5}
            max={90}
            step={5}
            className="mt-4"
            aria-label={t("forms.sliderLabel")}
          />
        </div>
      </section>

      {/* 6 — Cards */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("sections.cards")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sections.cardsDesc")}
        </p>
        <Separator className="my-5" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <li>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("cards.stat")}
            </p>
            <Card className="h-full py-6">
              <CardContent>
                <p className="text-3xl font-bold tracking-tight">
                  {tw("stats.items.sessions.value")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tw("stats.items.sessions.label")}
                </p>
              </CardContent>
            </Card>
          </li>
          <li>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("cards.sectionCard")}
            </p>
            <Card className="h-full py-6">
              <CardContent>
                <span
                  className="inline-flex size-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: sport.tint, color: sport.accent }}
                >
                  <SportIcon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">
                  {tw("modules.cards.sport.name")}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {tw("modules.cards.sport.tagline")}
                </p>
              </CardContent>
            </Card>
          </li>
          <li>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("cards.expertCard")}
            </p>
            <Card className="h-full py-6">
              <CardContent>
                <Avatar className="size-11">
                  <AvatarFallback
                    style={{
                      backgroundColor: sage.tint,
                      color: sage.accent,
                    }}
                  >
                    {initials(ts("psikoloji.items.1.title"))}
                  </AvatarFallback>
                </Avatar>
                <h3 className="mt-4 font-semibold">
                  {ts("psikoloji.items.1.title")}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t("cards.expertRole")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-full"
                >
                  {t("cards.open")}
                </Button>
              </CardContent>
            </Card>
          </li>
          <li>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("cards.actionCard")}
            </p>
            <Card className="h-full py-6">
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold leading-snug">
                    {th("today.pick3.title")}
                  </h3>
                  <Button
                    size="icon"
                    className="size-9 shrink-0 rounded-full"
                    aria-label={t("cards.open")}
                  >
                    <Play className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {ts("psikoloji.subs.meditasyon")}
                </p>
                <Button size="sm" className="mt-4 rounded-full">
                  {t("cards.open")}
                </Button>
              </CardContent>
            </Card>
          </li>
        </ul>
      </section>

      {/* 7 — Avatars */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("sections.avatars")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sections.avatarsDesc")}
        </p>
        <Separator className="my-5" />

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("avatars.sizes")}
        </p>
        <div className="mt-3 flex items-center gap-4">
          {[0, 1, 2].map((index) => (
            <Avatar
              key={index}
              className={`${
                index === 0 ? "size-8" : index === 1 ? "size-10" : "size-12"
              }`}
            >
              <AvatarFallback
                className="text-xs font-semibold"
                style={{
                  backgroundColor: capstoneSections[index].tint,
                  color: capstoneSections[index].accent,
                }}
              >
                {initials(people[0])}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("avatars.group")}
        </p>
        <div className="mt-3 flex items-center -space-x-2.5">
          {people.map((person, index) => (
            <Avatar key={person} className="size-10 ring-2 ring-card">
              <AvatarFallback
                className="text-xs font-semibold"
                style={{
                  backgroundColor: capstoneSections[index % 4].tint,
                  color: capstoneSections[index % 4].accent,
                }}
              >
                {initials(person)}
              </AvatarFallback>
            </Avatar>
          ))}
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground ring-2 ring-card">
            {t("avatars.more")}
          </span>
        </div>
      </section>

      {/* 8 — Tabs */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("sections.tabs")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sections.tabsDesc")}
        </p>
        <Separator className="my-5" />
        <Tabs defaultValue="overview" className="max-w-2xl">
          <TabsList className="h-auto gap-1 rounded-full bg-secondary p-1">
            {(["overview", "sessions", "videos", "ai"] as const).map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none"
              >
                {t(`tabs.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {(["overview", "sessions", "videos", "ai"] as const).map((key) => (
            <TabsContent key={key} value={key} className="mt-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`tabs.${key}Text`)}
              </p>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      {/* 9 — Feedback & states */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("sections.feedback")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sections.feedbackDesc")}
        </p>
        <Separator className="my-5" />
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("feedback.progress")}
            </p>
            <div className="mt-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {t("feedback.progressLabel")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("feedback.progressValue")}
                </p>
              </div>
              <Progress value={72} className="mt-3" />
            </div>
            <div className="mt-4 flex items-center gap-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("feedback.spinner")}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("feedback.skeleton")}
            </p>
            <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("feedback.alerts")}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Alert className="rounded-xl">
                <Sparkles className="size-4" aria-hidden="true" />
                <AlertTitle>{t("feedback.alertTitle")}</AlertTitle>
                <AlertDescription>{t("feedback.alertText")}</AlertDescription>
              </Alert>
              <Alert variant="destructive" className="rounded-xl">
                <TriangleAlert className="size-4" aria-hidden="true" />
                <AlertTitle>{t("feedback.warnTitle")}</AlertTitle>
                <AlertDescription>{t("feedback.warnText")}</AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet closing note */}
      <div className="mt-12 flex items-start gap-2.5 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="flex items-center gap-1.5">
          {tw("footer.tagline")}
          <Dumbbell
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        </p>
      </div>
    </PageShell>
  );
}
