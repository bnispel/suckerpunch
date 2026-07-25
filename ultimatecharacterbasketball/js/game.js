// Ultimate Character Basketball — starter scene.
//
// The court is drawn as if from the stands: crowd behind, a hoop at each end,
// a hardwood floor in gentle perspective. Two characters share one ball:
//   • bball — a basketball with a face, Kirby feet (you control him, green team)
//   • flame — a fireball that runs fast and shoots a touch better (AI, red team)
// Whoever touches the loose ball grabs it; it sticks to a hand until a shot.
// Styling follows the court-1 reference drawings.
//
// Controls:  ← →  move along the court     ↑ ↓  move farther / closer
//            Space  shoot (with the ball) / jump (empty-handed)
//            J      jump — near your net with the ball it becomes a dunk

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

let frame = 0;             // engine loop increments this each frame
const FLOOR_Y = 470;       // reference floor line for the loose ball
const GRAVITY = 0.55;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const rand = () => Math.random() * 2 - 1;   // -1..1

// ---- Court geometry ------------------------------------------------------
// A gentle receding perspective: the floor is a trapezoid, wide at the front
// (near the viewer) and narrower at the back. courtPt() maps court coords
// (u: 0 = left baseline .. 1 = right baseline, v: 0 = far .. 1 = near) to
// screen pixels so every marking — and the characters — sit on the floor.
const COURT = { farY: 250, nearY: 520, farL: 140, farR: 660, nearL: 12, nearR: 788 };
function courtPt(u, v) {
  const y = COURT.farY + (COURT.nearY - COURT.farY) * v;
  const lx = COURT.farL + (COURT.nearL - COURT.farL) * v;
  const rx = COURT.farR + (COURT.nearR - COURT.farR) * v;
  return { x: lx + (rx - lx) * u, y };
}
// How big things at depth v look, relative to the front of the court.
function courtScale(v) {
  return (courtPt(1, v).x - courtPt(0, v).x) / (courtPt(1, 1).x - courtPt(0, 1).x);
}

// ---- Teams ----------------------------------------------------------------
// Each team owns one basket (and shoots only at it). Team colour drives both
// the player's colours and that team's scoreboard.
const TEAMS = {
  green: { name: 'GREEN', color: '#2fb84a', rim: 0 },  // left basket
  red: { name: 'RED', color: '#e23b3b', rim: 1 },      // right basket
};
const RIM_OWNER = ['green', 'red'];                    // rim index -> team key
const scores = { green: 0, red: 0 };

// ---- Players --------------------------------------------------------------
function makePlayer(cfg) {
  return {
    kind: cfg.kind, team: cfg.team, ai: !!cfg.ai,
    u: cfg.u, v: cfg.v, r: 28, dir: cfg.dir || 1,
    speedU: 0.01, speedV: 0.0095, speedMul: cfg.speedMul || 1,
    accBonus: cfg.accBonus || 0,
    air: 0, vAir: 0, airborne: false,   // vertical hop, in floor-space pixels
    sx: 1, sy: 1, impact: 0,            // squash & stretch
    walkPhase: 0, blinkPhase: randomBlinkPhase(),
    uMin: 0.05, uMax: 0.95, vMin: 0.16, vMax: 0.97,
    aiReact: 0, aiRest: 0, wasHeld: false,   // AI: gather on catch, rest after a shot
    shootU: 0.5, shootV: 0.5,                // AI: the spot he'll shoot from this possession
  };
}
const bball = makePlayer({ kind: 'bball', team: 'green', u: 0.3, v: 0.72, dir: 1 });
const flame = makePlayer({ kind: 'flame', team: 'red', u: 0.7, v: 0.6, dir: -1, ai: true, speedMul: 0.85, accBonus: 0.05 });
const players = [bball, flame];

// Screen position of a player's body centre (and the floor point under him).
function playerCenter(p) {
  const foot = courtPt(p.u, p.v);
  const scale = courtScale(p.v);
  return { cx: foot.x, cy: foot.y - (p.r + 5 + p.air) * scale, footY: foot.y, scale };
}
function clampPlayer(p) {
  p.u = clamp(p.u, p.uMin, p.uMax);
  p.v = clamp(p.v, p.vMin, p.vMax);
}

// ---- The ball + the two rims ----------------------------------------------
const RIMS = [{ x: 118, y: 176 }, { x: 682, y: 176 }];
const ball = {
  r: 12, x: 400, y: FLOOR_Y - 12, vx: 0, vy: 0,
  heldBy: null, cooldown: 0, willMake: true, inside: false, resolved: true, dunk: false,
};
const swish = { t: 0, x: 0, y: 0, pts: 2 };

// Where the ball sits when a player is holding it (up at his front hand).
function handPos(p) {
  const b = playerCenter(p);
  return { x: b.cx + p.dir * (p.r - 2) * b.scale, y: b.cy - 10 * b.scale };
}

// ---- Game clock: four one-minute quarters ---------------------------------
const QUARTER_FRAMES = 60 * 60;                        // ~1 minute at 60fps
let quarter = 1;
let quarterFrame = 0;
let gameOver = false;

function resetGame() {
  scores.green = 0; scores.red = 0;
  quarter = 1; quarterFrame = 0; gameOver = false;
  ball.heldBy = null; ball.resolved = true; ball.cooldown = 0;
  ball.x = 400; ball.y = FLOOR_Y - 12; ball.vx = 0; ball.vy = 0;
  bball.u = 0.3; bball.v = 0.72; flame.u = 0.7; flame.v = 0.6;
  for (const p of players) { p.air = 0; p.vAir = 0; p.airborne = false; }
  swish.t = 0;
}

// ---- Input: arrows to move, Space to shoot/jump, J to jump ----------------
const keys = {};
let pressSpace = false, pressJ = false, pressH = false;
addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
  if (!e.repeat && e.key === ' ') pressSpace = true;
  if (!e.repeat && (e.key === 'j' || e.key === 'J')) pressJ = true;
  if (!e.repeat && (e.key === 'h' || e.key === 'H')) pressH = true;
  keys[e.key] = true;
});
addEventListener('keyup', (e) => { keys[e.key] = false; });

// ---- Shooting -------------------------------------------------------------
function releaseBall(isDunk) {
  ball.heldBy = null; ball.cooldown = 40; ball.resolved = false; ball.dunk = isDunk;
}

// A jump: near your own net with the ball it becomes a dunk attempt.
function attemptJump(p) {
  if (p.airborne) return;
  if (ball.heldBy === p) {
    const b = playerCenter(p);
    const target = RIMS[TEAMS[p.team].rim];
    if (Math.abs(b.cx - target.x) < 95) { dunkShot(p); return; }
  }
  p.airborne = true; p.vAir = 12;
}

// Slam it down through your own rim — usually good, sometimes stuffed.
function dunkShot(p) {
  const target = RIMS[TEAMS[p.team].rim];
  releaseBall(true);
  ball.inside = true;
  ball.willMake = Math.random() < clamp(0.78 + p.accBonus, 0.5, 0.95);
  if (!p.airborne) { p.airborne = true; p.vAir = 9; }
  ball.x = target.x; ball.y = target.y - 26; ball.vx = 0; ball.vy = 7;
}

// An arc shot toward your own basket. Accuracy falls off with distance.
function launchShot(p) {
  const b = playerCenter(p);
  const target = RIMS[TEAMS[p.team].rim];
  p.dir = target.x < b.cx ? -1 : 1;                 // turn to face it
  const s = handPos(p);
  releaseBall(false);

  const baseU = TEAMS[p.team].rim;
  const du = (p.u - baseU) / 0.33, dv = (p.v - 0.5) / 0.4;
  ball.inside = du * du + dv * dv < 1;

  const dist = Math.hypot(b.cx - target.x, b.cy - target.y);
  const makeChance = clamp(0.95 - dist * 0.0011 + p.accBonus, 0.4, 0.95);
  ball.willMake = Math.random() < makeChance;

  let aimX = target.x, aimY = target.y;
  const side = Math.random() < 0.5 ? -1 : 1;
  if (ball.willMake) { aimX += rand() * 6; aimY += rand() * 4; }
  else if (ball.inside) { aimX += side * (8 + Math.random() * 12); aimY += -4 + Math.random() * 8; }
  else { aimX += side * (24 + Math.random() * 20); aimY += rand() * 10; }

  const T = 36;
  ball.x = s.x; ball.y = s.y;
  ball.vx = (aimX - s.x) / T;
  ball.vy = (aimY - s.y) / T - 0.5 * GRAVITY * T;
}

// ---- Movement helpers -----------------------------------------------------
function seekCourt(p, tu, tv) {
  let mv = false;
  const su = p.speedU * p.speedMul, sv = p.speedV * p.speedMul;
  if (Math.abs(tu - p.u) > 0.012) { const d = tu > p.u ? 1 : -1; p.u += su * d; p.dir = d; mv = true; }
  if (Math.abs(tv - p.v) > 0.012) { p.v += sv * (tv > p.v ? 1 : -1); mv = true; }
  clampPlayer(p);
  return mv;
}
function seekScreen(p, tx, ty) {
  const b = playerCenter(p);
  let mv = false;
  const su = p.speedU * p.speedMul, sv = p.speedV * p.speedMul;
  if (Math.abs(tx - b.cx) > 10) { const d = tx > b.cx ? 1 : -1; p.u += su * d; p.dir = d; mv = true; }
  if (Math.abs(ty - b.footY) > 12) { p.v += sv * (ty > b.footY ? 1 : -1); mv = true; }
  clampPlayer(p);
  return mv;
}

// ---- Physics + AI ---------------------------------------------------------
function updatePlayerPhysics(p) {
  if (p.airborne) {
    p.vAir -= GRAVITY;
    p.air += p.vAir;
    if (p.air <= 0) {
      p.air = 0; p.impact = 1;
      if (Math.abs(p.vAir) > 2.4) p.vAir = -p.vAir * 0.62;   // a bounce
      else { p.vAir = 0; p.airborne = false; }               // settle
    }
  }
  p.impact *= 0.82;
  if (p.impact > 0.02) { p.sx = 1 + p.impact * 0.3; p.sy = 1 - p.impact * 0.26; }
  else if (p.airborne) { const st = Math.min(0.16, Math.abs(p.vAir) * 0.013); p.sx = 1 - st * 0.6; p.sy = 1 + st; }
  else { p.sx += (1 - p.sx) * 0.3; p.sy += (1 - p.sy) * 0.3; }
}

function handleHuman(p) {
  const left = keys['ArrowLeft'], right = keys['ArrowRight'];
  const up = keys['ArrowUp'], down = keys['ArrowDown'];
  let moving = false;
  if (left && !right) { p.dir = -1; p.u -= p.speedU * p.speedMul; moving = true; }
  else if (right && !left) { p.dir = 1; p.u += p.speedU * p.speedMul; moving = true; }
  if (up && !down) { p.v -= p.speedV * p.speedMul; moving = true; }
  else if (down && !up) { p.v += p.speedV * p.speedMul; moving = true; }
  clampPlayer(p);
  if (moving && !p.airborne) p.walkPhase += 0.22;

  const holding = ball.heldBy === p;
  if (pressSpace) { if (holding) launchShot(p); else attemptJump(p); }
  if (pressJ) attemptJump(p);

  // steal: press H while touching the player who has the ball
  if (pressH && !holding && ball.heldBy && ball.heldBy !== p) {
    const other = ball.heldBy;
    const a = playerCenter(p), o = playerCenter(other);
    const reach = p.r * a.scale + other.r * o.scale + 10;
    if (Math.hypot(a.cx - o.cx, a.cy - o.cy) < reach) {
      ball.heldBy = p; ball.resolved = false; ball.cooldown = 0;
      other.aiRest = 24;                 // knocked off balance for a moment
    }
  }
}

function updateAI(p) {
  const target = RIMS[TEAMS[p.team].rim];
  const basketU = TEAMS[p.team].rim;
  const b = playerCenter(p);
  let moving = false;

  const hasBall = ball.heldBy === p;
  if (hasBall && !p.wasHeld) {                                // just grabbed it:
    p.aiReact = 45;                                          //   brief gather, then...
    const toCenter = basketU < 0.5 ? 1 : -1;                //   pick a spot to shoot from,
    p.shootU = clamp(basketU + toCenter * (0.03 + Math.random() * 0.42), 0.06, 0.94); // rim..deep three
    p.shootV = 0.32 + Math.random() * 0.36;                 //   in a random lane
  }
  if (!hasBall && p.wasHeld) p.aiRest = 80;                  // just shot — wait a beat
  p.wasHeld = hasBall;
  if (p.aiReact > 0) p.aiReact--;
  if (p.aiRest > 0) p.aiRest--;

  if (p.aiRest > 0) {
    // resting after a shot: stand and watch, giving you time to grab the ball
  } else if (hasBall) {
    moving = seekCourt(p, p.shootU, p.shootV);                // walk to his chosen spot
    const dx = Math.abs(b.cx - target.x);
    if (p.aiReact <= 0 && Math.abs(p.u - p.shootU) < 0.02) {  // arrived: let it fly
      if (dx < 85) attemptJump(p);                            // right at the rim: dunk
      else launchShot(p);                                     // otherwise a jump shot from here
    }
  } else if (!ball.heldBy) {
    moving = seekScreen(p, ball.x, ball.y);                   // chase the loose ball
  } else {
    moving = seekCourt(p, 0.6, 0.5);                          // opponent has it: hang back
  }
  if (moving && !p.airborne) p.walkPhase += 0.22;
}

function updateBall() {
  if (ball.heldBy) {
    const s = handPos(ball.heldBy);
    ball.x = s.x; ball.y = s.y; ball.vx = 0; ball.vy = 0;
    return;
  }

  ball.vy += GRAVITY;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // The ball's one encounter with the rim on the way down decides the shot.
  if (!ball.resolved && ball.vy > 0) {
    for (let i = 0; i < RIMS.length; i++) {
      const rim = RIMS[i];
      const d = Math.hypot(ball.x - rim.x, ball.y - rim.y);
      if (d < 24) {
        ball.resolved = true;
        if (ball.willMake) {
          const pts = ball.inside ? 2 : 3;                                       // outside the arc = 3
          scores[RIM_OWNER[i]] += pts;
          swish.t = 45; swish.x = rim.x; swish.y = rim.y; swish.pts = pts;
          ball.x = 400; ball.y = FLOOR_Y - 12; ball.vx = 0; ball.vy = 0;         // back to centre for the next possession
          ball.cooldown = 45;
        } else if (ball.dunk) {
          const away = rim.x < W / 2 ? 1 : -1;                                   // stuffed — up and out
          ball.vx = away * (2 + Math.random() * 2);
          ball.vy = -(3 + Math.random() * 3);
        } else if (ball.inside) {
          ball.vx *= 0.15;                                                       // drop below the hoop
          ball.vy = Math.abs(ball.vy) * 0.5 + 1;
        } else {
          const nx = (ball.x - rim.x) / (d || 1);                               // clang out
          ball.vx = nx * 3.5 + ball.vx * 0.1;
          ball.vy = -Math.abs(ball.vy) * 0.45;
        }
      }
    }
  }

  // floor bounce (rolls to a stop) + side walls
  const rest = FLOOR_Y - ball.r;
  if (ball.y > rest) {
    ball.y = rest;
    ball.vy = Math.abs(ball.vy) > 1.5 ? -ball.vy * 0.6 : 0;
    ball.vx *= 0.8;
  }
  if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -0.5; }
  if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx *= -0.5; }

  // whoever gets to the loose ball first grabs it (after the shot cooldown)
  if (ball.cooldown > 0) ball.cooldown--;
  else {
    let best = null, bestD = 1e9;
    for (const p of players) {
      const b = playerCenter(p);
      const d = Math.hypot(ball.x - b.cx, ball.y - b.cy);
      if (d < p.r * b.scale + ball.r + 6 && d < bestD) { best = p; bestD = d; }
    }
    if (best) { ball.heldBy = best; ball.resolved = false; }
  }
}

function update() {
  // between the final buzzer and a restart, everything is frozen
  if (gameOver) {
    if (keys['Enter']) resetGame();
    pressSpace = false; pressJ = false; pressH = false;
    return;
  }

  // run the game clock; roll into the next quarter (or end the game)
  quarterFrame++;
  if (quarterFrame >= QUARTER_FRAMES) {
    if (quarter < 4) { quarter++; quarterFrame = 0; }
    else { gameOver = true; quarterFrame = QUARTER_FRAMES; }
  }

  handleHuman(bball);
  updateAI(flame);
  for (const p of players) updatePlayerPhysics(p);
  updateBall();

  pressSpace = false; pressJ = false; pressH = false;
  if (swish.t > 0) swish.t--;
}

// ---- Background: arena, stands, hardwood floor ---------------------------
function drawArena() {
  ctx.fillStyle = '#12161f';                       // ceiling / upper dark
  ctx.fillRect(0, 0, W, COURT.farY);

  for (const d of crowdDots) {                     // crowd in the stands
    ctx.fillStyle = d.c;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = '#22314f';                       // courtside padded wall
  ctx.fillRect(0, 152, W, COURT.farY - 152);
  ctx.fillStyle = '#3a5da8';
  ctx.fillRect(0, 152, W, 6);                      // bright accent stripe

  ctx.fillStyle = '#c2823f';                       // hardwood apron (darker)
  ctx.fillRect(0, COURT.farY, W, H - COURT.farY);

  const a = courtPt(0, 0), b = courtPt(1, 0), c = courtPt(1, 1), d = courtPt(0, 1);
  ctx.fillStyle = '#e3b877';                       // playing surface (lighter)
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = 'rgba(150,100,50,.16)';        // faint planks
  ctx.lineWidth = 1;
  for (let v = 0.12; v < 1; v += 0.12) {
    const p0 = courtPt(0, v), p1 = courtPt(1, v);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }

  drawCourtLines();
}

// Static crowd speckle for the stands (built once so it doesn't flicker).
const crowdDots = [];
(function initCrowd() {
  const colors = ['#c94f4f', '#4f6ec9', '#d3b23e', '#5aa15a', '#b06fc0', '#d98b3e', '#dcdce2'];
  for (let y = 64; y < 150; y += 11) {
    for (let x = 6; x < W; x += 13) {
      crowdDots.push({
        x: x + (Math.random() * 6 - 3),
        y: y + (Math.random() * 4 - 2),
        c: colors[Math.floor(Math.random() * colors.length)],
        r: 2.3 + Math.random() * 1.3,
      });
    }
  }
})();

function courtEllipse(u, v, rxU, ryV) {
  const c = courtPt(u, v);
  const l = courtPt(u - rxU, v), r = courtPt(u + rxU, v);
  const rx = (r.x - l.x) / 2;
  const ry = (courtPt(u, Math.min(1, v + ryV)).y - courtPt(u, Math.max(0, v - ryV)).y) / 2;
  ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
}

function courtQuad(u0, v0, u1, v1) {
  const p = [courtPt(u0, v0), courtPt(u1, v0), courtPt(u1, v1), courtPt(u0, v1)];
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y);
  ctx.closePath();
}

// The free-throw key: three straight sides, with the centre-facing side
// bulging out as the free-throw semicircle.
function drawKey(baseU, ftU) {
  const vTop = 0.29, vBot = 0.71, vc = 0.5, rv = (vBot - vTop) / 2, ru = 0.06;
  const dir = ftU < 0.5 ? 1 : -1;
  const top = courtPt(baseU, vTop), bot = courtPt(baseU, vBot), ftTop = courtPt(ftU, vTop);
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(ftTop.x, ftTop.y);
  for (let i = 0; i <= 20; i++) {
    const a = -Math.PI / 2 + Math.PI * (i / 20);
    const p = courtPt(ftU + Math.cos(a) * ru * dir, vc + Math.sin(a) * rv);
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(bot.x, bot.y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(58,93,168,.22)'; ctx.fill();
  ctx.strokeStyle = '#f4efe4'; ctx.lineWidth = 3; ctx.stroke();
}

// Three-point line: short corner straights off the baseline into a big arc.
function drawThreePoint(baseU) {
  const dir = baseU < 0.5 ? 1 : -1;
  const cv = 0.5, ru = 0.33, rv = 0.4, A = 1.24;   // ~71 degrees each side
  ctx.strokeStyle = '#f4efe4'; ctx.lineWidth = 3;
  ctx.beginPath();
  const s = courtPt(baseU, cv + Math.sin(-A) * rv);
  ctx.moveTo(s.x, s.y);
  for (let i = 0; i <= 28; i++) {
    const a = -A + 2 * A * (i / 28);
    const p = courtPt(baseU + Math.cos(a) * ru * dir, cv + Math.sin(a) * rv);
    ctx.lineTo(p.x, p.y);
  }
  const e = courtPt(baseU, cv + Math.sin(A) * rv);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();
}

function drawCourtLines() {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = '#f4efe4'; ctx.lineWidth = 3;  // court boundary
  courtQuad(0, 0, 1, 1); ctx.stroke();

  drawKey(0, 0.19);                                // free-throw keys
  drawKey(1, 0.81);
  drawThreePoint(0);                               // three-point lines
  drawThreePoint(1);

  courtEllipse(0.5, 0.5, 0.09, 0.16); ctx.stroke();// centre circle

  ctx.strokeStyle = '#f2c515'; ctx.lineWidth = 5;  // yellow centre line
  const t = courtPt(0.5, 0), n = courtPt(0.5, 1);
  ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(n.x, n.y); ctx.stroke();
}

// ---- Hoop (court-1 style: red backboard + red rim + gray net) ------------
function drawHoop(poleBaseX, boardCX, side, teamColor) {
  const boardTop = 124, boardH = 48, boardW = 64;
  const boardBottom = boardTop + boardH;
  const rimY = boardBottom + 4;
  const rimRx = 20, rimRy = 6;

  ctx.strokeStyle = '#8a9099'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(poleBaseX, 330); ctx.lineTo(poleBaseX, boardTop + 20);
  ctx.lineTo(boardCX + side * (boardW / 2), boardTop + 20);
  ctx.stroke();

  ctx.fillStyle = teamColor;                        // team-colour tab on top
  roundRect(boardCX - 15, boardTop - 9, 30, 10, 3); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
  roundRect(boardCX - 15, boardTop - 9, 30, 10, 3); ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,.92)';         // backboard panel
  roundRect(boardCX - boardW / 2, boardTop, boardW, boardH, 4); ctx.fill();
  ctx.strokeStyle = '#d8202a'; ctx.lineWidth = 4;  // red frame
  roundRect(boardCX - boardW / 2, boardTop, boardW, boardH, 4); ctx.stroke();
  ctx.lineWidth = 3;                               // red shooter's square
  ctx.strokeRect(boardCX - 13, boardTop + boardH - 26, 26, 17);

  ctx.strokeStyle = '#d8202a'; ctx.lineWidth = 3;  // rim
  ctx.beginPath(); ctx.ellipse(boardCX, rimY, rimRx, rimRy, 0, 0, Math.PI * 2); ctx.stroke();

  ctx.strokeStyle = 'rgba(150,150,155,.85)'; ctx.lineWidth = 1.2;  // gray net
  const netH = 30, botHalf = 7;
  for (let i = 0; i <= 6; i++) {
    const tt = i / 6;
    const topX = boardCX - rimRx + 2 * rimRx * tt;
    const botX = boardCX - botHalf + 2 * botHalf * tt;
    ctx.beginPath(); ctx.moveTo(topX, rimY); ctx.lineTo(botX, rimY + netH); ctx.stroke();
  }
  for (let k = 1; k <= 2; k++) {
    const yy = rimY + (netH * k) / 3;
    const half = rimRx - (rimRx - botHalf) * (k / 3);
    ctx.beginPath(); ctx.moveTo(boardCX - half, yy); ctx.lineTo(boardCX + half, yy); ctx.stroke();
  }
}

// ---- The ball (orange, black outline + seams) -----------------------------
function drawBasketball(r) {
  ctx.fillStyle = '#e8802a';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r, 0); ctx.lineTo(r, 0);            // horizontal seam
  ctx.moveTo(0, -r); ctx.lineTo(0, r);            // vertical seam
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.5, r, 0, 0, Math.PI * 2); // two curved side seams
  ctx.stroke();
}

function drawGameBall(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  drawBasketball(b.r);
  ctx.restore();
}

// ---- bball rendering ------------------------------------------------------
function drawBballFace(c) {
  const ex = 9, ey = -5, look = c.dir * 0.8;
  if (isBlinking(c)) {
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-ex - 4, ey); ctx.lineTo(-ex + 4, ey);
    ctx.moveTo(ex - 4, ey); ctx.lineTo(ex + 4, ey);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ffffff';
    roundRect(-ex - 2.6, ey - 6, 5.2, 12, 2); ctx.fill();
    roundRect(ex - 2.6, ey - 6, 5.2, 12, 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-ex - 1.3 + look, ey - 1, 2.8, 5);
    ctx.fillRect(ex - 1.3 + look, ey - 1, 2.8, 5);
  }
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath();                                 // slightly-mad brows
  ctx.moveTo(-ex - 5, ey - 9); ctx.lineTo(-ex + 2, ey - 6);
  ctx.moveTo(ex + 5, ey - 9); ctx.lineTo(ex - 2, ey - 6);
  ctx.stroke();
}

function drawFoot(baseX, baseY, ph, dir, swing, airborne) {
  const fx = baseX + dir * ph * 5 * swing;
  const fy = baseY - Math.max(0, ph) * 4 * swing - (airborne ? 3 : 0);
  ctx.fillStyle = '#e8802a';
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(fx, fy, 11, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function drawArm(sideSign, halfW, swingAmt) {
  const ax = sideSign * halfW * 0.92, ay = 2;
  const handX = ax + sideSign * 7, handY = ay + 12 + swingAmt * 8;
  ctx.strokeStyle = '#e8802a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(handX, handY); ctx.stroke();
  ctx.fillStyle = '#e8802a'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(handX, handY, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

// A team-coloured headband across the top of the ball, tied off at the back.
function drawHeadband(r, color, dir) {
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(-r, -25, 2 * r, 9);
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-r, -25.5); ctx.lineTo(r, -25.5);
  ctx.moveTo(-r, -16); ctx.lineTo(r, -16);
  ctx.stroke();
  ctx.restore();

  const kx = -dir * (r - 5);
  ctx.fillStyle = color; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(kx, -20, 4.5, 5.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(kx, -18); ctx.lineTo(kx - dir * 6, -11);
  ctx.moveTo(kx, -18); ctx.lineTo(kx - dir * 8, -16);
  ctx.stroke();
}

function drawBball(c) {
  const halfW = c.r * c.sx, halfH = c.r * c.sy;
  const wp = c.walkPhase, swing = c.airborne ? 0 : 1;
  drawFoot(-11 * c.sx, halfH - 2, Math.sin(wp), c.dir, swing, c.airborne);
  drawFoot(11 * c.sx, halfH - 2, Math.sin(wp + Math.PI), c.dir, swing, c.airborne);

  const armSwing = c.airborne ? -0.7 : Math.sin(wp) * 0.3;
  drawArm(-1, halfW, armSwing);
  drawArm(1, halfW, -armSwing);

  ctx.save();
  ctx.scale(c.sx, c.sy);
  drawBasketball(c.r);
  drawHeadband(c.r, TEAMS[c.team].color, c.dir);
  ctx.restore();
  drawBballFace(c);
}

// ---- flame rendering (a fireball that hovers on a jet) --------------------
function drawFlameFace(c) {
  const ey = -2, look = c.dir * 1.4;
  if (isBlinking(c)) {
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8, ey); ctx.lineTo(8, ey); ctx.stroke();
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, ey, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(look, ey, 3.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath();                                 // one fierce brow
  ctx.moveTo(-10, ey - 10); ctx.lineTo(9, ey - 5);
  ctx.stroke();
}

function drawFlameGuy(c) {
  const r = c.r;
  const flick = Math.sin(frame * 0.3 + c.walkPhase) * 2.5;
  const run = c.airborne ? 0 : Math.abs(Math.sin(c.walkPhase)) * 3;  // longer jet when running

  ctx.save();
  ctx.scale(c.sx, c.sy);

  // flame jet beneath him (instead of feet)
  const jy = r * 0.72;
  const tongue = (cx, w, len, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - w, jy);
    ctx.quadraticCurveTo(cx - w * 0.3, jy + len * 0.6, cx, jy + len);
    ctx.quadraticCurveTo(cx + w * 0.3, jy + len * 0.6, cx + w, jy);
    ctx.closePath(); ctx.fill();
  };
  tongue(-r * 0.32, r * 0.30, r * 0.7 + run + flick, '#e23b3b');
  tongue(r * 0.30, r * 0.26, r * 0.6 + run - flick, '#e23b3b');
  tongue(0, r * 0.34, r * 0.95 + run + flick, '#f0791f');
  tongue(0, r * 0.20, r * 0.6 + run, '#f7c42e');

  // flame tufts rising off the top
  ctx.fillStyle = '#e23b3b';
  drawFlame(-r * 0.45, -r * 0.7, r * 0.34, r * 0.75 + flick, flick);
  drawFlame(r * 0.35, -r * 0.72, r * 0.4, r * 0.9 - flick, -flick);
  ctx.fillStyle = '#f0791f';
  drawFlame(0, -r * 0.72, r * 0.42, r * 1.0 + flick, flick);

  // little flame arms on the sides
  ctx.fillStyle = '#f0791f';
  const armY = 4, aw = 7, al = 12 + flick;
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, armY - aw); ctx.quadraticCurveTo(-r * 1.25 - al, armY, -r * 0.95, armY + aw);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.95, armY - aw); ctx.quadraticCurveTo(r * 1.25 + al, armY, r * 0.95, armY + aw);
  ctx.closePath(); ctx.fill();

  // fireball body: layered red -> orange -> hot yellow core
  ctx.fillStyle = '#e23b3b';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.16, r * 0.95, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#a51f1f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.16, r * 0.95, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f0791f';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.94, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f7c42e';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r * 0.46, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
  drawFlameFace(c);
}

// ---- Draw a player (dispatch + shared shadow/transform) -------------------
function drawPlayer(p) {
  const b = playerCenter(p);
  const af = 1 / (1 + p.air * 0.02);
  ctx.fillStyle = `rgba(20,15,10,${0.28 * af})`;
  ctx.beginPath(); ctx.ellipse(b.cx, b.footY + 2, 22 * b.scale * af, 6 * b.scale * af, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(b.cx, b.cy);
  ctx.scale(b.scale, b.scale);
  if (p.kind === 'flame') drawFlameGuy(p);
  else drawBball(p);
  ctx.restore();
}

// A team-coloured scoreboard hanging over the stands.
function drawScoreboard(x, y, w, h, team, value) {
  ctx.fillStyle = '#0e1218';                        // dark panel
  roundRect(x, y, w, h, 6); ctx.fill();
  ctx.fillStyle = team.color;                       // team-colour header
  roundRect(x, y, w, 18, 6); ctx.fill();
  ctx.fillRect(x, y + 9, w, 9);
  ctx.strokeStyle = team.color; ctx.lineWidth = 2.5;
  roundRect(x, y, w, h, 6); ctx.stroke();

  ctx.fillStyle = '#0b0e12';
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(team.name, x + w / 2, y + 13);
  ctx.fillStyle = team.color;
  ctx.font = 'bold 26px monospace';
  ctx.fillText(String(value).padStart(2, '0'), x + w / 2, y + h - 9);
}

// The centre game clock: current quarter + time remaining.
function drawGameClock() {
  const w = 132, h = 52, x = W / 2 - w / 2, y = 82;
  ctx.fillStyle = '#0e1218';
  roundRect(x, y, w, h, 6); ctx.fill();
  ctx.fillStyle = '#c9a227';                        // amber header
  roundRect(x, y, w, 18, 6); ctx.fill();
  ctx.fillRect(x, y + 9, w, 9);
  ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2.5;
  roundRect(x, y, w, h, 6); ctx.stroke();

  ctx.fillStyle = '#0b0e12';
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(gameOver ? 'FINAL' : 'QUARTER ' + quarter, x + w / 2, y + 13);

  const secs = gameOver ? 0 : Math.ceil((QUARTER_FRAMES - quarterFrame) / 60);
  ctx.fillStyle = '#f4efe4';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'), x + w / 2, y + h - 9);
}

function drawHud() {
  drawScoreboard(26, 82, 150, 52, TEAMS.green, scores.green);
  drawScoreboard(W - 176, 82, 150, 52, TEAMS.red, scores.red);
  drawGameClock();

  if (swish.t > 0) {
    const a = swish.t / 45;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(swish.pts === 3 ? '3 pointer!' : 'swish!', swish.x, swish.y - 22 - (45 - swish.t) * 0.6);
  }

  if (gameOver) {
    const winner = scores.green > scores.red ? 'GREEN WINS!'
      : scores.red > scores.green ? 'RED WINS!' : 'TIE GAME';
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    roundRect(W / 2 - 150, 250, 300, 78, 10); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(winner, W / 2, 290);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('press Enter to play again', W / 2, 314);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawArena();
  drawHoop(70, 118, -1, TEAMS.green.color);   // left hoop (green's)
  drawHoop(730, 682, +1, TEAMS.red.color);    // right hoop (red's)

  const order = players.slice().sort((a, b) => a.v - b.v);   // far players first
  for (const p of order) drawPlayer(p);
  drawGameBall(ball);
  drawHud();
}

startGameLoop();
