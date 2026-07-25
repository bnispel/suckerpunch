// Shared canvas + math helpers for every game in this repo.
//
// These are classic (non-module) scripts: each game loads the engine files
// before its own, so everything shares one global scope. The helpers below
// assume the game has already defined a `ctx` global (a 2D canvas context).

// Axis-aligned rectangle overlap test.
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Is point (mx, my) inside object o's box?
function hitBox(o, mx, my) {
  return mx >= o.x && mx <= o.x + o.w && my >= o.y && my <= o.y + o.h;
}

// Trace a rounded rectangle path (call ctx.fill()/ctx.stroke() after).
function roundRect(rx, ry, rw, rh, rr) {
  const r = Math.min(rr, rw / 2, rh / 2);
  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
  ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
  ctx.arcTo(rx, ry + rh, rx, ry, r);
  ctx.arcTo(rx, ry, rx + rw, ry, r);
  ctx.closePath();
}

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb hex color.
function shadeColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// A flame shape rising from (cx, baseY) up to height ht. `flick` jitters the tip.
function drawFlame(cx, baseY, hw, ht, flick) {
  const tipY = baseY - ht + flick;
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.quadraticCurveTo(cx + hw, baseY - ht * 0.4, cx + hw * 0.5, baseY);
  ctx.quadraticCurveTo(cx, baseY + 2, cx - hw * 0.5, baseY);
  ctx.quadraticCurveTo(cx - hw, baseY - ht * 0.4, cx, tipY);
  ctx.closePath();
  ctx.fill();
}
