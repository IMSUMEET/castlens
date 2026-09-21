"use client";

import { useCatalog } from "@/lib/data";
import Hero from "@/components/Hero";
import TitleRow from "@/components/TitleRow";

export default function HomePage() {
  const catalog = useCatalog();
  if (!catalog) {
    return <div className="grid min-h-screen place-items-center text-white/40">Loading Castlens…</div>;
  }
  const { titles } = catalog;
  const featured = titles[0];
  const byGenre = (g: string) => titles.filter((t) => t.genres.includes(g));
  const top10 = [...titles].sort((a, b) => b.cast.length - a.cast.length);

  return (
    <main className="pb-20">
      <Hero title={featured} />
      <div className="relative z-10 -mt-16 space-y-8">
        <TitleRow label="Trending Now" titles={titles} />
        <TitleRow label="Top 10 — most indexed today" titles={top10} ranked />
        <TitleRow label="Thrillers & Mysteries" titles={[...byGenre("Thriller"), ...byGenre("Mystery"), ...byGenre("Sci-Fi")]} />
        <TitleRow label="Lighter fare" titles={[...byGenre("Rom-Com"), ...byGenre("Comedy"), ...byGenre("Fantasy")]} />
      </div>
    </main>
  );
}
