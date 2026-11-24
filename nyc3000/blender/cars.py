"""NYC 3000 vehicles modelled in Blender.

Ground cars: a lofted body (superellipse cross-sections along a side profile with
wheel arches), a greenhouse loft split into glass, roof and pillars, lathed wheels,
lights and trim. Hover cars: a wedge body, a bubble canopy, lathed thruster pods,
pylons, fins and hover pads.
Blender axes: +Y = front, +Z = up, +X = right (exported glTF: front = -Z).
Every car is made twice: LOD 0 (close up) and LOD 1 (far away).
"""
import math
from mathutils import Vector as V
from lib import (mat, Builder, finish, marker, mono, smooth, clamp, lerp, T, bm_box, bm_lathe, tri_count)


def palette():
    return dict(
        paint=mat('paint', '#ffffff', 0.6, 0.25),
        glass=mat('glass', '#0b1626', 0.9, 0.06),
        chrome=mat('chrome', '#c9d2df', 1.0, 0.16),
        rubber=mat('rubber', '#111114', 0.0, 0.85),
        black=mat('black', '#101116', 0.25, 0.5),
        trim=mat('trim', '#1f222b', 0.55, 0.38),
        rim=mat('rim', '#8f99ae', 0.9, 0.22),
        white=mat('white', '#e6e8ef', 0.3, 0.3),
        stripe=mat('stripe', '#15161c', 0.4, 0.3),
        head=mat('head', emit='#e8f6ff'),
        tail=mat('tail', emit='#ff1e3c'),
        amber=mat('amber', emit='#ffa43a'),
        cyan=mat('neon_cyan', emit='#29f3ff'),
        pink=mat('neon_pink', emit='#ff2bd6'),
        blue=mat('neon_blue', emit='#4aa0ff'),
        yellow=mat('neon_yellow', emit='#ffd23a'),
        sign=mat('neon_sign', emit='#ffe07a'),
    )


def body_ring(w, zb, zt, zc, n_top, n_bot, tuck, npts):
    """Closed superellipse cross-section: k = 0 is the top centre, going round clockwise seen from the front."""
    et, eb = 2.0 / n_top, 2.0 / n_bot
    pts = []
    for k in range(npts):
        a = 2 * math.pi * k / npts
        s, c = math.sin(a), math.cos(a)
        if c >= 0:
            x = w * math.copysign(abs(s) ** et, s)
            z = zc + (zt - zc) * abs(c) ** et
        else:
            x = w * math.copysign(abs(s) ** eb, s) * (1 - tuck * abs(c))
            z = zc - (zc - zb) * abs(c) ** eb
        pts.append((x, z))
    return pts


def stations(y0, y1, n, extra=()):
    ys = [y0 + (y1 - y0) * k / (n - 1) for k in range(n)]
    ys += [y for y in extra if y0 < y < y1]
    ys = sorted(ys)
    out = []
    for y in ys:
        if not out or y - out[-1] > 0.004:
            out.append(y)
    return out


def wheel(b, P, x, y, wr, tw, side, neon, lod):
    """Tyre, rim, spokes, hub and a neon ring. side = +1 right, -1 left (outer face points to side)."""
    seg = 16 if lod == 0 else 10
    rot = (0, side * math.pi / 2, 0)  # lathe axis Z -> X, outer face (+Z) -> side
    h = tw / 2
    ri = wr * 0.68
    tyre = [(ri, -h * 0.85), (wr * 0.9, -h), (wr * 0.985, -h * 0.9), (wr, -h * 0.55), (wr, h * 0.55),
            (wr * 0.985, h * 0.9), (wr * 0.9, h), (ri, h * 0.85)]
    if lod:
        tyre = [(ri, -h), (wr, -h * 0.7), (wr, h * 0.7), (ri, h)]
    b.lathe(tyre, P['rubber'], (x, y, wr), rot, seg)
    # rim: barrel + recessed face + lip
    rim = [(ri, -h * 0.8), (ri, h * 0.75), (ri * 0.96, h * 0.88), (ri * 0.88, h * 0.82)]
    b.lathe(rim, P['rim'], (x, y, wr), rot, seg)
    face = [(ri * 0.9, h * 0.6), (ri * 0.3, h * 0.55), (0.0, h * 0.55)]
    b.lathe(face, P['black'], (x, y, wr), rot, seg)
    if lod == 0:
        for k in range(5):
            a = k * 2 * math.pi / 5
            b.add(bm_box(0.045, ri * 0.85, 0.035), P['rim'],
                  T((x, y, wr), rot) @ T((0, 0, h * 0.68), (0, 0, a)) @ T((0, ri * 0.45, 0)))
        b.cyl(0.06, 0.05, 0.05, P['chrome'], (x + side * h * 0.72, y, wr), (0, math.pi / 2, 0), seg=10)
    b.torus(ri * 0.78, 0.011 if lod == 0 else 0.016, P[neon], (x + side * h * 0.86, y, wr), (0, math.pi / 2, 0),
            seg=seg + 4, rseg=4 if lod == 0 else 3)


def cabin(b, P, top, w_of, y0, y1, hcurve, wb_k, wt, rc, lod, pillar_b=(-0.14, -0.04), glass_lo=0.25, glass_hi=0.07,
          roof_m='paint'):
    """Greenhouse loft over the body. hcurve(y) = height above the body top line."""
    ks, kc, kr = (2, 2, 5) if lod == 0 else (1, 1, 3)
    n_st = 22 if lod == 0 else 10
    hmax = max(hcurve(y0 + (y1 - y0) * k / 40) for k in range(41))
    rings = []
    ys = stations(y0, y1, n_st)
    for y in ys:
        h = max(0.004, hcurve(y))
        z0 = top(y) - 0.03
        wb = w_of(y) * wb_k
        wtop = min(wt, wb - 0.02)
        r = min(rc, h * 0.45, wtop * 0.5)
        crown = 0.018
        pts = []
        for t in range(ks + 1):  # left side up
            f = t / ks
            pts.append((lerp(-wb, -wtop, f), lerp(z0, z0 + h - r, f)))
        for t in range(1, kc + 1):  # left corner
            a = math.pi - (math.pi / 2) * t / kc
            pts.append((-wtop + r + r * math.cos(a), z0 + h - r + r * math.sin(a)))
        for t in range(1, kr + 1):  # roof
            xx = lerp(-wtop + r, wtop - r, t / kr)
            pts.append((xx, z0 + h + crown * (1 - (xx / max(wtop, 0.01)) ** 2) * min(1, h / 0.2)))
        for t in range(1, kc + 1):  # right corner
            a = math.pi / 2 - (math.pi / 2) * t / kc
            pts.append((wtop - r + r * math.cos(a), z0 + h - r + r * math.sin(a)))
        for t in range(1, ks + 1):  # right side down
            f = t / ks
            pts.append((lerp(wtop, wb, f), lerp(z0 + h - r, z0, f)))
        rings.append([(x, y, z) for x, z in pts])
    nseg = len(rings[0]) - 1
    left_side = range(0, ks)
    corners = set(range(ks, ks + kc)) | set(range(nseg - ks - kc, nseg - ks))
    roof = set(range(ks + kc, ks + kc + kr))

    def mfn(i, j, f):
        y = f.calc_center_median().y
        if j in roof:
            return P[roof_m] if hcurve(y) >= hmax * 0.93 else P['glass']
        if j in corners:
            return P[roof_m]
        # sides
        if j == 0 or j == nseg - 1:
            return P['trim']
        if y < y0 + glass_lo or y > y1 - glass_hi or pillar_b[0] < y < pillar_b[1]:
            return P[roof_m]
        return P['glass']
    _ = left_side
    b.loft(rings, mfn, closed=False)


# ------------------------------------------------------------------ ground cars
GROUND = {
    'sedan': dict(L=4.65, W=2.0, axle=1.42, wr=0.36, tw=0.26, neon='cyan',
                  top=[(-1, 0.74), (-0.985, 0.86), (-0.925, 0.93), (-0.75, 0.96), (-0.56, 0.97), (0.0, 0.975), (0.43, 0.965),
                       (0.62, 0.92), (0.82, 0.84), (0.945, 0.75), (0.99, 0.66), (1, 0.60)],
                  cab=(-1.32, 1.02), h=[(-1.32, 0.0), (-1.06, 0.25), (-0.77, 0.40), (-0.56, 0.435), (0.24, 0.445), (0.45, 0.42),
                                        (0.76, 0.23), (1.02, 0.0)],
                  seams=(0.92, -0.06, -1.02)),
    'police': dict(L=4.7, W=2.02, axle=1.44, wr=0.37, tw=0.27, neon='blue',
                   top=[(-1, 0.75), (-0.985, 0.87), (-0.925, 0.94), (-0.75, 0.97), (-0.56, 0.98), (0.0, 0.985), (0.43, 0.975),
                        (0.62, 0.93), (0.82, 0.85), (0.945, 0.76), (0.99, 0.67), (1, 0.61)],
                   cab=(-1.32, 1.02), h=[(-1.32, 0.0), (-1.06, 0.25), (-0.77, 0.41), (-0.56, 0.445), (0.24, 0.455), (0.45, 0.43),
                                         (0.76, 0.24), (1.02, 0.0)],
                   seams=(0.92, -0.06, -1.02)),
    'muscle': dict(L=4.9, W=2.1, axle=1.5, wr=0.39, tw=0.3, neon='pink',
                   top=[(-1, 0.80), (-0.985, 0.92), (-0.93, 0.98), (-0.7, 1.0), (-0.5, 1.0), (0.0, 0.99), (0.5, 0.97),
                        (0.75, 0.92), (0.9, 0.84), (0.97, 0.74), (0.995, 0.66), (1, 0.62)],
                   cab=(-1.42, 0.92), h=[(-1.42, 0.0), (-1.05, 0.21), (-0.7, 0.33), (-0.45, 0.355), (0.15, 0.36), (0.35, 0.34),
                                         (0.66, 0.18), (0.92, 0.0)],
                   seams=(0.82, -0.55)),
    # a low wedge supercar
    'super': dict(L=4.5, W=2.1, axle=1.38, wr=0.37, tw=0.3, neon='pink',
                  top=[(-1, 0.78), (-0.98, 0.88), (-0.9, 0.92), (-0.7, 0.93), (-0.4, 0.9), (0.0, 0.84), (0.3, 0.76),
                       (0.55, 0.68), (0.8, 0.6), (0.94, 0.55), (0.99, 0.5), (1, 0.46)],
                  cab=(-0.95, 0.95), h=[(-0.95, 0.0), (-0.7, 0.18), (-0.4, 0.3), (-0.1, 0.34), (0.25, 0.32), (0.55, 0.2), (0.95, 0.0)],
                  seams=(0.6, -0.6)),
    # a little round city car
    'compact': dict(L=3.8, W=1.85, axle=1.15, wr=0.33, tw=0.24, neon='yellow',
                    top=[(-1, 0.78), (-0.98, 0.9), (-0.92, 0.96), (-0.7, 0.98), (0.0, 0.98), (0.4, 0.96), (0.62, 0.9),
                         (0.8, 0.82), (0.93, 0.74), (0.99, 0.66), (1, 0.6)],
                    cab=(-1.6, 0.85), h=[(-1.6, 0.0), (-1.45, 0.3), (-1.2, 0.5), (-0.9, 0.56), (0.2, 0.56), (0.45, 0.5), (0.68, 0.28), (0.85, 0.0)],
                    seams=(0.55, -0.75)),
    # a tall people carrier
    'van': dict(L=5.1, W=2.05, axle=1.65, wr=0.38, tw=0.27, neon='cyan',
                top=[(-1, 0.95), (-0.985, 1.05), (-0.93, 1.08), (-0.6, 1.1), (0.0, 1.1), (0.5, 1.08), (0.7, 1.02),
                     (0.85, 0.92), (0.95, 0.8), (0.99, 0.7), (1, 0.64)],
                cab=(-2.3, 1.45), h=[(-2.3, 0.0), (-2.22, 0.4), (-2.05, 0.66), (-1.7, 0.72), (0.6, 0.72), (0.95, 0.62), (1.25, 0.32), (1.45, 0.0)],
                seams=(1.0, -0.2, -1.2)),
}


def ground_car(kind, lod):
    S = GROUND[kind]
    P = palette()
    b = Builder()
    L, W, axle, wr, tw = S['L'], S['W'], S['axle'], S['wr'], S['tw']
    half, hw = L / 2, W / 2
    muscle, police = kind == 'muscle', kind == 'police'
    top_n = mono([(u * half, z) for u, z in S['top']])
    Ra = wr + 0.075

    def zbot(y):
        z = 0.30
        if y > half - 0.45:
            z = lerp(0.30, 0.37, smooth((y - (half - 0.45)) / 0.45))
        if y < -half + 0.4:
            z = lerp(0.30, 0.42, smooth((-half + 0.4 - y) / 0.4))
        for yc in (axle, -axle):
            dy = y - yc
            if abs(dy) < Ra:
                z = max(z, wr + math.sqrt(Ra * Ra - dy * dy))
        return z

    def wid(y):
        a = abs(y)
        w = hw * (1 - 0.075 * smooth((a - (half - 0.8)) / 0.8) ** 1.5)
        if y > 0:
            w *= 1 - 0.02 * smooth((y - 1.0) / 1.3)
        for yc in (axle, -axle):
            w += (0.035 if muscle else 0.015) * math.exp(-((y - yc) / 0.45) ** 2)
        return w

    def shrink(y):
        return smooth((abs(y) - (half - 0.07)) / 0.07)

    seams = S['seams']
    extra = []
    for yc in (axle, -axle):
        for d in (-Ra - 0.012, -Ra + 0.004, -Ra + 0.03, Ra - 0.03, Ra - 0.004, Ra + 0.012):
            extra.append(yc + d)
    for e in (0.07, 0.04, 0.018, 0.006):
        extra += [half - e, -half + e]
    if lod == 0:
        for s in seams:
            extra += [s - 0.012, s + 0.012]
    ys = stations(-half, half, 30 if lod == 0 else 16, extra)
    npts = 24 if lod == 0 else 14
    rings = []
    for y in ys:
        f = shrink(y)
        zb = zbot(y) + 0.05 * f
        zt = top_n(y) - 0.05 * f
        w = wid(y) * (1 - 0.09 * f)
        zc = clamp(0.70 if not muscle else 0.72, zb + 0.03, zt - 0.07)
        rings.append([(x, y, z) for x, z in body_ring(w, zb, zt, zc, 3.4, 5.0, 0.10, npts)])
    seam_bands = [(s - 0.013, s + 0.013) for s in seams] if lod == 0 else []

    def mfn(i, j, f):
        c, n = f.calc_center_median(), f.normal
        if n.z < -0.55:
            return P['black']
        side = abs(n.x) > 0.72
        if side and 0.4 < c.z < top_n(c.y) - 0.06:
            for a, bb in seam_bands:
                if a < c.y < bb:
                    return P['black']
            if police and -1.02 < c.y < 0.92 and c.z < top_n(c.y) - 0.08:
                return P['white']
        if muscle and n.z > 0.55 and 0.1 < abs(c.x) < 0.24:
            return P['stripe']
        return P['paint']
    b.loft(rings, mfn, closed=True, cap0=True, cap1=True, cap_m=P['paint'])

    # greenhouse
    y0, y1 = S['cab']
    hcur = mono(S['h'])
    cabin(b, P, top_n, wid, y0, y1, hcur, 0.87, 0.70 if not muscle else 0.72, 0.1, lod,
          pillar_b=(-0.16, -0.06) if not muscle else (-10, -10))
    roof_z = top_n(0.0) + hcur(0.0)

    # chassis / wheel wells
    b.box(W - 0.7, L - 0.9, 0.55, P['black'], (0, 0, 0.56))
    neon = S['neon']
    for yc in (axle, -axle):
        for s in (-1, 1):
            wheel(b, P, s * (wid(yc) - tw / 2 - 0.02), yc, wr, tw, s, neon, lod)

    # lights
    zf = top_n(half) - 0.02  # top of the front face
    for s in (-1, 1):
        b.box(0.44, 0.05, 0.055, P['head'], (s * 0.6, half - 0.012, zf - 0.035), (0, 0, s * 0.1), bevel=0.012 if lod == 0 else 0)
        b.box(0.48, 0.06, 0.085, P['black'], (s * 0.6, half - 0.03, zf - 0.04), (0, 0, s * 0.1))
    b.box(W * 0.6, 0.05, 0.025, P[neon], (0, half - 0.012, 0.52))
    b.box(W * 0.5, 0.06, 0.15, P['black'], (0, half - 0.02, 0.44), bevel=0.02 if lod == 0 else 0)
    if lod == 0:
        for k in range(4):
            b.box(W * 0.46, 0.03, 0.012, P['chrome'], (0, half - 0.0, 0.39 + k * 0.032))
    b.box(W * 0.9, 0.2, 0.08, P['black'], (0, half - 0.13, 0.31), bevel=0.03 if lod == 0 else 0)
    zr = top_n(-half + 0.1)
    b.box(W * 0.86, 0.05, 0.075, P['tail'], (0, -half + 0.012, zr - 0.07))
    for s in (-1, 1):
        b.box(0.05, 0.34, 0.075, P['tail'], (s * (wid(-half + 0.25) - 0.012), -half + 0.24, zr - 0.07))
    b.box(W * 0.94, 0.2, 0.13, P['black'], (0, -half + 0.1, 0.43), bevel=0.04 if lod == 0 else 0)
    b.box(0.52, 0.03, 0.13, P['white'] if lod == 0 else P['black'], (0, -half - 0.004, 0.6))
    # side neon strips and underglow
    for s in (-1, 1):
        b.box(0.03, 2 * axle - 2 * Ra - 0.1, 0.03, P[neon], (s * (wid(0) + 0.006), 0, 0.42))
    b.box(W * 0.7, L * 0.62, 0.02, P[neon], (0, 0, 0.27))
    # mirrors, handles
    ym = y1 - 0.16
    for s in (-1, 1):
        xm = wid(ym) * 0.87 + 0.12
        b.box(0.2, 0.1, 0.11, P['paint'], (s * xm, ym, top_n(ym) + 0.08), (0, 0, s * 0.15), bevel=0.03 if lod == 0 else 0)
        if lod == 0:
            b.box(0.12, 0.04, 0.03, P['black'], (s * (xm - 0.1), ym, top_n(ym) + 0.03))
            b.box(0.03, 0.12, 0.008, P['amber'], (s * (xm + 0.05), ym + 0.05, top_n(ym) + 0.06))
            for yh in (seams[0] - 0.45, seams[1] - 0.45 if len(seams) > 2 else -10):
                if yh > -5:
                    b.box(0.025, 0.16, 0.03, P['chrome'], (s * (wid(yh) + 0.003), yh, top_n(yh) - 0.1))

    # per-model extras
    if muscle:
        b.box(0.56, 0.85, 0.11, P['paint'], (0, 1.15, top_n(1.15) + 0.03), (-0.05, 0, 0), bevel=0.04 if lod == 0 else 0)
        b.box(0.44, 0.04, 0.07, P['black'], (0, 1.58, top_n(1.58) + 0.06))
        for s in (-1, 1):
            b.box(0.05, 0.12, 0.27, P['black'], (s * 0.68, -half + 0.28, top_n(-half + 0.28) + 0.12))
        b.box(1.95, 0.36, 0.05, P['black'], (0, -half + 0.24, top_n(-half + 0.24) + 0.27), (-0.12, 0, 0), bevel=0.02 if lod == 0 else 0)
        b.box(1.95, 0.02, 0.02, P['pink'], (0, -half + 0.08, top_n(-half + 0.24) + 0.3))
        for s in (-1, 1):
            for dx in (0.16, 0.3):
                b.cyl(0.045, 0.045, 0.16, P['chrome'], (s * (0.55 + dx * 0.3), -half + 0.02, 0.36), (math.pi / 2, 0, 0), seg=10)
        for s in (-1, 1):
            b.box(0.1, 0.06, 0.06, P['amber'], (s * 0.45, half - 0.03, 0.43))
    if police:
        rz = roof_z + 0.02
        b.box(1.3, 0.42, 0.1, P['black'], (0, 0.1, rz + 0.04), bevel=0.03 if lod == 0 else 0)
        if lod == 0:
            marker('police_siren', (0, 0.1, rz + 0.13))
        b.box(0.05, 0.05, 0.5, P['black'], (0.5, -half + 0.4, top_n(-half + 0.4) + 0.24))
        # push bar
        for s in (-1, 1):
            b.box(0.07, 0.2, 0.4, P['black'], (s * 0.35, half + 0.05, 0.45))
        b.box(0.9, 0.07, 0.07, P['black'], (0, half + 0.12, 0.62))
        b.box(0.9, 0.07, 0.07, P['black'], (0, half + 0.12, 0.38))
        if lod == 0:
            b.cyl(0.07, 0.06, 0.14, P['chrome'], (-(wid(0.9) * 0.87 + 0.05), 0.9, top_n(0.9) + 0.1), (math.pi / 2, 0, 0), seg=10)
        if lod == 0:
            marker('police_decal', (wid(-0.1) + 0.02, -0.1, 0.68))
    ob = finish(b, f'{kind}' + ('_lod1' if lod else ''), sharp=50,
                ao=dict(dist=0.7, rays=40 if lod == 0 else 20, ground=0.0, floor=0.3))
    return ob


# ------------------------------------------------------------------ hover cars
HOVER = {
    'hover': dict(L=4.85, W=2.05, neon='cyan', strip='pink'),
    'flypolice': dict(L=5.3, W=2.1, neon='blue', strip='blue'),
    'taxi': dict(L=5.0, W=2.15, neon='yellow', strip='yellow'),
}


def pod(b, P, x, y, z, r, length, neon, lod, front_ring=True):
    """Thruster nacelle along Y: intake ring at the front, glowing nozzle at the back."""
    seg = 14 if lod == 0 else 9
    rot = (-math.pi / 2, 0, 0)  # lathe +Z -> -Y? use (math.pi/2) to send +Z to -Y
    hl = length / 2
    prof = [(r * 0.75, hl), (r * 0.95, hl - 0.06), (r, hl - 0.2), (r, -hl + 0.35), (r * 0.82, -hl + 0.06), (r * 0.78, -hl)]
    if lod:
        prof = [(r * 0.8, hl), (r, hl - 0.15), (r, -hl + 0.3), (r * 0.78, -hl)]
    # profile z runs from front (+) to back (-); rotate so lathe Z maps to Blender +Y
    b.lathe(prof, P['trim'], (x, y, z), (-math.pi / 2, 0, 0), seg)
    b.cyl(r * 0.72, r * 0.72, 0.02, P['black'], (x, y + hl - 0.01, z), (math.pi / 2, 0, 0), seg=seg)
    b.cyl(r * 0.6, r * 0.6, 0.02, P[neon], (x, y - hl + 0.005, z), (math.pi / 2, 0, 0), seg=seg)
    b.torus(r * 0.82, 0.02, P[neon], (x, y - hl - 0.005, z), (math.pi / 2, 0, 0), seg=seg + 2, rseg=4 if lod == 0 else 3)
    if front_ring:
        b.torus(r * 0.97, 0.018, P[neon], (x, y + hl - 0.12, z), (math.pi / 2, 0, 0), seg=seg + 2, rseg=4 if lod == 0 else 3)
    # glowing hover pad under the pod
    b.cyl(r * 0.8, r * 0.8, 0.02, P[neon], (x, y, z - r - 0.005), seg=seg)


def hover_car(kind, lod):
    S = HOVER[kind]
    P = palette()
    b = Builder()
    L, W = S['L'], S['W']
    half, hw = L / 2, W / 2
    taxi, police = kind == 'taxi', kind == 'flypolice'
    neon = S['neon']
    if taxi:
        top_n = mono([(-half, 0.62), (-half + 0.05, 0.78), (-half + 0.3, 0.88), (-1.4, 0.9), (1.2, 0.9), (1.8, 0.84),
                      (half - 0.25, 0.72), (half - 0.05, 0.6), (half, 0.52)])
        bot_n = mono([(-half, 0.42), (-half + 0.35, 0.32), (half - 0.45, 0.32), (half, 0.4)])
    else:
        top_n = mono([(-half, 0.56), (-half + 0.08, 0.7), (-half + 0.45, 0.8), (-0.8, 0.8), (0.5, 0.74), (1.4, 0.64),
                      (half - 0.3, 0.5), (half, 0.4)])
        bot_n = mono([(-half, 0.36), (-half + 0.5, 0.26), (1.2, 0.24), (half - 0.15, 0.32), (half, 0.36)])

    def wid(y):
        if taxi:
            return hw * (1 - 0.07 * smooth((abs(y) - (half - 0.9)) / 0.9) ** 1.5)
        w = hw * (1 - 0.06 * smooth((-y - (half - 0.8)) / 0.8))
        if y > 0.9:
            w *= 1 - 0.5 * smooth((y - 0.9) / (half - 0.9)) ** 1.3
        return w

    def shrink(y):
        return smooth((abs(y) - (half - 0.07)) / 0.07)

    extra = []
    for e in (0.07, 0.04, 0.018, 0.006):
        extra += [half - e, -half + e]
    ys = stations(-half, half, 32 if lod == 0 else 16, extra)
    npts = 24 if lod == 0 else 14
    rings = []
    for y in ys:
        f = shrink(y)
        zb = bot_n(y) + 0.05 * f
        zt = top_n(y) - 0.05 * f
        w = wid(y) * (1 - 0.1 * f)
        zc = lerp(zb, zt, 0.45)
        rings.append([(x, y, z) for x, z in body_ring(w, zb, zt, zc, 2.8 if not taxi else 3.4, 3.6, 0.12, npts)])
    step = (ys[-1] - ys[0]) / max(1, len(ys) - 1)
    _ = step

    def mfn(i, j, f):
        c, n = f.calc_center_median(), f.normal
        if n.z < -0.55:
            return P['black']
        if taxi and abs(n.x) > 0.7 and 0.6 < c.z < 0.69 and -1.6 < c.y < 1.6:
            return P['black'] if (int((c.y + 3) / 0.2) % 2) else P['white']
        if police and abs(n.x) > 0.65 and c.z < lerp(bot_n(c.y), top_n(c.y), 0.62) and c.z > bot_n(c.y) + 0.06 and -1.3 < c.y < 0.9:
            return P['white']
        return P['paint']
    b.loft(rings, mfn, closed=True, cap0=True, cap1=True, cap_m=P['paint'])

    if taxi:
        hcur = mono([(-1.45, 0.0), (-1.12, 0.3), (-0.8, 0.5), (-0.55, 0.54), (0.45, 0.55), (0.7, 0.5), (1.05, 0.26), (1.35, 0.0)])
        cabin(b, P, top_n, wid, -1.45, 1.35, hcur, 0.86, 0.74, 0.11, lod, pillar_b=(-0.18, -0.08))
        roof_z = top_n(0) + hcur(0)
        # roof sign
        b.box(0.94, 0.36, 0.06, P['black'], (0, -0.05, roof_z + 0.02), bevel=0.02 if lod == 0 else 0)
        b.box(0.86, 0.3, 0.22, P['sign'], (0, -0.05, roof_z + 0.16), bevel=0.02 if lod == 0 else 0)
        if lod == 0:
            marker('taxi_sign', (0, -0.05, roof_z + 0.16), props={'w': 0.86, 'd': 0.3})
        for sy in (-1, 1):
            for sx in (-1, 1):
                pod(b, P, sx * (wid(sy * 1.55) - 0.12), sy * 1.55, 0.3, 0.2, 0.75, neon, lod)
        b.box(W * 0.62, 0.05, 0.06, P['head'], (0, half - 0.03, 0.58))
        b.box(W * 0.8, 0.05, 0.07, P['tail'], (0, -half + 0.02, 0.74))
        for s in (-1, 1):
            b.box(0.03, 3.4, 0.03, P['yellow'], (s * (wid(0) + 0.006), 0, 0.5))
            b.box(0.18, 0.08, 0.1, P['paint'], (s * (wid(1.1) * 0.86 + 0.1), 1.1, top_n(1.1) + 0.08), bevel=0.03 if lod == 0 else 0)
        b.box(W * 0.6, L * 0.55, 0.02, P[neon], (0, 0, 0.3))
        b.box(W * 0.9, 0.2, 0.12, P['black'], (0, half - 0.12, 0.42), bevel=0.04 if lod == 0 else 0)
        b.box(W * 0.9, 0.2, 0.12, P['black'], (0, -half + 0.12, 0.48), bevel=0.04 if lod == 0 else 0)
    else:
        # bubble canopy (glass) with a frame and a spine
        cy0, cy1 = (-1.0, 1.35) if not police else (-1.2, 1.4)
        ch = 0.44 if not police else 0.42
        cw = 0.62 if not police else 0.64
        n_st, n_r = (18, 12) if lod == 0 else (9, 6)
        rings = []
        mid, hl = (cy0 + cy1) / 2, (cy1 - cy0) / 2
        for k in range(n_st + 1):
            y = cy0 + (cy1 - cy0) * k / n_st
            u = (y - mid) / hl
            prof = math.sqrt(max(0.0, 1 - abs(u) ** 2.2))
            h = max(0.004, ch * prof ** 0.8 * (1 - 0.25 * max(0, u)))
            w = max(0.004, cw * prof ** 0.6)
            z0 = top_n(y) - 0.02
            ring = []
            for t in range(n_r + 1):
                a = math.pi * t / n_r
                ring.append((-w * math.cos(a), y, z0 + h * math.sin(a)))
            rings.append(ring)

        def cfn(i, j, f):
            c = f.calc_center_median()
            if j == 0 or j == n_r - 1:
                return P['trim']
            return P['trim'] if abs(c.x) < 0.035 and lod == 0 else P['glass']
        b.loft(rings, cfn, closed=False)
        b.box(cw * 2 + 0.06, 0.06, 0.05, P['trim'], (0, cy0 + 0.05, top_n(cy0 + 0.05) + 0.02))
        # nacelles on pylons
        nx = hw + 0.28
        for s in (-1, 1):
            pod(b, P, s * nx, 0.15, 0.46, 0.3, 2.3 if not police else 2.5, neon, lod)
            b.box(0.55, 0.9, 0.09, P['trim'], (s * (hw + 0.02), 0.15, 0.5), (0, s * 0.05, 0), bevel=0.03 if lod == 0 else 0)
            b.box(0.04, 1.6, 0.04, P[S['strip']], (s * (nx + 0.3), 0.15, 0.48))
            # tail fins
            fin_m = P['white'] if police else P['paint']
            zf = top_n(-half + 0.55)
            b.box(0.05, 0.62, 0.42, fin_m, (s * 0.62, -half + 0.5, zf + 0.16), (0.55, s * 0.3, 0), bevel=0.02 if lod == 0 else 0)
            b.box(0.056, 0.5, 0.03, P[neon], (s * 0.68, -half + 0.4, zf + 0.35), (0.55, s * 0.3, 0))
        # hover pads
        for yy in (-1.2, 1.0):
            b.cyl(0.36, 0.36, 0.04, P['black'], (0, yy, bot_n(yy) - 0.01), seg=16 if lod == 0 else 8)
            b.torus(0.3, 0.02, P[neon], (0, yy, bot_n(yy) - 0.04), seg=20 if lod == 0 else 10, rseg=3)
        # lights
        zn = lerp(bot_n(half - 0.12), top_n(half - 0.12), 0.45)
        b.box(wid(half - 0.12) * 1.5, 0.06, 0.05, P['head'], (0, half - 0.1, zn))
        b.box(W * 0.75, 0.06, 0.06, P['tail'], (0, -half + 0.02, lerp(bot_n(-half), top_n(-half), 0.6)))
        for s in (-1, 1):
            b.box(0.03, L * 0.62, 0.03, P[S['strip']], (s * (wid(0) + 0.006), -0.1, 0.52))
        b.box(W * 0.5, 0.1, 0.1, P['black'], (0, half - 0.1, bot_n(half - 0.1) + 0.03))
        if police:
            rz = top_n(-0.2) + ch * 0.65
            b.box(1.25, 0.4, 0.1, P['black'], (0, -0.55, top_n(-0.55) + 0.06), bevel=0.03 if lod == 0 else 0)
            if lod == 0:
                marker('flypolice_siren', (0, -0.55, top_n(-0.55) + 0.15))
                marker('flypolice_decal', (wid(-0.2) + 0.03, -0.2, lerp(bot_n(-0.2), top_n(-0.2), 0.42)))
            _ = rz
    ob = finish(b, f'{kind}' + ('_lod1' if lod else ''), sharp=50,
                ao=dict(dist=0.7, rays=40 if lod == 0 else 20, ground=None, floor=0.32))
    return ob


# ------------------------------------------------------------------ motorbikes
def _rod(b, m, a, c, r, seg=8):
    """A round tube from point a to point c."""
    a, c = V(a), V(c)
    d = c - a
    rot = V((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    b.cyl(r, r, d.length, m, tuple((a + c) / 2), tuple(rot), seg=seg)


def motorbike(kind, lod):
    """A sport bike ('bike') or a long, low chopper ('chopper'). Forward is +Y."""
    P = palette()
    b = Builder()
    chop = kind == 'chopper'
    yf, yr, wr = (0.98, -0.8, 0.34) if chop else (0.72, -0.72, 0.32)
    neon = 'pink' if chop else 'cyan'
    wheel(b, P, 0, yf, wr, 0.15, 1, neon, lod)
    wheel(b, P, 0, yr, wr, 0.24 if chop else 0.18, 1, neon, lod)
    wheel(b, P, 0, yf, wr * 0.999, 0.15, -1, neon, lod) if lod == 0 else None
    seg = 10 if lod == 0 else 6
    # front fork and handlebar
    top = (0, yf - (0.42 if chop else 0.2), 1.12 if chop else 0.98)
    for sx in (-0.09, 0.09):
        _rod(b, P['chrome'], (sx, yf, wr), (sx, top[1], top[2]), 0.028, seg)
    hb = top[2] + (0.12 if chop else 0.04)
    _rod(b, P['black'], (-0.38 if chop else -0.32, top[1] - 0.05, hb + (0.12 if chop else 0)), (0.38 if chop else 0.32, top[1] - 0.05, hb + (0.12 if chop else 0)), 0.022, seg)
    for sx in (-1, 1):
        b.cyl(0.03, 0.03, 0.12, P['rubber'], (sx * (0.37 if chop else 0.31), top[1] - 0.05, hb + (0.12 if chop else 0)), (0, math.pi / 2, 0), seg=seg)
    # rear swingarm and the frame
    for sx in (-0.11, 0.11):
        _rod(b, P['trim'], (sx, yr, wr), (sx, -0.05, 0.45), 0.03, seg)
    _rod(b, P['trim'], (0, -0.05, 0.45), (0, top[1] - 0.05, top[2] - 0.15), 0.04, seg)
    # engine
    b.box(0.34, 0.5, 0.34, P['trim'], (0, 0.05, 0.47), bevel=0.04 if lod == 0 else 0)
    for k in range(3 if lod == 0 else 0):
        b.box(0.36, 0.04, 0.3, P['chrome'], (0, -0.12 + k * 0.12, 0.48))
    b.box(0.3, 0.4, 0.02, P[neon], (0, 0.05, 0.29))  # underglow
    if chop:
        b.sphere(0.2, P['paint'], (0, 0.25, 0.92), (0.85, 1.5, 0.75), u=14 if lod == 0 else 8, v=8 if lod == 0 else 5)  # teardrop tank
        b.box(0.32, 0.55, 0.09, P['black'], (0, -0.35, 0.72), bevel=0.04 if lod == 0 else 0)  # low seat
        b.box(0.3, 0.18, 0.3, P['black'], (0, -0.66, 0.82), (0.3, 0, 0), bevel=0.04 if lod == 0 else 0)  # backrest
        b.box(0.34, 0.5, 0.06, P['paint'], (0, yr + 0.05, wr + 0.38), (0.25, 0, 0), bevel=0.02 if lod == 0 else 0)  # rear fender
        for sx in (-1, 1):
            _rod(b, P['chrome'], (sx * 0.2, 0.0, 0.42), (sx * 0.22, -1.05, 0.38), 0.05, seg)  # long exhausts
        b.box(0.05, 0.9, 0.04, P[neon], (0.2, 0.15, 0.78))
        b.box(0.05, 0.9, 0.04, P[neon], (-0.2, 0.15, 0.78))
        seat = (0, -0.3, 0.78)
    else:
        b.box(0.36, 0.62, 0.26, P['paint'], (0, 0.12, 0.86), (-0.12, 0, 0), bevel=0.06 if lod == 0 else 0)  # tank
        b.box(0.44, 0.5, 0.42, P['paint'], (0, 0.6, 0.82), (-0.55, 0, 0), bevel=0.06 if lod == 0 else 0)  # nose fairing
        b.box(0.34, 0.1, 0.22, P['glass'], (0, 0.62, 1.1), (-0.9, 0, 0))  # windscreen
        b.box(0.28, 0.58, 0.09, P['black'], (0, -0.36, 0.9), (0.08, 0, 0), bevel=0.03 if lod == 0 else 0)  # seat
        b.box(0.3, 0.5, 0.2, P['paint'], (0, -0.72, 0.96), (0.28, 0, 0), bevel=0.05 if lod == 0 else 0)  # tail
        b.box(0.04, 0.7, 0.04, P[neon], (0.2, 0.2, 0.72), (-0.15, 0, 0))
        b.box(0.04, 0.7, 0.04, P[neon], (-0.2, 0.2, 0.72), (-0.15, 0, 0))
        _rod(b, P['chrome'], (0.16, -0.1, 0.38), (0.2, -0.95, 0.62), 0.055, seg)  # exhaust
        seat = (0, -0.3, 0.92)
    # lights
    b.box(0.22, 0.04, 0.1, P['head'], (0, (0.9 if not chop else top[1] + 0.12), (0.84 if not chop else top[2] - 0.12)))
    b.box(0.2, 0.04, 0.05, P['tail'], (0, (-0.98 if not chop else yr - 0.2), (1.0 if not chop else wr + 0.4)))
    if lod == 0:
        marker(f'{kind}_seat', seat)
    return finish(b, kind + ('_lod1' if lod else ''), sharp=45, ao=dict(dist=0.5, rays=30 if lod == 0 else 16, ground=0.0, floor=0.3))


KINDS = ['sedan', 'muscle', 'police', 'super', 'compact', 'van', 'bike', 'chopper', 'hover', 'taxi', 'flypolice']


def build_all(lods=(0, 1)):
    objs = []
    for kind in KINDS:
        for lod in lods:
            ob = ground_car(kind, lod) if kind in GROUND else motorbike(kind, lod) if kind in ('bike', 'chopper') else hover_car(kind, lod)
            print(f'  {ob.name}: {tri_count(ob)} triangles')
            objs.append(ob)
    return objs


def previews(objs, out):
    import os
    from lib import render
    for ob in objs:
        if ob.name.endswith('_lod1'):
            continue
        render([ob], os.path.join(out, f'car_{ob.name}_front.png'), cam=(5.2, 6.4, 2.4), target=(0, 0.1, 0.65), lens=42)
        render([ob], os.path.join(out, f'car_{ob.name}_rear.png'), cam=(-4.6, -6.2, 2.0), target=(0, -0.1, 0.65), lens=42)
    lod = [o for o in objs if o.name == 'sedan_lod1']
    if lod:
        render(lod, os.path.join(out, 'car_sedan_lod1_front.png'), cam=(5.2, 6.4, 2.4), target=(0, 0.1, 0.65), lens=42)
