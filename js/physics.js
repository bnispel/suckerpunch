// Movement, collisions, lava, and per-frame timers for a fighter.
function applyPhysics(f) {
  f.inLava = false;
  // horizontal move + platform walls. While launching out of the lava we pass
  // through platforms, so skip the side-wall check too (otherwise it snaps the
  // fighter to a platform edge mid-rise, which looks like a teleport).
  f.x += f.vx;
  if (!f.escapingLava) {
    for (const p of platforms) {
      if (rectsOverlap(f, p)) {
        if (f.vx > 0) f.x = p.x - f.w;
        else if (f.vx < 0) f.x = p.x + p.w;
      }
    }
  }
  // gravity + vertical move — Cape glides, drifting down slowly thanks to the cape
  const g = (f.cape && f.vy > 0) ? GRAVITY * 0.32 : GRAVITY;
  f.vy += g;
  if (f.cape && f.vy > 3.2) f.vy = 3.2;   // cap the cape's descent for a floaty glide
  f.y += f.vy;
  f.onGround = false;
  for (const p of platforms) {
    if (rectsOverlap(f, p)) {
      if (f.vy > 0) { f.y = p.y - f.h; f.vy = 0; f.onGround = true; f.escapingLava = false; }
      // launching out of lava passes up through platforms instead of bonking
      else if (f.vy < 0 && !f.escapingLava) { f.y = p.y + p.h; f.vy = 0; }
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
