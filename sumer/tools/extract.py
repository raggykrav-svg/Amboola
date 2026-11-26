# Pass 1: pull raw Limassol features out of the Cyprus PBF into a pickle.
import osmium, sys, pickle, math
S,W,N,E = 34.630,32.965,34.740,33.145
LAT0, LON0 = 34.6750, 33.0420
MLAT = 111132.92 - 559.82*math.cos(2*math.radians(LAT0)) + 1.175*math.cos(4*math.radians(LAT0))
MLON = 111412.84*math.cos(math.radians(LAT0)) - 93.5*math.cos(3*math.radians(LAT0))
def xy(lon, lat):  # x east, z south (metres)
    return ((lon-LON0)*MLON, (LAT0-lat)*MLAT)
def inb(lon,lat, m=0.0):
    return S-m < lat < N+m and W-m < lon < E+m
AREA_KEYS = ('building','building:part','landuse','leisure','natural','amenity','man_made','place','highway','waterway','tourism','historic','water','area:highway','parking')
KEEP_TAGS = None
class H(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.areas=[]; s.lines=[]; s.points=[]; s.coast=[]
    def node(s, n):
        if not n.tags: return
        lon,lat = n.location.lon, n.location.lat
        if not inb(lon,lat): return
        t = dict(n.tags)
        if any(k in t for k in ('natural','amenity','shop','tourism','historic','highway','leisure','man_made','place','name','barrier','power','emergency','office','craft','sport','religion')):
            s.points.append((xy(lon,lat), t))
    def way(s, w):
        t = w.tags
        if t.get('natural') == 'coastline':
            pts=[]
            for nd in w.nodes:
                try: pts.append(xy(nd.lon, nd.lat))
                except Exception: pass
            s.coast.append((w.id, pts))
            return
        if not any(k in t for k in ('highway','natural','man_made','waterway','barrier','railway','aerialway','route','leisure','power')): return
        if w.is_closed() and t.get('area')=='yes' : pass
        try:
            ll=[(nd.lon,nd.lat) for nd in w.nodes]
        except Exception: return
        if not any(inb(lo,la,0.002) for lo,la in ll): return
        s.lines.append((w.id, [xy(lo,la) for lo,la in ll], dict(t), w.is_closed()))
    def area(s, a):
        t = a.tags
        if not any(k in t for k in AREA_KEYS): return
        polys=[]
        anyin=False
        try:
            for outer in a.outer_rings():
                o=[(nd.lon,nd.lat) for nd in outer]
                if any(inb(lo,la,0.001) for lo,la in o): anyin=True
                holes=[[xy(nd.lon,nd.lat) for nd in inner] for inner in a.inner_rings(outer)]
                polys.append(([xy(lo,la) for lo,la in o], holes))
        except Exception as e:
            return
        if not anyin or not polys: return
        s.areas.append((('w' if a.from_way() else 'r')+str(a.orig_id()), polys, dict(t)))
h=H()
h.apply_file(sys.argv[1], locations=True)
print('areas', len(h.areas), 'lines', len(h.lines), 'points', len(h.points), 'coast ways', len(h.coast))
pickle.dump({'areas':h.areas,'lines':h.lines,'points':h.points,'coast':h.coast,'origin':(LAT0,LON0),'bbox':(S,W,N,E),'m':(MLAT,MLON)}, open(sys.argv[2],'wb'))
