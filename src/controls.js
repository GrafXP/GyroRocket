// Player input: tilt the phone (or ←/→, A/D) to steer; hold a finger or the mouse
// on the screen (or ↑, W, Space) to burn. Keys win over the tilt while held.

export const FULL_TILT = 35; // degrees of tilt that steer all the way

// How far the phone is rolled to the right, in degrees, from a deviceorientation
// event's beta and gamma and the screen's rotation (screen.orientation.angle).
// It's the sideways part of gravity across the screen, so it works the same held
// flat like a marble maze or upright like a steering wheel, in any orientation, and
// has none of the jumps beta and gamma make near vertical.
export function tiltAngle(beta, gamma, screenAngle = 0) {
  const b = (beta * Math.PI) / 180;
  const g = (gamma * Math.PI) / 180;
  // "Up" in the phone's own axes (x right, y to the top, z out of the screen).
  const ux = -Math.sin(g) * Math.cos(b);
  const uy = Math.sin(b);
  // The same, across the screen as it's turned.
  const s = (screenAngle * Math.PI) / 180;
  const across = ux * Math.cos(s) - uy * Math.sin(s);
  return (Math.asin(Math.max(-1, Math.min(1, -across))) * 180) / Math.PI;
}

// Tilt in degrees → steer from -1 to 1.
export const steerOf = (tilt) => Math.max(-1, Math.min(1, tilt / FULL_TILT));

// iOS only sends orientation events after asking, from a tap. Elsewhere this is a
// no-op. Resolves to whether we may listen.
export async function requestTiltPermission() {
  const ask = globalThis.DeviceOrientationEvent?.requestPermission;
  if (typeof ask !== "function") return true;
  try {
    return (await ask.call(DeviceOrientationEvent)) === "granted";
  } catch {
    return false;
  }
}

const screenAngle = () => screen.orientation?.angle ?? window.orientation ?? 0;

// Listens on `canvas` for presses and on the window for keys and tilt. `input()`
// gives { steer, thrust } for the sim; `hasTilt` turns true once the phone has
// sent a real reading (desktops send none, or nulls).
export function createControls(canvas) {
  const pointers = new Set();
  const keys = new Set();
  let tilt = 0;
  let hasTilt = false;

  const onOrientation = (e) => {
    if (e.beta == null || e.gamma == null) return;
    hasTilt = true;
    tilt = tiltAngle(e.beta, e.gamma, screenAngle());
  };
  const onDown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.add(e.pointerId);
  };
  const onUp = (e) => pointers.delete(e.pointerId);
  const onKey = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "KeyA", "KeyD", "KeyW", "Space"].includes(code)) return;
    e.preventDefault();
    if (e.type === "keydown") keys.add(code);
    else keys.delete(code);
  };
  // Keys held while the window loses focus never send their keyup.
  const onBlur = () => keys.clear();

  window.addEventListener("deviceorientation", onOrientation);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("blur", onBlur);

  return {
    get hasTilt() {
      return hasTilt;
    },
    input() {
      const left = keys.has("ArrowLeft") || keys.has("KeyA");
      const right = keys.has("ArrowRight") || keys.has("KeyD");
      const steer = left || right ? right - left : steerOf(tilt);
      const thrust = pointers.size > 0 || keys.has("ArrowUp") || keys.has("KeyW") || keys.has("Space");
      return { steer, thrust };
    },
    dispose() {
      window.removeEventListener("deviceorientation", onOrientation);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    },
  };
}
