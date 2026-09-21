"use client";

import Link from "next/link";
import type { Title } from "@/lib/types";

export default function Hero({ title }: { title: Title }) {
  return (
    <section className="relative h-[78vh] min-h-[520px] w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={title.backdrop ?? title.thumbnails[0]} alt={title.title} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-transparent to-black/40" />

      <div className="relative mx-auto flex h-full max-w-[1500px] flex-col justify-end px-5 pb-24 md:px-8">
        <span className="pill mb-4 w-fit">
          <span className="h-1.5 w-1.5 rounded-full bg-iq animate-pulse2" /> Indexed by Castlens
        </span>
        <h1 className="max-w-2xl text-4xl font-extrabold leading-none tracking-tight md:text-6xl">{title.title}</h1>
        <div className="mt-3 flex items-center gap-3 text-sm text-white/70">
          <span className="rounded border border-white/30 px-1.5">{title.rating}</span>
          <span>{title.year}</span>
          <span>{title.genres.join(" · ")}</span>
          <span className="flex items-center gap-1 text-iq">● {title.cast.length} cast recognized</span>
        </div>
        <p className="mt-4 max-w-xl text-base text-white/80 md:text-lg">{title.synopsis}</p>
        <div className="mt-6 flex items-center gap-3">
          <Link href={`/watch/${title.id}`} className="btn btn-play">▶ Play</Link>
          <Link href={`/watch/${title.id}`} className="btn btn-ghost">ⓘ More Info</Link>
          <Link href="/studio" className="btn btn-iq">✦ See the intelligence</Link>
        </div>
      </div>
    </section>
  );
}
