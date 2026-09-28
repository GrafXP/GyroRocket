import * as THREE from "three";
import { TILE } from "../sim/level.js";
import { POINTS, SOLID } from "../sim/outline.js";

// The cave, built from its rock outline (sim/outline.js). The rock's face is flat
// at z = 0, the plane the rocket flies in, so what you see is what you hit. The
// rock's surfaces go back from there to the cave's back wall at -DEPTH, darkening
// as they go, and a lighter rim along the face marks the edge. Crumbling rock is
// paler, with glowing cracks. Most of the cave is built once; the cells round
// crumbling rock are built apart, and again whenever a tile falls away (update).
// In a level with sky, the back wall stops at the ground, and there's no rock above.
export const DEPTH = 10;
const MARGIN = 30; // tiles of rock drawn past the level's edges
const TEXTURE_SIZE = 12; // metres per repeat of the rock texture
const CRACK_SIZE = 4; // metres per repeat of the cracks
const RIM = 0.3; // m

export const CAVE_COLORS = {
  face: 0x8a7a68,
  wall: 0xa08a74,
  rim: 0xcdb698,
  back: 0x2c2520,
  crumble: 0xc4b294,
  cracks: 0xff8a3a,
};

export function createCave(outline, colors = CAVE_COLORS) {
  colors = { ...CAVE_COLORS, ...colors };
  const { level, cols, rows } = outline;
  const texture = rockTexture();
  const group = new THREE.Group();
  const materials = {
    face: new THREE.MeshLambertMaterial({ color: colors.face, map: texture }),
    wall: new THREE.MeshLambertMaterial({ color: colors.wall, map: texture, vertexColors: true }),
    rim: new THREE.MeshLambertMaterial({ color: colors.rim }),
  };
  if (level.crumbles.length) {
    const [map, glow] = crackTextures();
    const crumbly = (shaded) =>
      new THREE.MeshLambertMaterial({ color: colors.crumble, map, emissive: colors.cracks, emissiveMap: glow, emissiveIntensity: 0.9, vertexColors: shaded });
    Object.assign(materials, { crumbleFace: crumbly(false), crumbleWall: crumbly(true) });
  }

  // Cells with crumbling rock at a corner change as it falls, so they're built apart.
  const live = new Uint8Array(cols * rows);
  const liveCells = [];
  for (const t of level.crumbles) {
    for (const jj of [t.j, t.j + 1]) {
      for (const cc of [t.c, t.c + 1]) {
        if (!live[jj * cols + cc]) liveCells.push([cc, jj]);
        live[jj * cols + cc] = 1;
      }
    }
  }

  // The face: each cell's rock polygon, and plain rock past the level's edges.
  const face = new Builder();
  const walls = new Builder();
  const rim = new Builder();
  for (let jj = 0; jj < rows; jj++) {
    for (let cc = 0; cc < cols; cc++) {
      if (live[jj * cols + cc]) continue;
      face.polygon(cellPolygon(outline, cc, jj));
      for (const s of outline.cells[jj * cols + cc]) edge(walls, rim, s);
    }
  }
  const [x0, y0] = [-0.5 * TILE, -0.5 * TILE];
  const [x1, y1] = [(level.width + 0.5) * TILE, (level.height + 0.5) * TILE];
  const m = MARGIN * TILE;
  face.rect(x0 - m, y0 - m, x1 + m, y0);
  if (!level.sky) face.rect(x0 - m, y1, x1 + m, y1 + m);
  face.rect(x0 - m, y0, x0, y1);
  face.rect(x1, y0, x1 + m, y1);
  group.add(face.mesh(materials.face), walls.mesh(materials.wall), rim.mesh(materials.rim));

  const back = new Builder();
  const ground = level.sky ? (level.height - level.sky) * TILE : y1 + m;
  back.rect(x0 - m, y0 - m, x1 + m, ground, -DEPTH);
  group.add(back.mesh(new THREE.MeshLambertMaterial({ color: colors.back, map: texture })));

  // The cells round crumbling rock, as the rock is now.
  let built = -1;
  let parts = [];
  const whole = (c, j) => c >= 0 && j >= 0 && c < level.width && j < level.height && level.crumbly[j * level.width + c] && outline.solid[j * level.width + c];
  const buildLive = () => {
    for (const p of parts) {
      group.remove(p);
      p.geometry.dispose();
    }
    const [rockFace, crumbleFace, rockWalls, crumbleWalls, liveRim] = [new Builder(), new Builder(CRACK_SIZE), new Builder(), new Builder(CRACK_SIZE), new Builder()];
    for (const [cc, jj] of liveCells) {
      const poly = cellPolygon(outline, cc, jj);
      if (!poly.length) continue;
      // Each quarter of the cell belongs to the tile at that corner.
      const [mx, my] = [cc * TILE, jj * TILE]; // the cell's middle, where its four tiles meet
      for (const [dc, dj] of [
        [-1, -1],
        [0, -1],
        [0, 0],
        [-1, 0],
      ]) {
        const quarter = clip(poly, mx + dc * TILE, my + dj * TILE, mx + (dc + 1) * TILE, my + (dj + 1) * TILE);
        (whole(cc + dc, jj + dj) ? crumbleFace : rockFace).polygon(quarter);
      }
      for (const s of outline.cells[jj * cols + cc]) {
        const [px, py] = [(s.ax + s.bx) / 2 - s.nx * 0.3, (s.ay + s.by) / 2 - s.ny * 0.3]; // just inside the rock
        edge(whole(Math.floor(px / TILE), Math.floor(py / TILE)) ? crumbleWalls : rockWalls, liveRim, s);
      }
    }
    parts = [
      rockFace.mesh(materials.face),
      crumbleFace.mesh(materials.crumbleFace),
      rockWalls.mesh(materials.wall),
      crumbleWalls.mesh(materials.crumbleWall),
      liveRim.mesh(materials.rim),
    ];
    group.add(...parts);
    built = outline.version;
  };
  if (level.crumbles.length) buildLive();

  return {
    group,
    // Rebuilds the cells round crumbling rock if any has fallen or come back.
    update() {
      if (level.crumbles.length && built !== outline.version) buildLive();
    },
  };
}

// A cell's rock polygon, in metres.
const cellPolygon = (outline, cc, jj) => SOLID[outline.cases[jj * outline.cols + cc]].map((p) => [(cc - 0.5 + POINTS[p][0]) * TILE, (jj - 0.5 + POINTS[p][1]) * TILE]);

// A segment's surface going back into the cave, and its rim on the face.
function edge(walls, rim, s) {
  walls.wall(s);
  const [ix, iy] = [-s.nx * RIM, -s.ny * RIM]; // into the rock
  rim.flat([s.ax, s.ay], [s.ax + ix, s.ay + iy], [s.bx + ix, s.by + iy], 0.02);
  rim.flat([s.ax, s.ay], [s.bx + ix, s.by + iy], [s.bx, s.by], 0.02);
}

// The part of convex polygon `poly` inside the box from (x0, y0) to (x1, y1).
function clip(poly, x0, y0, x1, y1) {
  const planes = [
    (p) => p[0] - x0,
    (p) => x1 - p[0],
    (p) => p[1] - y0,
    (p) => y1 - p[1],
  ];
  for (const inside of planes) {
    const out = [];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      const [da, db] = [inside(a), inside(b)];
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    });
    poly = out;
    if (!poly.length) break;
  }
  return poly;
}

// Collects triangles with normals, texture coordinates (`size` metres to a
// repeat) and a shade.
class Builder {
  pos = [];
  normal = [];
  uv = [];
  shade = [];

  constructor(size = TEXTURE_SIZE) {
    this.size = size;
  }

  vertex(x, y, z, nx, ny, nz, u, v, shade = 1) {
    this.pos.push(x, y, z);
    this.normal.push(nx, ny, nz);
    this.uv.push(u / this.size, v / this.size);
    this.shade.push(shade, shade, shade);
  }

  // A triangle facing the camera, at depth z; corners anticlockwise.
  flat(a, b, c, z = 0) {
    for (const [x, y] of [a, b, c]) this.vertex(x, y, z, 0, 0, 1, x, y);
  }

  // A convex polygon facing the camera, as a fan of triangles.
  polygon(poly, z = 0) {
    for (let k = 1; k < poly.length - 1; k++) this.flat(poly[0], poly[k], poly[k + 1], z);
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

// Cracked rock, for crumbling rock: a pale, blotchy texture with dark cracks, and
// the same cracks alone in white on black, for them to glow.
function crackTextures() {
  const size = 128;
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    return [canvas, canvas.getContext("2d")];
  };
  const [rock, ctx] = make();
  const [glow, gtx] = make();
  ctx.fillStyle = "#d8d8d8";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 3 + Math.random() * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  gtx.fillStyle = "#000";
  gtx.fillRect(0, 0, size, size);
  // Jagged cracks, drawn again a size over wherever they run off an edge.
  const cracks = Array.from({ length: 9 }, () => {
    let [x, y, a] = [Math.random() * size, Math.random() * size, Math.random() * Math.PI * 2];
    const points = [[x, y]];
    for (let k = 0; k < 7; k++) {
      a += (Math.random() - 0.5) * 1.6;
      [x, y] = [x + Math.cos(a) * 9, y + Math.sin(a) * 9];
      points.push([x, y]);
    }
    return points;
  });
  for (const [c, width, color] of [
    [ctx, 3, "#3a3330"],
    [gtx, 1.4, "#fff"],
  ]) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineJoin = "round";
    for (const points of cracks) {
      for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
          c.beginPath();
          points.forEach(([x, y], k) => (k ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy)));
          c.stroke();
        }
      }
    }
  }
  return [rock, glow].map((canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
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
