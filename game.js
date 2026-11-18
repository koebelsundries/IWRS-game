(function () {
  "use strict";

  let VW = 256, VH = 160;
  const TILE = 16;
  const MIN_SHORT = 160; // target logical px on the short side
  const COLS = 52, ROWS = 40;
  const WORLD_W = COLS * TILE, WORLD_H = ROWS * TILE;
  const T_GRASS = 0, T_PATH = 1, T_WATER = 2, T_CLIFF = 3, T_LIP_N = 4, T_LIP_S = 5, T_BRIDGE = 6;
  const RAV_TOP = 16, RAV_BOT = 19, BRIDGE_C0 = 23, BRIDGE_C1 = 26;
  const SCORE_KEY = "iwrs-v1-best";
  const MUTE_KEY = "iwrs-v1-mute";

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const $ = function (id) { return document.getElementById(id); };

  let sheet = null, frames = {}, anims = {};
  let mode = "title";
  let scale = 1, lastT = 0, elapsed = 0, startTime = 0, frozen = 0;
  let whoPick = "boy";
  let toastTimer = 0;

  const cam = { x: 0, y: 0 };
  const input = {
    kx: 0, ky: 0,
    dx: 0, dy: 0, dpadId: null,
    a: false, aEdge: false, aId: null,
    b: false, bId: null,
    keysA: false, keysB: false
  };

  let tiles, grassVar, pathVar, keepClear;
  let solids = [];
  let props = [];
  let cats = [];
  let player = null;
  let trail = [];
  let particles = [];
  let floaters = [];
  let motes = [];
  let waterTick = 0;
  let listenLvl = 0;
  let meowTimer = 0;
  let birdTimer = 4;
  let rescuedCount = 0;
  let winDelay = 0;
  let previewT = 0;

  const art = { grass: [], path: [], water: [], cliff: [], lipN: null, lipS: null, bridge: null, trees: {}, bushes: [], rocks: [], flowers: [], shroom: null, log: null, paw: null, rail: null };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function hash(x, y, s) {
    let n = (x * 374761393 + y * 668265263 + (s || 0) * 1274126177) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function rng(seed) {
    let a = seed | 0;
    return function () {
      a = (a * 1664525 + 1013904223) | 0;
      return (a >>> 0) / 4294967296;
    };
  }
  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function storeGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function mk(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    return { c: c, g: g };
  }
  function fill(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, w, h); }
  function dot(g, x, y, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, 1, 1); }
  function blob(g, cx, cy, r, col, rnd) {
    g.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const j = rnd ? (rnd() - 0.5) * 0.6 : 0;
        if (x * x + y * y <= r * r + j * r) g.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  function buildArt() {
    const G1 = "#3a8a45", G2 = "#2f7339", G3 = "#4ea056", G4 = "#2a5c32", G5 = "#68b45c", GD = "#1e4a28";
    for (let i = 0; i < 8; i++) {
      const { c, g } = mk(TILE, TILE);
      const r = rng(1000 + i * 17);
      fill(g, 0, 0, TILE, TILE, i % 2 ? G2 : G1);
      for (let k = 0; k < 28; k++) {
        const col = r() < 0.45 ? G3 : r() < 0.7 ? G4 : r() < 0.88 ? G5 : GD;
        dot(g, (r() * 16) | 0, (r() * 16) | 0, col);
      }
      if (i === 4) {
        dot(g, 5, 6, "#f4f0d8"); dot(g, 6, 5, "#f4f0d8"); dot(g, 7, 6, "#f4f0d8"); dot(g, 6, 7, "#f4f0d8"); dot(g, 6, 6, "#e0c040");
      }
      if (i === 5) {
        dot(g, 10, 9, "#e894c0"); dot(g, 11, 8, "#e894c0"); dot(g, 12, 9, "#e894c0"); dot(g, 11, 10, "#e894c0"); dot(g, 11, 9, "#fff2a0");
      }
      if (i === 6) {
        fill(g, 3, 11, 2, 1, "#66aa44"); fill(g, 8, 4, 2, 1, "#66aa44");
      }
      art.grass.push(c);
    }

    const P1 = "#c09a5a", P2 = "#a67b42", P3 = "#8a6234", P4 = "#d4b06a", P5 = "#6e4a28";
    for (let i = 0; i < 4; i++) {
      const { c, g } = mk(TILE, TILE);
      const r = rng(2000 + i * 13);
      fill(g, 0, 0, TILE, TILE, P2);
      for (let k = 0; k < 22; k++) dot(g, (r() * 16) | 0, (r() * 16) | 0, r() < 0.5 ? P1 : P3);
      for (let k = 0; k < 4; k++) {
        const x = (r() * 14) | 0, y = (r() * 14) | 0;
        dot(g, x, y, P4); dot(g, x + 1, y, P5);
      }
      art.path.push(c);
    }

    const W = ["#1c4a5a", "#163e4e", "#21708a", "#2a8aa4", "#0e2c38"];
    for (let f = 0; f < 3; f++) {
      const { c, g } = mk(TILE, TILE);
      fill(g, 0, 0, TILE, TILE, W[0]);
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const v = Math.sin((x + f * 3) * 0.7 + y * 0.35) + Math.sin((y + f) * 0.9);
          if (v > 0.8) dot(g, x, y, W[3]);
          else if (v > 0.2) dot(g, x, y, W[2]);
          else if (v < -0.7) dot(g, x, y, W[4]);
          else if ((x + y + f) % 7 === 0) dot(g, x, y, W[1]);
        }
      }
      art.water.push(c);
    }

    (function () {
      const { c, g } = mk(TILE, TILE);
      fill(g, 0, 0, TILE, TILE, "#6a4a30");
      for (let y = 0; y < TILE; y++) {
        const band = y < 3 ? "#5a3c28" : y < 7 ? "#7a5a38" : y < 11 ? "#4a3020" : "#6a4a30";
        fill(g, 0, y, TILE, 1, band);
      }
      const r = rng(9);
      for (let k = 0; k < 16; k++) dot(g, (r() * 16) | 0, (r() * 16) | 0, r() < 0.5 ? "#3a2418" : "#8a6a48");
      for (let x = 2; x < 14; x += 5) fill(g, x, 3, 1, 8, "#2a1810");
      art.cliff.push(c);
    })();

    (function () {
      const { c, g } = mk(TILE, TILE);
      g.drawImage(art.grass[1], 0, 0);
      fill(g, 0, 11, TILE, 2, "#2a5c32");
      fill(g, 0, 13, TILE, 1, "#5a3c28");
      fill(g, 0, 14, TILE, 2, "#3a2418");
      for (let x = 1; x < 16; x += 4) fill(g, x, 13, 1, 3, "#2a5c32");
      art.lipN = c;
    })();
    (function () {
      const { c, g } = mk(TILE, TILE);
      fill(g, 0, 0, TILE, 6, "#4a3020");
      fill(g, 0, 6, TILE, 2, "#7a5a38");
      g.drawImage(art.grass[2], 0, 8);
      fill(g, 0, 8, TILE, 2, "#1e4a28");
      art.lipS = c;
    })();

    (function () {
      const { c, g } = mk(TILE, TILE);
      fill(g, 0, 0, TILE, TILE, "#8a5a2e");
      for (let y = 0; y < TILE; y += 4) {
        fill(g, 0, y, TILE, 3, y % 8 === 0 ? "#a06a38" : "#7a4e26");
        fill(g, 0, y + 3, TILE, 1, "#4a2c16");
        dot(g, 2, y + 1, "#3a2a18");
        dot(g, 13, y + 1, "#3a2a18");
      }
      art.bridge = c;
    })();
    (function () {
      const { c, g } = mk(16, 14);
      fill(g, 1, 2, 3, 12, "#6a3e1c");
      fill(g, 12, 2, 3, 12, "#6a3e1c");
      fill(g, 0, 3, 16, 3, "#b07a40");
      fill(g, 0, 2, 16, 1, "#d4a060");
      fill(g, 0, 6, 16, 1, "#4a2c16");
      fill(g, 2, 2, 1, 12, "#c09050");
      art.rail = c;
    })();

    art.trees.oak = [0, 1, 2].map(function (i) { return drawOak(40 + i * 19); });
    art.trees.pine = [0, 1].map(function (i) { return drawPine(70 + i * 11); });
    art.trees.birch = [drawBirch(91)];
    art.bushes = [0, 1, 2, 3].map(function (i) { return drawBush(110 + i * 7); });
    art.rocks = [0, 1, 2].map(function (i) { return drawRock(140 + i * 5); });
    art.flowers = [0, 1, 2, 3, 4].map(function (i) { return drawFlower(i); });
    art.shroom = drawShroom();
    art.log = drawLog();
    art.paw = drawPaw();
  }

  function drawOak(seed) {
    const r = rng(seed);
    const w = 28, h = 36;
    const { c, g } = mk(w, h);
    const tx = 12, tw = 5;
    fill(g, tx, 20, tw, 16, "#6a4428");
    fill(g, tx, 20, 1, 16, "#8a5a34");
    fill(g, tx + tw - 1, 20, 1, 16, "#3a2414");
    for (let k = 0; k < 6; k++) dot(g, tx + 1 + (r() * 3) | 0, 22 + (r() * 12) | 0, "#4a3018");
    const cols = ["#1e5a28", "#2a7a34", "#3c9444", "#1a4a20", "#5ab050"];
    const clusters = [[10, 12, 9], [18, 11, 8], [14, 7, 8], [8, 16, 7], [20, 16, 7], [14, 15, 8]];
    clusters.forEach(function (cl, i) {
      blob(g, cl[0] + (r() * 2 - 1), cl[1] + (r() * 2 - 1), cl[2] - (r() * 1.2), cols[i % cols.length], r);
    });
    blob(g, 12, 9, 3, "#7ec85e", r);
    return { c: c, ax: 14, ay: h, tw: 6, th: 5 };
  }
  function drawPine(seed) {
    const w = 22, h = 38;
    const { c, g } = mk(w, h);
    fill(g, 10, 26, 3, 12, "#5a3a22");
    fill(g, 10, 26, 1, 12, "#7a5a38");
    const layers = [[11, 8, 6], [11, 14, 8], [11, 21, 9], [11, 27, 8]];
    layers.forEach(function (L, i) {
      const col = i === 0 ? "#2e7a3a" : i === 1 ? "#246c30" : "#1c5a28";
      for (let y = 0; y < L[2] + 2; y++) {
        const half = ((L[2] - y) * (L[2] * 0.7) / (L[2] + 2)) | 0;
        fill(g, L[0] - half, L[1] + y - L[2], half * 2 + 1, 1, col);
        if (y < 3) fill(g, L[0] - half + 1, L[1] + y - L[2], 2, 1, "#4a9a4a");
      }
    });
    return { c: c, ax: 11, ay: h, tw: 5, th: 5 };
  }
  function drawBirch(seed) {
    const r = rng(seed);
    const w = 24, h = 36;
    const { c, g } = mk(w, h);
    fill(g, 11, 16, 3, 20, "#e8e0cc");
    fill(g, 11, 16, 1, 20, "#fff8e8");
    fill(g, 13, 16, 1, 20, "#b0a890");
    for (let k = 0; k < 5; k++) fill(g, 11, 18 + k * 3, 3, 1, "#3a3020");
    const cols = ["#c8d868", "#8aaa40", "#d0c050", "#6a8a30"];
    [[9, 10, 7], [16, 9, 7], [12, 6, 6], [8, 14, 5], [17, 14, 5]].forEach(function (cl, i) {
      blob(g, cl[0], cl[1], cl[2], cols[i % cols.length], r);
    });
    return { c: c, ax: 12, ay: h, tw: 5, th: 5 };
  }
  function drawBush(seed) {
    const r = rng(seed);
    const w = 16, h = 12;
    const { c, g } = mk(w, h);
    blob(g, 8, 7, 6, "#2a6a32", r);
    blob(g, 5, 8, 5, "#1e5428", r);
    blob(g, 11, 8, 5, "#34843c", r);
    blob(g, 8, 5, 3, "#5aaa4a", r);
    if (seed % 2 === 0) {
      dot(g, 5, 6, "#c04040"); dot(g, 10, 5, "#c04040"); dot(g, 8, 8, "#e06060");
    }
    return { c: c, ax: 8, ay: h, tw: 0, th: 0 };
  }
  function drawRock(seed) {
    const r = rng(seed);
    const w = 10 + (seed % 3) * 2, h = 7 + (seed % 2);
    const { c, g } = mk(w, h);
    blob(g, (w / 2) | 0, (h / 2) + 1, (h / 2) + 1, "#7a7a70", r);
    blob(g, (w / 2) - 1, (h / 2), (h / 2), "#9a9a90", r);
    dot(g, 2, h - 2, "#5a5a52");
    return { c: c, ax: (w / 2) | 0, ay: h, tw: w - 2, th: 4 };
  }
  function drawFlower(i) {
    const { c, g } = mk(5, 6);
    const cols = ["#f2d2e4", "#fff8e0", "#f0c040", "#e070a0", "#c0e078"];
    const col = cols[i % cols.length];
    fill(g, 2, 3, 1, 3, "#3a7a30");
    dot(g, 2, 1, col); dot(g, 1, 2, col); dot(g, 3, 2, col); dot(g, 2, 3, col);
    dot(g, 2, 2, "#fff06a");
    return { c: c, ax: 2, ay: 6 };
  }
  function drawShroom() {
    const { c, g } = mk(7, 8);
    fill(g, 3, 4, 2, 4, "#e8dcc0");
    fill(g, 1, 1, 5, 4, "#c04040");
    fill(g, 2, 0, 3, 1, "#c04040");
    dot(g, 2, 2, "#fff"); dot(g, 4, 2, "#fff"); dot(g, 3, 3, "#fff");
    return { c: c, ax: 3, ay: 8 };
  }
  function drawLog() {
    const { c, g } = mk(28, 10);
    fill(g, 1, 3, 26, 6, "#7a4e26");
    fill(g, 1, 3, 26, 2, "#a06a38");
    fill(g, 1, 8, 26, 1, "#4a2c16");
    fill(g, 0, 4, 2, 4, "#c0a070");
    fill(g, 26, 4, 2, 4, "#c0a070");
    fill(g, 0, 5, 2, 2, "#6a4a28");
    for (let x = 5; x < 24; x += 5) fill(g, x, 5, 1, 3, "#4a2c16");
    return { c: c, ax: 14, ay: 10, tw: 26, th: 5 };
  }
  function drawPaw() {
    const { c, g } = mk(5, 5);
    dot(g, 2, 3, "#5a3a20");
    dot(g, 1, 1, "#5a3a20"); dot(g, 3, 1, "#5a3a20");
    dot(g, 0, 2, "#5a3a20"); dot(g, 4, 2, "#5a3a20");
    return { c: c, ax: 2, ay: 5 };
  }


  function ti(c, r) { return r * COLS + c; }
  function inb(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS; }

  function buildMap() {
    tiles = new Uint8Array(COLS * ROWS);
    grassVar = new Uint8Array(COLS * ROWS);
    pathVar = new Uint8Array(COLS * ROWS);
    keepClear = new Uint8Array(COLS * ROWS);
    solids = [];
    props = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        tiles[ti(c, r)] = T_GRASS;
        grassVar[ti(c, r)] = (hash(c, r, 3) * 8) | 0;
        pathVar[ti(c, r)] = (hash(c, r, 9) * 4) | 0;
      }
    }

    for (let c = 0; c < COLS; c++) {
      tiles[ti(c, RAV_TOP)] = T_LIP_N;
      tiles[ti(c, RAV_TOP + 1)] = T_CLIFF;
      tiles[ti(c, RAV_TOP + 2)] = T_WATER;
      tiles[ti(c, RAV_BOT)] = T_LIP_S;
    }
    for (let r = RAV_TOP; r <= RAV_BOT; r++) {
      for (let c = BRIDGE_C0; c <= BRIDGE_C1; c++) tiles[ti(c, r)] = T_BRIDGE;
    }

    function markClear(c0, r0, c1, r1) {
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (inb(c, r)) keepClear[ti(c, r)] = 1;
    }
    function paintPath(c, r) {
      if (!inb(c, r)) return;
      const t = tiles[ti(c, r)];
      if (t === T_WATER || t === T_CLIFF || t === T_LIP_N || t === T_LIP_S || t === T_BRIDGE) return;
      tiles[ti(c, r)] = T_PATH;
      keepClear[ti(c, r)] = 1;
    }
    function carve(c0, r0, c1, r1, seed) {
      const r = rng(seed);
      let c = c0, row = r0, guard = 0;
      while ((c !== c1 || row !== r1) && guard++ < 400) {
        paintPath(c, row);
        if (r() < 0.35) paintPath(c + 1, row);
        if (c !== c1 && (row === r1 || r() < 0.55)) c += Math.sign(c1 - c);
        else if (row !== r1) row += Math.sign(r1 - row);
        else c += Math.sign(c1 - c);
      }
      paintPath(c1, r1);
    }

    markClear(20, 30, 29, 36);
    markClear(7, 27, 14, 33);
    markClear(37, 23, 45, 29);
    markClear(7, 5, 15, 12);
    markClear(35, 4, 45, 11);
    markClear(23, 15, 26, 20);

    carve(24, 33, 24, 21, 11);
    carve(24, 21, 25, 14, 12);
    carve(24, 14, 11, 9, 13);
    carve(24, 14, 40, 8, 14);
    carve(24, 33, 10, 30, 15);
    carve(26, 32, 41, 26, 16);

    const paws = [[24, 32], [25, 29], [23, 26], [25, 23], [24, 21]];
    paws.forEach(function (p) {
      props.push({ kind: "paw", x: p[0] * TILE + 8, y: p[1] * TILE + 10, img: art.paw, z: p[1] * TILE });
    });

    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (tiles[ti(c, r)] === T_WATER || tiles[ti(c, r)] === T_CLIFF || tiles[ti(c, r)] === T_BRIDGE) continue;
        const h = hash(c, r, 21);
        if (h < 0.045) {
          const f = art.flowers[(hash(c, r, 22) * art.flowers.length) | 0];
          props.push({ kind: "flower", x: c * TILE + 4 + hash(c, r, 4) * 8, y: r * TILE + 8 + hash(c, r, 5) * 6, img: f, z: 0 });
        } else if (h > 0.992) {
          props.push({ kind: "shroom", x: c * TILE + 8, y: r * TILE + 12, img: art.shroom, z: r * TILE + 12 });
        }
      }
    }

    function canPlace(c, r, pad) {
      for (let yy = -pad; yy <= pad; yy++) for (let xx = -pad; xx <= pad; xx++) {
        if (!inb(c + xx, r + yy)) return false;
        const t = tiles[ti(c + xx, r + yy)];
        if (t === T_WATER || t === T_CLIFF || t === T_LIP_N || t === T_LIP_S || t === T_BRIDGE) return false;
        if (keepClear[ti(c + xx, r + yy)]) return false;
      }
      return true;
    }

    function addProp(kind, pack, x, y, solid) {
      const obj = { kind: kind, x: x, y: y, img: pack, z: y, ox: pack.ax, oy: pack.ay };
      if (solid && pack.tw) {
        const s = { x: x - pack.tw / 2, y: y - pack.th, w: pack.tw, h: pack.th };
        obj.solid = s;
        solids.push(s);
      }
      props.push(obj);
    }

    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (!canPlace(c, r, 1)) continue;
        const border = c < 3 || r < 3 || c > COLS - 4 || r > ROWS - 4;
        const chance = border ? 0.82 : 0.42;
        if (hash(c, r, 31) > chance) continue;
        if (!border && (c + r) % 2 === 0 && hash(c, r, 32) < 0.18) continue;
        const roll = hash(c, r, 33);
        let pack, kind;
        if (roll < 0.18) { kind = "pine"; pack = art.trees.pine[(hash(c, r, 34) * art.trees.pine.length) | 0]; }
        else if (roll > 0.92) { kind = "birch"; pack = art.trees.birch[0]; }
        else { kind = "oak"; pack = art.trees.oak[(hash(c, r, 35) * art.trees.oak.length) | 0]; }
        const jx = (hash(c, r, 36) - 0.5) * 8;
        const jy = (hash(c, r, 37) - 0.5) * 6;
        addProp(kind, pack, c * TILE + 8 + jx, r * TILE + 14 + jy, true);
        keepClear[ti(c, r)] = 2;
      }
    }

    for (let c = 0; c < COLS; c++) {
      for (const r of [0, ROWS - 1]) {
        const pack = art.trees.pine[c % art.trees.pine.length];
        addProp("pine", pack, c * TILE + 8, r * TILE + 14, true);
      }
    }
    for (let r = 1; r < ROWS - 1; r++) {
      if (r >= RAV_TOP && r <= RAV_BOT) continue;
      for (const c of [0, COLS - 1]) {
        const pack = art.trees.oak[r % art.trees.oak.length];
        addProp("oak", pack, c * TILE + 8, r * TILE + 14, true);
      }
    }

    for (let c = 2; c < COLS - 2; c++) {
      if (c >= BRIDGE_C0 - 1 && c <= BRIDGE_C1 + 1) continue;
      if (hash(c, 15, 40) < 0.8) {
        const pack = (hash(c, 15, 42) < 0.35) ? art.trees.pine[c % art.trees.pine.length] : art.trees.oak[c % art.trees.oak.length];
        const kind = pack === art.trees.pine[c % art.trees.pine.length] ? "pine" : "oak";
        addProp(kind, pack, c * TILE + 8 + (hash(c, 15, 43) - 0.5) * 6, 15 * TILE + 8, true);
      }
      if (hash(c, 21, 41) < 0.8) {
        const pack = (hash(c, 21, 44) < 0.3) ? art.trees.pine[c % art.trees.pine.length] : art.trees.oak[c % art.trees.oak.length];
        const kind = pack === art.trees.pine[c % art.trees.pine.length] ? "pine" : "oak";
        addProp(kind, pack, c * TILE + 8 + (hash(c, 21, 45) - 0.5) * 6, 21 * TILE + 10, true);
      }
    }

    const bushSpots = [
      [9, 31], [11, 31], [12, 32], [8, 30],
      [39, 28], [41, 28], [42, 27], [40, 29],
      [9, 11], [11, 11], [12, 10], [8, 9],
      [38, 9], [40, 10], [42, 9], [39, 8],
      [22, 34], [28, 34], [18, 22], [32, 22], [16, 18], [30, 12]
    ];
    bushSpots.forEach(function (p, i) {
      const pack = art.bushes[i % art.bushes.length];
      addProp("bush", pack, p[0] * TILE + 8, p[1] * TILE + 12, false);
    });

    [[43, 25], [38, 24], [14, 20], [33, 33], [19, 8], [44, 6], [6, 14]].forEach(function (p, i) {
      if (tiles[ti(p[0], p[1])] === T_PATH) return;
      const pack = art.rocks[i % art.rocks.length];
      addProp("rock", pack, p[0] * TILE + 8, p[1] * TILE + 12, true);
    });

    addProp("log", art.log, 34 * TILE + 8, 27 * TILE + 10, true);

    for (let c = BRIDGE_C0; c <= BRIDGE_C1; c++) {
      props.push({ kind: "rail", x: c * TILE + 8, y: RAV_TOP * TILE + 6, img: { c: art.rail, ax: 8, ay: 12 }, z: RAV_TOP * TILE + 6 });
      props.push({ kind: "rail", x: c * TILE + 8, y: RAV_BOT * TILE + 14, img: { c: art.rail, ax: 8, ay: 12 }, z: RAV_BOT * TILE + 14 });
    }

    props.forEach(function (p) { if (!p.z) p.z = p.y; });

    motes = [];
    for (let i = 0; i < 18; i++) {
      motes.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        s: 0.3 + Math.random() * 0.6,
        p: Math.random() * Math.PI * 2,
        col: Math.random() < 0.5 ? "#ffe9a0" : "#e8f8c8"
      });
    }
  }

  const CAT_SPOTS = [
    { kind: "tabby", name: "Pumpkin", x: 10 * TILE + 8, y: 29 * TILE + 10 },
    { kind: "tux", name: "Oreo", x: 41 * TILE + 8, y: 26 * TILE + 8 },
    { kind: "tabby", name: "Maple", x: 10 * TILE + 8, y: 8 * TILE + 10 },
    { kind: "tux", name: "Socks", x: 40 * TILE + 8, y: 7 * TILE + 8 }
  ];
  const START = { x: 24 * TILE + 8, y: 33 * TILE + 8 };

  function resetCats() {
    cats = CAT_SPOTS.map(function (s) {
      return {
        kind: s.kind, name: s.name,
        x: s.x, y: s.y, homeX: s.x, homeY: s.y,
        rescued: false, followI: -1,
        frameT: Math.random() * 4, bob: 0,
        flip: 0, hop: 0
      };
    });
    rescuedCount = 0;
    trail = [];
  }

  const Sfx = {
    ctx: null,
    muted: storeGet(MUTE_KEY, "0") === "1",
    unlock: function () {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    },
    now: function () { return this.ctx ? this.ctx.currentTime : 0; },
    envGain: function (t0, a, hold, rel, vol) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + a);
      g.gain.setValueAtTime(vol, t0 + a + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + hold + rel);
      g.connect(this.ctx.destination);
      return g;
    },
    osc: function (type, freq, t0, dur, vol, slide) {
      if (this.muted || !this.ctx) return;
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      o.connect(this.envGain(t0, 0.01, Math.max(0.01, dur - 0.08), 0.08, vol));
      o.start(t0); o.stop(t0 + dur + 0.1);
    },
    meow: function (vol) {
      if (this.muted || !this.ctx) return;
      const t = this.now();
      const v = (vol || 0.4) * 0.22;
      this.osc("triangle", 820, t, 0.09, v, 520);
      this.osc("triangle", 640, t + 0.08, 0.14, v * 0.85, 380);
      this.osc("square", 420, t + 0.05, 0.04, v * 0.08, 300);
    },
    purr: function () {
      if (this.muted || !this.ctx) return;
      const t = this.now();
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(48, t);
      o.frequency.setValueAtTime(52, t + 0.12);
      o.frequency.setValueAtTime(46, t + 0.24);
      o.frequency.setValueAtTime(54, t + 0.36);
      o.frequency.setValueAtTime(48, t + 0.5);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 320;
      const g = this.envGain(t, 0.05, 0.55, 0.25, 0.12);
      o.connect(f); f.connect(g);
      o.start(t); o.stop(t + 0.9);
      const nbuf = ctx.createBuffer(1, ctx.sampleRate * 0.7, ctx.sampleRate);
      const d = nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
      const src = ctx.createBufferSource(); src.buffer = nbuf;
      const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 80; nf.Q.value = 4;
      src.connect(nf); nf.connect(this.envGain(t, 0.05, 0.45, 0.2, 0.08));
      src.start(t);
    },
    chime: function () {
      if (this.muted || !this.ctx) return;
      const t = this.now();
      [523, 659, 784, 1046].forEach(function (f, i) {
        Sfx.osc("sine", f, t + i * 0.08, 0.22, 0.12, f * 1.02);
      });
    },
    rescue: function () { this.chime(); this.purr(); },
    win: function () {
      if (this.muted || !this.ctx) return;
      const t = this.now();
      const notes = [523, 659, 784, 659, 784, 988, 1046];
      notes.forEach(function (f, i) {
        Sfx.osc("triangle", f, t + i * 0.12, 0.2, 0.13);
        Sfx.osc("sine", f * 2, t + i * 0.12, 0.16, 0.04);
      });
    },
    blip: function () { this.osc("square", 520, this.now(), 0.05, 0.06, 720); },
    bird: function () {
      if (this.muted || !this.ctx) return;
      const t = this.now();
      const base = 1400 + Math.random() * 400;
      this.osc("sine", base, t, 0.07, 0.04, base * 1.3);
      this.osc("sine", base * 1.2, t + 0.08, 0.08, 0.035, base);
    },
    foot: function (run) {
      if (this.muted || !this.ctx) return;
      const t = this.now();
      const ctx = this.ctx;
      const nbuf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      const d = nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource(); src.buffer = nbuf;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = run ? 900 : 600;
      src.connect(f); f.connect(this.envGain(t, 0.001, 0.01, 0.03, run ? 0.04 : 0.03));
      src.start(t);
    }
  };


  function moveDir() {
    let x = input.kx + input.dx;
    let y = input.ky + input.dy;
    x = clamp(x, -1, 1); y = clamp(y, -1, 1);
    return { x: x, y: y };
  }
  function bHeld() { return input.b || input.keysB; }

  function dpadFromPoint(clientX, clientY) {
    const r = $("dpad").getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = clientX - cx, dy = clientY - cy;
    const dead = Math.max(12, r.width * 0.1);
    if (dx * dx + dy * dy < dead * dead) return { x: 0, y: 0 };
    const ax = Math.abs(dx), ay = Math.abs(dy);
    let ix = 0, iy = 0;
    if (ax > dead * 0.55) ix = dx > 0 ? 1 : -1;
    if (ay > dead * 0.55) iy = dy > 0 ? 1 : -1;
    if (ax > ay * 2.1) iy = 0;
    if (ay > ax * 2.1) ix = 0;
    return { x: ix, y: iy };
  }
  function syncDpadClass() {
    const el = $("dpad");
    el.classList.toggle("pressed-u", input.dx === 0 && input.dy < 0);
    el.classList.toggle("pressed-d", input.dx === 0 && input.dy > 0);
    el.classList.toggle("pressed-l", input.dy === 0 && input.dx < 0);
    el.classList.toggle("pressed-r", input.dy === 0 && input.dx > 0);
  }

  function bindInput() {
    const keyMove = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0],
      W: [0, -1], A: [-1, 0], S: [0, 1], D: [1, 0]
    };
    window.addEventListener("keydown", function (e) {
      if (e.repeat && (e.key === "Enter" || e.key === "Escape" || e.key === "z" || e.key === "Z" || e.key === " ")) return;
      const m = keyMove[e.key];
      if (m) {
        if (m[0]) input.kx = m[0];
        if (m[1]) input.ky = m[1];
        e.preventDefault();
      }
      if (e.key === "z" || e.key === "Z" || e.key === " ") {
        if (!input.keysA) input.aEdge = true;
        input.keysA = true; e.preventDefault();
      }
      if (e.key === "x" || e.key === "X" || e.key === "Shift") {
        input.keysB = true; e.preventDefault();
      }
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        onStart();
      }
    });
    window.addEventListener("keyup", function (e) {
      const m = keyMove[e.key];
      if (m) {
        if (m[0] && input.kx === m[0]) input.kx = 0;
        if (m[1] && input.ky === m[1]) input.ky = 0;
      }
      if (e.key === "z" || e.key === "Z" || e.key === " ") input.keysA = false;
      if (e.key === "x" || e.key === "X" || e.key === "Shift") input.keysB = false;
    });

    const dpad = $("dpad");
    dpad.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      Sfx.unlock();
      input.dpadId = e.pointerId;
      const d = dpadFromPoint(e.clientX, e.clientY);
      input.dx = d.x; input.dy = d.y; syncDpadClass();
      try { dpad.setPointerCapture(e.pointerId); } catch (err) {}
    });
    dpad.addEventListener("pointermove", function (e) {
      if (input.dpadId !== e.pointerId) return;
      const d = dpadFromPoint(e.clientX, e.clientY);
      input.dx = d.x; input.dy = d.y; syncDpadClass();
    });
    function endDpad(e) {
      if (input.dpadId !== e.pointerId && e.type !== "lostpointercapture") return;
      input.dpadId = null; input.dx = 0; input.dy = 0; syncDpadClass();
    }
    dpad.addEventListener("pointerup", endDpad);
    dpad.addEventListener("pointercancel", endDpad);
    dpad.addEventListener("lostpointercapture", function () {
      input.dpadId = null; input.dx = 0; input.dy = 0; syncDpadClass();
    });

    function bindBtn(el, which) {
      el.addEventListener("pointerdown", function (e) {
        e.preventDefault(); e.stopPropagation();
        Sfx.unlock();
        if (which === "a") { input.a = true; input.aEdge = true; input.aId = e.pointerId; el.classList.add("held"); }
        else { input.b = true; input.bId = e.pointerId; el.classList.add("held"); }
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
      });
      function end(e) {
        if (which === "a" && (input.aId === e.pointerId || e.type === "lostpointercapture")) {
          input.a = false; input.aId = null; el.classList.remove("held");
        }
        if (which === "b" && (input.bId === e.pointerId || e.type === "lostpointercapture")) {
          input.b = false; input.bId = null; el.classList.remove("held");
        }
      }
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("lostpointercapture", end);
    }
    bindBtn($("btnA"), "a");
    bindBtn($("btnB"), "b");
    window.addEventListener("pointerdown", function () { Sfx.unlock(); });
  }

  function makePlayer(kind) {
    player = {
      kind: kind, x: START.x, y: START.y,
      flip: 0, drawFlip: 0, facing: "down",
      walking: false, run: false,
      anim: 0, stepAcc: 0, frame: anims[kind].idleDown || anims[kind].idle
    };
    cam.x = clamp(player.x - VW / 2, 0, WORLD_W - VW);
    cam.y = clamp(player.y - VH / 2, 0, WORLD_H - VH);
    trail = [{ x: player.x, y: player.y, flip: 0 }];
  }

  function tileSolid(x, y) {
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    if (!inb(c, r)) return true;
    const t = tiles[ti(c, r)];
    return t === T_WATER || t === T_CLIFF || t === T_LIP_N || t === T_LIP_S;
  }
  function objSolid(x, y) {
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true;
    }
    return false;
  }
  function blocked(x, y) {
    const hw = 4, hh = 3;
    const pts = [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh], [0, 0]];
    for (let i = 0; i < pts.length; i++) {
      const px = x + pts[i][0], py = y + pts[i][1];
      if (tileSolid(px, py) || objSolid(px, py)) return true;
    }
    return false;
  }
  function tryMove(ent, dx, dy) {
    const nx = ent.x + dx, ny = ent.y + dy;
    if (!blocked(nx, ny)) { ent.x = nx; ent.y = ny; return true; }
    if (dx && !blocked(nx, ent.y)) { ent.x = nx; return true; }
    if (dy && !blocked(ent.x, ny)) { ent.y = ny; return true; }
    return false;
  }

  function nearestHurt() {
    let best = null, bd = 1e9;
    for (let i = 0; i < cats.length; i++) {
      if (cats[i].rescued) continue;
      const d = dist(player.x, player.y, cats[i].x, cats[i].y);
      if (d < bd) { bd = d; best = cats[i]; }
    }
    return { cat: best, d: bd };
  }

  function burst(x, y) {
    const cols = ["#ff6b8a", "#ff8ab0", "#fff6b0", "#ffffff", "#7ec8ff", "#f0d070"];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.random() * 0.2;
      const sp = 20 + Math.random() * 40;
      particles.push({
        x: x, y: y - 8,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        life: 0.7 + Math.random() * 0.4, max: 1,
        col: cols[i % cols.length], typ: i % 3 === 0 ? "heart" : "spark"
      });
    }
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: x + (Math.random() * 10 - 5), y: y - 6,
        vx: Math.random() * 16 - 8, vy: -30 - Math.random() * 20,
        life: 0.9, max: 1, col: "#ff6b8a", typ: "heart"
      });
    }
    floaters.push({ x: x, y: y - 20, text: "Rescued!", life: 1.2 });
  }

  function rescueCat(cat) {
    if (!cat || cat.rescued) return;
    cat.rescued = true;
    cat.followI = rescuedCount;
    rescuedCount += 1;
    burst(cat.x, cat.y);
    Sfx.rescue();
    showToast("You rescued " + cat.name + "!");
    $("hudCats").textContent = "Cats " + rescuedCount + "/4";
    if (rescuedCount >= 4) winDelay = 1.15;
  }

  function tryRescue() {
    if (!player) return;
    const n = nearestHurt();
    if (n.cat && n.d < 22) rescueCat(n.cat);
  }

  function showToast(msg) {
    $("toast").textContent = msg;
    $("toast").classList.add("show");
    toastTimer = 2.2;
  }

  function hideScreens() {
    ["titleScreen", "selectScreen", "pauseMenu", "winScreen"].forEach(function (id) {
      $(id).classList.remove("show");
    });
  }
  function showControls(on) { $("controls").classList.toggle("show", !!on); }
  function showHud(on) { $("hud").classList.toggle("show", !!on); }

  function goTitle() {
    mode = "title";
    hideScreens();
    $("titleScreen").classList.add("show");
    showControls(false); showHud(false);
    $("prompt").classList.remove("show");
    cam.x = 24 * TILE - VW / 2;
    cam.y = 17 * TILE - VH / 2;
    player = null;
    resetCats();
  }
  function goSelect() {
    mode = "select";
    hideScreens();
    $("selectScreen").classList.add("show");
    showControls(true); showHud(false);
    $("prompt").classList.remove("show");
    syncPick();
    cam.x = clamp(START.x - VW / 2, 0, WORLD_W - VW);
    cam.y = clamp(START.y - 50, 0, WORLD_H - VH);
  }
  function syncPick() {
    $("pickBoy").classList.toggle("on", whoPick === "boy");
    $("pickGirl").classList.toggle("on", whoPick === "girl");
  }
  function startPlay(kind) {
    mode = "play";
    hideScreens();
    showControls(true); showHud(true);
    makePlayer(kind || whoPick);
    resetCats();
    particles = []; floaters = [];
    rescuedCount = 0;
    startTime = performance.now();
    elapsed = 0;
    winDelay = 0;
    $("hudCats").textContent = "Cats 0/4";
    showToast("Find 4 injured kitties!");
    Sfx.blip();
  }
  function goPause() {
    if (mode !== "play") return;
    mode = "pause";
    hideScreens();
    $("pauseMenu").classList.add("show");
    showControls(false);
  }
  function resumePlay() {
    mode = "play";
    hideScreens();
    showControls(true); showHud(true);
  }
  function goWin() {
    mode = "win";
    hideScreens();
    showControls(false); showHud(true);
    $("prompt").classList.remove("show");
    const t = elapsed;
    const bestRaw = parseFloat(storeGet(SCORE_KEY, "0")) || 0;
    let best = bestRaw;
    if (!best || t < best) { best = t; storeSet(SCORE_KEY, String(best)); }
    $("winTime").textContent = "Time " + formatTime(t);
    $("winBest").textContent = "Best " + formatTime(best);
    $("winScreen").classList.add("show");
    Sfx.win();
    if (player) burst(player.x, player.y - 8);
  }

  function onStart() {
    Sfx.unlock();
    if (mode === "title") goSelect();
    else if (mode === "select") startPlay(whoPick);
    else if (mode === "play") goPause();
    else if (mode === "pause") resumePlay();
    else if (mode === "win") startPlay(whoPick);
  }
  function onA() {
    Sfx.unlock();
    if (mode === "title") goSelect();
    else if (mode === "select") startPlay(whoPick);
    else if (mode === "play") tryRescue();
    else if (mode === "pause") resumePlay();
    else if (mode === "win") startPlay(whoPick);
  }

  function wireUI() {
    $("btnStart").addEventListener("click", function () { Sfx.unlock(); goSelect(); });
    $("btnConfirm").addEventListener("click", function () { Sfx.unlock(); startPlay(whoPick); });
    $("pickBoy").addEventListener("click", function () { whoPick = "boy"; syncPick(); Sfx.blip(); });
    $("pickGirl").addEventListener("click", function () { whoPick = "girl"; syncPick(); Sfx.blip(); });
    $("btnResume").addEventListener("click", resumePlay);
    $("btnGameMenu").addEventListener("click", goTitle);
    $("btnWinMenu").addEventListener("click", goTitle);
    $("btnAgain").addEventListener("click", function () { startPlay(whoPick); });
    $("homeBtn").addEventListener("click", function () {
      if (mode === "play") goPause();
      else if (mode === "pause") resumePlay();
    });
    $("muteBtn").addEventListener("click", function () {
      Sfx.muted = !Sfx.muted;
      storeSet(MUTE_KEY, Sfx.muted ? "1" : "0");
      $("muteBtn").textContent = Sfx.muted ? "🔇" : "🔊";
      $("muteBtn").setAttribute("aria-label", Sfx.muted ? "Unmute" : "Mute");
      if (!Sfx.muted) Sfx.unlock();
    });
    if (Sfx.muted) $("muteBtn").textContent = "🔇";
  }


  function poseFor(kind, facing, walking, anim) {
    const A = anims[kind];
    if (facing === "up") {
      const seq = walking ? (A.walkUp || A.walk) : [A.idleUp || A.idle];
      return { frame: seq[Math.floor(anim) % seq.length], flip: 0, set: walking ? "walkUp" : "idleUp" };
    }
    if (facing === "down") {
      const seq = walking ? (A.walkDown || A.walk) : [A.idleDown || A.idle];
      return { frame: seq[Math.floor(anim) % seq.length], flip: 0, set: walking ? "walkDown" : "idleDown" };
    }
    const seq = walking ? A.walk : [A.idle];
    const flip = facing === "left" ? 1 : 0;
    return { frame: seq[Math.floor(anim) % seq.length], flip: flip, set: walking ? "walk" : "idle" };
  }

  function updatePlay(dt) {
    elapsed = (performance.now() - startTime) / 1000;
    $("hudTime").textContent = formatTime(elapsed);
    if (frozen > 0) { frozen -= dt; return; }

    const dir = moveDir();
    const run = bHeld();
    const speed = (run ? 92 : 56);
    let mx = dir.x, my = dir.y;
    if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
    player.walking = !!(mx || my);
    player.run = run && player.walking;
    if (player.walking) {
      tryMove(player, mx * speed * dt, my * speed * dt);
      // Pick a 4-direction facing. Diagonals prefer the horizontal axis
      // when |mx| >= |my|; otherwise the dominant axis wins.
      const ax = Math.abs(mx), ay = Math.abs(my);
      if (ax >= ay && ax > 0) {
        player.facing = mx < 0 ? "left" : "right";
        // Source convention: unflipped side frames face RIGHT.
        player.flip = mx < 0 ? 1 : 0;
      } else if (ay > 0) {
        player.facing = my < 0 ? "up" : "down";
      }
      player.anim += dt * (run ? 12 : 8);
      const pose = poseFor(player.kind, player.facing, true, player.anim);
      player.frame = pose.frame;
      player.drawFlip = pose.flip;
      player.stepAcc += dt * (run ? 5.5 : 3.6);
      if (player.stepAcc >= 1) { player.stepAcc -= 1; Sfx.foot(run); }
      const last = trail[trail.length - 1];
      if (!last || dist(last.x, last.y, player.x, player.y) >= 5) {
        trail.push({ x: player.x, y: player.y, flip: player.flip });
        if (trail.length > 80) trail.shift();
      }
    } else {
      const pose = poseFor(player.kind, player.facing || "down", false, 0);
      player.frame = pose.frame;
      player.drawFlip = pose.flip;
      player.anim = 0;
    }

    cats.forEach(function (cat) {
      cat.frameT += dt;
      if (cat.rescued) {
        const slot = cat.followI + 1;
        const idx = trail.length - 1 - slot * 7;
        const tgt = trail[Math.max(0, idx)] || player;
        const d = dist(cat.x, cat.y, tgt.x, tgt.y);
        if (d > 10) {
          const sp = Math.min(140, 50 + d * 3);
          cat.x += ((tgt.x - cat.x) / d) * sp * dt;
          cat.y += ((tgt.y - cat.y) / d) * sp * dt;
          if (tgt.x < cat.x - 1) cat.flip = 1;
          if (tgt.x > cat.x + 1) cat.flip = 0;
          cat.hop += dt * 10;
        } else {
          cat.hop = 0;
        }
      } else {
        if (player.x < cat.x - 2) cat.flip = 1;
        if (player.x > cat.x + 2) cat.flip = 0;
      }
    });

    const n = nearestHurt();
    if (n.cat) {
      listenLvl = clamp(1 - n.d / 220, 0, 1);
      $("hudListenBar").style.width = Math.round(listenLvl * 100) + "%";
      if (listenLvl > 0.72) $("hudListenLbl").textContent = "A kitty is near!";
      else if (listenLvl > 0.28) $("hudListenLbl").textContent = "Hearing a meow\u2026";
      else if (listenLvl > 0.05) $("hudListenLbl").textContent = "Listening\u2026";
      else $("hudListenLbl").textContent = "";
      const interval = lerp(2.8, 0.55, listenLvl);
      const vol = 0.15 + listenLvl * 0.85;
      meowTimer -= dt;
      if (listenLvl > 0.04 && meowTimer <= 0) {
        Sfx.meow(vol);
        meowTimer = interval;
      }
      const show = n.d < 28;
      $("prompt").classList.toggle("show", show);
      if (show) $("prompt").textContent = "A  Rescue " + n.cat.name;
    } else {
      listenLvl = 0;
      $("hudListenBar").style.width = "0%";
      $("hudListenLbl").textContent = "";
      $("prompt").classList.remove("show");
    }

    if (winDelay > 0) {
      winDelay -= dt;
      if (winDelay <= 0) goWin();
    }

    const tx = clamp(player.x - VW / 2, 0, WORLD_W - VW);
    const ty = clamp(player.y - VH / 2 - 6, 0, WORLD_H - VH);
    const k = 1 - Math.pow(0.0008, dt);
    cam.x = lerp(cam.x, tx, k);
    cam.y = lerp(cam.y, ty, k);
  }

  function updateFX(dt) {
    waterTick += dt;
    birdTimer -= dt;
    if (birdTimer <= 0 && (mode === "play" || mode === "title" || mode === "select")) {
      if (Math.random() < 0.7) Sfx.bird();
      birdTimer = 5 + Math.random() * 7;
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) $("toast").classList.remove("show");
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.typ === "heart" ? 20 : 50) * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      floaters[i].life -= dt;
      floaters[i].y -= 16 * dt;
      if (floaters[i].life <= 0) floaters.splice(i, 1);
    }
    motes.forEach(function (m) {
      m.p += dt * m.s;
      m.x += Math.sin(m.p) * 8 * dt;
      m.y += (Math.cos(m.p * 0.7) * 4 - 3 * m.s) * dt;
      if (m.y < 0) m.y += WORLD_H;
      if (m.x < 0) m.x += WORLD_W;
      if (m.x > WORLD_W) m.x -= WORLD_W;
    });
  }

  function drawSpr(name, wx, wy, flip, bob) {
    const f = frames[name];
    if (!f) return;
    const dx = Math.round(wx - cam.x);
    const dy = Math.round(wy - cam.y - (bob || 0));
    ctx.save();
    ctx.translate(dx, dy);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(sheet, f.x, f.y, f.w, f.h, -f.ax, -f.ay, f.w, f.h);
    ctx.restore();
  }
  function catFrame(cat) {
    const A = anims[cat.kind];
    if (cat.rescued) {
      const moving = cat.hop > 0;
      const seq = A.happy || A.spark || [A.sit];
      if (moving) return seq[Math.floor(cat.frameT * 8) % seq.length];
      return seq[Math.floor(cat.frameT * 3) % seq.length];
    }
    const cry = A.cry;
    const phase = cat.frameT % 2.8;
    if (phase < 1.2) return cry[Math.floor(cat.frameT * 6) % cry.length];
    if (A.sad) {
      if (typeof A.sad === "string") return A.sad;
      return A.sad[Math.floor(cat.frameT * 2) % A.sad.length];
    }
    return A.sit;
  }

  function drawWorld() {
    const savedX = cam.x, savedY = cam.y;
    cam.x = Math.round(cam.x); cam.y = Math.round(cam.y);

    ctx.fillStyle = "#0e2414";
    ctx.fillRect(0, 0, VW, VH);

    const c0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const r0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const c1 = Math.min(COLS - 1, Math.floor((cam.x + VW) / TILE) + 1);
    const r1 = Math.min(ROWS - 1, Math.floor((cam.y + VH) / TILE) + 1);
    const wf = Math.floor(waterTick * 2.2) % 3;

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = tiles[ti(c, r)];
        const dx = c * TILE - cam.x, dy = r * TILE - cam.y;
        let img = art.grass[grassVar[ti(c, r)]];
        if (t === T_PATH) img = art.path[pathVar[ti(c, r)]];
        else if (t === T_WATER) img = art.water[wf];
        else if (t === T_CLIFF) img = art.cliff[0];
        else if (t === T_LIP_N) img = art.lipN;
        else if (t === T_LIP_S) img = art.lipS;
        else if (t === T_BRIDGE) img = art.bridge;
        if (img) ctx.drawImage(img, dx, dy);
        else ctx.drawImage(art.grass[0], dx, dy);
      }
    }

    function shadow(wx, wy, w, h) {
      ctx.fillStyle = "rgba(10,20,8,0.28)";
      ctx.beginPath();
      ctx.ellipse(Math.round(wx - cam.x), Math.round(wy - cam.y - 1), w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const drawList = props.slice();
    cats.forEach(function (cat) { drawList.push({ kind: "cat", cat: cat, z: cat.y }); });
    if ((mode === "play" || mode === "pause" || mode === "win") && player) {
      drawList.push({ kind: "player", z: player.y });
    }
    if (mode === "select") {
      drawList.push({ kind: "preview", who: "boy", x: START.x - 18, y: START.y, z: START.y });
      drawList.push({ kind: "preview", who: "girl", x: START.x + 18, y: START.y, z: START.y });
    }
    drawList.sort(function (a, b) { return (a.z || a.y) - (b.z || b.y); });

    drawList.forEach(function (item) {
      if (item.kind === "player") {
        shadow(player.x, player.y, 7, 3);
        drawSpr(player.frame, player.x, player.y, player.drawFlip, 0);
      } else if (item.kind === "cat") {
        const cat = item.cat;
        shadow(cat.x, cat.y, 6, 2.5);
        const bob = cat.rescued && cat.hop > 0 ? Math.abs(Math.sin(cat.hop)) * 3 : 0;
        drawSpr(catFrame(cat), cat.x, cat.y, cat.flip, bob);
        if (!cat.rescued) {
          const t = Math.sin(cat.frameT * 4);
          if (t > 0.2) {
            ctx.fillStyle = "#ffffff";
            ctx.font = '6px "Press Start 2P", monospace';
            ctx.fillText("!", Math.round(cat.x - cam.x) - 1, Math.round(cat.y - cam.y - 22 + t));
          }
        }
      } else if (item.kind === "preview") {
        const A = anims[item.who];
        const walk = A.walkDown || A.walk;
        const idle = A.idleDown || A.idle;
        const use = (item.who === whoPick) ? walk[Math.floor(previewT * 8) % walk.length] : idle;
        shadow(item.x, item.y, 7, 3);
        if (item.who === whoPick) {
          ctx.strokeStyle = "#fff6b0";
          ctx.lineWidth = 1;
          ctx.strokeRect(Math.round(item.x - cam.x) - 12, Math.round(item.y - cam.y) - 36, 24, 40);
        }
        drawSpr(use, item.x, item.y, 0, 0);
      } else {
        const p = item;
        const img = p.img && (p.img.c || p.img);
        if (!img) return;
        const ax = (p.img.ax != null) ? p.img.ax : (p.ox || 0);
        const ay = (p.img.ay != null) ? p.img.ay : (p.oy || 0);
        const dx = Math.round(p.x - cam.x - ax);
        const dy = Math.round(p.y - cam.y - ay);
        if (p.kind === "oak" || p.kind === "pine" || p.kind === "birch" || p.kind === "bush") {
          shadow(p.x, p.y, p.kind === "bush" ? 6 : 8, 3);
        }
        if (img && img.getContext) ctx.drawImage(img, dx, dy);
      }
    });

    motes.forEach(function (m) {
      const dx = m.x - cam.x, dy = m.y - cam.y;
      if (dx < -2 || dy < -2 || dx > VW + 2 || dy > VH + 2) return;
      ctx.fillStyle = m.col;
      ctx.fillRect(dx | 0, dy | 0, 1, 1);
    });

    particles.forEach(function (p) {
      const dx = Math.round(p.x - cam.x), dy = Math.round(p.y - cam.y);
      ctx.globalAlpha = clamp(p.life / 0.7, 0, 1);
      ctx.fillStyle = p.col;
      if (p.typ === "heart") {
        ctx.fillRect(dx, dy, 2, 2);
        ctx.fillRect(dx - 1, dy + 1, 1, 1);
        ctx.fillRect(dx + 2, dy + 1, 1, 1);
        ctx.fillRect(dx, dy + 2, 2, 2);
      } else {
        ctx.fillRect(dx, dy, 2, 2);
      }
      ctx.globalAlpha = 1;
    });
    floaters.forEach(function (f) {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.fillStyle = "#fff6b0";
      ctx.font = '8px "Press Start 2P", monospace';
      const tw = ctx.measureText(f.text).width;
      ctx.fillText(f.text, Math.round(f.x - cam.x - tw / 2), Math.round(f.y - cam.y));
      ctx.globalAlpha = 1;
    });

    const vg = ctx.createRadialGradient(VW / 2, VH / 2, 70, VW / 2, VH / 2, 150);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(8,16,8,0.28)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VW, VH);

    if (mode === "pause") {
      ctx.fillStyle = "rgba(8,16,8,0.4)";
      ctx.fillRect(0, 0, VW, VH);
    }

    cam.x = savedX; cam.y = savedY;
  }

  function viewBox() {
    const vv = window.visualViewport;
    if (vv && vv.width && vv.height) {
      return {
        w: Math.max(1, Math.round(vv.width)),
        h: Math.max(1, Math.round(vv.height)),
        x: Math.round(vv.offsetLeft || 0),
        y: Math.round(vv.offsetTop || 0)
      };
    }
    return { w: window.innerWidth, h: window.innerHeight, x: 0, y: 0 };
  }

  function layout() {
    const v = viewBox();
    const short = Math.min(v.w, v.h);
    scale = Math.max(1, Math.floor(short / MIN_SHORT));
    VW = Math.max(160, Math.ceil(v.w / scale));
    VH = Math.max(144, Math.ceil(v.h / scale));
    if (VW % 2) VW++;
    if (VH % 2) VH++;
    canvas.width = VW;
    canvas.height = VH;
    // Fill the visual viewport; any leftover sub-pixel is a tiny near-integer stretch
    // (less than one logical pixel) and stays crisp with image-rendering: pixelated.
    canvas.style.width = v.w + "px";
    canvas.style.height = v.h + "px";
    canvas.style.left = v.x + "px";
    canvas.style.top = v.y + "px";
    ctx.imageSmoothingEnabled = false;
    cam.x = clamp(cam.x, 0, Math.max(0, WORLD_W - VW));
    cam.y = clamp(cam.y, 0, Math.max(0, WORLD_H - VH));
  }

  let bWas = false;
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (mode === "play") updatePlay(dt);
    if (mode === "select") {
      previewT += dt;
      const dir = moveDir();
      if (dir.x < 0) { whoPick = "boy"; syncPick(); }
      if (dir.x > 0) { whoPick = "girl"; syncPick(); }
    }
    if (mode === "title") {
      const tsec = t / 1000;
      const tx = 24 * TILE - VW / 2 + Math.sin(tsec * 0.15) * 40;
      const ty = 17 * TILE - VH / 2 + Math.cos(tsec * 0.12) * 18;
      cam.x = lerp(cam.x, clamp(tx, 0, WORLD_W - VW), 0.04);
      cam.y = lerp(cam.y, clamp(ty, 0, WORLD_H - VH), 0.04);
    }
    if (input.aEdge) {
      input.aEdge = false;
      onA();
    }
    const bNow = bHeld();
    if (bNow && !bWas && mode === "select") goTitle();
    bWas = bNow;

    try {
      updateFX(dt);
      ctx.imageSmoothingEnabled = false;
      drawWorld();
    } catch (err) {
      if (!window.__IWRS_ERR) {
        window.__IWRS_ERR = String(err && err.stack || err);
        console.error(err);
      }
    }
    requestAnimationFrame(frame);
  }

  function loadImage(src) {
    return new Promise(function (res, rej) {
      const im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error("img " + src)); };
      im.src = src;
    });
  }

  function boot() {
    const data = window.IWRS_SPRITES;
    if (!data) throw new Error("sprites.js missing");
    frames = data.frames;
    anims = data.anims;
    layout();
    window.addEventListener("resize", layout);
    window.addEventListener("orientationchange", function () { setTimeout(layout, 80); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", layout);
      window.visualViewport.addEventListener("scroll", layout);
    }
    bindInput();
    wireUI();

    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!touch && !coarse) document.body.classList.add("desktop");

    buildArt();
    buildMap();
    resetCats();
    cam.x = 24 * TILE - VW / 2;
    cam.y = 17 * TILE - VH / 2;
    goTitle();
    lastT = performance.now();
    requestAnimationFrame(frame);

    if (document.fonts && document.fonts.load) document.fonts.load('8px "Press Start 2P"').catch(function () {});
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function () {});
    }

    window.__IWRS = {
      get mode() { return mode; },
      get player() { return player; },
      get view() { return { vw: VW, vh: VH, scale: scale }; },
      get facing() { return player && player.facing; },
      get animSet() { return player && poseFor(player.kind, player.facing || "down", !!player.walking, player.anim).set; },
      get cats() { return cats; },
      get rescued() { return rescuedCount; },
      choose: function (w) { whoPick = w === "girl" ? "girl" : "boy"; syncPick(); },
      goSelect: goSelect,
      start: function (w) { if (w) whoPick = w; startPlay(whoPick); },
      setPos: function (x, y) { if (player) { player.x = x; player.y = y; } },
      rescueNearest: function () { tryRescue(); },
      rescueAll: function () { cats.forEach(rescueCat); },
      goTitle: goTitle,
      goWin: goWin
    };
  }

  loadImage("assets/sprites-v4.png").then(function (im) {
    // Guard: if a stale cached sheet is smaller than the frame map needs, reload fresh.
    var need = 0, fr = (window.IWRS_SPRITES || {}).frames || {};
    Object.keys(fr).forEach(function (k) { need = Math.max(need, fr[k].y + fr[k].h); });
    if (im.height < need) {
      return loadImage("assets/sprites-v4.png?r=" + Date.now()).then(function (im2) { sheet = im2; boot(); });
    }
    sheet = im;
    boot();
  }).catch(function (err) {
    document.body.textContent = "Could not load IWRS sprites.";
    console.error(err);
  });
})();
