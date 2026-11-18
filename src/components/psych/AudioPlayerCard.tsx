"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api-url";
import { Pause, Play } from "lucide-react";

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Calm audio player card. Reports progress to /api/psych/progress
 *  every 15s of playback and once on finish (completed=true). */
export function AudioPlayerCard({ id, src, title, desc }: { id: string; src: string; title: string; desc: string }) {
  const t = useTranslations("psychApp");
  const ref = useRef<HTMLAudioElement>(null);
  const sent = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const report = useCallback((seconds: number, completed = false) => {
    if (seconds <= 0) return;
    sent.current = seconds;
    void fetch(apiUrl("/api/psych/progress"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceId: id, seconds: Math.round(seconds), completed }),
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const tick = () => {
      setCurrent(audio.currentTime);
      if (audio.currentTime - sent.current >= 15) report(audio.currentTime);
    };
    const ended = () => { setPlaying(false); setCurrent(0); sent.current = 0; report(audio.duration, true); };
    const loaded = () => setDuration(audio.duration || 0);
    audio.addEventListener("timeupdate", tick);
    audio.addEventListener("ended", ended);
    audio.addEventListener("loadedmetadata", loaded);
    return () => {
      audio.removeEventListener("timeupdate", tick);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("loadedmetadata", loaded);
      if (audio.currentTime > sent.current) report(audio.currentTime);
    };
  }, [report]);

  const toggle = () => {
    const audio = ref.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = ref.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  /** Keyboard seeking for the slider bar: arrows ±5 s, Home/End to the
   *  edges — the click-to-seek div stays fully keyboard-operable. */
  const seekKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const audio = ref.current;
    if (!audio || !duration) return;
    const jump = (s: number) => {
      e.preventDefault();
      audio.currentTime = Math.min(duration, Math.max(0, s));
      setCurrent(audio.currentTime);
    };
    if (e.key === "ArrowRight") jump(audio.currentTime + 5);
    else if (e.key === "ArrowLeft") jump(audio.currentTime - 5);
    else if (e.key === "Home") jump(0);
    else if (e.key === "End") jump(duration);
  };

  return (
    <div className="card player">
      <div className="player-top">
        <button type="button" className="player-play" onClick={toggle} aria-label={playing ? t("playerPause") : t("playerPlay")}>
          {playing ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}
        </button>
        <div className="player-track">
          <b>{title}</b>
          <small>{desc}</small>
        </div>
      </div>
      <div
        className="player-bar"
        onClick={seek}
        onKeyDown={seekKey}
        role="slider"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
        aria-valuetext={duration ? `${fmt(current)} / ${fmt(duration)}` : undefined}
        tabIndex={0}
      >
        <i style={{ width: duration ? `${(current / duration) * 100}%` : "0%" }} />
      </div>
      <div className="player-time">
        <span>{fmt(current)}</span>
        <span>{duration ? fmt(duration) : "–:––"}</span>
      </div>
      {/* Ambience loops — instrumental, no speech: captions don't apply. */}
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={ref} src={src} preload="none" />
    </div>
  );
}
