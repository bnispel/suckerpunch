// Core canvas handles, tunable constants, and small shared helpers.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

let frame = 0;  // global animation clock, incremented once per rendered frame

const GRAVITY = 0.7;
const JUMP_FORCE = 13;
const LAVA_Y = 502;        // top of the lava sea (canvas is 800x540)

const ATTACK_REACH = 46;   // how far in front the tongue reaches
const ATTACK_ACTIVE = 18;  // frames the lash is out

const LAVA_DAMAGE = 10;
const LAVA_INTERVAL = 180; // ~3 seconds at 60fps between lava burns

const SPLASH_LIFE = 220;   // frames Cape's potion puddle lingers (~3.7s)
const SPLASH_W = 70;       // width of the potion splash zone
const POTION_TICK = 12;    // 1 damage every 12 frames ≈ 5 dmg / second
const POTION_DAMAGE = 1;

const STORM_BOLT_LIFE = 26;   // frames a ground lightning strike lasts
const STORM_BOLT_DAMAGE = 8;  // damage if caught in Storm's ground strike

const EXPLOSION_LIFE = 18;    // frames a projectile-collision burst lasts
const PUDDLE_LIFE = 110;      // frames a slime puddle lingers where Slime jumped

// Selectable control schemes. `fight` is a list of keys (any of them attacks).
const CONTROL_KEYS = ['link', 'traditional'];
const CONTROL_SCHEMES = {
  link: {
    name: "Link's controls",
    jump: 'Space', fight: ['KeyF', 'ArrowDown'],
    summary: 'Space jumps, F or Down fights',
    hint: '← → move  •  Space jump  •  F / ↓ attack  •  R menu',
  },
  traditional: {
    name: 'Traditional',
    jump: 'ArrowUp', fight: ['Space'],
    summary: 'Up jumps, Space fights',
    hint: '← → move  •  ↑ jump  •  Space attack  •  R menu',
  },
};

// How far a platform's triangle hangs below its flat top (used by both the
// renderer and the no-touch spacing check so they agree).
function platformDepth(p) {
  return Math.min(p.w * 0.5, 46);
}

// ---- game-specific helpers ----
// Generic helpers (rectsOverlap, hitBox, roundRect, shadeColor, drawFlame)
// now live in ../../engine/ and are loaded before this file.

// Is there a platform to stand on at x, near foot height footY?
function groundUnder(x, footY) {
  for (const p of platforms) {
    if (x >= p.x && x <= p.x + p.w && p.y >= footY - 8 && p.y <= footY + 60) return p;
  }
  return null;
}
