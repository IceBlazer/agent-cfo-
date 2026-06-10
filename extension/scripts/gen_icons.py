"""Generate simple shield icons for the Chrome extension."""
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    import subprocess
    import sys

    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)

COLORS = {
    "green": ("#16A34A", "#FFFFFF", "check"),
    "yellow": ("#EAB308", "#FFFFFF", "exclaim"),
    "red": ("#DC2626", "#FFFFFF", "x"),
    "gray": ("#9CA3AF", "#FFFFFF", "minus"),
}


def draw_icon(size, bg, sym_c, sym):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = size // 8
    d.rounded_rectangle([m, m, size - m, size - m], radius=size // 5, fill=bg)
    cx, cy = size // 2, size // 2
    w = max(2, size // 10)
    if sym == "check":
        d.line([(cx - size // 5, cy), (cx - size // 12, cy + size // 6), (cx + size // 4, cy - size // 5)], fill=sym_c, width=w)
    elif sym == "exclaim":
        d.rectangle([cx - size // 16, cy - size // 4, cx + size // 16, cy + size // 12], fill=sym_c)
        d.ellipse([cx - size // 16, cy + size // 6, cx + size // 16, cy + size // 4], fill=sym_c)
    elif sym == "x":
        r = size // 6
        d.line([(cx - r, cy - r), (cx + r, cy + r)], fill=sym_c, width=w)
        d.line([(cx + r, cy - r), (cx - r, cy + r)], fill=sym_c, width=w)
    elif sym == "minus":
        d.rectangle([cx - size // 4, cy - size // 16, cx + size // 4, cy + size // 16], fill=sym_c)
    return img


for name, (bg, sym_c, sym) in COLORS.items():
    draw_icon(48, bg, sym_c, sym).save(OUT / f"icon-{name}.png")
    print("wrote", OUT / f"icon-{name}.png")
