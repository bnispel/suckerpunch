// Movement, collisions, lava, and per-frame timers for a fighter.
// Platforms are one-way (Smash-style): you pass up through them from below and
// from the sides, and only land when descending onto the top surface.
function applyPhysics(f) {
  f.inLava = false;

  // horizontal move (no side walls — platforms are pass-through)
  f.x += f.vx;

  // gravity + vertical move — Cape glides, drifting down slowly thanks to the cape
  const g = (f.cape && f.vy > 0) ? GRAVITY * 0.32 : GRAVITY;
  f.vy += g;
  if (f.cape && f.vy > 3.2) f.vy = 3.2;   // cap the cape's descent for a floaty glide
  const prevBottom = f.y + f.h;           // feet before this move
  f.y += f.vy;
  f.onGround = false;

  // land on a platform top only while descending and only if the feet were at
  // or above the top last frame (so jumping up through it doesn't snag).
  if (f.vy >= 0) {
    for (const p of platforms) {
      if (prevBottom <= p.y + 6 && f.y + f.h >= p.y &&
          f.x + f.w > p.x && f.x < p.x + p.w) {
        f.y = p.y - f.h; f.vy = 0; f.onGround = true; f.escapingLava = false;
        break;
      }
    }
  }

  // arena side walls
  if (f.x < 0) f.x = 0;
  if (f.x + f.w > W) f.x = W - f.w;

  // lava is a hot floor: you can stand (and jump out) but it burns you
  if (f.y + f.h >= LAVA_Y) {
    f.y = LAVA_Y - f.h;
    f.vy = 0;
    f.onGround = true;
    f.inLava = true;
    f.escapingLava = false;
  }
}

// Burn for LAVA_DAMAGE on contact and every LAVA_INTERVAL frames you stay in.
function updateLavaDamage(f) {
  if (f.inLava) {
    if (f.lavaTick % LAVA_INTERVAL === 0) {
      f.hp = Math.max(0, f.hp - LAVA_DAMAGE);
      f.hurt = 12;
      f.vy = -6;  // little hop/recoil from the burn
    }
    f.lavaTick++;
  } else {
    f.lavaTick = 0;
  }
}

function updateTimers(f) {
  if (f.attackTimer > 0) f.attackTimer--;
  if (f.cooldown > 0) f.cooldown--;
  if (f.hurt > 0) f.hurt--;
  if (f.shootCD > 0) f.shootCD--;
}
