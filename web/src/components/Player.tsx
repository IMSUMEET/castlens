"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Catalog } from "@/lib/data";
import { fmtTime } from "@/lib/data";
import type { Intelligence, Title } from "@/lib/types";

const PALETTE = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#60a5fa"];

export default function Player({ title, intel, catalog }: { title: Title; intel: Intelligence; catalog: Catalog }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [xray, setXray] = useState(true);
  const [focus, setFocus] = useState<string | null>(null); // focused actor slug

  const dur = intel.durationSec || title.durationSec;
  const colorFor = useMemo(() => {
    const m: Record<string, string> = {};
    title.cast.forEach((c, i) => (m[c.slug] = PALETTE[i % PALETTE.length]));
    return m;
  }, [title.cast]);

  // nearest analyzed frame to current time (for X-Ray overlay)
  const frame = useMemo(() => {
    if (!intel.frames.length) return null;
    let best = intel.frames[0], bd = Infinity;
    for (const f of intel.frames) {
      const d = Math.abs(f.t - t);
      if (d < bd) { bd = d; best = f; }
    }
    return bd < 0.6 ? best : null;
  }, [intel.frames, t]);

  const onScreen = (frame?.faces ?? []).filter((f) => f.actor);
  const inIntro = intel.intro && t >= intel.intro.start && t < intel.intro.end - 0.2;

  const toggle = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };
  const seek = (to: number) => { const v = videoRef.current; if (v) { v.currentTime = Math.max(0, Math.min(dur, to)); setT(v.currentTime); } };
  const jumpToActor = (slug: string) => {
    setFocus(slug);
    const c = title.cast.find((x) => x.slug === slug);
    if (c?.appearances[0]) { seek(c.appearances[0].start); videoRef.current?.play(); setPlaying(true); }
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-20 pb-16">
      <Link href="/" className="mb-3 inline-block text-sm text-white/60 hover:text-white">← Back to browse</Link>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Player */}
        <div>
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-card">
            <video
              ref={videoRef}
              src={title.video}
              className="h-full w-full object-cover"
              onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onClick={toggle}
              playsInline
            />

            {/* X-Ray bounding boxes */}
            {xray && (!playing || true) && frame && (
              <div className="pointer-events-none absolute inset-0">
                {frame.faces.map((f, i) => {
                  const [x, y, w, h] = f.box;
                  const col = f.actor ? colorFor[f.actor] ?? "#22d3ee" : "#94a3b8";
                  const person = f.actor ? catalog.people[f.actor] : null;
                  return (
                    <div key={i} className="absolute rounded-md border-2 transition-all"
                      style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, borderColor: col, boxShadow: `0 0 0 1px rgba(0,0,0,.4)` }}>
                      <span className="absolute -top-6 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: col, color: "#04121a" }}>
                        {person ? person.name : `${Math.round(f.conf * 100)}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Skip intro */}
            <AnimatePresence>
              {inIntro && (
                <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  onClick={() => seek(intel.intro!.end)}
                  className="absolute bottom-20 right-5 rounded-md bg-white/90 px-4 py-2 text-sm font-bold text-black hover:bg-white">
                  Skip Intro ⏭
                </motion.button>
              )}
            </AnimatePresence>

            {/* center play when paused */}
            {!playing && (
              <button onClick={toggle} className="absolute inset-0 grid place-items-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-black/60 text-2xl backdrop-blur">▶</span>
              </button>
            )}

            {/* controls */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
              {/* scrubber with scene ticks + focused actor bands */}
              <div className="group relative h-2.5 cursor-pointer" onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                seek(((e.clientX - r.left) / r.width) * dur);
              }}>
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25" />
                <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-iq" style={{ width: `${(t / dur) * 100}%` }} />
                {focus && title.cast.find((c) => c.slug === focus)?.appearances.map((a, i) => (
                  <div key={i} className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded"
                    style={{ left: `${(a.start / dur) * 100}%`, width: `${((a.end - a.start) / dur) * 100}%`, background: colorFor[focus] }} />
                ))}
                {intel.scenes.map((s, i) => (
                  <div key={i} className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/40" style={{ left: `${(s.start / dur) * 100}%` }} />
                ))}
                <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-iq shadow-glow" style={{ left: `${(t / dur) * 100}%` }} />
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <button onClick={toggle} className="text-lg">{playing ? "⏸" : "▶"}</button>
                <span className="tabular text-white/70">{fmtTime(t)} / {fmtTime(dur)}</span>
                <button onClick={() => setXray((v) => !v)}
                  className={`ml-auto rounded px-2.5 py-1 text-xs font-bold ${xray ? "bg-iq text-black" : "bg-white/15 text-white"}`}>
                  X-Ray {xray ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </div>

          {/* title meta */}
          <div className="mt-4">
            <h1 className="text-2xl font-extrabold">{title.title}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-white/60">
              <span className="rounded border border-white/30 px-1.5">{title.rating}</span>
              <span>{title.year}</span>
              <span>{title.genres.join(" · ")}</span>
            </div>
            <p className="mt-3 max-w-2xl text-white/80">{title.synopsis}</p>
          </div>
        </div>

        {/* X-Ray side panel */}
        <aside className="rounded-xl border border-white/10 bg-night-900/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-iq/20 text-iq">◐</span>
            <h3 className="font-bold">X-Ray</h3>
            <span className="pill ml-auto !py-0.5 text-[10px]">{playing ? "playing" : "paused"}</span>
          </div>

          <p className="mb-2 text-xs uppercase tracking-wide text-white/40">On screen now</p>
          <div className="min-h-[64px] space-y-2">
            <AnimatePresence mode="popLayout">
              {onScreen.length ? onScreen.map((f) => {
                const p = catalog.people[f.actor!];
                const c = title.cast.find((x) => x.slug === f.actor);
                return (
                  <motion.div key={f.actor} layout initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 rounded-lg bg-white/5 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p?.headshot} alt={p?.name} className="h-10 w-10 rounded-full object-cover ring-2" style={{ boxShadow: `0 0 0 2px ${colorFor[f.actor!]}` }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p?.name}</p>
                      <p className="truncate text-xs text-white/50">{c?.character}</p>
                    </div>
                    <span className="ml-auto text-xs font-mono text-iq">{Math.round(f.conf * 100)}%</span>
                  </motion.div>
                );
              }) : <p className="text-sm text-white/40">Pause on a face, or press play — Castlens tags who&apos;s on screen.</p>}
            </AnimatePresence>
          </div>

          <p className="mb-2 mt-5 text-xs uppercase tracking-wide text-white/40">Full cast — tap to jump</p>
          <div className="space-y-1.5">
            {title.cast.map((c) => (
              <button key={c.slug} onClick={() => jumpToActor(c.slug)}
                className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${focus === c.slug ? "bg-white/10" : "hover:bg-white/5"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={catalog.people[c.slug]?.headshot} alt={c.actor} className="h-9 w-9 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${colorFor[c.slug]}` }} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.actor}</p>
                  <p className="truncate text-xs text-white/50">{c.character}</p>
                </div>
                <span className="ml-auto text-xs text-white/40">{c.screenTimeSec}s</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
