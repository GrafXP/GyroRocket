import { parseLevel } from "./sim/level.js";
import { buildOutline } from "./sim/outline.js";
import { createWorld, advance, clock, crystalCount, SIM_VERSION } from "./sim/world.js";
import { levelHash } from "./hash.js";

// Recorded runs. The sim is deterministic and takes nothing but a code a tick
// (sim/input.js), so a run is its codes: playing them back into a fresh world flies
// it again, to the same tick. A replay is a plain object, kept as JSON:
//
//   { format, sim, level, finished, ticks, time, crystals, restarts, input }
//
// `sim` is the SIM_VERSION it was flown with and `level` the level's hash
// (hash.js); `ticks` is how many ticks it has, and a finished run ends on the tick
// it lands on the exit; `time` is the level clock then, in seconds. `assisted`
// (the autopilot flew some of it) or `cheated` (a dev cheat was on) are there when
// true: such runs never count, and one with a cheat can't be played back, as the
// cheats aren't inputs. `input` is the codes: each code's two bytes split into two
// runs (the steer bytes as the change from the tick before, which tilt keeps
// small, then the flag bytes, which hardly change), deflated, in base64. A minute
// is a few KB.

export const REPLAY_FORMAT = 1;

// A run being recorded, from the level's start: `push` each tick's code.
export function createRecorder() {
  let codes = new Uint16Array(60 * 60);
  let length = 0;
  return {
    push(code) {
      if (length === codes.length) {
        const more = new Uint16Array(length * 2);
        more.set(codes);
        codes = more;
      }
      codes[length++] = code;
    },
    get length() {
      return length;
    },
    codes: () => codes.slice(0, length),
  };
}

// The replay of a run in `world` (level `def`), from its codes.
export async function makeReplay(def, world, codes, { cheated = false } = {}) {
  return {
    format: REPLAY_FORMAT,
    sim: SIM_VERSION,
    level: levelHash(def),
    finished: world.done,
    ticks: codes.length,
    time: clock(world),
    crystals: crystalCount(world),
    restarts: world.restarts,
    ...(world.assisted && { assisted: true }),
    ...(cheated && { cheated: true }),
    input: await packInput(codes),
  };
}

// Whether a replay counts: finished from the start with no help.
export const counts = (replay) => !!replay?.finished && !replay.assisted && !replay.cheated;

// Why `replay` can't be played back on level `def` with this version of the game,
// or null if it can.
export function unplayable(def, replay) {
  if (!replay || replay.format !== REPLAY_FORMAT || typeof replay.input !== "string") return "it isn't a replay this game can read";
  if (replay.sim !== SIM_VERSION) return "it was flown on another version of the game";
  if (replay.level !== levelHash(def)) return "it was flown on another version of the level";
  if (replay.cheated) return "it was flown with a dev cheat on";
  return null;
}

// Flies `codes` in a fresh world of level `def`, headless, and says how it went:
// { world, finished, tick (it landed on the exit, or -1), time, crystals, restarts }.
// It stops at the finish.
export function playBack(def, codes) {
  const level = parseLevel(def);
  const world = createWorld(level, buildOutline(level));
  for (let i = 0; i < codes.length && !world.done; i++) advance(world, codes[i]);
  return { world, finished: world.done, tick: world.endTick, time: clock(world), crystals: crystalCount(world), restarts: world.restarts };
}

// Plays `replay` back on level `def` and checks it goes as it says:
// { ok, why (if not), finished, tick, time, crystals, restarts }. A finished run
// has to land on the exit on its last tick, and match its time, crystals and
// restarts; an unfinished one has to not finish.
export async function checkReplay(def, replay) {
  const why = unplayable(def, replay);
  if (why) return { ok: false, why };
  let codes;
  try {
    codes = await unpackInput(replay.input);
  } catch {
    return { ok: false, why: "its input is damaged" };
  }
  if (codes.length !== replay.ticks) return { ok: false, why: `it has ${codes.length} ticks, not ${replay.ticks}` };
  const run = playBack(def, codes);
  const { world, ...result } = run;
  const differs = [
    run.finished !== !!replay.finished && (replay.finished ? "it doesn't land on the exit" : "it lands on the exit"),
    run.finished && run.tick !== replay.ticks && `it lands on the exit on tick ${run.tick}, not ${replay.ticks}`,
    run.time !== replay.time && `its time is ${run.time} s, not ${replay.time} s`,
    run.crystals !== replay.crystals && `it collects ${run.crystals} crystals, not ${replay.crystals}`,
    run.restarts !== replay.restarts && `it restarts ${run.restarts} times, not ${replay.restarts}`,
  ].find(Boolean);
  return differs ? { ok: false, why: differs, ...result } : { ok: true, ...result };
}

// Codes → the replay's `input` text, and back.
export async function packInput(codes) {
  const n = codes.length;
  const bytes = new Uint8Array(n * 2);
  let steer = 0;
  for (let i = 0; i < n; i++) {
    bytes[i] = ((codes[i] & 0xff) - steer) & 0xff;
    steer = codes[i] & 0xff;
    bytes[n + i] = codes[i] >> 8;
  }
  return toBase64(await transform(bytes, new CompressionStream("deflate-raw")));
}

export async function unpackInput(text) {
  const bytes = await transform(fromBase64(text), new DecompressionStream("deflate-raw"));
  if (bytes.length % 2) throw new Error("odd length");
  const n = bytes.length / 2;
  const codes = new Uint16Array(n);
  let steer = 0;
  for (let i = 0; i < n; i++) {
    steer = (steer + bytes[i]) & 0xff;
    codes[i] = steer | (bytes[n + i] << 8);
  }
  return codes;
}

const transform = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

function toBase64(bytes) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

const fromBase64 = (text) => Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
