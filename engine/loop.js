// Generic requestAnimationFrame loop.
//
// A game defines global `update()` and `draw()` functions plus a `frame`
// clock, then calls startGameLoop() once after everything is loaded.
function startGameLoop() {
  function loop() {
    frame++;
    update();
    draw();
    requestAnimationFrame(loop);
  }
  loop();
}
