#!/usr/bin/env python3
"""Render Visual Compiler manifests to deterministic social PNGs."""

import argparse
import json
import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


CANVAS = {"1:1": (2048, 2048), "3:4": (1800, 2400), "9:16": (1440, 2560)}
Image.MAX_IMAGE_PIXELS = 25_000_000


def font(size, serif=False, bold=False):
    env_name = "HEALTHY_FITNESS_FONT_SERIF" if serif else "HEALTHY_FITNESS_FONT"
    candidates = [
        os.environ.get(env_name),
        r"C:\Windows\Fonts\simsun.ttc" if serif else (r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc"),
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc" if serif else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/System/Library/Fonts/Songti.ttc" if serif else "/System/Library/Fonts/PingFang.ttc",
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def fit(path, size, centering=(0.5, 0.45)):
    if not path or not os.path.exists(path):
        return None
    with Image.open(path) as source:
        return ImageOps.fit(source.convert("RGB"), size, Image.Resampling.LANCZOS, centering=centering)


def rgba(hex_value, alpha=255):
    value = str(hex_value or "#000000").lstrip("#")
    if len(value) != 6 or any(char not in "0123456789abcdefABCDEF" for char in value):
        value = "000000"
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (alpha,)


def paste_panel(canvas, path, box, border, centering=(0.5, 0.45)):
    x, y, width, height = box
    image = fit(path, (width, height), centering)
    draw = ImageDraw.Draw(canvas, "RGBA")
    if image:
        canvas.paste(image, (x, y))
    else:
        draw.rectangle((x, y, x + width, y + height), fill=(255, 255, 255, 18))
    draw.rectangle((x, y, x + width, y + height), outline=border, width=max(2, width // 250))


def footer(draw, width, height, accent, text):
    pad = int(width * 0.07)
    draw.line((pad, int(height * 0.915), width - pad, int(height * 0.915)), fill=accent, width=3)
    draw.text((pad, int(height * 0.94)), "HEALTHY FITNESS COACH", font=font(max(14, int(width * 0.016))), fill=text)


def render_storyboard(canvas, payload, colors):
    width, height = canvas.size
    draw = ImageDraw.Draw(canvas, "RGBA")
    photos = payload.get("photos", [])[:6]
    is_comic = payload.get("recipe") == "motion-comic"
    count = 3 if is_comic and len(photos) == 1 else max(1, len(photos))
    cols = 1 if count <= 2 else 2
    rows = math.ceil(count / cols)
    pad, gap = int(width * 0.06), int(width * 0.018)
    top, area_height = int(height * 0.18), int(height * 0.64)
    panel_width = (width - pad * 2 - gap * (cols - 1)) // cols
    panel_height = (area_height - gap * (rows - 1)) // rows
    draw.line((0, int(height * 0.09), width, int(height * 0.03)), fill=colors[1], width=max(10, int(width * 0.012)))
    draw.text((pad, int(height * 0.08)), payload.get("title", "训练分镜"), font=font(int(width * 0.055), serif=True), fill=colors[3])
    for index in range(count):
        x = pad + (index % cols) * (panel_width + gap)
        y = top + (index // cols) * (panel_height + gap)
        source = photos[index] if index < len(photos) else (photos[0] if photos else None)
        centering = (0.28 + (index % 3) * 0.22, 0.42 + (index % 2) * 0.12) if is_comic else (0.5, 0.45)
        paste_panel(canvas, source, (x, y, panel_width, panel_height), colors[3], centering=centering)
        draw.rectangle((x + 16, y + 16, x + 72, y + 64), fill=colors[1])
        draw.text((x + 28, y + 21), f"{index + 1:02}", font=font(20, bold=True), fill=colors[0])
    if cols == 2 and count % 2:
        x = pad + panel_width + gap
        y = top + (rows - 1) * (panel_height + gap)
        draw.rectangle((x, y, x + panel_width, y + panel_height), fill=colors[3][:-1] + (14,), outline=colors[3][:-1] + (110,), width=3)
        for offset in range(-panel_height, panel_width, max(20, panel_width // 12)):
            draw.line((x + offset, y + panel_height, x + offset + panel_height, y), fill=colors[2][:-1] + (58,), width=3)
        draw.text((x + 34, y + 44), "MOTION", font=font(max(26, panel_width // 11), serif=True), fill=colors[3])
        draw.text((x + 34, y + 44 + max(46, panel_width // 9)), "STUDY", font=font(max(26, panel_width // 11), serif=True), fill=colors[1])
    draw.arc((pad, int(height * 0.80), width - pad, int(height * 0.91)), 190, 346, fill=colors[2], width=max(5, int(width * 0.005)))


def render_sketch_diptych(canvas, payload, colors):
    width, height = canvas.size
    draw = ImageDraw.Draw(canvas, "RGBA")
    photos = payload.get("photos", [])
    pad, gap = int(width * 0.07), int(width * 0.025)
    panel_width = (width - pad * 2 - gap) // 2
    top, panel_height = int(height * 0.13), int(height * 0.64)
    paste_panel(canvas, photos[0] if photos else None, (pad, top, panel_width, panel_height), colors[3])
    derived = payload.get("derived_image")
    if derived:
        paste_panel(canvas, derived, (pad + panel_width + gap, top, panel_width, panel_height), colors[3])
    elif photos:
        source = fit(photos[0], (panel_width, panel_height))
        if source:
            sketch = ImageOps.grayscale(source).filter(ImageFilter.CONTOUR)
            sketch = ImageOps.colorize(sketch, colors[0][:3], colors[3][:3])
            canvas.paste(sketch, (pad + panel_width + gap, top))
    draw.text((pad, int(height * 0.075)), "ORIGINAL / DISTILLED", font=font(int(width * 0.018)), fill=colors[1])
    draw.text((pad, int(height * 0.84)), payload.get("title", "今日训练"), font=font(int(width * 0.052), serif=True), fill=colors[3])
    draw.ellipse((int(width * 0.70), int(height * 0.04), int(width * 0.89), int(height * 0.18)), outline=colors[1], width=max(6, int(width * 0.007)))


def render_risograph(canvas, payload, colors):
    width, height = canvas.size
    draw = ImageDraw.Draw(canvas, "RGBA")
    photos = payload.get("photos", [])
    pad = int(width * 0.08)
    photo = fit(photos[0] if photos else None, (width - pad * 2, int(height * 0.58)))
    if photo:
        gray = ImageOps.autocontrast(ImageOps.grayscale(ImageEnhance.Contrast(photo).enhance(1.35)))
        red = ImageOps.colorize(gray, colors[0][:3], colors[1][:3])
        blue = ImageOps.colorize(gray, colors[0][:3], colors[2][:3])
        canvas.paste(blue, (pad + 12, int(height * 0.12)))
        canvas.paste(Image.blend(red, blue, 0.32), (pad, int(height * 0.12)))
    for y in range(int(height * 0.12), int(height * 0.70), 18):
        for x in range(pad, width - pad, 18):
            if (x + y) // 18 % 3 == 0:
                draw.ellipse((x, y, x + 3, y + 3), fill=colors[3][:-1] + (52,))
    draw.rectangle((pad, int(height * 0.73), width - pad, int(height * 0.87)), fill=colors[1])
    draw.text((pad + 24, int(height * 0.755)), payload.get("title", "训练小志"), font=font(int(width * 0.052), serif=True), fill=colors[0])
    draw.text((width - pad, int(height * 0.10)), "RISO / TRAINING", anchor="ra", font=font(int(width * 0.018)), fill=colors[2])


def render_symbol_lab(canvas, payload, colors):
    width, height = canvas.size
    draw = ImageDraw.Draw(canvas, "RGBA")
    photos = payload.get("photos", [])
    pad = int(width * 0.07)
    photo_width = int(width * 0.54)
    paste_panel(canvas, photos[0] if photos else None, (pad, int(height * 0.11), photo_width, int(height * 0.70)), colors[3])
    motifs = payload.get("motifs", []) or [{"id": "training-rhythm"}]
    center_x = int(width * 0.77)
    for index, motif in enumerate(motifs[:4]):
        center_y = int(height * (0.22 + index * 0.15))
        motif_id = str(motif.get("id", ""))
        if motif_id in {"halo-cycle", "concentric-load"}:
            draw.ellipse((center_x - 82, center_y - 82, center_x + 82, center_y + 82), outline=colors[1], width=9)
            draw.ellipse((center_x - 42, center_y - 42, center_x + 42, center_y + 42), outline=colors[2], width=5)
        else:
            draw.line((center_x - 84, center_y, center_x + 84, center_y), fill=colors[1], width=9)
            draw.line((center_x, center_y - 84, center_x, center_y + 84), fill=colors[1], width=9)
            draw.rectangle((center_x - 48, center_y - 48, center_x + 48, center_y + 48), outline=colors[2], width=5)
    draw.text((center_x, int(height * 0.09)), "OBSERVED / ENCODED", anchor="ma", font=font(int(width * 0.016)), fill=colors[3][:-1] + (170,))
    draw.text((pad, int(height * 0.86)), payload.get("title", "健身符号实验室"), font=font(int(width * 0.05), serif=True), fill=colors[3])


def render_minimal_trajectory(canvas, payload, colors):
    width, height = canvas.size
    draw = ImageDraw.Draw(canvas, "RGBA")
    photos = payload.get("photos", [])
    photo = fit(photos[0] if photos else None, (width, height))
    if photo:
        canvas.paste(ImageEnhance.Brightness(photo).enhance(0.58), (0, 0))
    draw.rectangle((0, 0, width, height), fill=colors[0][:-1] + (70,))
    pad = int(width * 0.09)
    draw.rectangle((pad, int(height * 0.08), width - pad, int(height * 0.84)), outline=colors[3][:-1] + (150,), width=3)
    points = [(pad, int(height * 0.72)), (int(width * 0.30), int(height * 0.48)), (int(width * 0.56), int(height * 0.65)), (width - pad, int(height * 0.31))]
    draw.line(points, fill=colors[1], width=max(7, int(width * 0.008)), joint="curve")
    draw.ellipse((points[-1][0] - 14, points[-1][1] - 14, points[-1][0] + 14, points[-1][1] + 14), fill=colors[1])
    draw.text((pad, int(height * 0.15)), payload.get("title", "保持轨迹"), font=font(int(width * 0.055), serif=True), fill=colors[3])


def weekly_values(payload):
    return [max(0.0, float(item.get("estimated_volume") or item.get("training_days") or 0)) for item in payload.get("trends", {}).get("weekly", [])]


def render_rings(canvas, payload, colors):
    width, height = canvas.size
    draw = ImageDraw.Draw(canvas, "RGBA")
    values = weekly_values(payload) or [0]
    maximum = max(1.0, *values)
    center = (width // 2, int(height * 0.48))
    for index, value in enumerate(values[:14]):
        radius = int(width * (0.09 + index * 0.024))
        box = (center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius)
        draw.arc(box, -90, -90 + 340 * value / maximum, fill=colors[1 if index % 2 == 0 else 2], width=max(5, int(width * 0.007)))
    draw.text((width // 2, int(height * 0.12)), payload.get("title", "训练年轮"), anchor="ma", font=font(int(width * 0.058), serif=True), fill=colors[3])
    draw.text(center, f"{len(values)} WEEKS", anchor="mm", font=font(int(width * 0.028)), fill=colors[3])


def render_terrain(canvas, payload, colors):
    width, height = canvas.size
    draw = ImageDraw.Draw(canvas, "RGBA")
    values = weekly_values(payload) or [0, 0]
    maximum = max(1.0, *values)
    left, right, top, bottom = int(width * 0.08), int(width * 0.92), int(height * 0.25), int(height * 0.76)
    points = [(int(left + index * (right - left) / max(1, len(values) - 1)), int(bottom - (bottom - top) * value / maximum)) for index, value in enumerate(values)]
    for offset, alpha in ((0, 255), (28, 180), (56, 110), (84, 60)):
        draw.line([(x, y + offset) for x, y in points], fill=colors[1][:-1] + (alpha,), width=max(3, int(width * 0.006)), joint="curve")
    draw.text((left, int(height * 0.13)), payload.get("title", "力量地形"), font=font(int(width * 0.06), serif=True), fill=colors[3])


def render_fingerprint(canvas, payload, colors):
    width, height = canvas.size
    draw = ImageDraw.Draw(canvas, "RGBA")
    values = weekly_values(payload)
    count = max(18, len(values) * 3)
    for index in range(count):
        value = values[index % len(values)] if values else index % 5
        rx = int(width * (0.1 + index * 0.012))
        ry = int(height * (0.07 + index * 0.008 + min(8, value) * 0.002))
        box = (width // 2 - rx, int(height * 0.51) - ry, width // 2 + rx, int(height * 0.51) + ry)
        draw.arc(box, 188 + index % 8, 520 - index % 11, fill=colors[1 if index % 3 == 0 else 3][:-1] + (80 + int(index / count * 160),), width=3)
    draw.text((width // 2, int(height * 0.12)), payload.get("title", "动作指纹"), anchor="ma", font=font(int(width * 0.058), serif=True), fill=colors[3])


def render_constellation(canvas, payload, colors):
    width, height = canvas.size
    draw = ImageDraw.Draw(canvas, "RGBA")
    items = payload.get("trends", {}).get("exercise_frequency", [])[:9] or [{"name": "暂无数据", "count": 0}]
    maximum = max(1.0, *(float(item.get("count", 0) or 0) for item in items))
    points = []
    for index, item in enumerate(items):
        angle = -math.pi / 2 + math.pi * 2 * index / len(items)
        value = float(item.get("count", 0) or 0)
        radius = width * (0.18 + value / maximum * 0.18)
        points.append((int(width * 0.5 + math.cos(angle) * radius), int(height * 0.52 + math.sin(angle) * radius), item, value))
    for index, (x, y, _, _) in enumerate(points):
        next_x, next_y = points[(index + 1) % len(points)][:2]
        draw.line((x, y, next_x, next_y), fill=colors[2][:-1] + (110,), width=3)
    for x, y, item, value in points:
        radius = int(12 + value * 2)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=colors[1])
        draw.text((x, y + radius + 20), str(item.get("name", "")), anchor="ma", font=font(max(14, int(width * 0.015))), fill=colors[3])
    draw.text((width // 2, int(height * 0.12)), payload.get("title", "肌群星座"), anchor="ma", font=font(int(width * 0.058), serif=True), fill=colors[3])


def render_data_atlas(canvas, payload, colors):
    width, height = canvas.size
    draw = ImageDraw.Draw(canvas, "RGBA")
    pad = int(width * 0.08)
    draw.text((pad, int(height * 0.08)), "TRAINING / RECORDED", font=font(int(width * 0.016)), fill=colors[1])
    draw.text((pad, int(height * 0.14)), payload.get("title", "训练数据图谱"), font=font(int(width * 0.055), serif=True), fill=colors[3])
    for index, metric in enumerate(payload.get("metrics", [])[:4]):
        x = pad + (index % 2) * int(width * 0.44)
        y = int(height * (0.24 + (index // 2) * 0.09))
        draw.text((x, y), str(metric.get("label", "")), font=font(int(width * 0.016)), fill=colors[3][:-1] + (140,))
        draw.text((x, y + int(width * 0.03)), str(metric.get("value", "")), font=font(int(width * 0.034), serif=True), fill=colors[3])
    values = weekly_values(payload)
    left, right, top, bottom = pad, width - pad, int(height * 0.44), int(height * 0.68)
    draw.rounded_rectangle((left, top, right, bottom), radius=20, outline=colors[3][:-1] + (60,), width=3)
    if len(values) >= 2:
        maximum = max(1.0, *values)
        points = [(int(left + index * (right - left) / (len(values) - 1)), int(bottom - 40 - (bottom - top - 80) * value / maximum)) for index, value in enumerate(values)]
        draw.line(points, fill=colors[1], width=max(6, int(width * 0.006)), joint="curve")
    else:
        draw.text(((left + right) // 2, (top + bottom) // 2), "暂无足够趋势数据", anchor="mm", font=font(int(width * 0.022)), fill=colors[3][:-1] + (130,))
    draw.text((pad, int(height * 0.77)), "事实优先，持续记录。", font=font(int(width * 0.026), serif=True), fill=colors[3][:-1] + (180,))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ratio", choices=CANVAS, default="3:4")
    args = parser.parse_args()
    with open(args.input, "r", encoding="utf-8-sig") as source:
        payload = json.load(source)
    width, height = CANVAS[args.ratio]
    recipe = payload.get("recipe", "sketch-diptych" if payload.get("photos") else "training-rings")
    themes = {
        "risograph-zine": ("#F2E8D5", "#F2573F", "#2453A6", "#171717"),
        "multi-photo-storyboard": ("#181514", "#FFDF59", "#FF6A4D", "#F8F0E4"),
        "training-rings": ("#10141D", "#D7FF4B", "#7E8CFF", "#F6F7F2"),
        "strength-terrain": ("#1A1616", "#FF714F", "#F0C36A", "#F7EEE5"),
        "action-fingerprint": ("#0E2022", "#75E6DA", "#FF8066", "#F4EEE3"),
        "muscle-constellation": ("#12142A", "#D7FF4B", "#7E8CFF", "#F6F7F2"),
        "data-atlas": ("#F4EFE6", "#E85D4A", "#2E62D2", "#181818"),
    }
    theme = themes.get(recipe, ("#111315", "#FF6A4D", "#75E6DA", "#F6F1E8"))
    colors = tuple(rgba(value) for value in theme)
    canvas = Image.new("RGBA", (width, height), colors[0])
    if recipe in {"multi-photo-storyboard", "motion-comic"}:
        render_storyboard(canvas, payload, colors)
    elif recipe == "risograph-zine":
        render_risograph(canvas, payload, colors)
    elif recipe == "symbol-lab":
        render_symbol_lab(canvas, payload, colors)
    elif recipe == "minimal-trajectory":
        render_minimal_trajectory(canvas, payload, colors)
    elif recipe == "strength-terrain":
        render_terrain(canvas, payload, colors)
    elif recipe == "action-fingerprint":
        render_fingerprint(canvas, payload, colors)
    elif recipe == "muscle-constellation":
        render_constellation(canvas, payload, colors)
    elif recipe == "data-atlas":
        render_data_atlas(canvas, payload, colors)
    elif recipe == "training-rings":
        render_rings(canvas, payload, colors)
    else:
        render_sketch_diptych(canvas, payload, colors)
    footer(ImageDraw.Draw(canvas, "RGBA"), width, height, colors[1], colors[3][:-1] + (150,))
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(args.output, "PNG", optimize=True)
    print(json.dumps({"output": os.path.abspath(args.output), "recipe": recipe, "ratio": args.ratio}, ensure_ascii=False))


if __name__ == "__main__":
    main()
