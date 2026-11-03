// The live 3D office. Five robots, a desk each around the room and a long table in the middle;
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
// five desks, one per agent: the four corners and the middle of the side wall, under the screen. [x, z, the way the agent faces]
const DESKS = [[-8, -5.2, Math.PI], [8, -5.2, Math.PI], [-8.6, -1.2, -Math.PI / 2], [-8, 5.2, 0], [8, 5.2, 0]];
const chairOf = ([x, z, r]) => [x + Math.sin(r) * -.95, z + Math.cos(r) * -.95];
// the long table in the middle, and where each agent sits at it when not working
const TABLE = { x: 0, z: -1, w: 10.4, d: 2.2, y: 1.2 };
const SEATS = [[-3.4, -2.5, 0], [0, -2.5, 0], [3.4, -2.5, 0], [-1.7, .5, Math.PI], [1.7, .5, Math.PI]];
const ACTIVITIES = ['laptop', 'phone', 'ipad', 'writing', 'eating'];
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

  scene.add(new THREE.HemisphereLight('#aab6ff', '#2a2018', 1.05));
  const sun = new THREE.DirectionalLight('#fff1dd', 2.2);
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

  // ---- room: black marble, fluted walls, brass and light
  const shiny = [];
  const P = (c, o = {}) => { const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: .2, clearcoat: 1, clearcoatRoughness: .05, ...o }); shiny.push(m); return m; };
  const brass = P('#f2cf86', { metalness: .85, roughness: .26, clearcoat: .5, envMapIntensity: 2.6, emissive: '#3a2a10', emissiveIntensity: .5 });
  const lacquer = P('#0b0b10', { roughness: .08, envMapIntensity: 1.8 });
  const light = (c, i = 2.4) => new THREE.MeshStandardMaterial({ color: '#000', emissive: c, emissiveIntensity: i, toneMapped: false });
  const warm = light('#ffdcae');
  const stone = (base, a1, a2, seam) => {
    const t = tex((g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      const vein = (n, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; for (let i = 0; i < n; i++) { let x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (Math.random() - .3) * 130; y += (Math.random() - .3) * 130; g.lineTo(x, y); } g.stroke(); } };
      vein(26, a1, 1.4); vein(12, a2, 1.8);
      if (seam) { g.strokeStyle = seam; g.lineWidth = 3; g.strokeRect(0, 0, w, h); }
    }, 1024, 1024);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  };
  // a pearl marble floor, so the black hoodies stand out, with brass seams between the slabs
  const pearl = stone('#d9d5cc', 'rgba(120,112,100,.26)', 'rgba(190,150,80,.5)', 'rgba(190,150,80,.75)'); pearl.repeat.set(3, 2);
  const darkStone = stone('#0b0b10', 'rgba(235,225,205,.16)', 'rgba(217,179,106,.4)'); darkStone.repeat.set(2, .5);
  box(W, .3, D, P('#a9a59e', { map: pearl, roughness: .14, envMapIntensity: .9 }), 0, -.15, 0);
  const flutes = tex((g, w, h) => {
    for (let x = 0; x < w; x += 16) { const c = g.createLinearGradient(x, 0, x + 16, 0); c.addColorStop(0, '#1b1c26'); c.addColorStop(.5, '#4a4c5e'); c.addColorStop(1, '#1b1c26'); g.fillStyle = c; g.fillRect(x, 0, 16, h); }
  }, 256, 8);
  flutes.wrapS = THREE.RepeatWrapping;
  const wallBack = flutes.clone(); wallBack.repeat.set(12, 1); wallBack.needsUpdate = true;
  const wallSide = flutes.clone(); wallSide.repeat.set(8, 1); wallSide.needsUpdate = true;
  box(W, 5, .3, P('#ffffff', { map: wallBack, roughness: .3, metalness: .4 }), 0, 2.5, -D / 2);
  box(.3, 5, D, [P('#16171f'), P('#ffffff', { map: wallSide, roughness: .3, metalness: .4 }), P('#16171f'), P('#16171f'), P('#16171f'), P('#16171f')], -W / 2, 2.5, 0);
  // brass skirting and a warm cove of light along the top of both walls
  box(W, .12, .05, brass, 0, .06, -D / 2 + .18); box(.05, .12, D, brass, -W / 2 + .18, .06, 0);
  box(W, .05, .05, warm, 0, 4.92, -D / 2 + .18); box(.05, .05, D, warm, -W / 2 + .18, 4.92, 0);
  box(W, .05, .03, brass, 0, 4.82, -D / 2 + .17); box(.03, .05, D, brass, -W / 2 + .17, 4.82, 0);
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
      box(3.16, 2.76, .06, brass, x, 2.8, -D / 2 + .17);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.6), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
      pane.position.set(x, 2.8, -D / 2 + .21); scene.add(pane);
      box(.05, 2.6, .03, brass, x, 2.8, -D / 2 + .23);
    }
  }
  // the desks: black lacquer and brass. The strip of light on the floor around each one shows that agent's colour when it is really working
  const mon = {}, deskGlow = {}, screenBack = M('#050507', { roughness: .25, metalness: .6 });
  const chairLeather = P('#ece4d4', { roughness: .42, clearcoat: .35 }), chairBase = brass;
  function chair(parent, x, z, ry) {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; parent.add(c);
    const seatM = new THREE.Mesh(new RoundedBoxGeometry(.78, .14, .7, 3, .06), chairLeather); seatM.position.y = .5; seatM.castShadow = true; c.add(seatM);
    const back = new THREE.Mesh(new RoundedBoxGeometry(.72, .84, .12, 3, .05), chairLeather); back.position.set(0, 1, .36); back.castShadow = true; c.add(back);
    cyl(.035, .035, .44, 10, chairBase, 0, .24, 0, c);
    cyl(.27, .3, .03, 24, chairBase, 0, .025, 0, c);
    return c;
  }
  DESKS.forEach((d, i) => {
    const [x, z, r] = d, g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r + Math.PI; scene.add(g);
    const top = new THREE.Mesh(new RoundedBoxGeometry(2.3, .09, 1.15, 3, .03), lacquer); top.position.y = 1.15; top.castShadow = top.receiveShadow = true; g.add(top);
    box(2.32, .018, 1.17, brass, 0, 1.095, 0, g);
    for (const dx of [-1, 1]) box(.05, 1.09, 1, brass, dx * 1.08, .55, 0, g);
    box(.1, .34, .1, brass, 0, 1.36, -.3, g);
    box(1.34, .8, .04, screenBack, 0, 1.88, -.34, g);
    mon[i] = box(1.26, .72, .02, M('#000', { emissive: '#222', emissiveIntensity: 1 }), 0, 1.88, -.315, g);
    box(.72, .025, .24, lacquer, 0, 1.21, .22, g);
    chair(g, 0, .95, 0);
    const pl = new THREE.PointLight('#88f', 0, 3.4); pl.position.set(0, 1.95, 0); g.add(pl); mon[i].userData.l = pl;
    const glow = new THREE.MeshBasicMaterial({ color: '#8d8a84', toneMapped: false }); deskGlow[i] = glow;
    [[2.9, .05, 0, -.72], [2.9, .05, 0, 1.62], [.05, 2.34, -1.45, .45], [.05, 2.34, 1.45, .45]].forEach(([w, dd, ox, oz]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .012, dd), glow); m.position.set(ox, .012, oz); g.add(m); });
  });

  // the bar along the back wall
  box(2.8, 1, .7, lacquer, 0, .5, -6.45); box(2.84, .05, .74, brass, 0, 1.02, -6.45);
  box(.5, .55, .4, P('#c9ccd2', { metalness: 1, roughness: .15 }), -.6, 1.32, -6.5);
  for (let i = 0; i < 4; i++) cyl(.05, .04, .16, 14, P('#ffffff', { roughness: .1 }), .1 + i * .28, 1.13, -6.4);
  function plant(x, z) {
    cyl(.34, .26, .7, 24, brass, x, .35, z);
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(.4 - i * .03, 12, 10), M('#1a6b43', { roughness: .45 }));
      l.scale.set(.55, 1.5, .55);
      l.position.set(x + Math.sin(i * 1.3) * .2, 1.25 + i * .09, z + Math.cos(i * 1.3) * .2);
      l.rotation.set(Math.sin(i) * .4, 0, Math.cos(i) * .4); l.castShadow = true; scene.add(l);
    }
  }
  plant(-3.6, -6.3); plant(3.6, -6.3); plant(-9.3, 2.2);

  // the long table: a slab of black glass on brass, with a line of light under the edge
  {
    const { x, z, w, d, y } = TABLE;
    const top = new THREE.Mesh(new RoundedBoxGeometry(w, .12, d, 4, .05), room.felt ? P('#0f5132', { roughness: .85, clearcoat: 0 }) : P('#ffffff', { map: darkStone, roughness: .05, envMapIntensity: 1.8 }));
    top.position.set(x, y - .06, z); top.castShadow = top.receiveShadow = true; scene.add(top);
    box(w + .04, .025, d + .04, brass, x, y - .13, z);
    box(w - .3, .02, d - .3, light(cfg.accent, 1.6), x, y - .16, z);
    for (const sx of [-1, 1]) { box(.14, y - .15, d - .5, brass, x + sx * (w / 2 - .7), (y - .15) / 2, z); box(1, .05, d - .2, brass, x + sx * (w / 2 - .7), .03, z); }
    // long pendant over the table
    box(w - 2.4, .04, .08, light('#fff3e0', 3), x, 4.55, z); box(w - 2.36, .05, .12, brass, x, 4.6, z);
    for (const sx of [-1, 1]) box(.02, .4, .02, brass, x + sx * (w / 2 - 1.5), 4.8, z);
    const glowOver = new THREE.PointLight('#ffe6c4', 8, 11); glowOver.position.set(x, 4.2, z); scene.add(glowOver);
  }
  SEATS.forEach(([x, z, r]) => chair(scene, x, z, r + Math.PI));

  // what's on the table at each seat. Each agent has one of each, and only the one in use shows
  const propM = { dark: M('#101014', { roughness: .25, metalness: .7 }), silver: P('#c9ccd2', { metalness: 1, roughness: .18, clearcoat: 0 }), paper: M('#f2eee3', { roughness: .85 }), plate: P('#f6f4ee', { roughness: .2 }), food: M('#c9743a', { roughness: .6 }), green: M('#4f9a4a', { roughness: .7 }), screen: new THREE.MeshBasicMaterial({ color: '#7fb6ff', toneMapped: false }) };
  const seatProps = SEATS.map(([sx, sz, r]) => {
    const g = new THREE.Group(); g.position.set(sx, TABLE.y, sz); g.rotation.y = r; scene.add(g);
    const make = (fn) => { const p = new THREE.Group(); p.position.z = .78; fn(p); p.visible = false; p.traverse((o) => { o.castShadow = false; }); g.add(p); return p; };
    return {
      laptop: make((p) => { box(.62, .025, .42, propM.silver, 0, .013, 0, p); const lid = box(.62, .4, .018, propM.silver, 0, .2, .22, p); lid.rotation.x = -.14; const sc = box(.56, .34, .004, propM.screen, 0, .2, .208, p); sc.rotation.x = -.14; }),
      ipad: make((p) => { const t = box(.5, .36, .018, propM.dark, 0, .19, .14, p); t.rotation.x = -.5; const sc = box(.45, .31, .004, propM.screen, 0, .19, .13, p); sc.rotation.x = -.5; }),
      writing: make((p) => { const n = box(.5, .02, .36, propM.paper, 0, .012, -.02, p); n.rotation.y = .12; const c = box(.03, .025, .36, propM.dark, -.23, .014, -.02, p); c.rotation.y = .12; }),
      eating: make((p) => { cyl(.27, .22, .025, 28, propM.plate, 0, .014, -.02, p); cyl(.14, .16, .05, 18, propM.food, -.03, .05, -.02, p); cyl(.06, .07, .04, 12, propM.green, .1, .05, .05, p); cyl(.05, .04, .2, 14, P('#ffffff', { roughness: .1 }), .42, .1, .12, p); }),
    };
  });

  // each office's own set piece stands, scaled down, in the open floor at the front of the room
  const THEME_K = .72, themeGroup = new THREE.Group(); themeGroup.scale.setScalar(THEME_K); themeGroup.position.set(-3.35 * THEME_K, 0, 2.3 - THEME_K); scene.add(themeGroup);
  const kit = { THREE, scene: themeGroup, room: scene, table: TABLE, M, box: (w, h, d, m, x, y, z, p = themeGroup) => box(w, h, d, m, x, y, z, p), cyl: (a, b, h, n, m, x, y, z, p = themeGroup) => cyl(a, b, h, n, m, x, y, z, p), tex, loadTex, eglobeTex, Rounded: RoundedBoxGeometry, accent: cfg.accent };
  const theme = buildTheme(id, kit);

  // ---- walking: a grid over the floor, breadth-first paths around the furniture
  const tx = (x) => x * THEME_K - 3.35 * THEME_K, tz = (z) => z * THEME_K + 2.3 - THEME_K;
  const OB = [[-1.5, -6.9, 1.5, -6], [-4, -6.7, -3.2, -5.9], [3.2, -6.7, 4, -5.9], [-9.7, 1.8, -8.9, 2.6], [TABLE.x - TABLE.w / 2, TABLE.z - TABLE.d / 2, TABLE.x + TABLE.w / 2, TABLE.z + TABLE.d / 2], ...theme.blocked.map((o) => [tx(o[0]), tz(o[1]), tx(o[2]), tz(o[3])])];
  DESKS.forEach((d) => {
    const side = Math.abs(Math.sin(d[2])) > .5, hw = side ? .6 : 1.15, hd = side ? 1.15 : .6, [cx, cz] = chairOf(d);
    OB.push([d[0] - hw, d[1] - hd, d[0] + hw, d[1] + hd], [cx - .38, cz - .38, cx + .38, cz + .38]);
  });
  SEATS.forEach(([x, z]) => OB.push([x - .38, z - .38, x + .38, z + .38]));
  const blocked = (x, z) => x < X0 || x > -X0 || z < Z0 || z > -Z0 || OB.some((o) => x > o[0] - MG && x < o[2] + MG && z > o[1] - MG && z < o[3] + MG);
  const FREE = new Uint8Array((GX + 1) * (GZ + 1));
  for (let i = 0; i <= GX; i++) for (let j = 0; j <= GZ; j++) FREE[i * (GZ + 1) + j] = blocked(X0 + i * CS, Z0 + j * CS) ? 0 : 1;
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

  // real states only: working or gone quiet at their own desk, waiting beside it, otherwise at their seat at the long table
  function target(a) {
    const i = (a.seat ?? 0) % DESKS.length, d = DESKS[i], [cx, cz] = chairOf(d);
    if (a.view === 'working' || a.view === 'quiet') return [cx, cz, d[2]];
    if (a.view === 'waiting') return [cx - Math.sign(cx) * 1.3, cz, Math.atan2(-cx, -cz)];
    const s = SEATS[i % SEATS.length];
    return [s[0], s[1], s[2]];
  }

  function makeBot(a) {
    const bot = factory.make(KINDS[(a.seat ?? 0) % KINDS.length], a.role === 'office lead');
    const el = document.createElement('div'); el.className = 'bot'; el.style.setProperty('--c', a.color);
    el.innerHTML = `<div class="bb"></div><div class="nt">${esc(a.name)}</div>`;
    overlay.appendChild(el);
    const t0 = target(a);
    bot.G.position.set(t0[0], 0, t0[1]); bot.G.rotation.y = t0[2];
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
      let tg = target(a); const seated = true;
      if (focusId === a.id) tg = [tg[0], tg[1], Math.PI * .25];
      const p = b.G.position, gk = tg[0].toFixed(2) + ',' + tg[1].toFixed(2);
      if (gk !== b.gk) { b.gk = gk; b.path = findPath([p.x, p.z], tg); }
      let wp = b.path[0] || tg;
      if (b.path.length > 1 && Math.hypot(wp[0] - p.x, wp[1] - p.z) < .08) { b.path.shift(); wp = b.path[0]; }
      const dx = wp[0] - p.x, dz = wp[1] - p.z, d = Math.hypot(dx, dz) + (b.path.length > 1 ? 1 : 0), mv = d > .05;
      if (mv) {
        const dd = Math.hypot(dx, dz) || 1, v = Math.min(2.2 * dt, dd);
        p.x += dx / dd * v; p.z += dz / dd * v; b.ph += dt * 9;
        let df = Math.atan2(dx, dz) - b.G.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); b.G.rotation.y += df * Math.min(1, dt * 10);
      } else if (tg[2] != null) {
        let df = tg[2] - b.G.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); b.G.rotation.y += df * Math.min(1, dt * 6);
      }
      const seatI = (a.seat ?? 0) % SEATS.length, atTable = (a.view === 'idle' || a.view === 'meeting') && !mv;
      // every so often an agent at the table moves on to something else: laptop, phone, iPad, writing, eating
      const activity = a.view === 'idle' && atTable ? ACTIVITIES[(seatI + Math.floor((t + seatI * 7) / 40)) % ACTIVITIES.length] : a.view === 'meeting' && atTable ? 'rest' : null;
      for (const k in seatProps[seatI]) seatProps[seatI][k].visible = activity === k && b.bot.seat.sit > .7;
      b.bot.pose({ t, dt, moving: mv, phase: b.ph, view: a.view, happy: b.happy > t, activity });

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
        const dg = deskGlow[a.seat ?? 0]; if (dg) dg.color.set(on ? a.color : a.view === 'waiting' ? '#f59e0b' : a.view === 'quiet' ? '#8a5a14' : '#8d8a84');
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
