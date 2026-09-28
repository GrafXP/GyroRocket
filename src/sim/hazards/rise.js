import { TICK_RATE } from "../rocket.js";
import { KEY_COLORS } from "../level.js";

// Rising lava (level.rise): a surface across the whole cave, below which is all
// lava. It starts at `from` and rises at `speed` up to `to`: from lift-off, or
// `delay` seconds after the key or switch it comes `after`. Its state is { y,
// from, held }: the surface's height, the tick it starts rising (or -1 until
// its trigger), and while `held`, it waits for the rocket to lift off (after a
// restart).
export const riseState = (level) => (level.rise ? { y: level.rise.from, from: -1, held: false } : null);

// Starts the clock on the lava if what it comes after has just happened: lift-off,
// its key picked up or its switch landed on (`on`, the switch the rocket is on).
export function triggerRise(world, on) {
  const { rise } = world.level;
  const state = world.rise;
  if (!rise || state.from >= 0) return;
  const key = KEY_COLORS[rise.after];
  const at = !rise.after
    ? world.startTick
    : key
      ? world.keyTicks[world.level.keys.findIndex((k) => k.color === key)]
      : on?.kind === "switch" && on.label === rise.after
        ? world.tick
        : -1;
  if (at >= 0) state.from = at + Math.round(rise.delay * TICK_RATE);
}

export function stepRise(world) {
  const { rise } = world.level;
  const state = world.rise;
  if (!rise) return;
  if (state.held && world.rocket.state === "flying") state.held = false;
  if (state.from < 0 || world.tick < state.from || state.held) return;
  state.y = Math.min(rise.to, state.y + rise.speed / TICK_RATE);
}

// Where the lava's surface is, or -Infinity in a level without rising lava.
export const lavaHeight = (world) => world.rise?.y ?? -Infinity;

// Whether the lava's rising now.
export const rising = (world) => !!world.rise && world.rise.from >= 0 && world.tick >= world.rise.from && !world.rise.held && world.rise.y < world.level.rise.to;

// Whether any of `circles` is in the lava; `margin` raises it.
export const inRisingLava = (world, circles, margin = 0) => circles.some((c) => c.y - c.r < lavaHeight(world) + margin);
