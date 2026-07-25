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
```

## SuckerPunch controls

- **← / →** — move
- **Space** (or ↑) — jump
- **F** — attack
- **R** — back to the menu
- Menus: click an option, or press the matching number key
