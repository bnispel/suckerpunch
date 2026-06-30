// The per-frame simulation step and the death sequence.
function update() {
  if (gameState === 'dying') { updateDeath(); return; }
  if (gameState !== 'playing') return;
  // remember footing before the jump code clears onGround
  const pGround = player.onGround, eGround = enemy.onGround;
  updatePlayer();
  updateAI();

  // Storm strikes the ground it just leapt off of; Slime leaves a puddle
  maybeStormBolt(player, pGround);
  maybeStormBolt(enemy, eGround);
  maybeSlimePuddle(player, pGround);
  maybeSlimePuddle(enemy, eGround);

  applyPhysics(player);
  applyPhysics(enemy);

  resolveAttack(player, enemy);
  resolveAttack(enemy, player);
  updateProjectiles();
  updateExplosions();
  updatePotions();
  updateBolts();
  updatePuddles();

  updateLavaDamage(player);
  updateLavaDamage(enemy);

  updateTimers(player);
  updateTimers(enemy);

  if (player.hp <= 0 || enemy.hp <= 0) {
    winner = enemy.hp <= 0 ? player : enemy;
    const loser = winner === player ? enemy : player;
    loser.vx = 0; loser.vy = 0;
    if (loser.inLava) {
      loser.deathType = 'sink';   // drown in the lava
      loser.sinking = true;
    } else {
      loser.deathType = 'fall';   // topple over on the rock
      loser.fallAngle = 0;
      loser.fallVel = 0.02;
      loser.fallDir = (loser.x < winner.x) ? -1 : 1; // tip away from the winner
      loser.restTimer = 0;
    }
    gameState = 'dying';
  }
}

// Play out the loser's death, then show the win screen.
function updateDeath() {
  const loser = winner === player ? enemy : player;

  if (loser.deathType === 'sink') {
    // slowly slide under the lava (drawn behind it, so it looks submerged)
    loser.y += 0.8;
    if (loser.y > LAVA_Y + 12) gameState = 'over';
    return;
  }

  // 'fall' — if killed mid-air, drop straight down to the ground first
  // (don't tip over in the air); start toppling only once it lands.
  if (!loser.onGround) {
    loser.vy += GRAVITY;
    loser.y += loser.vy;
    for (const p of platforms) {
      if (loser.vy > 0 && rectsOverlap(loser, p)) {
        loser.y = p.y - loser.h; loser.vy = 0; loser.onGround = true;
      }
    }
    if (loser.y + loser.h >= LAVA_Y) {
      // fell into the lava instead — switch to the sinking death
      loser.y = LAVA_Y - loser.h;
      loser.deathType = 'sink';
      loser.sinking = true;
    }
    return;
  }

  // grounded — topple about the feet like a falling plank, with a damped bounce
  loser.fallVel += 0.012;            // gravity-ish angular acceleration
  loser.fallAngle += loser.fallVel;
  const MAX = Math.PI / 2;           // flat on the ground
  if (loser.fallAngle >= MAX) {
    loser.fallAngle = MAX;
    if (loser.fallVel > 0.05) {
      loser.fallVel = -loser.fallVel * 0.35;   // little bounce on impact
    } else {
      loser.fallVel = 0;
      if (++loser.restTimer > 30) gameState = 'over';
    }
  }
}
