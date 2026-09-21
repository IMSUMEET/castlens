"use client";

import { useEffect, useState } from "react";
import type { Intelligence, Title } from "./types";

export interface Person { name: string; headshot: string; }
export interface Catalog { titles: Title[]; people: Record<string, Person>; }

export function useCatalog() {
  const [data, setData] = useState<Catalog | null>(null);
  useEffect(() => {
    fetch("/titles/catalog.json").then((r) => r.json()).then(setData).catch(() => setData(null));
  }, []);
  return data;
}

export function useIntelligence(id: string | undefined) {
  const [data, setData] = useState<Intelligence | null>(null);
  useEffect(() => {
    if (!id) return;
    fetch(`/titles/${id}/intelligence.json`).then((r) => r.json()).then(setData).catch(() => setData(null));
  }, [id]);
  return data;
}

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};
