"""Castlens ingest engine.

Turns a raw video + an enrolled cast into the metadata a streaming platform
needs: a per-actor appearance timeline (X-Ray), smart-thumbnail candidates,
scene-cut boundaries, and a skip-intro marker. Emits intelligence.json.

Runs identically on a laptop and inside the AWS Lambda container.
"""

from __future__ import annotations

import json
import os

import cv2
import numpy as np
from PIL import Image

from faces import CastIndex, FaceEngine


def _merge_intervals(times: list[float], gap: float) -> list[tuple[float, float]]:
    if not times:
        return []
    times = sorted(times)
    spans = [[times[0], times[0]]]
    for t in times[1:]:
        if t - spans[-1][1] <= gap:
            spans[-1][1] = t
        else:
            spans.append([t, t])
    return [(round(a, 2), round(b, 2)) for a, b in spans]


def ingest_video(
    video_path: str,
    cast: CastIndex,
    engine: FaceEngine,
    out_dir: str,
    sample_fps: float = 3.0,
) -> dict:
    os.makedirs(out_dir, exist_ok=True)
    thumbs_dir = os.path.join(out_dir, "thumbs")
    os.makedirs(thumbs_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = total / fps if fps else 0.0
    step = max(1, int(round(fps / sample_fps)))

    frames_meta: list[dict] = []          # per sampled time: faces for X-Ray
    appearances: dict[str, list[float]] = {}
    thumb_candidates: list[tuple[float, float, np.ndarray]] = []  # score, t, frame(BGR)
    prev_small: np.ndarray | None = None
    scene_cuts: list[float] = [0.0]

    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % step == 0:
            t = round(idx / fps, 2)
            h, w = frame.shape[:2]

            # scene-cut detection via downscaled grayscale frame difference
            small = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (64, 36))
            if prev_small is not None:
                diff = float(np.mean(cv2.absdiff(small, prev_small)))
                if diff > 22 and t - scene_cuts[-1] > 1.0:
                    scene_cuts.append(t)
            prev_small = small

            img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            dets = engine.detect(img)

            faces_out = []
            best_area = 0.0
            for d in dets:
                name, conf = cast.match(d.embedding)
                x, y, bw, bh = d.box
                faces_out.append({
                    "actor": name, "conf": conf,
                    "box": [round(x / w, 4), round(y / h, 4), round(bw / w, 4), round(bh / h, 4)],
                })
                if name:
                    appearances.setdefault(name, []).append(t)
                    best_area = max(best_area, (bw * bh) / (w * h) * (0.5 + conf))
            frames_meta.append({"t": t, "faces": faces_out})
            if best_area > 0:
                thumb_candidates.append((best_area, t, frame.copy()))
        idx += 1
    cap.release()

    # smart thumbnails: highest face-prominence frames, spread across the runtime
    thumb_candidates.sort(key=lambda c: -c[0])
    chosen: list[tuple[float, float, np.ndarray]] = []
    for score, t, fr in thumb_candidates:
        if all(abs(t - ct) > 2.0 for _, ct, _ in chosen):
            chosen.append((score, t, fr))
        if len(chosen) >= 4:
            break
    thumbnails = []
    for i, (score, t, fr) in enumerate(chosen):
        p = os.path.join(thumbs_dir, f"thumb_{i}.jpg")
        cv2.imwrite(p, fr, [cv2.IMWRITE_JPEG_QUALITY, 88])
        thumbnails.append({"t": t, "path": os.path.relpath(p, out_dir), "score": round(float(score), 4)})

    # backdrop = the top thumbnail; also saved full-res
    backdrop_rel = thumbnails[0]["path"] if thumbnails else None

    # cast timeline
    cast_timeline = []
    for name, times in appearances.items():
        spans = _merge_intervals(times, gap=1.5)
        screen = round(sum(b - a for a, b in spans) + len(spans) * (1 / sample_fps), 1)
        cast_timeline.append({
            "actor": name,
            "appearances": [{"start": a, "end": b} for a, b in spans],
            "screenTimeSec": screen,
        })
    cast_timeline.sort(key=lambda c: -c["screenTimeSec"])

    # skip-intro: leading run of sampled frames with no recognised faces
    intro_end = 0.0
    for fm in frames_meta:
        if any(f["actor"] for f in fm["faces"]):
            break
        intro_end = fm["t"]
    intro = {"start": 0.0, "end": round(intro_end, 2)} if intro_end >= 2.0 else None

    scenes = []
    cuts = scene_cuts + [round(duration, 2)]
    for a, b in zip(cuts, cuts[1:]):
        if b - a > 0.4:
            scenes.append({"start": a, "end": round(b, 2)})

    return {
        "durationSec": round(duration, 2),
        "sampleFps": sample_fps,
        "cast": cast_timeline,
        "frames": frames_meta,
        "thumbnails": thumbnails,
        "backdrop": backdrop_rel,
        "intro": intro,
        "scenes": scenes,
    }


def ingest_frames(
    frame_paths: list[str],
    cast: CastIndex,
    engine: FaceEngine,
    sample_fps: float = 3.0,
) -> dict:
    """Recognition over pre-extracted frame images (the AWS Lambda path, where
    the frame-extractor Lambda has already produced keyframes in S3)."""
    frames_meta: list[dict] = []
    appearances: dict[str, list[float]] = {}
    for i, p in enumerate(sorted(frame_paths)):
        t = round(i / sample_fps, 2)
        img = Image.open(p).convert("RGB")
        w, h = img.size
        faces_out = []
        for d in engine.detect(img):
            name, conf = cast.match(d.embedding)
            x, y, bw, bh = d.box
            faces_out.append({
                "actor": name, "conf": conf,
                "box": [round(x / w, 4), round(y / h, 4), round(bw / w, 4), round(bh / h, 4)],
            })
            if name:
                appearances.setdefault(name, []).append(t)
        frames_meta.append({"t": t, "faces": faces_out})

    cast_timeline = []
    for name, times in appearances.items():
        spans = _merge_intervals(times, gap=1.5)
        cast_timeline.append({
            "actor": name,
            "appearances": [{"start": a, "end": b} for a, b in spans],
            "screenTimeSec": round(sum(b - a for a, b in spans) + len(spans) / sample_fps, 1),
        })
    cast_timeline.sort(key=lambda c: -c["screenTimeSec"])
    return {"durationSec": round(len(frame_paths) / sample_fps, 2), "sampleFps": sample_fps,
            "cast": cast_timeline, "frames": frames_meta}


def write_intelligence(data: dict, out_dir: str) -> str:
    path = os.path.join(out_dir, "intelligence.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    return path
