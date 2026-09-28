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
  mylevels.js      my levels in localStorage: the list, each level, its completion
  sim/
    fmath.js       sin, cos and hypot the same on every JS engine
    validate.js    what a level from outside may contain, with ranges; clear errors
    check.js       the level checks from test/levels.test.js: pads, reach, keys, crystals
    replay.js      input ↔ bytes, encode/decode, replay a run and say how it ended
    hash.js        SHA-256, and a level's content hash
  editor/
    editor.js      the editor page: toolbar, palette, sheets, autosave, undo
    grid.js        the level as editable tiles and things; resize; to and from a level
    canvas.js      draws the tiles, outline and reach overlays; pan, zoom, paint
    tools.js       brush, rectangle, fill, eraser, picker, inspect
    things.js      the settings sheet for each kind of thing, from validate.js
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

### Phase E1: The editor

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

### Phase E2: Things and settings

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

### Phase E3: Replays, and finishing your own level

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
