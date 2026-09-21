"use client";

import Link from "next/link";
import { useState } from "react";
import { useCatalog, useIntelligence } from "@/lib/data";

const PALETTE = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#60a5fa"];

const STAGES = [
  { k: "ingest", t: "Ingest", d: "S3 upload event triggers the pipeline" },
  { k: "frames", t: "Frame extraction", d: "ffmpeg samples keyframes" },
  { k: "faces", t: "Face recognition", d: "MTCNN + FaceNet embeddings, matched to the cast" },
  { k: "meta", t: "Intelligence", d: "Timeline · thumbnails · skip-intro" },
];

export default function StudioPage() {
  const catalog = useCatalog();
  const [id, setId] = useState<string | null>(null);
  const activeId = id ?? catalog?.titles[0]?.id;
  const intel = useIntelligence(activeId ?? undefined);
  if (!catalog) return <div className="grid min-h-screen place-items-center text-white/40">Loading…</div>;
  const title = catalog.titles.find((t) => t.id === activeId)!;

  const framesAnalyzed = intel?.frames.length ?? 0;
  const facesDetected = intel?.frames.reduce((s, f) => s + f.faces.length, 0) ?? 0;
  const colorFor = (slug: string) => PALETTE[title.cast.findIndex((c) => c.slug === slug) % PALETTE.length];

  return (
    <main className="mx-auto max-w-[1200px] px-5 pb-20 pt-24 md:px-8">
      <div className="mb-6">
        <span className="pill mb-3">The engine behind the magic</span>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Castlens Studio</h1>
        <p className="mt-2 max-w-2xl text-white/70">
          When a title is ingested, Castlens auto-generates the metadata streaming platforms pay teams to
          produce by hand: an X-Ray cast timeline, smart thumbnails, and skip-intro markers. Here&apos;s
          the real output for a title.
        </p>
      </div>

      {/* title selector */}
      <div className="row-scroll mb-8">
        {catalog.titles.map((t) => (
          <button key={t.id} onClick={() => setId(t.id)}
            className={`shrink-0 overflow-hidden rounded-lg border transition ${activeId === t.id ? "border-iq" : "border-white/10 hover:border-white/30"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.backdrop ?? t.thumbnails[0]} alt={t.title} className="h-16 w-28 object-cover" />
          </button>
        ))}
      </div>

      {/* pipeline stages */}
      <div className="mb-8 grid gap-3 md:grid-cols-4">
        {STAGES.map((s, i) => (
          <div key={s.k} className="relative rounded-xl border border-white/10 bg-night-900 p-4">
            <span className="text-xs font-bold text-iq">0{i + 1}</span>
            <p className="mt-1 font-semibold">{s.t}</p>
            <p className="mt-1 text-xs text-white/50">{s.d}</p>
            {i < STAGES.length - 1 && <span className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-white/30 md:block">→</span>}
          </div>
        ))}
      </div>

      {/* stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          ["Duration", `${intel?.durationSec ?? title.durationSec}s`],
          ["Frames analyzed", framesAnalyzed],
          ["Faces detected", facesDetected],
          ["Cast recognized", title.cast.length],
          ["Smart thumbnails", intel?.thumbnails.length ?? 0],
          ["Scenes", intel?.scenes.length ?? 0],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/10 bg-night-900 p-4">
            <p className="text-xs uppercase tracking-wide text-white/40">{k}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-iq">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* cast timeline (gantt) */}
        <section>
          <h2 className="mb-3 font-bold">Cast timeline <span className="text-white/40">(X-Ray)</span></h2>
          <div className="space-y-2.5 rounded-xl border border-white/10 bg-night-900 p-4">
            {title.cast.map((c) => (
              <div key={c.slug} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={catalog.people[c.slug]?.headshot} alt={c.actor} className="h-8 w-8 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${colorFor(c.slug)}` }} />
                <div className="w-24 shrink-0">
                  <p className="truncate text-xs font-semibold">{c.actor}</p>
                  <p className="truncate text-[10px] text-white/40">{c.character}</p>
                </div>
                <div className="relative h-3 flex-1 rounded bg-white/5">
                  {c.appearances.map((a, i) => (
                    <div key={i} className="absolute top-0 h-3 rounded" title={`${a.start}s – ${a.end}s`}
                      style={{ left: `${(a.start / title.durationSec) * 100}%`, width: `${Math.max(1.5, ((a.end - a.start) / title.durationSec) * 100)}%`, background: colorFor(c.slug) }} />
                  ))}
                </div>
                <span className="w-8 shrink-0 text-right text-[10px] text-white/40">{c.screenTimeSec}s</span>
              </div>
            ))}
            {title.intro && (
              <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
                <span className="rounded bg-white/10 px-2 py-0.5">Skip-intro marker</span>
                {title.intro.start}s → {title.intro.end}s (auto-detected: leading frames with no cast)
              </div>
            )}
          </div>
        </section>

        {/* smart thumbnails */}
        <section>
          <h2 className="mb-3 font-bold">Smart thumbnails <span className="text-white/40">(auto-selected)</span></h2>
          <div className="grid grid-cols-2 gap-3">
            {title.thumbnails.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <div key={i} className="relative overflow-hidden rounded-lg border border-white/10">
                <img src={src} alt={`thumbnail ${i + 1}`} className="aspect-video w-full object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded bg-iq px-1.5 py-0.5 text-[10px] font-bold text-black">CHOSEN</span>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/50">
            Ranked by face prominence (size × recognition confidence) and spread across the runtime — the
            same signal platforms use to personalise artwork.
          </p>
          <Link href={`/watch/${title.id}`} className="btn btn-iq mt-4">▶ Watch with X-Ray</Link>
        </section>
      </div>
    </main>
  );
}
