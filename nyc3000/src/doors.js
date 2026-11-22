// Sliding doors, the way they work in Cyberpunk 2077: walk up to a street door and its two
// panels slide apart into the frame (green light = open, red = locked), showing the lit room
// behind it. Walk in, or press E. The same happens on the door inside the room on the way out.
// The city's doors are merged flat panels, so a few animated door rigs are moved onto the
// doors nearest the player.
import * as THREE from 'three';

const W = 1.7, H = 2.6, RIGS = 4;
const leafGeo = new THREE.BoxGeometry(1, H, 0.07); leafGeo.translate(0.5, H / 2, 0); // hinge edge at x = 0
const stripGeo = new THREE.BoxGeometry(0.05, H - 0.3, 0.02); stripGeo.translate(0, H / 2, 0.045);
const glass = new THREE.MeshStandardMaterial({ color: 0x2a7a72, metalness: 0.6, roughness: 0.15, transparent: true, opacity: 0.78 });
const metal = new THREE.MeshStandardMaterial({ color: 0x3a4050, metalness: 0.7, roughness: 0.35 });
const lightMats = { open: new THREE.MeshBasicMaterial({ color: 0x3aff9a, toneMapped: false }), locked: new THREE.MeshBasicMaterial({ color: 0xff2040, toneMapped: false }) };
const stripMat = new THREE.MeshBasicMaterial({ color: 0x9fe9ff, toneMapped: false });

function makeRig() {
  const g = new THREE.Group();
  // the room behind: a soft glow seen through the open doorway
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x402a18, toneMapped: false }));
  inside.position.set(0, H / 2, 0.01); g.add(inside);
  const leaves = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.set(s * W / 2, 0, 0.05);
    const leaf = new THREE.Mesh(leafGeo, glass); leaf.scale.x = -s * W / 2; // grows from the frame toward the middle
    const strip = new THREE.Mesh(stripGeo, stripMat); strip.position.x = -s * W / 2 + s * 0.04;
    pivot.add(leaf, strip); g.add(pivot);
    return { pivot, leaf, strip, s };
  });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.06), lightMats.open);
  lamp.position.set(W / 2 + 0.32, 1.45, 0.06); g.add(lamp);
  g.visible = false;
  return { g, inside, leaves, lamp, door: null, open: 0, want: 0 };
}

export class SlidingDoors {
  constructor(scene) {
    this.rigs = []; for (let k = 0; k < RIGS; k++) { const r = makeRig(); scene.add(r.g); this.rigs.push(r); }
    this.room = makeRig(); scene.add(this.room.g); // the door inside the room you're in
  }
  // put a rig on a door: (x, z) = point on the wall, (nx, nz) = facing
  _place(r, x, z, nx, nz, kind, glow) {
    r.g.position.set(x + nx * 0.1, 0, z + nz * 0.1);
    r.g.rotation.y = Math.atan2(nx, nz);
    for (const l of r.leaves) l.leaf.material = kind === 'shop' ? glass : metal;
    r.inside.material.color.set(glow);
    r.g.visible = true;
  }
  _animate(r, dt, game) {
    const before = r.open;
    r.open += Math.max(-dt * 3.5, Math.min(dt * 3.5, r.want - r.open));
    if ((before === 0 && r.open > 0) || (before >= 1 - 1e-6 && r.open < 1)) game.audio.play('slide', 0);
    const k = r.open * r.open * (3 - 2 * r.open); // ease
    for (const l of r.leaves) { l.leaf.scale.x = -l.s * (W / 2) * (1 - 0.94 * k); l.strip.position.x = l.leaf.scale.x; }
    r.inside.visible = r.open > 0.02;
  }
  update(dt, game) {
    const p = game.player, city = game.city;
    const onFoot = p.alive && !p.vehicle;
    // ---- inside a room: the exit door ----
    if (game.interior) {
      for (const r of this.rigs) { r.g.visible = false; r.door = null; r.open = 0; }
      const R = game.interior.room, r = this.room;
      if (R.exit) {
        if (r.door !== R) { r.door = R; r.open = 0; this._place(r, R.exit.x, R.exit.z + 0.4 + 0.02, 0, -1, game.interior.kind, '#6a4ab0'); }
        r.want = onFoot && Math.hypot(p.pos.x - R.exit.x, p.pos.z - R.exit.z) < 2.6 ? 1 : 0;
        this._animate(r, dt, game);
        // walk out through the open door
        if (r.open > 0.9 && p.vel.z > 1.5 && p.pos.z > R.exit.z - 0.2 && Math.abs(p.pos.x - R.exit.x) < 0.9) { game.exitDoor(); return; }
      }
      return;
    }
    this.room.g.visible = false; this.room.door = null;
    // ---- outside: rigs on the nearest doors ----
    const near = [];
    if (game.active) {
      const cx = Math.floor((p.pos.x + 1000) / 21), cz = Math.floor((p.pos.z + 1000) / 21);
      for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
        const a = city.doorGrid.get(i * 4096 + j); if (!a) continue;
        for (const d of a) { const dd = Math.hypot(d.x - p.pos.x, d.z - p.pos.z); if (dd < 14) near.push([dd, d]); }
      }
    }
    near.sort((a, b) => a[0] - b[0]);
    const want = near.slice(0, RIGS).map(n => n[1]);
    for (const r of this.rigs) if (r.door && !want.includes(r.door)) { r.door = null; r.g.visible = false; r.open = 0; }
    for (const d of want) {
      if (this.rigs.some(r => r.door === d)) continue;
      const r = this.rigs.find(q => !q.door); if (!r) break;
      r.door = d; r.open = 0;
      this._place(r, d.x - d.nx * 0.3, d.z - d.nz * 0.3, d.nx, d.nz, d.kind, d.kind === 'shop' ? new THREE.Color(d.color).multiplyScalar(0.55) : '#6a4a24');
    }
    for (const r of this.rigs) {
      const d = r.door; if (!d) continue;
      const locked = game.doorLocked(d);
      r.lamp.material = locked ? lightMats.locked : lightMats.open;
      const dist = Math.hypot(d.x - p.pos.x, d.z - p.pos.z);
      r.want = !locked && onFoot && dist < 3.4 && Math.abs(p.pos.y - 0) < 1.5 ? 1 : 0;
      this._animate(r, dt, game);
      // walk straight in through the open doorway
      if (r.open > 0.85 && dist < 1.05 && (p.vel.x * -d.nx + p.vel.z * -d.nz) > 1.5) { game.enterDoor(d); return; }
    }
  }
}
