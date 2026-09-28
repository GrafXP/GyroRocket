import * as THREE from "three";
import { TICK_RATE } from "../sim/rocket.js";
import { TILE } from "../sim/level.js";
import { cyclePhase, moverBox, crusherWarning } from "../sim/machines.js";
import { DEPTH } from "./cave.js";

const COLORS = {
  housing: 0x2e333d,
  rotor: 0x9aa3b2,
  streak: 0xdff4ff,
  pull: 0x9a7bff,
  push: 0xff9a3c,
  north: 0xd63a3f,
  south: 0x3f7ad6,
  plate: 0x6f7784,
  stripe: 0xf2c94c,
  crusher: 0xb8322f,
  rod: 0xaab2c0,
  lamp: 0xff3b2f,
};
const STREAKS = 24; // per fan
const RINGS = 3; // per magnet
const RING_SPEED = 0.6; // of its range a second

// Fans, magnets, movers and crushers (sim/machines.js). A fan's rotor turns and
// streaks of dust show its column while it blows; a magnet's rings close in on
// it while it pulls, or spread out while it pushes; movers are steel plates, and
// crushers red heads on a piston rod, shaking before they slam.
export function createMachines(level) {
  const group = new THREE.Group();
  const fans = level.fans.map((f) => createFan(f, group));
  const magnets = level.magnets.map((m) => createMagnet(m, group));
  const movers = level.movers.map((m) => createMover(m, group));

  return {
    group,
    update(world, dt) {
      const { tick } = world;
      const seconds = tick / TICK_RATE;
      level.fans.forEach((f, i) => {
        const phase = cyclePhase(f, tick);
        const view = fans[i];
        view.spin += dt * (phase === "on" ? 18 : phase === "warn" ? 6 : 0);
        view.rotor.rotation.z = view.spin;
        view.streaks.visible = phase === "on";
        if (phase === "on") view.flow(dt);
      });
      level.magnets.forEach((m, i) => {
        const phase = cyclePhase(m, tick);
        magnets[i].rings.forEach((ring, k) => {
          ring.visible = phase !== "off";
          const t = (seconds * RING_SPEED + k / RINGS) % 1;
          const s = m.push ? t : 1 - t; // push: outwards; pull: inwards
          ring.scale.setScalar(Math.max(0.05, s));
          ring.material.opacity = (phase === "warn" ? 0.15 : 0.45) * (1 - s * 0.7);
        });
      });
      level.movers.forEach((m, i) => {
        const box = moverBox(m, tick);
        const view = movers[i];
        const shake = m.kind === "crusher" && crusherWarning(m, tick) ? 0.06 : 0;
        view.slab.position.set((box.x0 + box.x1) / 2 + (Math.random() - 0.5) * shake, (box.y0 + box.y1) / 2 + (Math.random() - 0.5) * shake, -DEPTH / 2);
        if (view.rod) {
          // The rod runs from the head back to where it rests, and on into the rock.
          const len = Math.hypot(box.x0 - m.x0, box.y0 - m.y0) + view.rodBase;
          view.rod.scale.y = len;
          view.rod.position.set((box.x0 + box.x1) / 2 + (view.back[0] * len) / 2, (box.y0 + box.y1) / 2 + (view.back[1] * len) / 2, -DEPTH / 2);
          view.lamp.visible = crusherWarning(m, tick) && Math.sin(seconds * 30) > 0;
        }
      });
    },
  };
}

// A fan: a housing flush with the rock, a rotor turning on its face, and streaks
// of dust flying along its column.
function createFan(f, group) {
  const [cx, cy] = [(f.c + 0.5) * TILE, (f.j + 0.5) * TILE];
  const housing = new THREE.Mesh(new THREE.BoxGeometry(TILE, TILE, 0.6), new THREE.MeshLambertMaterial({ color: COLORS.housing }));
  housing.position.set(cx, cy, 0.25);
  const rotor = new THREE.Group();
  const blade = new THREE.BoxGeometry(0.28, 0.85, 0.05);
  blade.translate(0, 0.42, 0);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(blade, new THREE.MeshLambertMaterial({ color: COLORS.rotor }));
    b.rotation.z = (i * Math.PI) / 2;
    rotor.add(b);
  }
  rotor.position.set(cx, cy, 0.6);
  group.add(housing, rotor);

  // Streaks: thin quads along the flow, wrapping round the column.
  const [len, across] = f.dir[0] ? [f.x1 - f.x0, f.y1 - f.y0] : [f.y1 - f.y0, f.x1 - f.x0];
  const geo = new THREE.PlaneGeometry(f.dir[0] ? 1.4 : 0.08, f.dir[0] ? 0.08 : 1.4);
  const streaks = new THREE.InstancedMesh(
    geo,
    new THREE.MeshBasicMaterial({ color: COLORS.streak, transparent: true, opacity: 0.55, depthWrite: false }),
    STREAKS,
  );
  const spots = Array.from({ length: STREAKS }, () => ({ along: Math.random() * len, side: Math.random() * across, z: -Math.random() * 6 }));
  const m = new THREE.Matrix4();
  const place = () => {
    spots.forEach((p, i) => {
      const along = f.dir[0] + f.dir[1] > 0 ? p.along : len - p.along;
      const [x, y] = f.dir[0] ? [f.x0 + along, f.y0 + p.side] : [f.x0 + p.side, f.y0 + along];
      streaks.setMatrixAt(i, m.makeTranslation(x, y, p.z));
    });
    streaks.instanceMatrix.needsUpdate = true;
  };
  place();
  streaks.visible = false;
  group.add(streaks);
  return {
    rotor,
    streaks,
    spin: 0,
    flow(dt) {
      for (const p of spots) p.along = (p.along + dt * f.strength * 1.2) % len;
      place();
    },
  };
}

// A magnet: a block striped red and blue, and rings showing which way it pulls.
function createMagnet(m, group) {
  const body = new THREE.Group();
  const half = new THREE.BoxGeometry(TILE, TILE / 2, 0.6);
  const north = new THREE.Mesh(half, new THREE.MeshLambertMaterial({ color: COLORS.north }));
  const south = new THREE.Mesh(half, new THREE.MeshLambertMaterial({ color: COLORS.south }));
  north.position.y = TILE / 4;
  south.position.y = -TILE / 4;
  body.add(north, south);
  body.position.set(m.x, m.y, 0.25);
  group.add(body);
  const rings = Array.from({ length: RINGS }, () => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(m.range - 0.25, m.range, 64),
      new THREE.MeshBasicMaterial({ color: m.push ? COLORS.push : COLORS.pull, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.position.set(m.x, m.y, 0.3);
    group.add(ring);
    return ring;
  });
  return { rings };
}

// A mover or a crusher: a slab filling its rectangle, going back into the cave;
// a crusher also has a rod back to the rock behind it, and a warning lamp.
function createMover(m, group) {
  const [w, h] = [m.x1 - m.x0, m.y1 - m.y0];
  const crusher = m.kind === "crusher";
  const face = plateTexture(crusher);
  face.repeat.set(w / 2, h / 2);
  const side = new THREE.MeshLambertMaterial({ color: crusher ? COLORS.crusher : COLORS.plate });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH), [side, side, side, side, new THREE.MeshLambertMaterial({ map: face }), side]);
  group.add(slab);
  if (!crusher) return { slab };

  // The rod lies along the crusher's travel, behind the head.
  const len = Math.hypot(...m.to);
  const back = [-m.to[0] / len, -m.to[1] / len];
  const rodGeo = new THREE.CylinderGeometry(0.35, 0.35, 1, 12);
  const rod = new THREE.Mesh(rodGeo, new THREE.MeshLambertMaterial({ color: COLORS.rod }));
  rod.rotation.z = back[0] ? Math.PI / 2 : 0;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: COLORS.lamp }));
  lamp.position.set(0, 0, DEPTH / 2 + 0.3);
  slab.add(lamp);
  group.add(rod);
  // How far behind the head the rod reaches when it's at rest: into the rock.
  const rodBase = (back[0] ? w : h) / 2 + TILE;
  return { slab, rod, lamp, back, rodBase };
}

// Riveted steel with a band of stripes round the edge: yellow and black for a
// mover, white and red for a crusher.
function plateTexture(crusher) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = crusher ? "#b8322f" : "#6f7784";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = crusher ? "#f4f4f4" : "#f2c94c";
  for (let x = -64; x < 64; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 8, 0);
    ctx.lineTo(x + 72, 64);
    ctx.lineTo(x + 64, 64);
    ctx.fill();
  }
  ctx.fillStyle = crusher ? "#b8322f" : "#6f7784";
  ctx.fillRect(6, 6, 52, 52);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (const [x, y] of [
    [12, 12],
    [52, 12],
    [12, 52],
    [52, 52],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
