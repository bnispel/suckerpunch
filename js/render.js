// All drawing: background, lava, rocks, crewmates, projectiles, potions, UI.
const ATTACK_LABEL = { melee: 'Tongue lash', triangle: 'Triangle shot', fireball: 'Fireball', potion: 'Potion splash' };

function drawBackground() {
  // reddish lava-planet sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a0d0d');
  g.addColorStop(0.5, '#7a1f12');
  g.addColorStop(1, '#c43a14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // hazy distant glow / embers floating in the sky
  ctx.fillStyle = 'rgba(255,160,60,0.35)';
  for (let i = 0; i < 30; i++) {
    const sx = (i * 137 + Math.sin(frame * 0.02 + i) * 12) % W;
    const sy = (i * 53) % 240 + 10;
    ctx.fillRect(sx, sy, 2, 2);
  }
}

// Floating platforms are downward-pointing gray triangle rocks with red cracks.
function drawTriangleRock(p) {
  const left = p.x, right = p.x + p.w, top = p.y;
  const apexX = p.x + p.w / 2;
  const apexY = p.y + Math.max(p.w * 0.55, 60); // point hangs below the surface

  // rock body
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(apexX, apexY);
  ctx.closePath();
  ctx.fillStyle = '#6e6e76';
  ctx.fill();
  // darker lower shading
  ctx.fillStyle = '#55555c';
  ctx.beginPath();
  ctx.moveTo(left + p.w * 0.5, top + 6);
  ctx.lineTo(right, top);
  ctx.lineTo(apexX, apexY);
  ctx.closePath();
  ctx.fill();
  // dark outline
  ctx.strokeStyle = '#2a2a2e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(apexX, apexY);
  ctx.closePath();
  ctx.stroke();

  // glowing flat top surface (the part you stand on)
  ctx.fillStyle = '#8a8a92';
  ctx.fillRect(left, top, p.w, 4);

  // jagged red cracks — unique per rock (precomputed in p.cracks).
  // Clip to the triangle so cracks stay inside the rock (like overflow:hidden).
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(apexX, apexY);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = '#ff2b16';
  ctx.lineCap = 'round';
  for (const crack of p.cracks) {
    ctx.lineWidth = crack.width;
    ctx.beginPath();
    ctx.moveTo(crack.pts[0][0], crack.pts[0][1]);
    for (let i = 1; i < crack.pts.length; i++) ctx.lineTo(crack.pts[i][0], crack.pts[i][1]);
    ctx.stroke();
  }
  ctx.restore();
}

// Full-width sea of lava across the bottom of the arena.
function drawLava() {
  ctx.fillStyle = '#b5300a';
  ctx.fillRect(0, LAVA_Y, W, H - LAVA_Y);
  ctx.fillStyle = '#ff7a18';
  ctx.beginPath();
  ctx.moveTo(0, LAVA_Y + 4);
  for (let xx = 0; xx <= W; xx += 20) {
    ctx.lineTo(xx, LAVA_Y + 2 + Math.sin(xx * 0.05 + frame * 0.08) * 4);
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
  // bright molten highlights bobbing on the surface
  ctx.fillStyle = '#ffd24a';
  for (let xx = 10; xx < W; xx += 60) {
    const yy = LAVA_Y + Math.sin(xx * 0.05 + frame * 0.08) * 4;
    ctx.fillRect(xx, yy, 24, 2);
  }
}

function drawPlatform(p) {
  drawTriangleRock(p);
}

// Among-Us-style crewmate with per-character flourishes (hat, cape, fire, etc).
function drawCrewmate(f) {
  const x = f.x, y = f.y, dir = f.facing;
  const cx = x + f.w / 2;
  const falling = f.deathType === 'fall';
  const bob = falling ? 0 : Math.sin(frame * 0.12 + (f === enemy ? 2 : 0)) * 1;
  const moving = !falling && f.vx !== 0 && f.onGround;
  const step = moving ? Math.sin(frame * 0.35) * 3 : 0;

  ctx.save();
  ctx.translate(cx, y + bob);
  // toppling-over death: rotate the whole body about its feet
  if (falling) {
    const FEET = 46;
    ctx.translate(0, FEET);
    ctx.rotate(f.fallAngle * f.fallDir);
    ctx.translate(0, -FEET);
  }
  ctx.scale(dir, 1);

  // flash white when hurt — but never while dying/dead (no death color change)
  const hurtFlash = gameState === 'playing' && f.hurt > 0 && (f.hurt % 4 < 2);
  const body = hurtFlash ? '#ffffff' : f.bodyColor;
  const shade = hurtFlash ? '#dddddd' : shadeColor(f.bodyColor, -22);

  const BW = 22, halfW = BW / 2, bodyTop = 2, bodyBot = 40;

  // legs
  ctx.fillStyle = shade;
  ctx.fillRect(-halfW + 2, bodyBot - 2 + step, 8, 8);
  ctx.fillRect(halfW - 10, bodyBot - 2 - step, 8, 8);

  // red cape (Corupted Cape) waving in the wind; everyone else has a backpack.
  // Falling faster (gliding) makes the cape billow harder.
  if (f.cape) {
    const phase = (f === enemy ? 1 : 0);
    const gust = f.vy > 0 ? 1.7 : 1;     // bigger billow while gliding down
    const topX = -halfW + 2, topY = 4, len = 46, baseOut = 12, segs = 6;
    ctx.fillStyle = '#c01818';
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const wave = Math.sin(frame * 0.2 - i * 0.9 + phase) * (2 + t * 7) * gust;
      ctx.lineTo(topX - baseOut * t + wave, topY + len * t);
    }
    ctx.lineTo(-2, topY + len - 4);
    ctx.lineTo(-2, topY);
    ctx.closePath();
    ctx.fill();
    // darker inner fold following a gentler wave
    ctx.fillStyle = '#8e1010';
    ctx.beginPath();
    ctx.moveTo(topX + 1, topY + 2);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const wave = Math.sin(frame * 0.2 - i * 0.9 + phase) * (1 + t * 3) * gust;
      ctx.lineTo((topX + 1) * (1 - t) + (-4) * t + wave, topY + 2 + (len - 6) * t);
    }
    ctx.lineTo(-2, topY + len - 6);
    ctx.lineTo(-2, topY + 2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = shade;
    roundRect(-halfW - 7, 14, 9, 18, 4); ctx.fill();
  }

  // body capsule
  ctx.fillStyle = body;
  roundRect(-halfW, bodyTop, BW, bodyBot - bodyTop, 11); ctx.fill();
  ctx.fillStyle = shade;
  roundRect(-halfW, bodyTop, 6, bodyBot - bodyTop, 6); ctx.fill();

  // visor / lens (no glint dot)
  ctx.fillStyle = f.visorColor;
  roundRect(-2, 9, 14, 9, 4); ctx.fill();

  // chest / head emblem depends on the attack style
  if (f.attack === 'triangle') {
    // triangle cannon — glows when charged
    const charged = f.shootCD < 18;
    ctx.fillStyle = charged ? '#2a2a2a' : '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-6, 26);
    ctx.lineTo(6, 26);
    ctx.lineTo(0, 38);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = charged ? '#7dff7d' : '#2f7a2f';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (f.attack === 'fireball') {
    // fire on the head (Ember) — flickering flames along the crown
    const flick = Math.sin(frame * 0.3 + (f === enemy ? 1 : 0)) * 1.5;
    const tongues = [[-7, 14], [0, 20], [7, 13]]; // [x offset, height]
    for (const [ox, ht] of tongues) {
      ctx.fillStyle = '#d11616'; drawFlame(ox, 5, 5.0, ht, flick);
      ctx.fillStyle = '#ff7a18'; drawFlame(ox, 5, 3.6, ht * 0.75, flick);
      ctx.fillStyle = '#ffd24a'; drawFlame(ox, 5, 2.2, ht * 0.45, flick);
    }
  }

  // witch hat (Corupted Cape) — black cone with a yellow band, leaning forward
  if (f.hat) {
    ctx.fillStyle = '#141414';
    ctx.beginPath();                                 // brim
    ctx.ellipse(1, 2, 15, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();                                 // cone
    ctx.moveTo(-8, 2);
    ctx.lineTo(8, 2);
    ctx.quadraticCurveTo(9, -12, 6, -22);            // tip leans toward facing
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd24a';                       // yellow band
    ctx.beginPath();
    ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.lineTo(6, -5); ctx.lineTo(-6, -5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#141414';                       // buckle
    ctx.fillRect(-2, -4, 4, 4);
  }

  // jagged mouth + lashing tongue — only the melee fighter has these.
  if (f.attack === 'melee') {
    ctx.fillStyle = '#2b2b30';
    roundRect(-2, 24, 14, 11, 3); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const tx = i * 5;
      ctx.beginPath(); ctx.moveTo(tx, 24); ctx.lineTo(tx + 4, 24); ctx.lineTo(tx + 2, 29); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(tx, 35); ctx.lineTo(tx + 4, 35); ctx.lineTo(tx + 2, 30); ctx.closePath(); ctx.fill();
    }

    const attacking = f.attackTimer > 0;
    const ext = attacking ? (ATTACK_REACH * Math.sin((1 - f.attackTimer / ATTACK_ACTIVE) * Math.PI)) : 0;
    if (f.storm) {
      // a blue lightning bolt — only visible while attacking, sharp zig-zag,
      // no glow. Stays hidden when idle.
      if (attacking) {
        const len = 20 + ext;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        ctx.moveTo(11, 30);
        ctx.lineTo(11 + len * 0.32, 23);
        ctx.lineTo(11 + len * 0.5, 32);
        ctx.lineTo(11 + len * 0.74, 25);
        ctx.lineTo(11 + len, 31);
        ctx.strokeStyle = '#1f6fff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = '#bfe0ff'; ctx.lineWidth = 1; ctx.stroke();
      }
    } else {
      const lash = Math.sin(frame * 0.15) * 3;
      ctx.strokeStyle = f.tongueColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(11, 30);
      ctx.quadraticCurveTo(22 + ext * 0.6, 22 + lash, 18 + ext, 30);
      if (!attacking) ctx.quadraticCurveTo(30, 38 - lash, 25, 26); // little curl when idle
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawHealthBars() {
  drawDial(56, 56, 38, player);
  drawDial(W - 56, 56, 38, enemy);
}

// Circular HP gauge: a segmented ring that fills with the fighter's colour,
// with the current HP shown in a hub at the centre.
function drawDial(cx, cy, R, f) {
  const frac = Math.max(0, f.hp / f.maxHp);
  const fill = f.hp > 30 ? f.accent : '#ff4040';

  // empty disc behind the fill
  ctx.fillStyle = '#2a2a30';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // remaining-HP pie, sweeping clockwise from the top
  if (frac > 0) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
    ctx.closePath();
    ctx.fill();
  }

  // spokes every 45° give it the segmented look
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
  }

  // thick outer ring
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

  // white centre hub with the HP number
  const rIn = R * 0.44;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, rIn, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, rIn, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.font = 'bold ' + (f.hp >= 100 ? 13 : 16) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(f.hp), cx, cy + 1);
  ctx.textBaseline = 'alphabetic';

  // name under the dial
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(f.name, cx, cy + R + 15);
  ctx.textAlign = 'left';
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  const youWon = winner === player;
  ctx.fillStyle = winner.accent;
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillText((youWon ? 'You win!' : winner.name + ' wins!'), W / 2, H / 2 - 16);
  ctx.fillStyle = '#ccc';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('You: ' + player.name + '   •   Computer: ' + enemy.name + ' (' + difficultyName + ')', W / 2, H / 2 + 14);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Press R to play again', W / 2, H / 2 + 42);
  ctx.fillStyle = '#888';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Games played: ' + playCount, W / 2, H / 2 + 70);
  ctx.textAlign = 'left';
}

function drawProjectiles() {
  for (const pr of projectiles) {
    ctx.save();
    ctx.translate(pr.x, pr.y);
    if (pr.kind === 'fire') {
      // layered fireball with a flickering size
      const fl = 1 + Math.sin(frame * 0.4 + pr.x) * 0.12;
      ctx.fillStyle = '#d11616'; ctx.beginPath(); ctx.arc(0, 0, pr.size * fl, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7a18'; ctx.beginPath(); ctx.arc(0, 0, pr.size * 0.66 * fl, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, 0, pr.size * 0.33 * fl, 0, Math.PI * 2); ctx.fill();
    } else {
      // spinning triangle
      ctx.rotate(pr.spin);
      ctx.fillStyle = '#1a1a1a';
      ctx.strokeStyle = '#7dff7d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -pr.size);
      ctx.lineTo(pr.size, pr.size);
      ctx.lineTo(-pr.size, pr.size);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPotions() {
  for (const po of potions) {
    if (po.state === 'flying') {
      // a little purple flask tumbling through the air
      ctx.save();
      ctx.translate(po.x, po.y);
      ctx.rotate(Math.sin(frame * 0.3) * 0.5);
      ctx.fillStyle = '#7a1f12';
      ctx.fillRect(-2, -7, 4, 3);            // cork/neck
      ctx.fillStyle = '#8a4cff';
      roundRect(-5, -4, 10, 11, 4); ctx.fill();
      ctx.restore();
    } else {
      // ground splash: purple puddle with slow swirls rising out
      const fade = Math.min(1, po.life / 40);   // fade out near the end
      ctx.save();
      ctx.globalAlpha = 0.55 * fade;
      ctx.fillStyle = '#7a32c8';
      ctx.beginPath();
      ctx.ellipse(po.x, po.y, SPLASH_W / 2, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // rising swirl particles
      ctx.globalAlpha = 0.8 * fade;
      for (let i = 0; i < 5; i++) {
        const t = (frame * 0.04 + i * 1.3);
        const sx = po.x + Math.sin(t) * (SPLASH_W / 2 - 8) * (0.4 + (i % 3) * 0.2);
        const rise = ((frame * 0.6 + i * 22) % 40);
        const sy = po.y - rise;
        ctx.fillStyle = i % 2 ? '#b07cff' : '#8a4cff';
        ctx.beginPath();
        ctx.arc(sx, sy, 3 - rise * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

// Storm's ground lightning strikes rising from where he jumped.
function drawBolts() {
  for (const b of bolts) {
    const a = Math.max(0, b.life / STORM_BOLT_LIFE);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    for (let k = 0; k < 3; k++) {
      const ox = b.x + (k - 1) * 15;
      const ht = 52 + (k % 2) * 12;
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(ox, b.y);
        ctx.lineTo(ox + 6, b.y - ht * 0.3);
        ctx.lineTo(ox - 5, b.y - ht * 0.55);
        ctx.lineTo(ox + 4, b.y - ht * 0.8);
        ctx.lineTo(ox, b.y - ht);
      };
      ctx.strokeStyle = '#1f6fff'; ctx.lineWidth = 4; path(); ctx.stroke();   // bolt
      ctx.strokeStyle = '#bfe0ff'; ctx.lineWidth = 1.5; path(); ctx.stroke(); // bright core
    }
    ctx.restore();
  }
}

// Little burst where two opposing projectiles collided.
function drawExplosions() {
  for (const ex of explosions) {
    const k = 1 - ex.life / EXPLOSION_LIFE;   // 0 -> 1 over its life
    const r = 4 + k * 16;
    ctx.save();
    ctx.globalAlpha = Math.max(0, ex.life / EXPLOSION_LIFE);
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff7a18';
    ctx.beginPath(); ctx.arc(ex.x, ex.y, Math.max(0, r * 0.5), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.arc(ex.x, ex.y, Math.max(0, r * 0.22), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// Top Menu / Restart buttons for touch play.
function drawTouchUI() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const name in TOUCH_UI) {
    const b = TOUCH_UI[name];
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#23232e';
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff88';
    ctx.lineWidth = 1.5;
    roundRect(b.x, b.y, b.w, b.h, 8); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  }
  ctx.restore();
}

// On-screen touch buttons (translucent so the action stays visible behind).
function drawTouchControls() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const name in TOUCH_BTNS) {
    const b = TOUCH_BTNS[name];
    const pressed = touch[name];
    ctx.globalAlpha = pressed ? 0.6 : 0.34;
    ctx.fillStyle = name === 'attack' ? '#e0392b' : name === 'jump' ? '#3a6ff0' : '#ffffff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + (b.label.length > 2 ? 14 : 22) + 'px system-ui, sans-serif';
    ctx.fillText(b.label, b.x, b.y + 1);
  }
  ctx.restore();
}

function draw() {
  drawBackground();

  // A fighter sinking in the lava is drawn BEFORE the lava so the molten
  // surface covers it as it goes under (looks submerged); everyone else
  // draws on top of the lava as usual.
  const loser = winner ? (winner === player ? enemy : player) : null;
  const sinker = loser && loser.sinking ? loser : null;
  if (sinker) drawCrewmate(sinker);

  drawLava();
  for (const p of platforms) drawPlatform(p);
  drawPotions();
  drawBolts();
  drawProjectiles();
  drawExplosions();
  if (enemy !== sinker) drawCrewmate(enemy);
  if (player !== sinker) drawCrewmate(player);
  drawHealthBars();
  // landscape uses on-canvas overlay buttons; portrait uses the DOM bar below
  if (usingTouch && gameState === 'playing' && !portrait) drawTouchControls();
  if (gameState === 'charSelect') drawCharSelect();
  else if (gameState === 'opponentSelect') drawOpponentSelect();
  else if (gameState === 'difficulty') drawDifficulty();
  else if (gameState === 'over') drawGameOver();
  if (controlsOpen) drawControlsDialog();

  // touch Menu/Restart sit on top of the match and the win screen
  if (usingTouch && (gameState === 'playing' || gameState === 'dying' || gameState === 'over')) {
    drawTouchUI();
  }

  // show the portrait DOM control bar only while a match is on
  const barOn = usingTouch && (gameState === 'playing' || gameState === 'dying');
  if (barOn !== _barShown) {
    document.body.classList.toggle('playing', barOn);
    _barShown = barOn;
  }
}
let _barShown = false;

// Small badge showing the player's chosen character (top-left of later menus).
function drawChosenBadge() {
  const c = CHARACTERS[playerCharKey];
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(12, 12, 172, 58, 10); ctx.fill();
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 2;
  roundRect(12, 12, 172, 58, 10); ctx.stroke();

  drawCrewmate(makeFighter(20, 16, 1, playerCharKey, PLAYER_COMBAT));

  ctx.textAlign = 'left';
  ctx.fillStyle = '#9aa0aa';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('YOUR PLAYER', 66, 33);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(c.name, 66, 53);
}

// One character card (caller sets textAlign = center). `disabled` greys it out
// (used for the player's own character on the opponent screen).
function drawCharCard(opt, disabled) {
  const c = CHARACTERS[opt.key];
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.32;

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(opt.x, opt.y, opt.w, opt.h, 12); ctx.fill();
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 3;
  roundRect(opt.x, opt.y, opt.w, opt.h, 12); ctx.stroke();

  drawCrewmate(previews[opt.key]);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(c.name, opt.x + opt.w / 2, opt.y + opt.h - 34);
  ctx.fillStyle = '#bbb';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(c.power || ATTACK_LABEL[c.attack], opt.x + opt.w / 2, opt.y + opt.h - 14);
  ctx.restore();

  if (disabled) {
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('(your player)', opt.x + opt.w / 2, opt.y + 16);
  }
}

function drawCharSelect() {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('SuckerPunch', W / 2, 85);
  ctx.fillStyle = '#ffd24a';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Choose your player', W / 2, 125);

  for (const opt of CHAR_OPTIONS) drawCharCard(opt);

  // current scheme + "Switch Controls" button
  ctx.fillStyle = '#aaa';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Controls: ' + CONTROL_SCHEMES[controlScheme].name, W / 2, 314);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(SWITCH_BTN.x, SWITCH_BTN.y, SWITCH_BTN.w, SWITCH_BTN.h, 8); ctx.fill();
  ctx.strokeStyle = '#ffffff66';
  ctx.lineWidth = 1.5;
  roundRect(SWITCH_BTN.x, SWITCH_BTN.y, SWITCH_BTN.w, SWITCH_BTN.h, 8); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('Switch Controls', SWITCH_BTN.x + SWITCH_BTN.w / 2, SWITCH_BTN.y + 21);

  ctx.fillStyle = '#ccc';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Click a character  •  or press 1 / 2 / 3 / 4 / 5', W / 2, 380);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#888';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Games played: ' + playCount, W - 12, 24);
  ctx.textAlign = 'left';
}

function drawOpponentSelect() {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('Choose your opponent', W / 2, 110);

  for (const opt of CHAR_OPTIONS) drawCharCard(opt, opt.key === playerCharKey);

  // Random opponent button
  ctx.fillStyle = '#2e7d46';
  roundRect(RANDOM_BTN.x, RANDOM_BTN.y, RANDOM_BTN.w, RANDOM_BTN.h, 8); ctx.fill();
  ctx.strokeStyle = '#bfe8c8';
  ctx.lineWidth = 1.5;
  roundRect(RANDOM_BTN.x, RANDOM_BTN.y, RANDOM_BTN.w, RANDOM_BTN.h, 8); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('Random opponent', RANDOM_BTN.x + RANDOM_BTN.w / 2, RANDOM_BTN.y + 20);

  ctx.fillStyle = '#ccc';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Click an opponent or Random  •  1–5  •  R to go back', W / 2, 380);
  drawChosenBadge();
  ctx.textAlign = 'left';
}

function drawControlsDialog() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  const d = DIALOG_PANEL;
  ctx.fillStyle = '#23232e';
  roundRect(d.x, d.y, d.w, d.h, 14); ctx.fill();
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 2;
  roundRect(d.x, d.y, d.w, d.h, 14); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('Choose your controls', W / 2, d.y + 36);

  for (let i = 0; i < CONTROL_OPTIONS.length; i++) {
    const opt = CONTROL_OPTIONS[i], cs = CONTROL_SCHEMES[opt.id];
    const sel = controlScheme === opt.id;
    ctx.fillStyle = sel ? '#3a6ff0' : 'rgba(255,255,255,0.07)';
    roundRect(opt.x, opt.y, opt.w, opt.h, 10); ctx.fill();
    ctx.strokeStyle = sel ? '#cfe0ff' : '#ffffff44';
    ctx.lineWidth = sel ? 2.5 : 1;
    roundRect(opt.x, opt.y, opt.w, opt.h, 10); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(cs.name + (sel ? '  ✓' : ''), opt.x + opt.w / 2, opt.y + 22);
    ctx.fillStyle = sel ? '#dce8ff' : '#bbb';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(cs.summary, opt.x + opt.w / 2, opt.y + 41);
  }

  ctx.fillStyle = '#aaa';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Click a scheme (or press 1 / 2)  •  Esc to close', W / 2, d.y + d.h - 12);
  ctx.textAlign = 'left';
}

function drawDifficulty() {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  const oppName = opponentCharKey ? CHARACTERS[opponentCharKey].name : 'Random';
  ctx.fillText(CHARACTERS[playerCharKey].name + '  vs  ' + oppName, W / 2, 120);
  ctx.fillStyle = '#ffd24a';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Choose the computer difficulty', W / 2, 165);

  for (const opt of DIFF_OPTIONS) {
    ctx.fillStyle = opt.color;
    roundRect(opt.x, opt.y, opt.w, opt.h, 12); ctx.fill();
    ctx.strokeStyle = '#ffffffaa';
    ctx.lineWidth = 2;
    roundRect(opt.x, opt.y, opt.w, opt.h, 12); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(opt.name, opt.x + opt.w / 2, opt.y + 44);
  }

  ctx.fillStyle = '#ccc';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Click a level  •  press 1 / 2 / 3  •  R to go back', W / 2, 330);
  drawChosenBadge();
  ctx.textAlign = 'left';
}
