import * as THREE from "three";
import { TICK_RATE } from "../sim/rocket.js";
import { TILE } from "../sim/level.js";
import { laserPhase, BEAM } from "../sim/hazards/laser.js";
import { SHOT_RADIUS } from "../sim/hazards/turret.js";

const COLORS = {
  emitter: 0x2b2f38,
  lensOff: 0x4a1a1a,
  beam: 0xff2a3c,
  turret: 0x3a3f4a,
  barrel: 0x8a93a3,
  charge: 0xff7a2a,
  shot: 0xffb347,
};
const MAX_SHOTS = 48;

// Laser gates and turrets (sim/hazards/laser.js, turret.js): an emitter with a
// lens that glows while its beam's on, the beam flickering before it comes on; a
// turret whose barrel follows the rocket, glowing brighter as it winds up; and its
// glowing shots.
export function createDefences(level) {
  const group = new THREE.Group();
  const glowing = (color, opacity) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const lasers = level.lasers.map((l) => createLaser(l, group, glowing));
  const turrets = level.turrets.map((t) => createTurret(t, group, glowing));

  const shots = new THREE.InstancedMesh(new THREE.SphereGeometry(SHOT_RADIUS, 12, 8), new THREE.MeshBasicMaterial({ color: COLORS.shot }), MAX_SHOTS);
  const halos = new THREE.InstancedMesh(new THREE.SphereGeometry(SHOT_RADIUS * 2.4, 12, 8), glowing(COLORS.shot, 0.3), MAX_SHOTS);
  group.add(shots, halos);
  const m = new THREE.Matrix4();

  return {
    group,
    update(world) {
      const { tick } = world;
      level.lasers.forEach((l, i) => {
        const phase = laserPhase(l, world.lasers[i], tick);
        const view = lasers[i];
        view.beam.visible = phase === "on" || (phase === "warn" && Math.random() < 0.4);
        view.beam.scale.set(phase === "warn" ? 0.4 : 1, 1, phase === "warn" ? 0.4 : 1);
        view.lens.material.color.setHex(phase === "off" ? COLORS.lensOff : COLORS.beam);
      });
      const r = world.rocket;
      level.turrets.forEach((t, i) => {
        const view = turrets[i];
        view.barrel.rotation.z = Math.atan2(r.y - t.y, r.x - t.x) - Math.PI / 2;
        const { charge } = world.turrets[i];
        const wound = charge < 0 ? 0 : Math.min(1, (tick - charge) / (t.windup * TICK_RATE));
        view.glow.visible = wound > 0;
        view.glow.scale.setScalar(0.3 + wound * 1.2);
      });
      const n = Math.min(MAX_SHOTS, world.shots.length);
      for (let i = 0; i < n; i++) {
        m.makeTranslation(world.shots[i].x, world.shots[i].y, 0);
        shots.setMatrixAt(i, m);
        halos.setMatrixAt(i, m);
      }
      shots.count = halos.count = n;
      shots.instanceMatrix.needsUpdate = halos.instanceMatrix.needsUpdate = true;
    },
  };
}

// An emitter in its tile, and its beam: a hot core in a soft glow.
function createLaser(l, group, glowing) {
  const length = Math.hypot(l.x1 - l.x0, l.y1 - l.y0);
  const holder = new THREE.Group();
  holder.position.set(l.x0, l.y0, 0);
  holder.rotation.z = { up: 0, left: Math.PI / 2, down: Math.PI, right: -Math.PI / 2 }[l.facing];
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.8), new THREE.MeshLambertMaterial({ color: COLORS.emitter }));
  body.position.y = -0.1;
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: COLORS.lensOff }));
  lens.position.y = 0.2;
  const beam = new THREE.Group();
  const core = new THREE.CylinderGeometry(BEAM, BEAM, length, 8, 1, true);
  core.translate(0, length / 2, 0);
  const halo = new THREE.CylinderGeometry(BEAM * 3, BEAM * 3, length, 8, 1, true);
  halo.translate(0, length / 2, 0);
  beam.add(new THREE.Mesh(core, new THREE.MeshBasicMaterial({ color: 0xffd0d4 })), new THREE.Mesh(halo, glowing(COLORS.beam, 0.45)));
  holder.add(body, lens, beam);
  group.add(holder);
  return { beam, lens };
}

// A turret: a dome in the rock's face, a barrel that turns, and the glow of it
// winding up at its muzzle.
function createTurret(t, group, glowing) {
  const holder = new THREE.Group();
  holder.position.set(t.x, t.y, 0.2);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(TILE * 0.55, 16, 12), new THREE.MeshLambertMaterial({ color: COLORS.turret }));
  dome.scale.z = 0.6;
  const barrel = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.4, 12), new THREE.MeshLambertMaterial({ color: COLORS.barrel }));
  tube.position.y = 0.9;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), glowing(COLORS.charge, 0.8));
  glow.position.y = 1.7;
  glow.visible = false;
  barrel.add(tube, glow);
  holder.add(dome, barrel);
  group.add(holder);
  return { barrel, glow };
}
