import * as THREE from "three";
import { TICK_RATE, GRAVITY } from "../sim/rocket.js";
import { TILE, STALACTITE_WIDTH } from "../sim/level.js";
import { shaking } from "../sim/hazards/stalactite.js";
import { DEPTH, CAVE_COLORS } from "./cave.js";
import { lavaTexture, glowTexture } from "./hazards.js";

const COLORS = { lava: 0xff5a10, cracks: 0xffa050 };
const ROOT = 0.4; // m of a stalactite drawn up into the rock, so it never shows a gap
const DUST = 6; // specks falling from a shaking stalactite
const SHARDS = 8; // pieces a stalactite shatters into
const SHARD_TIME = 0.8; // s
const CHUNKS = 4; // pieces a crumbling tile falls away in
const CHUNK_TIME = 1.4; // s
const GLOW = 5; // m of heat glow above rising lava
const MAX = { dust: 60, shards: 64, cracks: 60, chunks: 160 };
const WIDE = 60 * TILE; // m of rising lava drawn past the level's sides

// Stalactites, crumbling rock and rising lava (sim/hazards/stalactite.js,
// crumble.js, rise.js). A stalactite is a cone of rock that sheds dust and
// trembles while it shakes, and shatters where it lands. A cracked tile of
// crumbling rock glows along its cracks, brighter until it goes, then falls away
// in pieces. Rising lava covers everything below its surface, with a heat glow
// over it. All drawn from the world's state, so it keeps to the level clock.
export function createCore(level, colors = CAVE_COLORS) {
  colors = { ...CAVE_COLORS, ...colors };
  const group = new THREE.Group();
  const rock = new THREE.MeshLambertMaterial({ color: colors.wall, flatShading: true });
  const stalactites = level.stalactites.map((s) => {
    const length = s.top - s.tip + ROOT;
    const geo = new THREE.ConeGeometry(((STALACTITE_WIDTH / 2) * length) / (s.top - s.tip), length, 7, 3);
    geo.rotateX(Math.PI);
    geo.translate(0, -length / 2 + ROOT, 0); // hanging from y = 0, its top
    const mesh = new THREE.Mesh(geo, rock);
    mesh.position.set(s.x, s.top, 0);
    group.add(mesh);
    return mesh;
  });

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const instanced = (geo, material, max) => {
    const mesh = new THREE.InstancedMesh(geo, material, max);
    mesh.frustumCulled = false; // its bounds were worked out when it was empty
    mesh.count = 0;
    group.add(mesh);
    return mesh;
  };
  const dust = instanced(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: colors.rim }), MAX.dust);
  const shards = instanced(new THREE.TetrahedronGeometry(0.35), rock, MAX.shards);
  const cracks = level.crumbles.length
    ? instanced(
        new THREE.PlaneGeometry(TILE, TILE),
        new THREE.MeshBasicMaterial({ map: crackOverlay(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        MAX.cracks,
      )
    : null;
  const chunks = level.crumbles.length
    ? instanced(new THREE.DodecahedronGeometry(0.5), new THREE.MeshLambertMaterial({ color: colors.crumble, flatShading: true }), MAX.chunks)
    : null;
  const lava = level.rise ? createRisingLava(level, group) : null;
  const glowColor = new THREE.Color();

  return {
    group,
    update(world) {
      const { tick } = world;
      const seconds = tick / TICK_RATE;
      let [nDust, nShards] = [0, 0];
      level.stalactites.forEach((s, i) => {
        const state = world.stalactites[i];
        const mesh = stalactites[i];
        mesh.visible = state.gone < 0;
        const trembling = shaking(s, state, tick);
        mesh.position.set(s.x + (trembling ? (Math.random() - 0.5) * 0.15 : 0), s.top - state.drop, 0);
        if (trembling) {
          // Dust trickling from the roof round it.
          const t = (tick - state.shook) / TICK_RATE;
          for (let k = 0; k < DUST && nDust < MAX.dust; k++) {
            const fall = (t * 1.5 + k / DUST) % 1;
            v.set(s.x + ((k * 0.37) % 1 - 0.5) * STALACTITE_WIDTH * 1.4, s.top - fall * 3, 0.3 - (k % 3) * 0.4);
            dust.setMatrixAt(nDust++, m.makeTranslation(v.x, v.y, v.z));
          }
        }
        // Shattered: pieces flying out from where it landed.
        const t = (tick - state.gone) / TICK_RATE;
        if (state.gone > 0 && t < SHARD_TIME) {
          for (let k = 0; k < SHARDS && nShards < MAX.shards; k++) {
            const a = Math.PI * (0.1 + (0.8 * k) / (SHARDS - 1)); // fanning up and out
            const speed = 3 + ((k * 7) % 5);
            v.set(s.x + Math.cos(a) * speed * t, s.tip - state.drop + Math.sin(a) * speed * t - (GRAVITY * t * t) / 2, (k % 3) - 1);
            e.set(t * (4 + k), t * (3 + k), 0);
            const size = 1 - t / SHARD_TIME;
            shards.setMatrixAt(nShards++, m.compose(v, q.setFromEuler(e), scale.set(size, size, size)));
          }
        }
      });
      dust.count = nDust;
      shards.count = nShards;
      dust.instanceMatrix.needsUpdate = shards.instanceMatrix.needsUpdate = true;

      if (cracks) {
        let [nCracks, nChunks] = [0, 0];
        level.crumbles.forEach((tile, i) => {
          const { cracked, fell } = world.crumbles[i];
          const [cx, cy] = [(tile.c + 0.5) * TILE, (tile.j + 0.5) * TILE];
          if (cracked >= 0 && fell < 0 && nCracks < MAX.cracks) {
            // Cracks glowing brighter as it goes, and shaking at the end.
            const t = Math.min(1, (tick - cracked) / (level.crumble * TICK_RATE));
            const jitter = t > 0.6 ? 0.08 : 0;
            m.makeTranslation(cx + (Math.random() - 0.5) * jitter, cy + (Math.random() - 0.5) * jitter, 0.04);
            cracks.setMatrixAt(nCracks, m);
            cracks.setColorAt(nCracks++, glowColor.setHex(COLORS.cracks).multiplyScalar(0.35 + 0.65 * t * (0.8 + 0.2 * Math.sin(seconds * 30))));
          }
          const t = (tick - fell) / TICK_RATE;
          if (fell > 0 && t < CHUNK_TIME) {
            for (let k = 0; k < CHUNKS && nChunks < MAX.chunks; k++) {
              const [ox, oy] = [(k % 2) - 0.5, Math.floor(k / 2) - 0.5];
              v.set(cx + ox * 0.9 + ox * t * 1.5, cy + oy * 0.9 - (GRAVITY * t * t) / 2, -1 - (k % 3));
              e.set(t * (2 + k), t * (3 - k), t * k);
              const size = Math.min(1, (CHUNK_TIME - t) / 0.4) * (0.8 + 0.1 * k);
              chunks.setMatrixAt(nChunks++, m.compose(v, q.setFromEuler(e), scale.set(size, size, size)));
            }
          }
        });
        cracks.count = nCracks;
        chunks.count = nChunks;
        cracks.instanceMatrix.needsUpdate = chunks.instanceMatrix.needsUpdate = true;
        if (cracks.instanceColor) cracks.instanceColor.needsUpdate = true;
      }

      if (lava) {
        lava.holder.position.y = world.rise.y;
        for (const t of lava.textures) t.offset.set(seconds * 0.03, seconds * 0.05);
        lava.glow.material.opacity = 0.5 + 0.15 * Math.sin(seconds * 2.3);
      }
    },
  };
}

// The rising lava: a sheet over everything below its surface (which is at y = 0
// in its holder), its surface going back into the cave, and a glow above it.
function createRisingLava(level, group) {
  const holder = new THREE.Group();
  const width = level.width * TILE + 2 * WIDE;
  const depth = level.height * TILE + WIDE;
  const x = (level.width * TILE) / 2;
  const texture = lavaTexture();
  texture.repeat.set(width / 8, depth / 8);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: texture }));
  front.position.set(x, -depth / 2, 0.8);
  const topTexture = texture.clone();
  topTexture.repeat.set(width / 8, (DEPTH + 1) / 8);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(width, DEPTH + 0.8), new THREE.MeshBasicMaterial({ map: topTexture }));
  top.rotation.x = -Math.PI / 2;
  top.position.set(x, 0, (0.8 - DEPTH) / 2);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(width, GLOW),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: COLORS.lava, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.position.set(x, GLOW / 2, 0.85);
  holder.add(front, top, glow);
  group.add(holder);
  return { holder, glow, textures: [texture, topTexture] };
}

// Fresh cracks, white on black, to glow in the crack colour over a cracked tile.
function crackOverlay() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  // From near the middle out to the edges, branching.
  const crack = (x, y, a, n) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < n; k++) {
      a += (Math.random() - 0.5) * 1.2;
      [x, y] = [x + Math.cos(a) * 7, y + Math.sin(a) * 7];
      ctx.lineTo(x, y);
      if (Math.random() < 0.25) crack(x, y, a + (Math.random() < 0.5 ? 1 : -1), n - k - 1);
    }
    ctx.stroke();
  };
  for (let i = 0; i < 5; i++) crack(size / 2 + (Math.random() - 0.5) * 12, size / 2 + (Math.random() - 0.5) * 12, (i / 5) * Math.PI * 2, 5);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
