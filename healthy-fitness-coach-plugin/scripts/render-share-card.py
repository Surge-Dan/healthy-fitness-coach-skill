#!/usr/bin/env python3
"""Render a deterministic PNG share card without requiring an image model."""

import argparse
import json
import os
import re
import textwrap

from PIL import Image, ImageDraw, ImageFont, ImageOps


CANVAS = {"1:1": (2048, 2048), "9:16": (1440, 2560), "3:4": (1800, 2400)}
PALETTE_THEMES = {
    "acid-night": {"bg": "#17191D", "accent": "#D7FF4B", "secondary": "#7A8BFF", "text": "#F6F7F2", "muted": "#A9B0AA"},
    "cobalt-coral": {"bg": "#101A2E", "accent": "#5BE7C4", "secondary": "#FF8066", "text": "#F4F7FF", "muted": "#A6B2C8"},
    "ultraviolet": {"bg": "#1B1636", "accent": "#FF6BD6", "secondary": "#7EE7FF", "text": "#FAF7FF", "muted": "#BDB5D8"},
    "paper-ink": {"bg": "#F4EFE6", "accent": "#E85D4A", "secondary": "#2E62D2", "text": "#14171A", "muted": "#667078"},
    "ember-steel": {"bg": "#242424", "accent": "#FF8A4C", "secondary": "#D5D0C7", "text": "#F7F4ED", "muted": "#AAA49B"},
}
Image.MAX_IMAGE_PIXELS = 25_000_000


def color(value, fallback):
    value = str(value or "")
    if re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
        return value.upper()
    return fallback


def font(size, bold=False, serif=False):
    candidates = [
        os.environ.get("HEALTHY_FITNESS_FONT_SERIF_BOLD" if serif and bold else "HEALTHY_FITNESS_FONT_SERIF" if serif else "HEALTHY_FITNESS_FONT_BOLD" if bold else "HEALTHY_FITNESS_FONT"),
        (r"C:\Windows\Fonts\simsunb.ttf" if bold else r"C:\Windows\Fonts\simsun.ttc") if serif else (r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc"),
        (r"C:\Windows\Fonts\stsong.ttf" if serif else r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"),
        ("/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc") if serif else ("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
        "/System/Library/Fonts/Songti.ttc" if serif else "/System/Library/Fonts/PingFang.ttc",
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def lines(draw, value, font_obj, width):
    words = list(str(value or ""))
    output, current = [], ""
    for char in words:
        candidate = current + char
        if current and draw.textlength(candidate, font=font_obj) > width:
            output.append(current)
            current = char
        else:
            current = candidate
    if current:
        output.append(current)
    return output[:3] or [""]


def fit_photo(photo_path, size, centering=(0.5, 0.42)):
    if not photo_path or not os.path.exists(photo_path):
        return None
    with Image.open(photo_path).convert("RGB") as source:
        return ImageOps.fit(source, size, method=Image.Resampling.LANCZOS, centering=centering)


def draw_lines(draw, value, xy, font_obj, fill, width, gap=1.2):
    for index, line in enumerate(lines(draw, value, font_obj, width)):
        draw.text((xy[0], xy[1] + index * int(font_obj.size * gap)), line, font=font_obj, fill=fill)


def render_abstract_collage(image, share, palette, photo_path, fonts, ratio):
    draw = ImageDraw.Draw(image, "RGBA")
    width, height = image.size
    bg, accent, secondary, text, muted = palette
    pad = int(width * 0.10)
    photo_top, photo_h = int(height * 0.11), int(height * 0.28)
    draw.ellipse((int(width * 0.72), -int(width * 0.08), int(width * 1.14), int(height * 0.27)), fill=accent + "18")
    photo = fit_photo(photo_path, (width - pad * 2, photo_h))
    if photo:
        image.paste(photo, (pad, photo_top))
        draw.rectangle((pad, photo_top, width - pad, photo_top + photo_h), fill=bg + "35")
    else:
        draw.rectangle((pad, photo_top, width - pad, photo_top + photo_h), fill=accent + "10", outline=accent + "80", width=4)
        draw.line((pad + 40, photo_top + photo_h * 0.72, pad + (width - pad * 2) * 0.42, photo_top + photo_h * 0.35, pad + (width - pad * 2) * 0.86, photo_top + photo_h * 0.68), fill=accent + "C0", width=8, joint="curve")
    draw.text((pad, int(height * 0.065)), share.get("eyebrow", "TRAINING ARCHIVE"), font=fonts[0], fill=accent)
    panel_top = int(height * 0.51)
    panel_h = int(height * 0.22)
    draw.rectangle((pad, panel_top, width - pad, panel_top + panel_h), fill=text + "08")
    draw.line((pad, panel_top + 48, pad + int((width - pad * 2) * 0.72), panel_top + 48), fill=accent, width=8)
    chart_left = pad + int((width - pad * 2) * 0.12)
    chart_right = pad + int((width - pad * 2) * 0.92)
    chart_top = panel_top + 112
    chart_bottom = panel_top + panel_h - 48
    draw.line((chart_left, chart_bottom, chart_right, chart_bottom), fill=secondary + "CC", width=3)
    points = share.get("trendPoints", [])
    values = [float(point.get("value", 0) or 0) for point in points]
    if len(values) >= 2:
        maximum = max([1.0, *values])
        coords = []
        for index, value in enumerate(values):
            x = chart_left + (chart_right - chart_left) * index / (len(values) - 1)
            y = chart_bottom - (chart_bottom - chart_top) * value / maximum
            coords.append((int(x), int(y)))
        draw.line(coords, fill=accent + "E8", width=7, joint="curve")
        for x, y in coords:
            draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=accent + "FF")
    else:
        draw.ellipse((pad + int((width - pad * 2) * 0.76), chart_top, pad + int((width - pad * 2) * 0.91), chart_top + int((width - pad * 2) * 0.15)), fill=accent + "B8")
    title_font, subtitle_font, value_font = fonts[1:]
    label_font = fonts[2]
    draw_lines(draw, share.get("title", "训练档案"), (pad, int(height * 0.405)), title_font, text, width - pad * 2, 1.08)
    draw_lines(draw, share.get("subtitle", "稳定出现"), (pad, int(height * 0.465)), subtitle_font, muted, width - pad * 2)
    metrics = share.get("metrics", [])[:4]
    for index, metric in enumerate(metrics):
        y = panel_top + panel_h + 24 + index * 58
        draw.line((pad, y, width - pad, y), fill=text + "2E", width=2)
        draw.text((pad, y + 12), str(metric.get("label", "")), font=label_font, fill=muted)
        value = str(metric.get("value", ""))
        draw.text((width - pad - draw.textlength(value, font=value_font), y + 8), value, font=value_font, fill=text)
    rule_y = height - int(pad * 1.8)
    draw.line((pad, rule_y, width - pad, rule_y), fill=accent + "B0", width=3)
    draw.text((pad, height - int(pad * 1.12)), share.get("footer", "HEALTHY FITNESS COACH"), font=label_font, fill=muted)


def render_training_editorial(image, share, palette, photo_path, fonts, ratio):
    draw = ImageDraw.Draw(image, "RGBA")
    width, height = image.size
    bg, accent, secondary, text, muted = palette
    pad = int(width * 0.08)
    strip_w = int(width * 0.25)
    top = int(height * 0.10)
    strip_h = int(height * 0.37)
    for index in range(3):
        x = pad + index * (strip_w + int(pad * 0.45))
        y = top + (index % 2) * int(height * 0.025)
        photo = fit_photo(photo_path, (strip_w, strip_h - index * 70), centering=(0.5 + (index - 1) * 0.12, 0.42))
        if photo:
            image.paste(photo, (x, y))
        else:
            draw.rectangle((x, y, x + strip_w, y + strip_h - index * 70), fill=(accent if index != 1 else secondary) + "28")
        draw.rectangle((x, y, x + strip_w, y + strip_h - index * 70), outline=text + "42", width=2)
    draw.text((pad, int(height * 0.57)), share.get("eyebrow", "YEAR IN MOTION"), font=fonts[0], fill=accent)
    draw_lines(draw, share.get("title", "训练战报"), (pad, int(height * 0.62)), fonts[1], text, width - pad * 2)
    draw_lines(draw, share.get("subtitle", "2026 YTD"), (pad, int(height * 0.68)), fonts[2], muted, width - pad * 2)
    points = share.get("trendPoints", [])
    values = [float(point.get("value", 0) or 0) for point in points]
    max_value = max([1.0, *values])
    plot_top, plot_bottom = int(height * 0.71), int(height * 0.79)
    coords = []
    for index, value in enumerate(values):
        x = pad + (width - pad * 2) * index / max(1, len(values) - 1)
        y = plot_bottom - (plot_bottom - plot_top) * value / max_value
        coords.append((int(x), int(y)))
    if len(coords) >= 2:
        draw.line(coords, fill=accent, width=8, joint="curve")
        for point in coords:
            draw.ellipse((point[0] - 7, point[1] - 7, point[0] + 7, point[1] + 7), fill=accent)
    metrics = share.get("metrics", [])[:4]
    for index, metric in enumerate(metrics):
        x = pad + (index % 2) * int(width * 0.47)
        y = int(height * 0.81) + (index // 2) * 58
        draw.text((x, y), str(metric.get("label", "")), font=fonts[2], fill=muted)
        draw.text((x + int(width * 0.20), y), str(metric.get("value", "")), font=fonts[3], fill=text)
    draw.line((pad, height - int(pad * 1.6), width - pad, height - int(pad * 1.6)), fill=secondary + "B0", width=3)
    draw.text((pad, height - int(pad * 0.95)), share.get("footer", "HEALTHY FITNESS COACH"), font=fonts[2], fill=muted)


def render_material_poster(image, share, palette, photo_path, fonts, ratio):
    draw = ImageDraw.Draw(image, "RGBA")
    width, height = image.size
    bg, accent, secondary, text, muted = palette
    pad = int(width * 0.10)
    for y in range(0, height, 28):
        for x in range(0, width, 28):
            draw.ellipse((x + 3, y + 4, x + 6, y + 7), fill=text + "18")
            draw.line((x, y + 22, x + 28, y + 4), fill=secondary + "12", width=2)
    draw.ellipse((int(width * 0.0), int(height * 0.65), int(width * 0.54), int(height * 1.05)), fill=accent + "14")
    anchor_size = int(width * 0.36)
    photo = fit_photo(photo_path, (anchor_size, anchor_size), centering=(0.5, 0.42))
    anchor_x, anchor_y = int(width * 0.58), int(height * 0.05)
    if photo:
        mask = Image.new("L", (anchor_size, anchor_size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, anchor_size, anchor_size), fill=255)
        image.paste(photo, (anchor_x, anchor_y), mask)
    else:
        draw.ellipse((anchor_x, anchor_y, anchor_x + anchor_size, anchor_y + anchor_size), fill=secondary + "44")
    draw.text((pad, int(height * 0.12)), share.get("eyebrow", "MATERIAL STUDY"), font=fonts[0], fill=accent)
    draw_lines(draw, share.get("title", "训练档案"), (pad, int(height * 0.35)), fonts[1], text, width - pad * 2)
    draw_lines(draw, share.get("subtitle", "2026"), (pad, int(height * 0.43)), fonts[2], muted, width - pad * 2)
    draw.text((pad, int(height * 0.52)), "01", font=font(max(64, int(width * 0.08)), bold=True), fill=accent)
    for index, metric in enumerate(share.get("metrics", [])[:5]):
        y = int(height * 0.59) + index * 66
        draw.text((pad, y), str(metric.get("label", "")), font=fonts[2], fill=muted)
        value = str(metric.get("value", ""))
        draw.text((width - pad - draw.textlength(value, font=fonts[3]), y), value, font=fonts[3], fill=text)
        draw.line((pad, y + 24, width - pad, y + 24), fill=text + "2A", width=2)
    draw.text((pad, height - int(pad * 0.8)), share.get("footer", "HEALTHY FITNESS COACH"), font=fonts[2], fill=muted)


def render_data_atlas(image, share, palette, fonts, training_dates):
    draw = ImageDraw.Draw(image, "RGBA")
    width, height = image.size
    _, accent, secondary, _, _ = palette
    bg, text, muted = "#0E1117", "#F4F1EA", "#8E98A8"
    pad = int(width * 0.08)
    serif_title = font(max(58, int(width * 0.062)), bold=False, serif=True)
    serif_number = font(max(100, int(width * 0.11)), bold=False, serif=True)
    sans_label = font(max(17, int(width * 0.014)), bold=False)
    sans_value = font(max(30, int(width * 0.028)), bold=True)
    draw.polygon([(int(width * 0.58), 0), (width, 0), (width, int(height * 0.26))], fill=accent + "26")
    draw.polygon([(0, int(height * 0.82)), (int(width * 0.42), height), (0, height)], fill=secondary + "1C")
    draw.rectangle((pad, pad, width - pad, height - pad), outline="#FFFFFF26", width=2)
    draw.text((pad * 1.35, int(height * 0.08)), share.get("eyebrow", "TRAINING LOG"), font=sans_label, fill=accent)
    draw.text((width - pad * 1.35, int(height * 0.08)), "01 / YEAR IN REVIEW", font=sans_label, fill=muted, anchor="ra")
    draw_lines(draw, share.get("title", "训练图谱"), (pad * 1.35, int(height * 0.18)), serif_title, text, width - pad * 2.7, 1.05)
    draw_lines(draw, share.get("subtitle", "把训练变成可见的时间线"), (pad * 1.35, int(height * 0.34)), fonts[2], muted, width - pad * 2.7)
    draw.line((pad * 1.35, int(height * 0.42), width - pad * 1.35, int(height * 0.42)), fill="#FFFFFF38", width=2)
    metrics = share.get("metrics", [])[:3]
    first = metrics[0] if metrics else {"label": "训练日", "value": "0"}
    draw.text((pad * 1.35, int(height * 0.47)), str(first.get("label", "训练日")).upper(), font=sans_label, fill=muted)
    draw.text((pad * 1.35, int(height * 0.53)), str(first.get("value", "0")), font=serif_number, fill=accent)
    points = share.get("trendPoints", [])
    values = [float(point.get("value", 0) or 0) for point in points]
    max_value = max([1.0, *values])
    coords = []
    for index, value in enumerate(values):
        x = pad + (width - pad * 2) * index / max(1, len(values) - 1)
        y = int(height * 0.68) - int(height * 0.12 * value / max_value)
        coords.append((int(x), y))
    if len(coords) >= 2:
        draw.line(coords, fill=accent, width=5, joint="curve")
        for x, y in coords:
            draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=bg, outline=accent, width=3)
    draw.text((pad * 1.35, int(height * 0.73)), "CONSISTENCY MAP", font=sans_label, fill=muted)
    cells = list(training_dates or [])[:84]
    for index in range(max(14 * 6, len(cells))):
        x = pad * 1.35 + (index % 14) * 25
        y = int(height * 0.77) + (index // 14) * 25
        active = index < len(cells)
        draw.rounded_rectangle((x, y, x + 17, y + 17), radius=2, fill=(accent + f"{50 + (index % 4) * 35:02X}") if active else text + "14")
    for index, metric in enumerate(metrics[1:]):
        x = pad * 1.35 + index * int(width * 0.30)
        draw.text((x, int(height * 0.875)), str(metric.get("label", "")), font=sans_label, fill=muted)
        draw.text((x, int(height * 0.91)), str(metric.get("value", "")), font=sans_value, fill=text)
    draw.line((pad * 1.35, int(height * 0.94), width - pad * 1.35, int(height * 0.94)), fill=accent + "99", width=2)
    draw.text((pad * 1.35, height - pad * 0.82), share.get("footer", "HEALTHY FITNESS COACH"), font=sans_label, fill=muted)


def render_rich_infographic(image, share, palette, fonts, training_dates, body_distribution):
    draw = ImageDraw.Draw(image, "RGBA")
    width, height = image.size
    bg, accent, secondary, text, muted = palette
    pad = int(width * 0.08)
    draw.text((pad, int(height * 0.07)), share.get("eyebrow", "训练档案 / YTD"), font=fonts[0], fill=accent)
    draw_lines(draw, share.get("title", "年度训练图谱"), (pad, int(height * 0.13)), fonts[1], text, width - pad * 2, 1.12)
    draw_lines(draw, share.get("subtitle", "用数据看见持续出现"), (pad, int(height * 0.20)), fonts[2], muted, width - pad * 2)
    metrics = share.get("metrics", [])[:4]
    for index, metric in enumerate(metrics):
        x = pad + (index % 2) * int(width * 0.46)
        y = int(height * 0.25) + (index // 2) * 94
        draw.text((x, y), str(metric.get("label", "")), font=fonts[2], fill=muted)
        draw.text((x, y + 30), str(metric.get("value", "")), font=fonts[3], fill=text)
    panel_top = int(height * 0.39)
    panel_bottom = int(height * 0.57)
    draw.rounded_rectangle((pad, panel_top, width - pad, panel_bottom), radius=24, fill=text + "08", outline=text + "28", width=2)
    draw.text((pad + 28, panel_top + 24), "训练频率趋势", font=fonts[2], fill=muted)
    points = share.get("trendPoints", [])
    values = [float(point.get("value", 0) or 0) for point in points]
    maximum = max([1.0, *values])
    left, right = pad + 28, width - pad - 28
    top, bottom = panel_top + 74, panel_bottom - 28
    coords = []
    for index, value in enumerate(values):
        x = left + (right - left) * index / max(1, len(values) - 1)
        y = bottom - (bottom - top) * value / maximum
        coords.append((int(x), int(y)))
    for ratio in (0.25, 0.5, 0.75, 1):
        y = bottom - (bottom - top) * ratio
        draw.line((left, y, right, y), fill=text + "22", width=2)
    if len(coords) >= 2:
        draw.line(coords, fill=accent, width=7, joint="curve")
        for x, y in coords:
            draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill=accent)
    lower_top = int(height * 0.61)
    lower_bottom = int(height * 0.87)
    draw.rounded_rectangle((pad, lower_top, int(width * 0.48), lower_bottom), radius=24, fill=text + "08", outline=text + "28", width=2)
    draw.rounded_rectangle((int(width * 0.53), lower_top, width - pad, lower_bottom), radius=24, fill=text + "08", outline=text + "28", width=2)
    draw.text((pad + 28, lower_top + 26), "部位 / 动作分布", font=fonts[2], fill=muted)
    items = list(body_distribution or [])[:6] or [{"label": "暂无数据", "value": 0}]
    cx, cy = int(width * 0.265), lower_top + int((lower_bottom - lower_top) * 0.58)
    radius = int(width * 0.14)
    count = len(items)
    points_for = lambda scale: [(
        cx + int(__import__("math").cos(-__import__("math").pi / 2 + __import__("math").tau * index / count) * radius * scale),
        cy + int(__import__("math").sin(-__import__("math").pi / 2 + __import__("math").tau * index / count) * radius * scale)
    ) for index in range(count)]
    for scale in (0.33, 0.66, 1):
        draw.polygon(points_for(scale), outline=text + "28")
    for index in range(count):
        point = points_for(1)[index]
        draw.line((cx, cy, point[0], point[1]), fill=text + "20", width=2)
    max_value = max([1.0, *[float(item.get("value", 0) or 0) for item in items]])
    shape = []
    for index, item in enumerate(items):
        scale = max(0.08, float(item.get("value", 0) or 0) / max_value)
        shape.append(points_for(scale)[index])
    draw.polygon(shape, fill=accent + "44", outline=accent)
    for index, item in enumerate(items):
        label_point = points_for(1.18)[index]
        label = str(item.get("label", ""))[:6]
        draw.text((label_point[0] - draw.textlength(label, font=fonts[0]) / 2, label_point[1] - 10), label, font=fonts[0], fill=muted)
    draw.text((int(width * 0.53) + 28, lower_top + 26), "训练热力", font=fonts[2], fill=muted)
    grid_x, grid_y = int(width * 0.57), lower_top + 86
    for index in range(max(42, len(training_dates or []))):
        active = index < len(training_dates or [])
        x = grid_x + (index % 14) * 25
        y = grid_y + (index // 14) * 25
        draw.rounded_rectangle((x, y, x + 17, y + 17), radius=4, fill=(accent + f"{50 + (index % 4) * 35:02X}") if active else text + "16")
    draw.line((pad, height - int(pad * 1.6), width - pad, height - int(pad * 1.6)), fill=accent + "99", width=3)
    draw.text((pad, height - int(pad * 0.8)), share.get("footer", "HEALTHY FITNESS COACH"), font=fonts[2], fill=muted)


def _legacy_main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ratio", choices=CANVAS, default="3:4")
    parser.add_argument("--photo")
    args = parser.parse_args()
    with open(args.input, encoding="utf-8") as source:
        payload = json.load(source)
    width, height = CANVAS[args.ratio]
    share = dict(payload.get("share", payload))
    if not share.get("trendPoints"):
        share["trendPoints"] = [
            {"label": item.get("week_start", ""), "value": item.get("training_days", 0)}
            for item in payload.get("trends", {}).get("weekly", [])
        ]
    token = share.get("styleToken", payload.get("styleToken", {}))
    palette = token.get("palette", token if isinstance(token, dict) else {})
    bg = color(palette.get("bg"), "#17191D")
    accent = color(palette.get("accent"), "#D7FF4B")
    secondary = color(palette.get("secondary"), "#7A8BFF")
    text = color(palette.get("text"), "#F6F7F2")
    muted = color(palette.get("muted"), "#A9B0AA")
    image = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(image, "RGBA")
    pad = int(width * 0.075)
    draw.ellipse((int(width * 0.60), -int(width * 0.15), int(width * 1.14), int(width * 0.39)), fill=accent + "18")
    draw.ellipse((-int(width * 0.16), int(height * 0.72), int(width * 0.32), int(height * 1.10)), fill=secondary + "20")
    photo_path = args.photo or share.get("photo")
    photo_top = int(height * 0.10)
    photo_bottom = int(height * 0.43)
    if photo_path and os.path.exists(photo_path):
        with Image.open(photo_path).convert("RGB") as source:
            photo = ImageOps.fit(source, (width - pad * 2, photo_bottom - photo_top), method=Image.Resampling.LANCZOS, centering=(0.5, 0.42))
            image.paste(photo, (pad, photo_top))
        draw.rectangle((pad, photo_top, width - pad, photo_bottom), fill=bg + "52")
    else:
        draw.rounded_rectangle((pad, photo_top, width - pad, photo_bottom), radius=36, outline=accent + "80", width=4, fill=accent + "12")
        points = [(pad * 2, photo_bottom - pad), (pad * 3, photo_top + pad), (pad * 5, photo_bottom - pad * 1.7), (pad * 7, photo_top + pad * 0.8)]
        draw.line(points, fill=accent + "B0", width=8, joint="curve")
    eyebrow_font = font(max(22, int(width * 0.014)), bold=False)
    title_font = font(max(54, int(width * 0.053)), bold=True)
    subtitle_font = font(max(24, int(width * 0.018)), bold=False)
    label_font = font(max(18, int(width * 0.014)), bold=False)
    value_font = font(max(34, int(width * 0.029)), bold=True)
    draw.text((pad, int(height * 0.045)), share.get("eyebrow", "TRAINING LOG"), font=eyebrow_font, fill=accent)
    title_y = int(height * 0.48)
    for index, line in enumerate(lines(draw, share.get("title", "训练记录"), title_font, width - pad * 2)):
        draw.text((pad, title_y + index * int(title_font.size * 1.08)), line, font=title_font, fill=text)
    subtitle_y = title_y + int(title_font.size * 1.2) * min(3, len(lines(draw, share.get("title", "训练记录"), title_font, width - pad * 2))) + 20
    for index, line in enumerate(lines(draw, share.get("subtitle", "稳定出现，比偶尔爆发更重要。"), subtitle_font, width - pad * 2)):
        draw.text((pad, subtitle_y + index * int(subtitle_font.size * 1.35)), line, font=subtitle_font, fill=muted)
    metrics = share.get("metrics", [])[:6]
    cols = min(3, len(metrics)) if args.ratio == "1:1" else 2
    cols = max(1, cols)
    gap = int(pad * 0.35)
    card_w = (width - pad * 2 - gap * (cols - 1)) // cols
    metric_rows = max(1, (len(metrics) + cols - 1) // cols)
    card_h = int(height * 0.095)
    metric_y = int(height * (0.58 if args.ratio == "1:1" else 0.62))
    safe_bottom = height - int(pad * 1.8) - 36
    row_step = max(64, min(int(height * 0.115), (safe_bottom - metric_y) // metric_rows))
    card_h = max(56, min(card_h, row_step - 12))
    for index, metric in enumerate(metrics):
        row, col = divmod(index, cols)
        x = pad + col * (card_w + gap)
        y = metric_y + row * row_step
        draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=24, fill=text + "10", outline=text + "25", width=2)
        draw.text((x + 24, y + 22), str(metric.get("label", "")), font=label_font, fill=muted)
        draw.text((x + 24, y + int(card_h * 0.48)), str(metric.get("value", "")), font=value_font, fill=text)
    rule_y = height - int(pad * 1.8)
    draw.line((pad, rule_y, width - pad, rule_y), fill=accent + "B0", width=3)
    draw.ellipse((width - pad - 8, rule_y - 8, width - pad + 8, rule_y + 8), fill=accent)
    draw.text((pad, height - int(pad * 1.18)), share.get("footer", "HEALTHY FITNESS COACH"), font=label_font, fill=muted)
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    image.save(args.output, format="PNG", optimize=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ratio", choices=CANVAS, default="3:4")
    parser.add_argument("--photo")
    parser.add_argument("--mode", choices=["abstract-collage", "training-editorial", "material-poster", "data-atlas"])
    parser.add_argument("--layout", choices=["minimal", "rich"], default="minimal")
    parser.add_argument("--palette", choices=sorted(PALETTE_THEMES))
    args = parser.parse_args()
    with open(args.input, encoding="utf-8") as source:
        payload = json.load(source)
    width, height = CANVAS[args.ratio]
    share = dict(payload.get("share", payload))
    if not share.get("trendPoints"):
        share["trendPoints"] = [
            {"label": item.get("week_start", ""), "value": item.get("training_days", 0)}
            for item in payload.get("trends", {}).get("weekly", [])
        ]
    token = share.get("styleToken", payload.get("styleToken", {}))
    palette = PALETTE_THEMES.get(args.palette) or token.get("palette", token if isinstance(token, dict) else {})
    colors = (
        color(palette.get("bg"), "#17191D"),
        color(palette.get("accent"), "#D7FF4B"),
        color(palette.get("secondary"), "#7A8BFF"),
        color(palette.get("text"), "#F6F7F2"),
        color(palette.get("muted"), "#A9B0AA"),
    )
    layout = share.get("layout") or args.layout
    width_scale = width / 2048
    fonts = (
        font(max(22, int(width * 0.014)), bold=False),
        font(max(54, int(width * 0.053)), bold=True, serif=(layout == "rich")),
        font(max(24, int(width * 0.018)), bold=False, serif=(layout == "rich")),
        font(max(34, int(width * 0.029)), bold=True),
    )
    photo_path = args.photo or share.get("photo")
    mode = args.mode or share.get("mode") or ("abstract-collage" if photo_path else "data-atlas")
    image = Image.new("RGB", (width, height), colors[0])
    body_distribution = [{"label": item.get("name", ""), "value": item.get("count", 0)} for item in payload.get("trends", {}).get("exercise_frequency", [])]
    if layout == "rich" and not photo_path and mode == "data-atlas":
        render_rich_infographic(image, share, colors, fonts, payload.get("trends", {}).get("training_dates", []), body_distribution)
    elif mode == "training-editorial":
        render_training_editorial(image, share, colors, photo_path, fonts, args.ratio)
    elif mode == "material-poster":
        render_material_poster(image, share, colors, photo_path, fonts, args.ratio)
    elif mode == "data-atlas":
        render_data_atlas(image, share, colors, fonts, payload.get("trends", {}).get("training_dates", []))
    else:
        render_abstract_collage(image, share, colors, photo_path, fonts, args.ratio)
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    image.save(args.output, format="PNG", optimize=True)


if __name__ == "__main__":
    main()
