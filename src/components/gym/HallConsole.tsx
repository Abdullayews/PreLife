"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Building2, Check, Clock, LoaderCircle, Plus, Star, Trash2, UserRound,
} from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { toast } from "@/components/Toaster";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * The hall manager's console (v5.4 role system): the linked partner
 * hall's editable details (hours, day-pass price, address, welcome
 * visibility) and its trainer roster. Loads GET /api/gym/console on
 * mount; every action POSTs /api/gym/console and refetches.
 *
 * Hall name + specialty labels resolve client-side from the same
 * gymApp/gymHome message keys the public catalog uses, so the manager
 * edits exactly what visitors see.
 */

type HallData = {
  id: string;
  slug: string;
  ns: "gymApp" | "gymHome";
  nameKey: string;
  image: string;
  rating: number | null;
  address: string;
  hours: string;
  dayPrice: number | null;
  welcomeVisible: boolean;
};

type TrainerRow = { id: string; name: string; specCode: string; years: number };

type ConsoleData = {
  hall: HallData;
  trainers: TrainerRow[];
  /** gym_trainer_specs codes (the add-trainer form's options). */
  specs: { code: string }[];
};

export function HallConsole() {
  const t = useTranslations("gymApp");
  const tg = useTranslations("gymHome");

  const [data, setData] = useState<ConsoleData | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  /* Hall details form — mirrors the loaded hall; saved via POST update. */
  const [hours, setHours] = useState("");
  const [dayPrice, setDayPrice] = useState("");
  const [address, setAddress] = useState("");
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);

  /* Trainer roster: add form + the pending remove confirm. */
  const [tName, setTName] = useState("");
  const [tSpec, setTSpec] = useState("");
  const [tYears, setTYears] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [askTrainer, setAskTrainer] = useState<TrainerRow | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const apply = useCallback((d: ConsoleData) => {
    setData(d);
    setHours(d.hall.hours);
    setDayPrice(d.hall.dayPrice === null ? "" : String(d.hall.dayPrice));
    setAddress(d.hall.address);
    setWelcomeVisible(d.hall.welcomeVisible);
    setTSpec((prev) => (prev && d.specs.some((s) => s.code === prev) ? prev : (d.specs[0]?.code ?? "")));
    setState("ready");
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/gym/console"), { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      apply((await res.json()) as ConsoleData);
    } catch {
      setState("error");
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  /* The hall's display name — same message key the public catalog shows. */
  const hallName = (() => {
    if (!data) return "";
    const tr = data.hall.ns === "gymHome" ? tg : t;
    return tr.has(data.hall.nameKey) ? tr(data.hall.nameKey) : data.hall.slug;
  })();

  const specLabel = (code: string) => (t.has(`hallSpec.${code}`) ? t(`hallSpec.${code}`) : code);

  const saveDetails = async () => {
    if (!data || saveBusy) return;
    setInvalid(false);
    const body: Record<string, unknown> = {};
    if (hours.trim() !== data.hall.hours) body.hours = hours.trim();
    const price = dayPrice.trim().replace(",", ".");
    const prev = data.hall.dayPrice === null ? "" : String(data.hall.dayPrice);
    if (price !== prev) body.dayPrice = price === "" ? null : Number(price);
    if (address.trim() !== data.hall.address) body.address = address.trim();
    if (welcomeVisible !== data.hall.welcomeVisible) body.welcomeVisible = welcomeVisible;
    if (Object.keys(body).length === 0) {
      toast(t("console.saved"), "success");
      return;
    }
    setSaveBusy(true);
    try {
      const res = await fetch(apiUrl("/api/gym/console"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update", ...body }),
      });
      if (!res.ok) throw new Error(String(res.status));
      apply((await res.json()) as ConsoleData);
      toast(t("console.saved"), "success");
    } catch {
      toast(t("console.errorGeneric"), "error");
    } finally {
      setSaveBusy(false);
    }
  };

  const addTrainer = async () => {
    if (!data || addBusy) return;
    setInvalid(false);
    const name = tName.trim();
    const years = Number(tYears.trim());
    if (!name || !tSpec || !Number.isInteger(years) || years < 0 || years > 60) {
      setInvalid(true);
      return;
    }
    setAddBusy(true);
    try {
      const res = await fetch(apiUrl("/api/gym/console"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "add_trainer", name, specCode: tSpec, years }),
      });
      if (!res.ok) throw new Error(String(res.status));
      apply((await res.json()) as ConsoleData);
      setTName("");
      setTYears("");
      toast(t("console.trainerAdded"), "success");
    } catch {
      toast(t("console.errorGeneric"), "error");
    } finally {
      setAddBusy(false);
    }
  };

  const removeTrainer = async (tr: TrainerRow) => {
    if (removeBusy) return;
    setRemoveBusy(true);
    try {
      const res = await fetch(apiUrl("/api/gym/console"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "remove_trainer", trainerId: tr.id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      apply((await res.json()) as ConsoleData);
      toast(t("console.trainerRemoved"), "success");
    } catch {
      toast(t("console.errorGeneric"), "error");
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <div className="wrap">
      <header className="page-head">
        <h1 className="display sm">{t("console.title")}</h1>
        <p className="lede">{t("console.subtitle")}</p>
      </header>

      {state === "loading" && (
        <p className="lede" style={{ display: "flex", alignItems: "center", gap: ".55rem" }} aria-busy="true">
          <LoaderCircle size={18} className="spin" aria-hidden />
          {t("console.title")}
        </p>
      )}

      {state === "error" && (
        <div className="psy-filters">
          <p className="field-error" style={{ margin: 0 }}>{t("console.errorGeneric")}</p>
          <div className="psy-filter-row">
            <button type="button" className="btn btn-sm" onClick={() => void load()}>
              <LoaderCircle size={14} aria-hidden />
              {t("console.errorGeneric")}
            </button>
          </div>
        </div>
      )}

      {state === "ready" && data && (
        <>
          {/* 01 — the hall's editable details */}
          <section aria-labelledby="hall-info" className="blk">
            <h2 id="hall-info" className="eyebrow"><b>01</b>{t("console.hallTitle")}</h2>
            <div className="set-panel" style={{ maxWidth: "44rem" }}>
              <div className="set-head" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: ".9rem" }}>
                <span className="chip-ico tinted" aria-hidden><Building2 size={22} /></span>
                <div>
                  <h3 className="h3" style={{ margin: 0 }}>{hallName}</h3>
                  <p style={{ margin: 0, fontSize: ".8125rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: ".35rem" }}>
                    {data.hall.rating !== null && (<><Star size={13} aria-hidden />{data.hall.rating} · </>)}
                    {t("console.rating")}
                  </p>
                </div>
              </div>

              <div className="set-rows">
                <div className="set-row">
                  <span className="set-info">
                    <b><label htmlFor="hall-hours">{t("console.hours")}</label></b>
                    <span>{t("console.hoursHint")}</span>
                  </span>
                  <div className="field" style={{ maxWidth: "12rem" }}>
                    <input
                      id="hall-hours"
                      type="text"
                      maxLength={60}
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                    />
                  </div>
                </div>
                <div className="set-row">
                  <span className="set-info"><b><label htmlFor="hall-price">{t("console.dayPrice")}</label></b></span>
                  <div className="field" style={{ maxWidth: "9rem" }}>
                    <input
                      id="hall-price"
                      type="number"
                      min={0}
                      max={100000}
                      step={0.5}
                      value={dayPrice}
                      onChange={(e) => setDayPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="set-row">
                  <span className="set-info"><b><label htmlFor="hall-address">{t("console.address")}</label></b></span>
                  <div className="field" style={{ maxWidth: "18rem" }}>
                    <input
                      id="hall-address"
                      type="text"
                      maxLength={160}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
                <div className="set-row">
                  <span className="set-info">
                    <b>{t("console.welcomeVisible")}</b>
                    <span>{t("console.welcomeVisibleHint")}</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={welcomeVisible}
                    aria-label={t("console.welcomeVisible")}
                    className="switch"
                    onClick={() => setWelcomeVisible((v) => !v)}
                  />
                </div>
              </div>

              {invalid && <p className="field-error" role="alert">{t("console.invalid")}</p>}
              <div style={{ display: "flex", gap: ".6rem", marginTop: "1rem" }}>
                <button type="button" className="btn btn-sm" onClick={() => void saveDetails()} disabled={saveBusy}>
                  {saveBusy ? <LoaderCircle size={14} className="spin" aria-hidden /> : <Check size={14} aria-hidden />}
                  {t("console.save")}
                </button>
              </div>
              <p className="set-note" style={{ marginTop: "1rem" }}>
                <Clock size={15} aria-hidden />
                <span>
                  {t("gyms.openHoursSr")}: <b>{data.hall.hours}</b> · {data.hall.dayPrice ?? "—"} ₼ · {data.hall.address}
                </span>
              </p>
            </div>
          </section>

          {/* 02 — the trainer roster */}
          <section aria-labelledby="hall-trainers" className="blk">
            <h2 id="hall-trainers" className="eyebrow"><b>02</b>{t("console.trainersTitle")}</h2>

            {data.trainers.length === 0 ? (
              <p className="lede">{t("console.trainersEmpty")}</p>
            ) : (
              <ul className="jrnl" style={{ maxWidth: "44rem" }}>
                {data.trainers.map((tr) => (
                  <li key={tr.id} className="jrnl-entry">
                    <div className="row" style={{ flexWrap: "wrap" }}>
                      <span className="chip-ico tinted" aria-hidden><UserRound size={18} /></span>
                      <b>{tr.name}</b>
                      <span className="tag">{specLabel(tr.specCode)}</span>
                      <span className="tag">{t("gyms.trainerYears", { count: tr.years })}</span>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ marginLeft: "auto" }}
                        onClick={() => setAskTrainer(tr)}
                        disabled={removeBusy}
                        aria-label={t("console.trainerRemove")}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Add trainer */}
            <div className="set-panel" style={{ maxWidth: "44rem", marginTop: ".6rem" }}>
              <div className="set-head">
                <h3 className="h3">{t("console.addTrainer")}</h3>
              </div>
              <div className="set-rows">
                <div className="set-row">
                  <span className="set-info"><b><label htmlFor="tr-name">{t("console.trainerName")}</label></b></span>
                  <div className="field" style={{ maxWidth: "14rem" }}>
                    <input
                      id="tr-name"
                      type="text"
                      maxLength={80}
                      value={tName}
                      onChange={(e) => setTName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="set-row">
                  <span className="set-info"><b><label htmlFor="tr-spec">{t("console.trainerSpec")}</label></b></span>
                  <div className="field" style={{ maxWidth: "14rem" }}>
                    <select
                      id="tr-spec"
                      value={tSpec}
                      onChange={(e) => setTSpec(e.target.value)}
                    >
                      {data.specs.map(({ code }) => (
                        <option key={code} value={code}>{specLabel(code)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="set-row">
                  <span className="set-info"><b><label htmlFor="tr-years">{t("console.trainerYears")}</label></b></span>
                  <div className="field" style={{ maxWidth: "9rem" }}>
                    <input
                      id="tr-years"
                      type="number"
                      min={0}
                      max={60}
                      step={1}
                      value={tYears}
                      onChange={(e) => setTYears(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              {invalid && <p className="field-error" role="alert">{t("console.invalid")}</p>}
              <div style={{ display: "flex", gap: ".6rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => void addTrainer()}
                  disabled={addBusy || !tName.trim() || !tSpec}
                >
                  {addBusy ? <LoaderCircle size={14} className="spin" aria-hidden /> : <Plus size={14} aria-hidden />}
                  {t("console.addTrainer")}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={askTrainer !== null}
        onClose={() => setAskTrainer(null)}
        onConfirm={() => {
          const tr = askTrainer;
          setAskTrainer(null);
          if (tr) void removeTrainer(tr);
        }}
        message={askTrainer ? t("console.trainerRemoveConfirm") : ""}
        confirmLabel={t("console.trainerRemove")}
        busy={removeBusy}
      />
    </div>
  );
}
