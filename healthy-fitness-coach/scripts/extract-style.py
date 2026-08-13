#!/usr/bin/env python3
"""Extract a compact, non-identifying visual style signal from a user image.

The output intentionally contains abstract color/light/texture signals only.
It does not perform face recognition, OCR, logo detection, or image upload.
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


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: extract-style.py IMAGE_PATH")
    try:
        from PIL import Image
    except ImportError as error:
        raise SystemExit("Pillow is required for local image style extraction; use the preset fallback when unavailable") from error
    Image.MAX_IMAGE_PIXELS = 25_000_000

    with Image.open(sys.argv[1]) as source:
        image = source.convert("RGB")
        image.thumbnail((64, 64))
        pixels = list(image.getdata())

    if not pixels:
        raise SystemExit("image contains no pixels")

    quantized = Counter((red // 32 * 32 + 16, green // 32 * 32 + 16, blue // 32 * 32 + 16) for red, green, blue in pixels)
    palette = [rgb_hex(color) for color, _ in quantized.most_common(5)]
    luminances = [luminance(pixel) for pixel in pixels]
    average = sum(luminances) / len(luminances)
    variance = sum((value - average) ** 2 for value in luminances) / len(luminances)
    contrast = "high" if math.sqrt(variance) >= 0.18 else "soft"
    differences = []
    width, height = image.size
    for y in range(height):
        for x in range(width - 1):
            left = image.getpixel((x, y))
            right = image.getpixel((x + 1, y))
            differences.append(sum(abs(a - b) for a, b in zip(left, right)) / 765)
    texture = "fine_grain" if differences and sum(differences) / len(differences) > 0.08 else "clean"
    warm = sum(pixel[0] - pixel[2] for pixel in pixels) / len(pixels) > 12
    lighting = "warm_high_key" if average >= 0.62 and warm else "cool_low_key" if average < 0.38 and not warm else "neutral_soft"
    output = {
        "source": "image",
        "palette": palette,
        "luminance": "high" if average >= 0.62 else "low" if average < 0.38 else "mid",
        "contrast": contrast,
        "texture": texture,
        "lighting": lighting,
        "composition": "subject_center_text_top",
        "confidence": round(min(0.95, max(0.55, 0.55 + min(0.4, len(palette) * 0.07))), 2),
    }
    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
