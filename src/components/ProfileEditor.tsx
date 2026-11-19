"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type ChangeEvent, type CSSProperties,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/**
 * ProfileEditor — the own-data editor for /{locale}/profile.
 *
 * Loads GET /api/me/profile once (the form baseline + the weight history),
 * then PATCHes ONLY the fields the user actually changed. The avatar is a
 * special case: it uploads immediately on pick (client-side resize to a
 * 256×256 JPEG), not on Save — see fileToAvatar below.
 */

/* ── API shape (the subset of GET/PATCH /api/me/profile we use) ──────── */

type ApiProfile = {
  name: string | null;
  avatarUrl: string | null;
  gender: string | null;
  birthYear: number | null;
  heightCm: number | null;
  goal: string | null;
  activityLevel: string | null;
  fitnessLevel: string | null;
  workoutsPerWeek: number | null;
  weightKg: number | null;
  planOnboardingDone: boolean;
};

type ApiWeights = { logDate: string; weightKg: number }[];

type ApiBody = { profile: ApiProfile; weights: ApiWeights; email: string };

/* ── Option lists — must mirror src/lib/server/profile.ts ────────────── */

const GENDERS = ["male", "female", "other"] as const;
const GOALS = ["lose", "maintain", "gain", "fitness"] as const;
const ACTIVITIES = ["sedentary", "light", "moderate", "active", "athlete"] as const;
const FITNESS_LEVELS = ["beginner", "intermediate", "advanced"] as const;

/** Validation bound (react(purity) forbids calling Date during render). */
const CURRENT_YEAR = new Date().getFullYear();

/* ── Form state (all strings — the inputs are controlled) ────────────── */

type FormState = {
  name: string;
  gender: string;
  birthYear: string;
  height: string;
  weight: string;
  goal: string;
  activity: string;
  fitness: string;
  perWeek: string;
};

function profileToForm(p: ApiProfile): FormState {
  return {
    name: p.name ?? "",
    gender: p.gender ?? "",
    birthYear: p.birthYear !== null ? String(p.birthYear) : "",
    height: p.heightCm !== null ? String(p.heightCm) : "",
    weight: p.weightKg !== null ? String(p.weightKg) : "",
    goal: p.goal ?? "",
    activity: p.activityLevel ?? "",
    fitness: p.fitnessLevel ?? "",
    perWeek: p.workoutsPerWeek !== null ? String(p.workoutsPerWeek) : "",
  };
}

/** Before GET returns, the form is seeded from the session user (name only). */
function sessionToForm(name: string | null): FormState {
  return {
    name: name ?? "", gender: "", birthYear: "", height: "", weight: "",
    goal: "", activity: "", fitness: "", perWeek: "",
  };
}

/* ── Avatar pipeline: picked file → 256×256 JPEG data URL ────────────── */

const AVATAR_PX = 256;
/** Client cap (characters of the data URL); the server column allows 500k. */
const AVATAR_MAX_CHARS = 480_000;

function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      reject(new Error("unsupported type"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let out: string | null = null;
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w > 0 && h > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = AVATAR_PX;
          canvas.height = AVATAR_PX;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // Flatten PNG transparency onto white — avatars are JPEGs.
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, AVATAR_PX, AVATAR_PX);
            const side = Math.min(w, h); // center-crop to a square
            ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
            out = canvas.toDataURL("image/jpeg", 0.85);
          }
        }
      } catch {
        out = null;
      }
      URL.revokeObjectURL(url);
      if (out) resolve(out);
      else reject(new Error("resize failed"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

/* ── Shared inline styles (globals.css is frozen for this task) ──────── */

const AVATAR_PX_STYLE = { "--px": "5rem" } as CSSProperties;
const AVATAR_IMG_STYLE: CSSProperties = {
  width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit",
};
/** .seg is single-line by design; the RU activity labels need wrapping. */
const SEG_STYLE: CSSProperties = { flexWrap: "wrap", height: "auto" };
/** Two-column form on wide screens, stacked on phones. */
const FORM_GRID_STYLE: CSSProperties = {
  gridTemplateColumns: "repeat(auto-fit, minmax(18.5rem, 1fr))",
  columnGap: "2.25rem",
};
const FIELD_TEXT_STYLE: CSSProperties = { width: "16rem" };
const FIELD_NUM_STYLE: CSSProperties = { width: "8rem" };

/* ── The editor ──────────────────────────────────────────────────────── */

export type ProfileEditorUser = { name: string | null; email: string };

export function ProfileEditor({ user }: { user: ProfileEditorUser }) {
  const t = useTranslations("profilePage");
  const locale = useLocale();
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [base, setBase] = useState<FormState>(() => sessionToForm(user.name));
  const [form, setForm] = useState<FormState>(() => sessionToForm(user.name));
  const [avatar, setAvatar] = useState<string | null>(null);
  const [email, setEmail] = useState(user.email);
  const [weights, setWeights] = useState<ApiWeights>([]);
  /** Carried from GET/PATCH responses; used only as an idempotent
   *  companion for weight-only saves — see save(). */
  const [planOnboardingDone, setPlanOnboardingDone] = useState(true);
  const [busy, setBusy] = useState(false);   // form PATCH in flight
  const [flash, setFlash] = useState(false); // "saved", reverts after 2.5s
  const [saveErr, setSaveErr] = useState(false);
  const [avBusy, setAvBusy] = useState(false); // avatar PATCH in flight
  const [avErr, setAvErr] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  /* GET once on mount: the form baseline + the weight history. On failure
   * the session-seeded form keeps working (Save diffs against it). */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/me/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ApiBody;
        if (!alive) return;
        setBase(profileToForm(data.profile));
        setForm(profileToForm(data.profile));
        setAvatar(data.profile.avatarUrl);
        setEmail(data.email);
        setWeights(data.weights);
        setPlanOnboardingDone(data.profile.planOnboardingDone);
      } catch {
        /* degraded — keep the session-seeded baseline */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* "Saved" flashes for ~2.5s, then the button returns to idle. */
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(false), 2500);
    return () => clearTimeout(id);
  }, [flash]);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    }),
    [locale],
  );
  const numFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );

  const patch = useCallback(async (body: Record<string, unknown>): Promise<ApiBody | null> => {
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return (await res.json()) as ApiBody;
    } catch {
      return null;
    }
  }, []);

  /* ── Avatar: resize + upload on pick, remove on demand ─────────────── */

  const onFilePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file || avBusy) return;
    setAvErr(false);
    setAvBusy(true);
    try {
      const dataUrl = await fileToAvatar(file);
      if (dataUrl.length > AVATAR_MAX_CHARS) throw new Error("too large");
      const data = await patch({ avatarUrl: dataUrl });
      if (!data) throw new Error("patch failed");
      setAvatar(data.profile.avatarUrl);
      setEmail(data.email);
      setWeights(data.weights);
      router.refresh(); // the rail identity (avatar) is mirrored server-side
    } catch {
      setAvErr(true);
    } finally {
      setAvBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (avBusy || !avatar) return;
    setAvErr(false);
    setAvBusy(true);
    try {
      const data = await patch({ avatarUrl: null });
      if (!data) throw new Error("patch failed");
      setAvatar(null);
      setEmail(data.email);
      setWeights(data.weights);
      router.refresh();
    } catch {
      setAvErr(true);
    } finally {
      setAvBusy(false);
    }
  };

  /* ── Save: collect ONLY the changed fields, validate, PATCH ────────── */

  const save = async () => {
    if (busy || !loaded) return;
    setSaveErr(false);

    const body: Record<string, unknown> = {};
    const invalid: string[] = [];

    const name = form.name.trim();
    if (name !== base.name.trim()) {
      if (!name || [...name].length > 100) invalid.push("name");
      else body.name = name;
    }
    if (form.gender !== base.gender && form.gender) body.gender = form.gender;
    if (form.goal !== base.goal && form.goal) body.goal = form.goal;
    if (form.activity !== base.activity && form.activity) body.activityLevel = form.activity;
    if (form.fitness !== base.fitness && form.fitness) body.fitnessLevel = form.fitness;

    /** One numeric field: skip unchanged, flag out-of-range, else queue. */
    const num = (
      val: string, prev: string, lo: number, hi: number,
      out: string, integer: boolean,
    ) => {
      const v = val.trim().replace(",", ".");
      if (!v) return; // cleared — these columns cannot be unset
      const p = prev.trim().replace(",", ".");
      if (v === p) return;
      const pv = p ? Number(p) : NaN;
      if (Number.isFinite(pv) && Number(v) === pv) return; // "175.0" vs "175"
      const n = Number(v);
      if (!Number.isFinite(n) || n < lo || n > hi || (integer && !Number.isInteger(n))) {
        invalid.push(out);
        return;
      }
      body[out] = n;
    };
    num(form.birthYear, base.birthYear, 1900, CURRENT_YEAR, "birthYear", true);
    num(form.height, base.height, 80, 260, "heightCm", false);
    num(form.weight, base.weight, 20, 400, "weightKg", false);
    num(form.perWeek, base.perWeek, 0, 14, "workoutsPerWeek", true);

    if (invalid.length > 0) { setSaveErr(true); return; }
    if (Object.keys(body).length === 0) { setFlash(true); return; } // nothing changed

    // Backend quirk (src/lib/server/profile.ts, off-limits here): the
    // "nothing_to_update" guard runs BEFORE the weight-log branch, so a
    // weight-ONLY patch would 400. Re-asserting the current
    // planOnboardingDone (same value → no-op write) carries it through.
    if ("weightKg" in body && Object.keys(body).length === 1) {
      body.planOnboardingDone = planOnboardingDone;
    }

    setBusy(true);
    try {
      const data = await patch(body);
      if (!data) throw new Error("patch failed");
      // Snap both the baseline and the inputs to the server's truth.
      setBase(profileToForm(data.profile));
      setForm(profileToForm(data.profile));
      setEmail(data.email);
      setWeights(data.weights); // a weight save grows the history below
      setPlanOnboardingDone(data.profile.planOnboardingDone);
      setFlash(true);
      router.refresh(); // the rail identity (name) is mirrored server-side
    } catch {
      setSaveErr(true);
    } finally {
      setBusy(false);
    }
  };

  /* ── View helpers ──────────────────────────────────────────────────── */

  const renderSeg = (
    label: string,
    value: string,
    keys: readonly string[],
    prefix: string,
    apply: (v: string) => void,
  ) => (
    <div className="seg" role="group" aria-label={label} style={SEG_STYLE}>
      {keys.map((k) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => apply(k)}>
          {t(`${prefix}.${k}`)}
        </button>
      ))}
    </div>
  );

  const seed = (user.name ?? "").trim();
  const initials = (
    seed
      ? seed.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join("")
      : user.email.slice(0, 2)
  ).toUpperCase();
  const displayName = base.name.trim() || user.email;

  return (
    <>
      {/* Avatar + identity + the two avatar actions */}
      <div className="profile-top">
        <span className="avatar" style={AVATAR_PX_STYLE}>
          {avatar
            ? <img src={avatar} alt="" style={AVATAR_IMG_STYLE} />
            : initials}
        </span>
        <div>
          <h2 className="h3">{displayName}</h2>
          <p className="profile-mail">{email}</p>
          <div className="profile-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={avBusy}
            >
              {t("avatarChange")}
            </button>
            {avatar && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={removeAvatar}
                disabled={avBusy}
              >
                {t("avatarRemove")}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={onFilePick}
            />
          </div>
          {avErr && <p className="field-error" role="alert">{t("avatarErr")}</p>}
        </div>
      </div>

      <p className="set-note">{t("editHint")}</p>

      {/* The form — two columns on wide screens (inline grid on .set-rows) */}
      <div className="set-rows" style={FORM_GRID_STYLE}>
        <div className="set-row">
          <span className="set-info">
            <b><label htmlFor="pf-name">{t("name")}</label></b>
          </span>
          <div className="field" style={FIELD_TEXT_STYLE}>
            <input
              id="pf-name"
              type="text"
              maxLength={100}
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
        </div>

        {/* Read-only: the email comes from the GET response */}
        <div className="set-row">
          <span className="set-info">
            <b>{t("email")}</b>
            <span>{t("emailLocked")}</span>
            <span>{t("emailLockedHint")}</span>
          </span>
          <span className="set-val">{email}</span>
        </div>

        <div className="set-row">
          <span className="set-info"><b>{t("gender")}</b></span>
          {renderSeg(t("gender"), form.gender, GENDERS, "genders", (v) => setForm((f) => ({ ...f, gender: v })))}
        </div>

        <div className="set-row">
          <span className="set-info">
            <b><label htmlFor="pf-birth">{t("birthYear")}</label></b>
          </span>
          <div className="field" style={FIELD_NUM_STYLE}>
            <input
              id="pf-birth"
              type="number"
              min={1900}
              max={CURRENT_YEAR}
              step={1}
              autoComplete="bday-year"
              value={form.birthYear}
              onChange={(e) => setForm((f) => ({ ...f, birthYear: e.target.value }))}
            />
          </div>
        </div>

        <div className="set-row">
          <span className="set-info">
            <b><label htmlFor="pf-height">{t("height")}</label></b>
          </span>
          <div className="field" style={FIELD_NUM_STYLE}>
            <input
              id="pf-height"
              type="number"
              min={80}
              max={260}
              step={1}
              value={form.height}
              onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
            />
          </div>
        </div>

        <div className="set-row">
          <span className="set-info">
            <b><label htmlFor="pf-weight">{t("weight")}</label></b>
            <span>{t("weightHint")}</span>
          </span>
          <div className="field" style={FIELD_NUM_STYLE}>
            <input
              id="pf-weight"
              type="number"
              min={20}
              max={400}
              step={0.1}
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
            />
          </div>
        </div>

        <div className="set-row">
          <span className="set-info"><b>{t("goal")}</b></span>
          {renderSeg(t("goal"), form.goal, GOALS, "goals", (v) => setForm((f) => ({ ...f, goal: v })))}
        </div>

        <div className="set-row">
          <span className="set-info"><b>{t("activity")}</b></span>
          {renderSeg(t("activity"), form.activity, ACTIVITIES, "activities", (v) => setForm((f) => ({ ...f, activity: v })))}
        </div>

        <div className="set-row">
          <span className="set-info"><b>{t("fitness")}</b></span>
          {renderSeg(t("fitness"), form.fitness, FITNESS_LEVELS, "fitnessLevels", (v) => setForm((f) => ({ ...f, fitness: v })))}
        </div>

        <div className="set-row">
          <span className="set-info">
            <b><label htmlFor="pf-perweek">{t("perWeek")}</label></b>
          </span>
          <div className="field" style={FIELD_NUM_STYLE}>
            <input
              id="pf-perweek"
              type="number"
              min={0}
              max={14}
              step={1}
              value={form.perWeek}
              onChange={(e) => setForm((f) => ({ ...f, perWeek: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {saveErr && <p className="field-error" role="alert">{t("saveErr")}</p>}

      <div className="profile-actions">
        <button type="button" className="btn" onClick={save} disabled={busy || !loaded}>
          {busy ? t("saving") : flash ? t("saved") : t("save")}
        </button>
      </div>

      {/* Weight history — newest first, straight from the GET/PATCH body */}
      {loaded && (
        <>
          <div className="set-head">
            <h3 className="h3">{t("weightLog")}</h3>
          </div>
          {weights.length === 0 ? (
            <p className="set-note">{t("weightEmpty")}</p>
          ) : (
            <div className="set-rows">
              {weights.map((w) => (
                <div className="set-row" key={w.logDate}>
                  <span className="set-info"><b>{dateFmt.format(new Date(`${w.logDate}T00:00:00Z`))}</b></span>
                  <span className="set-val">{numFmt.format(w.weightKg)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
