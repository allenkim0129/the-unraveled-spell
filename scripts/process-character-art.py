"""Segment and align the approved serious character art without repainting it."""

import argparse
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from rembg import new_session, remove
from scipy import ndimage


def clean_alpha(image):
    pixels = np.array(image.convert("RGBA")).copy()
    alpha = pixels[:, :, 3]
    labels, count = ndimage.label(alpha > 20)
    sizes = np.bincount(labels.ravel())
    if not count:
        raise ValueError("Empty foreground mask")
    primary = labels == (np.argmax(sizes[1:]) + 1)
    keep = primary.copy()
    nearby = ndimage.binary_dilation(primary, iterations=6)
    # Expanded crops may include a neighboring row's clipped head/boots, not part of this subject.
    for label in range(1, count + 1):
        component = labels == label
        touches_edge = component[0].any() or component[-1].any() or component[:, 0].any() or component[:, -1].any()
        if sizes[label] >= 18 and not touches_edge and (component & nearby).any():
            keep |= component
    alpha[~ndimage.binary_dilation(keep, iterations=1)] = 0
    alpha[alpha < 8] = 0
    solid = alpha >= 240
    if not solid.any():
        raise ValueError("No solid foreground in a character frame")
    # Soft edge RGB must come from the subject, not the generated opaque backdrop.
    distance, indices = ndimage.distance_transform_edt(~solid, return_indices=True)
    edge = (alpha > 0) & (alpha < 240) & (distance <= 4)
    pixels[edge, :3] = pixels[indices[0], indices[1], :3][edge]
    pixels[:, :, 3] = alpha
    pixels[alpha == 0, :3] = 0
    return Image.fromarray(pixels)


def center_x(frame, creature=False):
    alpha = np.array(frame.getchannel("A"))
    left, top, right, bottom = frame.getchannel("A").getbbox()
    start, end = (0.94, 0.99) if creature else (0.55, 0.72)
    band = alpha[top + int((bottom - top) * start):top + int((bottom - top) * end)]
    _, xs = np.where(band > 128)
    return float(np.median(xs)) if len(xs) else (left + right) / 2


def write_atlas(rows, path, creature=False):
    width, height, foot = (320 if creature else 256), 288, 276
    frames = [frame for row in rows for frame in row]
    boxes = [frame.getchannel("A").getbbox() for frame in frames]
    centers = [center_x(frame, creature) for frame in frames]
    if any(box is None for box in boxes):
        raise ValueError(f"Empty frame: {path}")
    heights = [box[3] - box[1] for box in boxes]
    extent = max(max(center - box[0], box[2] - center) for center, box in zip(centers, boxes))
    scale = min(228 / float(np.median(heights)), (width / 2 - 12) / extent, (foot - 12) / max(heights))
    sheet = Image.new("RGBA", (width * len(rows[0]), height * len(rows)))
    for row_index, row in enumerate(rows):
        for col_index, frame in enumerate(row):
            box = frame.getchannel("A").getbbox()
            center = center_x(frame, creature)
            resized = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
            x, y = round(width / 2 - center * scale), round(foot - box[3] * scale)
            bounds = resized.getchannel("A").getbbox()
            if x + bounds[0] < 3 or x + bounds[2] > width - 3 or y + bounds[1] < 3 or y + bounds[3] > height - 3:
                raise ValueError(f"Clipped frame: {path.name} {row_index}/{col_index}")
            tile = Image.new("RGBA", (width, height))
            tile.alpha_composite(resized, (x, y))
            sheet.alpha_composite(tile, (col_index * width, row_index * height))
    sheet.save(path, optimize=True)
    print("Prepared", path.name, sheet.size, flush=True)


def extract(path, bounds, cache, session, opaque, margin=0, model="isnet-general-use", padding=0):
    image = Image.open(path).convert("RGBA")
    directory = cache / hashlib.sha256(path.read_bytes()).hexdigest()[:16] / (model if opaque else "native-alpha") / f"owner-padded-{padding}"
    directory.mkdir(parents=True, exist_ok=True)
    rows = []
    for row in range(len(bounds) - 1):
        rows.append([])
        for col in range(4):
            saved = directory / f"{row}-{col}.png"
            if saved.exists():
                frame = clean_alpha(Image.open(saved).convert("RGBA"))
            else:
                frame = image.crop((max(0, round(col * image.width / 4) - margin), max(0, bounds[row] - padding),
                                    min(image.width, round((col + 1) * image.width / 4) + margin),
                                    min(image.height, bounds[row + 1] + padding)))
                if opaque:
                    frame = remove(frame.convert("RGB"), session=session)
                frame = clean_alpha(frame)
                frame.save(saved)
            rows[row].append(frame)
            print("Extracted", path.name, row, col, flush=True)
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("protagonists", type=Path)
    parser.add_argument("supporting", type=Path)
    parser.add_argument("familiars", type=Path)
    parser.add_argument("--cache", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path("public/characters"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    session = new_session("isnet-general-use", providers=["CPUExecutionProvider"])
    players = extract(args.protagonists, [0, 205, 398, 590, 780, 968, 1160, 1348, 1536],
                      args.cache, session, opaque=True, padding=18)
    boy, girl = players[:4], players[4:]
    boy[2][0] = ImageOps.mirror(boy[1][0])
    boy[2][1] = ImageOps.mirror(boy[1][1])
    girl[2][0] = ImageOps.mirror(girl[1][0])
    girl[2][1] = ImageOps.mirror(girl[1][1])
    girl[1][2] = ImageOps.mirror(girl[2][2])
    girl[1][3] = ImageOps.mirror(girl[2][3])
    write_atlas(boy, args.output / "student-boy.png")
    write_atlas(girl, args.output / "student-girl.png")
    supporting = Image.open(args.supporting)
    bounds = [round(i * supporting.height / 4) for i in range(5)]
    people = extract(args.supporting, bounds, args.cache, session, opaque=False)
    for row, name in [(0, "fire-caster"), (1, "motion-caster")]:
        write_atlas([[frame] for frame in people[row]], args.output / f"{name}.png")
    for row, name in [(2, "friend"), (3, "background-student")]:
        front = people[row]
        left = [front[0], front[1], ImageOps.mirror(front[2]), front[3]]
        right = [front[0], ImageOps.mirror(front[1]), front[2], front[3]]
        write_atlas([front, left, right], args.output / f"{name}.png")
    creature_session = new_session("isnet-anime", providers=["CPUExecutionProvider"])
    creatures = extract(args.familiars, [0, 274, 535, 791, 1044, 1282, 1536],
                        args.cache, creature_session, opaque=True, margin=12, model="isnet-anime")
    for row, name in [(4, "mint-familiar"), (5, "lavender-familiar")]:
        write_atlas([creatures[row]], args.output / f"{name}.png", creature=True)


if __name__ == "__main__":
    main()
