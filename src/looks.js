// How keys, their doors and gates look, shared by the 3D scene, the HUD and the
// map. Each key colour has its own shape too, so they're told apart without colour.
export const KEY_LOOKS = {
  red: { color: 0xe5484d, shape: "circle" },
  yellow: { color: 0xf2c94c, shape: "triangle" },
  green: { color: 0x3fbf6a, shape: "square" },
  blue: { color: 0x4a90f0, shape: "cross" },
};
export const GATE_COLOR = 0xf08a24;

export const css = (color) => "#" + color.toString(16).padStart(6, "0");

// A shape's outline in a box from -1 to 1, y up, anticlockwise.
export function shapePoints(shape) {
  if (shape === "circle") {
    return Array.from({ length: 24 }, (_, i) => [Math.cos((i / 24) * Math.PI * 2), Math.sin((i / 24) * Math.PI * 2)]);
  }
  if (shape === "triangle") {
    return [
      [0, 1],
      [-0.95, -0.72],
      [0.95, -0.72],
    ];
  }
  if (shape === "square") {
    return [
      [-0.8, -0.8],
      [0.8, -0.8],
      [0.8, 0.8],
      [-0.8, 0.8],
    ];
  }
  const a = 0.34; // the cross's arms, half as wide
  return [
    [a, -1],
    [a, -a],
    [1, -a],
    [1, a],
    [a, a],
    [a, 1],
    [-a, 1],
    [-a, a],
    [-1, a],
    [-1, -a],
    [-a, -a],
    [-a, -1],
  ];
}

// The shape as an SVG path in a 24×24 box, y down.
export function shapePath(shape) {
  return (
    shapePoints(shape)
      .map(([x, y], i) => `${i ? "L" : "M"}${(12 + x * 10).toFixed(2)} ${(12 - y * 10).toFixed(2)}`)
      .join("") + "Z"
  );
}

// Draws the shape filled, centred on (x, y) with radius r, on a 2D canvas (y down).
export function drawShape(ctx, shape, x, y, r) {
  ctx.beginPath();
  shapePoints(shape).forEach(([px, py], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + px * r, y - py * r));
  ctx.closePath();
  ctx.fill();
}
