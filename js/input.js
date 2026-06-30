// Keyboard and mouse handling for menus and gameplay.
const keys = {};

window.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Space'].includes(e.key) || e.code === 'Space') {
    e.preventDefault();
  }
  keys[e.code] = true;

  // Controls dialog grabs input while it's open.
  if (controlsOpen) {
    if (e.code === 'Escape' || e.code === 'KeyC') controlsOpen = false;
    else if (e.code === 'Digit1' || e.code === 'Numpad1') { setControlScheme('link'); controlsOpen = false; }
    else if (e.code === 'Digit2' || e.code === 'Numpad2') { setControlScheme('traditional'); controlsOpen = false; }
    return;
  }

  const num = (e.code === 'Digit1' || e.code === 'Numpad1') ? 0
            : (e.code === 'Digit2' || e.code === 'Numpad2') ? 1
            : (e.code === 'Digit3' || e.code === 'Numpad3') ? 2
            : (e.code === 'Digit4' || e.code === 'Numpad4') ? 3
            : (e.code === 'Digit5' || e.code === 'Numpad5') ? 4
            : (e.code === 'Digit6' || e.code === 'Numpad6') ? 5
            : (e.code === 'Digit7' || e.code === 'Numpad7') ? 6 : -1;
  if (gameState === 'charSelect') {
    if (e.code === 'KeyC') controlsOpen = true;
    else if (num >= 0) selectChar(CHAR_KEYS[num]);
  } else if (gameState === 'opponentSelect') {
    if (num >= 0 && CHAR_KEYS[num] !== playerCharKey) setOpponent(CHAR_KEYS[num]);
    else if (e.code === 'KeyR' || e.code === 'Escape') gameState = 'charSelect';
  } else if (gameState === 'difficulty') {
    if (num >= 0 && num < DIFF_OPTIONS.length) startGame(DIFF_OPTIONS[num].name);
    else if (e.code === 'KeyR' || e.code === 'Escape') gameState = 'opponentSelect';
  } else if (e.code === 'KeyR') {
    gameState = 'charSelect';   // from the win screen back to the start
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// Mouse: click a character card or a difficulty button.
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (W / rect.width);
  const my = (e.clientY - rect.top) * (H / rect.height);
  // Dialog open: click a choice, or click outside to dismiss.
  if (controlsOpen) {
    for (const opt of CONTROL_OPTIONS) {
      if (hitBox(opt, mx, my)) { setControlScheme(opt.id); controlsOpen = false; return; }
    }
    if (!hitBox(DIALOG_PANEL, mx, my)) controlsOpen = false;
    return;
  }

  if (gameState === 'charSelect') {
    if (hitBox(SWITCH_BTN, mx, my)) { controlsOpen = true; return; }
    for (const opt of CHAR_OPTIONS) if (hitBox(opt, mx, my)) selectChar(opt.key);
  } else if (gameState === 'opponentSelect') {
    if (hitBox(RANDOM_BTN, mx, my)) { setOpponent(null); return; }
    for (const opt of CHAR_OPTIONS) {
      if (opt.key !== playerCharKey && hitBox(opt, mx, my)) setOpponent(opt.key);
    }
  } else if (gameState === 'difficulty') {
    for (const opt of DIFF_OPTIONS) if (hitBox(opt, mx, my)) startGame(opt.name);
  }
});

// ---- Touch controls (auto-detected) ----
// Track portrait vs landscape so the renderer knows whether to draw the
// on-canvas overlay buttons (landscape) or defer to the DOM bar (portrait).
let portrait = window.innerHeight >= window.innerWidth;
window.addEventListener('resize', () => { portrait = window.innerHeight >= window.innerWidth; });

// Wire the portrait control-bar buttons to the same `touch` flags.
document.querySelectorAll('#touch-bar .tbtn').forEach(btn => {
  const act = btn.dataset.act;
  const press = e => { e.preventDefault(); usingTouch = true; touch[act] = true; btn.classList.add('pressed'); };
  const release = e => { e.preventDefault(); touch[act] = false; btn.classList.remove('pressed'); };
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
});
// During a match, touching an on-screen button holds that action. On the menus
// we let the tap become a normal click so selection still works.
const activeTouches = {};   // touch id -> button name

function canvasPoint(t) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (t.clientX - rect.left) * (W / rect.width),
    y: (t.clientY - rect.top) * (H / rect.height),
  };
}
function touchButtonAt(x, y) {
  for (const name in TOUCH_BTNS) {
    const b = TOUCH_BTNS[name];
    if ((x - b.x) ** 2 + (y - b.y) ** 2 <= b.r * b.r) return name;
  }
  return null;
}
function releaseTouch(e) {
  for (const t of e.changedTouches) {
    const b = activeTouches[t.identifier];
    if (b) { touch[b] = false; delete activeTouches[t.identifier]; }
  }
}

canvas.addEventListener('touchstart', e => {
  usingTouch = true;   // reveal the on-screen controls from now on
  document.body.classList.add('touch');

  // top buttons (Menu / Restart) during or after a match
  if (gameState === 'playing' || gameState === 'dying' || gameState === 'over') {
    for (const t of e.changedTouches) {
      const p = canvasPoint(t);
      if (hitBox(TOUCH_UI.menu, p.x, p.y))    { goToMenu();    e.preventDefault(); return; }
      if (hitBox(TOUCH_UI.restart, p.x, p.y)) { restartMatch(); e.preventDefault(); return; }
    }
  }

  // In portrait the DOM control bar handles movement/attack, so ignore
  // on-canvas control taps there.
  if (gameState === 'playing' && !portrait) {
    let handled = false;
    for (const t of e.changedTouches) {
      const p = canvasPoint(t);
      const b = touchButtonAt(p.x, p.y);
      if (b) { activeTouches[t.identifier] = b; touch[b] = true; handled = true; }
    }
    if (handled) e.preventDefault();   // only swallow taps that hit a button
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (Object.keys(activeTouches).length) e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', releaseTouch, { passive: false });
canvas.addEventListener('touchcancel', releaseTouch, { passive: false });
