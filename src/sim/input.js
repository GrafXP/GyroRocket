// A tick's input as the sim takes it, and as a replay keeps it: a whole number from
// 0 to 65535, two bytes. Whatever flies the rocket (the tilt, the keys, the
// autopilot) is turned into one of these first, so a run is exactly its inputs,
// and playing them back flies it again to the same tick.
//
// The low byte is the steer, in 127ths of full steer to either side (-127 to 127,
// as a signed byte). The high byte's bits: burn, turn slowly (the keys steer at
// SLOW_TURN_RATE), restart from the checkpoint (the pause menu's), and hold the
// lean the rocket has (a steer of null: the keys let go), which leaves the steer 0.

export const STEER_STEPS = 127;
const THRUST = 1;
const SLOW = 2;
const RESTART = 4;
const HOLD = 8;

// { steer: -1 to 1, or null to hold; slow; thrust; restart } → its code.
export function inputCode({ steer = 0, slow = false, thrust = false, restart = false } = {}) {
  const hold = steer === null;
  const k = hold ? 0 : Math.max(-STEER_STEPS, Math.min(STEER_STEPS, Math.round(steer * STEER_STEPS))) || 0;
  const flags = (thrust ? THRUST : 0) | (slow ? SLOW : 0) | (restart ? RESTART : 0) | (hold ? HOLD : 0);
  return (k & 0xff) | (flags << 8);
}

// A code → { steer, slow, thrust, restart }. Any code at all reads as some input.
export function readInput(code) {
  const flags = code >> 8;
  return {
    steer: flags & HOLD ? null : Math.max(-1, ((code << 24) >> 24) / STEER_STEPS),
    slow: !!(flags & SLOW),
    thrust: !!(flags & THRUST),
    restart: !!(flags & RESTART),
  };
}
