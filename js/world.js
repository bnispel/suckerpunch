// The arena: a random number of floating triangle rocks at random positions
// over a sea of lava, each with its own randomly generated red cracks.
let platforms = [];

function buildCrack(startX, startY, depth, spread) {
  let cx = startX, cy = startY;
  const pts = [[cx, cy]];
  const segs = 2 + Math.floor(Math.random() * 4);   // 2–5 segments
  for (let s = 0; s < segs; s++) {
    cx += (Math.random() - 0.5) * spread;
    cy += depth * (0.6 + Math.random() * 0.8);
    pts.push([cx, cy]);
  }
  return pts;
}

function platformCracks(p) {
  p.cracks = [];
  const n = 1 + Math.floor(Math.random() * 4);   // 1–4 cracks each
  for (let i = 0; i < n; i++) {
    const startX = p.x + p.w * (0.12 + Math.random() * 0.76);
    const depth = 6 + Math.random() * 8;
    const spread = 8 + Math.random() * 20;
    const main = buildCrack(startX, p.y + 4, depth, spread);
    p.cracks.push({ pts: main, width: 1.5 + Math.random() * 2 });
    if (Math.random() < 0.5 && main.length > 2) {   // sometimes branches
      const b = main[1 + Math.floor(Math.random() * (main.length - 2))];
      p.cracks.push({ pts: buildCrack(b[0], b[1], depth * 0.8, spread), width: 1 + Math.random() });
    }
  }
}

// Roughly how far a fighter can jump (a bit under the true maximum so jumps
// are comfortable, not pixel-perfect).
const JUMP_H = 100;     // vertical reach
const REACH_X = 110;    // horizontal reach at the same height
const MIN_GAP = 22;     // platforms must be at least this far apart (never touch)

// Can you jump between rocks a and b? Less horizontal room the higher the hop.
function reachable(a, b) {
  const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const rise = Math.abs(a.y - b.y);
  if (rise > JUMP_H) return false;
  return gapX <= REACH_X * (1 - 0.7 * rise / JUMP_H);
}

// Does cand come within MIN_GAP of any existing platform (i.e. touch)? Uses the
// full triangle footprint (top down to the hanging point), not just the rect,
// so the visible rocks never overlap.
function touchesAny(cand) {
  const cd = platformDepth(cand);
  for (const p of platforms) {
    const pd = platformDepth(p);
    if (cand.x < p.x + p.w + MIN_GAP && cand.x + cand.w + MIN_GAP > p.x &&
        cand.y < p.y + pd + MIN_GAP && cand.y + cd + MIN_GAP > p.y) return true;
  }
  return false;
}

// Generate a fresh, random set of platforms that never touch and are all
// reachable by jumping (each new rock grows off an existing one).
function buildArena() {
  const count = 4 + Math.floor(Math.random() * 4);   // 4–7 rocks
  const topY = 120, botY = LAVA_Y - 70;

  // root rock, lower-middle-ish
  const rw = 110 + Math.floor(Math.random() * 60);
  const root = {
    x: Math.max(14, Math.min(W - 14 - rw, Math.round((W - rw) / 2 + (Math.random() * 200 - 100)))),
    y: botY - Math.floor(Math.random() * 60), w: rw, h: 14,
  };
  platformCracks(root);
  platforms = [root];

  let tries = 0;
  while (platforms.length < count && tries < 600) {
    tries++;
    const base = platforms[Math.floor(Math.random() * platforms.length)];
    const w = 100 + Math.floor(Math.random() * 70);
    const side = Math.random() < 0.5 ? -1 : 1;
    const gapX = MIN_GAP + 4 + Math.random() * (REACH_X - MIN_GAP - 6);
    const x = Math.round(side > 0 ? base.x + base.w + gapX : base.x - gapX - w);
    const y = Math.round(base.y + (Math.random() * 2 - 1) * JUMP_H);
    if (x < 14 || x + w > W - 14 || y < topY || y > botY) continue;
    const cand = { x, y, w, h: 14 };
    if (!reachable(base, cand) || touchesAny(cand)) continue;
    platformCracks(cand);
    platforms.push(cand);
  }
}

buildArena();
