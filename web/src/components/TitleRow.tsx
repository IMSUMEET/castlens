"use client";

import type { Title } from "@/lib/types";
import TitleCard from "./TitleCard";

export default function TitleRow({ label, titles, ranked }: { label: string; titles: Title[]; ranked?: boolean }) {
  if (!titles.length) return null;
  return (
    <section className="mx-auto max-w-[1500px] px-5 md:px-8">
      <h2 className="mb-2 text-lg font-bold text-white/90">{label}</h2>
      <div className="row-scroll">
        {titles.map((t, i) => (
          <TitleCard key={t.id + label} title={t} rank={ranked ? i + 1 : undefined} />
        ))}
      </div>
    </section>
  );
}
