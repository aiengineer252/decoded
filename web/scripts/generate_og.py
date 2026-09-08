"""
Generate the Open Graph link-preview card.

Run from the repo root:  python web/scripts/generate_og.py

Open Graph and Twitter cards require a raster image — SVG is silently ignored,
which is why this exists as a generated PNG rather than reusing favicon.svg.
Re-run it whenever the tagline or entry count changes.
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow is required:  pip install pillow")

W, H = 1200, 630

BG = (7, 9, 12)
LINE = (35, 45, 56)
TXT = (238, 243, 248)
DIM = (164, 178, 193)
AMBER = (255, 176, 32)
REAL = (74, 222, 128)
HYPE = (255, 92, 108)

OUT = Path(__file__).resolve().parents[1] / "public" / "og.png"

# Windows ships these; fall back to whatever PIL has so the script never hard
# fails on another machine (the result is uglier, not broken).
FONT_CANDIDATES = {
    "bold": ["seguisb.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"],
    "regular": ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"],
    "mono": ["consola.ttf", "cour.ttf", "DejaVuSansMono.ttf"],
}


def font(kind: str, size: int):
    for name in FONT_CANDIDATES[kind]:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # faint grid, matching the site's ground
    for x in range(0, W, 72):
        d.line([(x, 0), (x, H)], fill=LINE, width=1)
    for y in range(0, H, 72):
        d.line([(0, y), (W, y)], fill=LINE, width=1)

    # amber rule down the left edge
    d.rectangle([0, 0, 10, H], fill=AMBER)

    pad = 78

    # wordmark
    d.text((pad, 74), "DECODED", font=font("bold", 46), fill=TXT)
    wm_w = d.textlength("DECODED", font=font("bold", 46))
    d.text((pad + wm_w + 18, 88), "/truth-engine", font=font("mono", 26), fill=AMBER)

    # headline — the hook, kept short so it stays legible in a small card
    d.text((pad, 186), "Is it real,", font=font("bold", 92), fill=TXT)
    d.text((pad, 286), "or is it hype?", font=font("bold", 92), fill=AMBER)

    # supporting line
    d.text(
        (pad, 412),
        "Every AI launch, traced to what it actually does",
        font=font("regular", 34),
        fill=DIM,
    )
    d.text((pad, 456), "— and what it makes obsolete.", font=font("regular", 34), fill=DIM)

    # the four views, as the proof of depth
    y = 545
    x = pad
    for i, label in enumerate(["architecture", "trace", "displacement", "verdict"]):
        f = font("mono", 24)
        d.text((x, y), label, font=f, fill=TXT if i == 0 else DIM)
        x += d.textlength(label, font=f) + 20
        if i < 3:
            d.text((x, y), "/", font=f, fill=AMBER)
            x += d.textlength("/", font=f) + 20

    # credibility band strip, bottom right — the visual signature of the site
    bar_y, bar_w, bar_h = 556, 46, 10
    bx = W - pad - (bar_w * 4 + 30)
    for i, c in enumerate([HYPE, (255, 154, 77), AMBER, REAL]):
        d.rounded_rectangle(
            [bx + i * (bar_w + 10), bar_y, bx + i * (bar_w + 10) + bar_w, bar_y + bar_h],
            radius=5,
            fill=c,
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT}  ({OUT.stat().st_size // 1024} KB, {W}x{H})")


if __name__ == "__main__":
    main()
