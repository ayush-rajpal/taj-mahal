"""Build the whole Taj Mahal complex in Blender and export it for the web.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P blender/build_taj.py

Run blender/make_textures.py first. Writes:
  public/models/taj_mahal.glb   the complex (Draco-compressed, textures embedded)
  src/colliders.json            floors, walls and water the visitor can't walk through
  blender/taj_mahal.blend       the scene, to open and tweak in Blender

Everything is built from code in metres, in the world's own axes (+x east, -z north, y up) and
converted to Blender's z-up axes only when a mesh is created; the glTF exporter converts back.
Proportions come from src/site.json (see the note there on sources).
"""

from __future__ import annotations

import json
import math
import os
import random
import sys
import time
from contextlib import contextmanager
from math import cos, hypot, pi, radians, sin, sqrt, tan

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.geometry import tessellate_polygon

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from archgeo import SITE, arch_points, circle, gate_facades, mosque_facades, octagon, regular_octagon, tomb_facades  # noqa: E402

ROOT = os.path.dirname(HERE)
TEX = os.path.join(HERE, "textures")
GLB = os.path.join(ROOT, "public", "models", "taj_mahal.glb")
COLLIDERS = os.path.join(ROOT, "src", "colliders.json")
LV = SITE["levels"]
S = SITE["site"]
T = SITE["tomb"]
random.seed(1632)  # the year building began

# ---------------------------------------------------------------------------------------------------
# materials
# ---------------------------------------------------------------------------------------------------

MAT: dict[str, bpy.types.Material] = {}


def material(name: str, image: str | None = None, color=(1, 1, 1), rough: float = 0.6, metal: float = 0.0,
             normal: str | None = None, alpha: bool = False, emit=None, double: bool = False) -> None:
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    if image:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(os.path.join(TEX, image))
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha:
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            m.surface_render_method = "DITHERED"
    if normal:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt_img = nt.nodes.new("ShaderNodeTexImage")
        nt_img.image = bpy.data.images.load(os.path.join(TEX, normal))
        nt_img.image.colorspace_settings.name = "Non-Color"
        nm.inputs["Strength"].default_value = 0.6
        nt.links.new(nt_img.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = 3.0
    m.use_backface_culling = not double
    MAT[name] = m


def make_materials() -> None:
    material("marble", "marble.jpg", rough=0.32, normal="marble_normal.jpg")
    material("sandstone", "sandstone.jpg", rough=0.85)
    material("sand_panels", "sandstone_panels.jpg", rough=0.85)
    material("gold", None, (0.86, 0.66, 0.28), rough=0.28, metal=1.0)
    for n in ("tomb_pishtaq", "tomb_bay", "tomb_chamfer", "niche_pishtaq", "niche_bay_lower", "niche_bay_upper",
              "niche_chamfer_lower", "niche_chamfer_upper", "drum", "dome", "plinth_side", "plinth_top", "chevron",
              "minaret", "chamber_wall", "chamber_door", "cenotaph"):
        material(n, f"{n}.jpg", rough=0.36)
    material("inner_dome", "inner_dome.jpg", rough=0.45)
    material("jali", "jali.png", rough=0.4, alpha=True, double=True)
    material("lamp_glass", None, (1.0, 0.75, 0.4), rough=0.3, emit=(1.0, 0.62, 0.25))
    for n in ("gate_facade", "gate_tower", "gate_gallery", "mosque_wing", "mosque_pishtaq", "pavilion",
              "niche_mosque_wing_0", "niche_mosque_pishtaq_0", "niche_pavilion_0", "niche_pavilion_1",
              "terrace_side", "garden_wall"):
        material(n, f"{n}.jpg", rough=0.82)
    material("terrace_top", "terrace_top.jpg", rough=0.8)
    material("paving", "paving.jpg", rough=0.85)
    material("grass", "grass.jpg", rough=1.0)
    material("ground", "ground.jpg", rough=1.0)
    material("water", None, (0.16, 0.27, 0.28), rough=0.05)
    material("pool_floor", None, (0.22, 0.26, 0.24), rough=0.9)
    material("cypress", None, (0.13, 0.25, 0.12), rough=0.9)
    material("leaves", None, (0.22, 0.36, 0.14), rough=0.9)
    material("leaves_dark", None, (0.15, 0.28, 0.11), rough=0.9)
    material("trunk", None, (0.30, 0.22, 0.15), rough=1.0)
    material("door_wood", None, (0.24, 0.14, 0.08), rough=0.7)


# ---------------------------------------------------------------------------------------------------
# mesh builder: faces in world (y-up) coordinates, converted once at the end
# ---------------------------------------------------------------------------------------------------

def newell(pts):
    nx = ny = nz = 0.0
    for i, (x1, y1, z1) in enumerate(pts):
        x2, y2, z2 = pts[(i + 1) % len(pts)]
        nx += (y1 - y2) * (z1 + z2)
        ny += (z1 - z2) * (x1 + x2)
        nz += (x1 - x2) * (y1 + y2)
    return nx, ny, nz


class MB:
    """Collects faces (each with its own UVs and material), merges coincident vertices on build."""

    def __init__(self, name: str):
        self.name = name
        self.v: list[tuple] = []
        self.f: list[tuple] = []
        self.uv: list[tuple] = []
        self.fm: list[int] = []
        self.mats: list[str] = []
        self.M = Matrix.Identity(4)

    def mi(self, name: str) -> int:
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def face(self, pts, uvs, mat: str, normal=None) -> None:
        M = self.M
        pts = [tuple(M @ Vector(p)) for p in pts]
        if normal is not None:
            n = M.to_3x3() @ Vector(normal)
            w = newell(pts)
            if w[0] * n.x + w[1] * n.y + w[2] * n.z < 0:
                pts, uvs = pts[::-1], uvs[::-1]
        b = len(self.v)
        self.v.extend(pts)
        self.uv.extend(uvs)
        self.f.append(tuple(range(b, b + len(pts))))
        self.fm.append(self.mi(mat))

    @contextmanager
    def frame(self, M: Matrix):
        old = self.M
        self.M = old @ M
        try:
            yield
        finally:
            self.M = old

    def build(self, sharp_deg: float = 32, collection=None) -> bpy.types.Object:
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([(x, -z, y) for x, y, z in self.v], [], self.f)
        uvl = me.uv_layers.new(name="UVMap")
        uvl.data.foreach_set("uv", [c for uv in self.uv for c in uv])
        me.polygons.foreach_set("material_index", self.fm)
        for n in self.mats:
            me.materials.append(MAT[n])
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0004)
        bm.to_mesh(me)
        bm.free()
        me.shade_smooth()
        me.set_sharp_from_angle(angle=radians(sharp_deg))
        ob = bpy.data.objects.new(self.name, me)
        (collection or bpy.context.scene.collection).objects.link(ob)
        print(f"  {self.name}: {len(me.polygons):,} faces, {len(self.mats)} materials")
        return ob


def T4(x=0.0, y=0.0, z=0.0) -> Matrix:
    return Matrix.Translation((x, y, z))


def RY(a: float) -> Matrix:
    return Matrix.Rotation(a, 4, "Y")


def MIRROR_X() -> Matrix:
    return Matrix.Scale(-1, 4, Vector((1, 0, 0)))


def area2(loop) -> float:
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(loop, loop[1:] + loop[:1])) / 2


def dedupe(loop):
    out = []
    for p in loop:
        if not out or hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > 1e-5:
            out.append(p)
    if len(out) > 2 and hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) < 1e-5:
        out.pop()
    return out


def wall_uv(tu: float = 3.0, tv: float = 3.0, upright: bool = False, v_off: float = 0.0):
    """UVs for extruded side walls: u runs along the outline, v across the depth (or upward)."""
    def f(s, L, d):
        if upright:  # extruded downward from a top face: v grows with height
            return [(s / tu, (d + v_off) / tv), ((s + L) / tu, (d + v_off) / tv), ((s + L) / tu, v_off / tv), (s / tu, v_off / tv)]
        return [(s / tu, 0), ((s + L) / tu, 0), ((s + L) / tu, d / tv), (s / tu, d / tv)]
    return f


def extrude(mb: MB, outer, holes, depth: float, O, U, V, N, front: str, wall: str | None = None, back: str | None = None,
            uv_front=None, uv_back=None, uv_wall=None, walls: bool = True) -> None:
    """A flat shape (outer loop + holes, in (u, v)) given thickness: P(u, v, d) = O + U*u + V*v - N*d.
    The front face points along N. This is how every wall, slab, floor and prism is made."""
    O, U, V, N = (Vector(a) for a in (O, U, V, N))
    outer = dedupe(list(outer))
    holes = [dedupe(list(h)) for h in holes]
    if area2(outer) < 0:
        outer.reverse()
    holes = [h if area2(h) < 0 else h[::-1] for h in holes]
    loops = [outer] + holes
    flat = [p for loop in loops for p in loop]
    P = lambda u, v, d: tuple(O + U * u + V * v - N * d)
    uv_front = uv_front or (lambda u, v: (u / 3, v / 3))
    tris = tessellate_polygon([[Vector((u, v, 0)) for u, v in loop] for loop in loops])
    for t in tris:
        q = [flat[i] for i in t]
        mb.face([P(u, v, 0) for u, v in q], [uv_front(u, v) for u, v in q], front, tuple(N))
        if back and depth > 0:
            mb.face([P(u, v, depth) for u, v in q], [(uv_back or uv_front)(u, v) for u, v in q], back, tuple(-N))
    if not walls or depth <= 0:
        return
    uv_wall = uv_wall or wall_uv()
    for loop in loops:
        s = 0.0
        for i in range(len(loop)):
            (u1, v1), (u2, v2) = loop[i], loop[(i + 1) % len(loop)]
            L = hypot(u2 - u1, v2 - v1)
            if L < 1e-6:
                continue
            nu, nv = (v2 - v1) / L, -(u2 - u1) / L
            n3 = tuple(U * nu + V * nv)
            mb.face([P(u1, v1, 0), P(u2, v2, 0), P(u2, v2, depth), P(u1, v1, depth)], uv_wall(s, L, depth), wall or front, n3)
            s += L


def prism(mb: MB, outer, y0: float, y1: float, top: str, side: str, holes=(), bottom: str | None = None,
          tile_top: float = 3.0, side_uv=None) -> None:
    """A vertical prism from a plan outline in (x, z)."""
    extrude(mb, outer, holes, y1 - y0, (0, y1, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0), top, side, bottom,
            uv_front=lambda u, v: (u / tile_top, -v / tile_top), uv_wall=side_uv or wall_uv(3, 3, upright=True))


def box(mb: MB, x0, x1, y0, y1, z0, z1, mat: str, top: str | None = None, tile: float = 3.0, side_uv=None) -> None:
    prism(mb, [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0, y1, top or mat, mat, tile_top=tile,
          side_uv=side_uv or wall_uv(tile, tile, upright=True))


def lathe(mb: MB, prof, segs: int, mat: str, c=(0, 0, 0), u_rep: float = 1.0, v_mode: str = "arc", inward: bool = False,
          a0: float = 0.0, v_tile: float = 3.0) -> None:
    """Spin a profile [(r, y), ...] (bottom to top) round a vertical axis through c."""
    cx, cy, cz = c
    acc = [0.0]
    for (r1, y1), (r2, y2) in zip(prof, prof[1:]):
        acc.append(acc[-1] + hypot(r2 - r1, y2 - y1))
    total = acc[-1] or 1
    for k in range(segs):
        a1, a2 = a0 + 2 * pi * k / segs, a0 + 2 * pi * (k + 1) / segs
        am = (a1 + a2) / 2
        for j, ((r1, y1), (r2, y2)) in enumerate(zip(prof, prof[1:])):
            if r1 < 1e-6 and r2 < 1e-6:
                continue
            p = [(cx + r1 * sin(a1), cy + y1, cz + r1 * cos(a1)), (cx + r1 * sin(a2), cy + y1, cz + r1 * cos(a2)),
                 (cx + r2 * sin(a2), cy + y2, cz + r2 * cos(a2)), (cx + r2 * sin(a1), cy + y2, cz + r2 * cos(a1))]
            if v_mode == "arc":
                v1, v2 = acc[j] / total, acc[j + 1] / total
            else:  # metres up the side
                v1, v2 = acc[j] / v_tile, acc[j + 1] / v_tile
            u1, u2 = k / segs * u_rep, (k + 1) / segs * u_rep
            uvs = [(u1, v1), (u2, v1), (u2, v2), (u1, v2)]
            n = (sin(am) * (y2 - y1), r1 - r2, cos(am) * (y2 - y1))
            if inward:
                n = tuple(-a for a in n)
            if r2 < 1e-6:
                p, uvs = p[:3], uvs[:3]
            elif r1 < 1e-6:
                p, uvs = [p[0], p[2], p[3]], [uvs[0], uvs[2], uvs[3]]
            mb.face(p, uvs, mat, n)


def smooth_profile(points, n: int = 64):
    """Catmull-Rom through the control points, resampled evenly."""
    pts = [Vector((r, y, 0)) for r, y in points]
    ext = [pts[0] * 2 - pts[1], *pts, pts[-1] * 2 - pts[-2]]
    dense = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(12):
            t = k / 12
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    dense.append(pts[-1])
    lens = [0.0]
    for a, b in zip(dense, dense[1:]):
        lens.append(lens[-1] + (b - a).length)
    out, j = [], 0
    for k in range(n + 1):
        target = lens[-1] * k / n
        while j < len(lens) - 2 and lens[j + 1] < target:
            j += 1
        t = (target - lens[j]) / max(1e-9, lens[j + 1] - lens[j])
        p = dense[j].lerp(dense[j + 1], t)
        out.append((max(0.0, p.x), p.y))
    return out


DOME = smooth_profile(T["dome"], 72)  # the measured onion profile, base radius 12.3 m, 19.6 m tall


def onion(mb: MB, base_r: float, height: float, c, mat: str, segs: int = 32, u_rep: float = 1.0) -> None:
    sr, sh = base_r / T["dome"][0][0], height / T["dome"][-1][1]
    lathe(mb, [(r * sr, y * sh) for r, y in DOME], segs, mat, c, u_rep=u_rep)


FINIAL = [(0, 0), (0.11, 0), (0.13, 0.03), (0.07, 0.07), (0.115, 0.14), (0.12, 0.2), (0.08, 0.26), (0.055, 0.3), (0.09, 0.36),
          (0.095, 0.41), (0.055, 0.46), (0.035, 0.5), (0.06, 0.55), (0.055, 0.6), (0.028, 0.64), (0.02, 0.8), (0, 0.8)]


def finial(mb: MB, c, h: float, segs: int = 16) -> None:
    cx, cy, cz = c
    lathe(mb, [(r * h, y * h) for r, y in FINIAL], segs, "gold", c)
    # the crescent moon on top, horns up, facing south
    R, tube, n = 0.085 * h, 0.014 * h, 20
    a0, a1 = pi * 0.85 + pi / 2 - pi / 2, pi * 2.15
    for i in range(n):
        t1, t2 = a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1) / n
        for k in range(6):
            b1, b2 = 2 * pi * k / 6, 2 * pi * (k + 1) / 6
            def P(t, b):
                rr = R + tube * cos(b)
                return (cx + rr * cos(t), cy + 0.89 * h + rr * sin(t), cz + tube * sin(b))
            mid_t, mid_b = (t1 + t2) / 2, (b1 + b2) / 2
            n3 = (cos(mid_t) * cos(mid_b), sin(mid_t) * cos(mid_b), sin(mid_b))
            mb.face([P(t1, b1), P(t2, b1), P(t2, b2), P(t1, b2)], [(0, 0)] * 4, "gold", n3)
    lathe(mb, [(0.01 * h, 0.8 * h), (0.008 * h, 0.95 * h), (0, 0.97 * h)], 6, "gold", c)


def octagonal(mb: MB, c, r: float, y0: float, y1: float, mat: str, top: str | None = None, u_rep: float = 8, v_tile: float = 3.0) -> None:
    """An octagonal shaft with flat faces (circumradius r)."""
    lathe(mb, [(r, 0), (r, y1 - y0)], 8, mat, (c[0], y0, c[1]), u_rep=u_rep, v_mode="m", a0=pi / 8, v_tile=v_tile)
    lathe(mb, [(r, y1 - y0), (0, y1 - y0)], 8, top or mat, (c[0], y0, c[1]), a0=pi / 8)


def chhatri(mb: MB, c, r: float, col_h: float, stone: str = "marble", dome: str = "marble", segs: int = 24, panels: bool = True) -> float:
    """A domed kiosk on eight columns. Returns the height of its top."""
    cx, cy, cz = c
    y = cy
    octagonal(mb, (cx, cz), r * 1.08, y, y + 0.12 * r, stone)
    y += 0.12 * r
    ring = r * 0.9
    for k in range(8):
        a = pi / 8 + k * pi / 4
        lathe(mb, [(0.065 * r, 0), (0.06 * r, col_h)], 8, stone, (cx + ring * sin(a), y, cz + ring * cos(a)))
    if panels:  # arched openings between the columns
        side = 2 * ring * sin(pi / 8)
        apo = ring * cos(pi / 8)
        a_spec = {"cx": 0.0, "y0": 0.0, "w": side * 0.8, "spring": col_h * 0.5, "apex": col_h * 0.86}
        outline = [(-side / 2, 0), *arch_points(a_spec, n=6), (side / 2, 0), (side / 2, col_h), (-side / 2, col_h)]
        for k in range(8):
            a = k * pi / 4
            with mb.frame(T4(cx + apo * sin(a), y, cz + apo * cos(a)) @ RY(a)):
                extrude(mb, outline, [], 0.08 * r, (0, 0, 0.04 * r), (1, 0, 0), (0, 1, 0), (0, 0, 1), stone, stone, stone)
    y += col_h
    octagonal(mb, (cx, cz), r * 0.95, y, y + 0.12 * r, stone)
    y += 0.12 * r
    lathe(mb, [(0.9 * r, 0), (1.22 * r, 0), (0.92 * r, 0.15 * r)], 8, stone, (cx, y, cz), a0=pi / 8)  # sloping eave
    y += 0.15 * r
    lathe(mb, [(0.82 * r, 0), (0.82 * r, 0.1 * r)], segs, stone, (cx, y, cz))
    y += 0.1 * r
    onion(mb, 0.82 * r, 1.0 * r, (cx, y, cz), dome, segs)
    y += 0.98 * r
    finial(mb, (cx, y, cz), 0.5 * r, 10)
    return y + 0.5 * r


def guldasta(mb: MB, c, y0: float, h: float, r: float = 0.4, stone: str = "chevron") -> None:
    cx, cz = c
    lathe(mb, [(r, 0), (r * 0.9, h * 0.8)], 8, stone, (cx, y0, cz), u_rep=2, v_mode="m", v_tile=2)
    lathe(mb, [(r * 0.9, h * 0.8), (r * 1.5, h * 0.82), (r * 1.4, h * 0.86), (r * 0.6, h * 0.86)], 8, "marble", (cx, y0, cz))
    lathe(mb, [(r * 0.7, h * 0.86), (r * 1.05, h * 0.9), (r * 0.6, h * 0.97), (0, h)], 8, "marble", (cx, y0, cz))


def facade(mb: MB, spec: dict, tex: str, side: str, niche_mats, uvmap=None, niche_uv=None) -> None:
    """A wall slab in the current frame: front face on z = 0 facing +z, x across (centred), y up,
    `depth` deep toward -z, with its arches cut through and a textured back wall in each alcove."""
    w, h, d = spec["w"], spec["h"], spec["depth"]
    ground = sorted([a for a in spec["arches"] if a.get("y0", 0) <= 1e-3], key=lambda a: a["cx"])
    outline = [(-w / 2, 0)]
    for a in ground:
        outline += arch_points(a)
    outline += [(w / 2, 0), (w / 2, h), (-w / 2, h)]
    holes = [arch_points(a) for a in spec["arches"] if a.get("y0", 0) > 1e-3]
    uvf = uvmap or (lambda u, v: (u / w + 0.5, v / h))
    extrude(mb, outline, holes, d, (0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1), tex, side, side, uv_front=uvf)
    for i, a in enumerate(spec["arches"]):
        pts = arch_points(a)
        if a.get("door"):
            pts = pts + arch_points({**a["door"], "y0": a.get("y0", 0)})[::-1]
        y0, hh, x0 = a.get("y0", 0), a["apex"] - a.get("y0", 0), a["cx"] - a["w"] / 2
        uvn = niche_uv or (lambda u, v, x0=x0, y0=y0, hh=hh, ww=a["w"]: ((u - x0) / ww, (v - y0) / hh))
        extrude(mb, pts, [], 0, (0, 0, -(d - 0.03)), (1, 0, 0), (0, 1, 0), (0, 0, 1), niche_mats(i, a), uv_front=uvn, walls=False)


# ---------------------------------------------------------------------------------------------------
# collision data for the world (read by src/layout.js)
# ---------------------------------------------------------------------------------------------------

COL = {"platforms": [], "boxes": [], "circles": [], "water": []}


def platform(x0, x1, z0, z1, h=None, h0=None, h1=None):
    p = {"x0": round(x0, 3), "x1": round(x1, 3), "z0": round(z0, 3), "z1": round(z1, 3)}
    if h is not None:
        p["h"] = round(h, 3)
    else:  # ramp: h0 at the south end (z1) rising to h1 at the north end (z0)
        p["h0"], p["h1"] = round(h0, 3), round(h1, 3)
    COL["platforms"].append(p)


def solid(x0, x1, z0, z1, y0=None, y1=None):
    b = {"x0": round(min(x0, x1), 3), "x1": round(max(x0, x1), 3), "z0": round(min(z0, z1), 3), "z1": round(max(z0, z1), 3)}
    if y0 is not None:
        b["y0"], b["y1"] = y0, y1
    COL["boxes"].append(b)


def post(x, z, r):
    COL["circles"].append({"x": round(x, 3), "z": round(z, 3), "r": round(r, 3)})


# ---------------------------------------------------------------------------------------------------
# the tomb
# ---------------------------------------------------------------------------------------------------

def build_tomb() -> None:
    mb = MB("Taj_Mausoleum")
    P0 = LV["plinth"]
    H, C, D = T["half"], T["chamfer"], T["depth"]
    HC = H - D
    KC = 2 * H - C - D * sqrt(2) - HC
    ch = T["chamber"]
    RI, CW, CH = ch["ri"], ch["corridor_half"], ch["corridor_h"]
    roof = T["roof_h"]
    with mb.frame(T4(0, P0, 0)):
        # the core: four solid corners round the corridors, then a ring round the chamber up to the roof
        q = [(CW, RI), (CW, HC), (KC, HC), (HC, KC), (HC, CW), (RI, CW), (RI, RI * tan(pi / 8)), (RI * tan(pi / 8), RI)]
        for sx in (-1, 1):
            for sz in (-1, 1):
                prism(mb, [(x * sx, z * sz) for x, z in q], 0, CH, "marble", "marble")
        prism(mb, octagon(HC, HC - KC), CH, roof, "marble", "marble", holes=[regular_octagon(RI)])
        # facades: pishtaq and two bays on each side, an alcove pair on each chamfered corner
        fac = tomb_facades()
        p = T["pishtaq"]
        side_w = fac["bay"]["w"]
        for k in range(4):
            phi = k * pi / 2
            with mb.frame(RY(phi) @ T4(0, 0, H + p["proj"])):
                facade(mb, fac["pishtaq"], "tomb_pishtaq", "marble", lambda i, a: "niche_pishtaq")
            for s in (-1, 1):
                with mb.frame(RY(phi) @ T4(s * (p["half"] + side_w / 2), 0, H)):
                    facade(mb, fac["bay"], "tomb_bay", "marble", lambda i, a: ("niche_bay_lower", "niche_bay_upper")[i])
            with mb.frame(RY(phi + pi / 4) @ T4(0, 0, (2 * H - C) / sqrt(2))):
                facade(mb, fac["chamfer"], "tomb_chamfer", "marble", lambda i, a: ("niche_chamfer_lower", "niche_chamfer_upper")[i])
            # carved wooden doors at the back of the ground-floor alcoves (the corridors stay open)
            with mb.frame(RY(phi)):
                for s in (-1, 1):
                    lo = T["bay"]["lower"]
                    x = s * (p["half"] + side_w / 2)
                    dw = 1.5
                    extrude(mb, [(x - dw, 0), (x + dw, 0), (x + dw, 3.6), (x - dw, 3.6)], [], 0, (0, 0, HC + 0.05), (1, 0, 0), (0, 1, 0),
                            (0, 0, 1), "door_wood")
        # guldastas: pinnacles at the eight corners of the octagon and beside each pishtaq
        for k in range(4):
            phi = k * pi / 2
            with mb.frame(RY(phi)):
                for s in (-1, 1):
                    guldasta(mb, (s * (H - C), H - 0.3), T["wall_h"], 5.8)
                    guldasta(mb, (s * (p["half"] - 0.25), H + p["proj"] - 0.3), p["h"], 4.5)
        # roof, drum, dome, finial
        lathe(mb, [(T["drum"]["r"] + 0.4, roof), (T["drum"]["r"] + 0.4, roof + 0.5), (T["drum"]["r"], roof + 0.5)], 96, "marble")
        lathe(mb, [(T["drum"]["r"], roof + 0.5), (T["drum"]["r"], T["drum"]["top"])], 96, "drum", u_rep=16)
        top = T["drum"]["top"]
        lathe(mb, [(T["drum"]["r"], top - 0.6), (T["drum"]["r"] + 0.35, top - 0.4), (T["drum"]["r"] + 0.35, top - 0.1), (T["drum"]["r"], top)], 96, "marble")
        lathe(mb, [(r, top + y) for r, y in DOME], 96, "dome", u_rep=1)
        finial(mb, (0, T["finial"]["base"], 0), T["finial"]["h"], 20)
        at = T["chhatri"]["at"]
        for sx in (-1, 1):
            for sz in (-1, 1):
                chhatri(mb, (sx * at, roof, sz * at), T["chhatri"]["r"], 4.4)
        interior(mb)
    mb.build()


def interior(mb: MB) -> None:
    ch = T["chamber"]
    RI, wall_h = ch["ri"], ch["wall_h"]
    wf = 2 * RI * tan(pi / 8)
    door = {"cx": 0.0, "y0": 0.0, **T["pishtaq"]["door"]}
    for k in range(8):
        phi = k * pi / 4
        has_door = k % 2 == 0
        outline = [(-wf / 2, 0), *(arch_points(door) if has_door else []), (wf / 2, 0), (wf / 2, wall_h), (-wf / 2, wall_h)]
        with mb.frame(RY(phi + pi) @ T4(0, 0, -(RI - 0.04))):
            extrude(mb, outline, [], 0, (0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1), "chamber_door" if has_door else "chamber_wall",
                    uv_front=lambda u, v: (u / wf + 0.5, v / wall_h), walls=False)
    R = RI / cos(pi / 8)
    lathe(mb, [(R * cos(a), wall_h + R * sin(a)) for a in [i * pi / 2 / 24 for i in range(25)]], 48, "inner_dome", inward=True)
    # the jali screen round the cenotaphs
    rj, hj = ch["jali_ri"], ch["jali_h"]
    wj = 2 * rj * tan(pi / 8)
    for k in range(8):
        phi = k * pi / 4
        with mb.frame(RY(phi) @ T4(0, 0, rj)):
            mb.face([(-wj / 2, 0, 0), (wj / 2, 0, 0), (wj / 2, hj, 0), (-wj / 2, hj, 0)], [(0, 0), (1, 0), (1, 1), (0, 1)], "jali", (0, 0, 1))
        a = phi + pi / 8
        vr = rj / cos(pi / 8)
        lathe(mb, [(0.08, 0), (0.08, hj + 0.15), (0.13, hj + 0.25), (0, hj + 0.4)], 8, "marble", (vr * sin(a), 0, vr * cos(a)))
    prism(mb, regular_octagon(rj + 0.07), hj, hj + 0.12, "marble", "marble", holes=[regular_octagon(rj - 0.07)])
    # cenotaphs: Mumtaz Mahal at the exact centre, Shah Jahan's (added later) beside her to the west
    for x, s, top in ((0.0, 1.0, "slate"), (-2.35, 1.12, "pen")):
        def b(w, h, d, y):
            box(mb, x - w * s / 2, x + w * s / 2, y * s, (y + h) * s, -d * s / 2, d * s / 2, "cenotaph", tile=1.2)
        b(2.0, 0.3, 3.3, 0)
        b(1.55, 0.4, 2.9, 0.3)
        b(1.0, 0.55, 2.5, 0.7)
        if top == "slate":
            b(0.42, 0.12, 1.9, 1.25)
        else:
            b(0.28, 0.24, 1.15, 1.25)
    # the lamp Lord Curzon gave, hanging from the inner dome
    lamp_y = 5.6
    lathe(mb, [(0.03, lamp_y + 1.0), (0.03, wall_h + R - 0.2)], 6, "gold")
    lathe(mb, [(0, 0), (0.2, 0.05), (0.42, 0.3), (0.45, 0.55), (0.3, 0.8), (0.12, 0.92), (0.06, 1.0), (0, 1.02)], 12, "gold", (0, lamp_y, 0))
    lathe(mb, [(0, 0.25), (0.3, 0.32), (0.34, 0.55), (0.2, 0.75), (0, 0.78)], 12, "lamp_glass", (0, lamp_y, 0))


def build_plinth() -> None:
    mb = MB("Taj_Plinth")
    h = SITE["plinth"]["half"]
    sx, sh, sl = SITE["plinth"]["stair_x"], SITE["plinth"]["stair_half"], SITE["plinth"]["stair_len"]
    y0, y1 = LV["terrace"], LV["plinth"]
    # the only way up: two flights of stairs cut into the south face, one either side of the centre
    outline = [(-h, -h), (h, -h), (h, h)]
    for cx in (sx, -sx):
        outline += [(cx + sh, h), (cx + sh, h - sl), (cx - sh, h - sl), (cx - sh, h)]
    outline += [(-h, h)]
    prism(mb, outline, y0, y1, "plinth_top", "plinth_side", tile_top=4, side_uv=wall_uv(5.3, y1 - y0, upright=True))
    n = 20
    for cx in (-sx, sx):
        for k in range(n):
            z1 = h - sl * k / n
            z0 = h - sl * (k + 1) / n
            box(mb, cx - sh, cx + sh, y0, y0 + (y1 - y0) * (k + 1) / n, z0, z1, "marble", "plinth_top")
        platform(cx - sh, cx + sh, h - sl, h, h0=y0, h1=y1)
    platform(-h, h, -h, h - sl, h=y1)
    for a, b in ((-h, -sx - sh), (-sx + sh, sx - sh), (sx + sh, h)):
        platform(a, b, h - sl, h, h=y1)
    # minarets at the four corners, each leaning very slightly outward
    m = SITE["minaret"]
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * m["at"], sz * m["at"]
            lean = Matrix.Rotation(radians(0.5) * -sx, 4, "Z") @ Matrix.Rotation(radians(0.5) * sz, 4, "X")
            with mb.frame(T4(x, y1, z) @ lean):
                minaret(mb)
            post(x, z, 3.9)
    mb.build()


def minaret(mb: MB) -> None:
    octagonal(mb, (0, 0), 3.9, 0, 1.6, "plinth_side", "marble", u_rep=8, v_tile=6)
    sections = [(1.6, 13.4, 3.0, 2.8), (13.4, 24.6, 2.75, 2.55), (24.6, 33.0, 2.5, 2.35)]
    for y0, y1, rb, rt in sections:
        lathe(mb, [(rb, y0), (rt, y1)], 32, "minaret", u_rep=round(2 * pi * rb), v_mode="m", v_tile=1.0)
        lathe(mb, [(rt, y1 - 1.0), (rt + 0.95, y1)], 32, "marble")                      # corbels
        lathe(mb, [(rt + 0.95, y1), (rt + 1.0, y1 + 0.3), (rt, y1 + 0.3)], 32, "marble")  # balcony floor
        lathe(mb, [(rt + 0.92, y1 + 0.3), (rt + 0.92, y1 + 1.2), (rt + 0.98, y1 + 1.25), (rt + 0.98, y1 + 0.3)], 32, "marble")
        lathe(mb, [(rt + 0.86, y1 + 1.2), (rt + 0.86, y1 + 0.3)], 32, "marble")          # railing, inside face
    chhatri(mb, (0, 33.3, 0), 2.5, 2.6, segs=20)


# ---------------------------------------------------------------------------------------------------
# the great gate, the mosque and its mirror, pavilions, towers, walls
# ---------------------------------------------------------------------------------------------------

def build_gate() -> None:
    mb = MB("Great_Gate")
    G = SITE["gate"]
    fac = gate_facades()
    hx, hz = G["half_x"], G["half_z"]
    W, Ht = 2 * hx, G["gallery_h"]
    atlas = lambda u, v: (u / W + 0.5, v / Ht)  # both slabs and every alcove read the same straight-on photo
    pw, ph = G["pishtaq_half"], G["pishtaq_h"]
    arch = fac["gate_pishtaq"]["arches"][0]
    iw = arch["w"] / 2
    pd = fac["gate_pishtaq"]["depth"]
    with mb.frame(T4(0, 0, G["z"])):
        for flip in (0, 1):  # garden side (north) and forecourt side (south) look the same
            with mb.frame(RY(pi * flip + pi)):
                with mb.frame(T4(0, 0, hz + 1.0)):
                    facade(mb, fac["gate_pishtaq"], "gate_facade", "sandstone", lambda i, a: "gate_facade", atlas, atlas)
                # the wing slabs stop at the pishtaq on each side, so nothing closes off the iwan and passage behind it
                wings = fac["gate_wings"]
                for s in (-1, 1):
                    c = s * (pw + hx) / 2
                    half = {**wings, "w": hx - pw, "arches": [{**a, "cx": a["cx"] - c} for a in wings["arches"] if a["cx"] * s > 0]}
                    shifted = lambda u, v, c=c: atlas(u + c, v)
                    with mb.frame(T4(c, 0, hz)):
                        facade(mb, half, "gate_facade", "sandstone", lambda i, a: "gate_facade", shifted, shifted)
                # the gallery on top of the pishtaq, with eleven small domes
                extrude(mb, [(-pw, ph), (pw, ph), (pw, Ht), (-pw, Ht)], [], 3.0, (0, 0, hz + 1.0), (1, 0, 0), (0, 1, 0), (0, 0, 1),
                        "gate_gallery", "sandstone", "sandstone", uv_front=lambda u, v: (u / (2 * pw) + 0.5, (v - ph) / (Ht - ph)))
                for k in range(11):
                    chhatri(mb, (-pw + 0.85 + k * (2 * pw - 1.7) / 10, Ht, hz - 0.3), 0.72, 0.9, segs=12, panels=False)
                for s in (-1, 1):  # slim minarets flanking the pishtaq
                    guldasta(mb, (s * pw, hz + 0.75), 0, 26.5, 0.42)
        inner = hz - 2.0          # behind the wing slabs
        core_z = hz + 1.0 - pd    # behind the iwans
        for s in (-1, 1):
            box(mb, s * pw, s * hx, 0, G["wing_h"], -inner, inner, "sand_panels")
            box(mb, s * G["passage_half"], s * pw, 0, ph, -core_z, core_z, "sand_panels")
        box(mb, -G["passage_half"], G["passage_half"], G["passage_h"], ph, -core_z, core_z, "sand_panels")
        for sx in (-1, 1):
            for sz in (-1, 1):
                x, z = sx * G["tower_x"], sz * hz
                lathe(mb, [(G["tower_r"], 0), (G["tower_r"], 17.4)], 8, "gate_tower", (x, 0, z), u_rep=2, v_mode="arc", a0=pi / 8)
                chhatri(mb, (x, 17.4, z), 2.5, 2.6, stone="sandstone", segs=16)
    # collision: solid wings and core, open iwans and the passage through
    z = G["z"]
    for s in (-1, 1):
        solid(s * pw, s * hx, z - hz, z + hz)
        solid(s * pw, s * iw, z - hz - 1.0, z + hz + 1.0)
        solid(s * iw, s * G["passage_half"], z - core_z, z + core_z)
        for sz in (-1, 1):
            post(s * G["tower_x"], z + sz * hz, G["tower_r"])
    mb.build()


def build_mosques() -> None:
    fac = mosque_facades()
    M = SITE["mosque"]
    for name, mirror in (("Mosque", False), ("Jawab", True)):
        mb = MB(name)
        x_c = -M["x"]  # the mosque is west of the tomb, facing east toward it
        M4 = (MIRROR_X() if mirror else Matrix.Identity(4)) @ T4(x_c, LV["terrace"], 0)
        hx, hz, h = M["half_x"], M["half_z"], M["h"]
        with mb.frame(M4):
            box(mb, -hx, hx - 3.0, 0, h, -hz, hz, "sand_panels", "sandstone")
            for s in (-1, 1):
                with mb.frame(T4(hx, 0, s * 17.75) @ RY(pi / 2)):
                    facade(mb, fac["mosque_wing"], "mosque_wing", "sandstone", lambda i, a: "niche_mosque_wing_0")
            with mb.frame(T4(hx + 1.0, 0, 0) @ RY(pi / 2)):
                facade(mb, fac["mosque_pishtaq"], "mosque_pishtaq", "sandstone", lambda i, a: "niche_mosque_pishtaq_0")
            box(mb, hx - 3.0, hx, 15.0, h, -hz, hz, "sandstone")
            # three white domes on sandstone drums
            for z, r, dh, drum in ((0, 5.6, 9.5, 3.0), (-16, 3.8, 6.4, 2.0), (16, 3.8, 6.4, 2.0)):
                lathe(mb, [(r, h), (r, h + drum)], 32, "sand_panels", (-1.5, 0, z), u_rep=8, v_mode="m")
                lathe(mb, [(r + 0.3, h + drum - 0.2), (r + 0.3, h + drum), (r, h + drum)], 32, "marble", (-1.5, 0, z))
                onion(mb, r, dh, (-1.5, h + drum, z), "marble", 40)
                finial(mb, (-1.5, h + drum + dh - 0.3, z), r * 0.6, 12)
            for sx in (-1, 1):
                for sz in (-1, 1):
                    x, z = sx * hx, sz * hz
                    octagonal(mb, (x, z), 1.7, 0, h + 4.5, "sand_panels", u_rep=4)
                    chhatri(mb, (x, h + 4.5, z), 1.8, 2.0, stone="sandstone", segs=14)
        mb.build()
        sign = 1 if mirror else -1
        solid(sign * (M["x"] - hx - 1.9), sign * (M["x"] + hx + 1.9), -hz - 1.9, hz + 1.9)


def tower(mb: MB, x: float, z: float, r: float, y0: float, y1: float) -> None:
    octagonal(mb, (x, z), r, y0, y1, "sand_panels", "sandstone", u_rep=8)
    lathe(mb, [(r, y1), (r + 0.4, y1 + 0.2), (r + 0.4, y1 + 0.6), (r, y1 + 0.6)], 8, "sandstone", (x, 0, z), a0=pi / 8)
    chhatri(mb, (x, y1 + 0.6, z), r * 0.85, r * 0.9, stone="sandstone", segs=20)
    post(x, z, r + 0.2)


def build_walls_and_pavilions() -> None:
    mb = MB("Walls")
    hw, n, s = S["half_width"], S["terrace_n"], S["garden_s"]
    t = 1.6
    wall_uv_ = wall_uv(4.0, 7.0, upright=True)
    for sx in (-1, 1):
        box(mb, sx * hw - t / 2, sx * hw + t / 2, 0, 8, n, s + t / 2, "garden_wall", "sandstone", side_uv=wall_uv_)
        solid(sx * hw - t / 2, sx * hw + t / 2, n - 9, s + t / 2)
    G = SITE["gate"]
    for sx in (-1, 1):
        box(mb, sx * G["half_x"], sx * hw, 0, 8, s - t / 2, s + t / 2, "garden_wall", "sandstone", side_uv=wall_uv_)
        solid(sx * G["half_x"], sx * hw, s - t / 2, s + t / 2)
    # crenellations along the top
    def merlons(x0, z0, x1, z1):
        L = hypot(x1 - x0, z1 - z0)
        k = int(L / 2.2)
        for i in range(k):
            f = (i + 0.5) / k
            x, z = x0 + (x1 - x0) * f, z0 + (z1 - z0) * f
            box(mb, x - 0.55, x + 0.55, 8, 8.9, z - 0.55, z + 0.55, "sandstone", tile=2)
    for sx in (-1, 1):
        merlons(sx * hw, n + 6, sx * hw, s - 2)
        merlons(sx * G["half_x"] + sx * 3, s, sx * hw - sx * 2, s)
    # the forecourt (jilaukhana) south of the gate
    fh, fs = S["forecourt_half"], S["forecourt_s"]
    for sx in (-1, 1):
        box(mb, sx * fh - 0.8, sx * fh + 0.8, 0, 6, s + t / 2, fs, "garden_wall", "sandstone", side_uv=wall_uv_)
        solid(sx * fh - 0.8, sx * fh + 0.8, s, fs)
    box(mb, -fh - 0.8, fh + 0.8, 0, 6, fs, fs + 1.6, "garden_wall", "sandstone", side_uv=wall_uv_)
    solid(-fh - 0.8, fh + 0.8, fs, fs + 1.6)
    # riverfront parapet and corner towers
    box(mb, -hw, hw, LV["terrace"], LV["terrace"] + 0.9, n, n + 0.6, "sandstone")
    solid(-hw, hw, n - 9, n + 0.6)
    for sx in (-1, 1):
        tower(mb, sx * hw, n, 5.2, LV["river"], 17.0)
        tower(mb, sx * hw, S["terrace_s"], 4.2, 0, 14.0)
        tower(mb, sx * hw, s, 4.2, 0, 14.0)
    # the pavilions at the ends of the east-west axis
    fac = mosque_facades()["pavilion"]
    for sx in (-1, 1):
        with mb.frame(T4(sx * (hw - 0.8), 0, S["pool_z"]) @ (MIRROR_X() if sx > 0 else Matrix.Identity(4))):
            box(mb, 0, 9, 0, fac["h"], -15, 15, "sand_panels", "sandstone")
            with mb.frame(T4(11, 0, 0) @ RY(pi / 2)):
                facade(mb, fac, "pavilion", "sandstone", lambda i, a: "niche_pavilion_0" if i == 0 else "niche_pavilion_1")
            for x in (1.5, 9.5):
                for z in (-13.5, 13.5):
                    chhatri(mb, (x, fac["h"], z), 1.4, 1.7, stone="sandstone", segs=14)
        solid(sx * (hw - 0.8), sx * (hw - 12.0), S["pool_z"] - 15.2, S["pool_z"] + 15.2)
    mb.build()


# ---------------------------------------------------------------------------------------------------
# terrace, garden, water, trees, river
# ---------------------------------------------------------------------------------------------------

def build_grounds() -> None:
    mb = MB("Grounds")
    water = MB("WATER")
    hw, n, ts, gs = S["half_width"], S["terrace_n"], S["terrace_s"], S["garden_s"]
    gd = SITE["garden"]
    # the riverfront terrace, sandstone floor, arcaded river wall
    prism(mb, [(-hw, n), (hw, n), (hw, ts), (-hw, ts)], LV["river"], LV["terrace"], "terrace_top", "terrace_side", tile_top=3,
          side_uv=wall_uv(6, 7.5, upright=True))
    platform(-hw, hw, n, ts, h=LV["terrace"])
    for k, (z0, z1, top) in enumerate(((ts, ts + 1, 1.0), (ts + 1, ts + 2, 0.5))):
        box(mb, -12, 12, 0, top, z0, z1, "marble", "paving")
        platform(-12, 12, z0, z1, h=top)
    # the garden as a grid of cells: lawns, walkways, and water channels in between
    xs = [(0, 3, "ch"), (3, 9, "walk"), (9, 74, "lawn"), (74, 82, "walk"), (82, 140, "lawn"), (140, hw - 0.8, "walk")]
    xs = [(-b, -a, t) for a, b, t in reversed(xs)] + xs
    pz = S["pool_z"]
    zs = [(ts, ts + 6, "walk"), (ts + 6, 125, "lawn"), (125, 133, "walk"), (133, pz - 9, "lawn"), (pz - 9, pz - 3, "walk"),
          (pz - 3, pz + 3, "ch"), (pz + 3, pz + 9, "walk"), (pz + 9, 267, "lawn"), (267, 275, "walk"), (275, gs - 22, "lawn"),
          (gs - 22, gs - 0.8, "walk")]  # the paved plaza in front of the Great Gate
    ph = gd["pool_half"]
    cells = {}
    for i, (x0, x1, tx) in enumerate(xs):
        for j, (z0, z1, tz) in enumerate(zs):
            if abs(x0 + x1) / 2 < ph and abs((z0 + z1) / 2 - pz) < ph:
                kind = "platform"
            elif tx == "ch" and tz in ("lawn", "ch"):
                kind = "water"
            elif tz == "ch" and tx == "lawn":
                kind = "water"
            elif tx == "walk" or tz == "walk" or tz == "ch":
                kind = "walk"
            else:
                kind = "lawn"
            cells[i, j] = kind
    for (i, j), kind in cells.items():
        x0, x1, _ = xs[i]
        z0, z1, _ = zs[j]
        if kind in ("lawn", "walk"):
            mat = "grass" if kind == "lawn" else "paving"
            t = 6 if kind == "lawn" else 4
            mb.face([(x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1)], [(x0 / t, -z0 / t), (x1 / t, -z0 / t), (x1 / t, -z1 / t), (x0 / t, -z1 / t)],
                    mat, (0, 1, 0))
        elif kind == "water":
            wy, floor = -0.25, -0.9
            water.face([(x0, wy, z0), (x1, wy, z0), (x1, wy, z1), (x0, wy, z1)], [(x0 / 4, -z0 / 4), (x1 / 4, -z0 / 4), (x1 / 4, -z1 / 4), (x0 / 4, -z1 / 4)],
                       "water", (0, 1, 0))
            mb.face([(x0, floor, z0), (x1, floor, z0), (x1, floor, z1), (x0, floor, z1)], [(0, 0)] * 4, "pool_floor", (0, 1, 0))
            for (di, dj), edge, nrm in (((-1, 0), [(x0, z1), (x0, z0)], (1, 0, 0)), ((1, 0), [(x1, z0), (x1, z1)], (-1, 0, 0)),
                                        ((0, -1), [(x0, z0), (x1, z0)], (0, 0, 1)), ((0, 1), [(x1, z1), (x0, z1)], (0, 0, -1))):
                if cells.get((i + di, j + dj)) == "water":
                    continue
                (ax, az), (bx, bz) = edge
                L = hypot(bx - ax, bz - az)
                mb.face([(ax, 0.05, az), (bx, 0.05, bz), (bx, floor, bz), (ax, floor, az)], [(0, 0.3), (L / 3, 0.3), (L / 3, 0), (0, 0)], "marble", nrm)
            COL["water"].append({"x0": x0, "x1": x1, "z0": z0, "z1": z1})
    # the raised marble tank where the channels cross, with Diana's bench on its south side
    pi_ = gd["pool_inner"]
    prism(mb, [(-ph, pz - ph), (ph, pz - ph), (ph, pz + ph), (-ph, pz + ph)], 0, gd["pool_h"], "plinth_top", "marble",
          holes=[[(-pi_, pz - pi_), (pi_, pz - pi_), (pi_, pz + pi_), (-pi_, pz + pi_)]], tile_top=4)
    water.face([(-pi_, 0.3, pz - pi_), (pi_, 0.3, pz - pi_), (pi_, 0.3, pz + pi_), (-pi_, 0.3, pz + pi_)], [(0, 0), (4, 0), (4, -4), (0, -4)], "water", (0, 1, 0))
    platform(-ph, ph, pz - ph, pz + ph, h=gd["pool_h"])
    solid(-pi_, pi_, pz - pi_, pz + pi_)  # the tank sits up on the platform, so it's a wall, not a channel
    lathe(mb, [(0, 0.3), (1.4, 0.3), (1.1, 0.6), (0.5, 0.75), (0.25, 1.1), (0, 1.2)], 16, "marble", (0, 0, pz))  # lotus fountain
    by = gd["pool_h"]
    bz = pz + (ph + pi_) / 2
    box(mb, -2.2, 2.2, by + 0.38, by + 0.5, bz - 0.35, bz + 0.35, "marble", tile=2)
    for x in (-1.6, 1.6):
        box(mb, x - 0.3, x + 0.3, by, by + 0.38, bz - 0.3, bz + 0.3, "marble", tile=2)
    solid(-2.2, 2.2, bz - 0.35, bz + 0.35)
    # fountain nozzles down the long channel
    for z in [ts + 12 + 12 * k for k in range(int((gs - ts - 24) / 12) + 1)]:
        if abs(z - pz) > ph + 2 and z < gs - 24:
            lathe(mb, [(0, -0.25), (0.12, -0.25), (0.1, 0.0), (0.16, 0.12), (0.06, 0.32), (0, 0.4)], 8, "gold", (0, 0, z))
    # the tanks in front of the mosque and jawab
    for x in (-SITE["mosque"]["x"] + 21, SITE["mosque"]["x"] - 21):
        prism(mb, [(x - 4.5, -4.5), (x + 4.5, -4.5), (x + 4.5, 4.5), (x - 4.5, 4.5)], LV["terrace"], LV["terrace"] + 0.45, "marble", "marble",
              holes=[[(x - 3.9, -3.9), (x + 3.9, -3.9), (x + 3.9, 3.9), (x - 3.9, 3.9)]])
        water.face([(x - 3.9, LV["terrace"] + 0.3, -3.9), (x + 3.9, LV["terrace"] + 0.3, -3.9), (x + 3.9, LV["terrace"] + 0.3, 3.9),
                    (x - 3.9, LV["terrace"] + 0.3, 3.9)], [(0, 0), (2, 0), (2, -2), (0, -2)], "water", (0, 1, 0))
        solid(x - 4.5, x + 4.5, -4.5, 4.5)
    # forecourt paving, and open ground beyond the walls
    fh, fs = S["forecourt_half"], S["forecourt_s"]
    for x0, x1, z0, z1, mat, t in ((-fh, fh, gs + 0.8, fs, "paving", 4),):
        mb.face([(x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1)], [(x0 / t, -z0 / t), (x1 / t, -z0 / t), (x1 / t, -z1 / t), (x0 / t, -z1 / t)], mat, (0, 1, 0))
    far = 1800
    pieces = [(-far, -hw - 0.8, n, far), (hw + 0.8, far, n, far), (-hw - 0.8, -fh - 0.8, gs + 0.8, fs + 1.6), (fh + 0.8, hw + 0.8, gs + 0.8, fs + 1.6),
              (-hw - 0.8, hw + 0.8, fs + 1.6, far)]
    for x0, x1, z0, z1 in pieces:
        t = 12
        mb.face([(x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1)], [(x0 / t, -z0 / t), (x1 / t, -z0 / t), (x1 / t, -z1 / t), (x0 / t, -z1 / t)], "ground", (0, 1, 0))
    # the Yamuna: an embankment, the water, and the far bank with Mehtab Bagh's trees
    box(mb, -far, -hw, LV["river"], 0, n - 2, n, "sandstone")
    box(mb, hw, far, LV["river"], 0, n - 2, n, "sandstone")
    ry = LV["river"] + 0.5
    water.face([(-far, ry, n), (far, ry, n), (far, ry, -700), (-far, ry, -700)], [(0, 0), (60, 0), (60, 30), (0, 30)], "water", (0, 1, 0))
    fb = -430
    mb.face([(-far, ry + 0.8, fb), (far, ry + 0.8, fb), (far, ry + 0.8, -far), (-far, ry + 0.8, -far)],
            [(0, 0), (far / 6, 0), (far / 6, far / 12), (0, far / 12)], "ground", (0, 1, 0))
    solid(-far, far, n - 40, n - 0.01)
    mb.build()
    water.build()
    build_trees(cells, xs, zs)


def ico(subdiv: int = 1):
    t = (1 + sqrt(5)) / 2
    v = [Vector(p).normalized() for p in [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
                                          (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2),
         (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    tris = [[v[a], v[b], v[c]] for a, b, c in f]
    for _ in range(subdiv):
        nt = []
        for a, b, c in tris:
            ab, bc, ca = (a + b).normalized(), (b + c).normalized(), (c + a).normalized()
            nt += [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]
        tris = nt
    return tris


CANOPY = ico(1)


def build_trees(cells, xs, zs) -> None:
    mb = MB("Trees")
    hw, ts, gs, pz = S["half_width"], S["terrace_s"], S["garden_s"], S["pool_z"]
    cyp = [(0, 0), (0.15, 0), (0.15, 0.5), (0.75, 0.8), (1.05, 2.0), (1.0, 3.8), (0.8, 5.4), (0.45, 6.7), (0.12, 7.6), (0, 7.9)]

    def cypress(x, z, s=1.0):
        lathe(mb, [(r * s, y * s) for r, y in cyp], 8, "cypress", (x, 0, z), a0=random.random())
        post(x, z, 0.6 * s)

    def broadleaf(x, z, s=1.0, dark=False, collide=True):
        th = 2.4 * s
        lathe(mb, [(0.28 * s, 0), (0.2 * s, th)], 6, "trunk", (x, 0, z))
        sx, sy, sz = 3.2 * s * random.uniform(0.85, 1.15), 2.6 * s, 3.2 * s * random.uniform(0.85, 1.15)
        cy = th + sy * 0.75
        for tri in CANOPY:
            pts = []
            for p in tri:
                j = 1 + 0.18 * sin(p.x * 7.1 + x) * cos(p.y * 5.3 + z)
                pts.append((x + p.x * sx * j, cy + p.y * sy * j, z + p.z * sz * j))
            c = sum((Vector(p) for p in tri), Vector()) / 3
            mb.face(pts, [(0, 0)] * 3, "leaves_dark" if dark else "leaves", tuple(c))
        if collide:
            post(x, z, 0.5 * s)

    # cypresses lining the main axis and the cross axis
    for z in range(int(ts + 10), int(gs - 24), 7):
        if abs(z - pz) > 16:
            for sx in (-1, 1):
                cypress(sx * 9.8, z, random.uniform(0.9, 1.1))
    for x in range(18, 138, 7):
        for sx in (-1, 1):
            for sz in (-1, 1):
                cypress(sx * x, pz + sz * 9.8, random.uniform(0.9, 1.1))
    # shade trees round the edges of each lawn
    for (i, j), kind in cells.items():
        if kind != "lawn":
            continue
        x0, x1, _ = xs[i]
        z0, z1, _ = zs[j]
        for t in range(0, 4):
            for k in range(int((x1 - x0) // 16)):
                fx = x0 + 6 + k * 16 + random.uniform(-2, 2)
                fz = (z0 + 5, z1 - 5)[t % 2] + random.uniform(-1.5, 1.5)
                if t < 2 and abs(fx) > 16:
                    broadleaf(fx, fz, random.uniform(0.8, 1.2), random.random() < 0.4)
    # woods outside the walls, and the far bank of the river
    for _ in range(320):
        x = random.choice((-1, 1)) * random.uniform(hw + 10, 360)
        z = random.uniform(-40, 560)
        broadleaf(x, z, random.uniform(1.0, 1.6), random.random() < 0.5, collide=False)
    for _ in range(140):
        x = random.uniform(-360, 360)
        z = random.uniform(S["forecourt_s"] + 12, 620)
        broadleaf(x, z, random.uniform(1.0, 1.6), random.random() < 0.5, collide=False)
    for _ in range(260):
        x = random.uniform(-900, 900)
        z = random.uniform(-450, -900)
        broadleaf(x, z, random.uniform(1.1, 1.8), random.random() < 0.5, collide=False)  # lifted onto the far bank in main()
    mb.build()


# ---------------------------------------------------------------------------------------------------

def main() -> None:
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    make_materials()
    print("building...")
    build_tomb()
    build_plinth()
    build_gate()
    build_mosques()
    build_walls_and_pavilions()
    build_grounds()
    # lift the far-bank trees onto the far bank (they were placed at garden level)
    trees = bpy.data.objects["Trees"]
    me = trees.data
    for v in me.vertices:
        if v.co.y > 430:  # blender y = -world z: north of the river
            v.co.z += LV["river"] + 1.3
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    with open(COLLIDERS, "w", encoding="utf-8") as fh:
        json.dump(COL, fh, separators=(",", ":"))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "taj_mahal.blend"))
    bpy.ops.export_scene.gltf(
        filepath=GLB, export_format="GLB", export_yup=True, export_apply=True, export_texcoords=True, export_normals=True,
        export_materials="EXPORT", export_image_format="AUTO", export_image_quality=82, export_jpeg_quality=82,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=16, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
    )
    print(f"wrote {os.path.relpath(GLB, ROOT)} ({os.path.getsize(GLB) / 1e6:.1f} MB) and {os.path.relpath(COLLIDERS, ROOT)} in {time.time() - t0:.0f}s")


main()
