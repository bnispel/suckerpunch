// Main loop: advance the clock, step the simulation, render, repeat.
function loop() {
  frame++;
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
