# Gyro Rocket: menu and UI plan

The game plays like a game and its menus read like a web app: a page of cards, a
tab bar, a settings form. This plan redoes everything round the flying (the title,
the level select, pause, results, settings, help, profile and the editor's front
page) so that it feels like one game from the first tap to the last level, and
looks like the caves it's about.

It builds on what's there: the routes, `progress.js`, the play page's states, the
3D view, and the worlds' colours in `levels/index.js`. Nothing in `src/sim/`
changes, so `SIM_VERSION` stays where it is. Settings, replays and my levels keep
their storage shape. U4 also carries in the agreed star correction: progress
keeps a single best star run and a separate fastest time, with old saves readable.
It can come before or after
`PLAN.md`'s phase 9 (sound, particles, shake) and `PLAN-EDITOR.md`'s E5–E7; where
they touch, it says so.

## What's wrong now

From going through every screen at phone size:

- **Home is a document.** A heading, a paragraph, four cards that all look alike,
  then a theme picker and a fullscreen button. Nothing of the game shows: no
  rocket, no cave, no colour but the accent.
- **A tab bar.** Home, Levels, Editor, Help along the bottom is how an app gets
  about. It takes 60 px, a sixth of the height on a phone held sideways, which is
  how the game's meant to be held.
- **Levels is one long list.** 80 tiles the same grey, in ten groups, under
  headings like `1 · Training caves ★ 0/24`. The worlds have their own rock
  colours and none of them shows. You scroll to find where you are. The test cave
  and "a 200 × 150 stress test" are linked at the bottom.
- **Pause is two lists of buttons.** Resume and the restarts next to autopilot,
  tilt sensitivity, theme, profile, fullscreen and frame rate, all the same
  weight, with toggles written as "Autopilot: off".
- **The words are technical.** "Full steer at 35° of tilt", "Frame rate: off",
  "the ?unlock debug flag", "Checking the community server…", an import box whose
  placeholder is JSON on the editor's front page.
- **Help is a wall of text**, with every hazard in the game (spoilers for a new
  player), the editor's manual and the privacy policy in it.
- **The first thing a new iPhone player sees is a permission overlay** over a
  dimmed level, and the first instruction is a sentence: "1-1 Lift-off. Hold the
  screen (or ↑) to burn, ← → to steer (no tilt sensor found). Finish on the green
  one." In headless desktop Chrome the tilt prompt came up too, with no sensor
  to allow.
- **The details are a browser's.** The system font, `confirm()` boxes, glyphs
  that draw differently on every phone (★ ◆ ❚❚ ▦ ☀ ☾), no movement between
  screens, and one SVG icon for the home screen.

The HUD and the editor's own screen (canvas, tools, sheets) work well and aren't
redesigned; they take on the new look and that's all.

## Core decisions

- **One look, taken from the game.** The cave's signature is the 45° cut that
  marching squares makes at every corner, with a lighter rim along the edge. So
  panels, buttons and level tiles have cut corners and a rim line, not rounded
  ones. Colours are the game's: the night blue behind, the flame's amber for what
  you press, and the current world's rim colour (`colors.rim`) as a tint, so the
  menus change as you go deeper.
- **A game's way round, not an app's.** The tab bar goes. The title leads to a
  menu; everything else is one step in, with a back button top left. The routes
  stay as URLs (`/`, `/levels`, `/play/3-2`, `/editor`, `/help`, `/profile`), so
  the browser's Back, the phone's back gesture and deep links all keep working.
- **The title screen is a cave.** Behind the title is the real 3D view: a small
  cave built for it, in the colours of the world you've reached, with the rocket
  standing on its pad. The camera drifts, and leans a little as you tilt the
  phone. It's the only menu screen with a 3D scene; the rest use CSS, so there's
  one WebGL context at a time and the menus cost nothing to open.
- **The level select is the way down.** One scroll from the surface to the
  Heart: each world is a band of its own rock, with its eight levels as stops
  along a tunnel. It opens at the world you're in. `PLAN.md` says each world has
  its colours "so you can see yourself getting deeper", and this is where you
  see it.
- **Dark first, and light stays.** The dark look is the game's, and the one the
  screens are designed in. The light one stays for sunlight, as a second set of
  the same tokens, so every screen is checked in both. The picker moves from the
  home page and pause into Settings.
- **Settings in one place.** One sheet, opened from the menu and from pause, has
  steering, sound (when phase 9 brings it), screen and the rest. Pause keeps only
  what you do mid-level.
- **Show, don't write.** What to do is a picture where it can be: a finger held
  down, a phone tilting, an arrow key. Every glyph becomes an SVG icon, so stars
  and crystals look the same on every phone.
- **Plain words, and nothing for developers.** Every string gets a pass. The
  test caves, the unlock note and the run-saving button show only with `?dev`;
  the frame rate display stays a setting, under *More*.
- **Landscape first, portrait works**, for the menus as well as the game. Every
  screen is laid out for 844 × 390 first and checked at 390 × 844 and on a
  desktop, inside the safe areas.
- **One display font, shipped with the game.** Titles, buttons and numbers get a
  face with some character; long text stays in the system font. It's a file in
  `public/fonts/`, never a request to another site: the game makes none today and
  the CSP (`default-src 'self'`) doesn't allow any.
- **Movement is short and can be switched off.** Screens fade and slide in
  150–250 ms, presses answer at once, stars pop. With the phone set to reduce
  motion, they just appear.
- **Still plain DOM and CSS.** No framework and no UI library. Menus are HTML
  over the canvas, with real links and buttons, focus you can see, labels for
  screen readers, and nothing told by colour alone.
- **Sound stays in phase 9.** This plan builds the Settings sheet it will put
  volume and mute in, and gives buttons one place (`onPress` in `ui/kit.js`) for
  phase 9 to hang a click and a buzz on.

## The screens

```
Title ─ tap ─► Menu ─┬─ Play            the next level to do, straight in
                     ├─ Levels          the way down ─ level card ─ play
                     ├─ Workshop        my levels ─ the editor
                     ├─ How to play
                     └─ Settings        a sheet: steering, sound, screen, pilot, more

Play ─┬─ Pause ─ Settings
      ├─ Map
      └─ Results ─ Next · Retry · Watch · Levels
```

**Title and menu** (`/`). The cave behind, the title in the display font, and
*Tap to start* the first time the app is opened in a session. On an iPhone that
tap is also the one that asks for the motion sensors, so the permission overlay
on the play page is only for someone who lands on a level directly. Then the
menu: a big *Play* naming the level (*Continue · 3-5 Chimney fire*), then Levels
with the star count, Workshop, How to play, and a gear. Held sideways, the title
is on the left and the menu on the right; upright, one above the other. A new
player's *Play* goes straight into 1-1.

**The way down** (`/levels`). Top to bottom: the night sky and the surface, then
a band per world. A band has the world's number and name in the display font,
its line of description, its stars, and its levels as eight stops joined by a
tunnel drawn with 45° bends: one row across a phone held sideways, two rows of
four upright. A stop shows its number and three star pips; the one to do next
glows and has the rocket on it; locked ones are dim with a lock. A locked world
shows its name and what opens it, and nothing else. A rule marks where part two
starts. Tapping a stop opens the **level card**: number and name, your best time
against par, the three stars and what each is for, *Watch best run* if one's
kept, and *Play*. The card is where E6's top times will go.

**Pause.** A panel in the middle with the level still showing, dimmed, behind
it. *Resume*, *Restart from pad*, *Restart level*, *Watch best run*, *Levels*;
and a row of icons: settings, autopilot, fullscreen. Two columns sideways, as
now.

**Settings** (a sheet, from the menu and from pause).
- *Steering:* the sensitivity slider, labelled *Gentle* to *Sharp*, with a small
  rocket that leans as you tilt, so you see what the slider does while you move
  it. With no tilt sensor, it shows the keys instead.
- *Sound:* volume and mute, when phase 9 adds them. Not shown until then.
- *Screen:* fullscreen, the theme (auto, light, dark), and the tip about adding
  the game to the home screen.
- *Pilot:* your name, leading to the profile.
- *More:* frame rate display, privacy, and the game's version.

**Results.** The title, then the three stars one after another with what each
was for, the time counting up to where it ended, *New best* when it is, par
under it, crystals and restarts. *Next* is the big button; Retry, Watch and
Levels are smaller, with icons. The last level of a world says the world's done;
6-8 and 10-8 keep their endings. E6's "4th of 57" line goes under the time.

**In flight.** At the start of a level its number and name come up large for two
seconds, with the world's name the first time you enter it. Until lift-off, a
picture shows the two controls for the device in hand. *Crashed*, *Out of fuel*
and the gate and laser countdowns stay as words, in the new look, with an icon.
While a big level builds, the title card is on black, then the cave fades in.
The HUD keeps its layout: the pill gets cut corners and the display font's
digits, and ◆ becomes an icon.

**How to play** (`/help`). A card per subject with a picture of the thing, drawn
by the code that draws the editor's tiles (`editor/tiles.js`). Controls,
landing, fuel and stars are there from the start; each world's hazards appear
when the world opens. *Tilt not working?* sits under Controls. The editor's
manual moves to a **?** in the Workshop, and privacy to its own page,
`/privacy`.

**Pilot** (`/profile`). Your name first, with the server's state as one quiet
line. *Move to another phone* opens to show the code and the box to paste one
into. *Your data* and *Forget me* are under *More*.

**Workshop** (`/editor`). My levels as cards with a small picture of each cave,
its size, and its finish time; *New level* is the big button; copying one of the
game's and importing are in a sheet behind **+**. Deleting asks in the game's
own dialog. Inside the editor, the bars and sheets take the new look and nothing
moves.

## The look

The dark values; the light theme has its own for each, from the palette it has
now.

| Token        | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| `--bg`       | `#0d1020`, the night blue, as now                             |
| `--panel`    | the same blue, lighter and 85% solid, over whatever's behind  |
| `--rim`      | a 1 px lighter line along a panel's top and left, like the rock's rim |
| `--accent`   | `#ffb347`, the flame: the one thing to press on each screen   |
| `--world`    | the current world's `colors.rim`: headings, the tunnel, glows |
| `--gold`     | `#f2b90c`, stars                                              |
| `--good`, `--bad` | as now: safe speed and the exit; damage and danger       |
| `--cut`      | the corner cut: 10 px on panels, 6 px on buttons and tiles    |

- **Shapes.** A cut corner is a `clip-path` polygon, with the rim drawn by a
  second layer 1 px inside it (a border doesn't survive clipping). One mixin for
  panels, buttons, tiles and the HUD pill.
- **Type.** The display font at three sizes (title, heading, button) and for
  numbers; the system font for anything longer than a line. The clock needs
  digits of one width: use the font's tabular figures if it has them, and set
  each digit in its own box if not (it hasn't, so they're in boxes). The font
  is **Chakra Petch** (its letters have the same cut corners; SIL Open Font
  Licence 1.1). Latin subset, `woff2`, two weights.
- **Buttons.** One primary per screen (amber, large), secondary ones in panel
  colour with the rim, icon buttons at 44 px as now, and switches for on/off
  (never a label that reads "…: off"). A press scales to 97% and brightens.
- **Icons.** The line icons in `ui/dom.js` stay, and gain: play, retry, home,
  gear, star, crystal, sound, phone-tilt, finger-hold, arrow keys, plus, trash,
  help, pilot.
- **Backgrounds.** Menu screens other than the title have the night blue with a
  faint rock texture, generated once to a canvas as `render/cave.js` does, and
  tinted by `--world`.

## Layout

New and changed files:

```
index.html           the tab bar goes; the font is preloaded
public/fonts/        the display font, woff2
public/icons/        192 and 512 px PNGs, a maskable one, apple-touch-icon
src/
  main.js            routes only: each page moves to its own file
  style.css          split, in style/: base.css (tokens, type), kit.css
                     (components), and a file per screen
  levels/title.js    the title screen's small cave
  render/backdrop.js the title's scene: createView on title.js, a drifting camera
  render/rock.js     the rock's texture, for the cave and behind the menus
  ui/
    kit.js           button, switch, slider, stars, icon: markup helpers;
                     `setDigits` for numbers that change, and `onPress` for a
                     button's feedback
    frame.js         a page's back button, heading and background
    sheet.js         sheets and dialogs: opening adds a history entry, so Back
                     closes them; Esc too; focus is kept inside and put back
    title.js         title and menu
    levels.js        the way down, and the level card
    summary.js       what the level select shows, from progress: each world's
                     stars and state, each level's, and where you are (no DOM)
    settings.js      the settings sheet
    help.js          how to play
    privacy.js       /privacy
    play.js          pause, results, the title card and the prompts
    profile.js       pilot
    kitpage.js       /ui, with ?dev: every component in every state
  editor/list.js     workshop
scripts/shots.js     npm run shots: every screen, sideways and upright, as PNGs
test/summary.test.js
```

## How each phase works

- It ends with a build to try on the phone and a short checklist, as the other
  plans' phases do.
- `npm run shots` is run before and after, and the pictures compared. It drives
  the Chrome that's installed, headless, over its debugging port, with no new
  dependency: it sets the screen to a phone's size, sideways and upright, in
  either theme, and it can press P or put the rocket on the exit pad (through
  `window.game`, which `?dev` gives), so pause, a crash and the results can be
  photographed with nothing added to the game for it.
- Logic that can be pulled out of the page gets a test (`ui/summary.js`); the
  rest is checked by eye.
- `npm test` and the build pass before a commit, and the sim's golden replays
  don't change.

## Phases

### Phase U1: The look ✅ (built; to check on the phones)
`scripts/shots.js` first, and a set of pictures of the game as it is, to compare
against. Then the tokens (dark and light), the font, the cut-corner mixin, the
kit (`ui/kit.js`, `kit.css`) and its page at `/ui`. `style.css` is split, and
every screen is moved onto the kit as it stands: same structure, new look. The
glyphs become icons. No screen changes what it does in this phase.

What was built: `npm run shots [-- label] [--theme=both] [--only=pause,kit]
[--scale=1]` pictures 16 screens sideways and upright into `shots/<label>/` (not
in git), in about a minute and a half a theme; `shots/before/` has the game as
it was. `style.css` became `style/base.css`, `kit.css`, `pages.css`,
`levels.css`, `play.css` and `editor.css`.

The cut corners are one rule in `kit.css` over a list of what gets them
(buttons, cards, panels, level tiles, the HUD's pill, the message, the menus'
sections, the editor's tiles and bars): a fill and an edge as two polygons
behind the content, the edge running from the rim's colour at the top left to
the line's. It's in `:where()`, so anything can override it. What can't have
`::before` (inputs) or scrolls (the editor's sheets) is clipped whole, with a
line inside its straight edges only. The pause menu's and the results' two
sections became panels with this, the one change to how a screen is laid out.
Keyboard focus is a glow that follows the cut, since an outline can't.

Chakra Petch 600 and 700 are in `public/fonts/` with its licence, 10 KB each,
preloaded. It has no tabular figures, so `setDigits` (in `ui/kit.js`) puts each
character of the clock and the speed in its own box, the digits' 0.66 em wide,
and touches only the ones that changed; the kit page measures four times and
says they're one width. `ui/kit.js` also has the icons (36, with star, crystal
and play filled), `stars`, `button`, `toggle`, `slider` and `onPress`, with
`test/kit.test.js`, which also checks that every icon asked for by name exists.

`--world` is the rim colour of the world of the next level to do, set on every
page change, and headings take it. Behind the pages is a glow of it from the
top, and rock: `render/rock.js` (the cave's texture, moved out of `cave.js`)
makes a see-through copy once, which masks a layer of the world's colour at 8%.
`/ui?dev` is the kit's page, in its own chunk: tap a world's number to see its
tint. The tab bar is still there, restyled, until U2.
- [ ] Every screen is in the new look, in both themes, and none still shows a rounded grey card.
- [ ] The font loads with no request to another site, and the clock's digits don't jiggle.
- [ ] Buttons answer a press at once, and the one to press on each screen is obvious.
- [ ] Stars, crystals and the pause icon look the same on an iPhone, an Android phone and a desktop.
- [ ] Nothing is harder to read than before, outdoors included.

### Phase U2: Title, menu and settings ✅ (built; to check on the phones)
`levels/title.js` and `render/backdrop.js`: the title's cave, coloured by the
world you're in, drawn at 30 frames a second and not at all while the page is
hidden. `ui/title.js`: *Tap to start* (asking for the motion sensors on an
iPhone), then the menu. The tab bar goes, and `ui/frame.js` gives every other
page its back button. `ui/sheet.js` and `ui/settings.js`: the settings sheet,
from the menu's gear and from pause, with the steering slider's leaning rocket.
The tilt prompt on the play page only comes up on a phone, and only if the
title's tap didn't settle it.

What was built: the title's cave is a level like any other, 36 × 22, never
flown: a chamber with the rocket on its pad and two crystals by it, a chimney
over it for a phone held upright, a tunnel to the right for one held sideways.
`createView` takes a *shot*, a camera of the caller's own (a point, where on
the screen to put it, how close, and how far to the side to look from), and the
backdrop gives it one that wanders a metre and leans up to three with the
phone's tilt. The rocket stands left of the menu sideways and between the name
and the menu upright. If the phone can't make a WebGL context, the menu is
there without the cave.

*Tap to start* shows the first time in a session, and again whenever an iPhone
still has to be asked for its sensors (it forgets when the page is loaded
again), so the play page's own prompt is only for a game opened at a level. The
menu is *Play* or *Continue* with the level under it, Levels with the stars,
Workshop, How to play, and the gear.

The settings sheet has Steering, Screen, Pilot and More. Steering's picture is
a phone that tilts as yours does inside the arc of tilt that steers, and the
rocket leaning as far as that makes it: the slider moves the arc's ends. Until
the phone's been heard from the picture rocks by itself; with nothing to tilt,
it's the keys. The frame rate display and fullscreen are switches. Opened from
pause, the sheet leaves out what leads to another page (the pilot, privacy), and
the level takes up a change as it's made. The version is the day of the build
and its commit. Pause keeps Autopilot and a Settings button in its second
panel until U4.

A sheet is a modal `<dialog>`, so the browser keeps the focus in it and puts it
back. Opening one adds an entry to the history, and Back, Esc, the cross and a
tap outside all close it; keys pressed in it don't reach the level under it.

So that Back leads out the way you came in, a link says what it does to the
history (`main.js`): nothing more than `data-link` adds the page; `"replace"`
puts it in this one's place (the next level); `"up"`, for the way out of a page
(a frame's back button, *Levels* in pause and the results, the editor's arrow),
steps back if that's where the page was come to from, and takes this page's
place if not. A page gone to from a sheet takes the sheet's entry. So from the
title, however many levels were played, Back at the levels is the title, and
Back at the title leaves the game.

`main.js` is the routes and that; Levels and How to play moved to `ui/levels.js`
and `ui/help.js` as they stood, in the frame, and the pages are headed
*Workshop*, *Pilot* and *How to play*. `test/title.test.js`, and the asking in
`test/controls.test.js`. `npm run shots` has the title, the menu and the
settings from both places, but hasn't been run: this phase was built on the
phone, which has no Chrome, and checked there with the pages run in node on a
stand-in DOM. The pictures, and the look of all of it, are still to do.
- [ ] Opening the game looks like a game before anything is tapped.
- [ ] A new player gets from the title into 1-1 in two taps, and is asked for the sensors once.
- [ ] Back, on the phone and in the browser, always goes where you'd expect, and closes a sheet first.
- [ ] Moving the sensitivity slider shows what it does, in the menu and mid-level.
- [ ] The title holds 60 fps on the phone, and stops drawing when you switch away.
- [ ] Sideways and upright both look laid out, not stretched.

### Phase U3: The way down ✅ (built; to check on the phones)
`ui/summary.js` with its test, then `ui/levels.js`: the bands, the tunnels and
stops, the rule at part two, opening at your world, and the level card on a
sheet. The world's description is its intro, on its band (this is the "intro on
the levels page" from `PLAN.md`'s phase 9, done here). The test caves and the
unlock note show only with `?dev`.

What was built: `summarize(progress)` (`ui/summary.js`) gives where you are, the
stars in all, and each world and level with its state, its stars, and for a
locked one the level that opens it. `ui/way.js` is the geometry, with a test
too: the stops stand a column apart, alternately high and low, so the tunnel
between two has a level stretch, a 45° slope and a level stretch; rows snake,
with a straight drop from one to the next; the tunnel comes in at the top over
the first stop and goes out at the bottom under the last.

The page is as wide as the screen. Under the night sky, with the heading and
the stars in all, each world is a band of its own rock (its `colors.face`,
darkened for the words; paled in the light theme), lit along the top with its
rim's colour, with the rock's texture over it. A band has the world's number
and name, its stars and its description, then the tunnel, a line drawn in SVG
in the cave's dark with the rim's colour along it, whose width stays the same
while the picture scales. The stops are buttons over it, placed by percentages,
so there's nothing to measure and nothing to do when the phone is turned:
sideways (600 px and wider) it's one row of eight and upright two rows of four,
both drawn, and the stylesheet shows one. Sideways, the worlds run left to
right and right to left by turns, so each one's way out is over the next one's
way in; upright, every world starts and ends on the left. The tunnel only runs
on into a world that's open, down through its heading (and the rule at part
two), so finishing a world's last level opens the way.

A stop has the level's number and three star pips, or a lock. The one to do
next has the flame's colour round it, a glow that pulses behind it, and the
rocket standing on it. A locked world is a thin, darker band: its name, and
*Finish 3-8 … to open it*. The page scrolls to the world you're in as it opens.

The level card is a sheet: the world, your best time (or *Not flown yet*) and
par, the three stars with what each is for and which are done, *Watch best
run* with its time if one's kept, and *Play*. A locked level's card says which
level opens it, in place of the buttons. `/play/3-2?watch` opens a level
watching its kept run, which is what *Watch best run* links to. The old tiles,
and the part headings, are gone; the kit's page shows a band.

Checked as U2 was, in node on a stand-in DOM (the page from a new player's and
from two worlds down, the card, playing and watching from it, `?dev`, and all
eighty open). `npm run shots` has the card as well, and still hasn't been run.
- [ ] You can see where you are and what's next without scrolling.
- [ ] Each world looks like its caves, and going down the list feels like going deeper.
- [ ] A locked level and a locked world say what opens them.
- [ ] The level card tells you what the three stars are for before you fly.
- [ ] All 80 stops scroll smoothly on the phone.

### Phase U4: In flight ✅ (built; to check on the phones)
The pause panel, with settings moved out to the sheet. The results, in sequence.
The level's title card, the pictures for the two controls, and the prompts in
the new look. The title card over black while a big level builds. The HUD's pill
and the map's frame in the new look.

`ui/play.js` now paints the title on black before creating the cave, then fades
in the view. The number and name stay for two seconds; a world's first entry
also names the world. Two SVG pictures show Tilt / Hold on phones and arrow
keys on desktop, until lift-off. Their card uses the camera's projection to
choose a corner away from the rocket, accounting for the HUD and safe areas;
it moves again when the screen turns. `ui/flight.js` keeps the positioning,
world introductions, completion headings and short pictured prompts together,
with tests. The map has its own cut-corner frame, heading and close button.

Pause is one panel: the level, mid-flight actions, Resume at the bottom, and
settings / autopilot / fullscreen as icons. Settings remains the U2 sheet and
keeps the game paused when it closes. Results reveal each star, count up the
time, then highlight a new fastest time. Next names the next level; Retry,
Watch and Levels have icons. World finales acknowledge the world, and 6-8 and
10-8 retain their endings. Reduced motion shows the final state immediately.
Pause, map and results keep keyboard focus inside their controls.

The main branch's star and iOS touch fixes are carried into this branch.
Results show the current run's stars with the saved best run underneath;
progress and the saved replay keep the run with the most stars, then the
faster one on a tie. Fastest time remains independent, and Workshop finishes
still choose the fastest run. Rapid taps suppress the native selection and
callout gestures while preserving thrust and multi-touch release.

Pictures before and after are in `shots/u4-before/` and `shots/u4-after/`: 48
final pictures at 844 × 390 and 390 × 844, in dark and light, reviewed against
the baseline.
`npm run shots` now waits for the cave to be ready and reports browser errors;
it includes current-versus-best results, both endings, 10-8 and out-of-fuel.
`--check-flight` exercises touch lift-off, pause/settings/map, star retention,
retry, replay and reduced motion in both themes and orientations. It also
checks desktop keys, focus (including held Tab) and cancelling a level before
its cave builds; those alone can be run with `--check-keys`. `--check-starts`
checks all 80 starts for rocket overlap in both orientations. All passed.
`npm test`: 312 pass, one PHP API check
skipped; the golden replays still land on their original ticks. `npm run build`
passes. Physical iPhone/Android checks remain:

- [ ] A new player lifts off in 1-1 without reading a sentence.
- [ ] Pause has nothing in it you wouldn't want mid-level, and Resume is under the thumb.
- [ ] Finishing a level feels like something: the stars land one at a time and a new best stands out.
- [ ] Opening 10-8 never shows a frozen or empty screen.
- [ ] Nothing new covers the rocket at the start of any level.

### Phase U5: How to play, pilot and workshop
`ui/help.js` with its pictures and the subjects that open with the worlds;
`/privacy`; the pilot page; the workshop's cards, its **+** sheet and its **?**;
the game's own dialog in place of `confirm()` (two places); the pages for a
level that's locked, missing or can't be flown. The editor's bars and sheets
take the kit's look.
- [ ] How to play on a new phone fits on two screens and spoils nothing.
- [ ] Setting a name takes one field and one button; the code is there when you look for it.
- [ ] The workshop shows your caves, not a form.
- [ ] The editor works exactly as before.

### Phase U6: Movement, the installed app, and tuning on the phone
Screens fade and slide (the View Transitions API where there is one, plain CSS
where there isn't), and stay still with reduced motion set. The home screen
icons, made from `icon.svg` by a script, and the manifest's colours. Then every
screen, on an iPhone and an Android phone, sideways and upright, installed and
in the browser: safe areas, thumbs, small text, sunlight. A last pass over every
string.
- [ ] Nothing jumps: every change of screen has a beginning and an end.
- [ ] Installed, it has a proper icon, opens fullscreen and never shows a white flash.
- [ ] Every button can be reached with a thumb holding the phone sideways.
- [ ] With reduced motion set, nothing slides or pops.
- [ ] Someone who hasn't seen it calls it a game, not a website.

## Settled before U1

- **The light theme stays**, as a second set of tokens. (The first draft dropped
  it.)
- **The font is Chakra Petch.**
- **The title has its own small cave**, not the level you're about to play: that
  would let *Play* just lift the menu away, but a big level takes a while to
  build before the title could show it.
- **The editor is the *Workshop* and the profile is the *Pilot*** in the menus.
  The URLs stay `/editor` and `/profile`.

## Later

- **Community** on the menu, when E5 opens: shared levels as cards, like the
  workshop's.
- **Top times** on the level card and the results (E6).
- **Attract mode:** the autopilot flying behind the title after a while.
- **Arrow keys and a gamepad** to move round the menus, with gamepad support in
  `PLAN.md`'s *Later*.
- **Other languages:** the strings pass in U6 leaves them easy to collect.
