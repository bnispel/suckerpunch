// The four playable characters. Each has a look and an attack style:
//  Blue          — gray body, blue lens/tongue, melee tongue lash
//  Nameless one  — green body, gray lens, shoots spinning triangles
//  Ember         — black body, fire on the head, shoots fireballs
//  Corupted Cape — purple body, witch hat + red cape, throws damaging potions
const CHAR_KEYS = ['Blue', 'Green', 'Fire', 'Cape', 'Storm', 'Mike', 'Slim'];
const CHARACTERS = {
  Blue:  { name: 'Blue',          body: '#55555c', visor: '#1a3a8a', tongue: '#1448e0', accent: '#3a6ff0', attack: 'melee' },
  Green: { name: 'Nameless one',  body: '#3aa83a', visor: '#55555c', tongue: '#1448e0', accent: '#3aa83a', attack: 'triangle' },
  Fire:  { name: 'Ember',         body: '#1a1a1a', visor: '#55555c', tongue: '#ff6a18', accent: '#ff6a18', attack: 'fireball' },
  Cape:  { name: 'Corupted Cape', body: '#5a2db5', visor: '#55555c', tongue: '#8a4cff', accent: '#8a4cff', attack: 'potion', hat: true, cape: true },
  Storm: { name: 'Storm',         body: '#ffd23a', visor: '#1a3a8a', tongue: '#1f6fff', accent: '#ffd23a', attack: 'melee', storm: true, dmg: 8, power: 'Lightning' },
  Mike:  { name: 'Mike',          body: '#c0202a', visor: '#ffcf33', tongue: '#c01818', accent: '#e23b3b', attack: 'melee', boxer: true, power: 'Punch', dmg: 7 },
  Slim:  { name: 'Slim',          body: '#aacc2a', visor: '#aacc2a', tongue: '#aacc2a', accent: '#aacc2a', attack: 'slime', slime: true, power: 'Slime balls' },
};

function makeFighter(x, y, facing, charKey, combat) {
  const c = CHARACTERS[charKey];
  return {
    x, y, w: 28, h: 48,
    vx: 0, vy: 0, onGround: false, facing,
    charKey, name: c.name,
    bodyColor: c.body, visorColor: c.visor, tongueColor: c.tongue, accent: c.accent,
    attack: c.attack,
    // ranged fighters shoot projectiles from afar; melee/potion fighters chase
    ranged: c.attack === 'triangle' || c.attack === 'fireball' || c.attack === 'slime',
    hat: c.hat || false,              // witch hat (Corupted Cape)
    cape: c.cape || false,            // red cape (Corupted Cape)
    storm: c.storm || false,          // lightning tongue + ground strike on jump (Storm)
    boxer: c.boxer || false,          // red gloves + jabbing punch (Mike)
    slime: c.slime || false,          // Minecraft-style slime cube that lobs slime balls (Slim)
    hp: 100, maxHp: 100,
    attackTimer: 0,      // >0 while a lash animation is active
    cooldown: 0,         // frames until next melee attack allowed
    hitDone: false,      // damage already applied for current lash
    hurt: 0,             // flash timer when taking damage
    speed: combat.speed,
    // melee damage: a character can override it (e.g. Storm's softer tongue)
    damage: c.dmg != null ? c.dmg : combat.damage,
    atkCooldown: combat.atkCooldown,
    shootCD: 0,                       // frames until it can shoot/throw again
    shootCooldown: combat.shootCooldown,
    projSpeed: combat.projSpeed,
    projDamage: combat.projDamage,
    inLava: false,                    // touching the lava this frame
    escapingLava: false,              // rising out of lava — pass up through platforms
    sinking: false,                   // playing the death-by-lava sink
    lavaTick: 0,                      // counts frames of lava contact
    moveDir: 0,                       // AI's current independent move intent
    wantJump: false,                  // AI queued a jump
  };
}

// Player always gets solid fixed stats; only the computer scales by difficulty.
const PLAYER_COMBAT = { speed: 3.4, damage: 11, atkCooldown: 28, shootCooldown: 45, projSpeed: 5.0, projDamage: 9 };
const DIFFICULTIES = {
  Easy:   { speed: 1.7, damage: 4,  atkCooldown: 70, shootCooldown: 130, projSpeed: 3.0, projDamage: 4 },
  Medium: { speed: 2.4, damage: 7,  atkCooldown: 50, shootCooldown: 85,  projSpeed: 3.8, projDamage: 7 },
  Hard:   { speed: 3.3, damage: 10, atkCooldown: 34, shootCooldown: 48,  projSpeed: 5.2, projDamage: 11 },
};
