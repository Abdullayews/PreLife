/**
 * İdman v3 — the embedded content module for the redesigned gym app.
 *
 * Everything the new İdman surface needs lives here: the 15-exercise
 * pool (each with a REAL stock demo video), the six partner halls with
 * trainers and equipment, the store registry and the 40-product catalog,
 * plus the mirror of the server's active-plan payload (the plan types,
 * the client-side twin of the default starter plan and the personal-plan
 * questionnaire). The data mirrors the Supabase seed (db/seed-content.sql)
 * with its official az translations, so the panel renders standalone — no
 * message catalogues — and can be dropped into any surface (the PreLife
 * /gym page or a demo).
 *
 * Videos are free stock clips (Mixkit, hotlinkable, free licence):
 * real gym footage, 720p, muted-loop previews.
 */

/* ── Tabs (the collapsible İdman group in the glass sidebar) ───────────── */

export type IdmanTabId =
  | "plan" | "supplements" | "accessories" | "gyms" | "equipment";

export const IDMAN_TABS: readonly { id: IdmanTabId; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "supplements", label: "Qida əlavələri" },
  { id: "accessories", label: "Aksesuarlar" },
  { id: "gyms", label: "Zallar" },
  { id: "equipment", label: "Alətlər" },
] as const;

export const isIdmanTabId = (v: string): v is IdmanTabId =>
  IDMAN_TABS.some((t) => t.id === v);

export const TAB_HEADS: Record<IdmanTabId, { eyebrow: string; title: string; lede: string }> = {
  plan: {
    eyebrow: "İdman planı",
    title: "İdman planın",
    lede: "Aktiv plan, bugünkü təlim və həftəlik cədvəl — bir yerdə.",
  },
  supplements: {
    eyebrow: "Qida əlavələri",
    title: "Əlavə kataloqu",
    lede: "Zülaldan vitaminə — hardan ala biləcəyini gör.",
  },
  accessories: {
    eyebrow: "Aksesuarlar və geyim",
    title: "Aksesuar və geyim",
    lede: "Təlim üçün detallar və geyim — hardan ala biləcəyini gör.",
  },
  gyms: {
    eyebrow: "Zallar",
    title: "Zal kataloqu",
    lede: "Qiymətlər, rəylər və ünvanlar — harada məşq edəcəyini seç.",
  },
  equipment: {
    eyebrow: "İdman alətləri",
    title: "Alət kataloqu",
    lede: "Bax, müqayisə et — hardan ala biləcəyini gör.",
  },
};

/* ── Shared copy (official PreLife az strings) ──────────────────────────── */

export const UI = {
  railLabel: "İdman bölməsi",
  railOpen: "Menyunu aç",
  railClose: "Menyunu yığ",
  currentTabSr: "Hazırki səhifə:",
  shopNote: "Qiymətlər istinad üçündür — dəqiq qiyməti mağazanın səhifəsində yoxlayın.",
  whereToBuy: "Hardan almaq",
  bestPrice: "Ən ucuz",
  sortLabel: "Sıralama",
  sortPopular: "Populyar",
  sortCheap: "Ucuzdan",
  sortRating: "Reytinq",
  sortPrice: "Qiymət",
  searchLabel: "Axtarış",
  searchPlaceholder: "Ad, brend və ya mağaza…",
  searchClear: "Axtarışı təmizlə",
  resultsA11y: "{shown} / {total} nəticə",
  noResults: "Heç nə tapılmadı",
  atCount: "Satış nöqtələri: {count}",
  dayPass: "Gün kartı",
  mapsCta: "Xəritədə aç",
  openHoursSr: "İş saatları",
  filterLabel: "Xidmətə görə filtrlə",
  filterAll: "Hamısı",
  gymsNoResults: "Bu filtrlərə uyğun zal yoxdur.",
  trainersTitle: "Məşqçilər",
  equipTitle: "Avadanlıq",
  trainerYears: "{count} il təcrübə",
  ratingA11y: "5 baldan {score} ball",
  premium: "Premium üzv",
  themeToggle: "Tünd / açıq rejim",
  themeDark: "Tünd rejim",
  themeLight: "Açıq rejim",
  settings: "Ayarlar",
  newsTitle: "Yeniliklər",
  newsBody: "Yeni İdman paneli: plan, zallar, alətlər və kataloqlar — bir yerdə.",
  /* plan panel */
  activeEyebrow: "Aktiv plan",
  weekLabel: "{week}/{total} həftə",
  daysPerWeek: "{count} gün / həftə",
  planLoading: "Plan yüklənir…",
  buildCta: "Şəxsi plan qur",
  resetCta: "Sıfırla",
  aiTag: "AI planı",
  defaultTag: "Standart plan",
  offlineNote: "İnternet yoxdur — standart plan göstərilir",
  todayTitle: "Bugünkü təlim",
  restDay: "Bu gün istirahət günüdür — bədən bərpa olunur.",
  nextSession: "Növbəti təlim",
  howTo: "Necə edilir",
  done: "Tamamlandı",
  finished: "Bugünkü təlim tamamlandı — əla iş!",
  sessionProgress: "{done}/{total} hərəkət",
  sessionSummary: "Günün xülasəsi",
  muscleGroups: "Əzələ qrupları",
  restLabel: "Dinclik: {count} san",
  flowLine: "Ardıcıl — dincliksiz",
  weeklyTitle: "Həftəlik cədvəl",
  restTag: "İstirahət",
  workoutTag: "Təlim",
} as const;

/* ── Weekday labels (1 Mon … 6 Sat; 0 Sunday = rest) ────────────────────── */

export const DAY_NAMES: Record<number, string> = {
  0: "Bazar", 1: "Bazar ertəsi", 2: "Çərşənbə axşamı", 3: "Çərşənbə",
  4: "Cümə axşamı", 5: "Cümə", 6: "Şənbə",
};
export const DAY_SHORT: Record<number, string> = {
  0: "B", 1: "B.e", 2: "Ç.a", 3: "Ç", 4: "C.a", 5: "C", 6: "Ş",
};

/* ── Real stock videos (Mixkit, 720p, verified 200) ─────────────────────── */

const V = (id: number) => `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;

export const VIDEOS = {
  barbell: V(52094),      // barbell reps on a bench
  dumbbellRack: V(47484), // the dumbbell rack itself
  kettlebell: V(52088),   // dynamic power training
  bands: V(52118),        // arm-circle warm-up
  pullupBars: V(23450),   // training on the bars
  mat: V(52110),          // floor work in workout attire
  bench: V(52316),        // training-session footage
  rack: V(52091),         // strength training at the rack
  plates: V(52082),       // squats with weights
  roller: V(50972),       // recovery breathing
  squat: V(52106),        // squats
  lunge: V(52112),        // lunges
  deadlift: V(52089),     // heavy pulling
  row: V(52079),          // gym training
  ohp: V(52091),          // overhead strength
  latpull: V(52316),      // machine session
  bicep: V(40788),        // dumbbell curls
  triceps: V(52317),      // rope work
  swing: V(52088),        // explosive swings
  legpress: V(52082),     // leg drive
  plank: V(52110),        // core hold
  run: V(52104),          // warm-up
  stretch: V(50972),      // stretch & breathe
} as const;

/* ── Exercise pool (official az copy + a real video each) ───────────────── */

export type Exercise = {
  code: string;
  name: string;
  target: string;
  guide: string;
  video: string;
};

export const EXERCISES: Record<string, Exercise> = {
  run: {
    code: "run", name: "Yürüyüş/qaçış qızışması", target: "Ürək-damar, bütün bədən",
    guide: "Yüngül templə başla, 2 dəqiqədən sonra sürəti bir az artır. Nəfəsə danışa biləcəyin səviyyədə qal — qızınma məqsədi yorulmaq deyil, oyaşmaqdır.",
    video: VIDEOS.run,
  },
  stretch: {
    code: "stretch", name: "Gərginləşmə", target: "Əzələ elastikliyi, bərpa",
    guide: "Hər əzələ qrupunu 20-30 saniyə yumşaq çək; sıçrama yox. Nəfəs axını itmir — gərginlik nəfəslə birlikdə yumşalır.",
    video: VIDEOS.stretch,
  },
  squat: {
    code: "squat", name: "Ştanqa ilə squat", target: "Quadriseps, bünyad, kalça",
    guide: "Çiyinlərdə ştanqa, ayaqlar çiyin enində. Çökümdə dizlər barmaq istiqamətində açılır, sinə ucaldılır, kürək sıxılır. Oyana qədər en, güclə yuxarı qalx.",
    video: VIDEOS.squat,
  },
  deadlift: {
    code: "deadlift", name: "Deadlift", target: "Arxa zəncir: bel, kalça, arxa ayaq",
    guide: "Ştanqa ayağın ortasında, kürək düz, sinə irəlidə. Dizləri büz, ştanqanı bədənə yaxın saxlayaraq qaldır. Yuxarıda beli itmə — kalça ilə dayan.",
    video: VIDEOS.deadlift,
  },
  bench: {
    code: "bench", name: "Bench press", target: "Döş, üçbaş əzələ, ön çiyin",
    guide: "Skamyada uzan, çiyinləri yığ, ayaqlar yerdə. Ştanqanı döşün ortasına endir, bir an saxla, güclə yuxarı it. Biləklər düz qalır.",
    video: VIDEOS.barbell,
  },
  pullup: {
    code: "pullup", name: "Barmaqlıq çəkməsi", target: "Enli kürək, biceps, qol",
    guide: "Barmaqlıq çiyindən bir az geniş tut. Kürəkləri aşağı-bir az geri yığ, bədəni qaldır — çənə barmaqlıqdan yuxarı. Yavaş en; tam çəkə bilmirsən, elastik lent və ya önləyici ilə başla.",
    video: VIDEOS.pullupBars,
  },
  row: {
    code: "row", name: "Ştanqa ilə yana çəkmə", target: "Kürək, arxa çiyin, biceps",
    guide: "Bellə 45 dərəcə əyil, ştanqa sallaq. Kürəyə doğru qabırğaya yaxın çək, bir an sıx, yavaş burax. Bel boyun boyu düz qalır.",
    video: VIDEOS.row,
  },
  ohp: {
    code: "ohp", name: "Ayaq üstə çiyin press", target: "Çiyinlər, üçbaş, bünyad",
    guide: "Ayaq üstə, ştanqa çiyində. Bünyədi yığ, barı başın üstündən düz yuxarı it — bar üzlə eyni xəttə keçir, sonra qulaq səviyyəsində tam aç.",
    video: VIDEOS.ohp,
  },
  lunge: {
    code: "lunge", name: "Çıxıntı (lunge)", target: "Quadriseps, kalça, balans",
    guide: "Bir ayağı irəli at, arxa diz yavaş yerə yaxınlaşır. Ön diz barmaq keçmir, gövdə düz. Güclə yuxarı qalx, ayağı dəyiş.",
    video: VIDEOS.lunge,
  },
  plank: {
    code: "plank", name: "Planşet", target: "Bünyad, qarın, kürək stabilliyi",
    guide: "Dirsəklər çiyin altında, bədən bir xəttdə. Kalçanı nə yuxarı qaldır, nə aşağı sal — nəfəs saxlanılmır, göbək içəri çəkilir.",
    video: VIDEOS.plank,
  },
  swing: {
    code: "swing", name: "Giriya yelləncəyi", target: "Kalça arxa zənciri, ürək-damar",
    guide: "Giriyanı iki əllə tut, kalça ilə it — qol sadəcə asılıdır. Güc kalçadan gəlir, giriya çiyin səviyyəsinə qədər yellənir. Bel heç vaxt yuvarlanmır.",
    video: VIDEOS.swing,
  },
  legpress: {
    code: "legpress", name: "Ayaq press", target: "Quadriseps, kalça",
    guide: "Ayaqlar platformada çiyin enində, dizlər barmaq istiqamətində. 90 dərəcəyə qədər en, tam kilidləmədən it. Bel skamyaya yapışır.",
    video: VIDEOS.legpress,
  },
  latpull: {
    code: "latpull", name: "Lat pulldown", target: "Enli kürək, biceps",
    guide: "Barı çiyindən geniş tut, gövdə bir az geridə. Barı döş üstünə çək, kürəkləri sıx, yavaş burax. Çəkməni əllə deyil, kürəklə düşün.",
    video: VIDEOS.latpull,
  },
  bicep: {
    code: "bicep", name: "Biceps çəkmə", target: "Biceps, qol",
    guide: "Dirseklər gövdəyə yaxın, halterləri növbə ilə yuxarı çək. Biləyi itmə — hərəkət dirsəkdən gedir. Yavaş endir.",
    video: VIDEOS.bicep,
  },
  triceps: {
    code: "triceps", name: "Triceps press", target: "Üçbaş əzələ",
    guide: "Kablo stansiyasında dirseklər yanda sabit, qolu aşağı it, tam aç. Yavaş yuxarı qayıt — dirsek yerindən oynamır.",
    video: VIDEOS.triceps,
  },
};

/* ── The active plan (the /api/gym/plan payload, mirrored) ───────────── */

export type PlanExercise = {
  /** Registry code into EXERCISES — "" when the AI wrote a custom move. */
  ex: string;
  name: string;
  sets: number;
  /** Free-form prescription, e.g. "8–10" or "40 saniyə". */
  reps: string;
  rest: number;
  note?: string;
};

export type PlanDay = {
  /** 1 = Monday … 7 = Sunday. */
  day: number;
  focus: string;
  exercises: PlanExercise[];
};

export type ActivePlan = {
  id: string;
  title: string;
  level: string | null;
  source: "default" | "ai";
  week: number;
  total: number;
  focus: string | null;
  days: PlanDay[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const planEx = (code: string, sets: number, reps: string, rest: number): PlanExercise => ({
  ex: code, name: EXERCISES[code]?.name ?? code, sets, reps, rest,
});

/** The offline starter plan — the client-side twin of the server default,
 *  shown when /api/gym/plan is unreachable (offline, standalone demos). */
export const DEMO_PLAN: ActivePlan = {
  title: "Başlanğıc plan",
  level: "Başlanğıc",
  source: "default",
  week: 1,
  total: 8,
  focus: "Bütün bədən gücü və vərdiş",
  days: [
    { day: 1, focus: "Bütün bədən A", exercises: [
      planEx("run", 1, "5–8 dəq", 0),
      planEx("squat", 4, "8–10", 90),
      planEx("bench", 4, "8–10", 90),
      planEx("row", 4, "10–12", 75),
      planEx("plank", 3, "30–45 s", 60),
    ] },
    { day: 3, focus: "Bütün bədən B", exercises: [
      planEx("run", 1, "5–8 dəq", 0),
      planEx("deadlift", 4, "6–8", 120),
      planEx("ohp", 4, "8–10", 90),
      planEx("latpull", 4, "10–12", 75),
      planEx("bicep", 3, "10–12", 60),
    ] },
    { day: 5, focus: "Bütün bədən C", exercises: [
      planEx("run", 1, "5–8 dəq", 0),
      planEx("legpress", 4, "10–12", 90),
      planEx("lunge", 3, "10 (hər ayaq)", 75),
      planEx("triceps", 3, "10–12", 60),
      planEx("stretch", 1, "5 dəq", 0),
    ] },
  ],
  notes: null,
  createdAt: "",
  updatedAt: "",
};

/** Muscle-group chips: registry targets + the names of custom AI moves. */
export const muscleGroupsOf = (day: PlanDay): string[] => {
  const set = new Set<string>();
  for (const pe of day.exercises) {
    const ex = EXERCISES[pe.ex];
    if (!ex) { set.add(pe.name); continue; } // custom move — name only
    for (const part of ex.target.split(/[,·]/)) {
      const p = part.trim();
      if (p) set.add(p);
    }
  }
  return [...set].slice(0, 6);
};

/** Total working sets of a day. */
export const totalSetsOf = (day: PlanDay): number =>
  day.exercises.reduce((n, pe) => n + pe.sets, 0);

/** Rough session length: ~1.5 min of work per set + the rests between. */
export const minutesOf = (day: PlanDay): number => {
  let mins = 0;
  for (const pe of day.exercises) mins += pe.sets * 1.5 + (pe.rest * pe.sets) / 60;
  return Math.max(10, Math.round(mins));
};

/* ── The personal-plan questionnaire (hardcoded AZ) ─────────────────────── */

export type QuizAnswers = {
  goal: string;
  experience: string;
  days: string;
  equipment: string;
  focus: string;
  limitations: string;
};

export type QuizStep = {
  q: string;
  options: readonly string[];
  /** multi-select with a pick cap (the focus step). */
  multi?: number;
  /** the free-text step (limitations). */
  free?: boolean;
};

export const QUIZ_STEPS: readonly QuizStep[] = [
  { q: "Məqsədin nədir?", options: ["Çəki itirmək", "Kütlə qazanmaq", "Formanı qorumaq", "Ümumi fitnes"] },
  { q: "Təcrübən?", options: ["Başlanğıc", "Orta", "İleri"] },
  { q: "Həftədə neçə gün məşq edə bilərsən?", options: ["2", "3", "4", "5"] },
  { q: "Harada məşq edəcəksən?", options: ["Tam zal", "Ev (az avadanlıq)", "Ev (avadanlıqlı)"] },
  { q: "Fokus?", options: ["Kürək", "Qollar", "Ayaqlar", "Qarın", "Kürək düzliği", "Ümumi bədən"], multi: 2 },
  { q: "Məhdudiyyət var?", options: [], free: true },
];

export const QUIZ = {
  eyebrow: "Şəxsi plan",
  title: "Şəxsi planın üçün bir neçə sual",
  desc: "Cavablarına görə sənin üçün fərdi plan hazırlanacaq — bir dəqiqədən az çəkir.",
  stepOf: "{step}/{total}",
  back: "Geri",
  next: "Növbəti",
  finish: "Planı hazırla",
  busy: "Plan hazırlanır…",
  none: "Yoxdur",
  limitPlaceholder: "Zədə, ağrı və ya nəzərə alınmalı olan başqa şey… (istəyə bağlı)",
  steps: QUIZ_STEPS,
};

/* ── Partner halls (zallar) ─────────────────────────────────────────────── */

export type HallTrainer = { name: string; spec: string; years: number };

export type Hall = {
  id: string;
  name: string;
  desc: string;
  image: string;
  rating: number;
  address: string;
  hours: string;
  dayPrice: number;
  features: string[];
  equipment: string[];
  trainers: HallTrainer[];
};

export const EQ_LABELS: Record<string, string> = {
  powerRacks: "Power racklar", benches: "Təlim skamyaları", dumbbells: "Halter dəsti",
  barbells: "Olimpiya ştangaları", plates: "Çəki diskləri", cableStation: "Kablo stansiyaları",
  smithMachine: "Smit maşını", latPulldown: "Lat pulldown", legPress: "Ayaq press",
  kettlebells: "Girya dəsti", platforms: "Təlim platformaları", functionalZone: "Funksional zona",
  treadmills: "Yürüyüş lentləri", ellipticals: "Ellips trenajörler", bikes: "Velosipedlər",
  rowing: "Avar çəkmə", boxingCorner: "Boks küncü", mats: "Matlar",
  pool: "Üzgüçülük hovuzu", sauna: "Sauna", recoveryZone: "Bərpa zonası",
  freeWeights: "Sərbəst çəki zonası",
};

export const HALLS: Hall[] = [
  {
    id: "ironhouse", name: "Iron House", rating: 4.8,
    desc: "Gecə-gündüz açıq güc zalı — tam sərbəst çəki arsenatı və sakit, fokuslu mühit.",
    image: "https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=900&q=80&auto=format&fit=crop",
    address: "Nərimanov, Ə. Rəcəbli küç.", hours: "24/7", dayPrice: 18,
    features: ["24/7 giriş", "Sauna", "Hovuz"],
    equipment: ["powerRacks", "benches", "dumbbells", "barbells", "plates", "cableStation", "smithMachine", "latPulldown", "legPress", "kettlebells", "treadmills", "ellipticals", "bikes", "sauna", "pool", "freeWeights"],
    trainers: [
      { name: "Rəşad Əliyev", spec: "Güc təlimi", years: 9 },
      { name: "Nurlan Məmmədov", spec: "Powerlifting", years: 12 },
      { name: "Səbinə Quliyeva", spec: "Kardio", years: 6 },
    ],
  },
  {
    id: "pulse", name: "Pulse Fitness Club", rating: 4.6,
    desc: "Işıqlı kardio zonalar, hər gün qrup dərsləri və mərkəzdə asan dayanacaq.",
    image: "https://images.unsplash.com/photo-1546483875-ad9014c88eba?w=900&q=80&auto=format&fit=crop",
    address: "İçərişəhər, Qız Qalası küç.", hours: "07:00–23:00", dayPrice: 15,
    features: ["Qrup dərsləri", "Kardio zona", "Dayanacaq"],
    equipment: ["dumbbells", "barbells", "benches", "cableStation", "kettlebells", "functionalZone", "treadmills", "ellipticals", "bikes", "rowing", "mats", "boxingCorner"],
    trainers: [
      { name: "Aysel Rəhimova", spec: "Yoqa", years: 8 },
      { name: "Elvin Səfərov", spec: "Funksional hazırlıq", years: 7 },
      { name: "Kamal Hüseynov", spec: "Boks", years: 10 },
    ],
  },
  {
    id: "vertex", name: "Vertex Strength Hall", rating: 4.9,
    desc: "Olimpik platformalar, peşəkar məşqçilər və ciddi idmançılar üçün bərpa zonası.",
    image: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=900&q=80&auto=format&fit=crop",
    address: "Xətai, Ə. Qayıbov küç.", hours: "06:30–23:30", dayPrice: 22,
    features: ["Olimpik platformalar", "Məşqçi dəstəyi", "Bərpa zalı"],
    equipment: ["powerRacks", "platforms", "benches", "barbells", "plates", "dumbbells", "cableStation", "latPulldown", "legPress", "kettlebells", "recoveryZone", "sauna", "freeWeights"],
    trainers: [
      { name: "Tural Əhmədov", spec: "Powerlifting", years: 14 },
      { name: "Məryəm İsmayılova", spec: "Reabilitasiya", years: 9 },
      { name: "Orxan Vəliyev", spec: "CrossFit", years: 6 },
    ],
  },
  {
    id: "atlas", name: "Atlas Club", rating: 4.7,
    desc: "Yasamalda geniş kardio zonası və qrup dərsləri olan müasir zal — günün istənilən vaxtı açıq.",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&q=80&auto=format&fit=crop",
    address: "Yasamal, Təbib küç.", hours: "08:00–22:00", dayPrice: 16,
    features: ["24/7 giriş", "Qrup dərsləri", "Məşqçi dəstəyi"],
    equipment: ["powerRacks", "smithMachine", "benches", "dumbbells", "barbells", "plates", "cableStation", "latPulldown", "legPress", "treadmills", "ellipticals", "bikes", "functionalZone", "mats"],
    trainers: [
      { name: "Günay Kazımova", spec: "Pilates", years: 7 },
      { name: "Fərid Şıxıyev", spec: "Güc təlimi", years: 8 },
      { name: "Leyla Əskərova", spec: "Qidalanma məsləhəti", years: 5 },
    ],
  },
  {
    id: "forge", name: "The Forge", rating: 4.5,
    desc: "Güç liftinqi üçün platformalar, geniş parkovka və sauna — ciddi təlim üçün baza.",
    image: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=900&q=80&auto=format&fit=crop",
    address: "Səbail, S. Əhmədov küç.", hours: "07:00–23:00", dayPrice: 14,
    features: ["Olimpik platformalar", "Dayanacaq", "Sauna"],
    equipment: ["powerRacks", "platforms", "barbells", "plates", "benches", "dumbbells", "kettlebells", "smithMachine", "sauna", "freeWeights"],
    trainers: [
      { name: "Elşad Qarayev", spec: "Powerlifting", years: 11 },
      { name: "Zaur Bədəlov", spec: "Güc təlimi", years: 9 },
    ],
  },
  {
    id: "summit", name: "Summit Fitness", rating: 4.8,
    desc: "Bakının şimalında üzgüçülük hovuzu və bərpa zonası olan premium fitnes mərkəzi.",
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&q=80&auto=format&fit=crop",
    address: "Binəqədi, 6-cı mikrorayon", hours: "07:00–22:00", dayPrice: 20,
    features: ["Kardio zona", "Hovuz", "Bərpa zalı"],
    equipment: ["dumbbells", "barbells", "benches", "cableStation", "smithMachine", "latPulldown", "legPress", "kettlebells", "functionalZone", "treadmills", "ellipticals", "rowing", "pool", "sauna", "recoveryZone", "mats"],
    trainers: [
      { name: "Aytən Mürşüdlü", spec: "Fizioterapiya", years: 10 },
      { name: "Ruslan Ağayev", spec: "Funksional hazırlıq", years: 8 },
      { name: "Nərmin Soltanova", spec: "Yoqa", years: 6 },
    ],
  },
];

/* ── Stores + the 40-product catalog ────────────────────────────────────── */

export type StoreKind = "online" | "store" | "pharmacy";

export type Store = { slug: string; name: string; kind: StoreKind; url: string };

export const STORES: Record<string, Store> = {
  tap: { slug: "tap", name: "Tap.az", kind: "online", url: "https://tap.az" },
  unimall: { slug: "unimall", name: "Unimall.az", kind: "online", url: "https://unimall.az" },
  wolmart: { slug: "wolmart", name: "Wolmart.az", kind: "online", url: "https://wolmart.az" },
  kontakt: { slug: "kontakt", name: "Kontakt Home", kind: "store", url: "https://kontakt.az" },
  aptek: { slug: "aptek", name: "Aptek.az", kind: "pharmacy", url: "https://aptek.az" },
  araz: { slug: "araz", name: "Araz Supermarket", kind: "store", url: "https://arazmarket.az" },
};

export const STORE_KIND_LABEL: Record<StoreKind, string> = {
  online: "Onlayn", store: "Mağaza", pharmacy: "Aptek",
};

export type ProductCat = "equipment" | "supplements" | "accessories" | "clothing";

export type Product = {
  id: string;
  cat: ProductCat;
  /** Filter group inside the panel (chips). */
  group: string;
  name: string;
  brand: string;
  price: [number, number];
  rating: number;
  image: string;
  video?: string;
  /** { store slug, price } offers — cheapest drives the highlight. */
  at: { store: string; price: number }[];
};

/** Filter groups per catalog tab. */
export const FILTER_GROUPS: Record<"supplements" | "accessories" | "equipment", string[]> = {
  supplements: ["Zülal", "Kreatin & aminoturşular", "Vitamin & mineral"],
  accessories: ["Aksesuar", "Geyim"],
  equipment: ["Çəkilər", "Qurğular", "Yumşaq avadanlıq"],
};

const img = (hash: string, ext = "jpg") =>
  `https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/${hash}.${ext}`;

export const PRODUCTS: Product[] = [
  /* ── equipment (alətlər) — each with a REAL demo video ── */
  { id: "barbell", cat: "equipment", group: "Çəkilər", name: "Olimpiya ştanqası", brand: "Torros",
    price: [220, 380], rating: 4.8, image: img("c63185e2c96c", "jpeg"), video: VIDEOS.barbell,
    at: [{ store: "tap", price: 245 }, { store: "unimall", price: 259 }, { store: "kontakt", price: 289 }] },
  { id: "dumbbells", cat: "equipment", group: "Çəkilər", name: "Tənzimlənən halter dəsti", brand: "Demir Fit",
    price: [90, 190], rating: 4.6, image: img("970d32c7fbf6", "png"), video: VIDEOS.dumbbellRack,
    at: [{ store: "tap", price: 110 }, { store: "unimall", price: 98 }, { store: "wolmart", price: 129 }] },
  { id: "kettlebell", cat: "equipment", group: "Çəkilər", name: "Giriya", brand: "CrossFlow",
    price: [45, 95], rating: 4.5, image: img("c9f725cf60b7"), video: VIDEOS.kettlebell,
    at: [{ store: "tap", price: 52 }, { store: "kontakt", price: 69 }] },
  { id: "plates", cat: "equipment", group: "Çəkilər", name: "Çəki diskləri dəsti", brand: "Demir Fit",
    price: [6, 14], rating: 4.4, image: img("c0574a11860f", "jpeg"), video: VIDEOS.plates,
    at: [{ store: "tap", price: 7 }, { store: "wolmart", price: 8 }, { store: "araz", price: 9 }] },
  { id: "pullup", cat: "equipment", group: "Qurğular", name: "Barmaqlıq çubuğu", brand: "Iron Grip",
    price: [55, 120], rating: 4.7, image: img("3c977e0bb71b"), video: VIDEOS.pullupBars,
    at: [{ store: "tap", price: 64 }, { store: "kontakt", price: 79 }] },
  { id: "bench", cat: "equipment", group: "Qurğular", name: "Tənzimlənən təlim skamyası", brand: "Torros",
    price: [180, 350], rating: 4.6, image: img("da104366b0bd", "webp"), video: VIDEOS.bench,
    at: [{ store: "tap", price: 199 }, { store: "unimall", price: 215 }, { store: "kontakt", price: 249 }] },
  { id: "rack", cat: "equipment", group: "Qurğular", name: "Power rack", brand: "Iron Grip",
    price: [450, 850], rating: 4.9, image: img("f852f55f0081"), video: VIDEOS.rack,
    at: [{ store: "unimall", price: 520 }, { store: "kontakt", price: 599 }] },
  { id: "bands", cat: "equipment", group: "Yumşaq avadanlıq", name: "Müqavimət lentləri", brand: "Gym80",
    price: [18, 40], rating: 4.3, image: img("5e042b843d76"), video: VIDEOS.bands,
    at: [{ store: "araz", price: 19 }, { store: "wolmart", price: 22 }, { store: "tap", price: 25 }] },
  { id: "mat", cat: "equipment", group: "Yumşaq avadanlıq", name: "Yoqa matı", brand: "Lotos",
    price: [25, 60], rating: 4.5, image: img("59d27a744cda"), video: VIDEOS.mat,
    at: [{ store: "tap", price: 27 }, { store: "araz", price: 29 }, { store: "wolmart", price: 34 }] },
  { id: "roller", cat: "equipment", group: "Yumşaq avadanlıq", name: "Masaj rulonu", brand: "Lotos",
    price: [18, 45], rating: 4.4, image: img("a6bd53bb86b1"), video: VIDEOS.roller,
    at: [{ store: "tap", price: 21 }, { store: "araz", price: 24 }, { store: "wolmart", price: 27 }] },

  /* ── supplements (qida əlavələri) ── */
  { id: "whey", cat: "supplements", group: "Zülal", name: "Whey protein", brand: "Optimum Nutrition",
    price: [95, 145], rating: 4.9, image: img("79ec97b80d88", "png"),
    at: [{ store: "tap", price: 105 }, { store: "aptek", price: 118 }, { store: "unimall", price: 129 }] },
  { id: "proteinbar", cat: "supplements", group: "Zülal", name: "Zülal batonchası", brand: "Oatein",
    price: [4, 6], rating: 4.4, image: img("2dbe4c8aba13"),
    at: [{ store: "wolmart", price: 4 }, { store: "araz", price: 5 }, { store: "tap", price: 6 }] },
  { id: "creatine", cat: "supplements", group: "Kreatin & aminoturşular", name: "Kreatin monohidrat", brand: "BioTech USA",
    price: [45, 75], rating: 4.8, image: img("90ee7867bd64"),
    at: [{ store: "tap", price: 49 }, { store: "aptek", price: 58 }] },
  { id: "bcaa", cat: "supplements", group: "Kreatin & aminoturşular", name: "BCAA aminoturşuları", brand: "Optimum Nutrition",
    price: [40, 70], rating: 4.5, image: img("baa26a6898a2"),
    at: [{ store: "tap", price: 45 }, { store: "aptek", price: 52 }] },
  { id: "preworkout", cat: "supplements", group: "Kreatin & aminoturşular", name: "Pre-workout kompleks", brand: "BioTech USA",
    price: [55, 90], rating: 4.6, image: img("8ed468d0d5bc", "png"),
    at: [{ store: "tap", price: 62 }, { store: "unimall", price: 74 }] },
  { id: "omega3", cat: "supplements", group: "Vitamin & mineral", name: "Omega-3 balıq yağı", brand: "Solgar",
    price: [28, 48], rating: 4.7, image: img("3eb05baaea0f"),
    at: [{ store: "aptek", price: 34 }, { store: "araz", price: 39 }] },
  { id: "vitamind", cat: "supplements", group: "Vitamin & mineral", name: "D3 vitamini", brand: "Now Foods",
    price: [15, 30], rating: 4.6, image: img("de056b06fbc0"),
    at: [{ store: "aptek", price: 19 }, { store: "wolmart", price: 23 }] },
  { id: "magnesium", cat: "supplements", group: "Vitamin & mineral", name: "Maqnezium", brand: "Doctor's Best",
    price: [22, 40], rating: 4.5, image: img("32abf866628e", "png"),
    at: [{ store: "aptek", price: 27 }, { store: "unimall", price: 31 }] },
  { id: "multivit", cat: "supplements", group: "Vitamin & mineral", name: "Multivitamin", brand: "Solgar",
    price: [25, 55], rating: 4.4, image: img("27f2af6c7e46", "webp"),
    at: [{ store: "aptek", price: 32 }, { store: "wolmart", price: 38 }, { store: "unimall", price: 44 }] },
  { id: "electrolyte", cat: "supplements", group: "Vitamin & mineral", name: "Elektrolit tozu", brand: "Now Foods",
    price: [12, 28], rating: 4.3, image: img("f4006fa6575e"),
    at: [{ store: "wolmart", price: 15 }, { store: "araz", price: 17 }, { store: "tap", price: 19 }] },

  /* ── accessories (aksesuarlar) ── */
  { id: "belt", cat: "accessories", group: "Aksesuar", name: "Ağır atletika kəməri", brand: "Harbinger",
    price: [70, 130], rating: 4.7, image: img("63875af399a3"),
    at: [{ store: "tap", price: 84 }, { store: "kontakt", price: 99 }] },
  { id: "gloves", cat: "accessories", group: "Aksesuar", name: "Təlim əlcəkləri", brand: "Under Armour",
    price: [25, 55], rating: 4.5, image: img("0e40b821c3eb"),
    at: [{ store: "tap", price: 32 }, { store: "wolmart", price: 39 }] },
  { id: "shaker", cat: "accessories", group: "Aksesuar", name: "Shaker butulkası", brand: "SmartShake",
    price: [12, 25], rating: 4.3, image: img("6380dbb1ead5", "png"),
    at: [{ store: "wolmart", price: 14 }, { store: "araz", price: 15 }, { store: "tap", price: 19 }] },
  { id: "bag", cat: "accessories", group: "Aksesuar", name: "İdman çantası", brand: "Nike",
    price: [60, 120], rating: 4.6, image: img("9d9a2b491213", "png"),
    at: [{ store: "tap", price: 75 }, { store: "unimall", price: 89 }] },
  { id: "rope", cat: "accessories", group: "Aksesuar", name: "İp atlama", brand: "Reebok",
    price: [15, 35], rating: 4.4, image: img("a3d9d8e17ca6"), video: V(23056),
    at: [{ store: "araz", price: 18 }, { store: "tap", price: 21 }] },
  { id: "wraps", cat: "accessories", group: "Aksesuar", name: "Bilək bağlayıcıları", brand: "Rogue",
    price: [20, 45], rating: 4.6, image: img("03575f4b66b8"),
    at: [{ store: "tap", price: 28 }, { store: "kontakt", price: 36 }] },
  { id: "straps", cat: "accessories", group: "Aksesuar", name: "Çəkmə qayışları", brand: "Rogue",
    price: [15, 35], rating: 4.5, image: img("3bc06c3e544f"),
    at: [{ store: "tap", price: 19 }, { store: "unimall", price: 24 }] },
  { id: "towel", cat: "accessories", group: "Aksesuar", name: "İdman dəsmalı", brand: "Lotos",
    price: [10, 25], rating: 4.2, image: img("6341e1797310"),
    at: [{ store: "araz", price: 12 }, { store: "wolmart", price: 14 }, { store: "tap", price: 15 }] },
  { id: "bottle", cat: "accessories", group: "Aksesuar", name: "Sport butulkası", brand: "ThermoFlask",
    price: [20, 50], rating: 4.7, image: img("747f404c827f"),
    at: [{ store: "tap", price: 26 }, { store: "wolmart", price: 31 }] },
  { id: "headphones", cat: "accessories", group: "Aksesuar", name: "İdman qulaqlıqları", brand: "JBL",
    price: [60, 160], rating: 4.8, image: img("1e2a34144f00", "png"),
    at: [{ store: "tap", price: 79 }, { store: "kontakt", price: 95 }, { store: "unimall", price: 112 }] },

  /* ── clothing (geyim) ── */
  { id: "tshirt", cat: "clothing", group: "Geyim", name: "Təlim tişörtü", brand: "Nike Dri-FIT",
    price: [35, 75], rating: 4.6, image: img("ab1651b7a38b", "jpeg"),
    at: [{ store: "tap", price: 45 }, { store: "unimall", price: 52 }] },
  { id: "shoes", cat: "clothing", group: "Geyim", name: "Təlim ayaqqabısı", brand: "Adidas",
    price: [180, 320], rating: 4.8, image: img("317af329359d"),
    at: [{ store: "tap", price: 215 }, { store: "unimall", price: 239 }, { store: "kontakt", price: 259 }] },
  { id: "shorts", cat: "clothing", group: "Geyim", name: "İdman şortu", brand: "Puma",
    price: [40, 80], rating: 4.4, image: img("965c30ae3190"),
    at: [{ store: "wolmart", price: 45 }, { store: "tap", price: 52 }] },
  { id: "hoodie", cat: "clothing", group: "Geyim", name: "İdman huddisi", brand: "Under Armour",
    price: [90, 160], rating: 4.7, image: img("7448e83a00db"),
    at: [{ store: "tap", price: 98 }, { store: "unimall", price: 119 }] },
  { id: "socks", cat: "clothing", group: "Geyim", name: "İdman corabı (dəst)", brand: "Reebok",
    price: [12, 28], rating: 4.3, image: img("e41a3a83b634", "png"),
    at: [{ store: "wolmart", price: 12 }, { store: "araz", price: 15 }] },
  { id: "tights", cat: "clothing", group: "Geyim", name: "İdman taytları", brand: "Gymshark",
    price: [70, 140], rating: 4.8, image: img("99cfbdab0839"),
    at: [{ store: "tap", price: 84 }, { store: "unimall", price: 99 }] },
  { id: "bra", cat: "clothing", group: "Geyim", name: "İdman büsthalteri", brand: "Gymshark",
    price: [35, 70], rating: 4.6, image: img("b860c1e31436"),
    at: [{ store: "tap", price: 42 }, { store: "unimall", price: 55 }] },
  { id: "cap", cat: "clothing", group: "Geyim", name: "İdman papağı", brand: "Nike",
    price: [18, 40], rating: 4.4, image: img("dea860b997d3"),
    at: [{ store: "tap", price: 22 }, { store: "wolmart", price: 26 }] },
  { id: "jacket", cat: "clothing", group: "Geyim", name: "İdman jaketi", brand: "Adidas",
    price: [110, 220], rating: 4.7, image: img("eb0e3fddd56b"),
    at: [{ store: "tap", price: 129 }, { store: "unimall", price: 159 }, { store: "kontakt", price: 175 }] },
  { id: "swim", cat: "clothing", group: "Geyim", name: "Üzgüçülük geyimi", brand: "Speedo",
    price: [30, 90], rating: 4.5, image: img("652696bf10e1", "png"),
    at: [{ store: "tap", price: 39 }, { store: "unimall", price: 48 }] },
];

export const minPriceOf = (p: Product): number =>
  p.at.reduce((min, a) => Math.min(min, a.price), Number.POSITIVE_INFINITY);

export const productsOf = (cats: ProductCat[]): Product[] =>
  PRODUCTS.filter((p) => cats.includes(p.cat));
