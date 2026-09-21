export interface Interval { start: number; end: number; }

export interface CastMember {
  actor: string;
  character: string;
  slug: string;
  screenTimeSec: number;
  appearances: Interval[];
}

export interface Title {
  id: string;
  title: string;
  year: number;
  rating: string;
  genres: string[];
  accent: string;
  synopsis: string;
  durationSec: number;
  video: string;
  backdrop: string | null;
  thumbnails: string[];
  intro: Interval | null;
  scenes: Interval[];
  cast: CastMember[];
}

export interface DetectedFace {
  actor: string | null;
  conf: number;
  box: [number, number, number, number]; // normalized x,y,w,h
}
export interface FrameMeta { t: number; faces: DetectedFace[]; }

export interface Intelligence {
  durationSec: number;
  sampleFps: number;
  cast: { actor: string; appearances: Interval[]; screenTimeSec: number }[];
  frames: FrameMeta[];
  thumbnails: { t: number; path: string; score: number }[];
  backdrop: string | null;
  intro: Interval | null;
  scenes: Interval[];
}

export const castHeadshot = (slug: string) => `/titles/_cast/${slug}.jpg`;
