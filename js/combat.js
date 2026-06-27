// Attacks: melee tongue lash, projectiles (triangle / fireball), and potions.

function startAttack(f) {
  if (f.cooldown === 0 && f.attackTimer === 0) {
    f.attackTimer = ATTACK_ACTIVE;
    f.cooldown = ATTACK_ACTIVE + f.atkCooldown;
    f.hitDone = false;
  }
}

// The tongue's hit area: a box extending in front of the fighter.
function attackHitbox(f) {
  const front = f.facing === 1 ? f.x + f.w : f.x - ATTACK_REACH;
  return { x: front, y: f.y + 16, w: ATTACK_REACH, h: 20 };
}

function resolveAttack(attacker, target) {
  if (attacker.attackTimer > 0 && !attacker.hitDone) {
    // only the first part of the lash connects
    if (attacker.attackTimer > ATTACK_ACTIVE - 10) {
      if (rectsOverlap(attackHitbox(attacker), target)) {
        target.hp = Math.max(0, target.hp - attacker.damage);
        target.hurt = 10;
        target.vx = attacker.facing * 5;     // knockback
        target.vy = -4;
        attacker.hitDone = true;
      }
    }
  }
}

// Fire a projectile toward the player — a spinning triangle (Nameless one) or a
// fireball (Ember). Rate, speed and damage come from the fighter.
function shootProjectile(f) {
  if (f.shootCD > 0) return;
  f.shootCD = f.shootCooldown;
  const kind = f.attack === 'fireball' ? 'fire' : 'triangle';
  const ox = f.x + f.w / 2 + f.facing * 14;
  const oy = f.y + 22;
  projectiles.push({
    x: ox, y: oy, vx: f.facing * f.projSpeed, vy: 0,
    size: kind === 'fire' ? 12 : 11, spin: 0, owner: f, damage: f.projDamage, kind,
  });
}

function updateProjectiles() {
  for (const pr of projectiles) {
    pr.x += pr.vx;
    pr.y += pr.vy;
    pr.spin += 0.25;
    const box = { x: pr.x - pr.size, y: pr.y - pr.size, w: pr.size * 2, h: pr.size * 2 };
    const target = pr.owner === enemy ? player : enemy;
    if (!pr.dead && rectsOverlap(box, target)) {
      target.hp = Math.max(0, target.hp - pr.damage);
      target.hurt = 10;
      target.vx = Math.sign(pr.vx) * 4;
      target.vy = -3;
      pr.dead = true;
    }
    if (pr.x < -20 || pr.x > W + 20) pr.dead = true;
  }
  projectiles = projectiles.filter(pr => !pr.dead);
}

// Corupted Cape's potion: thrown to the ground, leaves a damaging purple splash.
function throwPotion(f) {
  if (f.shootCD > 0) return;
  f.shootCD = f.shootCooldown;
  potions.push({
    state: 'flying',
    x: f.x + f.w / 2 + f.facing * 12, y: f.y + 18,
    vx: f.facing * 4, vy: -4, owner: f, life: SPLASH_LIFE, tick: 0,
  });
}

// Storm: when he jumps off the ground, lightning erupts from the spot he left.
function spawnStormBolt(f) {
  bolts.push({ x: f.x + f.w / 2, y: f.y + f.h, life: STORM_BOLT_LIFE, owner: f });
}

// Called just before physics: if a Storm fighter is about to leap off solid
// ground (not the lava), strike lightning from where it stood.
function maybeStormBolt(f) {
  if (f.storm && f.onGround && !f.inLava && f.vy < 0) spawnStormBolt(f);
}

function updateBolts() {
  for (const b of bolts) {
    b.life--;
    // zap the opponent if they're standing in the strike during its first frames
    if (!b.hitDone && b.life > STORM_BOLT_LIFE - 14) {
      const target = b.owner === enemy ? player : enemy;
      const zone = { x: b.x - 22, y: b.y - 54, w: 44, h: 58 };
      if (rectsOverlap(zone, target)) {
        target.hp = Math.max(0, target.hp - STORM_BOLT_DAMAGE);
        target.hurt = 10;
        target.vy = -4;
        b.hitDone = true;
      }
    }
    if (b.life <= 0) b.dead = true;
  }
  bolts = bolts.filter(b => !b.dead);
}

function updatePotions() {
  for (const po of potions) {
    if (po.state === 'flying') {
      po.vy += GRAVITY;
      po.x += po.vx;
      po.y += po.vy;
      // land on a platform top, or splat on the lava
      let landY = null;
      if (po.vy > 0) {
        for (const p of platforms) {
          if (po.x >= p.x && po.x <= p.x + p.w && po.y >= p.y && po.y <= p.y + 24) { landY = p.y; break; }
        }
      }
      if (landY === null && po.y >= LAVA_Y) landY = LAVA_Y;
      if (landY !== null) { po.state = 'splash'; po.y = landY; po.tick = 0; }
      if (po.x < -10 || po.x > W + 10) po.dead = true;
    } else {
      // splash: damage whoever stands in it, ~5 dmg/sec
      po.life--;
      po.tick++;
      const target = po.owner === enemy ? player : enemy;
      const zone = { x: po.x - SPLASH_W / 2, y: po.y - 30, w: SPLASH_W, h: 32 };
      if (po.tick % POTION_TICK === 0 && rectsOverlap(zone, target)) {
        target.hp = Math.max(0, target.hp - POTION_DAMAGE);
        target.hurt = 4;
      }
      if (po.life <= 0) po.dead = true;
    }
  }
  potions = potions.filter(po => !po.dead);
}
