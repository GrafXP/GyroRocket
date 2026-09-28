import { TICK_RATE } from "../rocket.js";
import { TILE } from "../level.js";
import { setTile } from "../outline.js";

// Crumbling rock (level.crumbles): rock that cracks where the rocket touches it,
// and falls away `level.crumble` seconds later, taking the crumbling rock joined
// to it along, a tile at a time. Each tile's state is { cracked, fell }: the ticks
// it cracked and fell, or -1. Falling away takes it out of the world's rock outline.
export const CASCADE = 0.2; // s after a tile falls that the crumbling rock next to it goes too

export const crumbleState = () => ({ cracked: -1, fell: -1 });

// Cracks the crumbling tile holding the point (x, y), if there is one and it's whole.
export function crackAt(world, x, y) {
  const { level } = world;
  const [c, j] = [Math.floor(x / TILE), Math.floor(y / TILE)];
  if (c < 0 || j < 0 || c >= level.width || j >= level.height || !level.crumbly[j * level.width + c]) return;
  const state = world.crumbles[world.crumbleAt[j * level.width + c]];
  if (state.cracked < 0) state.cracked = world.tick;
}

// Drops the tiles whose time is up.
export function stepCrumbles(world) {
  const { level, tick } = world;
  const wait = level.crumble * TICK_RATE;
  level.crumbles.forEach((t, i) => {
    const state = world.crumbles[i];
    if (state.cracked < 0 || state.fell >= 0 || tick - state.cracked < wait) return;
    state.fell = tick;
    setTile(world.outline, t.c, t.j, false);
    // The crumbling rock next to it goes too, a moment later.
    for (const [c, j] of [
      [t.c - 1, t.j],
      [t.c + 1, t.j],
      [t.c, t.j - 1],
      [t.c, t.j + 1],
    ]) {
      const k = c >= 0 && j >= 0 && c < level.width && j < level.height ? world.crumbleAt[j * level.width + c] : -1;
      if (k >= 0 && world.crumbles[k].cracked < 0) world.crumbles[k].cracked = tick - wait + Math.round(CASCADE * TICK_RATE);
    }
  });
}

// Puts the crumbling rock back as `states` has it: whole unless it had fallen.
export function restoreCrumbles(world, states) {
  world.crumbles = states.map((s) => ({ ...s }));
  world.level.crumbles.forEach((t, i) => setTile(world.outline, t.c, t.j, world.crumbles[i].fell < 0));
}

// The index into level.crumbles of each tile, or -1.
export function crumbleIndex(level) {
  const at = new Int32Array(level.width * level.height).fill(-1);
  level.crumbles.forEach((t, i) => (at[t.j * level.width + t.c] = i));
  return at;
}
