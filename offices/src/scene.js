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
import { ago } from './data.js';

const W = 20, D = 14;
const DESKS = [[-7.5, -4], [-4.5, -4], [0, -4.6], [4.5, -4], [7.5, -4]];
const MEET = [[-4, 4.6], [-1.9, 2.5], [-4, .4], [-6.1, 2.5], [-2.5, 4.1]];
const BASE_SPOTS = [[-1.3, 4.5], [8.4, 2.6], [-8.5, 0], [-8, 4.8], [5, -1.6], [-1, -1.5], [8.2, 4.8], [-1.2, 6]];
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

  // ---- room
  const fc = document.createElement('canvas'); fc.width = fc.height = 256;
  const fx = fc.getContext('2d');
  for (let i = 0; i < 8; i++) {
    fx.fillStyle = i % 2 ? '#7a5232' : '#6e4a2d'; fx.fillRect(0, i * 32, 256, 32);
    fx.fillStyle = 'rgba(0,0,0,.15)'; fx.fillRect(0, i * 32, 256, 1); fx.fillRect((i * 73) % 256, i * 32, 1, 32);
  }
  const floorT = new THREE.CanvasTexture(fc);
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(4, 3); floorT.colorSpace = THREE.SRGBColorSpace;
  box(W, .3, D, M('#fff', { map: floorT, roughness: .12, metalness: .4, color: '#2a2a33' }), 0, -.15, 0);
  box(W, 5, .3, M('#1a1b24'), 0, 2.5, -D / 2);
  box(.3, 5, D, M('#16171f'), -W / 2, 2.5, 0);
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
  box(8, .02, 5.4, M(room.floorRug), 3.4, .01, 3.7);
  box(7, .02, 4.2, M(room.desks), -5, .01, -3.4);

  const mon = {};
  DESKS.forEach(([x, z], i) => {
    box(2.2, .1, 1.1, M('#2a2a30', { roughness: .4 }), x, 1.05, z);
    for (const dx of [-1, 1]) box(.08, 1, .9, M('#111'), x + dx, .5, z);
    box(.15, .4, .15, M('#111'), x, 1.3, z - .3);
    mon[i] = box(1.3, .75, .06, M('#000', { emissive: '#222', emissiveIntensity: 1 }), x, 1.75, z - .32);
    box(.6, .08, .6, M(room.chair), x, .6, z + .95); box(.6, .6, .08, M(room.chair), x, .95, z + 1.25);
    const pl = new THREE.PointLight('#88f', 0, 3); pl.position.set(x, 1.8, z); scene.add(pl); mon[i].userData.l = pl;
  });

  // coffee station and plants, as in gork's office
  box(1.6, 1, .8, M('#3a3a42'), 8.4, .5, 1.5);
  box(.6, .8, .5, M('#888', { metalness: .9, roughness: .25 }), 8.4, 1.4, 1.5);
  box(.12, .12, .12, M('#fff'), 8.4, 1.15, 1.85);
  function plant(x, z) {
    box(.6, .7, .6, M('#d8d2c8'), x, .35, z);
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.ConeGeometry(.35, 1.3, 6), M('#1f8a4c'));
      l.position.set(x + Math.sin(i * 1.3) * .2, 1.2 + i * .05, z + Math.cos(i * 1.3) * .2);
      l.rotation.set(Math.sin(i) * .4, 0, Math.cos(i) * .4); l.castShadow = true; scene.add(l);
    }
  }
  plant(-9.2, -6.2); plant(9.2, -6.2); plant(-9.2, 6.2);

  // the meeting table (a felt poker table in the casino)
  const mt = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, .1, 48), room.felt ? M('#0f5132', { roughness: .95 }) : M('#d9d4cb', { roughness: .3 }));
  mt.position.set(-4, 1, 2.5); mt.castShadow = mt.receiveShadow = true; scene.add(mt);
  if (room.felt) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.6, .09, 12, 64), M('#2a1a10', { roughness: .45 })); r.rotation.x = Math.PI / 2; r.position.set(-4, 1.04, 2.5); r.castShadow = true; scene.add(r); }
  box(.2, 1, .2, M('#222'), -4, .5, 2.5);

  const kit = { THREE, scene, M, box, cyl, tex, loadTex, eglobeTex, Rounded: RoundedBoxGeometry, accent: cfg.accent };
  const theme = buildTheme(id, kit);

  // ---- walking: a grid over the floor, breadth-first paths around the furniture
  const OB = [[7.6, 1.1, 9.2, 1.9], [-9.8, -6.8, -8.6, -5.6], [8.6, -6.8, 9.8, -5.6], [-9.8, 5.6, -8.6, 6.8], [-10, -3.2, -9.6, .4], ...theme.blocked];
  DESKS.forEach(([x, z]) => OB.push([x - 1.1, z - .55, x + 1.1, z + .55], [x - .3, z + .65, x + .3, z + 1.3]));
  const blocked = (x, z) => x < X0 || x > -X0 || z < Z0 || z > -Z0 || Math.hypot(x + 4, z - 2.5) < 1.6 + MG || OB.some((o) => x > o[0] - MG && x < o[2] + MG && z > o[1] - MG && z < o[3] + MG);
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

  // ---- the Expirites
  function rimMat(c) {
    return new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(c) } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: 'varying vec3 n;varying vec3 v;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform vec3 c;varying vec3 n;varying vec3 v;void main(){float f=pow(1.-abs(dot(n,v)),2.2);gl_FragColor=vec4(c*(f*2.2+.06),f*.9+.05);}',
    });
  }
  const inM = new THREE.MeshPhysicalMaterial({ color: '#03030a', roughness: .05, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.2 });
  const capM = new THREE.MeshPhysicalMaterial({ color: '#050506', roughness: .55, clearcoat: .25, clearcoatRoughness: .5, envMapIntensity: .35, sheen: .3, sheenColor: '#222' });
  const hood = M('#0d0d10', { roughness: .95 }), pant = M('#0b0b10', { roughness: .6, transparent: true, opacity: .55 }), shoe = M('#f5f5f5', { roughness: .5 });
  const SMOKE = tex((g, w, h) => {
    for (let i = 0; i < 9; i++) {
      const x = 34 + Math.random() * 60, y = 34 + Math.random() * 60, r = g.createRadialGradient(x, y, 0, x, y, 30);
      r.addColorStop(0, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    }
  });
  function faceTex(k) {
    return tex((g) => {
      g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 14; g.lineWidth = 12; g.lineCap = 'round'; g.strokeStyle = '#fff';
      if (k === 'b') { g.fillRect(70, 92, 40, 8); g.fillRect(146, 92, 40, 8); } else { g.beginPath(); g.arc(90, 96, 17, 0, 7); g.arc(166, 96, 17, 0, 7); g.fill(); }
      g.beginPath(); if (k === 'h') g.arc(128, 135, 48, .15 * Math.PI, .85 * Math.PI); else g.arc(128, 118, 52, .3 * Math.PI, .7 * Math.PI); g.stroke();
    }, 256, 192);
  }
  const FACE = { n: faceTex('n'), b: faceTex('b'), h: faceTex('h') };
  const WORD = tex((g, w, h) => { g.fillStyle = '#fff'; g.font = '600 70px "Helvetica Neue",Helvetica,Arial,sans-serif'; g.textAlign = 'center'; g.fillText('expire', w / 2, h / 2 + 24); }, 320, 120);

  const bots = {};
  let agents = [], focusId = null, focusAng = 0;

  function target(a) {
    const d = DESKS[(a.seat ?? 0) % DESKS.length];
    if (a.view === 'working' || a.view === 'quiet') return [d[0], d[1] + .95, Math.PI];
    if (a.view === 'waiting') return [d[0] + 1.3, d[1] + 1.6, 0];
    if (a.view === 'meeting') {
      const i = agents.filter((x) => x.view === 'meeting').indexOf(a), m = MEET[i % MEET.length];
      return [m[0], m[1], Math.atan2(-4 - m[0], 2.5 - m[1])];
    }
    return null;
  }

  function makeBot(a) {
    const col = a.color, G = new THREE.Group(), body = new THREE.Group(); G.add(body);
    const cs = (m) => { m.castShadow = true; return m; };
    const torso = cs(new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, .95, 14), hood)); torso.position.y = 1.5; torso.scale.z = .75; body.add(torso);
    const hd = cs(new THREE.Mesh(new THREE.TorusGeometry(.26, .12, 8, 16), hood)); hd.rotation.x = Math.PI / 2; hd.position.y = 2.02; body.add(hd);
    const hb = cs(new THREE.Mesh(new THREE.SphereGeometry(.34, 12, 10, 0, Math.PI * 2, 0, 1.6), hood)); hb.position.set(0, 2.1, -.12); hb.rotation.x = -.5; body.add(hb);
    const H = new THREE.Group(); H.position.y = 2.55; body.add(H);
    H.add(new THREE.Mesh(new THREE.SphereGeometry(.42, 32, 24), inM));
    H.add(new THREE.Mesh(new THREE.SphereGeometry(.47, 32, 24), rimMat(col)));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.8, .6), new THREE.MeshBasicMaterial({ map: FACE.n, transparent: true, toneMapped: false }));
    face.position.set(0, -.02, .43); H.add(face);
    for (const s of [-1, 1]) {
      const cup = cs(new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .12, 32), capM)); cup.rotation.z = Math.PI / 2; cup.position.set(s * .5, -.02, 0); H.add(cup);
      const lo = new THREE.Mesh(new THREE.CircleGeometry(.17, 32), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
      eglobeTex((t) => { lo.material.map = t; lo.material.needsUpdate = true; });
      lo.position.set(s * .561, -.02, 0); lo.rotation.y = s * Math.PI / 2; H.add(lo);
    }
    const wm = M('#9a9a9a', { metalness: .9, roughness: .25 });
    for (const o of [0, Math.PI]) {
      const pts = [];
      for (let i = 0; i <= 40; i++) { const u = i / 40, an = u * Math.PI * 8 + o; pts.push(new THREE.Vector3(Math.cos(an) * .018, .42 + u * .34, Math.sin(an) * .018)); }
      H.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .009, 5), wm));
    }
    const bulbM = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2, toneMapped: false });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), bulbM); bulb.position.y = .82; H.add(bulb);
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(.3, .1), new THREE.MeshBasicMaterial({ map: WORD, transparent: true })); lg.position.set(.17, 1.75, .385); body.add(lg);
    const limbs = {};
    for (const s of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(s * .52, 1.88, 0);
      const am = cs(new THREE.Mesh(new THREE.CapsuleGeometry(.13, .65, 4, 8), hood)); am.position.y = -.4; arm.add(am); arm.rotation.z = s * .12; body.add(arm);
      const leg = new THREE.Group(); leg.position.set(s * .2, 1.05, 0);
      const lm = cs(new THREE.Mesh(new THREE.CapsuleGeometry(.16, .6, 4, 8), pant)); lm.position.y = -.42; leg.add(lm);
      const pk = cs(new THREE.Mesh(new RoundedBoxGeometry(.07, .26, .24, 2, .025), pant)); pk.position.set(s * .17, -.42, 0); leg.add(pk);
      const fl = new THREE.Mesh(new RoundedBoxGeometry(.08, .07, .25, 2, .02), M('#0c0c0e', { roughness: .9 })); fl.position.set(s * .175, -.28, 0); leg.add(fl);
      const sh = cs(new THREE.Mesh(new RoundedBoxGeometry(.3, .2, .5, 3, .07), shoe)); sh.position.set(0, -.95, .08); leg.add(sh);
      const sr = new THREE.Mesh(new THREE.BoxGeometry(.31, .04, .3), M(col)); sr.position.set(0, -.9, .05); leg.add(sr);
      body.add(leg); limbs[s] = { arm, leg };
    }
    const el = document.createElement('div'); el.className = 'bot'; el.style.setProperty('--c', col);
    el.innerHTML = `<div class="bb"></div><div class="nt">${esc(a.name)}</div>`;
    overlay.appendChild(el);
    const n = Object.keys(bots).length, sp = SPOTS[n % SPOTS.length];
    G.position.set(sp[0], 0, sp[1]);
    const t0 = target(a);
    if (t0) { G.position.set(t0[0], 0, t0[1]); G.rotation.y = t0[2] || 0; }
    const sm = [];
    for (let i = 0; i < 32; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      m.userData = { ph: Math.random(), r: .15 + Math.random() * .4, a: Math.random() * 6.3, sp: .25 + Math.random() * .3 };
      G.add(m); sm.push(m);
    }
    scene.add(G);
    return { a, sm, G, body, limbs, el, face, bulbM, H, path: [], gk: '', ph: Math.random() * 6, wx: null, wait: 0, key: '', col };
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
    const firstMeet = agents.find((q) => q.view === 'meeting');
    for (const a of agents) {
      const b = bots[a.id]; if (!b) continue;
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
      const typing = a.view === 'working' && !mv;
      const sw = mv ? Math.sin(b.ph) * .6 : 0;
      for (const s of [-1, 1]) {
        b.limbs[s].leg.rotation.x += (s * sw - b.limbs[s].leg.rotation.x) * .3;
        b.limbs[s].arm.rotation.x += ((typing ? -.9 + Math.sin(t * 14 + s) * .05 : -s * sw) - b.limbs[s].arm.rotation.x) * .3;
      }
      const ht = t + b.ph;
      b.face.material.map = b.happy > t ? FACE.h : (ht % 4 < .12 ? FACE.b : FACE.n);
      b.bulbM.emissiveIntensity = a.view === 'working' ? 1.5 + Math.sin(t * 6 + b.ph) * 1.2 : a.view === 'waiting' ? 1.5 + Math.sin(t * 3) * 1.4 : .6;
      b.H.rotation.z = mv ? 0 : Math.sin(t * 1.2 + b.ph) * .05;
      b.H.rotation.x = mv ? Math.sin(b.ph * 2) * .03 : (a.view === 'quiet' ? .22 : 0);
      for (const m of b.sm) {
        const u = m.userData, k = (t * u.sp + u.ph) % 1, an = u.a + t * .8;
        m.position.set(Math.cos(an) * u.r * (1 + k * .6), .1 + k * 2.3, Math.sin(an) * u.r * (1 + k * .6));
        const sc = .6 + k * 1.1; m.scale.set(sc, sc, 1);
        m.material.opacity = Math.sin(k * Math.PI) * (a.view === 'quiet' ? .3 : mv ? 1 : .85); m.material.rotation = an;
      }
      b.body.position.y = mv ? Math.abs(Math.cos(b.ph)) * .06 : Math.sin(t * 2 + b.ph) * .015;

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
      v3.set(p.x, 3.75, p.z).project(cam);
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
    debug: { bots, cam, blocked },
  };
}
