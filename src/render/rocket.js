import * as THREE from "three";
import { CENTRE_Y, FOOT_X } from "../sim/rocket.js";

const COLORS = {
  body: 0xe9ecf2,
  nose: 0xd63a3f,
  fin: 0xd63a3f,
  window: 0x6cd4ff,
  engine: 0x4a4f5c,
  foot: 0x30343f,
  flame: 0xffb347,
  flameCore: 0xfff1b8,
  hit: 0xff2a1a,
};

// The rocket, about 5 m tall, standing on three fins that end in feet, with its
// origin at the centre of mass the sim turns it about (sim/rocket.js, whose
// collision circles it matches). It carries a light, so the cave around it is lit,
// and another under the engine for when it burns.
export function createRocketModel() {
  const group = new THREE.Group();
  const model = new THREE.Group();
  model.position.y = -CENTRE_Y; // model coordinates have the feet on y = 0
  group.add(model);

  const lit = (color) => new THREE.MeshLambertMaterial({ color, emissive: COLORS.hit, emissiveIntensity: 0 });
  const materials = { body: lit(COLORS.body), red: lit(COLORS.nose), engine: lit(COLORS.engine), foot: lit(COLORS.foot) };

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3.1, 24), materials.body);
  body.position.y = 2.65;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.05, 24), materials.red);
  nose.position.y = 4.725;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.61, 0.61, 0.18, 24), materials.red);
  band.position.y = 3.9;
  const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), new THREE.MeshBasicMaterial({ color: COLORS.window }));
  porthole.position.set(0, 3.1, 0.61);
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.52, 0.65, 20), materials.engine);
  engine.position.y = 0.775;
  model.add(body, nose, band, porthole, engine);

  // Three fins, left and right in the plane of flight and one at the back, each
  // ending in a foot: the side ones are the feet the sim lands on.
  const finShape = new THREE.Shape(
    [
      [0.5, 2.5],
      [0.5, 1.0],
      [FOOT_X - 0.1, 0.3],
      [FOOT_X + 0.1, 0.3],
      [FOOT_X + 0.1, 0.55],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  );
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.1, bevelEnabled: false });
  finGeo.translate(0, 0, -0.05);
  const footGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.3, 16);
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Group();
    const foot = new THREE.Mesh(footGeo, materials.foot);
    foot.position.set(FOOT_X, 0.15, 0);
    leg.add(new THREE.Mesh(finGeo, materials.red), foot);
    leg.rotation.y = (i * Math.PI) / 2;
    model.add(leg);
  }

  const flame = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 2.2, 16),
    new THREE.MeshBasicMaterial({ color: COLORS.flame, transparent: true, opacity: 0.85 }),
  );
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 12), new THREE.MeshBasicMaterial({ color: COLORS.flameCore }));
  outer.rotation.x = core.rotation.x = Math.PI; // point down
  outer.position.y = -1.1;
  core.position.y = -0.6;
  flame.add(outer, core);
  flame.position.y = 0.45;
  flame.visible = false;
  model.add(flame);

  // Lights: one in front of the rocket for the cave, one under the engine.
  const lamp = new THREE.PointLight(0xfff0dd, 60, 60, 1.5);
  lamp.position.set(0, 0, 8);
  const glow = new THREE.PointLight(0xff9a3c, 0, 30, 1.5);
  glow.position.set(0, -2.5, 1.5);
  group.add(lamp, glow);

  return {
    group,
    // Shows rocket state `r` from sim/rocket.js.
    update(r) {
      group.position.set(r.x, r.y, 0);
      group.rotation.z = -r.angle;
      group.visible = r.state !== "crashed";
      flame.visible = r.burning;
      const flicker = 0.8 + Math.random() * 0.5;
      if (r.burning) flame.scale.set(1, flicker, 1);
      glow.intensity = r.burning ? 40 * flicker : 0;
      // Glow red for a moment after hitting rock, more for a harder hit.
      const since = r.tick - r.hitTick;
      const red = r.hitTick >= 0 && since < 20 ? (1 - since / 20) * Math.min(1, 0.3 + r.hitDamage / 30) : 0;
      for (const m of Object.values(materials)) m.emissiveIntensity = red;
    },
  };
}
