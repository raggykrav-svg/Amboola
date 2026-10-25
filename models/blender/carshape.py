# A car body from its real measurements and a few outline points, instead of a station table typed by hand.
#
# Every car in the station-table kit (carkit.stations) is a stack of half cross-sections. Here those are worked out
# from curves a person can read off photos and spec sheets:
#   L, W, H, WB, fo   length, width, height, wheelbase, front overhang (m). The axles sit at x = +-WB/2 + dx.
#   top               [(x, z)] the centre-line silhouette from nose to tail (bonnet, windscreen, roof, deck)
#   belt              [(x, z)] the shoulder: the top of the fenders and doors, the bottom edge of the side glass
#   plan              [(x, half width)] the body seen from above (widest point of each section)
#   roof              [(x, half width)] the roof edge seen from above (only where there is a roof)
#   cab               (windscreen base x, windscreen top x, rear glass top x, rear glass base x)
#   bulge / hip       how far the front / rear fender crowns stand above the bonnet / deck centre line
#   clear, nose_zb, tail_zb   ground clearance mid-car and how high the bumpers' bottoms are at each end
# The curves go through their points smoothly (monotone cubic, so they never overshoot).
import math
from carkit import V, lerp, pl, stations, side


def smooth(pts):
    """monotone cubic (Fritsch-Carlson) through [(x, y)], clamped at the ends"""
    p = sorted(pts); xs = [a for a, _ in p]; ys = [b for _, b in p]; n = len(p)
    if n < 3: return lambda x: pl(p, x)
    d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(n - 1)]
    m = [d[0]] + [0.0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2 for i in range(1, n - 1)] + [d[-1]]
    for i in range(n - 1):
        if d[i] == 0: m[i] = m[i + 1] = 0.0; continue
        a, b = m[i] / d[i], m[i + 1] / d[i]; s = a * a + b * b
        if s > 9: t = 3 / math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]
    def f(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[-1]: return ys[-1]
        i = max(j for j in range(n - 1) if xs[j] <= x); h = xs[i + 1] - xs[i]; t = (x - xs[i]) / h
        return ((2 * t ** 3 - 3 * t ** 2 + 1) * ys[i] + (t ** 3 - 2 * t ** 2 + t) * h * m[i]
                + (-2 * t ** 3 + 3 * t ** 2) * ys[i + 1] + (t ** 3 - t ** 2) * h * m[i + 1])
    return f


class Shape:
    def __init__(self, P):
        self.P = P
        self.xf = P['WB'] / 2 + P.get('dx', 0.0); self.xr = -P['WB'] / 2 + P.get('dx', 0.0)
        self.nose = self.xf + P['fo']; self.tail = self.nose - P['L']
        self.top, self.belt, self.plan = smooth(P['top']), smooth(P['belt']), smooth(P['plan'])
        self.roofw = smooth(P['roof'])
        self.bulge = smooth(P['bulge']) if isinstance(P.get('bulge'), list) else (lambda x, b=P.get('bulge', 0.03): b)
        ws0, ws1, rw1, rw0 = P['cab']
        self.ws0, self.ws1, self.rw1, self.rw0 = ws0, ws1, rw1, rw0
        mid = (ws1 + rw1) / 2
        self.cabin_h = self.top(mid) - self.belt(mid)

    def zb(self, x):
        P = self.P; c = P.get('clear', 0.12)
        fn = min(1.0, max(0.0, (x - self.xf - P.get('nose_run', 0.25)) / max(0.05, self.nose - self.xf - P.get('nose_run', 0.25))))
        ft = min(1.0, max(0.0, (self.xr - P.get('tail_run', 0.25) - x) / max(0.05, self.xr - P.get('tail_run', 0.25) - self.tail)))
        return c + (P.get('nose_zb', 0.28) - c) * fn ** 1.6 + (P.get('tail_zb', 0.34) - c) * ft ** 1.6

    def t(self, x):
        """0 on the bonnet and deck, 1 under the roof: how far the centre line has climbed above the shoulder"""
        if not (self.rw0 - 0.05 < x < self.ws0 + 0.05): return 0.0
        return min(1.0, max(0.0, (self.top(x) - self.belt(x) - 0.03) / max(0.1, self.cabin_h - 0.03))) ** self.P.get('pillar_curve', 1.0)

    def row(self, x):
        P = self.P; zt, zbl, w, zb = self.top(x), self.belt(x), self.plan(x), self.zb(x)
        t = self.t(x)
        wb = w * P.get('shoulder', 0.965); zs = zb + (zbl - zb) * P.get('zs', 0.55)
        crown = self.bulge(x) if x > 0 else P.get('hip', 0.03)
        # bonnet / deck: fender crowns either side of a valley
        wg_f, zg_f = w * P.get('crown_w', 0.78), max(zt + crown, zbl + 0.025)
        wr_f, zr_f = w * P.get('valley_w', 0.46), zt + max(0.0, crown) * 0.25
        # cabin: the roof edge and the roof's gentle crown
        rw = self.roofw(x) if t > 0 else w * 0.6
        wg_c, zg_c = min(rw, wb - 0.02), zt - P.get('roof_crown', 0.065)
        wr_c, zr_c = min(rw, wb - 0.02) * 0.8, zt - P.get('roof_crown', 0.065) * 0.25
        wg, zg = lerp(wg_f, wg_c, t), lerp(zg_f, zg_c, t)
        wr, zr = lerp(wr_f, wr_c, t), lerp(zr_f, zr_c, t)
        zg = max(zg, zbl + 0.02); wr = min(wr, wg - 0.03)
        return (x, zb, w, zs, wb, zbl, wg, zg, wr, zr, zt)

    def rows(self, n=40):
        out = []
        for i in range(n):
            u = i / (n - 1); s = 0.55 * (0.5 - 0.5 * math.cos(math.pi * u)) + 0.45 * u     # closer at the ends
            out.append(self.row(lerp(self.nose - 0.002, self.tail + 0.002, s)))
        return out

    def wheels(self, F, R):
        """F/R = dict(r, w, rim) with the axles put where this shape has them; y is the track"""
        P = self.P
        return dict(F=dict(F, x=self.xf, y=F.get('y', P['W'] / 2 - F['w'] / 2 - 0.035)),
                    R=dict(R, x=self.xr, y=R.get('y', P['W'] / 2 - R['w'] / 2 - 0.03)))


def build(k, P, F, R, crease=None, glass=True):
    """loft the shell, cut the wheel wells, add the glass, mirrors, door lines and the cabin; returns the Shape"""
    S = Shape(P)
    k.loft(stations(S.rows(P.get('stations', 40))), **(crease or {}))
    k.arches(S.wheels(F, R)); k.surface()
    if not glass: return S
    ws0, ws1, rw1, rw0 = S.ws0, S.ws1, S.rw1, S.rw0
    zb0, zb1 = S.top(ws0), S.top(ws1)
    rwt = S.roofw(ws1) * 0.94
    k.windscreen(ws0, ws1 + 0.02, zb0, (zb1 - zb0) / (ws0 - ws1), lerp(rwt, S.plan(ws0) * 0.78, P.get('ws_base_w', 0.6)), rwt,
                 sweep=P.get('ws_sweep', 0.2))
    if P.get('rear_glass', True) and rw1 - rw0 > 0.05:
        z0, z1 = S.top(rw0), S.top(rw1)
        k.rear_window(rw0, rw1 - 0.02, z0, (z1 - z0) / (rw1 - rw0), S.roofw(rw0) * P.get('rw_w', 0.85), S.roofw(rw1) * P.get('rw_w', 0.85) * 0.95,
                      bulge=P.get('rw_bulge', 0.04))
    sx0, sx1 = P.get('side', (ws0 - 0.08, rw1 + 0.05))
    xs = [lerp(sx0, sx1, i / 20) for i in range(21)]
    top = [(x, S.row(x)[7] - P.get('frame', 0.035)) for x in xs]
    bot = [(x, S.belt(x) + 0.015) for x in xs]
    # the window's front and back ends follow its own curves: a point where the outlines cross closes the shape
    k.side_glass(top, bot, pillars=P.get('pillars', ()), pillar_w=P.get('pillar_w', 0.05))
    for s in (1, -1):
        for xd in P.get('doors', ()):
            k.decal('doorline', 'Black', side(s), xd - .004, xd + .004, S.zb(xd) + 0.12, S.belt(xd) - 0.01, 1, 12, off=.002)
    mx = P.get('mirror_x', ws0 - 0.12)
    k.mirrors(mx, S.plan(mx) * S.P.get('shoulder', 0.965) + P.get('mirror_out', 0.05), S.belt(mx) + 0.06, size=P.get('mirror_size', (0.14, 0.19, 0.09)))
    xm = (ws1 + rw1) / 2
    k.interior(xm, S.roofw(xm) * 2, S.belt(xm) - 0.2, l=max(0.8, ws0 - rw1), h=0.32, seats_x=xm - 0.2, seat_z=S.belt(xm) - 0.1)
    return S
