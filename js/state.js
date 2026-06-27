// Match state, menus, and the routines that start a game.
let player, enemy, winner, aiTimer, projectiles, potions;
let gameState = 'charSelect';   // 'charSelect' | 'difficulty' | 'playing' | 'dying' | 'over'
let playerCharKey = 'Blue';
let difficultyName = 'Medium';
let controlScheme = 'space';     // see CONTROL_SCHEMES

// two clickable control-scheme buttons on the character-select screen
const CONTROL_OPTIONS = [
  { id: 'space', x: 228, y: 326, w: 162, h: 28 },
  { id: 'f',     x: 410, y: 326, w: 162, h: 28 },
];

function updateHint() {
  const el = document.getElementById('hint');
  if (el) el.textContent = CONTROL_SCHEMES[controlScheme].hint;
}
function setControlScheme(id) { controlScheme = id; updateHint(); }

// Menu layout: character cards first, then difficulty buttons.
const CHAR_OPTIONS = [
  { key: 'Blue',  x: 74,  y: 168, w: 150, h: 132 },
  { key: 'Green', x: 241, y: 168, w: 150, h: 132 },
  { key: 'Fire',  x: 408, y: 168, w: 150, h: 132 },
  { key: 'Cape',  x: 575, y: 168, w: 150, h: 132 },
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

function selectChar(key) { playerCharKey = key; gameState = 'difficulty'; }

function startGame(diffName) {
  difficultyName = diffName;
  // the computer randomly becomes one of the OTHER three characters
  const others = CHAR_KEYS.filter(k => k !== playerCharKey);
  const compKey = others[Math.floor(Math.random() * others.length)];
  // spawn each fighter standing on a platform (left one / right one)
  player = makeFighter(70, 300 - 48, 1, playerCharKey, PLAYER_COMBAT);
  enemy  = makeFighter(660, 300 - 48, -1, compKey, DIFFICULTIES[diffName]);
  projectiles = [];
  potions = [];
  winner = null;
  aiTimer = 0;
  gameState = 'playing';
}

// build a default match so the arena renders behind the menu overlay
player = makeFighter(70, 300 - 48, 1, 'Blue', PLAYER_COMBAT);
enemy  = makeFighter(660, 300 - 48, -1, 'Green', DIFFICULTIES.Medium);
projectiles = [];
potions = [];
updateHint();   // show the default scheme's controls under the canvas
