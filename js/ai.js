// Player controls and the computer opponent's behavior.

function updatePlayer() {
  if (keys['ArrowLeft'])  { player.vx = -player.speed; player.facing = -1; }
  else if (keys['ArrowRight']) { player.vx = player.speed; player.facing = 1; }
  else player.vx = 0;

  if (keys['ArrowUp'] && player.onGround) {
    player.vy = -JUMP_FORCE; player.onGround = false;
  }
  if (keys['Space']) {
    if (player.attack === 'potion') throwPotion(player);
    else if (player.ranged) shootProjectile(player);
    else startAttack(player);
  }
}

// Find the platform whose top is horizontally closest to x.
function nearestPlatform(x) {
  let best = null, bd = Infinity;
  for (const p of platforms) {
    const cxp = Math.max(p.x, Math.min(x, p.x + p.w)); // closest x on this rock
    const d = Math.abs(cxp - x);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function updateAI() {
  const dx = player.x - enemy.x;
  const dist = Math.abs(dx);
  enemy.facing = dx >= 0 ? 1 : -1;
  aiTimer--;

  // TOP PRIORITY: if the computer fell in the lava, scramble out toward the
  // nearest rock — hop repeatedly and run toward it instead of burning.
  if (enemy.inLava) {
    const p = nearestPlatform(enemy.x + enemy.w / 2);
    const targetX = Math.max(p.x, Math.min(enemy.x + enemy.w / 2, p.x + p.w));
    enemy.facing = targetX >= enemy.x + enemy.w / 2 ? 1 : -1;
    enemy.vx = enemy.facing * enemy.speed;
    if (enemy.onGround) enemy.vy = -JUMP_FORCE; // lava counts as ground, so it can jump
    return; // skip normal roaming AND edge-avoidance (which would freeze it over lava)
  }

  if (enemy.hurt > 0) {
    // staggered — don't act this frame
  } else if (enemy.ranged) {
    // RANGED (Nameless one / Ember): roam on its own and shoot. Every so often
    // it picks a fresh intent rather than just mirroring the player.
    if (aiTimer <= 0) {
      const r = Math.random();
      if (dist < 150)      enemy.moveDir = r < 0.7 ? -enemy.facing : 0;   // too close: lean away
      else if (dist > 330) enemy.moveDir = r < 0.7 ?  enemy.facing : 0;   // too far: drift closer
      else                 enemy.moveDir = r < 0.4 ? -1 : (r < 0.8 ? 1 : 0); // mid: free roam
      enemy.wantJump = Math.random() < 0.35;
      aiTimer = 35 + Math.floor(Math.random() * 55);
    }
    enemy.vx = enemy.moveDir * enemy.speed;
    if (enemy.wantJump && enemy.onGround) { enemy.vy = -JUMP_FORCE; enemy.wantJump = false; }
    shootProjectile(enemy);
  } else {
    // CHASER (Blue melee / Corupted Cape potion): close in, then attack at
    // range, hesitating a beat so you get a window to react.
    const closeRange = enemy.attack === 'potion' ? 60 : ATTACK_REACH + 6;
    if (dist < closeRange && Math.abs(player.y - enemy.y) < 34) {
      enemy.vx = 0;
      if (aiTimer <= 0) {
        if (enemy.attack === 'potion') throwPotion(enemy);
        else startAttack(enemy);
        aiTimer = 45;
      }
    } else {
      enemy.vx = enemy.facing * enemy.speed;
      if (enemy.onGround && player.y < enemy.y - 20 &&
          Math.abs(Math.sin(frame * 0.11)) > 0.9) enemy.vy = -JUMP_FORCE;
    }
  }

  // Platform edge handling: ranged fighters stop (stay on their rock);
  // a chaser hops the gap to keep coming after you.
  if (enemy.onGround && enemy.vx !== 0) {
    const dir = Math.sign(enemy.vx);
    const leadX = (dir > 0 ? enemy.x + enemy.w : enemy.x) + dir * 8;
    if (!groundUnder(leadX, enemy.y + enemy.h)) {
      if (enemy.ranged) enemy.vx = 0;
      else enemy.vy = -JUMP_FORCE;
    }
  }
}
