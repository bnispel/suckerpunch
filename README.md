# SuckerPunch

A tiny 2D crewmate battle game. Pick a character, fight a computer opponent on
floating rocks over a sea of lava, and knock their HP to zero (or bump them into
the lava).

## Play

Open `index.html` in any modern browser — no build step or server needed.

### Controls
- **← / →** — move
- **Space** (or ↑) — jump
- **F** — attack
- **R** — back to the menu
- Menus: click an option, or press the matching number key

## Characters

| Character | Look | Attack |
|-----------|------|--------|
| **Blue** | gray body, blue lens & tongue | melee tongue lash |
| **Nameless one** | green body | shoots spinning triangles from afar |
| **Ember** | black body, fire on the head | lobs fireballs |
| **Corupted Cape** | purple body, witch hat & red cape | throws potions that leave a damaging splash; glides (falls slowly) thanks to the cape |

You choose your character; the computer randomly becomes one of the others. Pick a
difficulty (Easy / Medium / Hard) that scales the computer's speed and power.

## The arena

- Floating triangle rocks, each with its own randomly generated red cracks.
- A sea of lava below: standing in it burns you (10 damage on contact, then every
  ~3 seconds). Die in the lava and you sink under; die on a rock and you topple over.

## Project layout

```
index.html        # loads the stylesheet and scripts in order
css/style.css     # page + canvas styling
js/
  config.js       # canvas handles, constants, shared helpers
  world.js        # platforms and their procedural cracks
  characters.js   # character definitions, fighter factory, combat stats
  state.js        # match state, menus, starting a game
  input.js        # keyboard + mouse handling
  physics.js      # movement, collisions, lava, timers
  combat.js       # tongue lash, projectiles, potions
  ai.js           # player controls + computer opponent
  game.js         # per-frame update step and death sequence
  render.js       # all drawing
  main.js         # the requestAnimationFrame loop
```

The scripts are plain classic scripts sharing one global scope (no modules), so the
game runs straight from the file system without a local server.
