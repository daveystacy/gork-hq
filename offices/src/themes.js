// What makes each office its own place. The room, desks and team are shared (scene.js);
// each office gets its own set piece in the open floor (x -0.5..7.2, z 1..6.4), facing the camera (+z).
// Every theme returns the floor it blocks (so the bots walk around it) and an optional animation tick.
// Decor shows no prices, balances or mint counts: the only numbers in an office are real ones.

const FELT = '#0f5132';

// ---------- small shared pieces

function sofa(k, x, z, color, w = 4) {
  const m = k.M(color, { roughness: .9 });
  k.box(w, .5, 1.2, m, x, .4, z);
  k.box(w, .9, .35, m, x, .8, z + .55);
  k.box(.35, .7, 1.2, m, x - w / 2 - .17, .6, z);
  k.box(.35, .7, 1.2, m, x + w / 2 + .17, .6, z);
  return [x - w / 2 - .4, z - .65, x + w / 2 + .4, z + .8];
}

function lowTable(k, x, z, w = 1.6, d = .9, color = '#26262e') {
  k.box(w, .35, d, k.M(color, { roughness: .35 }), x, .25, z);
  return [x - w / 2, z - d / 2, x + w / 2, z + d / 2];
}

function neonSign(k, text, color, x, y, z, w = 4, rotY = 0) {
  const h = w / 4;
  const map = k.tex((g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.font = `700 ${Math.round(H * .56)}px "Helvetica Neue",Helvetica,Arial,sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 26; g.fillStyle = color;
    g.fillText(text, W / 2, H / 2); g.fillText(text, W / 2, H / 2);
    g.shadowBlur = 0; g.fillStyle = '#fff'; g.globalAlpha = .75; g.fillText(text, W / 2, H / 2);
  }, 1024, 256);
  const p = new k.THREE.Mesh(new k.THREE.PlaneGeometry(w, h), new k.THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false, depthWrite: false }));
  p.position.set(x, y, z); p.rotation.y = rotY; k.scene.add(p);
  return p;
}

// ---------- GAME: an arcade of the real games, a sofa to play from, the campus on the meeting table

function arcade(k, name, color, x, z) {
  const THREE = k.THREE;
  const body = k.M('#101014', { roughness: .4 });
  const trim = k.M(color, { emissive: color, emissiveIntensity: .8 });
  k.box(1.25, 2.3, .95, body, x, 1.15, z);
  k.box(.04, 2.3, .96, trim, x - .63, 1.15, z);
  k.box(.04, 2.3, .96, trim, x + .63, 1.15, z);
  k.box(1.25, .1, .5, k.M('#1a1a20', { roughness: .4 }), x, 1.02, z + .66);
  for (let i = 0; i < 3; i++) k.cyl(.04, .04, .04, 12, k.M(i === 1 ? '#fff' : color, { emissive: color, emissiveIntensity: .6 }), x - .28 + i * .28, 1.09, z + .72);
  k.cyl(.02, .02, .16, 8, k.M('#555'), x + .42, 1.14, z + .6);
  const map = k.tex((g, W, H) => {
    g.fillStyle = '#05070d'; g.fillRect(0, 0, W, H);
    const cell = 24;
    for (let i = 0; i < W / cell; i++) for (let j = 0; j < H / cell; j++) {
      const n = Math.sin(i * 12.9898 + j * 78.233 + name.length) * 43758.5453, r = n - Math.floor(n);
      if (r > .86 && j > 5) { g.fillStyle = color; g.globalAlpha = .25 + r * .5; g.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4); }
    }
    g.globalAlpha = 1; g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = '700 46px ui-monospace,Menlo,monospace'; g.shadowColor = color; g.shadowBlur = 18;
    g.fillText(name, W / 2, 96); g.shadowBlur = 0;
  }, 512, 400);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.02, .8), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
  scr.position.set(x, 1.62, z + .56); scr.rotation.x = -.16; k.scene.add(scr);
  const light = new THREE.PointLight(color, 3, 3.2); light.position.set(x, 1.5, z + 1.1); k.scene.add(light);
}

function gamey(k) {
  const games = [['expireverse', '#38bdf8'], ['ExpireRoyale', '#f97316'], ['ExpireBattles', '#ef4444'], ['ExpireVille', '#22c55e']];
  games.forEach(([n, c], i) => arcade(k, n, c, .75 + i * 1.8, 1.55));
  const blocked = [[.05, 1.05, 6.85, 2.3], sofa(k, 3.4, 5.5, '#14304f'), lowTable(k, 3.4, 4)];
  // a wireframe campus turning over the meeting table (the ECA is this office's next build)
  const THREE = k.THREE, holo = new THREE.Group();
  const wire = new THREE.MeshBasicMaterial({ color: k.accent, wireframe: true, transparent: true, opacity: .55, toneMapped: false });
  [[0, .35, 0, .7, .7, .7], [-.65, .2, .25, .45, .4, .45], [.6, .25, -.3, .4, .5, .5], [.15, .15, .7, .6, .3, .3], [-.3, .15, -.65, .55, .3, .35]].forEach(([x, y, z, w, h, d]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wire); b.position.set(x, y, z); holo.add(b);
  });
  holo.position.set(0, 1.75, -2.1); k.scene.add(holo);
  return { blocked, spots: [[1, 3.3], [5.9, 3.4], [.4, 4.9], [6.6, 5.2]], tick: (t) => { holo.rotation.y = t * .25; } };
}

// ---------- TRADE: a wall of chart art (no prices on it), lounge chairs, gold on the table

function candleArt(seed, up, down) {
  return (g, W, H) => {
    g.fillStyle = '#07090f'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(0, i * H / 5); g.lineTo(W, i * H / 5); g.stroke(); }
    let v = H * .55, s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const n = 26, cw = W / n;
    for (let i = 0; i < n; i++) {
      const o = v, c = Math.max(H * .12, Math.min(H * .88, v + (rnd() - .54) * H * .16));
      const hi = Math.min(o, c) - rnd() * H * .05, lo = Math.max(o, c) + rnd() * H * .05;
      g.strokeStyle = g.fillStyle = c < o ? up : down; g.lineWidth = 2;
      g.beginPath(); g.moveTo(i * cw + cw / 2, hi); g.lineTo(i * cw + cw / 2, lo); g.stroke();
      g.fillRect(i * cw + cw * .2, Math.min(o, c), cw * .6, Math.max(3, Math.abs(c - o)));
      v = c;
    }
  };
}

function tradey(k) {
  const THREE = k.THREE;
  k.box(6.8, 2.9, .22, k.M('#0a0a0d', { roughness: .5 }), 3.4, 1.55, 1.45);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const map = k.tex(candleArt(r * 3 + c + 2, '#22c55e', '#ef4444'), 512, 300);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 1.2), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
    s.position.set(1.2 + c * 2.2, .93 + r * 1.3, 1.57); k.scene.add(s);
  }
  k.box(3.5, .74, .1, k.M('#0a0a0d', { roughness: .5 }), 3.4, 3.36, 1.45);
  neonSign(k, 'expiretrade', k.accent, 3.4, 3.36, 1.52, 2.9);
  const glow = new THREE.PointLight('#d4af37', 3.5, 6); glow.position.set(3.4, 2, 2.6); k.scene.add(glow);
  const leather = k.M('#2a1d0d', { roughness: .55 });
  const chair = (x) => { k.box(1.3, .45, 1.1, leather, x, .38, 5.2); k.box(1.3, .85, .28, leather, x, .75, 5.7); return [x - .7, 4.6, x + .7, 5.9]; };
  const blocked = [[.0, 1.3, 6.8, 1.6], chair(1.5), chair(5.3), lowTable(k, 3.4, 4.4, 1.9, 1)];
  const gold = k.M('#d4af37', { metalness: 1, roughness: .28 });
  [[-.34, 0], [.02, 0], [.38, 0], [-.16, .001], [.2, .001]].forEach(([dx, up], i) => k.box(.32, .13, .62, gold, 3.4 + dx, .49 + (i > 2 ? .135 : 0) + up, 4.4));
  return { blocked, spots: [[.6, 3.2], [6.3, 3.2], [3.4, 3], [3.4, 6]] };
}

// ---------- NFT: a gallery of the real collection art on the back wall and one big wall in the room

function framed(k, url, w, h, x, y, z, frame = '#17171c') {
  const THREE = k.THREE;
  k.box(w + .14, h + .14, .08, k.M(frame, { roughness: .35, metalness: .4 }), x, y, z - .05);
  const mat = new THREE.MeshBasicMaterial({ color: '#333', toneMapped: false });
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  art.position.set(x, y, z); k.scene.add(art);
  k.loadTex(url, (t) => { mat.map = t; mat.color.set('#fff'); mat.needsUpdate = true; });
}

function arty(k) {
  const THREE = k.THREE;
  const wallArt = [['art/punks.webp', 3.04], ['art/punk-a.webp', 1.9], ['art/nfts.webp', 3.04], ['art/punk-b.webp', 1.9], ['art/mints-machines.webp', 3.38]];
  wallArt.forEach(([u, w], i) => {
    framed(k, u, w, 1.9, -7.5 + i * 3.8, 2.8, -6.78);
    const lamp = k.M('#fff', { emissive: '#fff', emissiveIntensity: 1.4 });
    k.box(Math.min(w, 2.2), .03, .06, lamp, -7.5 + i * 3.8, 3.98, -6.72);
  });
  // the big wall: ExpireBings, on a freestanding panel
  k.box(5.1, 3.15, .22, k.M('#0b0b0e', { roughness: .5 }), 3.4, 1.7, 1.45);
  framed(k, 'art/expirebings.webp', 4.8, 2.7, 3.4, 1.72, 1.6, '#26262c');
  const spot = new THREE.PointLight('#fff', 3, 5); spot.position.set(3.4, 2.4, 3); k.scene.add(spot);
  const bench = k.M('#2e2547', { roughness: .8 });
  const seat = (x) => { k.box(2.1, .42, .7, bench, x, .36, 4.4); return [x - 1.05, 4.05, x + 1.05, 4.75]; };
  const coinMat = new THREE.MeshStandardMaterial({ color: '#d7dbe2', metalness: 1, roughness: .2 });
  const faceMat = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
  k.eglobeTex((t) => { faceMat.map = t; faceMat.needsUpdate = true; });
  const coin = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .1, 48), coinMat); rim.rotation.x = Math.PI / 2; coin.add(rim);
  for (const s of [1, -1]) { const f = new THREE.Mesh(new THREE.CircleGeometry(.48, 48), faceMat); f.position.z = s * .056; if (s < 0) f.rotation.y = Math.PI; coin.add(f); }
  coin.position.set(6.4, 2.05, 5.5); k.scene.add(coin);
  k.cyl(.42, .5, 1.3, 24, k.M('#18181d', { roughness: .4 }), 6.4, .65, 5.5);
  return {
    blocked: [[.85, 1.3, 5.95, 1.65], seat(1.9), seat(4.7), [5.9, 5, 6.9, 6]],
    spots: [[.5, 3], [6.4, 3.2], [3.3, 5.7], [.6, 5.6]],
    tick: (t) => { coin.rotation.y = t * .6; },
  };
}

// ---------- CASINO: poker on the meeting table, slots and a turning roulette wheel

function slot(k, x, z, color) {
  const THREE = k.THREE;
  k.box(1.15, 2.2, .85, k.M('#16080c', { roughness: .4 }), x, 1.1, z);
  k.box(1.15, .32, .9, k.M(color, { emissive: color, emissiveIntensity: 1.1 }), x, 2.26, z);
  const map = k.tex((g, W, H) => {
    g.fillStyle = '#fff6e6'; g.fillRect(0, 0, W, H);
    const syms = ['♠', '♥', '♦'];
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 92px Georgia,serif';
    syms.forEach((c, i) => { g.fillStyle = c === '♠' ? '#111' : '#c81e3a'; g.fillText(c, W * (i + .5) / 3, H / 2 + 4); if (i) { g.fillStyle = '#d9c9a6'; g.fillRect(W * i / 3 - 2, 0, 4, H); } });
  }, 384, 180);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(.95, .46), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
  s.position.set(x, 1.5, z + .43); k.scene.add(s);
  k.box(.95, .08, .34, k.M('#2a0f15'), x, .96, z + .55);
}

function betty(k) {
  const THREE = k.THREE;
  ['#f43f5e', '#f59e0b', '#a855f7', '#f43f5e'].forEach((c, i) => slot(k, .9 + i * 1.72, 1.55, c));
  k.box(3.6, .86, .08, k.M('#0a0508', { roughness: .4 }), 3.4, 3.1, 1.2);
  for (const x of [1.8, 5]) k.cyl(.03, .03, .8, 8, k.M('#222'), x, 2.45, 1.2);
  neonSign(k, 'betexpire', '#fb7185', 3.4, 3.1, 1.26, 3.4);
  // roulette table
  k.box(3.4, .9, 1.7, k.M('#1a0d09', { roughness: .4 }), 3.4, .45, 4.6);
  k.box(3.3, .03, 1.6, k.M(FELT, { roughness: .95 }), 3.4, .915, 4.6);
  const sectors = k.tex((g, W, H) => {
    const n = 37, cx = W / 2, cy = H / 2, R = W / 2;
    for (let i = 0; i < n; i++) {
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, i / n * 6.2832, (i + 1) / n * 6.2832); g.closePath();
      g.fillStyle = i === 0 ? '#0f7a45' : i % 2 ? '#a50f23' : '#101010'; g.fill();
    }
    g.fillStyle = '#7a5a2a'; g.beginPath(); g.arc(cx, cy, R * .5, 0, 7); g.fill();
    g.fillStyle = '#c9a14f'; g.beginPath(); g.arc(cx, cy, R * .16, 0, 7); g.fill();
  }, 512, 512);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.62, .66, .1, 48), [k.M('#3a2510'), new THREE.MeshStandardMaterial({ map: sectors, roughness: .3 }), k.M('#3a2510')]);
  wheel.position.set(2.5, 1.0, 4.6); wheel.castShadow = true; k.scene.add(wheel);
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(.68, .05, 10, 48), k.M('#8a6a30', { metalness: .8, roughness: .3 }));
  rimRing.rotation.x = Math.PI / 2; rimRing.position.set(2.5, 1.02, 4.6); k.scene.add(rimRing);
  // the betting layout
  const layout = k.tex((g, W, H) => {
    g.fillStyle = FELT; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#e8e2c8'; g.lineWidth = 3;
    for (let c = 0; c < 8; c++) for (let r = 0; r < 3; r++) { g.fillStyle = (c + r) % 2 ? '#a50f23' : '#101010'; g.fillRect(8 + c * 60, 8 + r * 44, 56, 40); g.strokeRect(8 + c * 60, 8 + r * 44, 56, 40); }
  }, 496, 148);
  const lay = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .52), new THREE.MeshStandardMaterial({ map: layout, roughness: .8 }));
  lay.rotation.x = -Math.PI / 2; lay.position.set(4, .935, 4.6); k.scene.add(lay);
  const redGlow = new THREE.PointLight('#f43f5e', 3, 6); redGlow.position.set(3.4, 2.4, 3); k.scene.add(redGlow);
  // chips on the poker table (the long table at 0, -2.1)
  const chip = (c, x, z, n) => { for (let i = 0; i < n; i++) k.cyl(.11, .11, .035, 20, k.M(c, { roughness: .4 }), x, 1.07 + i * .037, z); };
  chip('#c81e3a', -1.2, -2.2, 5); chip('#111', -.4, -2, 4); chip('#e8e2c8', .4, -2.2, 6); chip('#1d4ed8', 1.2, -2, 3);
  return { blocked: [[.2, 1.05, 6.65, 2.1], [1.65, 3.7, 5.15, 5.5]], spots: [[.6, 3], [6.4, 3], [.6, 5.6], [6.4, 5.6], [3.4, 6.1]], tick: (t) => { wheel.rotation.y = t * .5; } };
}

// ---------- SHOP: garment rails, two mannequins in the uniform, a cash desk. Plain decor, no logos, no product art.

function hoodieOn(k, x, y, z, color) {
  const THREE = k.THREE;
  const m = k.M(color, { roughness: .95 });
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new k.Rounded(.62, .78, .2, 3, .08), m); g.add(torso);
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .56, 4, 8), m); a.position.set(s * .38, -.08, 0); a.rotation.z = s * .09; g.add(a); }
  const hood = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8, 0, Math.PI * 2, 0, 1.7), m); hood.position.set(0, .4, -.03); hood.scale.z = .6; g.add(hood);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.set(x, y, z); k.scene.add(g);
}

function rail(k, x0, x1, z, colors) {
  const steel = k.M('#c8ccd2', { metalness: 1, roughness: .25 });
  const y = 2.45;
  const pipe = k.cyl(.03, .03, x1 - x0, 12, steel, (x0 + x1) / 2, y, z); pipe.rotation.z = Math.PI / 2;
  for (const x of [x0, x1]) { k.cyl(.03, .03, y, 12, steel, x, y / 2, z); k.box(.08, .03, .7, steel, x, .02, z); }
  const step = (x1 - x0 - .5) / Math.max(1, colors.length - 1);
  colors.forEach((c, i) => hoodieOn(k, x0 + .25 + i * step, y - .55, z, c));
}

function mannequin(k, x, z, hood) {
  k.cyl(.55, .6, .14, 32, k.M('#d8d8dc', { roughness: .3, metalness: .2 }), x, .07, z);
  const m = k.M(hood, { roughness: .95 }), p = k.M('#0d0d10', { roughness: .85 }), s = k.M('#f3f3f3', { roughness: .5 });
  const torso = k.cyl(.33, .4, .95, 16, m, x, 1.55, z); torso.scale.z = .68;
  k.cyl(.11, .13, .1, 12, k.M('#c9c9cd', { roughness: .4 }), x, 2.08, z);
  for (const d of [-1, 1]) {
    k.cyl(.1, .09, .9, 10, m, x + d * .42, 1.5, z);
    k.cyl(.14, .12, 1, 10, p, x + d * .18, .68, z);
    k.box(.24, .14, .46, s, x + d * .18, .22, z + .06);
  }
}

function story(k) {
  const THREE = k.THREE;
  rail(k, .1, 3.1, 1.55, ['#141418', '#141418', '#2b2b31', '#e6e6ea', '#141418']);
  rail(k, 3.7, 6.7, 1.55, ['#e6e6ea', '#141418', '#3a3a42', '#141418', '#141418']);
  const led = k.M('#fff', { emissive: '#fff', emissiveIntensity: 1.6 });
  k.box(3, .02, .02, led, 1.6, 2.72, 1.55); k.box(3, .02, .02, led, 5.2, 2.72, 1.55);
  mannequin(k, 1.2, 4.1, '#141418'); mannequin(k, 3.1, 4.1, '#e6e6ea');
  k.box(2.4, 1.05, .8, k.M('#111114', { roughness: .25, metalness: .3 }), 5.6, .53, 5.2);
  k.box(2.46, .05, .86, k.M('#e8e8ee', { roughness: .2 }), 5.6, 1.07, 5.2);
  const globe = new THREE.Mesh(new THREE.PlaneGeometry(.55, .55), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
  globe.position.set(5.6, .55, 5.61); k.scene.add(globe);
  k.eglobeTex((t) => { globe.material.map = t; globe.material.needsUpdate = true; });
  const wash = new THREE.PointLight('#fff4e6', 4, 7); wash.position.set(3.2, 3, 3); k.scene.add(wash);
  return { blocked: [[.0, 1.2, 3.2, 1.9], [3.6, 1.2, 6.8, 1.9], [.6, 3.5, 1.8, 4.7], [2.5, 3.5, 3.7, 4.7], [4.35, 4.75, 6.85, 5.65]], spots: [[.5, 2.9], [3.4, 2.7], [5.6, 3.4], [2.2, 5.5], [.6, 5.6]] };
}

// ---------- MINT: the three expiremints machines (silver, gold, black) and a press stamping tins

function vending(k, x, z, body, tin, metal) {
  const THREE = k.THREE;
  const mat = k.M(body, { metalness: metal, roughness: metal ? .28 : .35 });
  k.box(1.7, 2.9, 1, mat, x, 1.45, z);
  const map = k.tex((g, W, H) => {
    g.fillStyle = '#0a0d12'; g.fillRect(0, 0, W, H);
    for (let r = 0; r < 5; r++) {
      g.fillStyle = '#2a2f38'; g.fillRect(0, 74 + r * 88, W, 7);
      for (let c = 0; c < 4; c++) {
        const x0 = 16 + c * 78, y0 = 26 + r * 88;
        g.fillStyle = tin; g.beginPath(); g.roundRect(x0, y0, 62, 48, 8); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x0 + 6, y0 + 5, 50, 4);
        g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x0 + 31, y0 + 28, 9, 0, 7); g.fill();
      }
    }
    const v = g.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(255,255,255,.14)'); v.addColorStop(.5, 'rgba(255,255,255,0)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }, 340, 470);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 1.86), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
  glass.position.set(x, 1.5, z + .515); k.scene.add(glass);
  const sign = k.tex((g, W, H) => {
    g.fillStyle = '#0b0b0e'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 72px "Helvetica Neue",Helvetica,Arial,sans-serif'; g.fillText('expiremints', W / 2, H / 2 + 3);
  }, 640, 120);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .28), new THREE.MeshBasicMaterial({ map: sign, toneMapped: false }));
  top.position.set(x, 2.68, z + .515); k.scene.add(top);
  k.box(1.2, .24, .04, k.M('#050507'), x, .3, z + .51);
  const l = new THREE.PointLight(tin, 2.2, 3); l.position.set(x, 1.6, z + 1.1); k.scene.add(l);
}

function minty(k) {
  const THREE = k.THREE;
  vending(k, 1.15, 1.6, '#c9ced6', '#d6dae1', 1);
  vending(k, 3.4, 1.6, '#c9a13c', '#e6c66a', 1);
  vending(k, 5.65, 1.6, '#17171b', '#3a3a42', 0);
  // the press: a table, a piston, tins
  k.box(3, .9, 1.2, k.M('#15181c', { roughness: .4, metalness: .4 }), 3.4, .45, 4.75);
  k.box(.18, 1.7, .18, k.M('#6b7280', { metalness: .9, roughness: .3 }), 2.4, 1.75, 4.75 - .4);
  k.box(.18, 1.7, .18, k.M('#6b7280', { metalness: .9, roughness: .3 }), 2.4, 1.75, 4.75 + .4);
  k.box(.5, .18, 1.1, k.M('#30343c', { metalness: .9, roughness: .35 }), 2.4, 2.65, 4.75);
  const ram = k.box(.34, .34, .46, k.M('#d7dbe2', { metalness: 1, roughness: .2 }), 2.4, 1.6, 4.75);
  const tinMat = k.M('#d6dae1', { metalness: 1, roughness: .25 }), goldTin = k.M('#d4af37', { metalness: 1, roughness: .28 }), blackTin = k.M('#17171b', { metalness: .6, roughness: .3 });
  k.box(.42, .1, .3, tinMat, 2.4, .95, 4.75);
  [[3.2, 4.45, tinMat, 3], [3.7, 4.45, goldTin, 4], [4.2, 4.45, blackTin, 2], [3.2, 5, goldTin, 2], [3.7, 5, blackTin, 3], [4.2, 5, tinMat, 4]].forEach(([x, z, m, n]) => {
    for (let i = 0; i < n; i++) k.box(.42, .09, .3, m, x, .95 + i * .095, z);
  });
  const green = new THREE.PointLight('#34d399', 2.4, 6); green.position.set(3.4, 2.4, 3.2); k.scene.add(green);
  return {
    blocked: [[.25, 1.05, 6.55, 2.2], [1.85, 4.1, 4.95, 5.4]],
    spots: [[.6, 3.3], [3.4, 3.2], [6.3, 3.3], [.8, 5.6], [6, 5.6]],
    tick: (t) => { const k2 = Math.max(0, Math.sin(t * 1.1)); ram.position.y = 1.2 + (1 - Math.pow(k2, 6)) * .95 * .7; },
  };
}

// ---------- LOBBY: the plaza in miniature: Expire Bank, the red carpet, two portals, a poker table

function lobby(k) {
  const THREE = k.THREE, cx = 3.3, cz = 3.8;
  k.cyl(2.5, 2.6, .34, 64, k.M('#1a1b22', { roughness: .35, metalness: .3 }), cx, .17, cz);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(2.5, .02, 8, 96), k.M(k.accent, { emissive: k.accent, emissiveIntensity: 1.4 }));
  edge.rotation.x = Math.PI / 2; edge.position.set(cx, .35, cz); k.scene.add(edge);
  const y0 = .34;
  // the bank
  const stone = k.M('#cfc9bd', { roughness: .7 });
  k.box(2.1, .12, 1, stone, cx, y0 + .06, cz - 1.15);
  k.box(1.9, .8, .75, k.M('#191a20', { roughness: .4 }), cx, y0 + .52, cz - 1.25);
  for (let i = 0; i < 6; i++) k.cyl(.05, .05, .8, 10, stone, cx - .85 + i * .34, y0 + .52, cz - .78);
  k.box(2.05, .1, .9, stone, cx, y0 + .97, cz - 1.15);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(.01, 1.15, .32, 4), stone);
  ped.rotation.y = Math.PI / 4; ped.scale.z = .42; ped.position.set(cx, y0 + 1.18, cz - 1.15); ped.castShadow = true; k.scene.add(ped);
  const coinFace = new THREE.Mesh(new THREE.CircleGeometry(.24, 40), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
  coinFace.position.set(cx, y0 + .62, cz - .86); k.scene.add(coinFace);
  k.eglobeTex((t) => { coinFace.material.map = t; coinFace.material.needsUpdate = true; });
  // the red carpet
  k.box(.7, .012, 2.3, k.M('#8f1420', { roughness: .95 }), cx, y0 + .008, cz + .25);
  // two portals
  const ring = (x, c) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 12, 40), k.M('#101014', { metalness: .6, roughness: .3 })); r.position.set(x, y0 + .46, cz + .25); r.castShadow = true; k.scene.add(r);
    const d = new THREE.Mesh(new THREE.CircleGeometry(.4, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .75, toneMapped: false })); d.position.set(x, y0 + .46, cz + .26); k.scene.add(d);
    const b = new THREE.Mesh(new THREE.CircleGeometry(.4, 40), d.material); b.position.set(x, y0 + .46, cz + .24); b.rotation.y = Math.PI; k.scene.add(b);
    return d;
  };
  const p1 = ring(cx - 1.35, '#38bdf8'), p2 = ring(cx + 1.35, '#a78bfa');
  // poker tables
  for (const x of [cx - .95, cx + .95]) {
    k.cyl(.28, .3, .05, 24, k.M(FELT, { roughness: .9 }), x, y0 + .22, cz + 1.3);
    k.cyl(.04, .06, .2, 8, k.M('#222'), x, y0 + .1, cz + 1.3);
  }
  const warm = new THREE.PointLight('#ffb36b', 3, 6); warm.position.set(cx, 2.6, cz); k.scene.add(warm);
  return {
    blocked: [[cx - 2.1, cz - 2.1, cx + 2.1, cz + 2.1]],
    spots: [[.4, 1.6], [6.3, 1.7], [.4, 6], [6.5, 6], [3.3, 6.5]],
    tick: (t) => { p1.material.opacity = .55 + Math.sin(t * 1.4) * .2; p2.material.opacity = .55 + Math.cos(t * 1.1) * .2; },
  };
}

// how the shared room is dressed for each office
export const ROOM = {
  // sky = top, middle, horizon, buildings, lit windows
  gamey: { desks: '#10233f', floorRug: '#0d1b2e', chair: '#1a2231', stars: true, sky: ['#071330', '#17356f', '#3b78c4', '#060e1e', '#9fd0ff'] },
  tradey: { desks: '#2c220d', floorRug: '#1b1608', chair: '#221c10', sky: ['#2a1b3d', '#a1562a', '#f2b35c', '#17100a', '#ffd98a'] },
  arty: { desks: '#2b2350', floorRug: '#181430', chair: '#201c33' },
  betty: { desks: '#3a0d16', floorRug: '#4a0d18', chair: '#2a1015', felt: true, stars: true, sky: ['#120419', '#4a0c3c', '#b82a5f', '#10030d', '#ffb3d1'] },
  story: { desks: '#1e1e22', floorRug: '#26262b', chair: '#1c1c20', sky: ['#a9c3dd', '#cfdbe8', '#ece9e2', '#7d8896', '#ffffff'] },
  minty: { desks: '#0d2e24', floorRug: '#0b241c', chair: '#14231e', stars: true, sky: ['#04201f', '#0d5a52', '#4cbf9d', '#041512', '#b8ffe6'] },
  lobby: { desks: '#33190a', floorRug: '#23120a', chair: '#28190f', sky: ['#2a1238', '#a8412a', '#f7a049', '#1a0d0f', '#ffd2a1'] },
};

const THEMES = { gamey, tradey, arty, betty, story, minty, lobby };

export function buildTheme(id, kit) {
  const fn = THEMES[id];
  return fn ? fn(kit) : { blocked: [], spots: [] };
}
