// Player input: tilt the phone (or ←/→, A/D) to steer; hold a finger or the mouse
// on the screen (or ↑, W, Space) to burn. Keys win over the tilt, until it moves.

export const FULL_TILT = 35; // degrees of tilt that steer all the way, unless set
const TILT_TAKEOVER = 5; // degrees the tilt has to move after the keys to steer again

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

// Tilt in degrees → steer from -1 to 1, all the way at `full` degrees.
export const steerOf = (tilt, full = FULL_TILT) => Math.max(-1, Math.min(1, tilt / full));

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
// gives { steer, slow, thrust } for the sim (the keys turn it slowly); `hasTilt` turns true once the phone has
// sent a real reading (desktops send none, or nulls). `fullTilt` is how many
// degrees of tilt steer all the way.
export function createControls(canvas, { fullTilt = FULL_TILT } = {}) {
  const pointers = new Set();
  const keys = new Set();
  let tilt = 0;
  let hasTilt = false;
  let keyTilt = null; // the tilt when the keys last steered, while they still hold the lean

  const onOrientation = (e) => {
    if (e.beta == null || e.gamma == null) return;
    hasTilt = true;
    tilt = tiltAngle(e.beta, e.gamma, screenAngle());
  };
  const onDown = (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pointers.add(e.pointerId);
  };
  const onUp = (e) => pointers.delete(e.pointerId);
  // iOS can show its selection magnifier despite touch-action/user-select.
  // Cancel native touches on the play canvas; pointer events still drive thrust.
  const noNativeGesture = (e) => {
    if (e.cancelable) e.preventDefault();
  };
  const onKey = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    // Keys pressed on a menu's buttons and sliders are theirs.
    if (e.type === "keydown" && e.target.closest?.("button, input, select, textarea, a")) return;
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
  canvas.addEventListener("touchstart", noNativeGesture, { passive: false });
  canvas.addEventListener("contextmenu", noNativeGesture);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("blur", onBlur);

  return {
    get hasTilt() {
      return hasTilt;
    },
    setFullTilt(degrees) {
      fullTilt = degrees;
    },
    input() {
      const left = keys.has("ArrowLeft") || keys.has("KeyA");
      const right = keys.has("ArrowRight") || keys.has("KeyD");
      // A key turns the rocket while it's held; letting go (or holding both) keeps
      // the lean it's got, which is a null steer, until the tilt moves again.
      let steer = null;
      if (left || right) keyTilt = tilt;
      if (left !== right) steer = right - left;
      else if (!left && hasTilt && (keyTilt === null || Math.abs(tilt - keyTilt) > TILT_TAKEOVER)) {
        keyTilt = null;
        steer = steerOf(tilt, fullTilt);
      }
      const thrust = pointers.size > 0 || keys.has("ArrowUp") || keys.has("KeyW") || keys.has("Space");
      return { steer, slow: left !== right, thrust };
    },
    dispose() {
      window.removeEventListener("deviceorientation", onOrientation);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("touchstart", noNativeGesture);
      canvas.removeEventListener("contextmenu", noNativeGesture);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    },
  };
}
