"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Wind } from "lucide-react";

/** 4-7-8 breathing guide. The circle breathes via the 19s CSS keyframe
 *  loop (0–4s inhale, 4–11s hold, 11–19s exhale). Starting a session
 *  remounts the <b> circle (key change), which restarts that animation at
 *  0% — and the phase label is derived from a state-driven clock, so the
 *  label and the animation can never drift apart (and render stays pure:
 *  no Date.now()/ref reads during render). Idle pauses the animation
 *  (CSS [data-phase="idle"]); reduced-motion disables it. */
const PHASES = [
  { key: "breathIn", seconds: 4 },
  { key: "breathHold", seconds: 7 },
  { key: "breathOut", seconds: 8 },
] as const;
const IN_END = PHASES[0].seconds;                              // 4
const HOLD_END = PHASES[0].seconds + PHASES[1].seconds;        // 11
const CYCLE_S = HOLD_END + PHASES[2].seconds;                  // 19

/** Seconds elapsed in the running session, read from state — the interval
 *  refreshes it twice a second (snappy enough for a seconds counter). */
function useElapsed(running: boolean): number {
  const [clock, setClock] = useState({ start: 0, now: 0 });
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    setClock({ start, now: start });
    const id = setInterval(() => setClock((c) => ({ ...c, now: Date.now() })), 500);
    return () => clearInterval(id);
  }, [running]);
  return running ? Math.max(0, (clock.now - clock.start) / 1000) : 0;
}

export function BreathCircle() {
  const t = useTranslations("dietApp");
  /** 0 = idle; toggling restarts the session (and the <b> key remount). */
  const [session, setSession] = useState(0);
  const running = session > 0;
  const elapsed = useElapsed(running);

  const pos = elapsed % CYCLE_S;
  const idx = pos < IN_END ? 0 : pos < HOLD_END ? 1 : 2;
  const phaseEnd = idx === 0 ? IN_END : idx === 1 ? HOLD_END : CYCLE_S;
  const left = Math.max(1, Math.ceil(phaseEnd - pos));
  const dataPhase = !running ? "idle" : idx === 0 ? "in" : idx === 1 ? "hold" : "out";

  return (
    <div className="card" style={{ display: "grid", gap: "1rem" }}>
      <div className="card-top">
        <span className="chip-ico tinted"><Wind size={20} aria-hidden /></span>
        <span className="eyebrow">{t("breathEyebrow")}</span>
      </div>
      <div className="breath" data-phase={dataPhase}>
        <i aria-hidden />
        {/* key={session}: remount restarts the 19s CSS loop on every start */}
        <b key={session} aria-hidden />
        <span>
          <b>{running ? t(PHASES[idx].key) : t("breathReady")}</b>
          <small>{running ? left : t("breathHint")}</small>
        </span>
      </div>
      <div className="psy-actions">
        <button type="button" className="btn" onClick={() => setSession((s) => (s === 0 ? 1 : 0))}>
          {running ? t("breathStop") : t("breathStart")}
        </button>
      </div>
    </div>
  );
}
