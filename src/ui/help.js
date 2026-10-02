import { SAFE_SPEED } from "../sim/rocket.js";
import { icon } from "./kit.js";
import { frame } from "./frame.js";

// How to play: the controls, and everything in the caves.
export function help(el) {
  frame(
    el,
    "How to play",
    `<h2>Controls</h2>
    <dl>
      <dt>Steer</dt><dd>Tilt the phone left or right, held flat or upright. Or ← → / A D.</dd>
      <dt>Burn</dt><dd>Hold a finger anywhere on the screen. Or ↑ / W / Space, or hold the mouse.</dd>
      <dt>Pause</dt><dd>The ${icon("pause")} button, or P / Esc. The pause menu has the restarts, and Settings: how sharply the tilt steers, and the rest.</dd>
      <dt>Autopilot</dt><dd>The arrow button, or O: sit back and watch it fly the level, from wherever you are. It's careful rather than quick, and a run it flies any of doesn't earn stars.</dd>
    </dl>
    <h2>Landing</h2>
    <p>Land on any flat floor: touch down slower than ${SAFE_SPEED} m/s (the speed turns green), nearly upright, with both feet on the flat. Land on the green exit pad to finish.</p>
    <h2>Fuel</h2>
    <p>The engine only burns while there's fuel. Land on a blue fuel pad to fill up and mend the hull. After a crash, or when you're stuck without fuel, you start again from the last fuel pad you landed on. The clock keeps running.</p>
    <h2>Hitting rock</h2>
    <p>The rocket bounces off rock and loses hull, more the harder it hits. A slam, or losing all its hull, breaks it up. Tap to try again.</p>
    <h2>Keys, doors and switches</h2>
    <p>Fly through a key to pick it up; the doors of its colour and shape open as you come near. Land on an orange switch to open the gate with its number. Some gates shut again: the countdown starts as you lift off. The map (${icon("map")} or M) shows where you've been.</p>
    <h2>Flames and lava</h2>
    <p>Flamethrowers flicker before they fire, and burn the hull fast: a quick pass hurts, lingering kills. Some fire on a beat, some when you come near, and some never stop. Lava, and the blobs it throws up, destroy the rocket at a touch.</p>
    <h2>Machinery and magnets</h2>
    <p>Fans blow you along their column of dust: burn hard to fight them. Magnets pull you in (their rings close in) or push you away (their rings spread out), hardest close up. Moving blocks shove you and carry you if you land on them. Crushers shake before they slam: don't be in the way, or squeezed against the rock.</p>
    <h2>Dark, lasers and turrets</h2>
    <p>Some caves are dark: your headlight shows the way ahead, and pads, keys and crystals glow. A laser beam destroys you at a touch; some flicker before they come on, and a switch can turn one off. Turrets glow as they wind up, then fire a slow shot at where you are: keep moving, or put rock between you.</p>
    <h2>Falling rock, crumbling rock and rising lava</h2>
    <p>Stalactites shake and shed dust when you pass beneath them, then drop: hang back until they've fallen, or be quick. A hit costs hull. Crumbling rock is paler, with glowing cracks: touch it or land on it and it gives way a moment later, with all the crumbling rock joined to it, so take off fast. In some caves the lava rises, from the start or once you've taken something: the HUD shows how far below you it is. Climb!</p>
    <h2>Stars</h2>
    <p>Each level has three: one for finishing, one for beating its par time, and one for collecting all its crystals ${icon("crystal")} in one run. Finishing a level opens the next.</p>
    <h2>Replays</h2>
    <p>Every run is recorded, and your fastest finish on each level is kept on this phone: watch it from the pause menu. After a finish, Watch plays back the run you've just flown. Runs the autopilot flew any of aren't kept.</p>
    <h2>Workshop</h2>
    <p>Build your own caves in the Workshop, from a plain cave or a copy of one you've played. Paint rock, air, pads, keys, doors and hazards with one finger. With Move (the arrows), drag a placed thing to reposition it or drag the background to pan; use two fingers to move and zoom. If something's wrong with the level, it says what at the top, and Show finds it. Fly tries it straight away. The palette also adds switches, gates, fans, magnets and other things. Inspect (O), or hold a thing, to change its settings; moving blocks have a path you can drag. The menu has level settings, a reach overlay, Check for unreachable places, and Autopilot for a test flight with tank and par suggestions. Fly your level from the start to the exit yourself to mark it finished; changing it (but for its name) takes the finish away until you fly it again.</p>
    <h2>Tilt not working?</h2>
    <p class="hint">Browsers only share the motion sensors over HTTPS (or on localhost). On iPhone, allow motion access when asked.</p>
    <h2 id="privacy">Privacy and storage</h2>
    <p>Your levels, progress, settings and best replays are kept in this browser on this phone. The game and the Workshop do not need a pilot's name or a connection.</p>
    <p>Setting up a pilot talks to this site's community server. It keeps a player ID, your name, when the profile was created and last used, and a hash of your secret player code. Names are public when used to share levels or times. The code stays on your phone; the server never stores the code itself.</p>
    <p>When sharing opens, the server will also keep the levels, runs, ratings, plays, reports and run checks you submit, to show levels and scores and check that runs finish. <a href="/profile" data-link>Pilot</a> lets you save your online data as JSON or use Forget me to delete your profile and its online content. Clearing this phone's browser storage loses its copy of the code; keep the code elsewhere if you want to return.</p>
    <p>For rate limits, the server keeps a keyed hash of the connecting IP address, changed every UTC day. These expire within a day and are pruned during ordinary requests. They are kept apart from player data. This version sends no anonymous play statistics. The host may keep its own access logs under its hosting policy.</p>`,
  );
}
