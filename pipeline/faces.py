"""Face detection + recognition — the recognition core of SceneIQ.

Wraps MTCNN (detection/alignment) and InceptionResnetV1/vggface2 (512-d
embeddings). A CastIndex holds enrolled reference embeddings per actor and
matches detected faces by nearest cosine/L2 distance.
"""

from __future__ import annotations

import glob
import os
import warnings
from dataclasses import dataclass

import numpy as np
import torch
from PIL import Image

warnings.filterwarnings("ignore")
torch.set_grad_enabled(False)

_DEVICE = torch.device("cpu")


@dataclass
class Detection:
    box: tuple[int, int, int, int]  # x, y, w, h (pixels)
    prob: float
    embedding: np.ndarray


class FaceEngine:
    def __init__(self) -> None:
        from facenet_pytorch import MTCNN, InceptionResnetV1

        os.environ.setdefault("TORCH_HOME", os.path.expanduser("~/.cache/torch"))
        self.mtcnn = MTCNN(
            image_size=160, margin=14, min_face_size=24,
            thresholds=[0.6, 0.7, 0.7], keep_all=True, device=_DEVICE, post_process=True,
        )
        self.resnet = InceptionResnetV1(pretrained="vggface2", device=_DEVICE).eval()

    def detect(self, img: Image.Image) -> list[Detection]:
        boxes, probs = self.mtcnn.detect(img)
        if boxes is None:
            return []
        faces = self.mtcnn.extract(img, boxes, save_path=None)
        if faces is None:
            return []
        embs = self.resnet(faces).detach().cpu().numpy()
        out: list[Detection] = []
        for box, prob, emb in zip(boxes, probs, embs):
            if prob is None or prob < 0.9:
                continue
            x1, y1, x2, y2 = [int(round(v)) for v in box]
            out.append(Detection(
                box=(x1, y1, max(1, x2 - x1), max(1, y2 - y1)),
                prob=float(prob),
                embedding=emb / (np.linalg.norm(emb) + 1e-8),
            ))
        return out

    def embed_path(self, path: str) -> np.ndarray | None:
        img = Image.open(path).convert("RGB")
        boxes, probs = self.mtcnn.detect(img)
        if boxes is None:
            return None
        faces = self.mtcnn.extract(img, boxes[:1], save_path=None)
        if faces is None:
            return None
        emb = self.resnet(faces[:1]).detach().cpu().numpy()[0]
        return emb / (np.linalg.norm(emb) + 1e-8)


class CastIndex:
    """Enrolled reference embeddings, one or more per actor."""

    def __init__(self, threshold: float = 0.9) -> None:
        self.threshold = threshold  # max L2 distance to accept a match
        self.names: list[str] = []
        self.embs: list[np.ndarray] = []

    def enroll(self, name: str, emb: np.ndarray) -> None:
        self.names.append(name)
        self.embs.append(emb)

    def enroll_dir(self, engine: FaceEngine, cast_dir: str) -> list[str]:
        """Each subfolder of cast_dir is an actor; images inside are references."""
        enrolled = []
        for actor_dir in sorted(glob.glob(os.path.join(cast_dir, "*"))):
            if not os.path.isdir(actor_dir):
                continue
            name = os.path.basename(actor_dir)
            for img_path in sorted(glob.glob(os.path.join(actor_dir, "*.jpg"))):
                emb = engine.embed_path(img_path)
                if emb is not None:
                    self.enroll(name, emb)
            enrolled.append(name)
        return enrolled

    def match(self, emb: np.ndarray) -> tuple[str | None, float]:
        if not self.embs:
            return None, 0.0
        dists = [float(np.linalg.norm(emb - e)) for e in self.embs]
        i = int(np.argmin(dists))
        d = dists[i]
        if d > self.threshold:
            return None, max(0.0, 1.0 - d / 2.0)
        conf = max(0.0, min(1.0, 1.0 - d / self.threshold * 0.6))
        return self.names[i], round(conf, 3)
