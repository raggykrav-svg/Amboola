// Loads and decodes the Limassol city file (data/limassol.bin.gz).
// Format (little endian): 'SUMR', u32 version, u32 jsonLen, JSON header, pad4,
// chunk table (u32 offset, u32 length per chunk), chunk blobs, shore grid, trailer.
// Map data (c) OpenStreetMap contributors, ODbL.

export async function loadCity(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load the city (' + res.status + ')');
  const total = +res.headers.get('content-length') || 3300000;
  const reader = res.body.getReader();
  const parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onProgress && onProgress(Math.min(1, got / total));
  }
  let bytes = new Uint8Array(got);
  let o = 0;
  for (const p of parts) { bytes.set(p, o); o += p.length; }
  // base64 text (hosts that only serve text): 'H4sI' is gzip in base64
  if (bytes[0] === 0x48 && bytes[1] === 0x34 && bytes[2] === 0x73 && bytes[3] === 0x49) {
    const bin = atob(new TextDecoder().decode(bytes).replace(/\s+/g, ''));
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    bytes = b;
  }
  // gzip magic: decompress here (servers that already sent Content-Encoding hand us raw bytes)
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const ds = new DecompressionStream('gzip');
    const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    bytes = new Uint8Array(await out.arrayBuffer());
  }
  return decodeCity(bytes.buffer);
}

export function decodeCity(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'SUMR') throw new Error('Not a Sumer city file');
  const jlen = dv.getUint32(8, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 12, jlen)));
  const L = buf.byteLength;
  const tableOff = dv.getUint32(L - 12, true);
  const shoreOff = dv.getUint32(L - 8, true);
  const g = header.grid;
  const n = g.nx * g.nz;
  const off = new Uint32Array(n), len = new Uint32Array(n);
  for (let i = 0; i < n; i++) { off[i] = dv.getUint32(tableOff + 8 * i, true); len[i] = dv.getUint32(tableOff + 8 * i + 4, true); }
  const sh = header.shore;
  const shore = new Uint8Array(buf, shoreOff, sh.w * sh.h * 2); // RG: sea-side, land-side distance /4 m
  return { header, buf, dv, off, len, shore, strings: header.strings, cache: new Map(), grid: g };
}

// Decode one 250 m chunk into absolute-coordinate arrays.
export function chunk(city, ci) {
  let c = city.cache.get(ci);
  if (c) return c;
  const g = city.grid;
  const ox = g.x0 + (ci % g.nx) * g.cs, oz = g.z0 + Math.floor(ci / g.nx) * g.cs;
  c = { ci, ox, oz, buildings: [], ground: [], trees: null, roads: [], points: [] };
  city.cache.set(ci, c);
  if (city.len[ci] === 0) { c.trees = new Float32Array(0); return c; }
  const dv = city.dv;
  let p = city.off[ci];
  const u8 = () => dv.getUint8(p++);
  const u16 = () => { const v = dv.getUint16(p, true); p += 2; return v; };
  const i16 = () => { const v = dv.getInt16(p, true); p += 2; return v; };
  const rings = (nr) => {
    const counts = [];
    for (let r = 0; r < nr; r++) counts.push(u16());
    const out = [];
    for (let r = 0; r < nr; r++) {
      const k = counts[r], a = new Float32Array(2 * k);
      let x = 0, z = 0;
      for (let j = 0; j < k; j++) {
        x += i16(); z += i16();
        a[2 * j] = ox + x / 10; a[2 * j + 1] = oz + z / 10;
      }
      out.push(a);
    }
    return out;
  };
  const nb = u16();
  for (let i = 0; i < nb; i++) {
    const style = u8(), roof = u8(), wall = u8(), roofc = u8(), flags = u8(), lv = u8();
    const H = u16() / 10, minH = u16() / 10, name = u16(), nr = u8();
    c.buildings.push({ style, roof, wall, roofc, flags, lv, H, minH, name: city.strings[name], rings: rings(nr), ci, idx: i });
  }
  const ng = u16();
  for (let i = 0; i < ng; i++) {
    const cls = u8(), nr = u8();
    c.ground.push({ cls, rings: rings(nr) });
  }
  const nt = u16();
  const t = new Float32Array(4 * nt);
  for (let i = 0; i < nt; i++) {
    t[4 * i] = ox + i16() / 10; t[4 * i + 1] = oz + i16() / 10; t[4 * i + 2] = u8(); t[4 * i + 3] = u8() / 100;
  }
  c.trees = t;
  const nrd = u16();
  for (let i = 0; i < nrd; i++) {
    const cls = u8(), flags = u8(), w = u8() / 4, sw = u8() / 4, mat = u8(), name = u16(), np = u16();
    const pts = new Float32Array(2 * np);
    let x = 0, z = 0;
    for (let j = 0; j < np; j++) { x += i16(); z += i16(); pts[2 * j] = ox + x / 10; pts[2 * j + 1] = oz + z / 10; }
    c.roads.push({ cls, flags, w, sw, mat, name: city.strings[name], pts, path: !!(flags & 4) });
  }
  const np = u16();
  for (let i = 0; i < np; i++) c.points.push(ox + i16() / 10, oz + i16() / 10, u8());
  return c;
}

export function chunkIndex(city, x, z) {
  const g = city.grid;
  const ix = Math.floor((x - g.x0) / g.cs), iz = Math.floor((z - g.z0) / g.cs);
  if (ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz) return -1;
  return iz * g.nx + ix;
}

// Distance to the coast in metres: positive at sea, negative on land (40 m grid, +-1020 m).
export function shoreAt(city, x, z) {
  const s = city.header.shore;
  const fx = (x - s.x0) / s.res - 0.5, fz = (z - s.z0) / s.res - 0.5;
  if (fx < 0 || fz < 0 || fx > s.w - 1 || fz > s.h - 1) return fz > s.h - 1 ? 1020 : -1020;
  const ix = Math.min(s.w - 2, Math.floor(fx)), iz = Math.min(s.h - 2, Math.floor(fz));
  const tx = fx - ix, tz = fz - iz;
  const g = (i, j) => city.shore[(j * s.w + i) * 2] - city.shore[(j * s.w + i) * 2 + 1];
  const v = (g(ix, iz) * (1 - tx) + g(ix + 1, iz) * tx) * (1 - tz) + (g(ix, iz + 1) * (1 - tx) + g(ix + 1, iz + 1) * tx) * tz;
  return v * 4;
}

// Local metres <-> lat/lon (for showing real coordinates).
export function toLatLon(city, x, z) {
  const o = city.header.origin;
  return { lat: o.lat - z / o.mlat, lon: o.lon + x / o.mlon };
}
