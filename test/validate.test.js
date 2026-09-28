import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, WORLDS } from "../src/levels/index.js";
import { validateLevel, LOOKS, THING_SETTINGS } from "../src/sim/validate.js";
import { FLAME, BLOB, FAN, MAGNET, MOVER, CRUSHER, LASER, TURRET, STALACTITE } from "../src/sim/level.js";

const builtIn = ({ id, world, colors, ...level }) => level;
const ROOM = ["#".repeat(20), ...Array(10).fill(`#${".".repeat(18)}#`), "#".repeat(20)];
ROOM[10] = "#..SSS........EEE..#";
const room = (extra = {}) => ({ name: "room", map: ROOM.join("\n"), ...extra });
const refuses = (level, message) => assert.throws(() => validateLevel(level), message);

test("every built-in level would pass", () => {
  for (const def of LEVELS) assert.doesNotThrow(() => validateLevel(builtIn(def)), def.id);
  assert.equal(LOOKS, WORLDS.length);
});

test("the defaults of every kind of thing are allowed", () => {
  const defaults = { flame: FLAME, blob: BLOB, fan: FAN, magnet: MAGNET, mover: MOVER, crusher: CRUSHER, laser: LASER, turret: TURRET, stalactite: STALACTITE };
  for (const [kind, settings] of Object.entries(defaults)) {
    const thing = { kind, ...settings };
    if (kind === "mover" || kind === "crusher") thing.to = [3, 0];
    assert.doesNotThrow(() => validateLevel(room({ things: { 1: thing } })), kind);
    for (const key of Object.keys(settings)) assert.ok(Object.hasOwn(THING_SETTINGS[kind], key), `${kind}.${key}`);
  }
});

test("settings it doesn't know, or out of range, are refused", () => {
  refuses(room({ constructor: 3 }), /no setting "constructor"/);
  refuses(room({ speed: 3 }), /no setting "speed"/);
  refuses(room({ fuel: 0 }), /fuel must be a number from 1 to 300/);
  refuses(room({ fuel: "10" }), /fuel must be/);
  refuses(room({ look: LOOKS + 1 }), new RegExp(`look must be a whole number from 1 to ${LOOKS}`));
  refuses(room({ sky: 1.5 }), /sky must be a whole number/);
  refuses(room({ dark: "yes" }), /dark must be true or false/);
  refuses(room({ name: "x".repeat(41) }), /at most 40 characters/);
  refuses(room({ route: "1 <b>" }), /route has characters/);
  refuses(room({ rise: { speed: 0 } }), /rising lava's speed must be/);
  refuses(room({ rise: { speed: 1, fast: true } }), /no setting "fast"/);
  refuses(room({ format: 2 }), /format must be 1/);
  refuses({ name: "no map" }, /needs a map/);
  refuses([], /isn't a level/);
});

test("things are checked by kind", () => {
  refuses(room({ things: { 1: { kind: "flame", period: 0 } } }), /thing 1 \(flame\) has no setting "period"/);
  refuses(room({ things: { 1: { kind: "flame", c: 3 } } }), /no setting "c"/);
  refuses(room({ things: { 1: { kind: "blob", period: 0 } } }), /thing 1 \(blob\): period must be a number from 0.05 to 60/);
  refuses(room({ things: { 1: { kind: "fan", facing: "sideways" } } }), /facing must be left, right, up or down/);
  refuses(room({ things: { 1: { kind: "mover", to: [1.5, 0] } } }), /to must be \[dx, dy\]/);
  refuses(room({ things: { 1: { kind: "switch", opens: "<" } } }), /opens must be a letter or digit/);
  refuses(room({ things: { 1: { kind: "toString" } } }), /isn't a kind of thing/);
  refuses(room({ things: { 1: { kind: "bomb" } } }), /"bomb" isn't a kind of thing/);
  refuses(room({ things: { S: { kind: "gate" } } }), /"S" can't name a thing/);
  refuses(room({ things: { ab: { kind: "gate" } } }), /"ab" can't name a thing/);
  refuses(room({ things: JSON.parse('{"__proto__": {"kind": "gate"}}') }), /"__proto__" can't name a thing/);
  refuses(room({ things: { 1: "gate" } }), /must be a list of settings/);
});

test("the map's size and tiles are checked", () => {
  refuses(room({ map: "#".repeat(10) + "\n#" }), /16 to 200 tiles wide, not 10/);
  refuses(room({ map: Array(11).fill("#".repeat(20)).join("\n") }), /12 to 150 tiles high, not 11/);
  refuses(room({ map: Array(12).fill("#".repeat(201)).join("\n") }), /not 201/);
  refuses(room({ map: ROOM.map((r, i) => (i === 3 ? r.replace("..", ".é") : r)).join("\n") }), /row 4, column 3: "é" isn't a tile/);
  refuses(room({ map: 42 }), /the map must be text/);
});
