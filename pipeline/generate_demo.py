"""Builds the SceneIQ demo catalog end to end:

  1. downloads a rights-free "cast" of faces (randomuser.me)
  2. renders a short stylised "episode" per title (PIL frames -> ffmpeg mp4)
  3. enrols the cast and runs the REAL ingest pipeline on each clip
  4. writes web/public/titles/<id>/{clip.mp4,intelligence.json,thumbs,...}
     and a combined catalog.json the viewer reads.

The recognition results are genuine — the pipeline actually detects and
identifies the enrolled faces in the rendered footage.
"""

from __future__ import annotations

import json
import os
import random
import shutil
import subprocess
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from faces import CastIndex, FaceEngine
from ingest import ingest_video, write_intelligence

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cast")
TITLES_DIR = os.path.join(ROOT, "web", "public", "titles")
W, H = 1280, 720
FPS = 12

random.seed(42)

# ---- cast: stage name -> randomuser portrait --------------------------------
CAST = {
    "Nova Quinn": ("women", 10), "Rex Calloway": ("men", 10),
    "Isla Monroe": ("women", 26), "Dorian Vale": ("men", 22),
    "Priya Anand": ("women", 39), "Marcus Cole": ("men", 33),
    "Elena Frost": ("women", 44), "Kai Tanaka": ("men", 45),
}

# ---- catalog: comical-but-classy fake titles --------------------------------
TITLES = [
    {
        "id": "uncanny-hollow", "title": "The Uncanny Hollow", "year": 2026,
        "rating": "TV-MA", "genres": ["Thriller", "Mystery"], "accent": "#7c3aed",
        "synopsis": "A sleepy town wakes up to find everyone's reflection is running about four seconds late.",
        "scenes": [["Nova Quinn"], ["Dorian Vale"], ["Nova Quinn", "Marcus Cole"], ["Marcus Cole"], ["Nova Quinn", "Dorian Vale"]],
    },
    {
        "id": "midnight-protocol", "title": "Midnight Protocol", "year": 2025,
        "rating": "TV-14", "genres": ["Sci-Fi", "Action"], "accent": "#0ea5e9",
        "synopsis": "Two hackers and a very opinionated toaster race to stop an AI that just wants a day off.",
        "scenes": [["Rex Calloway"], ["Isla Monroe"], ["Rex Calloway", "Kai Tanaka"], ["Kai Tanaka"], ["Isla Monroe", "Rex Calloway"]],
    },
    {
        "id": "love-and-other-bugs", "title": "Love & Other Bugs", "year": 2026,
        "rating": "TV-PG", "genres": ["Rom-Com"], "accent": "#ec4899",
        "synopsis": "A QA engineer falls for the one person who keeps breaking her code. It's a feature, not a bug.",
        "scenes": [["Priya Anand"], ["Marcus Cole"], ["Priya Anand", "Marcus Cole"], ["Elena Frost"], ["Priya Anand", "Elena Frost"]],
    },
    {
        "id": "crown-of-ashes", "title": "Crown of Ashes", "year": 2024,
        "rating": "TV-MA", "genres": ["Fantasy", "Drama"], "accent": "#f59e0b",
        "synopsis": "Five kingdoms, one throne, and a dragon who is frankly tired of everyone's ambition.",
        "scenes": [["Dorian Vale"], ["Elena Frost"], ["Nova Quinn", "Kai Tanaka"], ["Dorian Vale", "Elena Frost"], ["Kai Tanaka"]],
    },
    {
        "id": "deadline", "title": "Deadline", "year": 2025,
        "rating": "TV-14", "genres": ["Comedy"], "accent": "#22c55e",
        "synopsis": "A newsroom has 24 hours to break the story of the century, if the coffee machine cooperates.",
        "scenes": [["Isla Monroe"], ["Rex Calloway"], ["Isla Monroe", "Priya Anand"], ["Priya Anand"], ["Rex Calloway", "Isla Monroe"]],
    },
]

# character names per (title, actor) for flavour
CHARACTERS = {
    "uncanny-hollow": {"Nova Quinn": "Sheriff Wren", "Dorian Vale": "The Stranger", "Marcus Cole": "Doc Halloran"},
    "midnight-protocol": {"Rex Calloway": "Byte", "Isla Monroe": "Cipher", "Kai Tanaka": "Root"},
    "love-and-other-bugs": {"Priya Anand": "Mira", "Marcus Cole": "Dev", "Elena Frost": "The Manager"},
    "crown-of-ashes": {"Dorian Vale": "King Alaric", "Elena Frost": "Queen Sable", "Nova Quinn": "Court Seer", "Kai Tanaka": "The Warden"},
    "deadline": {"Isla Monroe": "Editor Reyes", "Rex Calloway": "Rookie", "Priya Anand": "Producer Vega"},
}


def _font(size: int):
    for p in [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Futura.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def download_cast() -> dict[str, Image.Image]:
    os.makedirs(CAST_DIR, exist_ok=True)
    faces: dict[str, Image.Image] = {}
    for name, (g, i) in CAST.items():
        slug = name.lower().replace(" ", "_")
        adir = os.path.join(CAST_DIR, slug)
        os.makedirs(adir, exist_ok=True)
        ref = os.path.join(adir, "ref.jpg")
        if not os.path.exists(ref):
            url = f"https://randomuser.me/api/portraits/{g}/{i}.jpg"
            urllib.request.urlretrieve(url, ref)
        img = Image.open(ref).convert("RGB").resize((360, 360), Image.LANCZOS)
        faces[name] = img
        # headshot for the UI
        hs_dir = os.path.join(TITLES_DIR, "_cast")
        os.makedirs(hs_dir, exist_ok=True)
        img.save(os.path.join(hs_dir, f"{slug}.jpg"), quality=90)
    return faces


def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore


# Static layers precomputed once (independent of frame/title) for speed.
_VIG = Image.new("L", (W, H), 0)
ImageDraw.Draw(_VIG).ellipse([-W * 0.28, -H * 0.28, W * 1.28, H * 1.28], fill=255)
_VIG = _VIG.filter(ImageFilter.GaussianBlur(240))
_DARK = Image.new("RGB", (W, H), (0, 0, 0))

_FACE = 300
_SHADOW = Image.new("RGBA", (_FACE + 64, _FACE + 64), (0, 0, 0, 0))
ImageDraw.Draw(_SHADOW).rounded_rectangle([32, 38, 32 + _FACE, 38 + _FACE], 28, fill=(0, 0, 0, 165))
_SHADOW = _SHADOW.filter(ImageFilter.GaussianBlur(16))


def gradient_bg(top: tuple[int, int, int], accent: tuple[int, int, int]) -> Image.Image:
    # vectorised vertical gradient (once per title)
    grad = np.linspace(1.0, 0.32, H).reshape(H, 1, 1)
    base = (np.array(top, dtype=np.float32).reshape(1, 1, 3) * grad).astype(np.uint8)
    base = np.repeat(base, W, axis=1)
    bg = Image.fromarray(base, "RGB")
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(glow).ellipse([W * 0.5, -H * 0.25, W * 1.3, H * 0.95], fill=accent)
    glow = glow.filter(ImageFilter.GaussianBlur(200))
    return Image.blend(bg, glow, 0.4)


def rounded(img: Image.Image, rad: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0], img.size[1]], rad, fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def render_title(t: dict, faces: dict[str, Image.Image], frames_dir: str) -> None:
    accent = _hex(t["accent"])
    base_top = (16, 16, 24)
    os.makedirs(frames_dir, exist_ok=True)
    fidx = 0
    title_font = _font(84)
    sub_font = _font(30)
    name_font = _font(34)

    bg = gradient_bg(base_top, accent)                       # once per title
    face_sprites = {name: rounded(img.resize((_FACE, _FACE), Image.LANCZOS), 28)
                    for name, img in faces.items()}          # pre-sized once

    def save(frame: Image.Image):
        nonlocal fidx
        frame = Image.composite(frame, _DARK, _VIG)          # cheap C-level vignette
        frame.save(os.path.join(frames_dir, f"f{fidx:04d}.jpg"), quality=86)
        fidx += 1

    # ---- intro title card (~4s, no faces) ----
    for k in range(FPS * 4):
        fr = bg.copy()
        d = ImageDraw.Draw(fr)
        tw = d.textlength(t["title"].upper(), font=title_font)
        y = H * 0.42 + max(0, (1 - k / (FPS * 1.2))) * 20
        d.text((W / 2 - tw / 2, y), t["title"].upper(), font=title_font, fill=(245, 245, 250))
        gtxt = "   ".join(t["genres"]).upper()
        gw = d.textlength(gtxt, font=sub_font)
        d.text((W / 2 - gw / 2, y + 112), gtxt, font=sub_font, fill=accent)
        save(fr)

    # ---- scenes (~4s each) ----
    for scene_actors in t["scenes"]:
        for k in range(FPS * 4):
            prog = k / (FPS * 4)
            fr = bg.copy()
            n = len(scene_actors)
            for j, actor in enumerate(scene_actors):
                sprite = face_sprites[actor]
                slot = (j + 1) / (n + 1)
                cx = int(W * slot + (prog - 0.5) * 26)       # subtle horizontal drift
                cy = int(H * 0.44)
                fr.paste(_SHADOW, (cx - _SHADOW.width // 2, cy - _FACE // 2 - 6 + 4), _SHADOW)
                fr.paste(sprite, (cx - _FACE // 2, cy - _FACE // 2), sprite)
                d = ImageDraw.Draw(fr)
                ch = CHARACTERS.get(t["id"], {}).get(actor)
                base_y = cy + _FACE // 2 + 18
                if ch:
                    d.text((cx - 132, base_y), ch, font=sub_font, fill=(214, 214, 224))
                d.text((cx - 132, base_y + (34 if ch else 0)), actor, font=name_font, fill=accent)
            save(fr)


def encode(frames_dir: str, out_mp4: str) -> None:
    subprocess.check_call([
        "ffmpeg", "-y", "-framerate", str(FPS), "-i", os.path.join(frames_dir, "f%04d.jpg"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_mp4,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> None:
    print("1/4 downloading cast …")
    faces = download_cast()

    print("2/4 loading face engine + enrolling cast …")
    engine = FaceEngine()
    cast = CastIndex(threshold=0.95)
    cast.enroll_dir(engine, CAST_DIR)
    print(f"    enrolled {len(set(cast.names))} actors")

    catalog = []
    for t in TITLES:
        print(f"3/4 [{t['id']}] rendering + ingesting …")
        out_dir = os.path.join(TITLES_DIR, t["id"])
        if os.path.exists(out_dir):
            shutil.rmtree(out_dir)
        os.makedirs(out_dir, exist_ok=True)
        frames_dir = os.path.join(out_dir, "_frames")
        render_title(t, faces, frames_dir)
        clip = os.path.join(out_dir, "clip.mp4")
        encode(frames_dir, clip)
        shutil.rmtree(frames_dir)

        intel = ingest_video(clip, cast, engine, out_dir, sample_fps=3.0)
        write_intelligence(intel, out_dir)

        # merge authored + generated metadata for the catalog
        chars = CHARACTERS.get(t["id"], {})
        slug2name = {n.lower().replace(" ", "_"): n for n in CAST}
        cast_display = [
            {
                "actor": slug2name.get(c["actor"], c["actor"]),
                "character": chars.get(slug2name.get(c["actor"], c["actor"]), ""),
                "slug": c["actor"],
                "screenTimeSec": c["screenTimeSec"],
                "appearances": c["appearances"],
            }
            for c in intel["cast"]
        ]
        catalog.append({
            **{k: t[k] for k in ("id", "title", "year", "rating", "genres", "accent", "synopsis")},
            "durationSec": intel["durationSec"],
            "video": f"/titles/{t['id']}/clip.mp4",
            "backdrop": f"/titles/{t['id']}/{intel['backdrop']}" if intel["backdrop"] else None,
            "thumbnails": [f"/titles/{t['id']}/{th['path']}" for th in intel["thumbnails"]],
            "intro": intel["intro"],
            "scenes": intel["scenes"],
            "cast": cast_display,
        })

    people = {
        n.lower().replace(" ", "_"): {"name": n, "headshot": f"/titles/_cast/{n.lower().replace(' ', '_')}.jpg"}
        for n in CAST
    }
    with open(os.path.join(TITLES_DIR, "catalog.json"), "w") as f:
        json.dump({"titles": catalog, "people": people}, f, indent=2)
    print("4/4 wrote catalog.json with", len(catalog), "titles")


if __name__ == "__main__":
    main()
