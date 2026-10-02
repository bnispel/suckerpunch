// The Shop — spend Stick Bucks (the points you earn) on mods for your
// character or the game. Laid out like Lincoln's shop drawings (page 1 is
// reference/shop-sketch.jpg): four cards a page, each with a coloured frame,
// a picture, a name, a price and a Buy button.
//
// Open it by clicking the Stick Bucks wallet on the start screen (or press S).
// Purchases are saved with your progress (see `progress` in game.js).

// kind: 'mod' (switch on/off), 'skin' (a character), 'face' (worn on any
// character), 'pack' (a one-time bundle). page: which shop page it's on.
const SHOP_ITEMS = [
  { id: 'extreme', kind: 'mod',  name: 'Extreme Skins & Weapons Pack', desc: 'Swords, pickaxes & hammers in the game!',
    price: 1500, frame: '#d42a2a', button: '#1f7a4a' },
  { id: 'banana',  kind: 'skin', name: 'Bob the Banana', desc: 'Play as a banana!',
    price: 1000, frame: '#2f9e3a', button: '#1f5fd0' },
  { id: 'kings',   kind: 'map',  name: 'Battle of the Kings', desc: 'New maps to fight on',
    price: 2500, frame: '#6a3fc4', button: '#1f7a4a', soon: true },
  { id: 'night',   kind: 'mode', name: 'Night Apocalypse', desc: 'Fight in the dark. The crown glows!',
    price: 0, frame: '#2a2a2a', button: '#e0a000', soon: true },
  // page 2
  { id: 'voice',   kind: 'feature', name: 'Voice Chat', desc: 'Talk to your friends while you play',
    price: 0, frame: '#6a3fc4', button: '#e0a000', soon: true, page: 1 },
  { id: 'starter', kind: 'pack', name: 'Starter Pack', desc: '3 new weapons + 3 new skins, made up by the computer!',
    price: 3000, frame: '#1f5fd0', button: '#1f5fd0', page: 1 },
  { id: 'sus',     kind: 'face', name: 'Sus Face', desc: 'A really suspicious face on you',
    price: 300, frame: '#1f5fd0', button: '#7b3fc4', page: 1 },
];
const SHOP_PAGES = 2;

// Card layout (2 x 2 on each page) and the pieces inside each card.
function cardSlot(i) {
  const x = i % 2 ? 410 : 30, y = i < 2 ? 100 : 318;
  return { x, y, w: 360, h: 206 };
}
const SHOP_CARDS = SHOP_ITEMS.map(item => {
  const page = item.page || 0;
  const i = SHOP_ITEMS.filter(it => (it.page || 0) === page).indexOf(item);
  const { x, y } = cardSlot(i);
  return { item, page, x, y, w: 360, h: 206,
           art: { x: x + 12, y: y + 12, w: 150, h: 150 },
           btn: { x: x + 178, y: y + 154, w: 166, h: 40 } };
});
const SHOP_BACK = { x: 22, y: 22, w: 96, h: 38 };
const PAGE_PREV = { x: 468, y: 34, w: 36, h: 36 };
const PAGE_NEXT = { x: 586, y: 34, w: 36, h: 36 };
let shopPage = 0;
function shopCardsOnPage() { return SHOP_CARDS.filter(c => c.page === shopPage); }
function turnPage(d) { shopPage = (shopPage + d + SHOP_PAGES) % SHOP_PAGES; }
const CONFIRM_YES = { x: 270, y: 318, w: 120, h: 42 };
const CONFIRM_NO  = { x: 410, y: 318, w: 120, h: 42 };

let shopConfirm = null;     // item waiting for "are you sure?"
let shopToast = null;       // { text, life } short message in the middle

function openShop() { shopConfirm = null; shopToast = null; shopPage = 0; gameState = 'shop'; }
function closeShop() { gameState = 'menu'; }
function toast(text) { shopToast = { text, life: 150 }; }

// ---- Buying and using things ---------------------------------------------------
function pressItemButton(item) {
  if (item.soon) { toast(item.name + ' is coming soon!'); return; }
  if (!owns(item.id)) {
    if (walletBalance() < item.price) {
      toast('You need ' + (item.price - walletBalance()).toLocaleString() + ' more Stick Bucks!');
      return;
    }
    shopConfirm = item;            // ask first, so nobody spends by accident
    return;
  }
  // already yours: skins and faces switch between "use" and "take off";
  // mods turn on/off; packs are just yours
  if (item.kind === 'skin') {
    progress.skin = progress.skin === item.id ? null : item.id;
  } else if (item.kind === 'face') {
    progress.face = progress.face === item.id ? null : item.id;
  } else if (item.kind === 'pack') {
    toast('Your new skins are on the start screen and weapons on the item screen!');
    return;
  } else {
    progress.mods[item.id] = !modOn(item.id);
  }
  saveProgress();
}

function confirmBuy() {
  const item = shopConfirm;
  shopConfirm = null;
  if (!item || !spendFromWallet(item.price)) return;
  progress.owned.push(item.id);
  // start using it straight away
  if (item.kind === 'skin') progress.skin = item.id;
  else if (item.kind === 'face') progress.face = item.id;
  else if (item.kind === 'pack') generateStarterPack();     // starter.js
  else progress.mods[item.id] = true;
  saveProgress();
  playBuySound();
  if (item.id === 'starter') {
    const g = progress.generated;
    toast('You got ' + g.skins.map(sk => sk.name).join(', ') + ' & 3 new weapons!');
  } else {
    toast('You got ' + item.name + '!');
  }
}

// "Cha-ching!" when you buy something.
function playBuySound() {
  const out = soundOut(0.35);
  if (!out) return;
  const t = audio.currentTime;
  [[988, 0], [1319, 0.09]].forEach(([freq, at]) => {
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.exponentialRampToValueAtTime(0.8, t + at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.3);
    osc.connect(g); g.connect(out);
    osc.start(t + at); osc.stop(t + at + 0.32);
  });
}

// ---- Input (called from game.js while the shop is open) ----------------------------
function shopKey(e) {
  if (shopConfirm) {
    if (e.code === 'Enter' || e.code === 'KeyY') confirmBuy();
    else if (e.code === 'Escape' || e.code === 'KeyN') shopConfirm = null;
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyR' || e.code === 'KeyB' || e.code === 'KeyS') closeShop();
  else if (e.code === 'ArrowRight') turnPage(1);
  else if (e.code === 'ArrowLeft') turnPage(-1);
}

function shopClick(mx, my) {
  if (shopConfirm) {
    if (hitBox(CONFIRM_YES, mx, my)) confirmBuy();
    else if (hitBox(CONFIRM_NO, mx, my)) shopConfirm = null;
    return;
  }
  if (hitBox(SHOP_BACK, mx, my)) { closeShop(); return; }
  if (hitBox(PAGE_PREV, mx, my)) { turnPage(-1); return; }
  if (hitBox(PAGE_NEXT, mx, my)) { turnPage(1); return; }
  for (const c of shopCardsOnPage()) {
    if (hitBox(c.btn, mx, my) || hitBox(c.art, mx, my)) { pressItemButton(c.item); return; }
  }
}

// ---- Bob the Banana skin -------------------------------------------------------------
// Drawn in the fighter's own coordinates (feet at 0,0, facing right); the
// stick arms and legs are drawn by drawFighter() around it.
function drawBananaShape(face) {
  ctx.beginPath();
  ctx.moveTo(-4, -62);
  ctx.quadraticCurveTo(34, -37, -4, -12);     // front (outer) edge
  ctx.quadraticCurveTo(2, -37, -4, -62);      // back (inner) edge
  ctx.closePath();
  ctx.fillStyle = '#ffd84a';
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.stroke();
  // brown stem on top, brown tip on the bottom
  ctx.strokeStyle = '#6b4a1e'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -62); ctx.lineTo(-8, -67); ctx.stroke();
  ctx.fillStyle = '#6b4a1e';
  ctx.beginPath(); ctx.arc(-4, -12.5, 2.2, 0, Math.PI * 2); ctx.fill();
  if (face === 'sus') { drawSusFace(6, -40); return; }
  // happy face, like the drawing
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(3.5, -42, 1.7, 0, Math.PI * 2); ctx.arc(8.5, -42, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(6, -37.5, 3.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
}
function drawBananaBody(f) {
  ctx.save();
  drawBananaShape(f.face);
  ctx.restore();
}

// ---- Sus Face ------------------------------------------------------------------------
// A really suspicious face, centred at (cx, cy) on a head about 20px across:
// heavy half-closed eyelids with the eyes sliding off to the side, one
// eyebrow raised high, a sideways smirk, and a nervous drop of sweat.
function drawSusFace(cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineCap = 'round';
  // eyes: flat lids with the pupils peeking out to the side
  for (const ex of [-3.2, 3.2]) {
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(ex - 2.4, -1.5); ctx.lineTo(ex + 2.4, -1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex + 1.3, -0.3, 1.3, 0, Math.PI); ctx.fill();
  }
  // eyebrows: one low and flat, one raised way up
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-5.6, -4); ctx.lineTo(-1.2, -3.6);
  ctx.moveTo(1.2, -5.2); ctx.quadraticCurveTo(3.6, -7.6, 6, -6.2);
  ctx.stroke();
  // sideways smirk
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-2.5, 4.2); ctx.quadraticCurveTo(1.5, 5, 4.2, 2.8); ctx.stroke();
  // sweat drop
  ctx.fillStyle = '#5bb8ff';
  ctx.beginPath(); ctx.moveTo(-7.6, -4.5); ctx.quadraticCurveTo(-5.6, -1.4, -7.6, -0.6);
  ctx.quadraticCurveTo(-9.6, -1.4, -7.6, -4.5); ctx.fill();
  ctx.restore();
}

// ---- Card pictures -------------------------------------------------------------------
// A small stick figure for the card art (feet at x, y), optionally holding a weapon.
function artStick(x, y, s, weapon, facing = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s * facing, s);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -18); ctx.lineTo(-6, 0); ctx.moveTo(0, -18); ctx.lineTo(6, 0);
  ctx.moveTo(0, -36); ctx.lineTo(0, -18);
  ctx.moveTo(0, -32); ctx.lineTo(-8, -22);
  ctx.moveTo(0, -32); ctx.lineTo(12, -30);
  ctx.stroke();
  if (weapon) { ctx.save(); ctx.translate(12, -30); drawWeapon(weapon, -0.9); ctx.restore(); }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, -46, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// Crayon-style scribble fill over a box (seeded so it doesn't flicker).
function scribble(b, color, step, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
  ctx.beginPath();
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let x = b.x - 10, up = true; x < b.x + b.w + 10; x += step, up = !up) {
    const y = up ? b.y + rnd() * 8 : b.y + b.h - rnd() * 8;
    x === b.x - 10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawCardArt(item, b) {
  ctx.save();
  roundRect(b.x, b.y, b.w, b.h, 16); ctx.clip();
  const cx = b.x + b.w / 2, bottom = b.y + b.h;

  if (item.id === 'extreme') {
    ctx.fillStyle = '#e4e4e4'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#c9c9c9';
    ctx.beginPath(); ctx.ellipse(cx, bottom + 30, 110, 60, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#d42a2a'; ctx.font = 'bold 34px ' + HAND;
    ctx.fillText('EX', b.x + 16, b.y + 40);
    artStick(b.x + 38, bottom - 24, 1.15, 'hammer', 1);
    artStick(b.x + 118, bottom - 24, 1.15, 'sword', -1);
  } else if (item.id === 'banana') {
    ctx.fillStyle = '#2a5fd6'; ctx.fillRect(b.x, b.y, b.w, b.h);
    scribble(b, '#5b8cf0', 9, 3);
    ctx.save();
    ctx.translate(cx - 4, bottom - 18); ctx.rotate(-0.25); ctx.scale(2, 2);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(-6, 0); ctx.moveTo(0, -18); ctx.lineTo(6, 0);
    ctx.moveTo(0, -32); ctx.lineTo(-9, -26); ctx.moveTo(0, -32); ctx.lineTo(12, -28);
    ctx.stroke();
    drawBananaShape();
    ctx.restore();
  } else if (item.id === 'kings') {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(b.x, b.y, b.w, b.h);
    // sun-crown with rays
    const kx = cx, ky = b.y + 36;
    ctx.strokeStyle = '#ff8a1a'; ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      ctx.beginPath(); ctx.moveTo(kx + Math.cos(a) * 26, ky + Math.sin(a) * 18 + 6);
      ctx.lineTo(kx + Math.cos(a) * 40, ky + Math.sin(a) * 30 + 6); ctx.stroke();
    }
    // drawCrown() puts its base at y = -54, so shift down to sit the crown at ky
    ctx.save(); ctx.translate(kx, ky + 10 + 54 * 1.5); ctx.scale(1.5, 1.5); drawCrown(1.5); ctx.restore();
    // brown mountain
    ctx.fillStyle = '#9c6b3e';
    ctx.beginPath(); ctx.moveTo(b.x + 30, bottom); ctx.lineTo(cx, b.y + 62); ctx.lineTo(b.x + b.w - 30, bottom); ctx.fill();
    ctx.strokeStyle = '#6b4a1e'; ctx.lineWidth = 2; ctx.stroke();
    artStick(b.x + 22, bottom - 4, 0.8, null, 1);
    artStick(b.x + b.w - 22, bottom - 4, 0.8, 'sword', -1);
  } else if (item.id === 'night') {
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(b.x, b.y, b.w, b.h);
    scribble(b, '#555', 7, 2);
    // jagged dark hills
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath(); ctx.moveTo(b.x, bottom);
    ctx.lineTo(b.x, b.y + 108); ctx.lineTo(b.x + 40, b.y + 96); ctx.lineTo(b.x + 75, b.y + 84);
    ctx.lineTo(b.x + 112, b.y + 100); ctx.lineTo(b.x + b.w, b.y + 110); ctx.lineTo(b.x + b.w, bottom);
    ctx.fill();
    // fire
    ctx.fillStyle = '#ff4a1a'; drawFlame(b.x + 118, b.y + 106, 26, 40, Math.sin(frame * 0.3) * 3);
    ctx.fillStyle = '#ffb21a'; drawFlame(b.x + 118, b.y + 106, 15, 24, Math.sin(frame * 0.3 + 1) * 2);
    // stick man with a glowing crown
    const glow = ctx.createRadialGradient(b.x + 75, b.y + 30, 2, b.x + 75, b.y + 30, 26);
    glow.addColorStop(0, 'rgba(255, 220, 80, 0.9)'); glow.addColorStop(1, 'rgba(255, 220, 80, 0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(b.x + 75, b.y + 30, 26, 0, Math.PI * 2); ctx.fill();
    artStick(b.x + 75, b.y + 84, 0.95, null, 1);
    ctx.save(); ctx.translate(b.x + 75, b.y + 84); ctx.scale(0.95, 0.95); drawCrown(); ctx.restore();
  } else if (item.id === 'voice') {
    // a stick man on a hill talking, and a big microphone (like the drawing)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(b.x, bottom - 8); ctx.quadraticCurveTo(b.x + 50, b.y + 60, b.x + 100, bottom - 8); ctx.stroke();
    artStick(b.x + 50, b.y + 96, 0.9, null, 1);
    // speech bubble
    ctx.fillStyle = '#fff'; ctx.lineWidth = 2;
    roundRect(b.x + 10, b.y + 12, 52, 26, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = 'bold 14px ' + HAND; ctx.textAlign = 'center';
    ctx.fillText('hi!!', b.x + 36, b.y + 30); ctx.textAlign = 'left';
    // microphone
    const mx = b.x + 112, my = b.y + 46;
    ctx.fillStyle = '#5c6370';
    roundRect(mx - 13, my - 26, 26, 44, 13); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 1.5;
    for (let gy = my - 18; gy < my + 12; gy += 6) { ctx.beginPath(); ctx.moveTo(mx - 9, gy); ctx.lineTo(mx + 9, gy); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mx, my + 4, 18, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my + 22); ctx.lineTo(mx, my + 40); ctx.moveTo(mx - 12, my + 40); ctx.lineTo(mx + 12, my + 40); ctx.stroke();
  } else if (item.id === 'starter') {
    // "ST" and a stick man next to a big yellow burst full of surprises
    ctx.fillStyle = '#ffffff'; ctx.fillRect(b.x, b.y, b.w, b.h);
    const sx = b.x + 92, sy = b.y + 82;
    ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + frame * 0.01, r = i % 2 ? 30 : 46;
      i ? ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r) : ctx.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1f5fd0'; ctx.font = 'bold 34px ' + HAND; ctx.textAlign = 'center';
    ctx.fillText('?', sx, sy + 12); ctx.textAlign = 'left';
    ctx.fillStyle = INK; ctx.font = 'bold 22px ' + HAND;
    ctx.fillText('ST', b.x + 62, b.y + 28);
    artStick(b.x + 30, bottom - 22, 1.05, null, 1);
  } else if (item.id === 'sus') {
    // a stick man wearing the Sus Face, big
    ctx.fillStyle = '#ffffff'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.save();
    ctx.translate(cx, bottom - 14); ctx.scale(2.2, 2.2);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(-6, 0); ctx.moveTo(0, -18); ctx.lineTo(6, 0);
    ctx.moveTo(0, -36); ctx.lineTo(0, -18);
    ctx.moveTo(0, -32); ctx.lineTo(-8, -22); ctx.moveTo(0, -32); ctx.lineTo(8, -22);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, -46, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawSusFace(0, -46);
    ctx.restore();
  }
  ctx.restore();

  // coloured frame like the drawing
  ctx.strokeStyle = item.frame; ctx.lineWidth = 6;
  roundRect(b.x, b.y, b.w, b.h, 16); ctx.stroke();
}

// ---- Drawing the shop -------------------------------------------------------------
// Word-wrap text into lines that fit maxW.
function wrapLines(text, maxW) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function itemButton(item) {
  if (item.soon) return { label: 'Coming soon', fill: '#cfcfcf', text: '#555' };
  if (!owns(item.id)) return { label: 'Buy', fill: item.button, text: '#ffffff' };
  if (item.kind === 'skin' || item.kind === 'face') {
    const using = (item.kind === 'skin' ? progress.skin : progress.face) === item.id;
    return using ? { label: 'Using ✓', fill: '#6cc23a', text: '#1a1a1a' }
                 : { label: 'Use', fill: '#ffffff', text: '#1a1a1a' };
  }
  if (item.kind === 'pack') return { label: 'Owned ✓', fill: '#e8f5e0', text: '#2f8a2f' };
  return modOn(item.id) ? { label: 'On ✓', fill: '#6cc23a', text: '#1a1a1a' }
                        : { label: 'Off', fill: '#ffffff', text: '#1a1a1a' };
}

function drawShop() {
  // notebook paper with spiral rings along the top, like the drawing
  ctx.fillStyle = '#fbf8f0'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
  for (let x = 160; x < W - 200; x += 26) {
    ctx.beginPath(); ctx.ellipse(x, 6, 5, 9, 0, Math.PI * 0.1, Math.PI * 1.9); ctx.stroke();
  }

  // back button
  ctx.fillStyle = '#ffffff';
  roundRect(SHOP_BACK.x, SHOP_BACK.y, SHOP_BACK.w, SHOP_BACK.h, 12); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = INK; ctx.font = 'bold 17px ' + HAND; ctx.textAlign = 'center';
  ctx.fillText('← Back', SHOP_BACK.x + SHOP_BACK.w / 2, SHOP_BACK.y + 25);

  ctx.font = 'bold 50px ' + HAND;
  ctx.fillText('Shop', W / 2 - 40, 72);
  ctx.textAlign = 'left';

  drawWalletBadge(W - 92, 44, walletBalance(), 'Stick Bucks');

  // page arrows; the "next" one wiggles on page 1 so you find page 2
  for (const [b, label] of [[PAGE_PREV, '◀'], [PAGE_NEXT, '▶']]) {
    const nudge = b === PAGE_NEXT && shopPage === 0 ? Math.sin(frame * 0.15) * 3 : 0;
    ctx.fillStyle = '#ffffff';
    roundRect(b.x + nudge, b.y, b.w, b.h, 18); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, b.x + b.w / 2 + nudge, b.y + 24);
  }
  ctx.font = 'bold 16px ' + HAND;
  ctx.fillText((shopPage + 1) + ' / ' + SHOP_PAGES, (PAGE_PREV.x + PAGE_NEXT.x + PAGE_NEXT.w) / 2, 58);
  ctx.textAlign = 'left';

  // an empty slot says more is on the way
  const onPage = shopCardsOnPage();
  for (let i = onPage.length; i < 4; i++) {
    const sl = cardSlot(i);
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = '#c9c1ae'; ctx.lineWidth = 2.5;
    roundRect(sl.x, sl.y, sl.w, sl.h, 16); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#a89f8a'; ctx.font = 'bold 18px ' + HAND; ctx.textAlign = 'center';
    ctx.fillText('More coming soon…', sl.x + sl.w / 2, sl.y + sl.h / 2 + 6);
    ctx.textAlign = 'left';
  }

  for (const c of onPage) {
    const it = c.item;
    ctx.fillStyle = '#ffffff';
    roundRect(c.x, c.y, c.w, c.h, 16); ctx.fill();
    ctx.strokeStyle = '#d8d2c4'; ctx.lineWidth = 2; ctx.stroke();
    drawCardArt(it, c.art);

    const tx = c.x + 178, tw = 166;
    ctx.fillStyle = INK; ctx.font = 'bold 18px ' + HAND;
    let y = c.y + 34;
    for (const line of wrapLines(it.name, tw)) { ctx.fillText(line, tx, y); y += 21; }
    ctx.font = '13px ' + HAND; ctx.fillStyle = '#555';
    y += 2;
    for (const line of wrapLines(it.desc, tw)) { ctx.fillText(line, tx, y); y += 16; }

    // price
    ctx.font = 'bold 17px ' + HAND;
    if (owns(it.id)) {
      ctx.fillStyle = '#2f8a2f'; ctx.fillText('Owned ✓', tx, c.y + 140);
    } else if (it.price === 0) {
      ctx.fillStyle = '#e0a000'; ctx.fillText('Free', tx, c.y + 140);
    } else {
      drawCoin(tx + 9, c.y + 134, 9);
      ctx.fillStyle = INK; ctx.font = 'bold 17px ' + HAND; ctx.textAlign = 'left';
      ctx.fillText(it.price.toLocaleString(), tx + 24, c.y + 140);
    }

    // button
    const bs = itemButton(it), b = c.btn;
    ctx.fillStyle = bs.fill;
    roundRect(b.x, b.y, b.w, b.h, 20); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = bs.text; ctx.font = 'bold 18px ' + HAND; ctx.textAlign = 'center';
    ctx.fillText(bs.label, b.x + b.w / 2, b.y + 27);
    ctx.textAlign = 'left';
  }

  if (shopConfirm) drawConfirm(shopConfirm);

  if (shopToast) {
    shopToast.life--;
    ctx.globalAlpha = Math.min(1, shopToast.life / 20);
    ctx.font = 'bold 20px ' + HAND;
    const tw = ctx.measureText(shopToast.text).width + 44;
    ctx.fillStyle = 'rgba(26, 26, 26, 0.9)';
    roundRect(W / 2 - tw / 2, H / 2 - 26, tw, 52, 26); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
    ctx.fillText(shopToast.text, W / 2, H / 2 + 7);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    if (shopToast.life <= 0) shopToast = null;
  }
}

function drawConfirm(item) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fffaf0';
  roundRect(220, 170, 360, 210, 20); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = INK;
  ctx.font = 'bold 24px ' + HAND;
  ctx.fillText('Buy ' + (item.id === 'extreme' ? 'the Extreme Pack' : item.name) + '?', W / 2, 220);
  ctx.font = '17px ' + HAND;
  const txt = item.price.toLocaleString() + ' Stick Bucks';
  const w = ctx.measureText(txt).width;
  drawCoin(W / 2 - w / 2 - 14, 251, 10);
  ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.font = '17px ' + HAND;
  ctx.fillText(txt, W / 2 + 4, 257);
  ctx.font = '14px ' + HAND; ctx.fillStyle = '#666';
  ctx.fillText('You have ' + walletBalance().toLocaleString() + ' · you\'ll have ' +
               (walletBalance() - item.price).toLocaleString() + ' left', W / 2, 286);
  for (const [b, label, fill] of [[CONFIRM_YES, 'Yes, buy!', '#6cc23a'], [CONFIRM_NO, 'No', '#ffffff']]) {
    ctx.fillStyle = fill;
    roundRect(b.x, b.y, b.w, b.h, 14); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = 'bold 18px ' + HAND;
    ctx.fillText(label, b.x + b.w / 2, b.y + 28);
  }
  ctx.textAlign = 'left';
}
