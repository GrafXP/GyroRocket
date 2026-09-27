import * as THREE from "three";
import { TICK_RATE } from "../sim/rocket.js";

// The sky fades from day at the ground to space by SPACE_Y metres up, and the stars
// come out on the way.
const SPACE_Y = 400;
const COLORS = {
  sky: 0x8ecbff,
  space: 0x04050b,
  ground: 0x3c6e3a,
  grid: 0x2b4f2a,
  pad: 0x6b7280,
  padStripe: 0xf2c94c,
  body: 0xe9ecf2,
  nose: 0xd63a3f,
  fin: 0xd63a3f,
  window: 0x6cd4ff,
  flame: 0xffb347,
  flameCore: 0xfff1b8,
  boom: 0xff7a1a,
  marker: 0x8b90a0,
};

const MARKER_EVERY = 25; // m between the posts along the ground, to see sideways speed
const MARKERS = 24;

// Draws the rocket (sim/rocket.js state) in a side view, the camera following it.
// Reads the sim each frame, never writes it.
export function createView(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const sky = new THREE.Color(COLORS.sky);
  const space = new THREE.Color(COLORS.space);
  scene.background = sky.clone();
  scene.fog = new THREE.Fog(COLORS.sky, 60, 260);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-20, 30, 25);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);

  // Ground: a wide field with a grid on it, moved along with the camera so it never
  // runs out, and posts every MARKER_EVERY metres.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 400), new THREE.MeshLambertMaterial({ color: COLORS.ground }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(1200, 240, COLORS.grid, COLORS.grid);
  grid.position.y = 0.01;
  scene.add(grid);

  const pad = new THREE.Group();
  const padBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 0.1, 32), new THREE.MeshLambertMaterial({ color: COLORS.pad }));
  padBase.position.y = 0.05;
  const padRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 8, 40), new THREE.MeshBasicMaterial({ color: COLORS.padStripe }));
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.y = 0.1;
  pad.add(padBase, padRing);
  scene.add(pad);

  const markerGeo = new THREE.BoxGeometry(0.4, 3, 0.4);
  const markerMat = new THREE.MeshLambertMaterial({ color: COLORS.marker });
  const markers = new THREE.InstancedMesh(markerGeo, markerMat, MARKERS);
  scene.add(markers);
  const placeMarkers = (x) => {
    const first = Math.floor(x / MARKER_EVERY) * MARKER_EVERY - (MARKERS / 2) * MARKER_EVERY;
    const m = new THREE.Matrix4();
    for (let i = 0; i < MARKERS; i++) {
      m.makeTranslation(first + i * MARKER_EVERY, 1.5, -6);
      markers.setMatrixAt(i, m);
    }
    markers.instanceMatrix.needsUpdate = true;
  };

  // Stars on a far shell around the camera; they fade in with height.
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(1500 * 3);
  for (let i = 0; i < starPos.length; i += 3) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(900);
    v.z = -Math.abs(v.z);
    starPos.set([v.x, v.y, v.z], i);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, fog: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const rocket = createRocketMesh();
  scene.add(rocket.group);

  const boom = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: COLORS.boom, transparent: true }));
  boom.visible = false;
  scene.add(boom);

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const camAt = new THREE.Vector3(0, 6, 30);
  const lookAt = new THREE.Vector3(0, 4, 0);
  const target = new THREE.Vector3();

  return {
    canvas: renderer.domElement,
    render(r) {
      rocket.group.position.set(r.x, r.y, 0);
      rocket.group.rotation.z = -r.angle;
      rocket.group.visible = r.state !== "crashed";
      rocket.flame.visible = r.burning;
      if (r.burning) rocket.flame.scale.set(1, 0.8 + Math.random() * 0.5, 1);

      const since = (r.tick - r.crashTick) / TICK_RATE;
      boom.visible = r.state === "crashed" && since < 1;
      if (boom.visible) {
        boom.position.set(r.x, 1, 0);
        boom.scale.setScalar(1 + since * 8);
        boom.material.opacity = 1 - since;
      }

      // The camera backs off as the rocket speeds up, and eases after it.
      const speed = Math.hypot(r.vx, r.vy);
      const dist = 30 + Math.min(speed, 60) * 0.5;
      camAt.lerp(target.set(r.x, r.y + 6, dist), 0.1);
      lookAt.lerp(target.set(r.x, r.y + 3, 0), 0.2);
      camera.position.copy(camAt);
      camera.lookAt(lookAt);

      const up = Math.min(1, Math.max(0, r.y / SPACE_Y));
      scene.background.lerpColors(sky, space, up);
      scene.fog.color.copy(scene.background);
      starMat.opacity = Math.max(0, up * 1.4 - 0.3);
      stars.visible = starMat.opacity > 0;
      stars.position.copy(camera.position);

      const snap = Math.round(r.x / 5) * 5;
      ground.position.x = grid.position.x = snap;
      placeMarkers(r.x);

      renderer.render(scene, camera);
    },
    dispose() {
      ro.disconnect();
      scene.traverse((obj) => {
        obj.geometry?.dispose();
        obj.material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

// A small rocket, about 5 m tall, standing on y = 0 at its origin, with its flame
// hanging under the engine.
function createRocketMesh() {
  const group = new THREE.Group();
  const lit = (color) => new THREE.MeshLambertMaterial({ color });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3.4, 24), lit(COLORS.body));
  body.position.y = 2.1;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.3, 24), lit(COLORS.nose));
  nose.position.y = 4.45;
  const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), new THREE.MeshBasicMaterial({ color: COLORS.window }));
  porthole.position.set(0, 2.9, 0.61);
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.4, 20), lit(0x4a4f5c));
  engine.position.y = 0.2;
  group.add(body, nose, porthole, engine);

  const finShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.8, -0.4), new THREE.Vector2(0.8, 0.2), new THREE.Vector2(0, 1.4)]);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: false });
  finGeo.translate(0.55, 0.4, -0.04);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(finGeo, lit(COLORS.fin));
    fin.rotation.y = (i * Math.PI * 2) / 3 + Math.PI / 2;
    group.add(fin);
  }

  const flame = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 16), new THREE.MeshBasicMaterial({ color: COLORS.flame, transparent: true, opacity: 0.85 }));
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 12), new THREE.MeshBasicMaterial({ color: COLORS.flameCore }));
  outer.rotation.x = core.rotation.x = Math.PI; // point down
  outer.position.y = -1.1;
  core.position.y = -0.6;
  flame.add(outer, core);
  flame.visible = false;
  group.add(flame);

  return { group, flame };
}
