"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Title } from "@/lib/types";

export default function TitleCard({ title, rank }: { title: Title; rank?: number }) {
  const img = title.backdrop ?? title.thumbnails[0];
  return (
    <Link href={`/watch/${title.id}`} className="group relative block shrink-0">
      <motion.div
        whileHover={{ scale: 1.06, y: -4 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="relative h-[150px] w-[268px] overflow-hidden rounded-lg bg-night-850 shadow-card"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={title.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        {rank !== undefined && (
          <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-bold text-iq">#{rank}</span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="text-sm font-bold leading-tight">{title.title}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/60">
            <span className="rounded border border-white/25 px-1">{title.rating}</span>
            <span>{title.year}</span>
            <span className="ml-auto flex items-center gap-1 text-iq">
              <span className="h-1.5 w-1.5 rounded-full bg-iq" />{title.cast.length} cast
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
