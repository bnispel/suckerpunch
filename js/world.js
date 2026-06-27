// The arena: floating triangle rocks over a sea of lava, each with its own
// randomly generated red cracks so no two rocks look alike.
const platforms = [
  { x: 40,  y: 300, w: 130, h: 14 },
  { x: 300, y: 305, w: 150, h: 14 },
  { x: 580, y: 300, w: 160, h: 14 },
  { x: 160, y: 225, w: 120, h: 14 },
  { x: 430, y: 215, w: 130, h: 14 },
  { x: 640, y: 200, w: 120, h: 14 },
  { x: 300, y: 140, w: 160, h: 14 },
];

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

for (const p of platforms) {
  p.cracks = [];
  const n = 1 + Math.floor(Math.random() * 4);   // 1–4 cracks each
  for (let i = 0; i < n; i++) {
    const startX = p.x + p.w * (0.12 + Math.random() * 0.76);
    const depth = 6 + Math.random() * 8;
    const spread = 8 + Math.random() * 20;
    const main = buildCrack(startX, p.y + 4, depth, spread);
    p.cracks.push({ pts: main, width: 1.5 + Math.random() * 2 });
    // sometimes a crack branches off a midpoint
    if (Math.random() < 0.5 && main.length > 2) {
      const b = main[1 + Math.floor(Math.random() * (main.length - 2))];
      p.cracks.push({ pts: buildCrack(b[0], b[1], depth * 0.8, spread), width: 1 + Math.random() });
    }
  }
}
