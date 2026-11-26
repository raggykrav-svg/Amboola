# Build the Sumer game data (sumer/data/limassol.bin) from raw OSM features.
# Data: (c) OpenStreetMap contributors, ODbL.
import pickle, math, json, struct, random, collections, sys, gzip, time, hashlib
import numpy as np
import shapely
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point, box, GeometryCollection
from shapely.ops import unary_union, linemerge
from shapely.strtree import STRtree

RAW, OUT = sys.argv[1], sys.argv[2]
T0 = time.time()
def log(*a):
    print('[%6.1fs]' % (time.time() - T0), *a, flush=True)

d = pickle.load(open(RAW, 'rb'))
AREA = box(-7000, -7150, 9400, 4950)
X0, Z0, CS = -7000, -7250, 250
NX, NZ = 66, 49
def chunk_of(x, z):
    ix = int((x - X0) // CS); iz = int((z - Z0) // CS)
    if 0 <= ix < NX and 0 <= iz < NZ: return iz * NX + ix
    return -1
def chunk_box(ci):
    ix, iz = ci % NX, ci // NX
    return box(X0 + ix * CS, Z0 + iz * CS, X0 + (ix + 1) * CS, Z0 + (iz + 1) * CS)
def h32(s):
    return int(hashlib.md5(str(s).encode()).hexdigest()[:8], 16)

def polys_of(g):
    if g is None or g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    if g.geom_type in ('MultiPolygon', 'GeometryCollection'):
        out = []
        for x in g.geoms: out += polys_of(x)
        return out
    return []
def lines_of(g):
    if g is None or g.is_empty: return []
    if g.geom_type == 'LineString': return [g]
    if g.geom_type in ('MultiLineString', 'GeometryCollection'):
        out = []
        for x in g.geoms: out += lines_of(x)
        return out
    return []
def mkpoly(outer, holes):
    try:
        p = Polygon(outer, [h for h in holes if len(h) >= 4])
        if not p.is_valid: p = p.buffer(0)
        return p
    except Exception:
        return None

# ---------------------------------------------------------------- land / coast
coast_lines = [LineString(p) for _, p in d['coast'] if len(p) >= 2]
m = linemerge(coast_lines)
rings = [g for g in (m.geoms if hasattr(m, 'geoms') else [m]) if g.is_ring]
island_polys = [Polygon(r) for r in rings]
island_polys = [p if p.is_valid else p.buffer(0) for p in island_polys]
main_island = max(island_polys, key=lambda p: p.area)
land_all = unary_union(island_polys)
LAND = land_all.intersection(AREA)
log('land km2', round(LAND.area / 1e6, 2))
# far land for the horizon (simplified island minus play area)
FAR = main_island.simplify(25).intersection(box(-70000, -70000, 70000, 50000)).difference(AREA.buffer(-1))
COAST_LINE = LAND.boundary.difference(AREA.exterior.buffer(2))  # coastline inside area
coast_tree_geom = COAST_LINE

# ---------------------------------------------------------------- landuse areas
areas = d['areas']
def cls_of(t):
    lu, le, na, am, mm = t.get('landuse'), t.get('leisure'), t.get('natural'), t.get('amenity'), t.get('man_made')
    if 'building' in t or 'building:part' in t: return None
    if mm == 'breakwater' or mm == 'groyne': return 'BREAKWATER'
    if mm == 'pier': return 'PIER'
    if le == 'swimming_pool': return 'POOL'
    if na == 'water' or lu in ('reservoir', 'basin') or t.get('waterway') == 'riverbank' or t.get('water'): return 'WATER'
    if na in ('beach', 'sand'): return 'SAND'
    if le == 'track': return 'TRACK'
    if le == 'pitch':
        s = t.get('surface', ''); sp = t.get('sport', '')
        if s in ('grass', 'artificial_turf') or sp in ('soccer', 'football', 'golf'): return 'PITCHGRASS'
        if s in ('clay',): return 'PITCHCLAY'
        return 'PITCHHARD'
    if le == 'playground': return 'PLAYGROUND'
    if le == 'stadium': return None
    if am == 'parking' and t.get('parking', 'surface') in ('surface', 'yes', 'lane', 'street_side'): return 'PARKING'
    if t.get('highway') in ('pedestrian', 'footway', 'platform') or t.get('area:highway') in ('pedestrian', 'footway') or t.get('place') == 'square' or am in ('marketplace',): return 'PAVING'
    if am in ('school', 'university', 'college', 'kindergarten', 'hospital'): return 'INST'
    if na in ('wood',) or lu == 'forest': return 'WOOD'
    if na in ('scrub', 'heath'): return 'SCRUB'
    if le in ('park', 'garden', 'common', 'golf_course', 'dog_park') or lu in ('grass', 'recreation_ground', 'village_green', 'flowerbed') or na == 'grassland': return 'GRASS'
    if lu in ('farmland', 'meadow', 'orchard', 'vineyard', 'plant_nursery', 'greenfield', 'allotments', 'farmyard', 'greenhouse_horticulture'): return 'FARM'
    if lu in ('construction', 'brownfield', 'landfill', 'quarry') or na in ('bare_rock', 'scree'): return 'DIRT'
    if lu == 'cemetery' or am == 'grave_yard': return 'CEMETERY'
    if lu in ('industrial', 'port', 'railway', 'military'): return 'INDUSTRIAL'
    return None
CLS_ORDER = ['LAND', 'FARM', 'INDUSTRIAL', 'INST', 'DIRT', 'CEMETERY', 'SCRUB', 'GRASS', 'WOOD', 'SAND', 'PITCHGRASS', 'PITCHHARD', 'PITCHCLAY', 'TRACK', 'PLAYGROUND', 'PARKING', 'WATER', 'POOL', 'PAVING', 'TRACKDIRT', 'ASPHALT', 'CYCLE', 'FOOTPATH', 'SIDEWALK', 'PIER', 'BREAKWATER']
CLS_ID = {c: i for i, c in enumerate(CLS_ORDER)}
ground = collections.defaultdict(list)
orchards, woods, parks, scrubs, landuse_ind, landuse_res, beach_polys = [], [], [], [], [], [], []
for aid, polys, t in areas:
    c = cls_of(t)
    lu = t.get('landuse')
    for outer, holes in polys:
        p = mkpoly(outer, holes)
        if p is None or p.is_empty: continue
        if not p.intersects(AREA): continue
        if lu in ('industrial', 'port') : landuse_ind.append(p)
        if lu in ('residential',): landuse_res.append(p)
        if c is None: continue
        ground[c].append(p)
        if lu == 'orchard': orchards.append((p, t))
        if c == 'WOOD': woods.append(p)
        if c == 'SCRUB': scrubs.append(p)
        if c == 'GRASS' and t.get('leisure') in ('park', 'garden'): parks.append((p, t))
        if c == 'SAND': beach_polys.append(p)
log('ground classes', {k: len(v) for k, v in ground.items()})

# linear breakwaters / piers -> polygons
for wid, pts, t, closed in d['lines']:
    mm = t.get('man_made')
    if mm in ('breakwater', 'groyne', 'pier') and len(pts) >= 2:
        if closed and len(pts) >= 4:
            continue  # handled as area
        w = 6.0 if mm != 'pier' else 3.0
        try: w = float(t.get('width', w))
        except: pass
        g = LineString(pts).buffer(w / 2, cap_style='flat' if mm == 'pier' else 'round', quad_segs=3)
        ground['PIER' if mm == 'pier' else 'BREAKWATER'].append(g)

# ---------------------------------------------------------------- roads
ROADW = {  # nominal carriageway width (two-way), sidewalk?, class id
    'motorway': (15, 0, 1), 'trunk': (14, 0, 2), 'primary': (11, 2.6, 3), 'secondary': (9.5, 2.4, 4), 'tertiary': (8, 2.2, 5),
    'unclassified': (6.5, 1.8, 6), 'residential': (6.5, 1.8, 6), 'living_street': (5, 1.2, 7), 'service': (4.2, 0, 8),
    'motorway_link': (6.5, 0, 9), 'trunk_link': (6.5, 0, 9), 'primary_link': (6.5, 0, 9), 'secondary_link': (6.5, 0, 9), 'tertiary_link': (6, 0, 9),
    'road': (6, 1.5, 6), 'busway': (6, 0, 6), 'construction': (6, 0, 6),
}
PATHW = {'pedestrian': (6, 'PAVING', 10), 'footway': (2.4, 'FOOTPATH', 11), 'path': (1.8, 'FOOTPATH', 12), 'steps': (2.4, 'FOOTPATH', 13),
         'cycleway': (2.4, 'CYCLE', 14), 'track': (3.2, 'TRACKDIRT', 15), 'bridleway': (2, 'TRACKDIRT', 12)}
roads = []   # dict(line, w, sw, cls, name, oneway, hw)
paths = []
for wid, pts, t, closed in d['lines']:
    hw = t.get('highway')
    if not hw or len(pts) < 2: continue
    if t.get('tunnel') in ('yes', 'building_passage', 'culvert') or t.get('indoor') == 'yes' or t.get('area') == 'yes': continue
    if hw == 'construction' and t.get('construction') in (None, 'yes'): pass
    line = LineString(pts)
    if not line.intersects(AREA): continue
    name = t.get('name:en') or t.get('name') or ''
    if hw in ROADW:
        w, sw, cid = ROADW[hw]
        oneway = t.get('oneway') in ('yes', '1', '-1') or t.get('junction') == 'roundabout'
        if oneway and hw not in ('service',): w = w * 0.62
        try:
            if 'width' in t: w = max(3.0, min(30.0, float(t['width'].split()[0])))
            elif 'lanes' in t: w = max(3.0, min(28.0, float(t['lanes']) * 3.3 + (0.6 if oneway else 1.2)))
        except Exception: pass
        if t.get('service') in ('driveway', 'parking_aisle', 'drive-through', 'alley'): w = 3.6 if t.get('service') != 'parking_aisle' else 5.0
        if t.get('sidewalk') in ('no', 'none') : sw = 0
        roads.append(dict(line=line, w=w, sw=sw, cls=cid, name=name, oneway=oneway, hw=hw, bridge=t.get('bridge') == 'yes', id=wid))
    elif hw in PATHW:
        w, mat, cid = PATHW[hw]
        if t.get('footway') == 'crossing' or t.get('crossing') or t.get('cycleway') == 'crossing' or t.get('path') == 'crossing': mat = 'CROSSING'
        if hw == 'footway' and t.get('footway') == 'sidewalk': w = 2.0
        if hw in ('path', 'footway') and t.get('surface') in ('dirt', 'ground', 'earth', 'grass', 'sand', 'gravel', 'unpaved', 'fine_gravel', 'compacted'): mat = 'TRACKDIRT'
        if hw == 'track' and t.get('surface') in ('asphalt', 'paved', 'concrete'): mat = 'ASPHALT'
        try:
            if 'width' in t: w = max(1.0, min(20.0, float(t['width'].split()[0])))
        except Exception: pass
        paths.append(dict(line=line, w=w, mat=mat, cls=cid, name=name, hw=hw, id=wid))
log('roads', len(roads), 'paths', len(paths))

# pedestrian areas (closed ways with area=yes) were caught as areas -> PAVING already

# ---------------------------------------------------------------- buildings (outlines)
blds = []
for aid, polys, t in areas:
    if not ('building' in t or 'building:part' in t): continue
    if t.get('building') in ('no', 'entrance') or t.get('building:part') == 'no' and 'building' not in t: continue
    for outer, holes in polys:
        p = mkpoly(outer, holes)
        if p is None or p.is_empty or p.area < 6: continue
        for q in polys_of(p):
            if q.area < 6: continue
            c = q.representative_point()
            if not AREA.contains(c): continue
            blds.append(dict(p=q, t=t, part='building:part' in t and 'building' not in t, id=aid))
log('buildings raw', len(blds))
# outlines that have parts -> drop outline
outl = [b for b in blds if not b['part']]
parts = [b for b in blds if b['part']]
tree_o = STRtree([b['p'] for b in outl])
drop = set()
for b in parts:
    rp = b['p'].representative_point()
    for i in tree_o.query(rp, predicate='within'):
        drop.add(i)
blds = [b for i, b in enumerate(outl) if i not in drop] + parts
log('buildings after part merge', len(blds), 'dropped outlines', len(drop))

# spatial helpers
B_TREE = STRtree([b['p'] for b in blds])
CASTLE = (-54.0, 294.0)
coast_prep = COAST_LINE
ind_union = unary_union(landuse_ind) if landuse_ind else Polygon()
shapely.prepare(ind_union)
# distance to coast for building centroids (vectorised)
cent = shapely.points([(b['p'].centroid.x, b['p'].centroid.y) for b in blds])
dcoast = shapely.distance(cent, COAST_LINE)
in_ind = shapely.contains(ind_union, cent)
for b, dc, ii in zip(blds, dcoast, in_ind):
    b['dcoast'] = float(dc); b['ind'] = bool(ii)

# road widths adapted to free space between buildings
def adapt_roads():
    bp = [b['p'] for b in blds if not b['part']]
    tr = STRtree(bp)
    for r in roads:
        L = r['line'].length
        n = max(2, min(40, int(L / 8)))
        pts = [r['line'].interpolate((i + .5) / n, normalized=True) for i in range(n)]
        idx, dist = tr.query_nearest(pts, return_distance=True, all_matches=False)
        # dist per point (idx[0] is input index)
        dd = np.full(n, 60.0)
        for k, j in enumerate(idx[0]): dd[j] = min(dd[j], dist[k])
        free = float(np.percentile(dd, 30))  # typical free half-width
        hw = r['w'] / 2
        if r['cls'] in (1, 2, 9): r['free'] = free; continue
        if free < hw + r['sw']:
            if free >= hw + 0.9:
                r['sw'] = min(r['sw'], free - hw)
            else:
                nh = max(2.2, free - 0.9)
                r['w'] = min(r['w'], 2 * nh)
                r['sw'] = 0.9 if r['sw'] > 0 else 0
        r['free'] = free
adapt_roads()
log('roads adapted')

# ---------------------------------------------------------------- building attributes
def fnum(s):
    try:
        s = str(s).replace(',', '.').split(';')[0].strip()
        for suf in ('m', ' m', 'meters', 'metre'):
            if s.endswith(suf): s = s[:-len(suf)].strip()
        return float(s)
    except Exception:
        return None
STYLE = dict(APT=0, HOUSE=1, STONE=2, GLASS=3, IND=4, CHURCH=5, MODERN=6, OFFICE=7, CASTLE=8, PLAIN=9, GREEN=10)
ROOF = dict(FLAT=0, HIP=1, GABLE=2, DOME=3, PYR=4, SKILL=5, NONE=6)
WALLS = [  # palette of wall colours (sRGB)
    (0.95, 0.94, 0.91), (0.93, 0.91, 0.85), (0.92, 0.88, 0.78), (0.89, 0.84, 0.73), (0.94, 0.90, 0.80),
    (0.90, 0.80, 0.68), (0.86, 0.78, 0.62), (0.80, 0.74, 0.62), (0.93, 0.86, 0.70), (0.88, 0.88, 0.86),
    (0.83, 0.71, 0.55), (0.95, 0.83, 0.70), (0.78, 0.80, 0.80), (0.70, 0.72, 0.74), (0.62, 0.66, 0.70),
    (0.85, 0.77, 0.60), (0.96, 0.92, 0.86), (0.90, 0.92, 0.94),
]
ROOFC = [(0.74, 0.33, 0.20), (0.80, 0.40, 0.25), (0.68, 0.30, 0.20), (0.84, 0.46, 0.30), (0.62, 0.28, 0.18),
         (0.82, 0.81, 0.78), (0.70, 0.70, 0.68), (0.88, 0.87, 0.84), (0.55, 0.55, 0.55), (0.40, 0.45, 0.50), (0.66, 0.62, 0.55)]
def col_from_tag(s):
    if not s: return None
    s = s.strip().lower()
    named = {'white': (0.95, 0.95, 0.93), 'grey': (0.65, 0.66, 0.66), 'gray': (0.65, 0.66, 0.66), 'yellow': (0.93, 0.86, 0.55), 'brown': (0.55, 0.40, 0.28), 'black': (0.25, 0.25, 0.26), 'blue': (0.45, 0.6, 0.75), 'green': (0.5, 0.65, 0.5), 'red': (0.7, 0.3, 0.25), 'beige': (0.9, 0.85, 0.72)}
    if s in named: return named[s]
    if s.startswith('#') and len(s) == 7:
        try: return tuple(int(s[i:i + 2], 16) / 255 for i in (1, 3, 5))
        except Exception: return None
    return None
def nearest_idx(pal, c):
    return min(range(len(pal)), key=lambda i: sum((pal[i][k] - c[k]) ** 2 for k in range(3)))

# shops near buildings: POI shop/amenity points
shop_pts = []
for (x, z), t in d['points']:
    if 'shop' in t or t.get('amenity') in ('cafe', 'restaurant', 'bar', 'pub', 'fast_food', 'bank', 'pharmacy', 'ice_cream'):
        shop_pts.append((x, z, t.get('name', ''), t.get('shop') or t.get('amenity')))
shop_tree = STRtree([Point(x, z) for x, z, _, _ in shop_pts]) if shop_pts else None
# main road lines for shopfront flag
main_lines = [r['line'] for r in roads if r['cls'] in (3, 4, 5)]
main_tree = STRtree(main_lines)

def est_levels(b, area, rnd):
    t = b['t']; typ = t.get('building') or t.get('building:part') or 'yes'
    dc = b['dcoast']; x, z = b['p'].centroid.x, b['p'].centroid.y
    dold = math.hypot(x - CASTLE[0], z - CASTLE[1])
    if typ in ('garage', 'garages', 'shed', 'carport', 'hut', 'kiosk', 'toilets', 'cabin', 'container', 'service', 'transformer_tower', 'bunker'): return 1
    if typ in ('industrial', 'warehouse', 'hangar', 'manufacture', 'storage_tank', 'barn', 'farm_auxiliary'): return 1
    if typ in ('greenhouse', 'roof', 'ruins', 'grandstand'): return 1
    if typ in ('house', 'detached', 'semidetached_house', 'bungalow', 'terrace', 'farm', 'villa'):
        return 1 if rnd < 0.35 else 2
    if typ in ('church', 'chapel', 'cathedral', 'mosque', 'temple', 'synagogue'): return 2
    if typ in ('school', 'kindergarten', 'university', 'college'): return 2 if rnd < .6 else 3
    if typ in ('hotel',): return int(5 + rnd * 7)
    if typ in ('hospital',): return int(3 + rnd * 3)
    if typ in ('retail', 'supermarket'): return 1 if area > 1500 else int(1 + rnd * 2)
    if b['ind']: return 1 if area > 300 or rnd < .7 else 2
    # generic 'yes' / residential / apartments / commercial / office
    if area < 45: lv = 1
    elif area < 110: lv = 1 + (rnd < 0.55)
    elif area < 220: lv = 2 + (rnd < 0.35)
    elif area < 450: lv = 2 + int(rnd * 3)
    elif area < 1200: lv = 3 + int(rnd * 4)
    elif area < 4000: lv = 2 + int(rnd * 4)
    else: lv = 1 + int(rnd * 2)
    if typ in ('apartments', 'residential'): lv = max(lv, 3 if area > 150 else 2)
    if typ in ('office', 'commercial'): lv = max(lv, 3 if area > 250 else 2)
    if dold < 650: lv = min(lv, 3 if area < 600 else 4)
    elif dc < 160 and x > 400 and area > 180: lv += 2 + int(rnd * 5)   # seafront blocks
    elif dc < 400 and x > 400 and area > 250: lv += 1 + int(rnd * 2)
    return max(1, min(lv, 14))

bout = []
for i, b in enumerate(blds):
    t = b['t']; p = b['p']
    typ = t.get('building') or t.get('building:part') or 'yes'
    area = p.area
    rnd = (h32(b['id']) % 10000) / 10000.0
    rnd2 = (h32(str(b['id']) + 'b') % 10000) / 10000.0
    rnd3 = (h32(str(b['id']) + 'c') % 10000) / 10000.0
    x, z = p.centroid.x, p.centroid.y
    dold = math.hypot(x - CASTLE[0], z - CASTLE[1])
    H = fnum(t.get('height')) or fnum(t.get('building:height'))
    lv = fnum(t.get('building:levels'))
    if lv is not None and lv <= 0: lv = None
    tagged = H is not None or lv is not None
    minH = fnum(t.get('min_height')) or 0.0
    if not minH and t.get('building:min_level'):
        ml = fnum(t.get('building:min_level'))
        if ml: minH = ml * 3.1
    if lv is None:
        lv = est_levels(b, area, rnd) if H is None else max(1, round(H / 3.2))
    floor_h = 3.15
    if typ in ('industrial', 'warehouse', 'hangar', 'retail', 'supermarket') and lv <= 2: floor_h = 4.5 + rnd2 * 3
    if typ in ('church', 'chapel', 'cathedral', 'mosque'): floor_h = 5.0
    if H is None:
        H = lv * floor_h + (0.6 if lv > 1 else 0.3)
        if typ in ('garage', 'garages', 'shed', 'carport', 'hut', 'kiosk', 'toilets', 'container'): H = 2.6 + rnd * 0.6
        if typ == 'greenhouse': H = 3.2
        if typ == 'roof': H = 4.6; minH = 4.0
        if typ == 'ruins': H = 2.5
        if typ == 'carport': H = 2.6; minH = 2.2
    H = max(H, minH + 1.0)
    # style
    roofshape = (t.get('roof:shape') or '').lower()
    hist = t.get('historic')
    if hist == 'castle' or 'Κάστρο' in t.get('name', '') or 'Castle' in t.get('name', ''):
        style = STYLE['CASTLE']
    elif typ in ('church', 'chapel', 'cathedral', 'mosque') or t.get('amenity') == 'place_of_worship':
        style = STYLE['CHURCH']
    elif typ == 'greenhouse':
        style = STYLE['GREEN']
    elif typ in ('industrial', 'warehouse', 'hangar', 'manufacture', 'storage_tank') or (b['ind'] and lv <= 2 and typ == 'yes'):
        style = STYLE['IND']
    elif H > 45 or t.get('building:material') == 'glass' or (typ in ('office',) and H > 18):
        style = STYLE['GLASS'] if (rnd2 < 0.5 or t.get('building:material') == 'glass' or typ == 'office') else STYLE['MODERN']
    elif typ in ('office', 'commercial', 'retail', 'supermarket', 'hospital', 'university', 'school', 'college', 'public', 'civic', 'government'):
        style = STYLE['OFFICE'] if rnd2 < 0.6 else STYLE['PLAIN']
    elif typ in ('garage', 'garages', 'shed', 'carport', 'hut', 'roof', 'ruins', 'container', 'kiosk', 'toilets', 'service'):
        style = STYLE['PLAIN']
    elif dold < 700 and lv <= 3:
        style = STYLE['STONE'] if rnd2 < 0.5 else STYLE['HOUSE']
    elif lv <= 2 and (typ in ('house', 'detached', 'semidetached_house', 'terrace', 'bungalow') or area < 260):
        style = STYLE['HOUSE']
    elif b['dcoast'] < 250 and lv >= 5 and rnd2 < 0.6:
        style = STYLE['MODERN']
    else:
        style = STYLE['APT'] if rnd2 < 0.78 else STYLE['MODERN']
    # roof
    if roofshape in ('gabled', 'saltbox'): roof = ROOF['GABLE']
    elif roofshape in ('hipped', 'half-hipped', 'mansard', 'gambrel'): roof = ROOF['HIP']
    elif roofshape in ('pyramidal',): roof = ROOF['PYR']
    elif roofshape in ('dome', 'round', 'onion'): roof = ROOF['DOME']
    elif roofshape in ('skillion',): roof = ROOF['SKILL']
    elif roofshape == 'flat': roof = ROOF['FLAT']
    else:
        ptile = 0.0
        if style in (STYLE['HOUSE'],): ptile = 0.78 if dold < 900 else 0.55
        if style == STYLE['STONE']: ptile = 0.85
        if style == STYLE['APT'] and lv <= 3 and area < 500: ptile = 0.45 if dold < 1500 else 0.22
        if style == STYLE['CHURCH']: ptile = 0.9
        if style in (STYLE['PLAIN'],) and typ in ('house', 'yes') and area < 200 : ptile = 0.3
        if rnd3 < ptile:
            roof = ROOF['HIP'] if rnd < 0.6 else ROOF['GABLE']
        else:
            roof = ROOF['FLAT']
        if typ in ('roof', 'carport', 'greenhouse', 'ruins'): roof = ROOF['FLAT'] if typ != 'ruins' else ROOF['NONE']
    if style == STYLE['IND'] and roof == ROOF['FLAT'] and rnd3 < 0.35 and area < 3000: roof = ROOF['GABLE']
    # colours
    wc = col_from_tag(t.get('building:colour'))
    if wc is not None and t.get('building:colour') in ('grey', 'gray'):
        wc = None  # mostly imported default 'grey' tags; ignore
    if wc is not None:
        wall = nearest_idx(WALLS, wc)
    else:
        if style == STYLE['STONE']: wall = [6, 7, 15, 2, 10][int(rnd * 5)]
        elif style == STYLE['CASTLE']: wall = 7
        elif style == STYLE['CHURCH']: wall = [2, 3, 16, 6][int(rnd * 4)]
        elif style == STYLE['GLASS']: wall = [13, 14, 12, 17][int(rnd * 4)]
        elif style == STYLE['IND']: wall = [9, 12, 13, 1, 3][int(rnd * 5)]
        elif style == STYLE['MODERN']: wall = [0, 16, 0, 17, 9][int(rnd * 5)]
        else:
            r = rnd
            wall = 0 if r < .17 else 16 if r < .29 else 1 if r < .43 else 4 if r < .56 else 2 if r < .66 else 8 if r < .75 else 11 if r < .83 else 3 if r < .90 else 9 if r < .95 else 5
    rc = col_from_tag(t.get('roof:colour'))
    if roof in (ROOF['HIP'], ROOF['GABLE'], ROOF['PYR']):
        roofc = nearest_idx(ROOFC, rc) if rc and t.get('roof:colour') not in ('grey', 'gray') else int(rnd2 * 5) % 5
        if style == STYLE['IND']: roofc = 9 if rnd < .5 else 8
    elif roof == ROOF['DOME']:
        roofc = 5
    else:
        roofc = 7 if rnd < 0.45 else 5 if rnd < 0.8 else 6
    # flags
    flags = 0
    near_main = False
    if style in (STYLE['APT'], STYLE['MODERN'], STYLE['OFFICE'], STYLE['STONE'], STYLE['HOUSE'], STYLE['PLAIN']):
        for j in main_tree.query(p.buffer(7)):
            near_main = True; break
        has_shop = False
        if shop_tree is not None:
            for j in shop_tree.query(p.buffer(3)):
                has_shop = True; break
        if has_shop or (near_main and lv >= 2 and rnd3 < 0.75) or (dold < 500 and rnd3 < 0.45):
            flags |= 1  # shops on ground floor
        elif style in (STYLE['APT'],) and lv >= 3 and rnd < 0.45:
            flags |= 2  # pilotis (open ground floor parking)
    if typ in ('apartments', 'residential') or style in (STYLE['APT'], STYLE['MODERN']):
        flags |= 4  # balconies
    if style == STYLE['HOUSE'] and roof == ROOF['FLAT'] and rnd < 0.5: flags |= 4
    if tagged: flags |= 8
    name = t.get('name:en') or t.get('name') or ''
    bout.append(dict(p=p, H=H, minH=minH, lv=int(min(lv, 255)), style=style, roof=roof, wall=wall, roofc=roofc, flags=flags, name=name, typ=typ, id=b['id']))
# special buildings: mosques (minaret) and the cathedral (twin bell towers)
KEBIR = Point(88.1, 208.6)
for b in bout:
    if b['typ'] == 'mosque': b['flags'] |= 16; b['style'] = STYLE['CHURCH']
    if b['typ'] == 'cathedral': b['flags'] |= 32
kb = min(bout, key=lambda b: b['p'].distance(KEBIR))
if kb['p'].distance(KEBIR) < 15:
    kb['flags'] |= 16; kb['style'] = STYLE['CHURCH']; kb['name'] = kb['name'] or 'Grand Mosque (Kebir)'
    if kb['roof'] in (1, 2): kb['roof'] = 0
log('buildings attributed', len(bout), collections.Counter(b['style'] for b in bout), collections.Counter(b['roof'] for b in bout))

# ---------------------------------------------------------------- polygons for roads
def road_polys():
    asph, side = [], []
    for r in roads:
        hw = r['w'] / 2
        g = r['line'].buffer(hw, cap_style='round', join_style='round', quad_segs=3)
        asph.append(g)
        if r['sw'] > 0.3:
            side.append(r['line'].buffer(hw + r['sw'], cap_style='round', join_style='round', quad_segs=3))
    pav = collections.defaultdict(list)
    for p in paths:
        if p['mat'] == 'CROSSING': continue
        g = p['line'].buffer(p['w'] / 2, cap_style='round', join_style='round', quad_segs=2)
        pav[p['mat']].append(g)
    return asph, side, pav
asph, side, pav = road_polys()
ground['ASPHALT'] += asph
for k, v in pav.items(): ground[k] += v
SIDE_RAW = side
log('road polys', len(asph), len(side), {k: len(v) for k, v in pav.items()})

# ---------------------------------------------------------------- per-chunk ground
def clip_union(geoms, tree, cbox):
    idx = tree.query(cbox, predicate='intersects')
    if len(idx) == 0: return None
    g = unary_union([geoms[i] for i in idx])
    try:
        g = g.intersection(cbox)
    except Exception:
        g = g.buffer(0).intersection(cbox)
    return g
trees_by_cls = {}
for c, gl in ground.items():
    gl = [g if g.is_valid else g.buffer(0) for g in gl]
    gl = [g for g in gl if not g.is_empty]
    ground[c] = gl
    trees_by_cls[c] = STRtree(gl) if gl else None
side_tree = STRtree(SIDE_RAW)
asph_tree = trees_by_cls['ASPHALT']
land_parts = polys_of(LAND)
land_tree = STRtree(land_parts)
chunk_ground = collections.defaultdict(list)  # ci -> [(cls, polygon)]
chunk_has_land = set()
for ci in range(NX * NZ):
    cb = chunk_box(ci)
    if not cb.intersects(AREA): continue
    lg = clip_union(land_parts, land_tree, cb)
    lpolys = polys_of(lg)
    land_c = unary_union(lpolys) if lpolys else None
    if lpolys:
        chunk_has_land.add(ci)
        for q in lpolys: chunk_ground[ci].append(('LAND', q))
    for c in CLS_ORDER:
        if c in ('LAND', 'SIDEWALK'): continue
        tr = trees_by_cls.get(c)
        if tr is None: continue
        g = clip_union(ground[c], tr, cb)
        if g is None or g.is_empty: continue
        if c not in ('PIER', 'BREAKWATER') and land_c is not None:
            g = g.intersection(land_c.buffer(0.5))
        elif c not in ('PIER', 'BREAKWATER') and land_c is None:
            continue
        for q in polys_of(g):
            if q.area > 0.5: chunk_ground[ci].append((c, q))
    # sidewalks = side - asphalt
    sg = clip_union(SIDE_RAW, side_tree, cb)
    if sg is not None and not sg.is_empty:
        ag = clip_union(ground['ASPHALT'], asph_tree, cb.buffer(1))
        if ag is not None: sg = sg.difference(ag)
        if land_c is not None: sg = sg.intersection(land_c)
        for q in polys_of(sg):
            if q.area > 0.5: chunk_ground[ci].append(('SIDEWALK', q))
log('chunk ground done', sum(len(v) for v in chunk_ground.values()))

# ---------------------------------------------------------------- trees (semantic)
rng = random.Random(7)
TREE = dict(PALM=0, PINE=1, BROAD=2, CYPRESS=3, OLIVE=4, BUSH=5, CITRUS=6, FICUS=7)
trees = []  # (x,z,type,scale)
def add_tree(x, z, ty, s):
    trees.append((x, z, ty, s))
for (x, z), t in d['points']:
    if t.get('natural') == 'tree':
        g = (t.get('genus', '') + t.get('species', '') + t.get('taxon', '')).lower()
        if 'phoenix' in g or 'washingtonia' in g or 'palm' in g or t.get('leaf_type') == 'palm': ty = TREE['PALM']
        elif t.get('leaf_type') == 'needleleaved' or 'pinus' in g: ty = TREE['PINE']
        elif 'cupressus' in g: ty = TREE['CYPRESS']
        elif 'olea' in g: ty = TREE['OLIVE']
        else: ty = TREE['FICUS'] if rng.random() < .5 else TREE['BROAD']
        add_tree(x, z, ty, 0.8 + rng.random() * 0.5)
for wid, pts, t, closed in d['lines']:
    if t.get('natural') == 'tree_row' and len(pts) >= 2:
        line = LineString(pts)
        n = max(1, int(line.length / 8))
        dc = line.distance(COAST_LINE)
        g = (t.get('genus', '') + t.get('species', '')).lower()
        for i in range(n + 1):
            pt = line.interpolate(i / max(n, 1), normalized=True)
            if 'phoenix' in g or 'washingtonia' in g: ty = TREE['PALM']
            elif dc < 250: ty = TREE['PALM'] if (i % 2 == 0) else TREE['FICUS']
            else: ty = TREE['FICUS'] if rng.random() < .6 else TREE['BROAD']
            add_tree(pt.x, pt.y, ty, 0.85 + rng.random() * 0.4)
log('osm trees', len(trees))
# blocked area for scattering inside parks: buildings, roads, water, pitches, paving
bl_geoms = [b['p'] for b in bout]
bl_tree = STRtree(bl_geoms)
def scatter(poly, density, types, weights, smin=0.8, smax=1.25, avoid_paths=True, jitter_grid=None):
    if poly.is_empty: return 0
    minx, minz, maxx, maxz = poly.bounds
    A = poly.area
    n = int(A * density)
    if n <= 0: return 0
    n = min(n, 6000)
    xs = np.random.uniform(minx, maxx, n * 3)
    zs = np.random.uniform(minz, maxz, n * 3)
    shapely.prepare(poly)
    ok = shapely.contains_xy(poly, xs, zs)
    xs, zs = xs[ok][:n], zs[ok][:n]
    if len(xs) == 0: return 0
    pts = shapely.points(np.c_[xs, zs])
    # avoid buildings & roads & water
    blk = []
    q = bl_tree.query(poly)
    if len(q): blk.append(unary_union([bl_geoms[i].buffer(1.5) for i in q]))
    for c in ('ASPHALT', 'PAVING', 'FOOTPATH', 'CYCLE', 'WATER', 'POOL', 'PITCHGRASS', 'PITCHHARD', 'PITCHCLAY', 'TRACK', 'PLAYGROUND', 'PARKING'):
        tr = trees_by_cls.get(c)
        if tr is None: continue
        ii = tr.query(poly)
        if len(ii): blk.append(unary_union([ground[c][i] for i in ii]).buffer(1.0 if c in ('FOOTPATH', 'CYCLE') else 0.5))
    if blk:
        B = unary_union(blk); shapely.prepare(B)
        keep = ~shapely.contains(B, pts)
        xs, zs = xs[keep], zs[keep]
    cnt = 0
    w = np.array(weights, float); w /= w.sum()
    tys = np.random.choice(types, size=len(xs), p=w)
    for x, z, ty in zip(xs, zs, tys):
        add_tree(float(x), float(z), int(ty), smin + np.random.random() * (smax - smin)); cnt += 1
    return cnt
np.random.seed(11)
n_p = 0
for p, t in parks:
    p = p.intersection(LAND)
    dc = p.distance(COAST_LINE)
    if dc < 60:  # seafront parks: palms & ficus (Molos)
        n_p += scatter(p, 1 / 70, [TREE['PALM'], TREE['FICUS'], TREE['PINE'], TREE['BROAD']], [45, 30, 15, 10])
    else:
        n_p += scatter(p, 1 / 90, [TREE['PINE'], TREE['FICUS'], TREE['BROAD'], TREE['PALM'], TREE['CYPRESS'], TREE['OLIVE']], [25, 25, 20, 12, 8, 10])
n_w = sum(scatter(p.intersection(LAND), 1 / 45, [TREE['PINE'], TREE['CYPRESS'], TREE['BROAD']], [80, 10, 10], 0.8, 1.3) for p in woods)
n_s = sum(scatter(p.intersection(LAND), 1 / 600, [TREE['BUSH'], TREE['OLIVE'], TREE['PINE']], [70, 20, 10], 0.6, 1.1) for p in scrubs)
n_o = 0
for p, t in orchards:
    tr = t.get('trees', '') + t.get('produce', '')
    ty = TREE['OLIVE'] if 'olive' in tr else TREE['CITRUS']
    n_o += scatter(p.intersection(LAND), 1 / 90, [ty], [1], 0.7, 1.0)
log('trees parks', n_p, 'woods', n_w, 'scrub', n_s, 'orchards', n_o)
# seafront avenue trees: along main roads within 140 m of the coast
n_sf = 0
for r in roads:
    if r['cls'] not in (3, 4, 5, 6): continue
    dc = r['line'].distance(COAST_LINE)
    if dc > 140: continue
    L = r['line'].length
    off = r['w'] / 2 + max(0.9, min(r['sw'], 2.5) * 0.6)
    for side_ in (-1, 1):
        try:
            ol = r['line'].offset_curve(side_ * off, quad_segs=2, join_style='mitre')
        except Exception:
            continue
        for ll in lines_of(ol):
            n = int(ll.length / 11)
            for i in range(n):
                pt = ll.interpolate((i + 0.5) / max(n, 1), normalized=True)
                if pt.distance(COAST_LINE) > dc + 1 and rng.random() < .6: continue  # landward side sparser
                if len(bl_tree.query(pt.buffer(2.0), predicate='intersects')): continue
                if not LAND.contains(pt): continue
                add_tree(pt.x, pt.y, TREE['PALM'] if rng.random() < .55 else TREE['FICUS'], 0.9 + rng.random() * 0.35); n_sf += 1
log('seafront avenue trees', n_sf, 'total trees', len(trees))

# ---------------------------------------------------------------- point features
lamps, benches, misc = [], [], []
for (x, z), t in d['points']:
    hw = t.get('highway'); am = t.get('amenity')
    if hw == 'street_lamp': lamps.append((x, z))
    elif am == 'bench': benches.append((x, z))
PT = dict(LAMP=0, BENCH=1, CROSSING=2, SIGNAL=3, BUSSTOP=4, FOUNTAIN=5, ARTWORK=6)
points = []
for (x, z), t in d['points']:
    hw = t.get('highway'); am = t.get('amenity')
    ty = None
    if hw == 'street_lamp': ty = 'LAMP'
    elif am == 'bench': ty = 'BENCH'
    elif hw == 'crossing': ty = 'CROSSING'
    elif hw == 'traffic_signals': ty = 'SIGNAL'
    elif hw == 'bus_stop': ty = 'BUSSTOP'
    elif am == 'fountain': ty = 'FOUNTAIN'
    elif t.get('tourism') == 'artwork': ty = 'ARTWORK'
    if ty: points.append((x, z, PT[ty]))

# ---------------------------------------------------------------- names, places, landmarks
strings = ['']
sidx = {'': 0}
def S(s):
    if s not in sidx:
        sidx[s] = len(strings); strings.append(s)
    return sidx[s]
places = []
for (x, z), t in d['points']:
    if t.get('place') in ('suburb', 'quarter', 'neighbourhood', 'town', 'village', 'city', 'hamlet') and 'name' in t:
        if -7000 < x < 9400 and -7150 < z < 4950:
            nm = t.get('name:en') or t.get('name')
            if t.get('place') == 'city': continue
            places.append(dict(n=nm, x=round(x), z=round(z), k=t['place']))
# landmark candidates by name
def find_area(pred):
    for aid, polys, t in areas:
        if pred(t):
            o = polys[0][0]
            p = Polygon(o)
            c = p.centroid
            return (round(c.x, 1), round(c.y, 1))
    return None
def find_point(pred):
    for (x, z), t in d['points']:
        if pred(t): return (round(x, 1), round(z, 1))
    return None

out_json = dict(
    v=1, origin=dict(lat=d['origin'][0], lon=d['origin'][1], mlat=d['m'][0], mlon=d['m'][1]),
    grid=dict(x0=X0, z0=Z0, cs=CS, nx=NX, nz=NZ), area=[-7000, -7150, 9400, 4950],
    cls=CLS_ORDER, styles=STYLE, roofs=ROOF, walls=WALLS, roofc=ROOFC, treeTypes=TREE, pointTypes=PT,
    places=places,
)
ISLAND = main_island.simplify(8).intersection(box(-80000, -80000, 80000, 60000))
pickle.dump(dict(ISLAND=ISLAND, bout=bout, roads=roads, paths=paths, chunk_ground=dict(chunk_ground), trees=trees, points=points,
                 LAND=LAND, FAR=FAR, COAST=COAST_LINE, places=places, out_json=out_json, beach=beach_polys),
            open(OUT, 'wb'))
log('saved', OUT)
