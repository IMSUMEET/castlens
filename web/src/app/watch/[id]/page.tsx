"use client";

import { useParams } from "next/navigation";
import { useCatalog, useIntelligence } from "@/lib/data";
import Player from "@/components/Player";

export default function WatchPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const catalog = useCatalog();
  const intel = useIntelligence(id);
  const title = catalog?.titles.find((t) => t.id === id);

  if (!catalog || !intel || !title) {
    return <div className="grid min-h-screen place-items-center text-white/40">Loading title…</div>;
  }
  return <Player title={title} intel={intel} catalog={catalog} />;
}
