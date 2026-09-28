import * as THREE from "three";
import { TILE } from "../sim/level.js";

export const SKY_COLORS = { horizon: 0x2d3f78, zenith: 0x04050b, moon: 0xfff4d6 };
const FAR = 300; // m behind the plane of flight
const STARS = 1500;

// The night sky over a level that comes out on the surface (level.sky), like the
// prototype's over its field: a glow along the horizon fading up into space, with
// stars and the moon, far enough back to barely move as the camera does. The
// cave's back wall hides it below the ground.
export function createSky(level) {
  const group = new THREE.Group();
  const ground = (level.height - level.sky) * TILE;
  const x = (level.width * TILE) / 2;
  const [width, height] = [level.width * TILE + 2000, 900];

  // Plenty of rows up the plane, for the fade to follow its curve.
  const glow = new THREE.PlaneGeometry(width, height, 1, 40);
  glow.translate(x, ground - 40 + height / 2, -FAR - 20);
  const [horizon, zenith] = [new THREE.Color(SKY_COLORS.horizon), new THREE.Color(SKY_COLORS.zenith)];
  const colors = [];
  const pos = glow.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const up = Math.min(1, Math.max(0, (pos.getY(i) - ground) / 260));
    const c = horizon.clone().lerp(zenith, Math.sqrt(up));
    colors.push(c.r, c.g, c.b);
  }
  glow.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  group.add(new THREE.Mesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false })));

  const stars = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    const up = Math.random() ** 0.7; // fewer near the horizon's glow
    stars.set([x + (Math.random() - 0.5) * width, ground + 10 + up * (height - 60), -FAR], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(stars, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })));

  const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: SKY_COLORS.moon }));
  moon.position.set(level.width * TILE * 0.7, ground + 110, -FAR + 10);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: SKY_COLORS.moon, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  halo.position.set(moon.position.x, moon.position.y, -FAR + 9);
  group.add(moon, halo);
  return { group };
}
