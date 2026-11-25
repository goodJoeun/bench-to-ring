"""Rebuild the Canvas poses: python scripts/trace-cover.py <source-directory>

Offline dependencies: Pillow, numpy, opencv-python-headless.
"""
import argparse
import gzip
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/features/create/coverPoses.generated.json"
# First row of the stationary legs or bench. Draw it once for all six poses.
SPLITS = {"bench": 133, "debut": 199, "champ": 224, "nba": 215, "mvp": 199}


def outline(mask, top):
    # Trace at twice the resolution to preserve half-pixel eye and fabric details.
    enlarged = cv2.resize(mask.astype("uint8") * 255, None, fx=2, fy=2, interpolation=cv2.INTER_LINEAR)
    contours, _ = cv2.findContours((enlarged > 85).astype("uint8"), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    subpaths = []
    for contour in contours:
        if cv2.contourArea(contour) < 5:
            continue
        polygon = cv2.approxPolyDP(contour, 1.2, True)[:, 0, :]
        if len(polygon) < 3:
            continue
        x, y = polygon[0]
        steps = " ".join(f"{dx},{dy}" for dx, dy in np.diff(polygon, axis=0))
        subpaths.append(f"M{x},{y+2*top}l{steps}z")
    return "".join(subpaths)


def paint_order(colors, weights):
    # Merge adjacent tones into a paint hierarchy. The broad skin and cloth areas
    # sit underneath their highlights, so thin details don't expose dark seams.
    lab = cv2.cvtColor(colors[None].astype("float32") / 255, cv2.COLOR_RGB2LAB)[0]
    clusters = [([i], i, [], lab[i], int(n)) for i, n in enumerate(weights) if n]
    while len(clusters) > 1:
        _, a, b = min((np.linalg.norm(x[3]-y[3]), a, b)
                      for a, x in enumerate(clusters) for b, y in enumerate(clusters[:a]))
        left, right = clusters.pop(a), clusters.pop(b)
        if left[4] < right[4]:
            left, right = right, left
        count = left[4] + right[4]
        center = (left[3]*left[4] + right[3]*right[4]) / count
        layers = [(right[0], right[1]), *left[2], *right[2]]
        clusters.append((left[0]+right[0], left[1], layers, center, count))
    members, base, layers, _, _ = clusters[0]
    return [(members, base), *layers]


def trace(image, palette, order, top=0):
    visible = np.asarray(image.getchannel("A")) > 110
    indices = np.asarray(image.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE))
    colors = np.asarray(palette.getpalette(), dtype="uint8").reshape(-1, 3)
    layers = []
    for members, index in order:
        pixels = visible & np.isin(indices, members)
        if not pixels.any():
            continue
        path = outline(pixels, top)
        if path:
            layers.append(["#" + colors[index].tobytes().hex(), path])
    return layers


def build_stage(source_directory, stage, split):
    frames, durations = [], []
    with Image.open(source_directory / f"{stage}-look.webp") as source:
        width, height = (round(v * 0.85) for v in source.size)
        split = round(split * height / source.height)
        for i in range(source.n_frames):
            source.seek(i)
            frames.append(source.convert("RGBA").resize((width, height), Image.Resampling.LANCZOS))
            durations.append(source.info["duration"])
    # Learn a shared palette from opaque pixels only, including the fine dark ink.
    samples = np.concatenate([np.asarray(f)[np.asarray(f)[:, :, 3] > 220, :3] for f in frames])
    swatches = Image.fromarray(samples[:len(samples)//128*128].reshape(-1, 128, 3))
    palette = swatches.quantize(colors=24, dither=Image.Dither.NONE)
    colors = np.asarray(palette.getpalette(), dtype="uint8").reshape(-1, 3)
    weights = np.bincount(np.asarray(palette).ravel(), minlength=len(colors))
    order = paint_order(colors, weights)
    return {
        "width": width*2, "height": height*2, "durations": durations,
        "base": trace(frames[-1].crop((0, split, width, height)), palette, order, split),
        "poses": [trace(frame.crop((0, 0, width, split+1)), palette, order) for frame in frames],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Trace source animations into Canvas poses.")
    parser.add_argument("source_directory", type=Path, help="Directory containing the five *-look.webp animations.")
    args = parser.parse_args()
    stages = {stage: build_stage(args.source_directory, stage, split) for stage, split in SPLITS.items()}
    data = json.dumps(stages, separators=(",", ":")).encode()
    OUTPUT.write_bytes(data + b"\n")
    print(f"{OUTPUT.name}: {len(data):,} bytes, {len(gzip.compress(data)):,} bytes gzipped")
