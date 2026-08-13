#!/usr/bin/env python3
"""Render a deterministic PNG share card without requiring an image model."""

import argparse
import json
import os
import textwrap

from PIL import Image, ImageDraw, ImageFont, ImageOps


CANVAS = {"1:1": (2048, 2048), "9:16": (1440, 2560), "3:4": (1800, 2400)}


def color(value, fallback):
    value = str(value or "")
    if len(value) == 7 and value.startswith("#"):
        try:
            return value
        except ValueError:
            pass
    return fallback


def font(size, bold=False):
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ratio", choices=CANVAS, default="3:4")
    parser.add_argument("--photo")
    args = parser.parse_args()
    payload = json.load(open(args.input, encoding="utf-8"))
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
    card_h = int(height * 0.095)
    metric_y = int(height * 0.66)
    for index, metric in enumerate(metrics):
        row, col = divmod(index, cols)
        x = pad + col * (card_w + gap)
        y = metric_y + row * int(height * 0.115)
        draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=24, fill=text + "10", outline=text + "25", width=2)
        draw.text((x + 24, y + 22), str(metric.get("label", "")), font=label_font, fill=muted)
        draw.text((x + 24, y + int(card_h * 0.48)), str(metric.get("value", "")), font=value_font, fill=text)
    rule_y = height - int(pad * 1.8)
    draw.line((pad, rule_y, width - pad, rule_y), fill=accent + "B0", width=3)
    draw.ellipse((width - pad - 8, rule_y - 8, width - pad + 8, rule_y + 8), fill=accent)
    draw.text((pad, height - int(pad * 1.18)), share.get("footer", "HEALTHY FITNESS COACH"), font=label_font, fill=muted)
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    image.save(args.output, format="PNG", optimize=True)


if __name__ == "__main__":
    main()
