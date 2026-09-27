import * as THREE from "three";

const COLORS = {
  pad: 0x6b7280,
  stripe: 0xf2c94c,
  exit: 0x3fbf6a,
  beacon: 0x5be38a,
};

// The pads on the level's floors: the start pad in hazard stripes, and the exit
// pad in green under a beam of light you can see from a distance.
export function createThings(level) {
  const group = new THREE.Group();
  const stripes = stripeTexture();
  let beam = null;

  for (const pad of level.pads) {
    const width = pad.x1 - pad.x0;
    const exit = pad.kind === "exit";
    const map = exit ? null : stripes.clone();
    if (map) map.repeat.set(width / 2, 1);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.35, 5),
      [
        new THREE.MeshLambertMaterial({ color: COLORS.pad }), // sides
        new THREE.MeshLambertMaterial({ color: COLORS.pad }),
        new THREE.MeshLambertMaterial({ color: exit ? COLORS.exit : COLORS.pad }), // top
        new THREE.MeshLambertMaterial({ color: COLORS.pad }),
        new THREE.MeshLambertMaterial({ color: exit ? COLORS.exit : 0xffffff, map }), // front
        new THREE.MeshLambertMaterial({ color: COLORS.pad }),
      ],
    );
    // The top sits just above the floor, and the front sticks out past the rock's face.
    slab.position.set((pad.x0 + pad.x1) / 2, pad.y - 0.12, -2);
    group.add(slab);

    if (exit) {
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
      beam.position.set((pad.x0 + pad.x1) / 2, pad.y + 8, -1);
      const light = new THREE.PointLight(COLORS.beacon, 30, 30, 1.5);
      light.position.set((pad.x0 + pad.x1) / 2, pad.y + 3, 3);
      group.add(beam, light);
    }
  }

  return {
    group,
    // `seconds` since the level started, for anything that pulses.
    update(seconds) {
      if (beam) beam.material.opacity = 0.12 + 0.06 * Math.sin(seconds * 3);
    },
  };
}

// Yellow and dark diagonal stripes, one pair per repeat.
function stripeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#23262e";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#" + COLORS.stripe.toString(16).padStart(6, "0");
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
  return texture;
}
