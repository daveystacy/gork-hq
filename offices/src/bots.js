// The agents, built from the owner's five reference photos: the same black hoodie (small expire on the chest,
// kangaroo pocket, hood behind the neck), black cargos and white sneakers on every one, and five heads:
//   liquid  black glass sphere inside a splash of clear liquid
//   smoke   clear glass sphere full of smoke and glitch specks
//   glitch  black sphere breaking up into RGB pixels
//   box     glossy cobalt box head with a black lid and a green bulb
//   chrome  the faceless chrome Expireman, e-globe on the chest, Explore / Inspire on the back (the office lead)
// All marks are the official artwork from the site's brand and print folders, never a redraw.
// Geometry and materials are shared between bots, the hoodie and legs are merged, so five agents stay cheap on a phone.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const KINDS = ['box', 'glitch', 'smoke', 'box', 'glitch', 'smoke']; // by desk: two blue heads, two glitch, two white smoke

const R = .37;            // head radius
const HEAD_Y = 2.8;
const HIP_Y = 1.35, THIGH = .57, SHIN = .58, SEAT_DROP = -.57;
const L1 = .5, L2 = .46;  // upper arm, forearm
const TORSO = [[.41, 1.26], [.49, 1.35], [.535, 1.58], [.555, 1.85], [.555, 2.05], [.5, 2.2], [.36, 2.31], [.22, 2.37]];
const torsoR = (y) => {
  for (let i = 1; i < TORSO.length; i++) if (y <= TORSO[i][1]) { const [r0, y0] = TORSO[i - 1], [r1, y1] = TORSO[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); }
  return TORSO[TORSO.length - 1][0];
};
const PI = Math.PI;

function part(geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return g;
}
const merge = (list) => mergeGeometries(list, false);

// ---------- clear liquid and glass: bright at the edges, see-through in the middle
const GLASS_VS = `
uniform float t; uniform float amp; varying vec3 vV; varying float vD;
float lobes(vec3 p){
  float a = sin(p.x*4.6+t*.6)*sin(p.y*4.1-t*.45+1.3)*sin(p.z*4.9+t*.35+.7);
  float b = sin(p.x*9.7-t*.4+2.)*sin(p.y*8.9+t*.5)*sin(p.z*10.3-t*.3);
  return max(0.,a)*1.5 + max(0.,b)*.55;
}
void main(){
  vec3 n = normalize(position);
  float clear = 1.-smoothstep(.5,.82,abs(n.z))*.92;
  float d = amp*pow(lobes(n*1.25),1.25)*clear*(.72+.28*smoothstep(-.8,.5,n.y));
  vec3 p = position + n*d;
  vD = d;
  vec4 mv = modelViewMatrix*vec4(p,1.);
  vV = -mv.xyz;
  gl_Position = projectionMatrix*mv;
}`;
const GLASS_FS = `
uniform float strength; uniform float cut; varying vec3 vV; varying float vD;
void main(){
  if (vD < cut) discard;
  vec3 V = normalize(vV);
  vec3 N = normalize(cross(dFdx(vV),dFdy(vV)));
  float f = pow(1.-abs(dot(N,V)),1.9);
  vec3 irid = .5+.5*cos(6.283*(f*1.3+vec3(.02,.36,.68)+vV.y*.35));
  vec3 col = mix(vec3(.7,.8,1.),irid,.4)*(.035+f*1.9);
  float spec = pow(max(dot(reflect(-V,N),normalize(vec3(.35,.8,.5))),0.),60.);
  float spec2 = pow(max(dot(reflect(-V,N),normalize(vec3(-.6,.3,.6))),0.),110.);
  gl_FragColor = vec4((col+vec3(spec*1.5+spec2*1.))*strength,1.);
}`;

export function createBotFactory({ tex, loadTex, studio, mirror }) {
  const time = { value: 0 };
  const glassMat = (amp, strength = 1, cut = -1) => new THREE.ShaderMaterial({
    uniforms: { t: time, amp: { value: amp }, strength: { value: strength }, cut: { value: cut } },
    vertexShader: GLASS_VS, fragmentShader: GLASS_FS,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
  });

  // ---------- materials
  const nap = tex((g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 90 + Math.random() * 90 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6); }
  }, 256, 256);
  nap.wrapS = nap.wrapT = THREE.RepeatWrapping; nap.repeat.set(5, 5); nap.colorSpace = THREE.NoColorSpace;
  const fleece = new THREE.MeshPhysicalMaterial({ color: '#111114', roughness: .94, bumpMap: nap, bumpScale: .6, sheen: .7, sheenColor: new THREE.Color('#2e2e38'), sheenRoughness: .6, envMapIntensity: .55 });
  const cargo = new THREE.MeshPhysicalMaterial({ color: '#101013', roughness: .9, bumpMap: nap, bumpScale: .45, sheen: .5, sheenColor: new THREE.Color('#2a2a33'), sheenRoughness: .65, envMapIntensity: .5 });
  const white = new THREE.MeshStandardMaterial({ color: '#f5f5f2', roughness: .55 });
  const glossBlack = new THREE.MeshPhysicalMaterial({ color: '#030308', roughness: .04, clearcoat: 1, clearcoatRoughness: .02, envMap: studio, envMapIntensity: 1.2 });
  const lid = new THREE.MeshPhysicalMaterial({ color: '#050506', roughness: .48, clearcoat: .25, clearcoatRoughness: .4, envMapIntensity: .35 });
  const silver = new THREE.MeshStandardMaterial({ color: '#d4d8de', metalness: 1, roughness: .2, envMap: studio, envMapIntensity: 1.3 });
  const chromeM = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: .04, envMap: mirror, envMapIntensity: 1.25 });
  const cobalt = new THREE.MeshPhysicalMaterial({ color: '#0e26b0', roughness: .15, clearcoat: 1, clearcoatRoughness: .04, envMap: studio, envMapIntensity: .9 });

  // ---------- geometry, shared by all five
  const torso = new THREE.LatheGeometry(TORSO.map(([x, y]) => new THREE.Vector2(x, y)), 28);
  // the kangaroo pocket: a soft panel following the belly, wide at the bottom, slanted openings at the sides
  const pocketGeo = (() => {
    const g = new THREE.PlaneGeometry(1, 1, 18, 8), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) * 2, v = p.getY(i) + .5;
      const y = 1.4 + v * .4, phi = u * (1.02 - v * .42), r = torsoR(y) + .004 + .022 * Math.sin((u * .5 + .5) * PI) * Math.sin(v * PI);
      p.setXYZ(i, Math.sin(phi) * r, y, Math.cos(phi) * r * .72);
    }
    g.computeVertexNormals();
    return g;
  })();
  const hoodieGeo = merge([
    part(torso, [0, 0, 0], [0, 0, 0], [1, 1, .72]),
    part(new THREE.CylinderGeometry(.435, .415, .12, 28), [0, 1.3, 0], [0, 0, 0], [1, 1, .72]),              // ribbed hem
    part(pocketGeo),
    part(new THREE.SphereGeometry(.165, 14, 10), [-.455, 2.12, 0]), part(new THREE.SphereGeometry(.165, 14, 10), [.455, 2.12, 0]), // drop shoulders
    part(new THREE.TorusGeometry(.2, .085, 10, 24), [0, 2.4, .02], [PI / 2, 0, 0]),                          // neck of the hood
    part(new THREE.SphereGeometry(.3, 16, 12), [0, 2.4, -.17], [0, 0, 0], [1.05, .78, .66]),                 // hood gathered behind the neck
    part(new THREE.SphereGeometry(.34, 16, 12), [0, 2.13, -.33], [0, 0, 0], [1.18, 1, .3]),                  // and draped down the back
    part(new THREE.CylinderGeometry(.012, .012, .34, 6), [-.09, 2.15, .365], [.06, 0, 0]),                   // drawstrings
    part(new THREE.CylinderGeometry(.012, .012, .34, 6), [.09, 2.15, .365], [.06, 0, 0]),
  ]);
  const tipGeo = merge([part(new THREE.CylinderGeometry(.014, .014, .05, 8), [-.09, 1.96, .378]), part(new THREE.CylinderGeometry(.014, .014, .05, 8), [.09, 1.96, .378])]);
  const pelvisGeo = part(new THREE.CylinderGeometry(.42, .46, .34, 20), [0, 1.27, 0], [0, 0, 0], [1, 1, .72]);
  const thighGeo = (s) => merge([
    part(new THREE.SphereGeometry(.235, 14, 10)),
    part(new THREE.CylinderGeometry(.235, .215, .6, 16), [0, -.285, 0]),
    part(new RoundedBoxGeometry(.08, .33, .3, 2, .025), [s * .225, -.38, 0]),    // cargo pocket
    part(new RoundedBoxGeometry(.09, .075, .31, 2, .025), [s * .232, -.205, 0]), // and its flap
    part(new RoundedBoxGeometry(.2, .2, .03, 2, .012), [s * .02, -.1, -.215]),   // back pocket
  ]);
  const thighs = { [-1]: thighGeo(-1), 1: thighGeo(1) };
  const shinGeo = merge([
    part(new THREE.SphereGeometry(.215, 14, 10)),
    part(new THREE.CylinderGeometry(.215, .195, .56, 16), [0, -.28, 0]),
    part(new THREE.CylinderGeometry(.205, .212, .07, 16), [0, -.5, 0]),          // stacked at the ankle
    part(new THREE.CylinderGeometry(.2, .207, .05, 16), [0, -.44, 0]),
  ]);
  const laces = [0, 1, 2, 3].map((i) => part(new THREE.BoxGeometry(.17, .014, .022), [0, .012 - i * .024, .04 + i * .07], [.34, 0, 0]));
  const shoeGeo = merge([
    part(new RoundedBoxGeometry(.345, .09, .72, 3, .038), [0, -.155, .09]),
    part(new RoundedBoxGeometry(.3, .17, .62, 4, .075), [0, -.055, .06]),
    part(new THREE.SphereGeometry(.152, 14, 10), [0, -.065, .3], [0, 0, 0], [1, .62, 1.15]),
    part(new THREE.CylinderGeometry(.14, .155, .14, 14), [0, .035, -.09]),
    part(new RoundedBoxGeometry(.14, .11, .06, 2, .02), [0, .05, .05], [.5, 0, 0]),
    ...laces,
  ]);
  const upperArmGeo = part(new THREE.CapsuleGeometry(.152, .34, 4, 10));
  const foreArmGeo = merge([
    part(new THREE.CapsuleGeometry(.132, .32, 4, 10)),
    part(new THREE.CylinderGeometry(.118, .118, .075, 12), [0, -(L2 / 2 - .02), 0]),
    part(new THREE.SphereGeometry(.085, 10, 8), [0, -(L2 / 2 + .06), 0]),
  ]);
  const cupGeo = new THREE.CylinderGeometry(.195, .195, .13, 32);
  const cupRingGeo = new THREE.TorusGeometry(.19, .012, 8, 32);
  const discGeo = new THREE.CircleGeometry(.165, 32);
  const wireGeo = (() => {
    const strand = (o) => {
      const pts = [];
      for (let i = 0; i <= 26; i++) { const u = i / 26, a = u * PI * 7 + o; pts.push(new THREE.Vector3(Math.cos(a) * .014, u * .3, Math.sin(a) * .014)); }
      return part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .008, 4));
    };
    return merge([strand(0), strand(PI)]);
  })();
  const baseGeo = part(new THREE.CylinderGeometry(.03, .055, .05, 12));
  const bulbGeo = new THREE.SphereGeometry(.075, 16, 12);
  const headGeo = new THREE.SphereGeometry(R, 40, 28);
  const decalGeo = new THREE.SphereGeometry(R * 1.006, 40, 28);
  const glassGeo = new THREE.SphereGeometry(R * 1.03, 40, 28);
  const splashGeo = new THREE.IcosahedronGeometry(R * 1.01, 24);
  const dropletsGeo = (() => {
    const list = [];
    for (let i = 0; i < 14; i++) {
      const u = (i * 2.399) % (PI * 2), v = -.1 + (i / 14) * 1.25, rr = R * (1.42 + (i % 3) * .17), sz = .016 + (i % 4) * .012;
      list.push(part(new THREE.SphereGeometry(sz, 10, 8), [Math.cos(u) * rr * Math.cos(v), Math.sin(v) * rr, Math.sin(u) * rr * Math.cos(v)]));
    }
    return merge(list);
  })();
  const chromeHeadGeo = (() => {
    // an egg with a brow, eye hollows, a nose ridge and a chin, so the mirror has something to catch light on
    const g = new THREE.SphereGeometry(.36, 48, 36), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const x = v.x, y = v.y, front = Math.max(0, v.z / .36);
      let z = v.z;
      z += front * .028 * Math.exp(-((x / .06) ** 2) - (((y + .04) / .12) ** 2));                   // nose
      z -= front * .022 * Math.exp(-(((Math.abs(x) - .14) / .1) ** 2) - (((y - .05) / .07) ** 2));  // eye hollows
      z -= front * .018 * Math.exp(-(((Math.abs(x) - .16) / .08) ** 2) - (((y + .15) / .09) ** 2)); // cheeks
      const jaw = y < 0 ? 1 - Math.min(.3, (-y / .36) ** 2 * .3) : 1;                               // narrowing to the chin
      p.setXYZ(i, x * .88 * jaw, y * 1.16, z * .96 * jaw);
    }
    g.computeVertexNormals();
    return g;
  })();
  const neckGeo = new THREE.CylinderGeometry(.11, .15, .24, 16);
  const boxHeadGeo = new RoundedBoxGeometry(.94, .74, .76, 6, .17);
  const boxLidGeo = new RoundedBoxGeometry(.92, .2, .74, 6, .098);
  const smokeTex = tex((g, w, h) => {
    for (let i = 0; i < 9; i++) {
      const x = 34 + Math.random() * 60, y = 34 + Math.random() * 60, r = g.createRadialGradient(x, y, 0, x, y, 30);
      r.addColorStop(0, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    }
  });
  const wispTex = tex((g, w, h) => {
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const y0 = h * (.2 + Math.random() * .6);
      g.strokeStyle = `rgba(255,255,255,${.22 + Math.random() * .4})`; g.lineWidth = 1.5 + Math.random() * 4; g.shadowColor = '#fff'; g.shadowBlur = 12;
      g.beginPath(); g.moveTo(w * .12, y0);
      g.bezierCurveTo(w * (.25 + Math.random() * .2), y0 - h * (.1 + Math.random() * .4), w * (.5 + Math.random() * .2), y0 + h * (.1 + Math.random() * .4), w * .9, h * (.2 + Math.random() * .6));
      g.stroke();
    }
  }, 256, 256);
  const haloTex = tex((g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(.3, 'rgba(255,255,255,.28)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const blackHole = new THREE.MeshBasicMaterial({ color: '#050507' });

  // the official marks, each loaded once
  const shared = {};
  const once = (url) => {
    if (!shared[url]) {
      const s = { t: null, wait: [] }; shared[url] = s;
      loadTex(url, (t) => { s.t = t; s.wait.splice(0).forEach((f) => f(t)); });
    }
    return (cb) => { const s = shared[url]; if (s.t) cb(s.t); else s.wait.push(cb); };
  };
  const decalMat = (url, opts = {}) => {
    const m = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false, opacity: 0, ...opts });
    once(url)((t) => { m.map = t; m.opacity = 1; m.needsUpdate = true; });
    return m;
  };
  const eMark = decalMat('brand/e-mark-white.webp');
  const chestWord = decalMat('brand/emb-expire.webp');
  const chestGlobe = decalMat('brand/emb-eglobe.webp');
  const backPrint = decalMat('brand/explore-back.webp', { blending: THREE.AdditiveBlending, transparent: true });

  // ---------- faces: drawn once on a wrap-around canvas with expire on the back of the head
  const face = (expr, ghost) => tex((g, w, h) => {
    const cx = w * .25, ey = h * .455;
    const draw = (dx, color, blur) => {
      g.fillStyle = g.strokeStyle = color; g.shadowColor = color; g.shadowBlur = blur; g.lineWidth = 15; g.lineCap = 'round';
      if (expr === 'b') { g.fillRect(cx - 104 + dx, ey - 6, 62, 12); g.fillRect(cx + 42 + dx, ey - 6, 62, 12); }
      else { g.beginPath(); g.arc(cx - 72 + dx, ey, 31, 0, 7); g.fill(); g.beginPath(); g.arc(cx + 72 + dx, ey, 31, 0, 7); g.fill(); }
      g.beginPath();
      if (expr === 'h') g.arc(cx + dx, ey + 24, 92, .1 * PI, .9 * PI); else g.arc(cx + dx, ey + 8, 104, .24 * PI, .76 * PI);
      g.stroke();
    };
    if (ghost) { g.globalCompositeOperation = 'lighter'; draw(-6, '#ff2d55', 10); draw(6, '#00e5ff', 10); }
    draw(0, '#ffffff', 26);
    g.shadowBlur = 8; g.shadowColor = '#fff'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 66px "Helvetica Neue",Helvetica,Arial,sans-serif'; g.fillText('expire', w * .75, h * .5);
  }, 1024, 512);
  const FACES = { n: face('n'), b: face('b'), h: face('h') };
  const GLITCH_FACES = { n: face('n', true), b: face('b', true), h: face('h', true) };

  const boxFace = (expr) => tex((g, w, h) => {
    g.fillStyle = g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 18; g.lineWidth = 13; g.lineCap = 'round';
    if (expr === 'b') { g.fillRect(84, 96, 62, 10); g.fillRect(226, 96, 62, 10); } else { g.beginPath(); g.arc(115, 98, 25, 0, 7); g.arc(257, 98, 25, 0, 7); g.fill(); }
    g.beginPath(); if (expr === 'h') g.arc(186, 150, 74, .12 * PI, .88 * PI); else g.arc(186, 132, 88, .26 * PI, .74 * PI); g.stroke();
  }, 372, 280);
  const BOX_FACES = { n: boxFace('n'), b: boxFace('b'), h: boxFace('h') };
  const boxWord = tex((g, w, h) => {
    g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 96px "Helvetica Neue",Helvetica,Arial,sans-serif'; g.fillText('expire', w / 2, h / 2);
  }, 420, 140);

  const smokyInside = tex((g, w, h) => {
    g.fillStyle = '#05081a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = g.createRadialGradient(x, y, 0, x, y, 70 + Math.random() * 60);
      r.addColorStop(0, 'rgba(120,150,255,.22)'); r.addColorStop(1, 'rgba(120,150,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    }
    const c = ['#ffffff', '#38bdf8', '#2563ff', '#ff5a8a', '#a78bfa'];
    for (let i = 0; i < 220; i++) { g.fillStyle = c[i % c.length]; g.globalAlpha = .25 + Math.random() * .7; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 9, 1.5 + Math.random() * 4); }
    g.globalAlpha = 1;
  }, 512, 256);

  const GLITCH_COLORS = ['#ff2d55', '#00e5ff', '#2563ff', '#ff00d4', '#ffffff', '#22ff88', '#ffb300'].map((c) => new THREE.Color(c));
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const glitchMat = new THREE.MeshBasicMaterial({ toneMapped: false });

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  // ---------- one agent
  function make(kind) {
    const G = new THREE.Group(), body = new THREE.Group(); G.add(body);
    const shadow = (m) => { m.castShadow = true; return m; };
    body.add(shadow(new THREE.Mesh(hoodieGeo, fleece)));
    body.add(shadow(new THREE.Mesh(pelvisGeo, cargo)));
    body.add(new THREE.Mesh(tipGeo, silver));

    // chest and back marks
    const chest = new THREE.Mesh(new THREE.PlaneGeometry(kind === 'chrome' ? .2 : .25, kind === 'chrome' ? .2 : .078), kind === 'chrome' ? chestGlobe : chestWord);
    chest.position.set(.235, 2.03, .375); chest.rotation.y = .36; chest.renderOrder = 2; body.add(chest);
    if (kind === 'chrome') {
      const back = new THREE.Mesh(new THREE.PlaneGeometry(.72, .9), backPrint);
      back.position.set(0, 1.74, -.44); back.rotation.y = PI; back.renderOrder = 2; body.add(back);
    }

    // legs
    const legs = {};
    for (const s of [-1, 1]) {
      const thigh = new THREE.Group(); thigh.position.set(s * .225, HIP_Y, 0); body.add(thigh);
      thigh.add(shadow(new THREE.Mesh(thighs[s], cargo)));
      const shin = new THREE.Group(); shin.position.y = -THIGH; thigh.add(shin);
      shin.add(shadow(new THREE.Mesh(shinGeo, cargo)));
      const shoe = shadow(new THREE.Mesh(shoeGeo, white)); shoe.position.y = -SHIN; shin.add(shoe);
      legs[s] = { thigh, shin };
    }

    // arms: placed by two-bone IK each frame, so a pose is just where the hand wants to be
    const arms = {};
    for (const s of [-1, 1]) {
      const upper = shadow(new THREE.Mesh(upperArmGeo, fleece)), fore = shadow(new THREE.Mesh(foreArmGeo, fleece));
      body.add(upper, fore);
      arms[s] = { upper, fore, S: new THREE.Vector3(s * .445, 2.15, 0), hand: new THREE.Vector3(s * .3, 1.57, .22), pole: new THREE.Vector3(s * .6, -.2, -.6) };
    }

    // head
    const H = new THREE.Group(); H.position.y = HEAD_Y; body.add(H);
    const st = { sit: 0, wave: 0, face: 'n', lastGlitch: 0, jitter: [] };
    let decal = null, setFace = () => {}, bulbMat = null, halo = null, tickKind = () => {};

    function earCups(x0) {
      for (const s of [-1, 1]) {
        const cup = shadow(new THREE.Mesh(cupGeo, lid)); cup.rotation.z = PI / 2; cup.position.set(s * x0, -.01, 0); H.add(cup);
        const ring = new THREE.Mesh(cupRingGeo, silver); ring.rotation.y = PI / 2; ring.position.set(s * (x0 + .066), -.01, 0); H.add(ring);
        const disc = new THREE.Mesh(discGeo, blackHole); disc.position.set(s * (x0 + .067), -.01, 0); disc.rotation.y = s * PI / 2; H.add(disc);
        const mark = new THREE.Mesh(discGeo, eMark); mark.scale.setScalar(.92); mark.position.set(s * (x0 + .069), -.01, 0); mark.rotation.y = s * PI / 2; H.add(mark);
      }
    }
    function antenna(y0, color) {
      const base = new THREE.Mesh(baseGeo, lid); base.position.y = y0; H.add(base);
      const wire = new THREE.Mesh(wireGeo, silver); wire.position.y = y0 + .02; H.add(wire);
      bulbMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2, toneMapped: false, transparent: true, opacity: .96 });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat); bulb.position.y = y0 + .36; H.add(bulb);
      halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .8 }));
      halo.scale.setScalar(.46); halo.position.y = y0 + .36; H.add(halo);
    }

    if (kind === 'liquid' || kind === 'glitch' || kind === 'smoke') {
      const set = kind === 'glitch' ? GLITCH_FACES : FACES;
      if (kind === 'smoke') {
        H.add(new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ map: smokyInside })));
        H.children[0].scale.setScalar(.97);
      } else {
        H.add(shadow(new THREE.Mesh(headGeo, glossBlack)));
      }
      decal = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ map: set.n, transparent: true, toneMapped: false, depthWrite: false }));
      H.add(decal);
      setFace = (k) => { decal.material.map = set[k]; };
      earCups(R + .025);
      antenna(R - .02, kind === 'glitch' ? '#ff66cc' : '#dbe6ff');
    }

    if (kind === 'liquid') {
      const skin = new THREE.Mesh(glassGeo, glassMat(0, .55)); skin.renderOrder = 3; H.add(skin);
      const splash = new THREE.Mesh(splashGeo, glassMat(.36, .85, .022)); splash.renderOrder = 3; H.add(splash);
      const drops = new THREE.Mesh(dropletsGeo, glassMat(0, 1.25)); drops.renderOrder = 3; H.add(drops);
      tickKind = (t) => { drops.rotation.y = t * .22; drops.position.y = Math.sin(t * .9) * .025; };
    }
    if (kind === 'smoke') {
      const glass = new THREE.Mesh(glassGeo, glassMat(0, .95)); glass.renderOrder = 3; H.add(glass);
      const puffs = [];
      for (let i = 0; i < 22; i++) {
        const haze = i < 6;
        const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: haze ? smokeTex : wispTex, color: '#b9c8ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
        m.userData = { haze, ph: Math.random(), r: R * (haze ? 1 : 1.05 + Math.random() * .4), a: Math.random() * 6.28, sp: .09 + Math.random() * .1, y0: -R * .9 + Math.random() * R, sz: haze ? .55 : .5 + Math.random() * .4 };
        m.renderOrder = 4; H.add(m); puffs.push(m);
      }
      tickKind = (t) => {
        for (const m of puffs) {
          const u = m.userData, k = (t * u.sp + u.ph) % 1, a = u.a + t * .5;
          m.position.set(Math.cos(a) * u.r * (1 + k * .2), u.y0 + k * .95, Math.sin(a) * u.r * (1 + k * .2));
          const sc = u.sz * (.8 + k * .6); m.scale.set(sc, sc, 1); m.material.rotation = a * 1.3;
          m.material.opacity = Math.sin(k * PI) * (u.haze ? .22 : .72);
        }
      };
    }
    if (kind === 'glitch') {
      const n = 170, shards = new THREE.InstancedMesh(unit, glitchMat, n), mat = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      const put = (i, strong) => {
        let lat, lon, tries = 0;
        do { lat = (Math.random() - .5) * 2.9; lon = Math.random() * 6.283; tries++; } while (tries < 8 && Math.abs(Math.cos(lat) * Math.sin(lon)) > .62);
        const rr = R * (1.0 + Math.random() * (strong ? .3 : .06));
        pos.set(Math.cos(lat) * Math.cos(lon) * rr, Math.sin(lat) * rr, Math.cos(lat) * Math.sin(lon) * rr);
        q.setFromUnitVectors(tmpA.set(0, 0, 1), tmpB.copy(pos).setY(0).normalize());
        sc.set(.02 + Math.random() * Math.random() * .2, .012 + Math.random() * .036, .01);
        mat.compose(pos, q, sc); shards.setMatrixAt(i, mat);
        shards.setColorAt(i, GLITCH_COLORS[(Math.random() * GLITCH_COLORS.length) | 0]);
      };
      for (let i = 0; i < n; i++) put(i, i % 3 === 0);
      H.add(shards);
      tickKind = (t) => {
        if (t - st.lastGlitch < .085) return;
        st.lastGlitch = t;
        for (let i = 0; i < 34; i++) put((Math.random() * n) | 0, Math.random() < .35);
        shards.instanceMatrix.needsUpdate = true; if (shards.instanceColor) shards.instanceColor.needsUpdate = true;
        decal.position.x = Math.random() < .12 ? (Math.random() - .5) * .03 : 0;
        const c = new THREE.Color().setHSL((t * .35) % 1, 1, .62);
        bulbMat.color.copy(c); bulbMat.emissive.copy(c); halo.material.color.copy(c);
      };
    }
    if (kind === 'box') {
      H.add(shadow(new THREE.Mesh(boxHeadGeo, cobalt)));
      const top = shadow(new THREE.Mesh(boxLidGeo, lid)); top.position.y = .305; H.add(top);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(.78, .587), new THREE.MeshBasicMaterial({ map: BOX_FACES.n, transparent: true, toneMapped: false, depthWrite: false }));
      f.position.set(0, -.05, .382); H.add(f);
      setFace = (k) => { f.material.map = BOX_FACES[k]; };
      const w = new THREE.Mesh(new THREE.PlaneGeometry(.56, .187), new THREE.MeshBasicMaterial({ map: boxWord, transparent: true, toneMapped: false, depthWrite: false }));
      w.position.set(0, -.04, -.382); w.rotation.y = PI; H.add(w);
      earCups(.52);
      antenna(.39, '#3dff8a');
    }
    if (kind === 'chrome') {
      H.position.y = HEAD_Y + .06;
      H.add(shadow(new THREE.Mesh(chromeHeadGeo, chromeM)));
      const neck = new THREE.Mesh(neckGeo, chromeM); neck.position.y = -.44; H.add(neck);
    }

    function solveArm(a, s, hand, pole) {
      // shoulder to hand, elbow pushed toward the pole
      tmpA.subVectors(hand, a.S); let d = tmpA.length();
      const max = L1 + L2 - .002; if (d > max) { tmpA.multiplyScalar(max / d); d = max; }
      const dir = tmpB.copy(tmpA).normalize();
      const along = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - along * along));
      tmpC.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
      const E = tmpD.copy(a.S).addScaledVector(dir, along).addScaledVector(tmpC, h);
      a.upper.position.addVectors(a.S, E).multiplyScalar(.5);
      a.upper.quaternion.setFromUnitVectors(UP, tmpA.copy(a.S).sub(E).normalize());
      const handEnd = tmpC.copy(a.S).add(tmpB.multiplyScalar(d));
      a.fore.position.addVectors(E, handEnd).multiplyScalar(.5);
      a.fore.quaternion.setFromUnitVectors(UP, tmpA.copy(E).sub(handEnd).normalize());
    }

    const want = new THREE.Vector3(), wantPole = new THREE.Vector3();

    // called every frame with what the agent is really doing
    function pose({ t, dt, moving, phase, view, happy, activity }) {
      const act = moving ? null : activity;
      const seated = (view === 'working' || view === 'quiet' || !!act) && !moving;
      const ease = Math.min(1, dt * 6);
      st.sit += ((seated ? 1 : 0) - st.sit) * ease;
      const waving = view === 'waiting' && !moving;
      st.wave += ((waving ? 1 : 0) - st.wave) * ease;

      for (const s of [-1, 1]) {
        const swing = moving ? -s * Math.sin(phase) * .55 : 0;
        const knee = moving ? Math.max(0, s * Math.cos(phase)) * .95 + .08 : 0;
        const leg = legs[s];
        const targetT = swing * (1 - st.sit) - (PI / 2) * st.sit;
        const targetK = knee * (1 - st.sit) + (PI / 2) * st.sit;
        leg.thigh.rotation.x += (targetT - leg.thigh.rotation.x) * Math.min(1, dt * 14);
        leg.shin.rotation.x += (targetK - leg.shin.rotation.x) * Math.min(1, dt * 14);

        const a = arms[s];
        const typing = view === 'working' && st.sit > .55;
        if (act && st.sit > .55) {
          // off the clock at the long table; the props in scene.js sit where these hands land
          if (act === 'laptop') want.set(s * .17, 1.83 + Math.sin(t * 9 + s * 1.7) * .01, .66);
          else if (act === 'tablet') want.set(s * .2, 2.05, .5);
          else if (act === 'phone') { if (s === 1) want.set(.08, 2.1 + Math.sin(t * .8) * .01, .44); else want.set(-.3, 1.83, .62); }
          else if (act === 'writing') { if (s === 1) want.set(.12 + Math.sin(t * 2.4) * .07, 1.84, .76 + Math.sin(t * 7) * .012); else want.set(-.22, 1.82, .72); }
          else { // eating: fork from the plate to the mouth and back
            const lift = Math.max(0, Math.sin(t * .9 + phase)) ** 2;
            if (s === 1) want.set(.14 - lift * .08, 1.84 + lift * .72, .74 - lift * .4); else want.set(-.24, 1.82, .68);
          }
          wantPole.set(s * .6, -1, -.25);
        } else if (typing) {
          want.set(s * .17, 1.83 + Math.sin(t * 13 + s * 1.7) * .012, .66 + Math.sin(t * 7 + s) * .012);
          wantPole.set(s * .6, -1, -.25);
        } else if (waving && s === 1) {
          want.set(.66 + Math.sin(t * 5) * .1, 2.72, .14);
          wantPole.set(.9, -.6, -.3);
        } else {
          want.set(s * .3, 1.57, .22); // hands in the pocket, as in the photos
          wantPole.set(s * .6, -.2, -.6);
        }
        a.hand.lerp(want, Math.min(1, dt * 9)); a.pole.lerp(wantPole, Math.min(1, dt * 9));
        solveArm(a, s, a.hand, a.pole);
      }
      const stand = moving ? Math.abs(Math.cos(phase)) * .05 : Math.sin(t * 2 + phase) * .012;
      body.position.y = stand * (1 - st.sit) + SEAT_DROP * st.sit;
      body.rotation.y = moving ? Math.sin(phase) * .05 : 0;
      body.rotation.x = moving ? .03 : 0;

      H.rotation.z = moving ? 0 : Math.sin(t * 1.2 + phase) * .04;
      H.rotation.x = moving ? Math.sin(phase * 2) * .025 : (view === 'quiet' ? .26 : view === 'working' ? .08 : act === 'eating' ? .1 : act ? .28 : 0);

      if (setFace) {
        const next = happy ? 'h' : ((t + phase) % 4 < .12 ? 'b' : 'n');
        if (next !== st.face) { st.face = next; setFace(next); }
      }
      if (bulbMat) {
        const glow = view === 'working' ? 1.6 + Math.sin(t * 6 + phase) * 1.1 : view === 'waiting' ? 1.6 + Math.sin(t * 3) * 1.4 : .75;
        bulbMat.emissiveIntensity = glow; halo.material.opacity = Math.min(1, .25 + glow * .32);
      }
      tickKind(t, dt);
    }

    return { G, body, H, kind, pose, seat: st, rightHand: arms[1].hand };
  }

  return { make, tick: (t) => { time.value = t; } };
}
