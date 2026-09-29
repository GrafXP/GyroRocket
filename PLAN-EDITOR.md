# Gyro Rocket: level editor and sharing plan

A level editor on the phone, then a server where levels are shared and top times
are posted. The editor comes first and works with no server at all: you build a
level, fly it, and keep it on the phone. Then the server: post a level for everyone
to play, browse and play other people's levels, and post your times to a
leaderboard, for the built-in levels as well as shared ones. Before a level can be
posted, you have to finish it yourself, and the run that did it is posted with it
as proof.

It builds on phases 0–8 of `PLAN.md`: the level format, the parser and its checks,
the deterministic sim, the play page and the autopilot. Phase 9 (game feel) doesn't
touch any of this and can come before or after. The server is the Apache web server
with PHP and MySQL that's already there.

## Core decisions

- **A shared level is data, not code.** It has the same settings as a level
  module's export (`name`, `map`, `things`, `fuel`, `par`, `dark`, `rise`, `sky`…),
  as JSON, plus `format: 1` and `look` (which world's colours and background it
  borrows). So `parseLevel` reads it as it is, and "copy as a level module" turns a
  good one into a built-in level by pasting it into `src/levels/`.
- **Nothing from outside is trusted.** `parseLevel` spreads `things` settings into
  its own objects, so a bad value (a `period` of 0, a flame that sets its own `c`,
  a name with HTML in it) could break the sim or the page. A new
  `sim/validate.js` lists every setting each thing may have, with its type and
  range, and refuses anything else; it runs on every level that didn't come from
  `src/levels/`. Every string from the server is escaped before it goes into the
  page (`esc()` in `ui/dom.js`; `html()` uses innerHTML).
- **The editor is flat.** A 2D canvas of tiles seen straight on, with pinch to zoom
  and two fingers to pan, because you place tiles exactly and the 3D cave takes
  too long to rebuild on every stroke. It can draw the smooth rock outline the game
  will make, and the reach of flames, lasers, fans and movers, over the tiles. Fly
  opens the real play page, in 3D, and Back comes straight back to the same spot.
- **A finished run is a replay.** The sim is deterministic: replaying the inputs
  replays the run. Checked with the autopilot: 3-8's 5,098 ticks replay exactly, in
  63 ms in node on the phone, and its inputs pack into 2 KB. So finishing a level
  gives a replay, and "finish it before you post it" means posting that replay with
  the level. Anything with the sim can check it: the phone before posting, a check
  on the server, or anyone who downloads the level.
- **Replays must replay on every browser.** The sim sees inputs exactly as they're
  recorded: steer is rounded to 1/127 before the sim gets it, live as well as in a
  replay (rounding a recorded run afterwards made 6-8 fail, so it can't be done
  later). Arithmetic, `Math.sqrt` and rounding give the same answer on every JS
  engine; `Math.hypot` (20 calls in `src/sim`), `Math.sin` and `Math.cos` can
  differ in the last bit between Chrome and Safari, and one bit is enough for a
  run to diverge. The sim gets its own `sin`, `cos` and `hypot` built from those, and a
  test fails if `src/sim` uses anything else.
- **Times are ticks.** Scores are whole ticks (1/60 s), not seconds, so they
  compare exactly. `SIM_VERSION` goes up whenever the sim's behaviour changes; runs
  from an older sim don't replay the same, so leaderboards are per level and sim
  version, and golden replays in the tests catch a change nobody meant.
- **A level's identity is its content.** The level's hash (SHA-256) covers only
  what changes how it plays: map, things, fuel, dark, sky, rise, crumble. Renaming a level
  or changing its par or look doesn't need a new run; moving a tile does. A shared
  level never changes: editing it and posting again makes a new level. The client
  sends that part as a string and the server hashes and stores the string it's
  given, so PHP never has to rebuild JSON the way JS writes it. SHA-256 is a small
  pure-JS function, since `crypto.subtle` is missing on plain http.
- **No accounts, just names.** The first time the phone talks to the server it
  gets a player: a random secret token kept in localStorage (the server keeps only
  its hash). Posting a level or a time needs a name (3–16 letters, digits, spaces,
  `-` and `_`, unique). To move to another phone or keep it safe, the profile shows
  the token as a code to type in elsewhere. No passwords, no email, nothing to
  reset.
- **The server stores, the sim checks.** PHP doesn't run the sim; porting it would
  be a second sim to keep in step. The check is `scripts/verify.js`, bundled with
  the sim into one file (`server/verify.mjs`) that needs only node. If node can run
  on the server, PHP runs it on every post and nothing unchecked ever shows. If not,
  posts show at once as unchecked, the same script pulls them from an admin
  endpoint on a cron (anywhere, even Termux), and removes the ones that fail. The
  phone checks every run before posting, so only someone cheating on purpose is
  ever caught by that.
- **The game works without the server.** Built-in levels and the editor never wait
  for the network. Shared levels you've played are cached so they play offline,
  and a time that couldn't be posted is kept and posted later.
- **One host.** The game (`dist/`) and the API (`/api/…`) are served from the same
  Apache host, at the root of a (sub)domain, over HTTPS (tilt already needs it). No
  CORS, and the SPA's paths stay as they are.

## Layout

New and changed files:

```
src/
  main.js          + routes: /editor, /editor/<id>, /community, /c/<code>, /profile
  game.js          feeds quantized input to the sim and records it; watch mode plays a replay
  levels/index.js  + levelByKey: built-in ("1-3"), mine ("my:<id>"), shared ("c:<code>")
  autofly.js      the bounded headless autopilot run, shared by editor and CLI
  mylevels.js      my levels in localStorage: the list, each level, its completion
  sim/
    fmath.js       sin, cos and hypot the same on every JS engine
    validate.js    what a level from outside may contain, with ranges; clear errors
    check.js       the level checks from test/levels.test.js: pads, reach, keys, crystals
    replay.js      input ↔ bytes, encode/decode, replay a run and say how it ended
    hash.js        SHA-256, and a level's content hash
  editor/
    list.js        /editor: my levels, new, copy of a built-in level, import
    editor.js      the editor page: toolbar, palette, sheets, autosave, undo
    grid.js        the level as editable tiles and things; resize; its first problem
    canvas.js      draws the tiles, outline and reach overlays; pan, zoom, paint
    tiles.js       the palette, and how each tile looks
    tools.js       brush, rectangle, fill, eraser, picker, inspect
    move.js        selecting and dragging whole placed objects
    text.js        levels as JSON or a level module, and reading them back (no eval)
    things.js      thing defaults, labels, editable settings and connected shapes
    fields.js      controls generated from validate.js's settings
    sheets.js      thing and level settings sheets
    reach.js       reach overlays, including incomplete levels
    worker.js      Check and Autopilot, away from the drawing thread
  net/
    api.js         fetch with a timeout, JSON, the player's token; offline errors
    player.js      the token, the name, the transfer code
    outbox.js      times waiting to be posted
  ui/
    community.js   browse, search, a shared level's page
    scores.js      leaderboards, on the results sheet and the level page
scripts/
  verify.js        checks a replay against a level: stdin/stdout, or pulls from the server
  admin.js         pending posts, reports, hide, unhide, ban
  seed.js          the built-in levels' content and hashes, for the server
server/
  public/          goes in the web root next to dist/
    api/index.php  the one entry point: routes /api/… to handlers
    .htaccess      /api/ to index.php, everything else not a file to index.html
  lib/             db, http, players, levels, scores, admin, validate, thumbnails
  schema.sql       tables, and migrations/ after the first
  config.example.php  DB login, admin token, verifier mode, limits (config.php isn't in git)
  verify.mjs       built by npm run build:verify
test/
  validate, check, replay, fmath, hash, grid tests; api.test.js against a local server
```

## The level file

```json
{
  "format": 1,
  "name": "The switch",
  "look": 2,
  "par": 20,
  "route": "1 3 E",
  "play": "{\"map\":\"####…\",\"things\":{…},\"fuel\":16}"
}
```

`play` is the part the sim reads, as canonical JSON (keys sorted, map rows
trimmed); the level's hash is the hash of that string. The rest can change without
a new run. Limits: 16–200 columns, 12–150 rows, up to 60 things, 48 KB in all.

## Phases

Each phase ends with a build to try on the phone and a short checklist, and is
committed when `npm test` and the build pass. Phases E1–E3 need no server.

### Phase E1: The editor ✅ (done)

`/editor` lists my levels: New, Open, Duplicate, Delete, and "Copy of a built-in
level", to start from 2-5 and change it. A new level is a small cave with a start
and an exit, so it flies straight away. Levels save to localStorage as you go
(`mylevels.js`), with a warning if the phone's storage is full.

The editor fills the screen, landscape or portrait. One finger paints with the
current tool; two fingers pan and pinch to zoom (a stroke that a second finger
joins in its first moments is undone). With a mouse: left paints, right drags,
the wheel zooms, and Ctrl+Z / Ctrl+Y undo and redo. Tools: brush, rectangle,
flood fill, eraser (air), picker (takes the tile under your finger), and resize
(add or remove rows and columns on any side). Undo and redo go back through every
stroke.

The palette has every tile that's just a letter, grouped, each drawn the way it
reads in the game: rock, air, crumbling rock, lava; start, exit and fuel pads;
crystals; the four keys and their doors (with their shapes from `looks.js`);
flamethrowers facing each way; stalactites. The things that need settings come in
E2.

The level is parsed as you go (debounced). The first problem shows in a bar with
a marker on its tile ("a pad needs 3 tiles of air above it"); `parseLevel` already
names the row and column. A toggle draws the rock outline from `sim/outline.js`
over the tiles, so you see the corners the game will cut.

Fly plays the level on the real play page (`/play/my/<id>`), and the pause menu
and results sheet get *Back to editor*. Export copies the level as JSON or as a
level module; Import takes either, pasted, through `validate.js`.

- [ ] Painting, panning and zooming on the phone never get mixed up.
- [ ] A 200×100 level scrolls and paints smoothly.
- [ ] Every problem the parser finds shows where it is.
- [ ] Fly and Back take a couple of seconds at most, and you're where you left off.
- [ ] A level survives a reload, and undo goes all the way back.

What was built: Editor is in the nav. `/editor` lists my levels, last edited
first, each with Fly, Copy and Delete, and starts new ones: a plain 48×24 cave, a
copy of any built-in level that's open to you (with its world as its look), or an
import. `mylevels.js` keeps each level in localStorage under its own key, with a
list of names and sizes, and says when the storage is full. A level is saved as
the same object as a level module, map and all, plus `look`.

The editor page (`/editor/<id>`) hides the nav like the game. The top bar has the
way back, the level's name (edited in place), undo, redo, a menu and Fly; the
bottom bar the tile (it opens the palette), the tools (move, brush, rectangle,
fill, eraser, picker) and the brush size (1, 2, 3 or 5 tiles). It starts on Move,
where one finger moves the view; tapping the tool that's on goes back to it. Keys:
H B R F E I pick the tools, [ and ] the size, Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z) undo and redo, Esc
closes things. Pads paint as a row of three, the least a pad can be; painting a
start, an exit or a key moves the one that was there. A second finger within a
quarter of a second of the first makes it a pinch and drops what the first
painted. Up to 200 steps undo, a stroke or a resize each, and they last while the
app's open, so Fly and back keeps them, and the view and tool too.

The canvas draws each row as runs of one colour, and the things on top (pads,
keys with their shapes, doors, flame nozzles, stalactites, crumbling cracks, lava,
and things by kind with their character) only once tiles are 6 px or more, so a
200×150 level draws in about 2 ms in node. The menu's *Rock outline* draws the rock
as the game will cut it, from `sim/outline.js`, updating only the tiles that
change. The level's first problem is checked as you go (`problemOf` in
`grid.js`: validateLevel, then parseLevel) and shows under the top bar, with Show
to find the tile, which gets a red ring; Fly won't go while there's one. Resize
adds or takes away 1 or 5 rows or columns on any side (16–200 by 12–150), and
moves rising lava and the route's `F@` columns to match. Export shows the level as
JSON (the map as a list of rows) or as a level module, to copy or save as a file.
Import (on `/editor`) takes either, read by a small parser in `editor/text.js`
that never runs the text, then `validate.js`.

`sim/validate.js` has every setting of every kind of thing and of the level, with
types and ranges, and refuses anything else; every built-in level passes. `mapRows`
moved out of `parseLevel` so the parser, the checker and the grid read maps the
same way. The play page flies my levels at `/play/my/<id>` with *Back to editor*
in the pause menu and on the results (no stars or records for them yet), and says
what's wrong with one that can't be flown. `esc()` in `ui/dom.js` keeps level
names from being read as markup. Help has a paragraph on the editor. Tests:
`validate`, `grid` (with the tools), `text` (every module in `src/levels` reads
back as the level it exports) and `mylevels`.

### Phase E2: Things and settings ✅ (done)

The palette gets the things set up in `things`: switches and gates, flamethrowers
with their own settings, lava blobs, fans, magnets, movers, crushers, lasers,
turrets and stalactites with settings. Placing one makes a new thing with the next
free character and its defaults; painting with an existing one (the palette lists
them) grows it, so a gate or a switch can be any width. The inspect tool (or a
long press) opens a thing's sheet, made from its entry in `validate.js`: sliders
for times and strengths, buttons for facing and mode, a list of the gates and
lasers a switch can open, and for movers and crushers an arrow you drag on the map
for `to`. The reach overlay draws what each thing covers: flame and laser lengths,
fan columns, magnet ranges, mover paths, a switch's line to its gate.

The level's own settings sheet: name, look (a world's colours), tank, par, dark,
sky rows, crumble time, rising lava (speed, from, to, after, delay) and, under
*Advanced*, the autopilot's route.

*Check* runs what `test/levels.test.js` checks today, moved to `sim/check.js` so
the tests, the editor and the server share it: pads you can stand on and reach,
every key, switch and crystal reachable, doors opened in an order that works. It
marks what can't be reached. *Autopilot* flies the level in a Web Worker and says
each leg's time and fuel, where it got stuck if it did, and suggests a tank (1.4×
the longest leg) and a par (its time, rounded up to 5 s), like `npm run fly`.

- [ ] Every kind of thing can be placed, set up and tested without typing a character.
- [ ] You can see what a thing will do before you fly it.
- [ ] Check and the autopilot find a level's problems before you find them in the air.
- [ ] Nothing you can set in a sheet breaks the game (`validate.js` has a test per kind).

What was built: The palette's *Add a thing* section has all eleven kinds, with
an icon for each. Choosing one and painting creates its definition with a free
label and the simulator's defaults. The palette's *In this level* section lets
you paint that label again, extending a gate, switch or block. Inspect (O), or
hold a thing for 550 ms, to open its settings. Holding a plain flame or
stalactite gives just that instance its own settings. A long press restores any
paint it started; moving or adding a second finger cancels the inspection.

Move (H, the arrows) also repositions placed things: drag an object to its new
tile; drag rock or air to pan the view. Pads and switches move as a horizontal
run, stalactites as a column, and gates, doors and moving blocks as one connected
shape. A separate instance of the same label stays where it was. Labels, settings,
switch connections and relative mover paths are kept; moving a fuel pad updates
route stops that name its columns. The whole object stays within the map and
occupied drops are rejected. A drag is one undo step and saves only on release;
a second finger or cancellation restores its starting position before panning.

Thing sheets use `THING_SETTINGS` for their controls and bounds: sliders with
precise number inputs, facing and mode buttons, checkboxes, and a switch's list
of placed gates and lasers. All instances of the selected label respond to
the switch, including separated gate rectangles and repeated laser emitters. Movers and crushers have Right/Up fields and *Drag
the path on the map*: drag the arrow tip, then Done (or Cancel). Travel is in
whole tiles, with positive Y upwards. Each disconnected block has its own handle;
settings still belong to its label. The menu's *Settings* sheet includes name,
world colours, tank, par, dark, sky, crumble, rising lava and the route under
Advanced. Blank routes use the autopilot's default. Applied settings and paths
are saved and undoable, along with painting and resizing; snapshots are independent.

*Thing reach* starts on and can be toggled in the menu. It shows flames and
lasers clipped by rock, fan columns, magnet and turret ranges, blob heights,
stalactite trigger bands, block paths and destination boxes, and switch links.
Near-flame triggers surround the whole beam. The overlays work while the map is
incomplete; beam and fan geometry is checked against every built-in level. Ranges
and trigger bands show potential reach; timing and line-of-sight still depend on
the running sim. Incremental rock-outline updates also work after painting (the
outline updater and tile-picker previously shared a name).

*Check* runs the geometry and lock-order checks extracted from the built-in tests
to `sim/check.js`, and lists problems with Show buttons and markers. It checks
standing room, reach to every pad, key and crystal, and reaching keys/switches
before passing their barriers. *Autopilot* reports each completed leg's time,
fuel and hull, and marks where a failed run stopped. A successful flight suggests
1.4× the fuel burned between refills, rounded up, and the full elapsed time
rounded up to 5 seconds as par; a button applies both. `autofly.js` is shared with
`npm run fly`, which now prints these suggestions too. Both editor checks run in
a Web Worker, can be cancelled, and terminate on leaving the editor or changing
the map; a wall-clock timeout and a simulated-time limit bound long runs. Static
Check does not establish hazard timing or fuel sufficiency, and an autopilot
failure does not establish that a person cannot finish.

Validation: all 191 Node tests and the production build pass; tests cover each thing's
defaults and setting bounds, plain-hazard conversion, connected shapes, reach
geometry, lock order, worker flight reports, whole-object dragging, and pointer cancellation. A local
DOM smoke test also exercised placement, sheets, undo/redo, long press, pinch,
mover arrows, outline updates, both worker actions, applying suggestions and
session restore. Browser automation is unavailable on this Android/Termux host;
the physical phone checklist above remains to be tried. On the phone, start with
a new level, place a gate and switch, connect them with Inspect, adjust a mover
path, run Check/Autopilot, then Fly and return. Try the sheets in portrait and
landscape, and reload to check saved settings.

### Phase E3: Replays, and finishing your own level ✅ (done)

The sim gets `fmath.js`, and a test fails on `Math.sin`, `Math.cos`, `Math.hypot`,
`Math.atan2`, `Math.exp`, `Math.pow` or `**` in `src/sim`. The tap that restarts
after a crash moves from `game.js` into the sim (`advance(world, input)`), as does
the pause menu's *Restart from pad*, as an input, so every way a run can go is in
its inputs. Input is quantized before the sim sees it: steer in 1/127 steps or
"hold", a bit for the keys' slower turn, thrust, restart. Every level, the
autopilot's included, is flown that way, and the autopilot must still finish them
all within their tanks.

`game.js` records every run: two bytes a tick, deflated, a few KB a minute. A run
from *Restart level* is a new recording. A replay says the level's hash, the sim
version, and how it ended: ticks, crystals, restarts. `replay.js` plays one back
headless and says whether it lands on the exit, and when. Runs flown with the
autopilot or a dev cheat are marked and never count.

My levels: finishing one clean from the start marks it *Finished in 42.3 s*, with
the replay, and moving a tile clears it. The best run on every level, built-in or
mine, is kept (localStorage: 48 levels at a few KB each), so the times from here on
can be posted when the server comes. *Watch* plays a kept run back on the play
page: the rocket flies it exactly, and lands on the exit on the same tick.

`test/replay.test.js` keeps a few golden replays (from the autopilot), and fails if
they stop landing on the same tick; after a change to the sim on purpose, bump
`SIM_VERSION` and record them again.

- [ ] A run watched back lands exactly as it did, on the phone and in node.
- [ ] A run recorded on the phone replays the same in node (`scripts/verify.js`).
- [ ] The game feels the same with quantized steering.
- [ ] Editing a finished level clears its finish; renaming it doesn't.

What was built: `src/sim/fmath.js` has the sine and cosine from fdlibm (as in
musl), within a unit in the last place of V8's, and `hypot` as the square root of
the sum of squares: plus, minus, times, divide and `Math.sqrt` give the same answer
on every engine. `test/fmath.test.js` goes further than the plan: of `Math`, the
sim may only use what's exact everywhere (`abs`, `floor`, `round`, `min`, `max`,
`sqrt` and the like), and no `**`. A sliding block's phase wraps round its period
before its cosine, so the angle stays small however long the level runs.

`src/sim/input.js` turns a tick's input into its code, two bytes: the steer in
127ths as a signed byte, and bits for burn, turning slowly (the keys, at
`SLOW_TURN_RATE`, now in `rocket.js`), restart and hold (a null steer).
`advance(world, code)` (`world.js`) is how every run is flown, in the game, the
autopilot's test flights and replays: it takes the restart bit and the tap after a
crash (a new press, once `RETRY_AFTER` is up) and keeps the engine off while the
rocket's down or done. The controls give `{ steer, slow, thrust }`. Every level
still flies within its tank with the new maths and quantized input, the autopilot's
times within 0.2 s of before, but for 7-1: 144.8 s instead of 140.4 s (par 145),
having missed a beat on the way to the red key.

`game.js` records every run from the level's start, a code a tick, until the
finish; *Restart level* starts a new recording. `src/replay.js` makes a replay of
it: `{ format, sim, level, finished, ticks, time, crystals, restarts, input }`,
with `assisted` or `cheated` when the autopilot flew or a dev cheat was on. `input`
is the steer bytes as changes from the tick before, then the flag bytes, deflated
(`CompressionStream`, in the browser and in node) and in base64: the autopilot's
runs come to about 2 KB a minute. `checkReplay` plays one back headless on a fresh
world and says whether it lands on the exit on its last tick, with the same time,
crystals and restarts, or why not (another sim version or level, damaged input, a
cheat).

A level's hash (`src/hash.js`) is the SHA-256 of what's flown, as JSON with its
keys in order: the map as parsed (so indenting it changes nothing), its things, and
`fuel`, `dark`, `sky`, `crumble` and `rise`; not the name, par, route or look. It's
128 bits, as hex. SHA-256 is written out in JS, since `crypto.subtle` is async and
needs HTTPS, which a phone on the dev server doesn't have. Every built-in level
keeps its hash through the editor, copied and saved.

`src/runs.js` keeps the best run of each level in localStorage
(`gyrorocket:run:<id>`, `my:<id>` for my levels): the fastest that counts
(finished, no autopilot, no cheat), replaced by any run on a changed level or sim.
The test cave and the big cave keep none. My level is finished while its kept run is
on the level as it is (`finishOf`): the editor's list says *Finished in 0:42.3*, and
so does its menu (or how to finish it), and deleting the level forgets its run. The
results for my level say whether the run finished it.

Watching: the pause menu has *Watch your best run, 0:42.3* when there is one, and
the results have *Watch*, for the run just flown (the autopilot's too). The game
flies the level from the start with the run's codes, taking no notice of the
controls or the cheats; the HUD says what's being watched, the pause menu has *Stop
watching*, and the replay's results have *Watch again* and *Play*. If a replay
didn't land on the exit on its tick, its results say so; with `?dev`, they say the
tick when it did.

To check a phone's run in node: with `?dev`, the results have *Save this run*. On
the dev server it's posted to `/__runs` (a plugin in `vite.config.js`), which
writes it to `runs/` in the project (ignored by git), since node can't see the
phone's downloads; elsewhere it's a download. `npm run verify` plays back every
run in `runs/`, or the files named, and says how each went; a run carries its level
id, and my level's run the level itself.

`test/replays/` has the golden replays: the autopilot flying 1-8, 2-6, 3-8, 4-8,
5-8, 6-8 and 7-4, and 1-6 with a crash, a tap to go again, and a *Restart from
pad* from the menu. `npm run golden` (`scripts/golden.js`) records them again.
`test/replay.test.js` fails if one doesn't land on the same tick or was recorded on
another `SIM_VERSION`, and checks that doctored replays are caught, packing, the
hash, and which runs are kept.

Checked in node: a smoke test of the play page (a scratch DOM, with the view and
controls stubbed) flies levels, and checks the run is kept, *Watch* lands on the
same tick, *Restart from pad* is in the recording, the autopilot's runs aren't
kept, and my level shows as finished in the editor's list. The checklist above is
for the phone.

### Phase E4: The server, and names

`server/`: PHP 8 with PDO (prepared statements only) and MySQL (utf8mb4). One
entry point, `api/index.php`, sends JSON in and out, with errors as `{ error }`
and the right status. `.htaccess` sends `/api/…` there and every other path that
isn't a file to `index.html`, so `/play/1-3` and `/c/K7Q2XW` load the game.
`config.php` holds the database login, the admin token and the limits, and lives
outside the web root if the host allows it (else the web server refuses to serve
`lib/` and `config.php`). `schema.sql` makes the tables, and numbered migrations
come after it.

Tables: `players` (token hash, name, created, last seen, banned), `levels`,
`scores`, `likes`, `plays`, `reports`, and `hits` for rate limits. IP addresses
are only kept hashed, for the limits.

Players: `POST /api/players` makes one and returns its token; `GET`/`PATCH
/api/players/me` reads it and sets the name; `DELETE` forgets the player, their
name, times and levels. `GET /api/health` says the API and sim version, so an old
cached copy of the game can say "update to post".

The client: `net/api.js`, and a Profile page (from Home and the pause menu's
settings): pick a name, see the code to move it to another phone, type in a code
from one, forget me. The game still starts and plays with the server down.

Locally: PHP and MariaDB in Termux, `npm run api` runs `php -S` on
`server/public`, and Vite passes `/api` through to it. `test/api.test.js` runs
against it on a scratch database when `GYRO_API` is set, and is skipped
otherwise. `npm run deploy` builds, and copies `dist/` and `server/` to the host.

- [ ] The game and the API run from the Apache host over HTTPS, and every route loads.
- [ ] A name is picked in seconds, can't be taken twice, and moves to another phone with the code.
- [ ] With the server down, nothing in the game waits or breaks.

### Phase E5: Sharing levels

In the editor, a finished level with a name gets *Post*. It shows what will be
public (the level, its name, your name, your run), then posts the level file and
its replay. The server checks the size, the shape (a PHP copy of the easy parts of
`validate.js`: keys, types, map size and letters), the rate limit (10 levels a
day), that you have a name, and that the hash isn't posted already (then it just
gives that level's code). Then it checks the replay: with node on the server,
`verify.mjs` right away; without, the level goes up as unchecked until
`scripts/verify.js` pulls it. A level gets a short code (`K7Q2XW`) and a link,
`/c/K7Q2XW`, to share. Posting a new version of your level can replace the old
one: the old link leads to the new one, and its times stay with the old one.

`/community`: New, Popular (plays and likes in the last 30 days) and Search (by
level or player name), 20 at a time. Each shows a thumbnail (made on the server
from the map with GD, a pixel per tile, and kept), name, author, size, plays, how
many who tried it finished it, likes, and your stars on it. A level's page has
Play, Like, Share (the phone's share sheet, or copy the link), *Watch the author's
run*, and Report.

Shared levels play at `/play/c/<code>` like any other: the level's own par and
crystals give stars, kept in `progress.js` under `c:<code>`. A level is fetched
once and cached, so it plays offline after that. Starting and finishing one counts
towards its plays and finishes, once per player.

`/editor` shows what you've posted, with plays, finishes and likes, and can unlist
a level (it disappears from lists; its link says so).

Moderation: a level reported by three players is hidden until looked at.
`scripts/admin.js` (with the admin token) lists unchecked posts and reports, and
hides, unhides and bans. `scripts/verify.js --pull` checks what's waiting, and can
run on a cron.

- [ ] You can't post a level you haven't finished, and a doctored replay is caught.
- [ ] A shared link opens the level on another phone, and plays offline after that.
- [ ] Browsing is quick on a phone connection, thumbnails and all.
- [ ] A level's name or author can't put anything but text on the page.

### Phase E6: Top scores

Every finish that's your best yet, with no autopilot or cheats, is posted with its
replay, if you have a name (a setting turns it off). It works for the built-in
levels too: `scripts/seed.js` gives the server their `play` strings and hashes on
every deploy, so it knows them and the checker can replay them. The server keeps
each player's best per level and sim version, and checks it like a posted level.
A time that couldn't be posted waits in `net/outbox.js` and goes on the next start.
Picking a name offers to post the best times kept since E3.

`GET /api/levels/<hash>/scores` gives the top 10 and your place with the players
either side of you. The results sheet says where the run puts you ("4th of 57,
world best 0:31.2") with the top 10 a tap away, and so does a shared level's page;
the Levels page gets a scores button per level. You can watch any top-10 run: the
replays are there already.

What this doesn't stop: someone who writes a replay by hand, frame by frame, can
post it and it will check out, as it's a real run. It's a lot of work for a phone
game's leaderboard, and `scripts/admin.js` can remove a time.

- [ ] Your rank shows on the results sheet within a second or two of finishing.
- [ ] A time posted offline arrives later, once.
- [ ] Watching the world best shows how it was done.
- [ ] A changed built-in level starts a new leaderboard.

## To settle before E4

These change the server phases, so they're worth deciding first; the plan assumes
the first answer to each.

1. **Can node run on the server** (installed, and PHP allowed to `exec` it)? Then
   every post is checked before it shows. If not, posts show unchecked for a while.
2. **Access:** SSH (rsync deploys, cron for the checker and database backups) or
   only FTP?
3. **Where the game is served:** the root of a (sub)domain on the same host, over
   HTTPS. Somewhere else (GitHub Pages, a subfolder) means CORS or changing the
   game's paths.
4. **Names without passwords**, moved with a code. Accounts with email and a
   password are more work (reset mails) and more to keep safe.
5. **Versions:** PHP 8.1+, MySQL 5.7+ or MariaDB 10.3+, and the GD extension for
   thumbnails (without it, the thumbnails are drawn on the phone from the map).

## Later

- **Ghosts:** race the world best, or your own; the replays are already there.
- **Level of the week**, picked by hand and shown on Home.
- **Community worlds:** a player's levels grouped in order, unlocked one by one.
- **Editor:** copy and paste a region, mirror it, and draw with a symmetry line.
- **Difficulty votes** after a finish, shown on the level's card.
