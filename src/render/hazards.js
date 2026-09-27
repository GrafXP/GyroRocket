import * as THREE from "three";
import { TICK_RATE } from "../sim/rocket.js";
import { TILE } from "../sim/level.js";
import { flamePhase, RADIUS } from "../sim/hazards/flame.js";
import { blobAt, BLOB_RADIUS } from "../sim/hazards/blob.js";
import { DEPTH } from "./cave.js";

const COLORS = {
  nozzle: 0x3a3f4a,
  pilot: 0x5aa0ff,
  flame: 0xff6a14,
  core: 0xffe08a,
  warn: 0xff9a3c,
  lava: 0xff5a10,
};
const ROTATION = { up: 0, left: Math.PI / 2, down: Math.PI, right: -Math.PI / 2 };
const GLOW = 3; // m of heat glow above lava

// Flamethrowers, lava and lava blobs (sim/hazards). A flame is drawn to exactly
// the shape that burns (a cone from RADIUS[0] to RADIUS[1] with a rounded tip);
// its nozzle glows and sputters while it warns. No lights: they'd make three.js
// recompile its shaders whenever one came or went.
export function createHazards(level) {
  const group = new THREE.Group();
  const flames = level.flames.map((f) => createFlame(f, group));
  const blobs = level.blobs.map(() => createBlob(group));
  const lava = createLava(level, group);

  return {
    group,
    update(world) {
      const seconds = world.tick / TICK_RATE;
      level.flames.forEach((f, i) => {
        const phase = flamePhase(f, world.flames[i], world.tick);
        const view = flames[i];
        view.jet.visible = phase === "on";
        view.sputter.visible = phase === "warn" && Math.random() < 0.6;
        if (view.jet.visible) view.jet.scale.set(0.92 + Math.random() * 0.12, 1, 0.92 + Math.random() * 0.12);
        if (view.sputter.visible) view.sputter.scale.setScalar(0.5 + Math.random() * 0.8);
        view.mouth.material.color.setHex(phase === "off" ? COLORS.nozzle : COLORS.warn);
      });
      level.blobs.forEach((b, i) => {
        const { y, up, warn } = blobAt(b, world.tick);
        const view = blobs[i];
        view.ball.visible = up;
        view.ball.position.set(b.x, y, 0);
        view.bubble.visible = warn;
        view.bubble.position.set(b.x, b.y, 0.05);
        view.bubble.scale.setScalar(0.6 + 0.4 * Math.abs(Math.sin(seconds * 14)));
      });
      if (lava) {
        lava.texture.offset.set(seconds * 0.03, seconds * 0.05);
        lava.glow.material.opacity = 0.45 + 0.15 * Math.sin(seconds * 2.3);
      }
    },
  };
}

// A nozzle in its tile, and its flame along +y, turned to face the right way.
function createFlame(f, group) {
  const length = Math.hypot(f.x1 - f.x0, f.y1 - f.y0);
  const holder = new THREE.Group();
  holder.position.set(f.x0, f.y0, 0);
  holder.rotation.z = ROTATION[f.facing];
  group.add(holder);

  // The nozzle, sticking out of the rock a little, with a pilot light.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 0.9, 16), new THREE.MeshLambertMaterial({ color: COLORS.nozzle }));
  body.position.y = -0.3;
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: COLORS.nozzle }));
  mouth.rotation.x = -Math.PI / 2;
  mouth.position.y = 0.16;
  const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: COLORS.pilot }));
  pilot.position.set(0.55, 0.2, 0);
  holder.add(body, mouth, pilot);

  const glowing = (color, opacity) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  // The jet: the burning cone, and a hotter core.
  const jet = new THREE.Group();
  const cone = new THREE.CylinderGeometry(RADIUS[1], RADIUS[0], length, 16, 1, true);
  cone.translate(0, length / 2, 0);
  const tip = new THREE.SphereGeometry(RADIUS[1], 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  tip.translate(0, length, 0);
  const coreCone = new THREE.CylinderGeometry(RADIUS[1] * 0.45, RADIUS[0] * 0.5, length * 0.85, 12, 1, true);
  coreCone.translate(0, (length * 0.85) / 2, 0);
  jet.add(new THREE.Mesh(cone, glowing(COLORS.flame, 0.8)), new THREE.Mesh(tip, glowing(COLORS.flame, 0.8)), new THREE.Mesh(coreCone, glowing(COLORS.core, 0.9)));
  jet.visible = false;
  // While warning, short spits of flame at the mouth.
  const spitGeo = new THREE.ConeGeometry(0.35, 1.2, 10);
  spitGeo.translate(0, 0.6, 0);
  const sputter = new THREE.Mesh(spitGeo, glowing(COLORS.warn, 0.9));
  sputter.visible = false;
  holder.add(jet, sputter);
  return { jet, sputter, mouth };
}

function createBlob(group) {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BLOB_RADIUS, 16, 12), new THREE.MeshBasicMaterial({ color: COLORS.lava }));
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COLORS.core }),
  );
  ball.visible = bubble.visible = false;
  group.add(ball, bubble);
  return { ball, bubble };
}

// Every lava tile's face, the surface on top of any with air above (going back
// into the cave like the rock does), and a heat glow over the surface.
function createLava(level, group) {
  const face = [];
  const top = [];
  const glow = [];
  const quad = (list, a, b, c, d) => list.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let j = 0; j < level.height; j++) {
    for (let c = 0; c < level.width; c++) {
      if (!level.lava[j * level.width + c]) continue;
      const [x0, x1, y0, y1] = [c * TILE, (c + 1) * TILE, j * TILE, (j + 1) * TILE];
      quad(face, [x0, y0, 0.03], [x1, y0, 0.03], [x1, y1, 0.03], [x0, y1, 0.03]);
      const above = j + 1 < level.height && !level.solid[(j + 1) * level.width + c];
      if (!above) continue;
      quad(top, [x0, y1 + 0.02, 0.03], [x1, y1 + 0.02, 0.03], [x1, y1 + 0.02, -DEPTH], [x0, y1 + 0.02, -DEPTH]);
      quad(glow, [x0, y1, 0.05], [x1, y1, 0.05], [x1, y1 + GLOW, 0.05], [x0, y1 + GLOW, 0.05]);
    }
  }
  if (!face.length) return null;

  const texture = lavaTexture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const mesh = (positions, uvs, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    const m = new THREE.Mesh(g, mat);
    group.add(m);
    return m;
  };
  // Texture coordinates from position, 8 m to a repeat; the glow fades upwards.
  const planar = (positions, u, v) => {
    const out = [];
    for (let i = 0; i < positions.length; i += 3) out.push(positions[i + u] / 8, positions[i + v] / 8);
    return out;
  };
  mesh(face, planar(face, 0, 1), material);
  mesh(top, planar(top, 0, 2), material);
  const fade = [];
  for (let i = 0; i < glow.length; i += 18) fade.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  const glowMesh = mesh(
    glow,
    fade,
    new THREE.MeshBasicMaterial({
      map: glowTexture(),
      color: COLORS.lava,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  return { texture, glow: glowMesh };
}

// Molten rock: bright orange cells in dark red crust, seamless.
function lavaTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ff6a10";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const [x, y, r] = [Math.random() * size, Math.random() * size, 4 + Math.random() * 12];
    ctx.fillStyle = Math.random() < 0.5 ? "#b81e05" : "#ffc233";
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// White at the bottom, fading to nothing at the top.
function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(canvas);
}
