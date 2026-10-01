// Starter Pack — when you buy it, the computer makes up 3 brand-new weapons
// and 3 brand-new skins just for you: random shapes, colours, names and stats.
// They're saved with your progress (progress.generated) so they stay yours.
//
// The weapons show up on the item screen and the skins show up as characters
// on the start screen.

const GEN_COLORS = ['#e0392b', '#1f6fff', '#2f9e3a', '#7b3fc4', '#ff8a1a', '#e64fa0', '#14a3a3', '#8a5a2b'];
const GEN_COLOR_NAMES = { '#e0392b': 'Red', '#1f6fff': 'Blue', '#2f9e3a': 'Green', '#7b3fc4': 'Purple',
                          '#ff8a1a': 'Orange', '#e64fa0': 'Pink', '#14a3a3': 'Teal', '#8a5a2b': 'Brown' };
const GEN_HEAD_FILLS = ['#ffffff', '#ffe066', '#bfe3ff', '#ffd1e6', '#c8f2c0', '#ffd8b0'];

// Weapon types: what the head looks like, and roughly how it plays.
const GEN_WEAPON_TYPES = {
  blade: { noun: ['Blade', 'Slicer', 'Katana'], reach: [16, 24], power: [1.3, 1.5], windup: [0, 1] },
  club:  { noun: ['Club', 'Bonker', 'Bat'],     reach: [6, 12],  power: [1.7, 2.0], windup: [3, 5] },
  axe:   { noun: ['Axe', 'Chopper'],            reach: [10, 14], power: [1.6, 1.8], windup: [2, 3] },
  mace:  { noun: ['Mace', 'Smasher'],           reach: [8, 12],  power: [1.9, 2.2], windup: [4, 6] },
  spear: { noun: ['Spear', 'Poker', 'Lance'],   reach: [24, 30], power: [1.2, 1.35], windup: [1, 2] },
};
const GEN_WEAPON_ADJ = ['Blaze', 'Frost', 'Thunder', 'Shadow', 'Mega', 'Zap', 'Ninja', 'Goo', 'Turbo', 'Cosmic'];

// Skin head shapes and the name that goes with each.
const GEN_HEADS = { circle: 'Bubble', square: 'Boxhead', triangle: 'Pointy', diamond: 'Gem' };

const genPick = list => list[Math.floor(Math.random() * list.length)];
const genBetween = ([lo, hi]) => lo + Math.random() * (hi - lo);

function makeGenWeapon(i, usedNames) {
  const type = genPick(Object.keys(GEN_WEAPON_TYPES)), t = GEN_WEAPON_TYPES[type];
  let name;
  do { name = genPick(GEN_WEAPON_ADJ) + ' ' + genPick(t.noun); } while (usedNames.has(name));
  usedNames.add(name);
  const w = {
    id: 'gen-w-' + i, gen: true, type, name,
    reach: Math.round(genBetween(t.reach)),
    power: Math.round(genBetween(t.power) * 100) / 100,
    windup: Math.round(genBetween(t.windup)),
    color: genPick(GEN_COLORS),
    handle: genPick(['#7a4a1a', '#3a3a3a', '#8a5a2b', '#5c6370']),
    length: Math.round(18 + Math.random() * 8),
  };
  // a short description from its stats, for the item screen
  w.desc = w.reach >= 20 ? 'Long reach' : w.power >= 1.9 ? 'Hits super hard, but slow' : w.power >= 1.6 ? 'Hits hard' : 'Quick and handy';
  return w;
}

function makeGenSkin(i, usedNames) {
  let head, color, name;
  do {
    head = genPick(Object.keys(GEN_HEADS));
    color = genPick(GEN_COLORS);
    name = GEN_COLOR_NAMES[color] + ' ' + GEN_HEADS[head];
  } while (usedNames.has(name));
  usedNames.add(name);
  return { id: 'gen-s-' + i, gen: true, name, head, body: color, headFill: genPick(GEN_HEAD_FILLS) };
}

function generateStarterPack() {
  const names = new Set();
  progress.generated = {
    weapons: [0, 1, 2].map(i => makeGenWeapon(i, names)),
    skins:   [0, 1, 2].map(i => makeGenSkin(i, names)),
  };
  registerGenerated();
}

// Made-up weapons join the WEAPONS table so the game treats them like any other.
function registerGenerated() {
  for (const w of progress.generated.weapons) WEAPONS[w.id] = w;
}
function genSkin(id) {
  return id ? progress.generated.skins.find(sk => sk.id === id) || null : null;
}
registerGenerated();

// ---- Drawing ------------------------------------------------------------------------
// A made-up weapon, pointing along +x from the hand (like drawWeapon's others).
function drawGenWeapon(w) {
  const L = w.length;
  ctx.strokeStyle = w.handle; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(L, 0); ctx.stroke();
  ctx.fillStyle = w.color; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (w.type === 'blade') {
    ctx.moveTo(4, -3); ctx.lineTo(L + 8, -2.5); ctx.lineTo(L + 14, 0); ctx.lineTo(L + 8, 2.5); ctx.lineTo(4, 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(3, -6); ctx.lineTo(3, 6); ctx.stroke();       // guard
  } else if (w.type === 'club') {
    ctx.ellipse(L, 0, 9, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (w.type === 'axe') {
    ctx.moveTo(L - 4, -2); ctx.quadraticCurveTo(L + 10, -14, L + 8, 0);
    ctx.quadraticCurveTo(L + 10, 14, L - 4, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (w.type === 'mace') {
    for (let i = 0; i < 8; i++) {                                               // spikes
      const a = (i / 8) * Math.PI * 2;
      ctx.moveTo(L + Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.lineTo(L + Math.cos(a) * 10, Math.sin(a) * 10);
    }
    ctx.stroke();
    ctx.beginPath(); ctx.arc(L, 0, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (w.type === 'spear') {
    ctx.moveTo(L - 1, -4); ctx.lineTo(L + 12, 0); ctx.lineTo(L - 1, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

// A made-up skin's head (in fighter coordinates; centre at 0, -46).
function drawGenHead(sk) {
  const cy = -46;
  ctx.fillStyle = sk.headFill; ctx.strokeStyle = sk.body; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (sk.head === 'square') {
    ctx.rect(-10, cy - 10, 20, 20);
  } else if (sk.head === 'triangle') {
    ctx.moveTo(0, cy - 13); ctx.lineTo(11, cy + 9); ctx.lineTo(-11, cy + 9); ctx.closePath();
  } else if (sk.head === 'diamond') {
    ctx.moveTo(0, cy - 13); ctx.lineTo(11, cy); ctx.lineTo(0, cy + 11); ctx.lineTo(-11, cy); ctx.closePath();
  } else {
    ctx.arc(0, cy, 10, 0, Math.PI * 2);
  }
  ctx.fill(); ctx.stroke();
}
