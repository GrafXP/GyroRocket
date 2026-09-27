import * as THREE from "three";
import { TICK_RATE } from "../sim/rocket.js";
import { padUnder } from "../sim/world.js";

const COLORS = {
  pad: 0x6b7280,
  stripe: 0xf2c94c,
  exit: 0x3fbf6a,
  beacon: 0x5be38a,
  fuel: 0x3fa9f5,
  switch: 0xf08a24,
  crystal: 0xd86bff,
  pump: 0x4a4f5c,
  screen: 0x11151c,
  lampOff: 0x3a3f4a,
};

// The pads on the level's floors: the start pad in yellow hazard stripes, fuel
// pads in blue with a pump, switches in orange (their posts are in doors.js), and
// the exit pad in green under a beam of light you can see from a distance. And the
// crystals, glowing, turning and bobbing.
export function createThings(level, dark = false) {
  // In the dark, pads glow a little, to be found by.
  const glowing = (color, map = null) =>
    new THREE.MeshLambertMaterial({ color, map, emissive: dark ? color : 0, emissiveMap: dark ? map : null, emissiveIntensity: dark ? 0.35 : 0 });
  const group = new THREE.Group();
  let beam = null;
  const pumps = [];
  const crystals = level.crystals.map((c) => createCrystal(c, group));

  for (const pad of level.pads) {
    const width = pad.x1 - pad.x0;
    const mid = (pad.x0 + pad.x1) / 2;
    const top = { start: COLORS.pad, fuel: COLORS.fuel, exit: COLORS.exit, switch: COLORS.switch }[pad.kind];
    const stripe = { start: COLORS.stripe, fuel: COLORS.fuel, switch: COLORS.switch }[pad.kind];
    const front = stripe ? stripeTexture(stripe, width / 2) : null;
    const side = new THREE.MeshLambertMaterial({ color: COLORS.pad });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.35, 5), [
      side,
      side,
      glowing(top),
      side,
      glowing(front ? 0xffffff : top, front),
      side,
    ]);
    // The top sits just above the floor, and the front sticks out past the rock's face.
    slab.position.set(mid, pad.y - 0.12, -2);
    group.add(slab);

    if (pad.kind === "exit") {
      beam = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.35, width * 0.45, 16, 24, 1, true),
        new THREE.MeshBasicMaterial({
          color: COLORS.beacon,
          transparent: true,
          opacity: 0.15,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.set(mid, pad.y + 8, -1);
      const light = new THREE.PointLight(COLORS.beacon, 30, 30, 1.5);
      light.position.set(mid, pad.y + 3, 3);
      group.add(beam, light);
    }
    if (pad.kind === "fuel") pumps.push(createPump(pad, group));
  }

  return {
    group,
    // Shows the pads' state in `world` (sim/world.js).
    update(world) {
      const seconds = world.tick / TICK_RATE;
      if (beam) beam.material.opacity = 0.12 + 0.06 * Math.sin(seconds * 3);
      // A collected crystal swells and fades, then it's gone.
      crystals.forEach((gem, i) => {
        const since = world.got[i] < 0 ? -1 : (world.tick - world.got[i]) / TICK_RATE;
        gem.visible = since < 0.35;
        if (!gem.visible) return;
        gem.rotation.y = seconds * 1.5 + i;
        gem.position.y = gem.userData.y + Math.sin(seconds * 2 + i) * 0.3;
        gem.scale.setScalar(since < 0 ? 1 : 1 + since * 4);
        for (const m of gem.children) m.material.opacity = since < 0 ? m.userData.opacity : m.userData.opacity * (1 - since / 0.35);
      });

      const r = world.rocket;
      const at = padUnder(world.level, r);
      for (const pump of pumps) {
        pump.gauge.scale.y = at === pump.pad ? Math.max(0.02, r.fuel / r.tank) : 1;
        const lit = world.checkpoint.pad === pump.pad;
        const pulse = at === pump.pad && world.refuelling ? 0.5 + 0.5 * Math.sin(seconds * 12) : 1;
        pump.lamp.material.color.setHex(lit ? COLORS.fuel : COLORS.lampOff).multiplyScalar(pulse);
      }
    },
  };
}

// A crystal: a gem in a soft glow.
function createCrystal({ x, y }, group) {
  const gem = new THREE.Group();
  gem.position.set(x, y, 0);
  gem.userData.y = y;
  const solid = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.75),
    new THREE.MeshLambertMaterial({ color: COLORS.crystal, emissive: COLORS.crystal, emissiveIntensity: 0.5, transparent: true }),
  );
  solid.scale.y = 1.4;
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 16, 12),
    new THREE.MeshBasicMaterial({ color: COLORS.crystal, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  solid.userData.opacity = 1;
  glow.userData.opacity = 0.18;
  gem.add(solid, glow);
  group.add(gem);
  return gem;
}

// A fuel pump behind the pad's right end: a screen whose gauge fills while the
// rocket refuels, and a lamp on top that's lit while the pad is the checkpoint.
function createPump(pad, group) {
  const pump = new THREE.Group();
  pump.position.set(pad.x1 - 0.8, pad.y, -3.6);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.4, 1.2), new THREE.MeshLambertMaterial({ color: COLORS.pump }));
  body.position.y = 1.7;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.2), new THREE.MeshBasicMaterial({ color: COLORS.screen }));
  screen.position.set(0, 1.8, 0.61);
  // The gauge grows up from its bottom edge.
  const gaugeGeo = new THREE.PlaneGeometry(0.6, 2);
  gaugeGeo.translate(0, 1, 0);
  const gauge = new THREE.Mesh(gaugeGeo, new THREE.MeshBasicMaterial({ color: COLORS.fuel }));
  gauge.position.set(0, 0.8, 0.62);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: COLORS.lampOff }));
  lamp.position.y = 3.6;
  pump.add(body, screen, gauge, lamp);
  group.add(pump);
  return { pad, gauge, lamp };
}

// Diagonal stripes in `color` on dark, one pair every 2 m across `repeats` repeats.
function stripeTexture(color, repeats) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#23262e";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
  for (const dx of [-64, 0, 64]) {
    ctx.beginPath();
    ctx.moveTo(dx, 64);
    ctx.lineTo(dx + 32, 0);
    ctx.lineTo(dx + 64, 0);
    ctx.lineTo(dx + 32, 64);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(repeats, 1);
  return texture;
}
