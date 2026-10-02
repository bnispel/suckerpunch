// King of the Hill — get to the top of the hill and stay there.
//
// Based on Lincoln's drawing (reference/sketch.jpg): one big grassy hill, a
// clock in the corner, you (a stick man) and a crowd of "CP" computer players.
//
// Rules:
//  • Whoever is standing on top of the hill when the clock runs out wins.
//  • Only one king at a time — to take the top you punch the king off.
//  • A punch knocks you off your feet and down the hill.
//  • The only way to dodge a punch is to jump so it misses you.
//  • Every stick man looks and plays the same. Weapons and skins come from
//    the shop (shop.js), bought with Stick Bucks.
//  • You earn points every second you spend up on the hill — the higher you
//    stand, the more you get (most on the very top) — plus 2 for every
//    knock-off and a bonus for winning.
//    Points fill your level ring; close the ring to level up.
//
// Controls:  ← →  move     ↑  jump     Space  punch     M  sound on/off     R  menu

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

let frame = 0;               // engine loop increments this each frame

const GRAVITY = 0.5;
const MATCH_FRAMES = 90 * 60;    // 1:30 on the clock
const PEAK_X = 380;              // x of the hilltop
const ZONE_HALF = 34;            // how wide the "top of the hill" is (each side)
const PUNCH_WINDUP = 7;          // frames the arm cocks back (time to jump away)
const PUNCH_ACTIVE = 7;          // frames the fist is out and can hit
const PUNCH_RECOVER = 4;
const PUNCH_COOLDOWN = 26;
const BASE_REACH = 30;           // fist reach in front of the body
const STUN_FRAMES = 70;          // how long a punched fighter tumbles
const KNOCKBACK = 6.5;           // how hard a punch sends you flying
const WALK_SPEED = 2.6;
const JUMP_FORCE = 10.5;
const MAX_HILL_POINTS = 5;       // points per second standing on the very top
const KO_POINTS = 2;             // points for each person you knock off
const WIN_POINTS = 100;          // bonus for winning a match
const LEVEL_POINTS = 500;        // points to close the ring and level up
const CP_COUNT = 5;
// How tough the computer players are (lower = easier).
const CP_SPEED = 0.8;            // CPs walk at 80% of your speed
const CP_PUNCH_CHANCE = 0.04;    // chance per frame a CP throws a punch when close
const CP_PUNCH_REST = 25;        // extra frames a CP waits between punches
const CP_DODGE_CHANCE = 0.15;    // chance a CP jumps out of the way of a punch

const HAND = '"Chalkboard SE", "Comic Sans MS", "Marker Felt", system-ui, sans-serif';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Every stick man is drawn in black ink, like the drawing.
const INK = '#1a1a1a';

// ---- Saved progress + wallet --------------------------------------------------
// Saved in the browser, so it's still there next time you play.
//   total  — every point ever earned; your level and ring come from this and
//            it never goes down.
//   wallet — your stick man's wallet: every point you earn goes in here too,
//            and it's what you'll spend in the shop (coming next). Spending
//            takes points out of the wallet but never lowers your level.
//   owned  — ids of shop items you've bought
//   skin   — the skin you're wearing (null = plain stick man)
//   mods   — on/off switch for each game mod you own (e.g. extreme: true)
//   weaponFor — the weapon each character uses with the Extreme pack, e.g.
//               { stick: 'sword', banana: 'hammer' } ('random' if not picked)
//   face      — a face worn on any character (e.g. 'sus'), or null
//   generated — the weapons and skins the Starter Pack made up for you
let progress = { total: 0, wallet: 0, owned: [], skin: null, mods: {}, weaponFor: {},
                 face: null, generated: { weapons: [], skins: [] } };
try {
  const saved = JSON.parse(localStorage.getItem('kingofthehill.progress'));
  if (saved && typeof saved.total === 'number') {
    // older saves had no wallet: start it with everything earned so far
    if (typeof saved.wallet !== 'number') saved.wallet = saved.total;
    progress = Object.assign(progress, saved);
  }
} catch (e) {}
function saveProgress() {
  try { localStorage.setItem('kingofthehill.progress', JSON.stringify(progress)); } catch (e) {}
}
const levelFor = total => Math.floor(total / LEVEL_POINTS) + 1;
if (!progress.generated) progress.generated = { weapons: [], skins: [] };

// Wallet helpers (the shop will use spendFromWallet).
function walletBalance() { return progress.wallet; }
function addToWallet(points) {
  progress.wallet += points;
  progress.total += points;
  saveProgress();
}
function owns(id) { return progress.owned.includes(id); }
function modOn(id) { return owns(id) && progress.mods[id] !== false; }

function spendFromWallet(cost) {
  if (cost > progress.wallet) return false;      // not enough points
  progress.wallet -= cost;
  saveProgress();
  return true;
}

// ---- Weapons (Extreme pack) ---------------------------------------------------
// Only in the game once you own the Extreme pack (and it's switched on).
// You start the battle holding the weapon you picked on the item screen and
// keep it all battle. CPs never have weapons — only you do.
const WEAPON_KEYS = ['sword', 'pickaxe', 'hammer'];
const WEAPONS = {
  sword:   { name: 'Sword',   reach: 20, power: 1.4, windup: 0 },
  pickaxe: { name: 'Pickaxe', reach: 12, power: 1.7, windup: 2 },
  hammer:  { name: 'Hammer',  reach: 8,  power: 2.1, windup: 5 },   // slow: easier to dodge
};
let weaponsOn = false;          // set at the start of each match

// Every weapon you can use right now: the Extreme pack's (if it's on) plus
// the Starter Pack's made-up ones (starter.js).
function availableWeapons() {
  return (modOn('extreme') ? WEAPON_KEYS : []).concat(owns('starter') ? progress.generated.weapons.map(w => w.id) : []);
}
function randomWeapon() {
  const list = availableWeapons();
  return list[Math.floor(Math.random() * list.length)];
}

// ---- The hill ----------------------------------------------------------------
// A flat-topped hump with its peak left of centre and a gentle bump on the
// right, like the drawing. Returns the ground's y at x.
function hillY(x) {
  const main = 255 * Math.exp(-Math.pow(Math.abs(x - PEAK_X) / 180, 2.6));
  const right = 45 * Math.exp(-Math.pow((x - 700) / 120, 2));
  return 478 - main - right;
}
// Ground steepness: > 0 means the ground goes downhill to the right.
function slopeAt(x) { return (hillY(x + 2) - hillY(x - 2)) / 4; }

// Pre-baked grass so it doesn't wiggle every frame.
const GRASS = [];
for (let x = -2; x <= W + 2; x += 3) {
  GRASS.push({ x, lean: Math.random() * 4 - 2, h: 5 + Math.random() * 9 });
}
const CLOUDS = [
  { x: 120, y: 70, s: 1.0 }, { x: 520, y: 50, s: 1.3 }, { x: 700, y: 120, s: 0.8 },
];

// ---- Match state -------------------------------------------------------------
let gameState = 'menu';     // 'menu' | 'shop' | 'loadout' | 'playing' | 'over'
let fighters = [];
let player = null;
let king = null;            // whoever holds the top right now
let winner = null;
let timeLeft = MATCH_FRAMES;
let overtime = false;
let popups = [];            // floating text
let bursts = [];            // "POW" stars
let result = null;          // end-of-match summary for the results screen
let overTimer = 0;          // frames since the match ended

const CP_SPAWNS = [140, 220, 600, 680, 760];

function makeFighter(x, isPlayer) {
  return {
    x, y: hillY(x), vx: 0, vy: 0, onGround: true,
    facing: x < PEAK_X ? 1 : -1,
    isPlayer,
    moveDir: 0, wantJump: false, wantPunch: false,
    punchT: 0, punchCD: 0, punchSerial: 0, hitDone: false,
    stun: 0, spin: 0,
    walkPhase: Math.random() * 6, moving: false,
    kos: 0, hillPoints: 0,
    weapon: null,
    skin: null,
    // computer brain
    think: 0, aimOffset: 0, seenPunch: '', aggression: 0,
  };
}

function startMatch() {
  const level = levelFor(progress.total);
  weaponsOn = availableWeapons().length > 0;
  player = makeFighter(50, true);
  player.skin = progress.skin;
  player.face = progress.face;
  if (weaponsOn) {
    const pick = weaponChoice(player.skin);
    player.weapon = pick === 'random' ? randomWeapon() : pick;
  }
  fighters = [player];
  for (let i = 0; i < CP_COUNT; i++) {
    const cp = makeFighter(CP_SPAWNS[i], false);
    // computers get a bit pushier as you level up
    cp.aggression = Math.min(0.1, CP_PUNCH_CHANCE + (level - 1) * 0.005);
    fighters.push(cp);
  }
  king = null; winner = null;
  timeLeft = MATCH_FRAMES; overtime = false;
  popups = []; bursts = [];
  result = null;
  gameState = 'playing';
}

function goToMenu() { gameState = 'menu'; }

// ---- Sound -------------------------------------------------------------------
// Sound effects are made on the fly with Web Audio (no sound files needed).
// Browsers only allow audio after you press a key or click, so the audio
// context is created on the first input.
let audio = null;
let soundOn = true;
function initAudio() {
  if (audio || !window.AudioContext) return;
  try { audio = new AudioContext(); } catch (e) { audio = null; }
}

// Building blocks shared by the sounds below.
function soundOut(volume) {
  if (!audio || !soundOn) return null;
  if (audio.state === 'suspended') audio.resume();
  const out = audio.createGain();
  out.gain.value = volume;
  out.connect(audio.destination);
  return out;
}
// Soft clipping + a compressor: makes hits land hard without getting harsh.
function impactBus(out) {
  const shaper = audio.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.5); }
  shaper.curve = curve;
  const comp = audio.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 6; comp.attack.value = 0.001; comp.release.value = 0.1;
  shaper.connect(comp); comp.connect(out);
  return shaper;
}
// A burst of filtered noise starting at time t that fades out over `dur`
// seconds (higher `sharpness` = dies away faster).
function noiseBurst(dest, t, dur, type, freq, q, level, sharpness) {
  const len = Math.floor(audio.sampleRate * dur);
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, sharpness);
  const src = audio.createBufferSource();
  src.buffer = buf;
  const f = audio.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = audio.createGain();
  g.gain.value = level;
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t);
  return f;
}
// A deep tone that drops in pitch: the "boom" you feel in your chest.
function thud(dest, t, from, to, dur, level) {
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.55);
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t + dur + 0.02);
}

// Played when a CP punches you — it sounds like a real kick to a soccer
// ball: one solid "thock" that rings out for about a third of a second, and
// nothing slides down in pitch (sliding pitch is what made the old
// version sound like a ball going flat).
//   • slap  — the instant the boot meets the leather (bright tick)
//   • pock  — the hard, hollow pop of a fully pumped ball
//   • body  — a short, steady low note: the ball's bounce
//   • thump — the dull weight of the foot behind it
function playKickedSound() {
  const out = soundOut(0.85);
  if (!out) return;
  const t = audio.currentTime;
  const vary = 0.94 + Math.random() * 0.12;
  const bus = impactBus(out);

  noiseBurst(bus, t, 0.015, 'bandpass', 4200, 0.7, 0.8, 10);        // slap
  noiseBurst(bus, t, 0.14, 'bandpass', 1050 * vary, 1.5, 1.6, 6);   // pock
  noiseBurst(bus, t, 0.22, 'lowpass', 260, 0.8, 1.1, 5);            // thump

  // body: holds its pitch (only a tiny settle in the first 20ms)
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(165 * vary, t);
  osc.frequency.exponentialRampToValueAtTime(140 * vary, t + 0.02);
  g.gain.setValueAtTime(1.0, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  osc.connect(g); g.connect(bus);
  osc.start(t); osc.stop(t + 0.34);
}

// Played when you punch someone — built to sound like a real punch landing:
// a short bright slap, a muffled body thud, and a deep drop. Each punch is
// pitched slightly differently so they don't sound copy-pasted.
function playPunchSound() {
  const out = soundOut(0.7);
  if (!out) return;
  const t = audio.currentTime;
  const vary = 0.9 + Math.random() * 0.2;
  const bus = impactBus(out);
  noiseBurst(bus, t, 0.035, 'bandpass', 2600 * vary, 0.7, 1.0, 6);   // slap
  noiseBurst(bus, t, 0.16, 'lowpass', 480 * vary, 0.9, 1.4, 3);      // body
  thud(bus, t, 140 * vary, 48, 0.22, 1.2);                           // thud
}

// ---- Input ---------------------------------------------------------------------
const keys = {};
let jumpPressed = false, punchPressed = false;

window.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  initAudio();
  if (e.code === 'KeyM' && !e.repeat) soundOn = !soundOn;

  if (gameState === 'menu') {
    if (e.code === 'Enter' || e.code === 'Space') openLoadout();
    else if (e.code === 'KeyS') openShop();
  } else if (gameState === 'shop') {
    shopKey(e);
  } else if (gameState === 'loadout') {
    loadoutKey(e);
  } else if (gameState === 'playing') {
    if (e.repeat) return;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') jumpPressed = true;
    if (e.code === 'Space') punchPressed = true;
    if (e.code === 'KeyR') goToMenu();
  } else if (gameState === 'over') {
    if (overTimer < 45) return;            // don't skip the results by mashing Space
    if (e.code === 'Enter' || e.code === 'Space') startMatch();
    else if (e.code === 'KeyR' || e.code === 'Escape') goToMenu();
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// Characters you own: the Stick Man plus any skins from the shop. You pick
// one after pressing Play (loadout.js).
function menuChars() {
  return [null]
    .concat(SHOP_ITEMS.filter(it => it.kind === 'skin' && owns(it.id)).map(it => it.id))
    .concat(owns('starter') ? progress.generated.skins.map(sk => sk.id) : []);
}
function charName(skin) {
  if (!skin) return 'Stick Man';
  const it = SHOP_ITEMS.find(it => it.id === skin) || genSkin(skin);
  return it ? it.name : 'Stick Man';
}
function pickChar(skin) { progress.skin = skin; saveProgress(); }
const PLAY_BTN = { x: W / 2 - 100, y: 338, w: 200, h: 56 };

// The item (weapon) you take into battle is picked after pressing Play, on
// the item screen (loadout.js); you hold it from the start of the battle.
// Your last pick is remembered per character.
function weaponChoices() { return ['random'].concat(availableWeapons()); }
function weaponChoice(skin) {
  const pick = progress.weaponFor[skin || 'stick'] || 'random';
  return weaponChoices().includes(pick) ? pick : 'random';
}
function pickWeapon(id) { progress.weaponFor[progress.skin || 'stick'] = id; saveProgress(); }
const BTN_AGAIN = { x: 250, y: 414, w: 140, h: 40 };
const BTN_MENU  = { x: 410, y: 414, w: 140, h: 40 };

canvas.addEventListener('click', e => {
  initAudio();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (W / rect.width);
  const my = (e.clientY - rect.top) * (H / rect.height);
  if (gameState === 'menu') {
    if (hitBox(PLAY_BTN, mx, my)) { openLoadout(); return; }
    if (hitBox(WALLET_BTN, mx, my)) { openShop(); return; }
  } else if (gameState === 'shop') {
    shopClick(mx, my);
  } else if (gameState === 'loadout') {
    loadoutClick(mx, my);
  } else if (gameState === 'over' && overTimer >= 45) {
    if (hitBox(BTN_AGAIN, mx, my)) startMatch();
    else if (hitBox(BTN_MENU, mx, my)) goToMenu();
  }
});

// ---- Fighter helpers -------------------------------------------------------------
function punchWindup(f) { return PUNCH_WINDUP + (f.weapon ? WEAPONS[f.weapon].windup : 0); }
function punchTotal(f) { return punchWindup(f) + PUNCH_ACTIVE + PUNCH_RECOVER; }
function punchReach(f) { return BASE_REACH + (f.weapon ? WEAPONS[f.weapon].reach : 0); }
function inZone(f) { return f.onGround && f.stun === 0 && Math.abs(f.x - PEAK_X) <= ZONE_HALF; }

function popup(x, y, text, color) { popups.push({ x, y, text, color: color || '#1a1a1a', life: 70 }); }

// ---- Player + computer intents -----------------------------------------------------
function playerIntent() {
  const left = keys.ArrowLeft || keys.KeyA, right = keys.ArrowRight || keys.KeyD;
  player.moveDir = (right ? 1 : 0) - (left ? 1 : 0);
  player.wantJump = jumpPressed;
  player.wantPunch = punchPressed;
  jumpPressed = punchPressed = false;
}

function cpIntent(f) {
  f.wantJump = false; f.wantPunch = false;
  if (f.stun > 0) { f.moveDir = 0; return; }

  // Dodge: if someone facing us is winding up a punch in range, maybe jump.
  for (const e of fighters) {
    if (e === f || e.stun > 0 || e.punchT === 0 || e.punchT > punchWindup(e)) continue;
    const dx = (f.x - e.x) * e.facing;
    if (dx < -4 || dx > punchReach(e) + 12) continue;
    const id = fighters.indexOf(e) + ':' + e.punchSerial;
    if (f.seenPunch === id) continue;
    f.seenPunch = id;
    if (Math.random() < CP_DODGE_CHANCE) f.wantJump = true;
  }

  // Nearest grounded rival in front of us within reach? Punch them.
  let near = null, nearD = Infinity;
  for (const e of fighters) {
    if (e === f || e.stun > 0) continue;
    const d = Math.abs(e.x - f.x);
    if (d < nearD && Math.abs(e.y - f.y) < 30) { near = e; nearD = d; }
  }
  if (near && nearD < punchReach(f) && f.onGround) {
    f.facing = near.x > f.x ? 1 : -1;
    if (f.punchCD === 0 && Math.random() < f.aggression) f.wantPunch = true;
  }

  // Head for the top (or for the king, who's standing on it).
  if (--f.think <= 0) {
    f.think = 20 + Math.floor(Math.random() * 30);
    f.aimOffset = (Math.random() * 2 - 1) * 18;
  }
  const goal = (king && king !== f) ? king.x : PEAK_X + (king === f ? 0 : f.aimOffset);
  const dx = goal - f.x;
  if (king === f) {
    f.moveDir = Math.abs(dx) > 10 ? Math.sign(dx) : 0;      // king: hold the middle
  } else if (near && nearD < punchReach(f) - 6) {
    f.moveDir = 0;                                           // close enough to brawl
  } else {
    f.moveDir = Math.abs(dx) > 6 ? Math.sign(dx) : 0;
  }
  // an occasional hop, just because
  if (f.moveDir !== 0 && f.onGround && Math.random() < 0.004) f.wantJump = true;
}

// ---- Physics -------------------------------------------------------------------------
function stepFighter(f) {
  if (f.punchCD > 0) f.punchCD--;
  if (f.punchT > 0 && ++f.punchT > punchTotal(f)) f.punchT = 0;

  if (f.stun > 0) {
    // tumbling: no control. On the ground you roll downhill and slow down.
    f.stun--;
    if (!f.onGround && f.stun === 0) f.stun = 1;   // keep tumbling until you land
    if (f.onGround) {
      f.vx = (f.vx + slopeAt(f.x) * 0.35) * 0.94;
      f.spin += f.vx / 9;
    } else {
      f.spin += f.vx * 0.05 + 0.08 * Math.sign(f.vx || 1);
    }
    if (f.stun === 0) { f.spin = 0; f.vx = 0; }
    f.moving = false;
  } else {
    const slow = f.punchT > 0 ? 0.4 : 1;
    f.vx = f.moveDir * WALK_SPEED * slow * (f.isPlayer ? 1 : CP_SPEED);
    if (f.moveDir !== 0 && f.punchT === 0) f.facing = f.moveDir;
    if (f.wantJump && f.onGround) { f.vy = -JUMP_FORCE; f.onGround = false; }
    if (f.wantPunch && f.punchT === 0 && f.punchCD === 0) {
      f.punchT = 1;
      f.punchCD = PUNCH_COOLDOWN + (f.isPlayer ? 0 : CP_PUNCH_REST) + (f.weapon ? WEAPONS[f.weapon].windup : 0);
      f.punchSerial++; f.hitDone = false;
    }
    f.moving = f.moveDir !== 0 && f.onGround;
    if (f.moving) f.walkPhase += 0.12 * WALK_SPEED;
  }

  if (f.onGround) {
    f.x += f.vx;
  } else {
    f.vy += GRAVITY;
    f.x += f.vx;
    f.y += f.vy;
  }
  // side walls (tumblers bounce off them)
  if (f.x < 10 || f.x > W - 10) {
    f.x = clamp(f.x, 10, W - 10);
    if (f.stun > 0) f.vx *= -0.4;
  }
  if (f.onGround) {
    f.y = hillY(f.x);
  } else if (f.y >= hillY(f.x)) {
    f.y = hillY(f.x); f.vy = 0; f.onGround = true;
  }
}

// Punches land on grounded, standing fighters in front of the fist.
// Anyone in the air dodges it.
function resolvePunches() {
  for (const a of fighters) {
    const w = punchWindup(a);
    if (a.stun > 0 || a.hitDone || a.punchT <= w || a.punchT > w + PUNCH_ACTIVE) continue;
    const reach = punchReach(a);
    let best = null, bestD = Infinity;
    for (const t of fighters) {
      if (t === a || t.stun > 0 || !t.onGround) continue;
      const dx = (t.x - a.x) * a.facing;
      if (dx > -4 && dx < reach + 6 && Math.abs(t.y - a.y) < 30 && dx < bestD) { best = t; bestD = dx; }
    }
    if (best) { a.hitDone = true; knockOff(a, best); }
  }
}

function knockOff(a, t) {
  const kb = KNOCKBACK * (a.weapon ? WEAPONS[a.weapon].power : 1);
  t.vx = a.facing * kb;
  t.vy = -5 - kb * 0.5;
  t.onGround = false;
  t.stun = STUN_FRAMES;
  t.punchT = 0; t.spin = 0;
  if (t === king) king = null;
  if (t.isPlayer) playKickedSound();         // a CP punched you
  else if (a.isPlayer) playPunchSound();      // you punched a CP

  bursts.push({ x: t.x - a.facing * 4, y: t.y - 34, life: 18 });
  a.kos++;
  if (a.isPlayer) popups.push({ x: a.x, y: a.y - 70, text: '+' + KO_POINTS, color: '#b8860b', life: 35, small: true });
}

// Keep standing fighters from piling into the exact same spot.
function separate() {
  for (let i = 0; i < fighters.length; i++) {
    for (let j = i + 1; j < fighters.length; j++) {
      const a = fighters[i], b = fighters[j];
      if (!a.onGround || !b.onGround || a.stun || b.stun) continue;
      const dx = b.x - a.x;
      if (Math.abs(dx) < 14) {
        const push = (14 - Math.abs(dx)) * 0.3 * (dx >= 0 ? 1 : -1);
        a.x = clamp(a.x - push, 10, W - 10); a.y = hillY(a.x);
        b.x = clamp(b.x + push, 10, W - 10); b.y = hillY(b.x);
      }
    }
  }
}

// One king at a time: the first one standing on top keeps it until knocked off
// (or until they walk away).
function updateKing() {
  if (king && !inZone(king)) king = null;
  if (!king) {
    let best = null;
    for (const f of fighters) {
      if (inZone(f) && (!best || Math.abs(f.x - PEAK_X) < Math.abs(best.x - PEAK_X))) best = f;
    }
    if (best) {
      king = best;
      if (best.isPlayer) popup(best.x, best.y - 84, "You're the King!", '#d08a00');
    }
  }
}

// Points per second for standing at x: 0 down at the bottom, rising to
// MAX_HILL_POINTS on the top. Uses the ground under you, so jumping doesn't count.
function hillPointsAt(x) {
  const bottom = 478, top = hillY(PEAK_X);
  const frac = clamp((bottom - hillY(x)) / (bottom - top), 0, 1);
  return Math.round(frac * MAX_HILL_POINTS);
}

// Once a second, pay the player for how high up the hill they are.
function scoreHeight() {
  if (frame % 60 !== 0 || player.stun > 0) return;
  const pts = hillPointsAt(player.x);
  if (pts <= 0) return;
  player.hillPoints += pts;
  popups.push({ x: player.x + 18, y: player.y - 40, text: '+' + pts, color: '#b8860b', life: 35, small: true });
}

function endMatch(w) {
  winner = w;
  const won = w === player;
  const winBonus = won ? WIN_POINTS : 0;
  const koPoints = player.kos * KO_POINTS;
  const earned = player.hillPoints + koPoints + winBonus;
  const before = progress.total, walletBefore = progress.wallet;
  addToWallet(earned);
  result = { won, earned, winBonus, koPoints, hillPoints: player.hillPoints, before, after: progress.total,
             walletBefore, walletAfter: progress.wallet, kos: player.kos };
  overTimer = 0;
  gameState = 'over';
}

// ---- Update ------------------------------------------------------------------------
function update() {
  if (gameState === 'over') overTimer++;
  if (gameState === 'playing') {
    playerIntent();
    for (const f of fighters) if (!f.isPlayer) cpIntent(f);
    for (const f of fighters) stepFighter(f);
    resolvePunches();
    separate();
    updateKing();
    scoreHeight();

    if (!overtime) {
      timeLeft--;
      if (timeLeft <= 0) {
        timeLeft = 0;
        if (king) endMatch(king);
        else { overtime = true; popup(W / 2, 150, 'Nobody is on top — next King wins!', '#c0202a'); }
      }
    } else if (king) {
      endMatch(king);
    }
  }
  for (const p of popups) { p.life--; p.y -= 0.5; }
  popups = popups.filter(p => p.life > 0);
  for (const b of bursts) b.life--;
  bursts = bursts.filter(b => b.life > 0);
}

// ---- Time of day ----------------------------------------------------------------
// The sky follows the real clock on your computer: sunrise in the morning,
// blue sky in the day, a sunset in the evening, and a moon and stars at night.
// The hill gets darker at night too. Add ?hour=21 to the page address to try
// a different time (any hour 0-24).
const HOUR_OVERRIDE = (() => {
  try {
    const h = parseFloat(new URLSearchParams(location.search).get('hour'));
    return isNaN(h) ? null : ((h % 24) + 24) % 24;
  } catch (e) { return null; }
})();
function currentHour() {
  if (HOUR_OVERRIDE !== null) return HOUR_OVERRIDE;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

// Sky colours through the day: [hour, top colour, bottom colour, darkness 0..1]
const SKY_KEYS = [
  [0,    '#0d1838', '#2c3d70', 1],
  [5,    '#0d1838', '#2c3d70', 1],
  [6.2,  '#3b4a8a', '#f2a07a', 0.5],    // sunrise
  [7.5,  '#9fd3ff', '#eef8ff', 0],      // morning
  [17,   '#9fd3ff', '#eef8ff', 0],
  [18.8, '#5b7fc4', '#ffb36b', 0.25],   // sunset
  [19.8, '#2a2f6a', '#c8607a', 0.6],    // dusk
  [21,   '#0d1838', '#2c3d70', 1],      // night
  [24,   '#0d1838', '#2c3d70', 1],
];
function mixColor(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = sh => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
}
// Worked out once a second (the real clock doesn't move faster than that).
let sky = null, skyAt = -999;
function skyNow() {
  if (sky && frame - skyAt < 60) return sky;
  skyAt = frame;
  const h = currentHour();
  let i = 0;
  while (i < SKY_KEYS.length - 2 && h >= SKY_KEYS[i + 1][0]) i++;
  const [h0, t0, b0, d0] = SKY_KEYS[i], [h1, t1, b1, d1] = SKY_KEYS[i + 1];
  const k = clamp((h - h0) / (h1 - h0), 0, 1);
  sky = { hour: h, top: mixColor(t0, t1, k), bottom: mixColor(b0, b1, k), dark: d0 + (d1 - d0) * k };
  return sky;
}
// Text drawn straight on the sky switches to light colours once it's dark.
function skyText() { return skyNow().dark > 0.5 ? '#f2f4ff' : '#1a1a1a'; }

// Stars, fixed in place, that fade in as it gets dark.
const STARS = [];
for (let i = 0; i < 70; i++) {
  STARS.push({ x: Math.random() * W, y: Math.random() * 330, r: Math.random() * 1.3 + 0.4, tw: Math.random() * 6 });
}

// ---- Drawing: scenery -----------------------------------------------------------------
function drawSky() {
  const sk = skyNow();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, sk.top);
  g.addColorStop(1, sk.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // stars
  const starAlpha = clamp((sk.dark - 0.4) / 0.4, 0, 1);
  if (starAlpha > 0) {
    for (const st of STARS) {
      ctx.fillStyle = 'rgba(255,255,240,' + (starAlpha * (0.6 + Math.sin(frame * 0.05 + st.tw) * 0.4)) + ')';
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // The sun crosses the sky from about 6am to 7:30pm, rising and setting
  // behind the hill; the moon does the same overnight.
  const h = sk.hour;
  if (h >= 5.8 && h <= 19.7) {
    const p = (h - 5.8) / 13.9;
    const x = 40 + p * 720, y = 330 - Math.sin(Math.PI * p) * 270;
    const low = 1 - Math.sin(Math.PI * p);              // 1 near the horizon
    const sun = mixColor('#ffe066', '#ff8a3a', clamp(low * 1.4 - 0.3, 0, 1));
    // soft glow, so the sun still shows around the crown at midday
    const glow = ctx.createRadialGradient(x, y, 26, x, y, 75);
    glow.addColorStop(0, 'rgba(255, 236, 140, 0.55)');
    glow.addColorStop(1, 'rgba(255, 236, 140, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 75, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sun;
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
  }
  const mh = h >= 19.5 ? h - 19.5 : h + 4.5;            // hours since 7:30pm
  if (mh <= 11) {
    const p = mh / 11;
    const x = 40 + p * 720, y = 330 - Math.sin(Math.PI * p) * 270;
    ctx.fillStyle = '#f4f1dc';
    ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill();
    // bite out a crescent using the sky colour at that height
    const behind = ctx.createLinearGradient(0, 0, 0, H);
    behind.addColorStop(0, sk.top);
    behind.addColorStop(1, sk.bottom);
    ctx.fillStyle = behind;
    ctx.beginPath(); ctx.arc(x + 10, y - 6, 20, 0, Math.PI * 2); ctx.fill();
  }

  // drifting clouds, greyer and fainter at night
  ctx.fillStyle = mixColor('#ffffff', '#56638f', sk.dark);
  ctx.globalAlpha = 0.9 - sk.dark * 0.35;
  for (const c of CLOUDS) {
    const x = ((c.x + frame * 0.15 * c.s) % (W + 160)) - 80;
    for (const [ox, oy, r] of [[0, 0, 18], [18, -8, 22], [38, 0, 17], [20, 6, 16]]) {
      ctx.beginPath(); ctx.arc(x + ox * c.s, c.y + oy * c.s, r * c.s, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function hillPath() {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, hillY(x));
  ctx.lineTo(W, H);
  ctx.closePath();
}

function drawHill() {
  // dirt
  hillPath();
  ctx.fillStyle = '#9c6b3e';   // solid brown dirt
  ctx.fill();

  // the top-of-the-hill zone glows gold
  const zoneGlow = 0.25 + Math.sin(frame * 0.08) * 0.1;
  ctx.strokeStyle = 'rgba(255, 196, 0,' + zoneGlow + ')';
  ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = PEAK_X - ZONE_HALF; x <= PEAK_X + ZONE_HALF; x += 2) {
    x === PEAK_X - ZONE_HALF ? ctx.moveTo(x, hillY(x)) : ctx.lineTo(x, hillY(x));
  }
  ctx.stroke();

  // grass tufts
  ctx.strokeStyle = '#6cc23a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const g of GRASS) {
    const y = hillY(clamp(g.x, 0, W));
    ctx.moveTo(g.x, y + 3);
    ctx.lineTo(g.x + g.lean, y - g.h);
  }
  ctx.stroke();
  // ink outline of the ground
  ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 4) x ? ctx.lineTo(x, hillY(x)) : ctx.moveTo(x, hillY(x));
  ctx.stroke();

  // night falls on the hill too
  const dark = skyNow().dark;
  if (dark > 0) {
    hillPath();
    ctx.fillStyle = 'rgba(10, 16, 48,' + (dark * 0.5) + ')';
    ctx.fill();
  }

  // a big crown floating high over the summit, above the King's head
  // (not on the start or item screens, where it would sit behind the title)
  if (gameState === 'menu' || gameState === 'loadout') return;
  const px = PEAK_X, crownBase = hillY(PEAK_X) - 100;
  ctx.save();
  ctx.translate(px, crownBase + Math.sin(frame * 0.05) * 2);   // bobs gently
  ctx.scale(4, 4);
  ctx.translate(0, 54);          // drawCrown() draws its base at y = -54
  drawCrown(1.2);                // thinner outline so it stays crisp when scaled up
  ctx.restore();
}

// ---- Drawing: fighters ---------------------------------------------------------------
// The king's crown: a yellow, three-pointed crown with yellow balls on the tips,
// sitting on the head (also drawn big over the summit).
function drawCrown(outline = 2) {
  const base = -54, top = -69;
  ctx.beginPath();
  ctx.moveTo(-10, base);
  ctx.lineTo(-11, top + 3);
  ctx.lineTo(-5, top + 9);
  ctx.lineTo(0, top);
  ctx.lineTo(5, top + 9);
  ctx.lineTo(11, top + 3);
  ctx.lineTo(10, base);
  ctx.closePath();
  ctx.fillStyle = '#ffd84a';
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = outline; ctx.lineJoin = 'round';
  ctx.stroke();
  // a little sparkle on each point
  ctx.fillStyle = '#ffd84a';
  for (const [px, py] of [[-11, top + 3], [0, top], [11, top + 3]]) {
    ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

function drawWeapon(key, angle) {
  ctx.save();
  ctx.rotate(angle);
  ctx.lineCap = 'round';
  if (WEAPONS[key] && WEAPONS[key].gen) { drawGenWeapon(WEAPONS[key]); ctx.restore(); return; }
  if (key === 'sword') {
    ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(2, 0); ctx.stroke();       // grip
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(3, -5); ctx.lineTo(3, 5); ctx.stroke();        // guard
    ctx.fillStyle = '#d8dde6'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(4, -2.5); ctx.lineTo(28, -2); ctx.lineTo(33, 0);
    ctx.lineTo(28, 2); ctx.lineTo(4, 2.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (key === 'pickaxe') {
    ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(22, 0); ctx.stroke();
    ctx.strokeStyle = '#5c6370'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(16, -11); ctx.quadraticCurveTo(26, 0, 16, 11); ctx.stroke();
  } else if (key === 'hammer') {
    ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(19, 0); ctx.stroke();
    ctx.fillStyle = '#4a4f58'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
    roundRect(17, -8, 11, 16, 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawFighter(f) {
  ctx.save();
  ctx.translate(f.x, f.y);

  // the king stands in a golden glow
  if (f === king) {
    ctx.fillStyle = 'rgba(255, 200, 0, 0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
  }

  if (f.stun > 0) {           // tumble: spin about the middle of the body
    ctx.translate(0, -26); ctx.rotate(f.spin); ctx.translate(0, 26);
  }
  ctx.scale(f.facing, 1);

  const lw = 3;   // every stick man is drawn the same
  const gen = genSkin(f.skin);                    // Starter Pack skin, if any
  const limbs = gen ? gen.body : INK;
  ctx.strokeStyle = limbs;
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const step = f.moving ? Math.sin(f.walkPhase) * 7 : 0;
  const airborne = !f.onGround && f.stun === 0;

  ctx.beginPath();
  // legs
  if (airborne) {
    ctx.moveTo(0, -18); ctx.lineTo(-6, -10); ctx.lineTo(-3, -2);
    ctx.moveTo(0, -18); ctx.lineTo(6, -11); ctx.lineTo(9, -4);
  } else {
    ctx.moveTo(0, -18); ctx.lineTo(-6 + step, 0);
    ctx.moveTo(0, -18); ctx.lineTo(6 - step, 0);
  }
  if (f.skin !== 'banana') {
    // body
    ctx.moveTo(0, -36); ctx.lineTo(0, -18);
  }
  ctx.stroke();
  if (f.skin === 'banana') drawBananaBody(f);   // shop skin (shop.js)
  // back arm swings opposite the legs
  ctx.strokeStyle = limbs; ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(0, -32); ctx.lineTo(-8 - step * 0.4, -20);
  ctx.stroke();

  // punching arm
  const w = punchWindup(f);
  let fx, fy, wAngle;
  if (f.punchT > 0 && f.punchT <= w) {                                     // cocked back
    fx = -11; fy = -34; wAngle = -2.3;
  } else if (f.punchT > w && f.punchT <= w + PUNCH_ACTIVE) {               // POW
    fx = 21; fy = -32; wAngle = 0;
  } else if (f.stun > 0) {                                                 // flailing
    fx = 10; fy = -44; wAngle = -1.4;
  } else {                                                                 // ready
    fx = 9 + step * 0.4; fy = -22; wAngle = -1.1;
  }
  ctx.beginPath();
  ctx.moveTo(0, -32);
  if (f.punchT === 0) ctx.quadraticCurveTo(6, -30, fx, fy);   // relaxed elbow
  else ctx.lineTo(fx, fy);
  ctx.stroke();
  if (f.weapon) {
    ctx.save(); ctx.translate(fx, fy); drawWeapon(f.weapon, wAngle); ctx.restore();
  }

  if (gen) {
    drawGenHead(gen);                            // starter.js
  } else if (f.skin !== 'banana') {
    // head: a plain circle, no face
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, -46, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
  }
  // Sus Face from the shop (the banana draws its own face)
  if (f.face === 'sus' && f.skin !== 'banana') drawSusFace(1, -46);

  if (f === king) {
    if (f.skin === 'banana') ctx.translate(2, -8);   // perch on top of the banana
    drawCrown();
  }

  ctx.restore();

  // labels like the drawing: "CP" over every computer, "YOU" over you
  if (f.noLabel) return;
  const labelY = f.y - (f === king ? 80 : f.stun > 0 ? 70 : 64) - (f.skin === 'banana' ? 10 : 0);   // clear the crown
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px ' + HAND;
  ctx.fillStyle = f.isPlayer ? '#ff4a3a' : skyText();
  ctx.fillText(f.isPlayer ? 'YOU' : 'CP', f.x, labelY);
  ctx.textAlign = 'left';
}

function drawBursts() {
  for (const b of bursts) {
    const k = 1 - b.life / 18;
    const r = 10 + k * 14;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.globalAlpha = Math.min(1, b.life / 8);
    ctx.fillStyle = '#ffdd33'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = i % 2 ? r * 0.5 : r;
      i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(rr, 0);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c0202a';
    ctx.font = 'bold 12px ' + HAND; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('POW', 0, 1);
    ctx.restore();
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawPopups() {
  ctx.textAlign = 'center';
  for (const p of popups) {
    ctx.font = 'bold ' + (p.small ? 13 : 16) + 'px ' + HAND;
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ---- Drawing: HUD --------------------------------------------------------------------
// Level ring, styled like SuckerPunch's life meter: a segmented circle that
// fills as you earn points. Close the circle to level up.
function drawLevelRing(cx, cy, R, total, labelColor = '#111') {
  const level = levelFor(total);
  const frac = (total % LEVEL_POINTS) / LEVEL_POINTS;

  ctx.fillStyle = '#f4efe6';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 4;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
  }
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

  const rIn = R * 0.46;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, rIn, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.font = 'bold ' + Math.round(R * 0.48) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(level), cx, cy + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 13px ' + HAND;
  ctx.fillStyle = labelColor;
  ctx.fillText('Level ' + level, cx, cy + R + 16);
  ctx.textAlign = 'left';
}

function drawHUD() {
  // the clock, top-left like the drawing
  const secs = Math.ceil(timeLeft / 60);
  const txt = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  ctx.fillStyle = (secs <= 10 && !overtime && frame % 30 < 15) ? '#ff4a3a' : skyText();
  ctx.font = 'bold 34px ' + HAND;
  ctx.fillText(overtime ? 'OVERTIME' : txt, 22, 46);
  ctx.font = 'bold 22px ' + HAND;
  ctx.fillStyle = skyText();
  ctx.fillText(overtime ? 'next King wins!' : 'time', 26, 72);

  // points earned this match (higher on the hill = faster)
  ctx.font = 'bold 16px ' + HAND;
  ctx.fillStyle = skyNow().dark > 0.5 ? '#ffd84a' : '#b8860b';
  ctx.fillText('Points: ' + (player.hillPoints + player.kos * KO_POINTS), 24, 100);

  // Extreme pack: weapon status
  if (weaponsOn) {
    ctx.font = 'bold 14px ' + HAND;
    ctx.fillStyle = skyText();
    ctx.fillText('Weapon: ' + WEAPONS[player.weapon].name, 24, 122);
  }

  // who's King?
  const label = king ? (king.isPlayer ? 'YOU are King!' : 'King: CP') : 'The top is empty!';
  ctx.font = 'bold 18px ' + HAND;
  const tw = ctx.measureText(label).width + 30;
  ctx.fillStyle = king && king.isPlayer ? 'rgba(255, 210, 60, 0.9)' : 'rgba(255,255,255,0.75)';
  // sits right of centre so it's clear of the big crown over the summit
  const pillX = 590;
  roundRect(pillX - tw / 2, 12, tw, 32, 16); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center';
  ctx.fillText(label, pillX, 34);
  ctx.textAlign = 'left';

  drawLevelRing(W - 52, 50, 30, progress.total, skyText());
}

// ---- Drawing: screens -------------------------------------------------------------
// A gold point coin.
function drawCoin(x, y, r) {
  ctx.fillStyle = '#ffd84a';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = Math.max(1.5, r * 0.18);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.68, 0, Math.PI * 2); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#b8860b';
  ctx.font = 'bold ' + Math.round(r * 1.05) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('P', x, y + 1);
  ctx.textBaseline = 'alphabetic';
}

// Wallet badge: a coin and how many Stick Bucks are in the wallet. On the
// start screen it's also the button that opens the shop.
const WALLET_BTN = { x: W - 175, y: 14, w: 165, h: 64 };
function drawWalletBadge(cx, cy, amount, label = 'Stick Bucks') {
  const txt = Math.round(amount).toLocaleString();
  ctx.font = 'bold 20px ' + HAND;
  const w = ctx.measureText(txt).width + 56;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(cx - w / 2, cy - 18, w, 36, 18); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5; ctx.stroke();
  drawCoin(cx - w / 2 + 20, cy, 11);
  ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 20px ' + HAND;
  ctx.textAlign = 'left';
  ctx.fillText(txt, cx - w / 2 + 38, cy + 7);
  ctx.textAlign = 'center'; ctx.font = 'bold 12px ' + HAND;
  ctx.fillText(label, cx, cy + 32);
  ctx.textAlign = 'left';
}

function drawMenu() {
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center';
  ctx.font = 'bold 46px ' + HAND;
  ctx.fillText('King of the Hill', W / 2, 78);
  ctx.font = 'bold 17px ' + HAND;
  ctx.fillText('Be on top of the hill when the time runs out!', W / 2, 112);
  ctx.font = '15px ' + HAND;
  ctx.fillText('Punch people off the top · jump to dodge a punch', W / 2, 138);

  // whoever you played as last, waiting on the hill
  const me = menuPreview(progress.skin);
  me.face = progress.face;
  me.x = W / 2 - 3; me.y = 296;
  drawPreview(me);
  ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.font = 'bold 15px ' + HAND;
  ctx.fillText(charName(progress.skin), W / 2, 322);

  // big Play button
  ctx.fillStyle = '#6cc23a';
  roundRect(PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h, 28); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 30px ' + HAND; ctx.textAlign = 'center';
  ctx.fillText('Play ▶', W / 2, PLAY_BTN.y + 38);

  ctx.font = 'bold 16px ' + HAND;
  ctx.fillText('Press Enter to play  ·  S for the Shop', W / 2, 428);
  ctx.font = '15px ' + HAND;
  ctx.fillText('← → move   ·   ↑ jump   ·   Space punch   ·   M sound   ·   R menu', W / 2, 452);
  ctx.textAlign = 'left';

  // pulse gently so it's clear you can click it
  const glow = 0.5 + Math.sin(frame * 0.08) * 0.5;
  ctx.fillStyle = 'rgba(255, 210, 60,' + (0.25 + glow * 0.3) + ')';
  roundRect(WALLET_BTN.x, WALLET_BTN.y - 4, WALLET_BTN.w, 46, 22); ctx.fill();
  drawWalletBadge(W - 92, 36, walletBalance(), 'Stick Bucks · tap for Shop');
}

// Start-screen preview: a standing figure that doesn't need a live match.
const MENU_PREVIEWS = {};
function menuPreview(skin) {
  const key = skin || 'stick';
  if (!MENU_PREVIEWS[key]) {
    const p = makeFighter(0, true);
    p.facing = 1; p.noLabel = true; p.skin = skin;
    MENU_PREVIEWS[key] = p;
  }
  return MENU_PREVIEWS[key];
}
function drawPreview(p) {
  const savedKing = king; king = null;      // no glow / KING label on the cards
  ctx.save();
  ctx.translate(p.x, p.y); ctx.scale(1.6, 1.6); ctx.translate(-p.x, -p.y);
  drawFighter(p);
  ctx.restore();
  king = savedKing;
}

function drawResults() {
  const r = result;
  const t = Math.min(1, Math.max(0, (overTimer - 20) / 90));    // ring + wallet count-up
  const shown = r.before + (r.after - r.before) * t;
  const walletShown = r.walletBefore + (r.walletAfter - r.walletBefore) * t;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fffaf0';
  roundRect(170, 48, 460, 444, 22); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 4; ctx.stroke();

  ctx.textAlign = 'center'; ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 38px ' + HAND;
  ctx.fillText(r.won ? 'You are King of the Hill!' : 'CP is King of the Hill', W / 2, 98);
  ctx.font = 'bold 17px ' + HAND;
  ctx.fillText('You knocked off ' + r.kos + (r.kos === 1 ? ' person' : ' people'), W / 2, 130);
  ctx.fillStyle = '#b8860b';
  ctx.font = 'bold 15px ' + HAND;
  ctx.fillText('+' + r.hillPoints + ' up the hill   +' + r.koPoints + ' for knock-offs' + (r.won ? '   +' + r.winBonus + ' for winning' : ''), W / 2, 156);

  // the points go into the wallet, counting up
  const wtxt = 'Stick Bucks: ' + Math.round(walletShown).toLocaleString() + (r.earned ? '   (+' + r.earned + ')' : '');
  ctx.font = 'bold 19px ' + HAND;
  const ww = ctx.measureText(wtxt).width;
  drawCoin(W / 2 - ww / 2 - 16, 182, 11);
  ctx.textAlign = 'center'; ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 19px ' + HAND;
  ctx.fillText(wtxt, W / 2 + 6, 189);

  drawLevelRing(W / 2, 270, 50, shown);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1a1a1a'; ctx.font = '14px ' + HAND;
  const need = LEVEL_POINTS - Math.floor(shown % LEVEL_POINTS);
  ctx.fillText(need + ' points to the next level', W / 2, 358);

  if (levelFor(shown) > levelFor(r.before)) {
    const pulse = 1 + Math.sin(overTimer * 0.2) * 0.06;
    ctx.save();
    ctx.translate(W / 2, 392); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#e0392b'; ctx.font = 'bold 24px ' + HAND;
    ctx.fillText('LEVEL UP!', 0, 0);
    ctx.restore();
  }

  if (overTimer >= 45) {
    for (const [b, label] of [[BTN_AGAIN, 'Play again'], [BTN_MENU, 'Menu']]) {
      ctx.fillStyle = b === BTN_AGAIN ? '#6cc23a' : '#ffffff';
      roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 17px ' + HAND;
      ctx.fillText(label, b.x + b.w / 2, b.y + 26);
    }
    ctx.font = '12px ' + HAND; ctx.fillStyle = '#666';
    ctx.fillText('Enter: play again  ·  R: menu', W / 2, 474);
  }
  ctx.textAlign = 'left';
}

// ---- Main draw ---------------------------------------------------------------------
function draw() {
  if (gameState === 'shop') { drawShop(); return; }
  if (gameState === 'loadout') { drawLoadout(); return; }
  drawSky();
  drawHill();
  if (gameState === 'menu') { drawMenu(); return; }

  // draw the player last so you're never hidden in the crowd
  for (const f of fighters) if (f !== player) drawFighter(f);
  drawFighter(player);
  drawBursts();
  drawPopups();
  drawHUD();
  if (gameState === 'over') drawResults();
}

