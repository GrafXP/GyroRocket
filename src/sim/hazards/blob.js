import { TICK_RATE, GRAVITY } from "../rocket.js";
import { TILE } from "../level.js";

export const BLOB_RADIUS = 0.8; // m

// Where a lava blob (level.blobs) is at `tick`: { y, up } with `up` false while
// it's down in the lava, and `warn` true while the lava bubbles before a throw.
// It's thrown straight up to `height` tiles and falls back, once every `period`.
export function blobAt(blob, tick) {
  const v = Math.sqrt(2 * GRAVITY * blob.height * TILE);
  const flight = (2 * v) / GRAVITY;
  const t = (((tick / TICK_RATE - blob.offset) % blob.period) + blob.period) % blob.period;
  if (t < flight) return { y: blob.y + v * t - (GRAVITY * t * t) / 2, up: true, warn: false };
  return { y: blob.y, up: false, warn: t > blob.period - blob.warn };
}

export const flightTime = (blob) => (2 * Math.sqrt(2 * GRAVITY * blob.height * TILE)) / GRAVITY;

// Whether any of `circles` touches the blob at `tick`. `margin` widens it.
export function inBlob(blob, circles, tick, margin = 0) {
  const { y, up } = blobAt(blob, tick);
  return up && circles.some((c) => Math.hypot(c.x - blob.x, c.y - y) < c.r + BLOB_RADIUS + margin);
}
