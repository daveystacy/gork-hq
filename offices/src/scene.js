// The live 3D office. Same room, same Expirites and the same way of walking as gork.expire.org;
// what each bot does comes only from its real state (see agentView in data.js).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildTheme, ROOM } from './themes.js';
import { createBotFactory, KINDS } from './bots.js';
import { ago } from './data.js';

const W = 20, D = 14;
// a desk in each corner, and one on each side wall, so everyone can be seen from the door
const DESKS = [[-8.3, -5.2], [8.3, -5.2], [-8.3, 3.9], [8.3, 3.9], [-8.3, -1], [8.3, -1]];
// the long table down the middle: where the team sits when nobody has given them work
const TABLE = { x: 0, z: -2.1, w: 9.6, d: 1.7 };
const TABLE_SEATS = [[-3.2, 1], [0, 1], [3.2, 1], [-3.2, -1], [0, -1], [3.2, -1]].map(([x, side]) => ({ x, z: TABLE.z + side * (TABLE.d / 2 + .38), side }));
const MEET = [[-5.6, -2.1], [5.6, -2.1], [-1.6, -.4], [1.6, -.4], [-1.6, -3.8]];
const BASE_SPOTS = [[-1.3, 4.5], [-5.8, 1.2], [5.8, 1.2], [-1, .6], [1, 6.2], [-4, 6.2]];
const MG = .3, CS = .25, X0 = -9.5, Z0 = -6.5;
const GX = Math.round(19 / CS), GZ = Math.round(13 / CS);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createOffice(view, overlay, id, cfg) {
  const R = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  R.setPixelRatio(Math.min(devicePixelRatio, 2));
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace;
  view.prepend(R.domElement);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const room = ROOM[id];
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(R);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200);
  cam.position.set(18, 17, 18);
  const ctl = new OrbitControls(cam, R.domElement);
  ctl.enableDamping = true;
  const TY = view.clientWidth < 600 ? 3.2 : 1.2;
  ctl.target.set(0, TY, 0); cam.position.y += TY;
  ctl.minZoom = .6; ctl.maxZoom = 3; ctl.maxPolarAngle = 1.25; ctl.minPolarAngle = .5;
  ctl.enablePan = false; ctl.autoRotate = !reduced; ctl.autoRotateSpeed = .25;
  R.domElement.addEventListener('pointerdown', () => { ctl.autoRotate = false; });
  // phones: a vertical swipe scrolls the page, a sideways swipe turns the office
  if (matchMedia('(pointer: coarse)').matches) R.domElement.style.touchAction = 'pan-y';

  let comp = null;
  function size() {
    const w = view.clientWidth, h = view.clientHeight, a = w / h, k = Math.max(9, 12.8 / a);
    cam.left = -k * a; cam.right = k * a; cam.top = k; cam.bottom = -k; cam.updateProjectionMatrix();
    R.setSize(w, h);
    if (comp) comp.setSize(w, h);
  }
  new ResizeObserver(size).observe(view);
  size();

  scene.add(new THREE.HemisphereLight('#d7dcff', '#5a4a38', 1.9));
  const sun = new THREE.DirectionalLight('#fff1dd', 3);
  sun.position.set(-8, 16, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
  sun.shadow.bias = -.0005; scene.add(sun);

  // ---- building blocks, also handed to the themes
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o });
  function box(w, h, d, m, x, y, z, p = scene) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; p.add(b); return b;
  }
  function cyl(rt, rb, h, seg, m, x, y, z, p = scene) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    c.position.set(x, y, z); c.castShadow = c.receiveShadow = true; p.add(c); return c;
  }
  function tex(draw, w = 128, h = 128) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const loader = new THREE.TextureLoader();
  function loadTex(url, cb) {
    loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; cb(t); });
  }
  // the official e-globe artwork, never a redraw
  let eglobe = null; const eglobeWaiting = [];
  loadTex('brand/e-globe-av.webp', (t) => { eglobe = t; eglobeWaiting.splice(0).forEach((f) => f(t)); });
  const eglobeTex = (cb) => { if (eglobe) cb(eglobe); else eglobeWaiting.push(cb); };

  // ---- room
  // polished black stone with thin gold joints, dark panelled walls, and light hidden along their edges
  const GOLD = M('#d9b15a', { metalness: 1, roughness: .22 }), GLOWG = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28a').multiplyScalar(1.5), toneMapped: false });
  const floorT = tex((g, w, h) => {
    g.fillStyle = '#2b2b35'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(190,185,205,${.03 + (i % 5) * .012})`; g.lineWidth = .7 + (i % 3) * .5; const x = (i * 137) % w, y = (i * 71) % h; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 60, y + 40, x + 30, y + 110, x + 130, y + 170); g.stroke(); }
    g.strokeStyle = 'rgba(217,177,90,.75)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  }, 512, 512);
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(5, 3.5);
  box(W, .3, D, M('#fff', { map: floorT, roughness: .1, metalness: .55, envMapIntensity: 1.4 }), 0, -.15, 0);
  const wallM = M('#101118', { roughness: .32, metalness: .45 });
  box(W, 5, .3, wallM, 0, 2.5, -D / 2);
  box(.3, 5, D, wallM, -W / 2, 2.5, 0);
  box(W, .05, .06, GLOWG, 0, 4.96, -D / 2 + .19); box(.06, .05, D, GLOWG, -W / 2 + .19, 4.96, 0);
  box(W, .1, .05, GOLD, 0, .1, -D / 2 + .18); box(.05, .1, D, GOLD, -W / 2 + .18, .1, 0);
  for (let z = -5.4; z < 6.5; z += 2.2) if (z < -4 || z > 2) box(.04, 4.6, .04, GOLD, -W / 2 + .17, 2.5, z);
  // the view out: one continuous skyline across the five windows, its light set per office
  if (room.sky) {
    const hash = (n) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 5; i++) {
      const map = tex((g, w, h) => {
        const [top, mid, low, bld, lit] = room.sky;
        const sky = g.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, top); sky.addColorStop(.62, mid); sky.addColorStop(.86, low);
        g.fillStyle = sky; g.fillRect(0, 0, w, h);
        if (room.stars) for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(255,255,255,${.25 + hash(k + i * 91) * .6})`; g.fillRect(hash(k * 3 + i) * w, hash(k * 7 + i) * h * .55, 1.6, 1.6); }
        for (const [depth, base, range, alpha] of [[1, .5, .22, .55], [2, .3, .3, 1]]) {
          let x = -20;
          while (x < w) {
            const col = Math.floor((x + i * w) / 30) + depth * 1000;
            const bw = 26 + hash(col) * 44, bh = h * (base * .55 + hash(col + 5) * range);
            g.globalAlpha = alpha; g.fillStyle = bld; g.fillRect(x, h - bh, bw, bh); g.globalAlpha = 1;
            if (depth === 2) for (let wy = h - bh + 7; wy < h - 6; wy += 11) for (let wx = x + 5; wx < x + bw - 5; wx += 9) {
              if (hash(wx * 1.3 + wy * 7.7 + i * 31) > .62) { g.fillStyle = lit; g.globalAlpha = .28 + hash(wx + wy) * .55; g.fillRect(wx, wy, 4, 6); g.globalAlpha = 1; }
            }
            x += bw + 2;
          }
        }
      }, 512, 444);
      const x = -7.5 + i * 3.8;
      box(3.16, 2.76, .06, M('#0c0c10', { roughness: .4, metalness: .5 }), x, 2.8, -D / 2 + .17);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.6), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
      pane.position.set(x, 2.8, -D / 2 + .21); scene.add(pane);
      box(.05, 2.6, .03, M('#0c0c10', { roughness: .4 }), x, 2.8, -D / 2 + .23);
    }
  }
  box(8, .02, 5.4, M(room.floorRug, { roughness: .95 }), 3.4, .01, 3.7);

  const mon = {};
  DESKS.forEach(([x, z], i) => {
    box(2.3, .07, 1.15, M('#20202a', { roughness: .08, metalness: .6, envMapIntensity: 2 }), x, 1.15, z);
    box(2.36, .02, 1.21, GLOWG, x, 1.085, z);
    box(2.34, .025, 1.19, GOLD, x, 1.105, z);
    for (const dx of [-1, 1]) box(.05, 1.08, .95, GOLD, x + dx, .55, z);
    box(.15, .4, .15, M('#111'), x, 1.4, z - .3);
    box(1.36, .81, .04, GOLD, x, 1.85, z - .355);
    mon[i] = box(1.3, .75, .06, M('#000', { emissive: '#222', emissiveIntensity: 1 }), x, 1.85, z - .32);
    const seat = M('#3a3038', { roughness: .32, metalness: .15 });
    box(.7, .08, .62, seat, x, .5, z + .95); box(.66, .72, .08, seat, x, .95, z + 1.38);
    cyl(.04, .04, .46, 8, M('#26262c', { metalness: .7, roughness: .4 }), x, .24, z + .95);
    cyl(.26, .28, .04, 16, M('#17171b', { metalness: .6, roughness: .4 }), x, .03, z + .95);
    box(.72, .03, .24, M('#111114', { roughness: .4 }), x, 1.215, z + .22);
    const pl = new THREE.PointLight('#88f', 0, 3); pl.position.set(x, 1.9, z); scene.add(pl); mon[i].userData.l = pl;
  });

  // coffee station and plants, as in gork's office
  box(1.6, 1, .8, M('#0b0b10', { roughness: .1, metalness: .6 }), 3.4, .5, -6.3);
  box(1.64, .03, .84, GOLD, 3.4, 1.01, -6.3);
  box(.6, .8, .5, M('#c7ced6', { metalness: 1, roughness: .15 }), 3.4, 1.42, -6.3);
  function plant(x, z) {
    box(.6, .7, .6, M('#d8d2c8'), x, .35, z);
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.ConeGeometry(.35, 1.3, 6), M('#1f8a4c'));
      l.position.set(x + Math.sin(i * 1.3) * .2, 1.2 + i * .05, z + Math.cos(i * 1.3) * .2);
      l.rotation.set(Math.sin(i) * .4, 0, Math.cos(i) * .4); l.castShadow = true; scene.add(l);
    }
  }
  plant(-3.4, -6.3); plant(9.2, 1.4); plant(-9.2, 1.4);

  // the long table: black stone on a gold edge, lit from underneath, a line of lights over it
  const T = TABLE, top = new THREE.Mesh(new RoundedBoxGeometry(T.w, .12, T.d, 4, .05), M(room.felt ? '#0f5132' : '#262632', { roughness: room.felt ? .9 : .05, metalness: room.felt ? 0 : .6, envMapIntensity: 2.2 }));
  top.position.set(T.x, 1.1, T.z); top.castShadow = top.receiveShadow = true; scene.add(top);
  box(T.w + .06, .04, T.d + .06, GLOWG, T.x, 1.03, T.z);
  box(T.w - .5, .03, T.d - .5, GLOWG, T.x, .98, T.z);
  for (const dx of [-3.8, 3.8]) { box(.16, 1, T.d - .35, GOLD, T.x + dx, .5, T.z); box(.2, .03, T.d - .1, GOLD, T.x + dx, .02, T.z); }
  box(T.w - 1, .05, .07, GOLD, T.x, 4.1, T.z); for (const dx of [-4, 4]) box(.03, .9, .03, GOLD, T.x + dx, 4.55, T.z);
  for (let i = -4; i <= 4; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), GLOWG); l.position.set(T.x + i, 4.0, T.z); scene.add(l); }
  const tl = new THREE.PointLight('#ffdcae', 14, 11); tl.position.set(T.x, 3.7, T.z); scene.add(tl);
  // the chairs, and what each person does there: a laptop, a phone, a tablet, a notebook, lunch (shown only while someone is there)
  const seatM = M('#3a3038', { roughness: .32, metalness: .15 }), dark = M('#101014', { roughness: .25, metalness: .5 }), lit = new THREE.MeshBasicMaterial({ color: '#b9d4ff', toneMapped: false });
  const makeProp = [
    (g) => { box(.5, .02, .34, dark, 0, 0, 0, g); const s = box(.5, .32, .02, lit, 0, .16, -.17, g); s.rotation.x = -.2; },
    (g) => { box(.11, .015, .22, dark, 0, 0, 0, g); box(.09, .005, .19, lit, 0, .012, 0, g); },
    (g) => { box(.3, .015, .42, dark, 0, 0, 0, g); box(.27, .005, .38, lit, 0, .012, 0, g); },
    (g) => { box(.34, .025, .44, M('#efe9dc', { roughness: .8 }), 0, 0, 0, g); const p = box(.02, .02, .3, GOLD, .08, .03, 0, g); p.rotation.y = .4; },
    (g) => { cyl(.22, .16, .04, 24, M('#f4f1ea', { roughness: .25 }), 0, 0, 0, g); cyl(.09, .1, .05, 12, M('#b5752f', { roughness: .7 }), 0, .04, 0, g); box(.02, .012, .26, GOLD, .28, 0, 0, g); },
    (g) => { box(.11, .015, .22, dark, 0, 0, 0, g); box(.09, .005, .19, lit, 0, .012, 0, g); cyl(.05, .04, .12, 12, M('#f4f1ea'), .24, .06, -.06, g); },
  ];
  const props = TABLE_SEATS.map((q, i) => {
    box(.7, .08, .62, seatM, q.x, .5, q.z); box(.66, .72, .08, seatM, q.x, .95, q.z + q.side * .36);
    cyl(.04, .04, .46, 8, GOLD, q.x, .24, q.z); cyl(.26, .28, .04, 16, GOLD, q.x, .03, q.z);
    const g = new THREE.Group(); g.position.set(q.x, 1.18, T.z + q.side * (T.d / 2 - .36)); g.rotation.y = q.side > 0 ? 0 : Math.PI; g.visible = false; makeProp[i](g); scene.add(g); return g;
  });

  const kit = { THREE, scene, M, box, cyl, tex, loadTex, eglobeTex, Rounded: RoundedBoxGeometry, accent: cfg.accent };
  const theme = buildTheme(id, kit);

  // ---- walking: a grid over the floor, breadth-first paths around the furniture
  const OB = [[2.6, -6.8, 4.2, -5.9], [-3.8, -6.7, -3, -5.9], [8.8, 1, 9.6, 1.8], [-9.6, 1, -8.8, 1.8], ...theme.blocked];
  TABLE_SEATS.forEach((q) => OB.push([q.x - .35, q.z - .42, q.x + .35, q.z + .42]));
  DESKS.forEach(([x, z]) => OB.push([x - 1.1, z - .55, x + 1.1, z + .55], [x - .35, z + .65, x + .35, z + 1.42]));
  const blocked = (x, z) => x < X0 || x > -X0 || z < Z0 || z > -Z0 || (Math.abs(x - TABLE.x) < TABLE.w / 2 + MG && Math.abs(z - TABLE.z) < TABLE.d / 2 + MG) || OB.some((o) => x > o[0] - MG && x < o[2] + MG && z > o[1] - MG && z < o[3] + MG);
  const FREE = new Uint8Array((GX + 1) * (GZ + 1));
  for (let i = 0; i <= GX; i++) for (let j = 0; j <= GZ; j++) FREE[i * (GZ + 1) + j] = blocked(X0 + i * CS, Z0 + j * CS) ? 0 : 1;
  const SPOTS = [...BASE_SPOTS, ...(theme.spots || [])].filter((s) => !blocked(s[0], s[1]));
  const cell = (x, z) => [Math.max(0, Math.min(GX, Math.round((x - X0) / CS))), Math.max(0, Math.min(GZ, Math.round((z - Z0) / CS)))];
  function los(a, b, sx, sz, gx, gz) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CS / 2));
    for (let k = 1; k < n; k++) {
      const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n, [i, j] = cell(x, z);
      if (!FREE[i * (GZ + 1) + j] && !(Math.abs(i - sx) + Math.abs(j - sz) < 3) && !(Math.abs(i - gx) + Math.abs(j - gz) < 3)) return false;
    }
    return true;
  }
  function findPath(from, to) {
    const [sx, sz] = cell(from[0], from[1]), [gx, gz] = cell(to[0], to[1]), N = GZ + 1;
    const prev = new Int32Array((GX + 1) * N).fill(-1), q = [sx * N + sz]; prev[q[0]] = q[0];
    const ok = (i, j) => i >= 0 && j >= 0 && i <= GX && j <= GZ && (FREE[i * N + j] || Math.abs(i - sx) + Math.abs(j - sz) < 3 || Math.abs(i - gx) + Math.abs(j - gz) < 3);
    for (let h = 0; h < q.length; h++) {
      const c = q[h], i = (c / N) | 0, j = c % N;
      if (i === gx && j === gz) break;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a = i + di, b = j + dj;
        if (!ok(a, b) || prev[a * N + b] >= 0) continue;
        if (di && dj && (!ok(i + di, j) || !ok(i, j + dj))) continue;
        prev[a * N + b] = c; q.push(a * N + b);
      }
    }
    if (prev[gx * N + gz] < 0) return [to];
    const pts = [];
    for (let c = gx * N + gz; c !== sx * N + sz; c = prev[c]) pts.push([X0 + ((c / N) | 0) * CS, Z0 + (c % N) * CS]);
    pts.reverse(); if (pts.length) pts[pts.length - 1] = [to[0], to[1]];
    const out = []; let cur = from;
    for (let k = 0; k < pts.length; k++) if (k === pts.length - 1 || !los(cur, pts[k + 1], sx, sz, gx, gz)) { out.push(pts[k]); cur = pts[k]; }
    return out;
  }

  // ---- the agents (bots.js): the owner's five reference robots, one per desk
  // chrome needs something to reflect: a dark studio with bright strip lights
  const studioScene = new THREE.Scene(); studioScene.background = new THREE.Color('#04050a');
  const strip = (w, h, x, y, z, c, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); studioScene.add(m);
  };
  strip(7, 1.4, 0, 7, 2, '#ffffff', 7); strip(1.1, 7, -7, 1, 3, '#d5e4ff', 5); strip(1.1, 7, 7, 1, -1, '#ffffff', 4);
  strip(9, .7, 0, -2.2, 7, '#a9c2ff', 2.5); strip(3, 3, 3, 2, -8, '#39415c', 2); strip(.5, 5, 3.5, 1, 7, '#ffffff', 5); strip(.35, 5, -2.5, 1, 7, '#ffffff', 3);
  const studio = pmrem.fromScene(studioScene, .012).texture;
  // the chrome head: the same lights on a bright room with dark bands, so it reads as silver mirror
  studioScene.background = new THREE.Color('#8d99ad');
  strip(9, 1.1, 0, 1.6, 7.5, '#0a0b10', 1); strip(9, .7, 0, -.9, 7.5, '#05060a', 1); strip(1.6, 7, 6, 1, 4, '#07080c', 1); strip(1.6, 7, -6, 1, -3, '#07080c', 1);
  const mirror = pmrem.fromScene(studioScene, .008).texture;
  const factory = createBotFactory({ tex, loadTex, studio, mirror });

  const bots = {};
  let agents = [], focusId = null, focusAng = 0;

  function target(a) {
    const d = DESKS[(a.seat ?? 0) % DESKS.length];
    if (a.view === 'working' || a.view === 'quiet') return [d[0], d[1] + .95, Math.PI];
    if (a.view === 'waiting') return [d[0] - Math.sign(d[0]) * 1.3, d[1] + 1.6, 0];
    if (a.view === 'meeting') {
      const i = agents.filter((x) => x.view === 'meeting').indexOf(a), m = MEET[i % MEET.length];
      return [m[0], m[1], Math.atan2(TABLE.x - m[0], TABLE.z - m[1])];
    }
    // nobody's given them work: at the long table
    const q = TABLE_SEATS[(a.seat ?? 0) % TABLE_SEATS.length];
    return [q.x, q.z, q.side > 0 ? Math.PI : 0, true];
  }

  function makeBot(a) {
    const bot = factory.make(KINDS[(a.seat ?? 0) % KINDS.length]);
    const el = document.createElement('div'); el.className = 'bot'; el.style.setProperty('--c', a.color);
    el.innerHTML = `<div class="bb"></div><div class="nt">${esc(a.name)}</div>`;
    overlay.appendChild(el);
    const n = Object.keys(bots).length, sp = SPOTS[n % SPOTS.length];
    bot.G.position.set(sp[0], 0, sp[1]);
    const t0 = target(a);
    if (t0) { bot.G.position.set(t0[0], 0, t0[1]); bot.G.rotation.y = t0[2] || 0; }
    scene.add(bot.G);
    return { a, bot, G: bot.G, el, path: [], gk: '', ph: Math.random() * 6, wx: null, wait: 0, key: '' };
  }

  function setAgents(list) {
    agents = list;
    for (const a of list) {
      if (!bots[a.id]) bots[a.id] = makeBot(a);
      bots[a.id].a = a;
    }
  }

  // ---- the wall screen: real numbers only
  const wc = document.createElement('canvas'); wc.width = 1024; wc.height = 540;
  const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.37), new THREE.MeshBasicMaterial({ map: wt, toneMapped: false }));
  wall.position.set(-W / 2 + .26, 3.1, -1.4); wall.rotation.y = Math.PI / 2; scene.add(wall);
  function drawWall(lines) {
    const g = wc.getContext('2d');
    g.fillStyle = '#050505'; g.fillRect(0, 0, 1024, 540);
    g.strokeStyle = cfg.accent; g.lineWidth = 8; g.strokeRect(4, 4, 1016, 532);
    lines.forEach((l, i) => {
      g.fillStyle = l[1] || '#fff';
      g.font = `bold ${i ? 46 : 74}px ui-monospace,Menlo,monospace`;
      g.fillText(String(l[0]).slice(0, i ? 40 : 24), 32, i ? 118 + i * 62 : 92);
    });
    wt.needsUpdate = true;
  }

  // ---- bloom when the device has headroom, fewer shadows when it doesn't
  let fpsN = 0, fpsT = 0, lowQ = false, bloomOn = false;
  function mkComp() {
    comp = new EffectComposer(R); comp.addPass(new RenderPass(scene, cam));
    const w = view.clientWidth, h = view.clientHeight;
    comp.addPass(new UnrealBloomPass(new THREE.Vector2(w / 4, h / 4), .45, .35, .9));
    comp.addPass(new OutputPass()); comp.setPixelRatio(1); comp.setSize(w, h);
  }

  // ---- close-ups
  const camHome = { p: new THREE.Vector3(), z: 1, t: new THREE.Vector3() };
  const ray = new THREE.Raycaster(), pt = new THREE.Vector2();
  let downAt = null;
  const onFocusChange = { fn: null };
  function focus(idTo) {
    if (!bots[idTo]) return;
    if (!focusId) { camHome.p.copy(cam.position); camHome.z = cam.zoom; camHome.t.copy(ctl.target); }
    focusId = idTo; focusAng = 0; onFocusChange.fn?.(true);
  }
  function unfocus() {
    if (!focusId) return;
    focusId = null; cam.position.copy(camHome.p); cam.zoom = camHome.z; ctl.target.copy(camHome.t);
    cam.updateProjectionMatrix(); ctl.enabled = true; onFocusChange.fn?.(false);
  }
  R.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  R.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = R.domElement.getBoundingClientRect();
    pt.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(pt, cam);
    const hit = ray.intersectObjects(Object.values(bots).map((b) => b.G), true)[0];
    let nb = null;
    if (hit) for (const k in bots) { let o = hit.object; while (o) { if (o === bots[k].G) nb = k; o = o.parent; } }
    if (nb) focus(nb); else unfocus();
  });

  // ---- frame
  const clock = new THREE.Clock(), v3 = new THREE.Vector3();
  const debug = { bots, cam, ctl, scene, freeze: false, view: null };
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { clock.getDelta(); requestAnimationFrame(loop); } });

  function loop() {
    if (!running) return;
    const rd = clock.getDelta(), dt = Math.min(rd, .05), t = clock.elapsedTime;
    fpsN++; fpsT += rd;
    if (fpsT > 3) {
      const f = fpsN / fpsT;
      if (t > 5) bloomOn = !lowQ && f > 50 && (bloomOn || f > 55);
      if (!lowQ && f < 35 && t > 8) { lowQ = true; R.setPixelRatio(1); R.shadowMap.enabled = false; }
      window.__officeFps = Math.round(f);
      fpsN = 0; fpsT = 0;
    }
    factory.tick(t);
    const firstMeet = agents.find((q) => q.view === 'meeting');
    for (const a of agents) {
      const b = bots[a.id]; if (!b) continue;
      if (debug.freeze) { b.bot.pose({ t, dt, moving: false, phase: b.ph, view: debug.view || 'idle', happy: false }); continue; }
      let tg = target(a); const seated = !!tg;
      if (!tg) {
        if (b.wait > 0) b.wait -= dt;
        else if (!b.wx || Math.hypot(b.wx[0] - b.G.position.x, b.wx[1] - b.G.position.z) < .1) {
          const s = SPOTS[(Math.random() * SPOTS.length) | 0];
          let jx = s[0] + Math.random() - .5, jz = s[1] + Math.random() - .5;
          if (blocked(jx, jz)) { jx = s[0]; jz = s[1]; }
          b.wx = [jx, jz, null]; b.wait = 3 + Math.random() * 5;
        }
        tg = b.wx || [b.G.position.x, b.G.position.z, null];
      }
      if (focusId === a.id) tg = [tg[0], tg[1], Math.PI * .25];
      const p = b.G.position, gk = tg[0].toFixed(2) + ',' + tg[1].toFixed(2);
      if (gk !== b.gk) { b.gk = gk; b.path = findPath([p.x, p.z], tg); }
      let wp = b.path[0] || tg;
      if (b.path.length > 1 && Math.hypot(wp[0] - p.x, wp[1] - p.z) < .08) { b.path.shift(); wp = b.path[0]; }
      const dx = wp[0] - p.x, dz = wp[1] - p.z, d = Math.hypot(dx, dz) + (b.path.length > 1 ? 1 : 0), mv = d > .05 && !(b.wait > 0 && !seated);
      if (mv) {
        const dd = Math.hypot(dx, dz) || 1, v = Math.min(2.2 * dt, dd);
        p.x += dx / dd * v; p.z += dz / dd * v; b.ph += dt * 9;
        let df = Math.atan2(dx, dz) - b.G.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); b.G.rotation.y += df * Math.min(1, dt * 10);
      } else if (tg[2] != null) {
        let df = tg[2] - b.G.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); b.G.rotation.y += df * Math.min(1, dt * 6);
      }
      const atTable = a.view === 'idle' && tg[3] === true && !mv;
      b.bot.pose({ t, dt, moving: mv, phase: b.ph, view: a.view, happy: b.happy > t, sitting: atTable });
      const pr0 = props[(a.seat ?? 0) % props.length]; if (pr0) pr0.visible = atTable;

      // what the bubble says is exactly what the last report says
      let txt = '', pr = -1, col = '#111';
      if (a.view === 'working' && !mv) { txt = a.task || 'working'; pr = a.progress ?? -1; }
      else if (a.view === 'quiet') { txt = `no report for ${ago(a.age).replace(' ago', '')}`; col = '#6b6b75'; }
      else if (a.view === 'waiting') { txt = a.task || 'waiting on you'; col = '#b45309'; }
      else if (a.view === 'meeting' && a === firstMeet && !mv) { txt = a.task || 'meeting'; col = '#6d28d9'; }
      const key = txt + pr + col;
      if (key !== b.key) {
        b.key = key;
        const bb = b.el.firstChild;
        bb.style.display = txt ? 'block' : 'none'; bb.style.color = col;
        bb.innerHTML = esc(txt) + (pr >= 0 ? `<i><b style="width:${pr}%"></b></i>` : '');
      }
      v3.set(p.x, 3.75 - b.bot.seat.sit * .5, p.z).project(cam);
      b.sx = (v3.x + 1) / 2 * view.clientWidth; b.sy = (1 - v3.y) / 2 * view.clientHeight;
      b.el.style.display = focusId && focusId !== a.id ? 'none' : '';
      b.el.style.zIndex = Math.round((1 - v3.z) * 1000);

      const m = mon[a.seat ?? 0];
      if (m) {
        const on = a.view === 'working';
        m.material.emissive.set(on ? a.color : a.view === 'quiet' ? '#3a2a10' : '#1a1a22');
        m.material.emissiveIntensity = on ? .7 + Math.sin(t * 4) * .15 : 1;
        m.userData.l.color.set(a.color); m.userData.l.intensity = on ? 3 : 0;
      }
    }
    // keep name tags from stacking on each other
    const placed = [];
    Object.values(bots).sort((x, y) => y.sy - x.sy).forEach((b) => {
      if (b.sx == null) return;
      const w = b.el.offsetWidth, h = b.el.offsetHeight;
      let x = b.sx - w / 2, y = b.sy - h;
      for (let k = 0; k < 12; k++) {
        const hit = placed.find((r) => x < r[0] + r[2] && x + w > r[0] && y < r[1] + r[3] && y + h > r[1]);
        if (!hit) break;
        y = hit[1] - h - 2;
      }
      x = Math.max(2, Math.min(view.clientWidth - w - 2, x)); y = Math.max(2, y);
      placed.push([x, y, w, h]);
      b.oy = (b.oy ?? y) + (y - (b.oy ?? y)) * .25;
      b.el.style.transform = `translate(${x}px,${b.oy}px)`;
    });
    if (focusId && bots[focusId]) {
      const g = bots[focusId].G; focusAng += dt * .35;
      const a = Math.PI * .25 + Math.sin(focusAng) * .7;
      ctl.enabled = false; ctl.target.set(g.position.x, 2.6, g.position.z);
      cam.position.set(g.position.x + Math.sin(a) * 12, 3.4, g.position.z + Math.cos(a) * 7);
      cam.zoom += ((view.clientWidth < 500 ? 6 : 4.5) - cam.zoom) * .1; cam.updateProjectionMatrix(); cam.lookAt(ctl.target);
    } else ctl.update();
    theme.tick?.(t, dt);
    if (bloomOn) { if (!comp) mkComp(); comp.render(); } else R.render(scene, cam);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    setAgents, drawWall, focus, unfocus,
    onFocusChange: (fn) => { onFocusChange.fn = fn; },
    cheer: (agentId) => { const b = bots[agentId]; if (b) b.happy = clock.elapsedTime + 6; },
    debug,
  };
}
