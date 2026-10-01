// A seamless rock texture on a canvas `size` pixels square: a few octaves of value
// noise over faint strata. `pixel` turns each point's value (0 to about 1) into
// [r, g, b, a]: grey for the cave (render/cave.js) unless given, and see-through
// for the rock behind the menus (main.js).
export function rockCanvas(size = 256, pixel = grey) {
  const octaves = [
    [4, 0.45],
    [8, 0.3],
    [16, 0.15],
    [64, 0.1],
  ].map(([n, amp]) => ({ n, amp, grid: Float32Array.from({ length: n * n }, Math.random) }));
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = ({ n, grid }, x, y) => {
    const [fx, fy] = [(x / size) * n, (y / size) * n];
    const [ix, iy] = [Math.floor(fx), Math.floor(fy)];
    const [tx, ty] = [smooth(fx - ix), smooth(fy - iy)];
    const at = (i, j) => grid[((j + n) % n) * n + ((i + n) % n)];
    const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
    const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
    return top + (bottom - top) * ty;
  };

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const o of octaves) v += noise(o, x, y) * o.amp;
      v += 0.06 * Math.sin((y / size) * Math.PI * 2 * 5 + noise(octaves[1], x, y) * 4);
      img.data.set(pixel(v), (y * size + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function grey(v) {
  const g = Math.max(0, Math.min(255, (0.62 + v * 0.55) * 255));
  return [g, g, g, 255];
}
