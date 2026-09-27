import * as THREE from "three";
import { TICK_RATE } from "../sim/rocket.js";
import { padUnder, switched } from "../sim/world.js";
import { KEY_LOOKS, GATE_COLOR, css, shapePoints, drawShape } from "../looks.js";
import { DEPTH } from "./cave.js";

const OPEN_TIME = 0.4; // seconds a door takes to slide open
const SHUT_TIME = 0.25;
const STEEL = 0x2b2f38;
const LAMP = { open: 0x3fbf6a, shut: 0xd63a3f };

// Keys, doors, gates and switches (sim/level.js): keys float in their colour and
// shape; doors are steel slabs with their key's shape on, and gates are striped
// with their switch's number, both sliding into the rock as they open; a switch
// has a post with its number and a lamp, green while its gate is open.
export function createDoors(level, dark = false) {
  const group = new THREE.Group();
  const keys = level.keys.map((k) => createKey(k, group));
  const doors = level.doors.map((d) => createDoor(d, group, dark));
  const posts = level.pads.filter((p) => p.kind === "switch").map((p) => createPost(p, group));

  return {
    group,
    update(world) {
      const seconds = world.tick / TICK_RATE;
      keys.forEach((key, i) => {
        const since = world.keyTicks[i] < 0 ? -1 : (world.tick - world.keyTicks[i]) / TICK_RATE;
        key.visible = since < 0.35;
        if (!key.visible) return;
        key.rotation.y = Math.sin(seconds * 1.6 + i) * 0.5;
        key.position.y = key.userData.y + Math.sin(seconds * 2 + i) * 0.3;
        key.scale.setScalar(since < 0 ? 1 : 1 + since * 4);
        for (const m of key.children) m.material.opacity = since < 0 ? m.userData.opacity : m.userData.opacity * (1 - since / 0.35);
      });

      doors.forEach((door, i) => {
        const { open, changed } = world.doors[i];
        const since = (world.tick - changed) / TICK_RATE;
        const p = open ? Math.min(1, since / OPEN_TIME) : changed < 0 ? 0 : Math.max(0, 1 - since / SHUT_TIME);
        door.slab.position.copy(door.home).addScaledVector(door.slide, p);
        door.slab.visible = p < 1;
      });

      const on = padUnder(world.level, world.rocket);
      for (const post of posts) {
        const { open, until } = switched(world, post.pad.opens);
        const left = (until - world.tick) / TICK_RATE;
        // A timed gate's lamp blinks for its last three seconds.
        const blink = open && until >= 0 && left < 3 && on !== post.pad && Math.sin(seconds * 20) < 0;
        post.lamp.material.color.setHex(open && !blink ? LAMP.open : LAMP.shut);
      }
    },
  };
}

// A key: a token in its shape and colour, in a soft glow.
function createKey({ x, y, color }, group) {
  const look = KEY_LOOKS[color];
  const key = new THREE.Group();
  key.position.set(x, y, 0);
  key.userData.y = y;
  const shape = new THREE.Shape(shapePoints(look.shape).map(([px, py]) => new THREE.Vector2(px * 0.8, py * 0.8)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  geo.center();
  const token = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ color: look.color, emissive: look.color, emissiveIntensity: 0.45, transparent: true }),
  );
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 16, 12),
    new THREE.MeshBasicMaterial({ color: look.color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  token.userData.opacity = 1;
  glow.userData.opacity = 0.2;
  key.add(token, glow);
  group.add(key);
  return key;
}

// A door or gate: a slab filling its rectangle, its face just behind the rock's
// face, so it slides out of sight into the rock: up if it's tall, sideways if wide.
function createDoor(d, group, dark) {
  const [w, h] = [d.x1 - d.x0, d.y1 - d.y0];
  const face = d.key ? doorFace(KEY_LOOKS[d.key]) : gateFace(d.switch);
  face.repeat.set(w / 2, h / 2);
  const steel = new THREE.MeshLambertMaterial({ color: STEEL });
  // In the dark its face glows a little, to be found by.
  const front = new THREE.MeshLambertMaterial({ map: face, emissive: dark ? 0xffffff : 0, emissiveMap: dark ? face : null, emissiveIntensity: dark ? 0.35 : 0 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH), [steel, steel, steel, steel, front, steel]);
  const home = new THREE.Vector3((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, -0.05 - DEPTH / 2);
  slab.position.copy(home);
  group.add(slab);
  return { slab, home, slide: h >= w ? new THREE.Vector3(0, h, 0) : new THREE.Vector3(w, 0, 0) };
}

// A switch's post, at the pad's right end: its number, and a lamp on top.
function createPost(pad, group) {
  const post = new THREE.Group();
  post.position.set(pad.x1 - 0.8, pad.y, -3.6);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 1.1), new THREE.MeshLambertMaterial({ color: STEEL }));
  body.position.y = 1.3;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: gateFace(pad.label) }));
  plate.position.set(0, 1.6, 0.56);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshBasicMaterial({ color: LAMP.shut }));
  lamp.position.y = 2.9;
  post.add(body, plate, lamp);
  group.add(post);
  return { pad, lamp };
}

const texture = (draw) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  draw(canvas.getContext("2d"));
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// Steel, framed in the key's colour, with its shape in the middle.
const doorFace = (look) =>
  texture((ctx) => {
    ctx.fillStyle = css(STEEL);
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = ctx.fillStyle = css(look.color);
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 118, 118);
    drawShape(ctx, look.shape, 64, 64, 34);
  });

// Orange and black stripes, with the switch's number in a white disc.
const gateFace = (label) =>
  texture((ctx) => {
    ctx.fillStyle = "#1b1d22";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = css(GATE_COLOR);
    for (let x = -128; x < 128; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 128);
      ctx.lineTo(x + 32, 128);
      ctx.lineTo(x + 160, 0);
      ctx.lineTo(x + 128, 0);
      ctx.fill();
    }
    ctx.fillStyle = "#f4f4f4";
    ctx.beginPath();
    ctx.arc(64, 64, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b1d22";
    ctx.font = "bold 52px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 64, 67);
  });
