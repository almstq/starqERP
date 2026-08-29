"""One-off: stage the foundation engine brand assets (logos + favicons). Run once, output to legacy/engine/assets/."""
import os
from PIL import Image

SRC_STARQ = r"D:\StarqTech\00_STARQ_HQ\corporate\brand\starq-logo.png"
SRC_CI = r"D:\StarqTech\Starq Technologies Registration Docs\club ignition\Club Ignition Logo - Final.png"
OUT = r"D:\StarqTech\the foundation engine\assets"
os.makedirs(OUT, exist_ok=True)


def crop_to_alpha(img, margin=0.06):
    bbox = img.getchannel("A").getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    m = int(max(r - l, b - t) * margin)
    l, t = max(0, l - m), max(0, t - m)
    r, b = min(img.width, r + m), min(img.height, b + m)
    return img.crop((l, t, r, b))


def fit_square(img, size):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img = img.copy()
    img.thumbnail((size, size), Image.LANCZOS)
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
    return canvas


# Starq mark: already RGBA on transparent. Crop padding, downsize for the web.
starq = Image.open(SRC_STARQ).convert("RGBA")
starq_c = crop_to_alpha(starq)
fit_square(starq_c, 256).save(os.path.join(OUT, "starq-logo.png"))
fit_square(starq_c, 64).save(os.path.join(OUT, "starq-favicon.png"))

# CI mark: black on white RGB. For the dark UI, build the white variant:
# alpha from inverted luminance, fill white. Geometry untouched.
ci = Image.open(SRC_CI).convert("L")
alpha = ci.point(lambda v: 255 - v)
ci_white = Image.new("RGBA", ci.size, (255, 255, 255, 0))
ci_white.putalpha(alpha)
ci_white_c = crop_to_alpha(ci_white)
fit_square(ci_white_c, 256).save(os.path.join(OUT, "ci-logo.png"))

# CI favicon: the issued mark as-is (black on white) so it reads on any tab.
Image.open(SRC_CI).convert("RGB").resize((64, 64), Image.LANCZOS).save(
    os.path.join(OUT, "ci-favicon.png"))

for f in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, f)
    print(f, Image.open(p).size, os.path.getsize(p), "bytes")
