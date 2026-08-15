#!/usr/bin/env python3
"""Render a deterministic PNG share card without requiring an image model."""

import argparse
import json
import os
import re
import textwrap

from PIL import Image, ImageDraw, ImageFont, ImageOps


CANVAS = {"1:1": (2048, 2048), "9:16": (1440, 2560), "3:4": (1800, 2400)}
Image.MAX_IMAGE_PIXELS = 25_000_000


def color(value, fallback):
    value = str(value or "")
    if re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
        return value.upper()
    return fallback


def font(size, bold=False):
    candidates = [
        os.environ.get("HEALTHY_FITNESS_FONT_BOLD" if bold else "HEALTHY_FITNESS_FONT"),
        r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/System/Library/Fonts/PingFang.ttc",
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
    bg, accent, secondary, text, muted = palette
    pad = int(width * 0.08)
    draw.text((pad, int(height * 0.10)), share.get("eyebrow", "DATA ATLAS"), font=fonts[0], fill=accent)
    draw_lines(draw, share.get("title", "训练图谱"), (pad, int(height * 0.22)), fonts[1], text, width - pad * 2)
    draw_lines(draw, share.get("subtitle", "训练数据复盘"), (pad, int(height * 0.30)), fonts[2], muted, width - pad * 2)
    grid_y = int(height * 0.50)
    draw.line((pad, int(height * 0.44), width - pad, int(height * 0.44)), fill=text + "26", width=2)
    cells = list(training_dates or [])[:84]
    for index in range(max(14 * 6, len(cells))):
        x = pad + (index % 14) * 26
        y = grid_y + (index // 14) * 26
        active = index < len(cells)
        draw.rounded_rectangle((x, y, x + 18, y + 18), radius=4, fill=(accent + f"{50 + (index % 4) * 35:02X}") if active else text + "16")
    points = share.get("trendPoints", [])
    values = [float(point.get("value", 0) or 0) for point in points]
    max_value = max([1.0, *values])
    coords = []
    for index, value in enumerate(values):
        x = pad + (width - pad * 2) * index / max(1, len(values) - 1)
        y = int(height * 0.39) - int(height * 0.10 * value / max_value)
        coords.append((int(x), y))
    if len(coords) >= 2:
        draw.line(coords, fill=secondary, width=7, joint="curve")
    for index, metric in enumerate(share.get("metrics", [])[:4]):
        x = pad + (index % 2) * int(width * 0.46)
        y = int(height * 0.76) + (index // 2) * 68
        draw.text((x, y), str(metric.get("label", "")), font=fonts[2], fill=muted)
        draw.text((x, y + 30), str(metric.get("value", "")), font=fonts[3], fill=text)
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
    share = payload.get("share", payload)
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
    args = parser.parse_args()
    with open(args.input, encoding="utf-8") as source:
        payload = json.load(source)
    width, height = CANVAS[args.ratio]
    share = payload.get("share", payload)
    token = share.get("styleToken", payload.get("styleToken", {}))
    palette = token.get("palette", token if isinstance(token, dict) else {})
    colors = (
        color(palette.get("bg"), "#17191D"),
        color(palette.get("accent"), "#D7FF4B"),
        color(palette.get("secondary"), "#7A8BFF"),
        color(palette.get("text"), "#F6F7F2"),
        color(palette.get("muted"), "#A9B0AA"),
    )
    width_scale = width / 2048
    fonts = (
        font(max(22, int(width * 0.014)), bold=False),
        font(max(54, int(width * 0.053)), bold=True),
        font(max(24, int(width * 0.018)), bold=False),
        font(max(34, int(width * 0.029)), bold=True),
    )
    photo_path = args.photo or share.get("photo")
    mode = args.mode or share.get("mode") or ("abstract-collage" if photo_path else "data-atlas")
    image = Image.new("RGB", (width, height), colors[0])
    if mode == "training-editorial":
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
