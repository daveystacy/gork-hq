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

const W = 28, D = 20;
const TABLE = { x: 0, z: -2, hw: 6, hd: .85 };
// one desk per agent, out at the corners and the sides of the room, so a glance says who is at work
const DESKS = [[-11.2, -7.6], [11.2, -7.6], [-11.2, -1.4], [11.2, -1.4], [-11.2, 5], [11.2, 5]];
// where each agent sits at the long table when it isn't working: [x, z, side], side -1 is the far side, facing the camera
const TSEATS = [[-3.8, -1], [0, -1], [3.8, -1], [-3.8, 1], [0, 1], [3.8, 1]].map(([x, s]) => [TABLE.x + x, TABLE.z + s * (TABLE.hd + .4), s]);
const ACTIVITIES = ['laptop', 'phone', 'tablet', 'writing', 'eating'];
const MEET = [[7.3, -3.6], [7.6, -2], [7.3, -.4], [8.6, -2.9], [8.6, -1.1], [6.6, .1]];
const THEME_AT = [-3.35, 2]; // the set piece stands in front of the table
const MG = .3, CS = .25, X0 = -13.5, Z0 = -9.5;
const GX = Math.round(27 / CS), GZ = Math.round(19 / CS);

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
  const TY = view.clientWidth < 600 ? 2.4 : .4;
  ctl.target.set(0, TY, 0); cam.position.y += TY;
  ctl.minZoom = .7; ctl.maxZoom = 3; ctl.maxPolarAngle = 1.25; ctl.minPolarAngle = .5;
  ctl.enablePan = false; ctl.autoRotate = !reduced; ctl.autoRotateSpeed = .25;
  R.domElement.addEventListener('pointerdown', () => { ctl.autoRotate = false; });
  // phones: a vertical swipe scrolls the page, a sideways swipe turns the office
  if (matchMedia('(pointer: coarse)').matches) R.domElement.style.touchAction = 'pan-y';

  let comp = null;
  function size() {
    const w = view.clientWidth, h = view.clientHeight, a = w / h, k = Math.max(11.5, 17.5 / a);
    cam.left = -k * a; cam.right = k * a; cam.top = k; cam.bottom = -k; cam.updateProjectionMatrix();
    R.setSize(w, h);
    if (comp) comp.setSize(w, h);
  }
  new ResizeObserver(size).observe(view);
  size();

  scene.add(new THREE.HemisphereLight('#c3cbff', '#1a1612', .85));
  const sun = new THREE.DirectionalLight('#fff1dd', 2.2);
  sun.position.set(-8, 16, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20 });
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

  // ---- room: polished black stone, dark panelled walls, champagne metal and light lines
  const champagne = new THREE.MeshStandardMaterial({ color: '#d9c49a', metalness: 1, roughness: .22 });
  const chromeM = new THREE.MeshStandardMaterial({ color: '#dfe3ea', metalness: 1, roughness: .12 });
  const blackGloss = new THREE.MeshPhysicalMaterial({ color: '#0b0b0e', roughness: .16, metalness: .2, clearcoat: 1, clearcoatRoughness: .08 });
  const glow = (c, i = 2.4) => new THREE.MeshStandardMaterial({ color: '#000', emissive: c, emissiveIntensity: i, toneMapped: false });
  const floorMap = tex((g, w, h) => {
    g.fillStyle = '#0e0e12'; g.fillRect(0, 0, w, h);
    let s = 7; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let n = 0; n < 46; n++) { // veins
      let x = rnd() * w, y = rnd() * h, a = rnd() * 6.28;
      g.strokeStyle = `rgba(216,206,186,${.05 + rnd() * .16})`; g.lineWidth = .5 + rnd() * 1.3;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 14; k++) { a += (rnd() - .5) * .9; x += Math.cos(a) * 34; y += Math.sin(a) * 34; g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); // slab joints
  }, 1024, 1024);
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(4, 3);
  box(W, .3, D, new THREE.MeshPhysicalMaterial({ map: floorMap, roughness: .14, metalness: .25, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.5 }), 0, -.15, 0);
  const panelMap = tex((g, w, h) => {
    g.fillStyle = '#121216'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(90,62,38,${.05 + (i * 37 % 10) / 90})`; g.fillRect(0, (i * 53) % h, w, 1 + i % 3); }
  }, 256, 256);
  const wallM = new THREE.MeshStandardMaterial({ map: panelMap, roughness: .32, metalness: .35 });
  box(W, 5.4, .3, wallM, 0, 2.7, -D / 2);
  box(.3, 5.4, D, wallM, -W / 2, 2.7, 0);
  // light lines: a cove along the top of both walls, a skirting line, and fins that break the wall into panels
  const line = glow(cfg.accent, 2.2), warm = glow('#ffdcae', 2.6);
  box(W, .05, .05, warm, 0, 5.2, -D / 2 + .19); box(.05, .05, D, warm, -W / 2 + .19, 5.2, 0);
  box(W, .04, .04, line, 0, .1, -D / 2 + .18); box(.04, .04, D, line, -W / 2 + .18, .1, 0);
  for (let z = -7.5; z <= 8; z += 3.4) { box(.05, 5.2, .12, champagne, -W / 2 + .18, 2.6, z); }
  box(W, .12, .1, champagne, 0, 5.38, -D / 2 + .17); box(.1, .12, D, champagne, -W / 2 + .17, 5.38, 0);
  // soft pools of light on the stone, so the floor reads as polished
  const pool = tex((g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,240,215,.34)'); r.addColorStop(1, 'rgba(255,240,215,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }, 256, 256);
  const poolAt = (x, z, sx, sz) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), new THREE.MeshBasicMaterial({ map: pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, .035, z); scene.add(m); };
  // the view out: one continuous skyline across the five windows, its light set per office
  if (room.sky) {
    const hash = (n) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 7; i++) {
      if (i >= 2 && i <= 4) continue; // the big screen hangs here
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
      const x = -11.4 + i * 3.8;
      box(3.16, 2.76, .06, M('#0c0c10', { roughness: .4, metalness: .5 }), x, 2.8, -D / 2 + .17);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.6), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
      pane.position.set(x, 2.8, -D / 2 + .21); scene.add(pane);
      box(.05, 2.6, .03, M('#0c0c10', { roughness: .4 }), x, 2.8, -D / 2 + .23);
    }
  }
  // the rug under the long table
  box(TABLE.hw * 2 + 3.4, .02, 6.6, M(room.floorRug, { roughness: .95 }), TABLE.x, .012, TABLE.z);
  box(TABLE.hw * 2 + 3.5, .012, 6.7, champagne, TABLE.x, .008, TABLE.z);

  function chair(x, z, facing, colour = room.chair) {
    // facing +1: the sitter looks towards +z, so the back is at -z
    const seat = new THREE.MeshPhysicalMaterial({ color: colour, roughness: .38, clearcoat: .6, clearcoatRoughness: .3 });
    const s = new THREE.Mesh(new RoundedBoxGeometry(.72, .1, .64, 3, .04), seat); s.position.set(x, .5, z); s.castShadow = true; scene.add(s);
    const back = new THREE.Mesh(new RoundedBoxGeometry(.68, .78, .08, 3, .035), seat); back.position.set(x, .95, z - facing * .36); back.castShadow = true; scene.add(back);
    box(.7, .03, .03, champagne, x, 1.35, z - facing * .36);
    cyl(.035, .035, .46, 10, chromeM, x, .24, z);
    cyl(.27, .29, .03, 24, chromeM, x, .025, z);
  }

  const mon = {};
  DESKS.forEach(([x, z], i) => {
    box(3.6, .02, 3.4, M(room.desks, { roughness: .95 }), x, .012, z + .35);
    box(2.4, .07, 1.15, blackGloss, x, 1.165, z);
    box(2.44, .025, 1.19, champagne, x, 1.12, z);
    for (const dx of [-1, 1]) { box(.05, 1.1, .05, chromeM, x + dx * 1.1, .55, z - .45); box(.05, 1.1, .05, chromeM, x + dx * 1.1, .55, z + .45); }
    cyl(.025, .025, .4, 10, chromeM, x, 1.4, z - .3);
    box(1.5, .86, .05, blackGloss, x, 1.92, z - .36);
    mon[i] = box(1.42, .78, .02, new THREE.MeshStandardMaterial({ color: '#000', emissive: '#222', emissiveIntensity: 1, roughness: .2 }), x, 1.92, z - .33);
    box(.72, .02, .24, chromeM, x, 1.21, z + .22);
    chair(x, z + .95, -1);
    // the status line under the desk and the ring round the chair light up in the agent's colour only while it really works
    const under = box(2.3, .03, .03, glow('#000', 1), x, 1.08, z + .58);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, .025, 8, 72), glow('#000', 1)); ring.rotation.x = Math.PI / 2; ring.position.set(x, .03, z + .95); scene.add(ring);
    const pl = new THREE.PointLight('#88f', 0, 5); pl.position.set(x, 1.9, z + .2); scene.add(pl);
    Object.assign(mon[i].userData, { l: pl, under, ring });
    poolAt(x, z + .6, 5, 5);
  });

  // the long table down the middle of the room
  const tx = TABLE.x, tz = TABLE.z, tw = TABLE.hw * 2, td = TABLE.hd * 2;
  const top = new THREE.Mesh(new RoundedBoxGeometry(tw, .1, td, 4, .045), room.felt ? new THREE.MeshPhysicalMaterial({ color: '#0f5132', roughness: .95 }) : new THREE.MeshPhysicalMaterial({ color: '#17110c', roughness: .2, clearcoat: 1, clearcoatRoughness: .06, map: panelMap }));
  top.position.set(tx, 1.15, tz); top.castShadow = top.receiveShadow = true; scene.add(top);
  box(tw + .06, .03, td + .06, champagne, tx, 1.095, tz);
  if (!room.felt) box(tw - 1.2, .006, .05, champagne, tx, 1.204, tz);
  box(tw - .4, .03, td - .3, glow(cfg.accent, 1.1), tx, 1.07, tz); // a line of light under the top
  for (const dx of [-4.6, 4.6]) { box(.22, 1.05, 1.2, chromeM, tx + dx, .54, tz); box(.8, .05, 1.5, chromeM, tx + dx, .03, tz); }
  // linear pendants over the table
  for (const dx of [-3.8, 0, 3.8]) {
    box(2.6, .06, .1, champagne, tx + dx, 4.5, tz); box(2.5, .025, .07, warm, tx + dx, 4.46, tz);
    for (const e of [-1, 1]) box(.012, 1.2, .012, chromeM, tx + dx + e * 1.1, 5.1, tz);
    const l = new THREE.PointLight('#ffe2bd', 7, 8); l.position.set(tx + dx, 4.1, tz); scene.add(l);
  }
  poolAt(tx, tz, 20, 9);
  poolAt(0, 6, 12, 8);

  // each table seat holds a laptop, phone, tablet, notebook and a meal; only the one in use is shown
  const screenM = (c) => new THREE.MeshStandardMaterial({ color: '#000', emissive: c, emissiveIntensity: 1.1, roughness: .2 });
  const seatProps = TSEATS.map(([x, z, side], i) => {
    const facing = side < 0 ? 1 : -1;
    chair(x, z, facing);
    const G = new THREE.Group(); G.position.set(x, 0, z); G.rotation.y = facing > 0 ? 0 : Math.PI; scene.add(G);
    const set = {};
    const add = (name) => { const g = new THREE.Group(); g.visible = false; G.add(g); set[name] = g; return g; };
    const slate = new THREE.MeshStandardMaterial({ color: '#2c2d33', metalness: 1, roughness: .28 });
    let g = add('laptop');
    box(.72, .03, .46, slate, 0, 1.215, .72, g);
    const lid = box(.72, .46, .02, screenM('#9fc4ff'), 0, 1.44, 1.0, g); lid.rotation.x = .22; box(.72, .46, .012, slate, 0, 1.44, 1.012, g).rotation.x = .22;
    g = add('phone');
    const ph = box(.09, .17, .012, screenM('#bcd7ff'), .08, 1.56, .47, g); ph.rotation.x = -.5;
    g = add('tablet');
    const tb = box(.42, .3, .014, screenM('#cfe0ff'), 0, 1.52, .55, g); tb.rotation.x = -.55;
    box(.44, .32, .008, slate, 0, 1.515, .558, g).rotation.x = -.55;
    g = add('writing');
    box(.5, .025, .66, M('#efeadf', { roughness: .85 }), 0, 1.215, .78, g);
    box(.5, .028, .02, M('#1a1a1e'), 0, 1.216, .46, g);
    const pen = box(.016, .19, .016, champagne, 0, 1.3, .7, g); pen.rotation.z = -.5; g.userData.tool = pen;
    g = add('eating');
    cyl(.24, .19, .025, 32, M('#f4f2ec', { roughness: .22 }), 0, 1.215, .76, g);
    cyl(.14, .15, .05, 20, M(['#8a4b22', '#c98b3b', '#3f6a2f', '#b5502d', '#d7b37a', '#6d3b1f'][i], { roughness: .7 }), 0, 1.24, .76, g);
    cyl(.05, .04, .15, 14, M('#dfe3ea', { metalness: .2, roughness: .06, transparent: true, opacity: .5 }), .34, 1.28, .62, g);
    const fork = box(.016, .22, .016, chromeM, 0, 1.4, .7, g); g.userData.tool = fork;
    return { set };
  });

  // the coffee bar on the back wall, under the screen
  box(4.6, 1, .8, blackGloss, 0, .5, -D / 2 + .62); box(4.66, .04, .86, champagne, 0, 1.02, -D / 2 + .62);
  box(.6, .62, .46, chromeM, -1.2, 1.35, -D / 2 + .62);
  for (let i = 0; i < 4; i++) cyl(.05, .04, .11, 14, M('#f4f2ec', { roughness: .25 }), .6 + i * .22, 1.1, -D / 2 + .62);
  function plant(x, z) {
    const pot = cyl(.34, .24, .78, 24, blackGloss, x, .39, z);
    pot.castShadow = true; cyl(.345, .345, .03, 24, champagne, x, .78, z);
    for (let i = 0; i < 9; i++) {
      const l = new THREE.Mesh(new THREE.ConeGeometry(.17, 1.5, 7), M('#123f2a', { roughness: .45 }));
      l.position.set(x + Math.sin(i * 1.3) * .22, 1.42 + (i % 3) * .1, z + Math.cos(i * 1.3) * .22);
      l.rotation.set(Math.cos(i * 1.3) * .4, 0, -Math.sin(i * 1.3) * .4); l.castShadow = true; scene.add(l);
    }
  }
  plant(-13.3, -9.3); plant(13.3, -9.3); plant(-13.3, 9.3); plant(-5.4, -9.3); plant(5.4, -9.3);

  // set pieces are drawn in their own coordinates and stood in front of the table
  const themeG = new THREE.Group(); themeG.position.set(THEME_AT[0], 0, THEME_AT[1]); scene.add(themeG);
  const kit = {
    THREE, scene: themeG, M, tex, loadTex, eglobeTex, Rounded: RoundedBoxGeometry, accent: cfg.accent,
    box: (w, h, d, m, x, y, z, p = themeG) => box(w, h, d, m, x, y, z, p),
    cyl: (rt, rb, h, seg, m, x, y, z, p = themeG) => cyl(rt, rb, h, seg, m, x, y, z, p),
    room: { scene, box: (w, h, d, m, x, y, z) => box(w, h, d, m, x, y, z, scene), cyl: (rt, rb, h, seg, m, x, y, z) => cyl(rt, rb, h, seg, m, x, y, z, scene) },
    tableAt: (dx, dz, y) => [TABLE.x + dx - THEME_AT[0], y, TABLE.z + dz - THEME_AT[1]],
  };
  const theme = buildTheme(id, kit);

  // ---- walking: a grid over the floor, breadth-first paths around the furniture
  const OB = [[TABLE.x - TABLE.hw, TABLE.z - TABLE.hd, TABLE.x + TABLE.hw, TABLE.z + TABLE.hd], [-2.4, -9.8, 2.4, -8.9], [-13.8, -9.8, -12.9, -8.9], [12.9, -9.8, 13.8, -8.9], [-13.8, 8.9, -12.9, 9.8], [-5.8, -9.8, -5, -8.9], [5, -9.8, 5.8, -8.9],
    ...theme.blocked.map((o) => [o[0] + THEME_AT[0], o[1] + THEME_AT[1], o[2] + THEME_AT[0], o[3] + THEME_AT[1]])];
  DESKS.forEach(([x, z]) => OB.push([x - 1.2, z - .58, x + 1.2, z + .58], [x - .36, z + .65, x + .36, z + 1.42]));
  TSEATS.forEach(([x, z, side]) => OB.push(side < 0 ? [x - .36, z - .42, x + .36, z + .3] : [x - .36, z - .3, x + .36, z + .42]));
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

  // ---- the agents (bots.js): two blue heads, two glitch and two white smoke, one per desk
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
    if (a.view === 'waiting') return [d[0] + (d[0] < 0 ? 1.5 : -1.5), d[1] + 1.6, 0];
    if (a.view === 'meeting') {
      const i = agents.filter((x) => x.view === 'meeting').indexOf(a), m = MEET[i % MEET.length];
      return [m[0], m[1], Math.atan2(TABLE.x + TABLE.hw - m[0], TABLE.z - m[1])];
    }
    // not working: a seat at the long table
    const s = TSEATS[(a.seat ?? 0) % TSEATS.length];
    return [s[0], s[1], s[2] < 0 ? 0 : Math.PI];
  }

  function makeBot(a) {
    const bot = factory.make(KINDS[(a.seat ?? 0) % KINDS.length]);
    const el = document.createElement('div'); el.className = 'bot'; el.style.setProperty('--c', a.color);
    el.innerHTML = `<div class="bb"></div><div class="nt">${esc(a.name)}</div>`;
    overlay.appendChild(el);
    const t0 = target(a);
    bot.G.position.set(t0[0], 0, t0[1]); bot.G.rotation.y = t0[2] || 0;
    scene.add(bot.G);
    return { a, bot, G: bot.G, el, path: [], gk: '', ph: Math.random() * 6, wait: 0, key: '' };
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
  wall.position.set(0, 3.1, -D / 2 + .22); scene.add(wall);
  box(6.6, 3.57, .06, chromeM, 0, 3.1, -D / 2 + .18);
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
    comp.addPass(new UnrealBloomPass(new THREE.Vector2(w / 4, h / 4), .55, .4, .82));
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
      let tg = target(a);
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
      // off the clock: the seat's prop changes every so often, and shows only while the agent is sitting there
      const idx = (a.seat ?? 0) % TSEATS.length;
      const sitting = a.view === 'idle' && !mv && focusId !== a.id;
      const activity = sitting ? ACTIVITIES[Math.floor(t / 40 + idx * 1.4) % ACTIVITIES.length] : null;
      b.bot.pose({ t, dt, moving: mv, phase: b.ph, view: a.view, happy: b.happy > t, activity });
      const props = seatProps[idx].set;
      for (const name of ACTIVITIES) props[name].visible = name === activity;
      const tool = activity && props[activity].userData.tool;
      if (tool) tool.position.set(b.bot.rightHand.x, b.bot.rightHand.y - .57 - .02, b.bot.rightHand.z + .02);

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
        m.userData.l.color.set(a.color); m.userData.l.intensity = on ? 7 : 0;
        const lit = a.view === 'quiet' ? '#f59e0b' : on ? a.color : '#000';
        m.userData.under.material.emissive.set(lit); m.userData.ring.material.emissive.set(lit);
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
