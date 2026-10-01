# Lincoln's Arcade

A small collection of browser games that share a common engine. Everything is
plain classic scripts sharing one global scope (no modules, no build step), so
each game runs straight from the file system.

Open the root `index.html` for a menu, or open a game's own `index.html`
directly.

## Games

- **[SuckerPunch](suckerpunch/)** — a 2D crewmate battle game. Pick a character,
  fight a computer opponent on floating rocks over a sea of lava, and knock their
  HP to zero (or bump them into the lava). See [suckerpunch/](suckerpunch/).
- **[Ultimate Character Basketball](ultimatecharacterbasketball/)** — in progress.
  Currently a starter scene (court, hoop, dribbling ball, a blinking character)
  built on the shared engine.
- **[King of the Hill](kingofthehill/)** — stick-man brawl on a big hill. Be the
  one standing on top when the 1:30 clock runs out. Punch people off the top
  (jump to dodge a punch). The higher up the hill you stand, the more points
  you earn each second (plus 2 per knock-off and a bonus for winning). Every
  point goes into your wallet as **Stick Bucks** (saved in the browser) and
  also fills your level ring. Click the wallet on the start screen (or press
  **S**) to open the **Shop**: Bob the Banana (a skin) and the Extreme Skins &
  Weapons Pack (swords, pickaxes and hammers) are buyable now; Battle of the
  Kings (new maps) and Night Apocalypse are coming soon. Page 2 has the
  Starter Pack (the computer makes up 3 new weapons and 3 new skins just for
  you), the Sus Face (worn on any character) and Voice Chat (coming soon). Every stick man
  looks and plays the same unless you buy something in the shop.
  The sky follows the real time of day: sunrise, daytime, sunset, and a
  moon and stars at night (add `?hour=21` to the URL to preview a time).

## Shared engine

Reusable, game-agnostic code lives in `engine/`, loaded before each game's own
scripts:

```
engine/
  canvas.js    # rectsOverlap, hitBox, roundRect, shadeColor, drawFlame
  effects.js   # isBlinking + randomBlinkPhase (the eye-blink effect)
  loop.js      # startGameLoop() — the requestAnimationFrame runner
```

The engine assumes each game defines the globals it needs — a `ctx` (2D canvas
context) and a `frame` clock — then calls `startGameLoop()` once its `update()`
and `draw()` functions exist.

## Project layout

```
index.html                    # menu linking to each game
engine/                       # shared, game-agnostic code (see above)
suckerpunch/
  index.html                  # loads ../engine + its own scripts
  css/style.css
  js/                         # config, world, characters, physics, combat, ai, render, ...
  reference/                  # design sketches / screenshots (the kid's drawings)
ultimatecharacterbasketball/
  index.html
  css/style.css
  js/game.js                  # starter scene
kingofthehill/
  index.html
  css/style.css
  js/game.js                  # the game (hill, fighters, AI, HUD, menus, wallet)
  js/shop.js                  # the shop screen, items, the banana skin and the Sus Face
  js/starter.js               # makes up the Starter Pack's random weapons and skins
  js/loadout.js               # the pick screens before a battle (character, weapon, face)
  js/main.js                  # starts the game loop once everything is loaded
  reference/sketch.jpg        # Lincoln's drawing of the game
  reference/shop-sketch.jpg   # Lincoln's drawing of the shop
```

## King of the Hill controls

- **← / →** — move
- **↑** — jump (the only way to dodge a punch)
- **Space** — punch
- **M** — sound on/off
- **S** — open the shop (from the start screen)
- **Play** → pick your character → pick your weapon → pick your face → battle. On each pick screen: click one (or **← / →**), **Enter** for Next / Fight!, **Esc** to go back. A screen is skipped if you don't own anything to choose there yet.
- **R** — back to the menu

## SuckerPunch controls

- **← / →** — move
- **Space** (or ↑) — jump
- **F** — attack
- **R** — back to the menu
- Menus: click an option, or press the matching number key
