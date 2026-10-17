"""Turn the downloaded real-world images into the textures the Blender build uses.

    C:/venvs/tajmahal/Scripts/python blender/make_textures.py

Reads assets/photos (Wikimedia Commons photos of the real Taj Mahal) and assets/textures (CC0
photo-scanned materials), writes blender/textures/*.jpg|png, and copies resized photos for the
in-world gallery to public/gallery/. Every facade texture is drawn in metres with the same arch
outlines the Blender build cuts (archgeo.py), so the inlay frames sit exactly around the openings.
"""

from __future__ import annotations

import json
import math
import random
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from archgeo import SITE, arch_points, gate_facades, mosque_facades, tomb_facades

ROOT = Path(__file__).resolve().parent.parent
PH = ROOT / "assets" / "photos"
TX = ROOT / "assets" / "textures"
OUT = ROOT / "blender" / "textures"
GALLERY = ROOT / "public" / "gallery"
LZ = Image.Resampling.LANCZOS

INK = (38, 34, 32)        # black marble inlay lines
OCHRE = (176, 132, 70)    # the thin yellow stone line beside them
CREAM = (240, 233, 220)   # carved mouldings
WHITE_INLAY = (238, 230, 214)


def save(im: Image.Image, name: str, quality: int = 84) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    if name.endswith(".png"):
        im.save(OUT / name, optimize=True)
    else:
        im.convert("RGB").save(OUT / name, quality=quality, optimize=True, progressive=True)


def photo(name: str) -> Image.Image:
    return Image.open(PH / name).convert("RGB")


def rectify(img: Image.Image, quad, size, scale: float = 1.0) -> Image.Image:
    """Straighten a quadrilateral (TL, TR, BR, BL in display pixels * scale) into a w x h image."""
    w, h = size
    src = [(x * scale, y * scale) for x, y in quad]
    dst = [(0, 0), (w, 0), (w, h), (0, h)]
    a, b = [], []
    for (xd, yd), (xs, ys) in zip(dst, src):
        a += [[xd, yd, 1, 0, 0, 0, -xs * xd, -xs * yd], [0, 0, 0, xd, yd, 1, -ys * xd, -ys * yd]]
        b += [xs, ys]
    coeffs = np.linalg.solve(np.array(a, float), np.array(b, float))
    return img.transform(size, Image.Transform.PERSPECTIVE, tuple(coeffs), Image.Resampling.BICUBIC)


# ---- base materials (CC0 scans, recoloured) ---------------------------------------------------------

def scan(asset: str, kind: str = "Color", size: int = 1024) -> Image.Image:
    return Image.open(TX / asset / f"{asset}_2K-JPG_{kind}.jpg").convert("RGB").resize((size, size), LZ)


def marble_tile(size: int = 1024) -> Image.Image:
    """Makrana marble: Marble012's veins, lifted to a warm white with softer contrast."""
    a = np.asarray(scan("Marble012", size=size)).astype(np.float32) / 255
    lum = a.mean(axis=2, keepdims=True)
    v = 0.86 + (lum - lum.mean()) * 0.5
    out = np.clip(v * np.array([1.0, 0.978, 0.94]), 0, 1)
    return Image.fromarray((out * 255).astype(np.uint8))


def sandstone_tile(size: int = 1024) -> Image.Image:
    """Agra red sandstone: Concrete012's fine grain mapped onto the colour of the real gate."""
    a = np.asarray(scan("Concrete012", size=size)).astype(np.float32) / 255
    lum = a.mean(axis=2, keepdims=True)
    lum = (lum - lum.mean()) * 1.4
    base = np.array(SANDSTONE_RGB, np.float32) / 255 * np.array([0.82, 0.72, 0.72])  # sunlit photo -> stone albedo
    out = np.clip(base * (1 + lum), 0, 1)
    return Image.fromarray((out * 255).astype(np.uint8))


def sample_sandstone() -> tuple[int, int, int]:
    """Median colour of plain red sandstone in the Great Gate photo (bright inlay excluded)."""
    g = photo("great_gate.jpg")
    patch = np.asarray(g.crop((int(430 * 1.92), int(560 * 1.92), int(470 * 1.92), int(1000 * 1.92)))).reshape(-1, 3)
    patch = patch[patch.mean(axis=1) < 170]
    return tuple(int(v) for v in np.median(patch, axis=0))


SANDSTONE_RGB = (172, 86, 62)  # replaced by the photo's median below


def tiled(tile: Image.Image, w: int, h: int, tile_px: int) -> Image.Image:
    t = tile.resize((tile_px, tile_px), LZ)
    out = Image.new("RGB", (w, h))
    for y in range(0, h, tile_px):
        for x in range(0, w, tile_px):
            out.paste(t, (x, y))
    return out


# ---- details cut from photos of the real Taj -----------------------------------------------------

def details() -> dict[str, Image.Image]:
    inlay = photo("inlay_panels.jpg")  # pishtaq corner: calligraphy, spandrel inlay, parapet scroll
    jali = photo("jali_screen.jpg")    # an arched jali window with a pietra dura spandrel
    s_j = jali.width / 1947
    d = {
        "script_h": rectify(inlay, [(0, 563), (1235, 500), (1235, 598), (0, 652)], (2048, 168), 1.92),
        "script_v": rectify(inlay, [(1262, 600), (1440, 593), (1424, 1339), (1222, 1339)], (176, 1408), 1.92),
        "parapet": rectify(inlay, [(0, 402), (1550, 333), (1550, 392), (0, 452)], (2048, 84), 1.92),
        "spandrel": jali.crop((int(118 * s_j), int(85 * s_j), int(1885 * s_j), int(905 * s_j))),
        "window": jali.crop((int(118 * s_j), int(85 * s_j), int(1885 * s_j), int(1904 * s_j))),
        "dado": photo("relief_dado.jpg").crop((int(52 * 1.92), int(228 * 1.92), int(1945 * 1.92), int(968 * 1.92))),
    }
    border = photo("pietra_dura_1.jpg").crop((0, int(290 * 1.92), 3840, int(1045 * 1.92)))
    border = border.resize((1536, int(1536 * border.height / border.width)), LZ)
    seam = Image.new("RGB", (border.width * 2, border.height))  # mirror-repeat so it tiles seamlessly
    seam.paste(border, (0, 0))
    seam.paste(border.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (border.width, 0))
    d["border"] = seam
    return d


# ---- a facade canvas in metres ----------------------------------------------------------------------

class Facade:
    def __init__(self, w: float, h: float, ppm: float, base: Image.Image, tile_m: float, x0: float | None = None, y0: float = 0.0):
        self.w, self.h, self.ppm = w, h, ppm
        self.x0 = -w / 2 if x0 is None else x0  # left edge in metres
        self.y0 = y0
        self.W, self.H = max(2, round(w * ppm)), max(2, round(h * ppm))
        self.img = tiled(base, self.W, self.H, max(8, round(tile_m * ppm)))
        self.d = ImageDraw.Draw(self.img, "RGBA")

    def p(self, x: float, y: float) -> tuple[float, float]:
        return ((x - self.x0) * self.ppm, (self.y0 + self.h - y) * self.ppm)

    def s(self, m: float) -> int:
        return max(1, round(m * self.ppm))

    def paste(self, im: Image.Image, x0, y0, x1, y1, alpha: Image.Image | None = None) -> None:
        a, b = self.p(x0, y1)
        c, e = self.p(x1, y0)
        size = (max(1, round(c - a)), max(1, round(e - b)))
        self.img.paste(im.resize(size, LZ), (round(a), round(b)), alpha.resize(size, LZ) if alpha else None)

    def tile_x(self, strip: Image.Image, x0, y0, x1, y1) -> None:
        """Repeat a horizontal strip along a band, keeping its aspect ratio."""
        hpx = self.s(y1 - y0)
        unit = strip.resize((max(1, round(strip.width * hpx / strip.height)), hpx), LZ)
        a, b = self.p(x0, y1)
        end = self.p(x1, y0)[0]
        x = a
        while x < end:
            piece = unit.crop((0, 0, min(unit.width, round(end - x)), hpx))
            self.img.paste(piece, (round(x), round(b)))
            x += unit.width

    def tile_y(self, strip: Image.Image, x0, y0, x1, y1) -> None:
        wpx = self.s(x1 - x0)
        unit = strip.resize((wpx, max(1, round(strip.height * wpx / strip.width))), LZ)
        a, top = self.p(x0, y1)
        bottom = self.p(x0, y0)[1]
        y = top
        while y < bottom:
            piece = unit.crop((0, 0, wpx, min(unit.height, round(bottom - y))))
            self.img.paste(piece, (round(a), round(y)))
            y += unit.height

    def line(self, pts, color, width_m: float) -> None:
        self.d.line([self.p(x, y) for x, y in pts], fill=color, width=self.s(width_m), joint="curve")

    def rect(self, x0, y0, x1, y1, color, width_m: float) -> None:
        self.line([(x0, y0), (x0, y1), (x1, y1), (x1, y0), (x0, y0)], color, width_m)

    def inlay_rect(self, x0, y0, x1, y1, white: bool = False) -> None:
        """The double line the Taj uses to frame panels: black stone, then a thin yellow one inside."""
        if white:
            self.rect(x0, y0, x1, y1, WHITE_INLAY + (235,), 0.12)
            return
        self.rect(x0, y0, x1, y1, INK + (230,), 0.07)
        k = 0.11
        self.rect(x0 + k, y0 + k, x1 - k, y1 - k, OCHRE + (200,), 0.035)

    def fill(self, x0, y0, x1, y1, color) -> None:
        a, b = self.p(x0, y1)
        c, e = self.p(x1, y0)
        self.d.rectangle([a, b, c, e], fill=color)

    def joints(self, course: float = 1.05, block: float = 1.7, color=(160, 150, 138, 40)) -> None:
        y = self.y0 + course
        row = 0
        while y < self.y0 + self.h:
            self.line([(self.x0, y), (self.x0 + self.w, y)], color, 0.02)
            x = self.x0 + (block / 2 if row % 2 else 0)
            while x < self.x0 + self.w:
                self.line([(x, y - course), (x, y)], color, 0.02)
                x += block
            y += course
            row += 1


def rope(f: Facade, a: dict, width: float = 0.32, white: bool = False) -> None:
    """The carved cable moulding that runs round every arch."""
    pts = arch_points(a, n=40)
    f.line(pts, (CREAM if not white else WHITE_INLAY) + (255,), width)
    f.line(pts, (150, 140, 126, 120) if not white else (120, 60, 40, 140), width * 0.18)


def framed_arches(f: Facade, arches, det, white_inlay: bool = False, spandrel: bool = True) -> None:
    for a in arches:
        m, hw = a.get("alfiz", 0.5), a["w"] / 2
        x0, x1, top = a["cx"] - hw - m, a["cx"] + hw + m, a["apex"] + m
        if spandrel:
            f.paste(det["spandrel"], x0, a["spring"] - 0.1, x1, top)
        f.inlay_rect(x0, a["y0"], x1, top, white=white_inlay)
        rope(f, a, white=white_inlay)


def dado(f: Facade, arches, det, y0: float = 0.15, y1: float = 1.45, width: float = 3.4) -> None:
    blocked = [(a["cx"] - a["w"] / 2 - a.get("alfiz", 0.5) - 0.1, a["cx"] + a["w"] / 2 + a.get("alfiz", 0.5) + 0.1)
               for a in arches if a.get("y0", 0) < y1 + 0.1]
    x, end = f.x0 + 0.35, f.x0 + f.w - 0.35
    while x < end - 0.6:
        w = min(width, end - x)
        for b0, b1 in blocked:
            if x < b1 and x + w > b0:
                w = b0 - x
                break
        if w > 0.9:
            f.paste(det["dado"], x, y0, x + w, y1)
            x += w + 0.12
        else:
            nxt = [b1 for b0, b1 in blocked if b1 > x]
            x = (min(nxt) if nxt else end) + 0.12


def parapet(f: Facade, det, top: float, white: bool = False) -> None:
    f.tile_x(det["parapet"], f.x0, top - 0.95, f.x0 + f.w, top - 0.3)
    f.line([(f.x0, top - 0.97), (f.x0 + f.w, top - 0.97)], INK + (220,), 0.05)
    f.fill(f.x0, top - 0.28, f.x0 + f.w, top, (CREAM if not white else (190, 100, 74)) + (255,))


def chevrons(f: Facade, x0, y0, x1, y1, ink=INK) -> None:
    step = (x1 - x0) * 0.9
    y = y0
    while y < y1:
        f.line([(x0, y), ((x0 + x1) / 2, y + step / 2), (x1, y)], ink + (210,), 0.035)
        y += step * 0.55


# ---- the textures ----------------------------------------------------------------------------------

def tomb_textures(det, marble) -> None:
    facades = tomb_facades()
    ppm = 72
    # pishtaq: the great arch, Quranic bands, spandrel inlay, chevron colonnettes, parapet, dado
    sp = facades["pishtaq"]
    f = Facade(sp["w"], sp["h"], ppm, marble, 3.0)
    f.joints()
    a = sp["arches"][0]
    for x0, y0, x1, y1 in sp["script"]:
        (f.tile_x if x1 - x0 > y1 - y0 else f.tile_y)(det["script_h" if x1 - x0 > y1 - y0 else "script_v"], x0, y0, x1, y1)
        f.inlay_rect(x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05)
    framed_arches(f, sp["arches"], det)
    f.inlay_rect(-10.6, 0.3, 10.6, 23.0)
    for s in (-1, 1):
        chevrons(f, s * 11.5 - (0.55 if s > 0 else -0.0), 0, s * 11.5 + (0 if s > 0 else 0.55), sp["h"])
    parapet(f, det, sp["h"])
    dado(f, sp["arches"], det)
    save(f.img, "tomb_pishtaq.jpg")
    # the two stacked alcoves of the side bays and the chamfered corners
    for key in ("bay", "chamfer"):
        s = facades[key]
        f = Facade(s["w"], s["h"], ppm, marble, 3.0)
        f.joints()
        framed_arches(f, s["arches"], det)
        lo, up = s["arches"]
        hw = lo["w"] / 2 + lo["alfiz"]
        f.tile_x(det["border"], -hw, lo["apex"] + lo["alfiz"] + 0.25, hw, up["y0"] - 0.2)  # panel between the alcoves
        f.inlay_rect(-hw, lo["apex"] + lo["alfiz"] + 0.2, hw, up["y0"] - 0.15)
        f.inlay_rect(-s["w"] / 2 + 0.3, 0.3, s["w"] / 2 - 0.3, s["h"] - 1.2)
        parapet(f, det, s["h"])
        dado(f, s["arches"], det, width=1.6)
        save(f.img, f"tomb_{key}.jpg")
        for which, arch in (("lower", lo), ("upper", up)):
            niche(arch, det, marble, f"niche_{key}_{which}.jpg")
    niche(a, det, marble, "niche_pishtaq.jpg")


def niche(a: dict, det, base, name: str, white: bool = False) -> None:
    """The back wall of an alcove: an arched jali window above, a framed doorway or panel below."""
    hw, y0, top = a["w"] / 2, a.get("y0", 0.0), a["apex"]
    f = Facade(a["w"], top - y0, 80 if a["w"] < 8 else 56, base, 3.0, x0=a["cx"] - hw, y0=y0)
    shade = Image.new("RGBA", f.img.size)
    sd = ImageDraw.Draw(shade)
    for i in range(f.H):  # the vault keeps the top of the alcove in shadow
        t = 1 - i / f.H
        sd.line([(0, i), (f.W, i)], fill=(40, 30, 24, int(80 * t**1.5 + 18)))
    f.img.paste(shade, (0, 0), shade)
    door = a.get("door")
    win_w = a["w"] * (0.56 if door else 0.66)
    win_bottom = (door["apex"] + 1.2) if door else y0 + (top - y0) * 0.36
    win_top = top - (top - y0) * 0.12
    win_h = min(win_top - win_bottom, win_w * 1.03)
    f.paste(det["window"], a["cx"] - win_w / 2, win_bottom, a["cx"] + win_w / 2, win_bottom + win_h)
    f.inlay_rect(a["cx"] - win_w / 2 - 0.15, win_bottom - 0.15, a["cx"] + win_w / 2 + 0.15, win_bottom + win_h + 0.15, white=white)
    if door:
        dw = door["w"] / 2 + 0.45
        f.tile_y(det["border"].rotate(90, expand=True), a["cx"] - dw, y0, a["cx"] - dw + 0.4, door["apex"] + 0.4)
        f.tile_y(det["border"].rotate(90, expand=True), a["cx"] + dw - 0.4, y0, a["cx"] + dw, door["apex"] + 0.4)
        f.tile_x(det["border"], a["cx"] - dw, door["apex"] + 0.4, a["cx"] + dw, door["apex"] + 0.8)
    elif y0 < 1.0:
        pw = min(a["w"] * 0.6, 3.0)
        f.paste(det["dado"], a["cx"] - pw / 2, y0 + 0.2, a["cx"] + pw / 2, y0 + 1.35)
    save(f.img, name)


def dome_textures(det, marble) -> None:
    T = SITE["tomb"]
    # drum: 16 tall panels round the circumference, a band of inlay at the top
    circ = 2 * math.pi * T["drum"]["r"]
    drum_h = T["drum"]["top"] - T["roof_h"]
    pw = circ / 16
    f = Facade(pw, drum_h, 90, marble, 3.0, x0=0)
    f.joints(1.1, 1.6)
    f.inlay_rect(0.25, 1.2, pw - 0.25, drum_h - 2.2)
    rope(f, {"cx": pw / 2, "y0": 2.0, "w": pw - 1.4, "spring": drum_h - 5.8, "apex": drum_h - 3.4}, width=0.18)
    f.tile_x(det["border"], 0, drum_h - 1.6, pw, drum_h - 0.5)
    f.fill(0, drum_h - 0.45, pw, drum_h, CREAM + (255,))
    f.fill(0, 0, pw, 0.6, CREAM + (255,))
    save(f.img, "drum.jpg")
    # dome: courses of marble, a band at the base, the inverted lotus at the crown
    W, H = 2048, 1024
    img = tiled(marble, W, H, 512)
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(1, 24):
        y = H * (1 - i / 24)
        d.line([(0, y), (W, y)], fill=(150, 140, 128, 40), width=2)
        for k in range(40):
            x = (k + (0.5 if i % 2 else 0)) * W / 40
            d.line([(x, y), (x, y + H / 24)], fill=(150, 140, 128, 30), width=2)
    band = det["border"].resize((det["border"].width * 40 // det["border"].height, 40), LZ)
    for x in range(0, W, band.width):
        img.paste(band, (x, H - 46))
    petals = 32
    for k in range(petals):  # the lotus crown, petals hanging down from the top
        cx = (k + 0.5) * W / petals
        top, bottom = H * 0.02, H * 0.13
        d.polygon([(cx - W / petals * 0.48, top), (cx + W / petals * 0.48, top), (cx, bottom)], fill=(226, 218, 204, 255),
                  outline=(140, 128, 114, 200))
        d.line([(cx, top), (cx, bottom - 6)], fill=(150, 138, 124, 150), width=2)
    save(img, "dome.jpg")


def interior_textures(det, marble) -> None:
    c = SITE["tomb"]["chamber"]
    wf = 2 * c["ri"] * math.tan(math.pi / 8)
    door = {"cx": 0.0, "y0": 0.0, **SITE["tomb"]["pishtaq"]["door"]}
    for kind in ("door", "wall"):
        f = Facade(wf, c["wall_h"], 64, marble, 3.0)
        f.joints(1.0, 1.4)
        blind = {"cx": 0.0, "y0": 0.0, "w": wf - 1.6, "spring": 9.5, "apex": 13.0, "alfiz": 0.35}
        if kind == "wall":
            f.paste(det["window"], -1.9, 6.0, 1.9, 9.9 + 0.1)
        f.paste(det["spandrel"], blind["cx"] - blind["w"] / 2 - 0.35, blind["spring"], blind["cx"] + blind["w"] / 2 + 0.35, blind["apex"] + 0.35)
        f.inlay_rect(-wf / 2 + 0.35, 0.1, wf / 2 - 0.35, 13.35)
        rope(f, blind, width=0.2)
        f.tile_y(det["script_v"], -wf / 2 + 0.05, 0.4, -wf / 2 + 0.35, 14.5)
        f.tile_y(det["script_v"], wf / 2 - 0.35, 0.4, wf / 2 - 0.05, 14.5)
        f.tile_x(det["script_h"], -wf / 2, 14.0, wf / 2, 14.6)
        if kind == "door":
            rope(f, door, width=0.22)
        else:
            f.paste(det["dado"], -2.6, 0.2, 2.6, 1.6)
        parapet(f, det, c["wall_h"])
        save(f.img, f"chamber_{kind}.jpg")
    # the false inner dome: rings of inlay round a sun motif
    W, H = 1024, 1024
    img = tiled(marble, W, H, 512)
    d = ImageDraw.Draw(img, "RGBA")
    band = det["border"].resize((det["border"].width * 34 // det["border"].height, 34), LZ)
    for v in (0.08, 0.42, 0.7):
        y = int(H * (1 - v))
        for x in range(0, W, band.width):
            img.paste(band, (x, y - 17))
    for k in range(48):
        x = k * W / 48
        d.line([(x, H * 0.08), (x, 0)], fill=(176, 132, 70, 70), width=2)
    save(img, "inner_dome.jpg")
    # cenotaphs: dense pietra dura borders on white marble
    f = Facade(2.4, 1.0, 400, marble, 1.0)
    f.tile_x(det["border"], -1.2, 0.72, 1.2, 0.95)
    f.tile_x(det["border"], -1.2, 0.05, 1.2, 0.28)
    f.paste(det["spandrel"], -1.0, 0.3, 1.0, 0.7)
    save(f.img, "cenotaph.jpg")


def jali_screen() -> None:
    """The octagonal marble screen round the cenotaphs: a hexagonal lattice in a frame, with alpha."""
    W, H = 1024, 640
    img = Image.new("RGBA", (W, H), (236, 230, 218, 255))
    d = ImageDraw.Draw(img)
    r = 13
    for row in range(-1, H // int(r * 1.5) + 2):
        for col in range(-1, W // int(r * 1.732) + 2):
            cx = col * r * 1.732 + (r * 0.866 if row % 2 else 0)
            cy = row * r * 1.5
            hexa = [(cx + r * 0.62 * math.cos(math.pi / 6 + k * math.pi / 3), cy + r * 0.62 * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
            d.polygon(hexa, fill=(0, 0, 0, 0))
    frame = 46
    d.rectangle([0, 0, W, frame], fill=(236, 230, 218, 255))
    d.rectangle([0, H - frame, W, H], fill=(236, 230, 218, 255))
    d.rectangle([0, 0, frame, H], fill=(236, 230, 218, 255))
    d.rectangle([W - frame, 0, W, H], fill=(236, 230, 218, 255))
    for x in (W // 3, 2 * W // 3):
        d.rectangle([x - 12, 0, x + 12, H], fill=(236, 230, 218, 255))
    save(img, "jali.png")


def gate_textures(det, sand) -> None:
    """The Great Gate straight from a frontal photo (36.5 px/m), people at the base painted out."""
    g = photo("great_gate.jpg")
    G = SITE["gate"]
    W = 2048
    H = round(W * G["gallery_h"] / (2 * G["half_x"]))
    img = rectify(g, [(410, 225), (1590, 225), (1590, 1075), (410, 1075)], (W, H), 1.92)
    ppm = W / (2 * G["half_x"])
    base = round(1.15 * ppm)
    strip = img.crop((0, H - 2 * base, W, H - base))
    img.paste(strip, (0, H - base))
    save(img, "gate_facade.jpg", 86)
    # inside the great arch: the iwan's back wall, also from the photo
    arch = gate_facades()["gate_pishtaq"]["arches"][0]
    hw = arch["w"] / 2
    x0, x1 = W / 2 - hw * ppm, W / 2 + hw * ppm
    back = img.crop((round(x0), round(H - arch["apex"] * ppm), round(x1), H))
    save(back, "gate_iwan.jpg", 86)
    tower = g.crop((int(268 * 1.92), int(465 * 1.92), int(408 * 1.92), int(1040 * 1.92))).resize((256, 1052), LZ)
    save(tower, "gate_tower.jpg")
    save(g.crop((int(690 * 1.92), int(230 * 1.92), int(1320 * 1.92), int(322 * 1.92))).resize((1536, 224), LZ), "gate_gallery.jpg")


def red_textures(det, sand, marble) -> None:
    """Red sandstone with white marble inlay: the mosque, the jawab, pavilions, walls."""
    fac = mosque_facades()
    for key, spec in fac.items():
        f = Facade(spec["w"], spec["h"], 64, sand, 3.0)
        panels(f, spec["arches"])
        for x0, y0, x1, y1 in spec.get("script", []):
            f.fill(x0 - 0.1, y0 - 0.1, x1 + 0.1, y1 + 0.1, CREAM + (255,))
            (f.tile_x if x1 - x0 > y1 - y0 else f.tile_y)(det["script_h" if x1 - x0 > y1 - y0 else "script_v"], x0, y0, x1, y1)
        for a in spec["arches"]:
            m, hw = a["alfiz"], a["w"] / 2
            f.fill(a["cx"] - hw - m, a["spring"] - 0.1, a["cx"] + hw + m, a["apex"] + m, CREAM + (255,))
        framed_arches(f, spec["arches"], det, white_inlay=True)
        parapet(f, det, spec["h"], white=True)
        save(f.img, f"{key}.jpg")
        for i, a in enumerate(spec["arches"][:2]):
            niche(a, det, sand, f"niche_{key}_{i}.jpg", white=True)
    # generic red walls: white-outlined panels like the gate's wings
    f = Facade(3.0, 3.0, 170, sand, 3.0, x0=0)
    panels(f, [], step=(1.5, 1.0))
    save(f.img, "sandstone_panels.jpg")
    f = Facade(4.0, 7.0, 100, sand, 3.0, x0=0)  # garden walls: a blind arcade
    a = {"cx": 2.0, "y0": 0.4, "w": 3.0, "spring": 3.6, "apex": 5.0, "alfiz": 0.3}
    f.fill(1.0, 0.4, 3.0, 3.6, (140, 66, 48, 255))
    f.inlay_rect(0.2, 0.2, 3.8, 5.6, white=True)
    rope(f, a, width=0.12, white=True)
    f.fill(0, 6.3, 4.0, 7.0, (150, 72, 52, 255))
    save(f.img, "garden_wall.jpg")
    f = Facade(6.0, 7.5, 80, sand, 3.0, x0=0)  # the riverfront terrace: an arcade above the water
    a = {"cx": 3.0, "y0": 1.0, "w": 4.2, "spring": 4.6, "apex": 6.2, "alfiz": 0.3}
    pts = arch_points(a, n=24)
    f.d.polygon([f.p(x, y) for x, y in pts], fill=(120, 58, 42, 255))
    rope(f, a, width=0.14, white=True)
    f.inlay_rect(0.4, 0.6, 5.6, 6.9, white=True)
    save(f.img, "terrace_side.jpg")


def panels(f: Facade, arches, step=(1.6, 1.2)) -> None:
    """Rectangular white-marble cartouches in staggered rows, skipping arch frames."""
    sx, sy = step
    y, row = f.y0 + 0.3, 0
    while y + sy < f.y0 + f.h - 1.0:
        x = f.x0 + 0.2 + (sx / 2 if row % 2 else 0)
        while x + sx < f.x0 + f.w - 0.1:
            inside = any(x + sx > a["cx"] - a["w"] / 2 - a.get("alfiz", 0.5) - 0.2 and x < a["cx"] + a["w"] / 2 + a.get("alfiz", 0.5) + 0.2
                         and y < a["apex"] + a.get("alfiz", 0.5) + 0.2 for a in arches)
            if not inside:
                f.rect(x + 0.08, y + 0.08, x + sx - 0.08, y + sy - 0.08, WHITE_INLAY + (210,), 0.05)
            x += sx
        y += sy
        row += 1


def floors_and_bits(marble, sand) -> None:
    # plinth top: big marble slabs with grey joints
    f = Facade(4.0, 4.0, 256, marble, 4.0, x0=0)
    for k in range(5):
        f.line([(k, 0), (k, 4)], (150, 142, 132, 160), 0.025)
        f.line([(0, k), (4, k)], (150, 142, 132, 160), 0.025)
    save(f.img, "plinth_top.jpg")
    # plinth sides: a blind arcade in marble
    f = Facade(5.3, 6.0, 120, marble, 3.0, x0=0)
    a = {"cx": 2.65, "y0": 0.6, "w": 3.6, "spring": 3.9, "apex": 5.1, "alfiz": 0.3}
    f.d.polygon([f.p(x, y) for x, y in arch_points(a, n=24)], fill=(214, 206, 192, 255))
    rope(f, a, width=0.16)
    f.inlay_rect(0.35, 0.35, 4.95, 5.6)
    f.fill(0, 5.75, 5.3, 6.0, CREAM + (255,))
    save(f.img, "plinth_side.jpg")
    # the terrace floor round the plinth: white marble octagons set into red sandstone four-pointed stars
    f = Facade(3.0, 3.0, 340, sand, 3.0, x0=0)
    marble_px = marble.resize((f.W, f.H), LZ)
    mask = Image.new("L", (f.W, f.H), 0)
    md = ImageDraw.Draw(mask)
    cell, c = 1.5, 0.52
    for i in range(2):
        for j in range(2):
            x0, y0 = i * cell, j * cell
            octo = [(x0 + c, y0), (x0 + cell - c, y0), (x0 + cell, y0 + c), (x0 + cell, y0 + cell - c), (x0 + cell - c, y0 + cell),
                    (x0 + c, y0 + cell), (x0, y0 + cell - c), (x0, y0 + c)]
            # pinch the diagonal edges inward so the red gaps between four octagons become stars
            pts = []
            for k in range(8):
                a, b = octo[k], octo[(k + 1) % 8]
                pts.append(a)
                if k % 2 == 1:
                    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
                    cx, cy = x0 + cell / 2, y0 + cell / 2
                    pts.append((mx + (cx - mx) * -0.18, my + (cy - my) * -0.18))
            md.polygon([f.p(x, y) for x, y in pts], fill=255)
    f.img.paste(marble_px, (0, 0), mask)
    edge = mask.filter(ImageFilter.FIND_EDGES)
    f.img.paste((70, 40, 30), (0, 0), edge)
    save(f.img, "terrace_top.jpg")
    # minaret shafts and colonnettes: marble with black inlay chevrons
    f = Facade(1.0, 2.0, 256, marble, 2.0, x0=0)
    chevrons(f, 0.0, 0.0, 1.0, 2.0)
    f.line([(0, 0), (0, 2)], INK + (200,), 0.03)
    save(f.img, "chevron.jpg")
    f = Facade(1.0, 1.0, 512, marble, 1.0, x0=0)
    f.line([(0.02, 0), (0.02, 1)], INK + (220,), 0.025)
    f.line([(0, 0.98), (1, 0.98)], INK + (200,), 0.02)
    save(f.img, "minaret.jpg")


def gallery() -> None:
    GALLERY.mkdir(parents=True, exist_ok=True)
    credits = json.loads((ROOT / "assets" / "credits.json").read_text(encoding="utf-8"))["photos"]
    keep = {"front_view", "reflection", "beato_1858", "sunrise", "great_gate", "mosque", "side_view", "minaret", "mehtab_bagh",
            "river_terrace", "screen_bourne", "cenotaph_shah_jahan", "aerial_wellcome", "inlay_panels", "pietra_dura_1",
            "relief_dado", "jali_screen", "calligraphy_side", "dome_finial"}
    out = []
    for c in credits:
        if c["key"] not in keep:
            continue
        im = photo(f"{c['key']}.jpg")
        im.thumbnail((1280, 1280), LZ)
        im.save(GALLERY / f"{c['key']}.jpg", quality=82, optimize=True, progressive=True)
        out.append({k: c[k] for k in ("key", "title", "page", "license", "author")} | {"w": im.width, "h": im.height})
    (GALLERY / "credits.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")


def plain(name: str, asset: str, size: int = 1024) -> None:
    save(scan(asset, size=size), name)


def main() -> None:
    global SANDSTONE_RGB
    random.seed(7)
    SANDSTONE_RGB = sample_sandstone()
    print("sandstone colour from the gate photo:", SANDSTONE_RGB)
    marble, sand = marble_tile(), sandstone_tile()
    save(marble, "marble.jpg")
    save(sand, "sandstone.jpg")
    save(scan("Marble012", "NormalGL", 512), "marble_normal.jpg")
    plain("paving.jpg", "PavingStones135")
    plain("grass.jpg", "Grass004")
    plain("ground.jpg", "Ground037")
    det = details()
    for k, im in det.items():
        save(im, f"detail_{k}.jpg")
    tomb_textures(det, marble)
    dome_textures(det, marble)
    interior_textures(det, marble)
    jali_screen()
    gate_textures(det, sand)
    red_textures(det, sand, marble)
    floors_and_bits(marble, sand)
    gallery()
    print("wrote", len(list(OUT.iterdir())), "textures to", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
