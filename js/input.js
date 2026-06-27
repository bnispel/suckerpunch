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
            : (e.code === 'Digit5' || e.code === 'Numpad5') ? 4 : -1;
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
