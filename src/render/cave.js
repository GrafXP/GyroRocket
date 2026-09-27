import * as THREE from "three";
import { TILE } from "../sim/level.js";
import { POINTS, SOLID } from "../sim/outline.js";

// The cave, built once per level from its rock outline (sim/outline.js). The rock's
// face is flat at z = 0, the plane the rocket flies in, so what you see is what you
// hit. The rock's surfaces go back from there to the cave's back wall at -DEPTH,
// darkening as they go, and a lighter rim along the face marks the edge.
export const DEPTH = 10;
const MARGIN = 30; // tiles of rock drawn past the level's edges
const TEXTURE_SIZE = 12; // metres per repeat of the rock texture
const RIM = 0.3; // m

export const CAVE_COLORS = {
  face: 0x8a7a68,
  wall: 0xa08a74,
  rim: 0xcdb698,
  back: 0x2c2520,
};

export function createCave(outline, colors = CAVE_COLORS) {
  const { level, cols, rows, cases, segs } = outline;
  const texture = rockTexture();
  const group = new THREE.Group();

  // The face: each cell's rock polygon, and plain rock past the level's edges.
  const face = new Builder();
  for (let jj = 0; jj < rows; jj++) {
    for (let cc = 0; cc < cols; cc++) {
      const poly = SOLID[cases[jj * cols + cc]].map((p) => [(cc - 0.5 + POINTS[p][0]) * TILE, (jj - 0.5 + POINTS[p][1]) * TILE]);
      for (let k = 1; k < poly.length - 1; k++) face.flat(poly[0], poly[k], poly[k + 1]);
    }
  }
  const [x0, y0] = [-0.5 * TILE, -0.5 * TILE];
  const [x1, y1] = [(level.width + 0.5) * TILE, (level.height + 0.5) * TILE];
  const m = MARGIN * TILE;
  face.rect(x0 - m, y0 - m, x1 + m, y0);
  face.rect(x0 - m, y1, x1 + m, y1 + m);
  face.rect(x0 - m, y0, x0, y1);
  face.rect(x1, y0, x1 + m, y1);
  group.add(face.mesh(new THREE.MeshLambertMaterial({ color: colors.face, map: texture })));

  // The surfaces going back from each outline segment, and the rim in front.
  const walls = new Builder();
  const rim = new Builder();
  for (const s of segs) {
    walls.wall(s);
    const [ix, iy] = [-s.nx * RIM, -s.ny * RIM]; // into the rock
    rim.flat([s.ax, s.ay], [s.ax + ix, s.ay + iy], [s.bx + ix, s.by + iy], 0.02);
    rim.flat([s.ax, s.ay], [s.bx + ix, s.by + iy], [s.bx, s.by], 0.02);
  }
  group.add(walls.mesh(new THREE.MeshLambertMaterial({ color: colors.wall, map: texture, vertexColors: true })));
  group.add(rim.mesh(new THREE.MeshLambertMaterial({ color: colors.rim })));

  const back = new Builder();
  back.rect(x0 - m, y0 - m, x1 + m, y1 + m, -DEPTH);
  group.add(back.mesh(new THREE.MeshLambertMaterial({ color: colors.back, map: texture })));
  return group;
}

// Collects triangles with normals, texture coordinates in metres and a shade.
class Builder {
  pos = [];
  normal = [];
  uv = [];
  shade = [];

  vertex(x, y, z, nx, ny, nz, u, v, shade = 1) {
    this.pos.push(x, y, z);
    this.normal.push(nx, ny, nz);
    this.uv.push(u / TEXTURE_SIZE, v / TEXTURE_SIZE);
    this.shade.push(shade, shade, shade);
  }

  // A triangle facing the camera, at depth z; corners anticlockwise.
  flat(a, b, c, z = 0) {
    for (const [x, y] of [a, b, c]) this.vertex(x, y, z, 0, 0, 1, x, y);
  }

  rect(xa, ya, xb, yb, z = 0) {
    this.flat([xa, ya], [xb, ya], [xb, yb], z);
    this.flat([xa, ya], [xb, yb], [xa, yb], z);
  }

  // A segment's surface from the face back to -DEPTH, facing the air.
  wall(s) {
    const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
    const u = s.ax * s.ny - s.ay * s.nx; // how far a is along the direction a → b
    const [a0, b0, a1, b1] = [
      [s.ax, s.ay, 0, u, 1],
      [s.bx, s.by, 0, u + len, 1],
      [s.ax, s.ay, -DEPTH, u, 0.3],
      [s.bx, s.by, -DEPTH, u + len, 0.3],
    ];
    for (const [x, y, z, tu, shade] of [a0, b0, a1, b0, b1, a1]) this.vertex(x, y, z, s.nx, s.ny, 0, tu, z, shade);
  }

  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.normal, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    if (material.vertexColors) g.setAttribute("color", new THREE.Float32BufferAttribute(this.shade, 3));
    return new THREE.Mesh(g, material);
  }
}

// A seamless grey rock texture: a few octaves of value noise over faint strata.
function rockTexture() {
  const size = 256;
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
      const g = Math.max(0, Math.min(255, (0.62 + v * 0.55) * 255));
      img.data.set([g, g, g, 255], (y * size + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
