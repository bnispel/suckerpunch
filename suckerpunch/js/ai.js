// Player controls and the computer opponent's behavior.

function updatePlayer() {
  const cs = CONTROL_SCHEMES[controlScheme];
  const goLeft  = keys['ArrowLeft']  || touch.left;
  const goRight = keys['ArrowRight'] || touch.right;
  if (goLeft && !goRight)      { player.vx = -player.speed; player.facing = -1; }
  else if (goRight && !goLeft) { player.vx = player.speed;  player.facing = 1; }
  else player.vx = 0;

  const jumpHeld = keys[cs.jump] || touch.jump;
  if (jumpHeld && (player.onGround || player.inLava)) {
    // normal jump; from the lava it passes up through any platform above
    player.vy = -JUMP_FORCE;
    if (player.inLava) player.escapingLava = true;
    player.onGround = false;
  }
  const fightHeld = cs.fight.some(k => keys[k]) || touch.attack;
  if (fightHeld) {
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
    // normal jump out of the lava; like the player, it passes up through platforms
    if (enemy.onGround) { enemy.vy = -JUMP_FORCE; enemy.escapingLava = true; }
    return; // skip normal roaming AND edge-avoidance (which would freeze it over lava)
  }

  // Stuck detection (chasers only): if it's barely making progress and not
  // actually engaging — e.g. shuffling on a rock right above you — it commits
  // to walking off the platform toward you for a moment.
  if (!enemy.ranged) {
    enemy.sampleT = (enemy.sampleT || 0) + 1;
    if (enemy.sampleT >= 40) {
      const moved = Math.abs(enemy.x - (enemy.sampleX != null ? enemy.sampleX : enemy.x));
      const engaging = dist < 70 && Math.abs(player.y - enemy.y) < 34;
      enemy.stuckN = (moved < 20 && enemy.onGround && !engaging) ? (enemy.stuckN || 0) + 1 : 0;
      enemy.sampleX = enemy.x;
      enemy.sampleT = 0;
      if (enemy.stuckN >= 2 && !enemy.unstick) {
        const cp = groundUnder(enemy.x + enemy.w / 2, enemy.y + enemy.h);
        let dir = Math.sign(dx) || 1;
        // if you're roughly straight below, head for the nearer edge
        if (cp && Math.abs(dx) < 30) {
          dir = (enemy.x - cp.x) < (cp.x + cp.w - (enemy.x + enemy.w)) ? -1 : 1;
        }
        enemy.unstick = 50;
        enemy.unstickDir = dir;
        enemy.stuckN = 0;
      }
    }
  }

  // Unstick: march decisively to the edge and leave the platform (drop toward
  // the player, or hop a gap), overriding the normal mirror-the-player logic.
  if (enemy.unstick > 0) {
    enemy.unstick--;
    enemy.facing = enemy.unstickDir;
    enemy.vx = enemy.unstickDir * enemy.speed;
    if (enemy.onGround) {
      const leadX = (enemy.unstickDir > 0 ? enemy.x + enemy.w : enemy.x) + enemy.unstickDir * 8;
      if (!groundUnder(leadX, enemy.y + enemy.h) && player.y <= enemy.y + 24) {
        enemy.vy = -JUMP_FORCE;   // edge with no lower target — hop across
      }
    }
    return;
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

  // Platform edge handling. Ranged fighters just stop and hold their rock.
  // A chaser at a ledge decides what to do instead of hopping in place
  // (which used to make it jitter forever on a rock above the player):
  //   • player is below  -> walk off the edge and drop down toward them
  //   • a rock is in reach -> hop the gap to keep chasing
  //   • otherwise          -> stop at the edge (don't jitter)
  if (enemy.onGround && enemy.vx !== 0) {
    const dir = Math.sign(enemy.vx);
    const leadX = (dir > 0 ? enemy.x + enemy.w : enemy.x) + dir * 8;
    if (!groundUnder(leadX, enemy.y + enemy.h)) {
      if (enemy.ranged) {
        enemy.vx = 0;
      } else if (player.y > enemy.y + 24) {
        // player is on a lower platform: keep walking so it falls off and down
      } else if (platformAhead(enemy, dir)) {
        enemy.vy = -JUMP_FORCE;   // a reachable rock ahead — hop the gap
      } else {
        enemy.vx = 0;             // nowhere to land — stop rather than jitter
      }
    }
  }
}

// Is there a platform a chaser could jump to just ahead in direction dir
// (near edge within horizontal reach, top at a height a jump can clear)?
function platformAhead(f, dir) {
  const footY = f.y + f.h;
  const fromX = dir > 0 ? f.x + f.w : f.x;
  for (const p of platforms) {
    const nearEdge = dir > 0 ? p.x : p.x + p.w;
    const ahead = (nearEdge - fromX) * dir;          // distance in front of the foot
    if (ahead > 4 && ahead < 130 && p.y <= footY + 4 && p.y >= footY - 120) return true;
  }
  return false;
}
