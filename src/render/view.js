import * as THREE from "three";
import { TILE } from "../sim/level.js";
import { TICK_RATE } from "../sim/rocket.js";
import { createCave } from "./cave.js";
import { createRocketModel } from "./rocket.js";
import { createThings } from "./things.js";
import { createDoors } from "./doors.js";
import { createHazards } from "./hazards.js";
import { createMachines } from "./machines.js";
import { createDefences } from "./defences.js";
import { createCore } from "./core.js";
import { createSky, SKY_COLORS } from "./sky.js";

const FOV = 50; // degrees, vertical
const VIEW = 36; // m across the screen's short side, at least
const ZOOM_OUT = 0.25; // how much further the camera backs off at speed
const LOOK_AHEAD = 0.4; // seconds of flight the camera looks ahead
const MAX_AHEAD = 8; // m
const FOLLOW = 6; // how quickly the camera catches up, per second
const LAVA_VIEW = 0.9; // how far down the view (of half its height) rising lava is kept, while it's near
const ROCKET_VIEW = 0.5; // how far up the view the rocket can go, to show the lava
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);

// Draws a level in play (sim/world.js) from the side, the camera following the
// rocket and staying inside the level. Reads the world each frame, never writes it.
export function createView(container, level, outline) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08090d);
  // A dark level has next to no light of its own: the rocket's headlight, and
  // what glows.
  const dark = !!level.dark;
  scene.add(new THREE.HemisphereLight(0xc8d8ff, 0x3a2e24, dark ? 0.06 : 1.3));
  const sun = new THREE.DirectionalLight(0xfff4e6, dark ? 0 : 1.4);
  sun.position.set(-0.3, 0.5, 1);
  scene.add(sun);

  const cave = createCave(outline, level.colors);
  scene.add(cave.group);
  if (level.sky) {
    scene.background.setHex(SKY_COLORS.zenith);
    scene.add(createSky(level).group);
  }
  const things = createThings(level, dark);
  scene.add(things.group);
  const doors = createDoors(level, dark);
  scene.add(doors.group);
  const hazards = createHazards(level);
  scene.add(hazards.group);
  const machines = createMachines(level);
  scene.add(machines.group);
  const defences = createDefences(level);
  scene.add(defences.group);
  const core = createCore(level, level.colors);
  scene.add(core.group);
  const rocket = createRocketModel(dark);
  scene.add(rocket.group);

  const boom = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true }));
  boom.visible = false;
  scene.add(boom);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 500);
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

  const width = level.width * TILE;
  const height = level.sky ? Infinity : level.height * TILE; // no roof over the sky
  // Keeps a view centre `half` from the edges of a level `size` long, or centres
  // the view on a level too small to fill it.
  const inside = (v, half, size) => (size < 2 * half ? size / 2 : Math.max(half, Math.min(size - half, v)));
  const cam = { x: 0, y: 0, zoom: 1, placed: false };

  return {
    canvas: renderer.domElement,
    // Draws `world`; `dt` is the seconds since the last frame, for smoothing.
    render(world, dt = 1 / 60) {
      const r = world.rocket;
      rocket.update(r);
      things.update(world);
      doors.update(world);
      hazards.update(world);
      machines.update(world, dt);
      defences.update(world);
      core.update(world);
      cave.update();

      const since = (r.tick - r.crashTick) / TICK_RATE;
      boom.visible = r.state === "crashed" && since < 1;
      if (boom.visible) {
        boom.position.set(r.x, r.y, 0);
        boom.scale.setScalar(1 + since * 8);
        boom.material.opacity = 1 - since;
      }

      // Back off a little at speed, look ahead to where the rocket's going, and
      // keep the view inside the level.
      const k = cam.placed ? 1 - Math.exp(-FOLLOW * dt) : 1;
      const speed = Math.hypot(r.vx, r.vy);
      cam.zoom += (1 + (Math.min(speed, 30) / 30) * ZOOM_OUT - cam.zoom) * k;
      const halfH = ((VIEW / 2) * cam.zoom) / Math.min(1, camera.aspect);
      const halfW = halfH * camera.aspect;
      const ahead = (v) => Math.max(-MAX_AHEAD, Math.min(MAX_AHEAD, v * LOOK_AHEAD));
      let y = inside(r.y + ahead(r.vy), halfH, height);
      // Rising lava on its way: low enough to see it coming, if it's near, but
      // keeping the rocket in view.
      if (world.rise?.from >= 0) y = inside(Math.max(Math.min(y, world.rise.y + halfH * LAVA_VIEW), r.y - halfH * ROCKET_VIEW), halfH, height);
      cam.x += (inside(r.x + ahead(r.vx), halfW, width) - cam.x) * k;
      cam.y += (y - cam.y) * k;
      cam.placed = true;
      camera.position.set(cam.x, cam.y, halfH / TAN);
      camera.lookAt(cam.x, cam.y, 0);

      renderer.render(scene, camera);
    },
    // Where a point on the screen (client pixels) is on the plane of flight.
    screenToWorld(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      const p = new THREE.Vector3(((clientX - rect.left) / rect.width) * 2 - 1, 1 - ((clientY - rect.top) / rect.height) * 2, 0.5);
      const dir = p.unproject(camera).sub(camera.position).normalize();
      const t = -camera.position.z / dir.z;
      return { x: camera.position.x + dir.x * t, y: camera.position.y + dir.y * t };
    },
    dispose() {
      ro.disconnect();
      scene.traverse((obj) => {
        obj.geometry?.dispose();
        for (const m of [obj.material].flat()) {
          m?.map?.dispose();
          m?.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
