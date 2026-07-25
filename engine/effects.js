// Reusable character/visual effects shared across games.
// Assumes a global `frame` clock (incremented once per rendered frame).

// Eyes stay open most of the time, snapping shut for a few frames each cycle.
// ~230-frame period (~4s at 60fps); per-character `blinkPhase` keeps a cast of
// characters out of sync so they don't all blink together.
function isBlinking(f) {
  const t = ((frame + (f && f.blinkPhase || 0)) % 230);
  return t < 6;
}

// A fresh random blink offset — store on each character at creation time so
// isBlinking() gives it its own rhythm.
function randomBlinkPhase() {
  return Math.floor(Math.random() * 240);
}
