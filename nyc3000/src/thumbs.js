// Little 3D pictures of models (shop cards, the person you're looking for), rendered once
// with the game's renderer and kept as JPEG data URLs.
import * as THREE from 'three';

const thumbs = {};
export function thumbnail(ctx, key, make, view) {
  if (thumbs[key]) return thumbs[key];
  const { renderer, scene: main } = ctx;
  const W = 480, H = 280;
  const rt = new THREE.WebGLRenderTarget(W, H);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1634);
  scene.environment = main.environment;
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x3a2050, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(3, 5, 2); scene.add(sun);
  const back = new THREE.DirectionalLight(0xff4ab0, 1.4); back.position.set(-3, 2, -4); scene.add(back);
  const obj = make(); scene.add(obj); obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
  const cam = new THREE.PerspectiveCamera(28, W / H, 0.01, 200);
  cam.position.copy(c).add(new THREE.Vector3(...view).normalize().multiplyScalar(size * 1.55));
  cam.lookAt(c);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(scene, cam);
  const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(prev); rt.dispose();
  const big = document.createElement('canvas'); big.width = W; big.height = H;
  const bctx = big.getContext('2d'), img = bctx.createImageData(W, H);
  const lut = new Uint8Array(256); for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(i / 255, 1 / 2.2));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = ((H - 1 - y) * W + x) * 4, o = (y * W + x) * 4;
    img.data[o] = lut[buf[s]]; img.data[o + 1] = lut[buf[s + 1]]; img.data[o + 2] = lut[buf[s + 2]]; img.data[o + 3] = 255;
  }
  bctx.putImageData(img, 0, 0);
  const small = document.createElement('canvas'); small.width = W / 2; small.height = H / 2;
  small.getContext('2d').drawImage(big, 0, 0, W / 2, H / 2); // downscale = smooth edges
  return (thumbs[key] = small.toDataURL('image/jpeg', 0.85));
}
