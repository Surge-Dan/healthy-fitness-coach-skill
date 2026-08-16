#!/usr/bin/env python3
"""Extract non-identifying Visual DNA 2.0 signals from a local image.

The extractor never uploads the image and performs no OCR, face recognition,
identity inference, attractiveness rating, or body scoring.
"""

import json
import math
import sys
from collections import Counter


def rgb_hex(rgb):
    return "#%02X%02X%02X" % tuple(max(0, min(255, int(channel))) for channel in rgb)


def luminance(rgb):
    red, green, blue = [channel / 255 for channel in rgb]
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def quantized_palette(pixels, limit=5):
    if not pixels:
        return []
    counts = Counter((red // 32 * 32 + 16, green // 32 * 32 + 16, blue // 32 * 32 + 16) for red, green, blue in pixels)
    return [rgb_hex(color) for color, _ in counts.most_common(limit)]


def crop_pixels(image, box):
    return list(image.crop(box).getdata())


def variance(values):
    if not values:
        return 1.0
    average = sum(values) / len(values)
    return sum((value - average) ** 2 for value in values) / len(values)


def region_metrics(image):
    width, height = image.size
    x1, x2 = max(1, width // 3), max(2, width * 2 // 3)
    y1, y2 = max(1, height // 3), max(2, height * 2 // 3)
    boxes = {
        "top": (0, 0, width, y1),
        "center": (x1, y1, x2, y2),
        "bottom": (0, y2, width, height),
        "left": (0, 0, x1, height),
        "right": (x2, 0, width, height),
        "top-left": (0, 0, x1, y1),
        "top-right": (x2, 0, width, y1),
        "bottom-left": (0, y2, x1, height),
        "bottom-right": (x2, y2, width, height),
    }
    output = {}
    for name, box in boxes.items():
        pixels = crop_pixels(image, box)
        lum = [luminance(pixel) for pixel in pixels]
        output[name] = {
            "palette": quantized_palette(pixels, 3),
            "variance": variance(lum),
            "luminance": sum(lum) / len(lum) if lum else 0,
        }
    return output


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: extract-style.py IMAGE_PATH")
    try:
        from PIL import Image
    except ImportError as error:
        raise SystemExit("Pillow is required for local image style extraction; use the preset fallback when unavailable") from error
    Image.MAX_IMAGE_PIXELS = 25_000_000

    with Image.open(sys.argv[1]) as source:
        source_width, source_height = source.size
        image = source.convert("RGB")
        image.thumbnail((192, 192))
        pixels = list(image.getdata())

    if not pixels:
        raise SystemExit("image contains no pixels")

    palette = quantized_palette(pixels, 6)
    luminances = [luminance(pixel) for pixel in pixels]
    average = sum(luminances) / len(luminances)
    contrast_value = math.sqrt(variance(luminances))
    differences = []
    horizontal_edges = 0.0
    vertical_edges = 0.0
    width, height = image.size
    column_energy = [0.0] * width
    row_energy = [0.0] * height
    for y in range(height):
        for x in range(width - 1):
            left = image.getpixel((x, y))
            right = image.getpixel((x + 1, y))
            edge = sum(abs(a - b) for a, b in zip(left, right)) / 765
            differences.append(edge)
            horizontal_edges += edge
            row_energy[y] += edge
    for y in range(height - 1):
        for x in range(width):
            top = image.getpixel((x, y))
            bottom = image.getpixel((x, y + 1))
            edge = sum(abs(a - b) for a, b in zip(top, bottom)) / 765
            vertical_edges += edge
            column_energy[x] += edge

    texture_score = sum(differences) / len(differences) if differences else 0
    texture = "fine_grain" if texture_score > 0.08 else "clean"
    warm = sum(pixel[0] - pixel[2] for pixel in pixels) / len(pixels) > 12
    lighting = "warm_high_key" if average >= 0.62 and warm else "cool_low_key" if average < 0.38 and not warm else "neutral_soft"
    edge_rhythm = "horizontal" if horizontal_edges > vertical_edges * 1.15 else "vertical" if vertical_edges > horizontal_edges * 1.15 else "mixed"
    regions = region_metrics(image)
    safe_zones = sorted(
        ({"id": name, "score": round(max(0.0, min(1.0, 1 - item["variance"] * 8)), 3)} for name, item in regions.items() if name in {"top-left", "top-right", "bottom-left", "bottom-right"}),
        key=lambda item: item["score"],
        reverse=True,
    )
    focal_column = max(range(width), key=lambda index: column_energy[index]) if width else 0
    focal_row = max(range(height), key=lambda index: row_energy[index]) if height else 0
    horizontal_position = "left" if focal_column < width / 3 else "right" if focal_column > width * 2 / 3 else "center"
    vertical_position = "top" if focal_row < height / 3 else "bottom" if focal_row > height * 2 / 3 else "middle"
    focal_region = f"{vertical_position}-{horizontal_position}"
    negative_space = safe_zones[0]["id"] if safe_zones else "unknown"
    divisor = math.gcd(source_width, source_height) or 1
    aspect_ratio = f"{source_width // divisor}:{source_height // divisor}"
    orientation = "landscape" if source_width > source_height else "portrait" if source_height > source_width else "square"
    region_palettes = {name: value["palette"] for name, value in regions.items() if name in {"top", "center", "bottom", "left", "right"}}
    visual_facts = [
        f"palette:{','.join(palette[:3])}",
        f"edge_rhythm:{edge_rhythm}",
        f"negative_space:{negative_space}",
        f"focal_region:{focal_region}",
        f"texture:{texture}",
    ]
    output = {
        "visual_dna_version": "2.0",
        "source": "image",
        "privacy": {"biometric_analysis": False, "face_recognition": False, "identity_inference": False},
        "image": {"width": source_width, "height": source_height, "aspect_ratio": aspect_ratio, "orientation": orientation},
        "palette": palette,
        "region_palettes": region_palettes,
        "luminance": "high" if average >= 0.62 else "low" if average < 0.38 else "mid",
        "contrast": "high" if contrast_value >= 0.18 else "soft",
        "texture": texture,
        "texture_score": round(texture_score, 4),
        "lighting": lighting,
        "composition": f"focal_{focal_region}_text_{negative_space}",
        "edge_rhythm": edge_rhythm,
        "focal_region": focal_region,
        "negative_space": negative_space,
        "safe_zones": safe_zones,
        "visual_facts": visual_facts,
        "confidence": round(min(0.95, max(0.55, 0.56 + min(0.2, len(palette) * 0.035) + min(0.15, contrast_value))), 2),
    }
    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
