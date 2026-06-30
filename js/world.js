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

// Generate a fresh, random set of platforms. They're kept apart so they don't
// pile up, and confined to the air above the lava.
function buildArena() {
  platforms = [];
  const count = 4 + Math.floor(Math.random() * 4);   // 4–7 rocks
  const topY = 120, botY = LAVA_Y - 70;
  let tries = 0;
  while (platforms.length < count && tries < 400) {
    tries++;
    const w = 100 + Math.floor(Math.random() * 70);
    const x = 16 + Math.floor(Math.random() * (W - 32 - w));
    const y = topY + Math.floor(Math.random() * (botY - topY));
    // reject if it sits too close to an existing rock on a similar level
    let ok = true;
    for (const p of platforms) {
      if (Math.abs(p.y - y) < 42 && x < p.x + p.w + 26 && x + w > p.x - 26) { ok = false; break; }
    }
    if (!ok) continue;
    const p = { x, y, w, h: 14 };
    platformCracks(p);
    platforms.push(p);
  }
  // safety net so there's always somewhere to spawn
  if (platforms.length < 2) {
    platforms = [{ x: 60, y: 380, w: 140, h: 14 }, { x: 600, y: 380, w: 140, h: 14 }];
    platforms.forEach(platformCracks);
  }
}

buildArena();
