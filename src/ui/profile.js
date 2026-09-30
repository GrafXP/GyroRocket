import { player } from "../net/player.js";
import { transferCode } from "../net/player.js";
import { html, saveFile } from "./dom.js";

export function profile(el) {
  const controller = new AbortController();
  let current = null;
  let alive = true;
  let busy = false;
  const $ = html(el, `<h1>Profile</h1>
    <p>Pick a name for sharing levels and times when the community opens. Your game and editor work without a profile.</p>
    <p id="profile-status" class="hint" role="status" aria-live="polite">Checking the community server…</p>
    <form id="profile-name" class="profile-form">
      <label for="player-name">Your name</label>
      <input id="player-name" name="name" minlength="3" maxlength="16" pattern="[A-Za-z0-9 _-]{3,16}" autocomplete="nickname" required aria-describedby="name-help">
      <p id="name-help" class="hint">3–16 letters, digits, spaces, - or _. Each name belongs to one player.</p>
      <button type="submit">Save name</button>
    </form>
    <section id="profile-code" hidden>
      <h2>Keep your profile</h2>
      <p>This code opens your profile on another phone. Keep it private and save it somewhere safe: it cannot be reset if lost.</p>
      <label for="player-code">Your player code</label>
      <textarea id="player-code" class="player-code" rows="3" readonly spellcheck="false" autocapitalize="off"></textarea>
      <button id="copy-code">Copy code</button>
    </section>
    <h2>Use a profile from another phone</h2>
    <p class="hint" id="replace-note" hidden>This replaces the profile on this phone. Save your current code first.</p>
    <form id="profile-import" class="profile-form">
      <label for="import-code">Player code</label>
      <textarea id="import-code" name="code" rows="3" required spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
      <button type="submit">Use this code</button>
    </form>
    <section id="profile-data" hidden>
      <h2>Your data</h2>
      <p>Save everything the server keeps for your player, or delete the online profile and its shared levels, times and ratings. Your levels, progress and replays on this phone stay here.</p>
      <button id="save-data">Save my data</button>
      <details class="profile-delete">
        <summary>Forget me</summary>
        <p>Deleting the online profile frees the name. Its code stops working on every phone, and its online data cannot be recovered.</p>
        <button id="forget-player">Delete my online profile</button>
      </details>
    </section>
    <p class="hint"><a href="/help#privacy" data-link>Privacy and storage</a></p>`);

  const status = $("#profile-status");
  function sync() {
    const token = player.token();
    $("#profile-code").hidden = !token;
    $("#profile-data").hidden = !token;
    $("#replace-note").hidden = !token;
    $("#player-code").value = token ? transferCode(token) : "";
    if (current) $("#player-name").value = current.name ?? "";
  }
  async function action(work, message) {
    if (busy || !alive) return;
    busy = true;
    for (const button of el.querySelectorAll("button")) button.disabled = true;
    try {
      await work(controller.signal);
      if (alive) status.textContent = typeof message === "function" ? message() : message;
    } catch (error) {
      if (alive) status.textContent = error.message;
    } finally {
      busy = false;
      if (alive) {
        sync();
        for (const button of el.querySelectorAll("button")) button.disabled = false;
      }
    }
  }
  $("#profile-name").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#player-name").value;
    action(async (signal) => { current = await player.rename(name, signal); }, () => `Your name is ${current.name}. Your profile is saved on this phone.`);
  });
  $("#profile-import").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = $("#import-code").value;
    action(async (signal) => {
      current = await player.useCode(code, signal);
      if (alive) $("#import-code").value = "";
    }, () => current.name ? `Welcome back, ${current.name}.` : "Profile restored. Pick a name when you're ready.");
  });
  $("#copy-code").addEventListener("click", () => {
    action(async () => {
      const code = $("#player-code").value;
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
      else {
        $("#player-code").select();
        if (!document.execCommand("copy")) throw new Error("Select the code above and copy it.");
      }
    }, "Code copied. Keep it private.");
  });
  $("#save-data").addEventListener("click", () => {
    action(async (signal) => {
      const data = await player.data(signal);
      if (alive) saveFile("gyrorocket-player.json", JSON.stringify(data, null, 2));
    }, "Your player data is ready to save.");
  });
  $("#forget-player").addEventListener("click", () => {
    action(async (signal) => {
      await player.forget(signal);
      current = null;
      if (alive) $("#player-name").value = "";
    }, "Your online profile has been deleted. Your game and levels on this phone are still here.");
  });
  sync();
  action(async (signal) => {
    await player.health(signal);
    current = await player.me(signal);
  }, () => current?.name ? `Signed in as ${current.name}.` : "The server is ready. Pick a name or use a player code.");
  return () => {
    alive = false;
    controller.abort();
  };
}
