// Match state, menus, and the routines that start a game.
let player, enemy, winner, aiTimer, projectiles, potions, bolts, explosions, puddles;
let gameState = 'charSelect';   // 'charSelect' | 'difficulty' | 'playing' | 'dying' | 'over'
let playerCharKey = 'Blue';
let difficultyName = 'Medium';
let controlScheme = 'link';      // see CONTROL_SCHEMES (Link's controls by default)
let controlsOpen = false;        // is the "Switch Controls" dialog showing?
let opponentCharKey = null;      // chosen opponent, or null for a random one

// How many matches have been played, persisted across reloads.
let playCount = 0;
try { playCount = parseInt(localStorage.getItem('suckerpunch.plays'), 10) || 0; } catch (e) {}
function bumpPlayCount() {
  playCount++;
  try { localStorage.setItem('suckerpunch.plays', String(playCount)); } catch (e) {}
}

// "Random opponent" button on the opponent-select screen
const RANDOM_BTN = { x: 310, y: 326, w: 180, h: 30 };

// Touch controls (shown only once a touch is detected). Each held button sets a
// flag the player update reads alongside the keyboard.
let usingTouch = false;
const touch = { left: false, right: false, jump: false, attack: false };
const TOUCH_BTNS = {
  left:   { x: 58,  y: 486, r: 33, label: '◀' },
  right:  { x: 142, y: 486, r: 33, label: '▶' },
  attack: { x: 648, y: 448, r: 33, label: 'HIT' },
  jump:   { x: 742, y: 488, r: 39, label: 'JUMP' },
};
// Top-of-screen touch buttons shown during/after a match.
const TOUCH_UI = {
  menu:    { x: 304, y: 14, w: 90, h: 30, label: 'Menu' },
  restart: { x: 406, y: 14, w: 90, h: 30, label: 'Restart' },
};
function clearTouch() { touch.left = touch.right = touch.jump = touch.attack = false; }

// "Switch Controls" button on the character-select screen
const SWITCH_BTN = { x: 310, y: 322, w: 180, h: 32 };
// the dialog panel and its two choices
const DIALOG_PANEL = { x: 210, y: 96, w: 380, h: 212 };
const CONTROL_OPTIONS = [
  { id: 'link',        x: 240, y: 168, w: 320, h: 52 },
  { id: 'traditional', x: 240, y: 232, w: 320, h: 52 },
];

function updateHint() {
  const el = document.getElementById('hint');
  if (el) el.textContent = CONTROL_SCHEMES[controlScheme].hint;
}
function setControlScheme(id) { controlScheme = id; updateHint(); }

// Menu layout: character cards first, then difficulty buttons.
const CHAR_OPTIONS = [
  { key: 'Blue',  x: 29,  y: 168, w: 100, h: 132 },
  { key: 'Green', x: 136, y: 168, w: 100, h: 132 },
  { key: 'Fire',  x: 243, y: 168, w: 100, h: 132 },
  { key: 'Cape',  x: 350, y: 168, w: 100, h: 132 },
  { key: 'Storm', x: 457, y: 168, w: 100, h: 132 },
  { key: 'Mike',  x: 564, y: 168, w: 100, h: 132 },
  { key: 'Slim',  x: 671, y: 168, w: 100, h: 132 },
];
const DIFF_OPTIONS = [
  { name: 'Easy',   x: 155, y: 215, w: 150, h: 72, color: '#3aa83a' },
  { name: 'Medium', x: 325, y: 215, w: 150, h: 72, color: '#e0a000' },
  { name: 'Hard',   x: 495, y: 215, w: 150, h: 72, color: '#e0392b' },
];

// little preview crewmates for the character-select screen (reuse the renderer)
const previews = {};
for (const opt of CHAR_OPTIONS) {
  previews[opt.key] = makeFighter(opt.x + opt.w / 2 - 14, opt.y + 34, 1, opt.key, PLAYER_COMBAT);
}

function selectChar(key) { playerCharKey = key; gameState = 'opponentSelect'; }
function setOpponent(key) { opponentCharKey = key; gameState = 'difficulty'; }  // null = random

// Spawn the two fighters standing on the leftmost / rightmost rocks.
function placeOnPlatforms(pKey, eKey, diff) {
  const sorted = [...platforms].sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2));
  const pP = sorted[0], eP = sorted[sorted.length - 1];
  player = makeFighter(Math.round(pP.x + pP.w / 2 - 14), pP.y - 48, 1, pKey, PLAYER_COMBAT);
  enemy  = makeFighter(Math.round(eP.x + eP.w / 2 - 14), eP.y - 48, -1, eKey, DIFFICULTIES[diff]);
}

function startGame(diffName) {
  difficultyName = diffName;
  // use the chosen opponent, or a random other character if Random was picked
  let compKey = opponentCharKey;
  if (!compKey) {
    const others = CHAR_KEYS.filter(k => k !== playerCharKey);
    compKey = others[Math.floor(Math.random() * others.length)];
  }
  buildArena();                                  // fresh random platforms each match
  placeOnPlatforms(playerCharKey, compKey, diffName);
  projectiles = [];
  potions = [];
  bolts = [];
  explosions = [];
  puddles = [];
  winner = null;
  aiTimer = 0;
  clearTouch();
  bumpPlayCount();
  gameState = 'playing';
}

// Replay the current matchup (same fighters + difficulty) on the same arena.
function restartMatch() {
  placeOnPlatforms(player.charKey, enemy.charKey, difficultyName);
  projectiles = [];
  potions = [];
  bolts = [];
  explosions = [];
  puddles = [];
  winner = null;
  aiTimer = 0;
  clearTouch();
  bumpPlayCount();
  gameState = 'playing';
}

function goToMenu() { clearTouch(); gameState = 'charSelect'; }

// build a default match so the arena renders behind the menu overlay
placeOnPlatforms('Blue', 'Green', 'Medium');
projectiles = [];
potions = [];
bolts = [];
explosions = [];
puddles = [];
updateHint();   // show the default scheme's controls under the canvas
