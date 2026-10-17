"""Shared 2D geometry for the build: the Mughal arch and a few outlines.

Plain Python (no bpy, no PIL) so both blender/build_taj.py and blender/make_textures.py use the
exact same shapes; a texture drawn around an arch then lines up with the hole cut for it.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

SITE = json.loads((Path(__file__).resolve().parent.parent / "src" / "site.json").read_text(encoding="utf-8"))


def _bezier(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1])


def arch_points(a: dict, cx: float | None = None, n: int = 12) -> list[tuple[float, float]]:
    """Outline of a four-centred (Persian) arch, the Taj's shape: vertical jambs from y0 to the
    springing line, curved shoulders, then nearly straight sides meeting at a point. Runs from the
    bottom of the left jamb, over the apex, to the bottom of the right jamb."""
    cx = a.get("cx", 0.0) if cx is None else cx
    hw, y0, spring, apex = a["w"] / 2, a.get("y0", 0.0), a["spring"], a["apex"]
    rise = apex - spring
    p0, p1 = (cx - hw, spring), (cx - hw, spring + 0.62 * rise)
    p2, p3 = (cx - 0.30 * hw, apex - 0.22 * rise), (cx, apex)
    left = [_bezier(p0, p1, p2, p3, i / n) for i in range(n + 1)]
    right = [(2 * cx - x, y) for x, y in reversed(left[:-1])]
    return [(cx - hw, y0), *left, *right, (cx + hw, y0)]


def arch_y(a: dict, x: float, cx: float = 0.0) -> float:
    """Height of the arch's edge above x (for drawing around it)."""
    pts = arch_points(a, cx, 48)[1:-1]
    x = min(max(x, pts[0][0]), pts[-1][0])
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        if min(x1, x2) <= x <= max(x1, x2) and x1 != x2:
            return y1 + (y2 - y1) * (x - x1) / (x2 - x1)
    return a["apex"]


def octagon(h: float, c: float) -> list[tuple[float, float]]:
    """Square of half-size h with corners cut back by c, counter-clockwise."""
    return [(h - c, -h), (h, -h + c), (h, h - c), (h - c, h), (-h + c, h), (-h, h - c), (-h, -h + c), (-h + c, -h)]


def regular_octagon(ri: float) -> list[tuple[float, float]]:
    return octagon(ri, ri * (1 - math.tan(math.pi / 8)))


def circle(r: float, n: int = 48) -> list[tuple[float, float]]:
    return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]


# ---- the facades, in each slab's own coordinates (x across, y up, metres) -------------------------

T = SITE["tomb"]


def tomb_facades() -> dict[str, dict]:
    p = T["pishtaq"]
    side_w = T["half"] - T["chamfer"] - p["half"]  # one bay beside the pishtaq
    cham_w = T["chamfer"] * math.sqrt(2)
    door = {"cx": 0.0, "y0": 0.0, **p["door"]}
    return {
        "pishtaq": {
            "w": 2 * p["half"], "h": p["h"], "depth": T["depth"] + p["proj"],
            "arches": [{"cx": 0.0, "y0": 0.0, **p["arch"], "alfiz": 0.7, "door": door}],
            "script": [(-9.9, 0.8, -8.95, 22.4), (8.95, 0.8, 9.9, 22.4), (-9.9, 21.45, 9.9, 22.4)],
        },
        "bay": {
            "w": side_w, "h": T["wall_h"], "depth": T["depth"],
            "arches": [{"cx": 0.0, **T["bay"]["lower"], "alfiz": 0.55}, {"cx": 0.0, **T["bay"]["upper"], "alfiz": 0.55}],
            "script": [],
        },
        "chamfer": {
            "w": cham_w, "h": T["wall_h"], "depth": T["depth"],
            "arches": [{"cx": 0.0, **T["chamfer_bay"]["lower"], "alfiz": 0.5}, {"cx": 0.0, **T["chamfer_bay"]["upper"], "alfiz": 0.5}],
            "script": [],
        },
    }


G = SITE["gate"]


def gate_facades() -> dict[str, dict]:
    """The Great Gate, matched to the straight-on photo (36.5 px per metre)."""
    wing_arches = []
    for cx in (-11.9, 11.9):
        wing_arches += [{"cx": cx, "y0": 0.95, "w": 4.4, "spring": 4.8, "apex": 6.3, "alfiz": 0.5},
                        {"cx": cx, "y0": 7.5, "w": 4.4, "spring": 11.9, "apex": 13.3, "alfiz": 0.5}]
    return {
        "gate_wings": {"w": 2 * G["half_x"], "h": G["wing_h"], "depth": 2.0, "arches": wing_arches},
        "gate_pishtaq": {
            "w": 2 * G["pishtaq_half"], "h": G["pishtaq_h"], "depth": 7.0,
            "arches": [{"cx": 0.0, "y0": 0.0, "w": 12.05, "spring": 10.3, "apex": 15.3, "alfiz": 0.6,
                        "door": {"cx": 0.0, "y0": 0.0, "w": 2 * G["passage_half"], "spring": 4.4, "apex": G["passage_h"]}}],
        },
    }


M = SITE["mosque"]


def mosque_facades() -> dict[str, dict]:
    arches = [{"cx": cx, "y0": 0.0, "w": 5.4, "spring": 6.4, "apex": 8.8, "alfiz": 0.6} for cx in (-4.6, 4.6)]
    return {
        "mosque_wing": {"w": 20.5, "h": M["h"], "depth": 3.0, "arches": arches},
        "mosque_pishtaq": {
            "w": 15.0, "h": 20.0, "depth": 4.0,
            "arches": [{"cx": 0.0, "y0": 0.0, "w": 9.6, "spring": 9.6, "apex": 14.6, "alfiz": 0.6,
                        "door": {"cx": 0.0, "y0": 0.0, "w": 3.6, "spring": 4.4, "apex": 6.2}}],
            "script": [(-6.9, 0.8, -6.1, 17.0), (6.1, 0.8, 6.9, 17.0), (-6.9, 16.2, 6.9, 17.0)],
        },
        "pavilion": {
            "w": 30.0, "h": 12.0, "depth": 2.0,
            "arches": [{"cx": 0.0, "y0": 0.0, "w": 7.0, "spring": 5.5, "apex": 9.0, "alfiz": 0.6},
                       {"cx": -9.0, "y0": 0.8, "w": 5.0, "spring": 5.0, "apex": 7.6, "alfiz": 0.5},
                       {"cx": 9.0, "y0": 0.8, "w": 5.0, "spring": 5.0, "apex": 7.6, "alfiz": 0.5}],
        },
    }
