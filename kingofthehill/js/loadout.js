// Getting ready for battle — after you press Play you go through up to three
// "pick" screens, one after another:
//   1. Pick your character  (Stick Man, Bob the Banana, Starter Pack skins)
//   2. Pick your weapon     (Extreme pack + Starter Pack weapons)
//   3. Pick your face       (Sus Face, ...)
// then the battle starts. A screen is skipped when there's nothing to choose
// yet (e.g. no faces bought), so with nothing from the shop, Play goes
// straight into battle. Every pick is remembered for next time.

const ITEM_INFO = {
  random:  { name: 'Random',  desc: 'Surprise me!' },
  sword:   { name: 'Sword',   desc: 'Long reach' },
  pickaxe: { name: 'Pickaxe', desc: 'Hits hard' },
  hammer:  { name: 'Hammer',  desc: 'Hits hardest, but slow' },
};
function itemInfo(id) {
  if (ITEM_INFO[id]) return ITEM_INFO[id];
  const w = WEAPONS[id];
  return { name: w.name, desc: w.desc };
}

// Faces you own (plus 'none' = your character's normal look).
function faceChoices() {
  return ['none'].concat(SHOP_ITEMS.filter(it => it.kind === 'face' && owns(it.id)).map(it => it.id));
}
function faceName(id) { return id === 'none' ? 'Normal' : SHOP_ITEMS.find(it => it.id === id).name; }

// The three steps. Each one lists its choices, knows which is picked, and
// can pick a new one.
const STEPS = {
  character: {
    title: 'Pick your character', sub: () => 'Who are you playing as?',
    choices: () => menuChars(),
    current: () => progress.skin,
    pick: id => pickChar(id),
  },
  weapon: {
    title: 'Pick your weapon', sub: () => charName(progress.skin) + ' takes it into battle',
    choices: () => weaponChoices(),
    current: () => weaponChoice(progress.skin),
    pick: id => pickWeapon(id),
  },
  face: {
    title: 'Pick your face', sub: () => 'What face is ' + charName(progress.skin) + ' making?',
    choices: () => faceChoices(),
    current: () => progress.face || 'none',
    pick: id => { progress.face = id === 'none' ? null : id; saveProgress(); },
  },
};
let steps = [];        // the steps you'll go through this time
let stepAt = 0;
const step = () => STEPS[steps[stepAt]];

function openLoadout() {
  steps = [];
  if (menuChars().length > 1) steps.push('character');
  if (availableWeapons().length > 0) steps.push('weapon');
  if (faceChoices().length > 1) steps.push('face');
  if (steps.length === 0) { startMatch(); return; }   // nothing to pick yet: just play
  stepAt = 0;
  gameState = 'loadout';
}
function nextStep() {
  if (stepAt < steps.length - 1) stepAt++;
  else startMatch();
}
function prevStep() {
  if (stepAt > 0) stepAt--;
  else goToMenu();
}

// Cards for the current step: one row of big cards, or two rows of smaller
// ones once there are more than 5.
function stepCards() {
  const ids = step().choices(), n = ids.length;
  const twoRows = n > 5, perRow = twoRows ? Math.ceil(n / 2) : n;
  const gap = twoRows ? 14 : 18;
  const w = Math.min(150, (W - 60 - (perRow - 1) * gap) / perRow);
  const h = twoRows ? 120 : 180;
  return ids.map((id, i) => {
    const row = Math.floor(i / perRow), col = i % perRow;
    const inRow = Math.min(perRow, n - row * perRow);
    const left = W / 2 - (inRow * w + (inRow - 1) * gap) / 2;
    return { id, x: left + col * (w + gap), y: (twoRows ? 126 : 168) + row * (h + 12), w, h, compact: twoRows };
  });
}
const NEXT_BTN = { x: W / 2 - 80, y: 394, w: 160, h: 44 };
const LOADOUT_BACK = { x: 22, y: 22, w: 96, h: 38 };

// ---- Input ----------------------------------------------------------------------
function loadoutKey(e) {
  const s = step(), choices = s.choices(), i = Math.max(0, choices.indexOf(s.current()));
  if (e.code === 'Enter' || e.code === 'Space') nextStep();
  else if (e.code === 'ArrowLeft')  s.pick(choices[(i - 1 + choices.length) % choices.length]);
  else if (e.code === 'ArrowRight') s.pick(choices[(i + 1) % choices.length]);
  else if (e.code === 'Escape' || e.code === 'KeyR' || e.code === 'Backspace') prevStep();
}

function loadoutClick(mx, my) {
  if (hitBox(LOADOUT_BACK, mx, my)) { prevStep(); return; }
  if (hitBox(NEXT_BTN, mx, my)) { nextStep(); return; }
  const s = step();
  for (const c of stepCards()) {
    if (!hitBox(c, mx, my)) continue;
    if (s.current() === c.id) nextStep();      // clicking your pick again moves on
    else s.pick(c.id);
  }
}

// ---- Drawing ------------------------------------------------------------------------
// Your character as picked so far (with weapon and face), for the cards and corner.
function drawMe(x, y, opts) {
  const skin = opts.skin !== undefined ? opts.skin : progress.skin;
  const me = menuPreview(skin);
  const wpn = weaponChoice(skin);
  me.weapon = opts.weapon && wpn !== 'random' && steps.includes('weapon') ? wpn : null;
  me.face = opts.face !== undefined ? opts.face : progress.face;
  me.x = x; me.y = y;
  drawPreview(me);
  me.weapon = null;
}

function drawCardPicture(stepId, c) {
  const cx = c.x + c.w / 2;
  if (stepId === 'character') {
    drawMe(cx - 3, c.y + 122, { skin: c.id, weapon: false });
  } else if (stepId === 'face') {
    drawMe(cx - 3, c.y + 122, { face: c.id === 'none' ? null : c.id, weapon: false });
  } else {
    const k = c.compact ? 0.6 : 1, cy = c.y + (c.compact ? 44 : 70);
    if (c.id === 'random') {
      ctx.fillStyle = '#e0a000'; ctx.font = 'bold ' + Math.round(64 * k) + 'px ' + HAND; ctx.textAlign = 'center';
      ctx.fillText('?', cx, cy + 22 * k);
    } else {
      ctx.save(); ctx.translate(cx - 30 * k, cy + 26 * k); ctx.scale(2 * k, 2 * k);
      drawWeapon(c.id, -0.8); ctx.restore();
    }
  }
}

function cardLabel(stepId, id) {
  if (stepId === 'character') return { name: charName(id), desc: '' };
  if (stepId === 'face') return { name: faceName(id), desc: '' };
  return itemInfo(id);
}

function drawLoadout() {
  drawSky();
  drawHill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(0, 0, W, H);
  const s = step(), stepId = steps[stepAt], chosen = s.current();

  // back button
  ctx.fillStyle = '#ffffff';
  roundRect(LOADOUT_BACK.x, LOADOUT_BACK.y, LOADOUT_BACK.w, LOADOUT_BACK.h, 12); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = INK; ctx.font = 'bold 17px ' + HAND; ctx.textAlign = 'center';
  ctx.fillText('← Back', LOADOUT_BACK.x + LOADOUT_BACK.w / 2, LOADOUT_BACK.y + 25);

  ctx.font = 'bold 42px ' + HAND;
  ctx.fillText(s.title, W / 2, 74);
  ctx.font = 'bold 16px ' + HAND;
  ctx.fillText(s.sub(), W / 2, 104);

  // step dots: which screen you're on
  if (steps.length > 1) {
    ctx.font = 'bold 13px ' + HAND; ctx.fillStyle = '#666';
    ctx.fillText('Step ' + (stepAt + 1) + ' of ' + steps.length, W / 2, 132);
    steps.forEach((_, i) => {
      ctx.fillStyle = i === stepAt ? '#e0a000' : i < stepAt ? '#6cc23a' : '#cfcfcf';
      ctx.beginPath(); ctx.arc(W / 2 - (steps.length - 1) * 9 + i * 18, 146, 5, 0, Math.PI * 2); ctx.fill();
    });
  }

  // you, as picked so far, in the corner
  if (stepId !== 'character') drawMe(W - 70, 140, { weapon: true });

  for (const c of stepCards()) {
    const on = c.id === chosen, info = cardLabel(stepId, c.id);
    ctx.fillStyle = on ? '#fff6d6' : '#ffffff';
    roundRect(c.x, c.y, c.w, c.h, 16); ctx.fill();
    ctx.strokeStyle = on ? '#e0a000' : INK; ctx.lineWidth = on ? 5 : 2.5; ctx.stroke();

    drawCardPicture(stepId, c);

    const cx = c.x + c.w / 2;
    ctx.fillStyle = INK; ctx.textAlign = 'center';
    const big = c.compact ? 16 : 20;
    ctx.font = 'bold ' + (info.name.length > 12 ? big - 4 : big) + 'px ' + HAND;
    ctx.fillText(info.name, cx, c.y + (c.compact ? 90 : 150));
    if (info.desc) {
      ctx.font = (c.compact ? 11 : 13) + 'px ' + HAND; ctx.fillStyle = '#555';
      ctx.fillText(info.desc, cx, c.y + (c.compact ? 108 : 170));
    }
    if (on) {
      ctx.font = 'bold 12px ' + HAND; ctx.fillStyle = '#b8860b';
      ctx.fillText('★ picked', cx, c.y - 7);      // just above the card
    }
  }

  // Next ▶ (or Fight! on the last step)
  const last = stepAt === steps.length - 1;
  ctx.fillStyle = last ? '#e0392b' : '#6cc23a';
  roundRect(NEXT_BTN.x, NEXT_BTN.y, NEXT_BTN.w, NEXT_BTN.h, 22); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = last ? '#ffffff' : INK; ctx.font = 'bold 24px ' + HAND; ctx.textAlign = 'center';
  ctx.fillText(last ? 'Fight!' : 'Next ▶', W / 2, NEXT_BTN.y + 31);

  ctx.fillStyle = INK; ctx.font = '15px ' + HAND;
  ctx.fillText('Click one (or ← →) to pick it  ·  Enter for ' + (last ? 'Fight!' : 'Next') + '  ·  Esc to go back', W / 2, 462);
  ctx.textAlign = 'left';
}
