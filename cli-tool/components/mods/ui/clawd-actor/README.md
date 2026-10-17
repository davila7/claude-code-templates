# clawd-actor

> Vendored from [BrianHuang813/clawd-actor](https://github.com/BrianHuang813/clawd-actor) (MIT, by Brian Huang). Install with `npx claude-code-templates@latest --mod ui/clawd-actor`, or from the author's marketplace as described below; only the marketplace install updates itself. Report issues and send changes upstream. Left out here: the GIFs (shown from upstream), the `tools/` that render them, and the marketplace manifest.

A Claude Code mod: while Claude works, **Clawd** walks onto a little stage above the prompt and
acts out what is going on — the spinner's `-ing` word (*Sautéing*, *Pondering*, *Herding*…) —
then puts on a show of 31 scenes, a new one every 15 seconds, with little Clawds along for the ride.

![Clawd watching a baby Clawd hatch, dancing under a disco ball with a little pink Clawd, walking with two little ones in a row, and cooking at a pot that stays put](https://raw.githubusercontent.com/BrianHuang813/clawd-actor/main/assets/demo.gif)

*Four scenes at the real frame rate, about 15 s in all (a real turn changes scene every 15 s). Every frame is the mod's own output, rendered by `tools/`.*

## What it does

- **Acts out the spinner word.** 31 scenes, matched by word stem, so *Flambéing* cooks and
  *Dilly-dallying* strolls. A word it does not know falls back to what the turn is doing
  (typing for tool use, talking while responding, thinking otherwise).
- **Acts out the running tool** when one is already running as a turn opens; it picks the
  opening scene instead of the word: `Bash` types, `Read`/`Grep`/`Glob` think, `Edit`/`Write` sketch, `Agent` herds sheep,
  `Web*` checks the weather, `TodoWrite`/`Skill` juggles, MCP tools cast spells, anything else is
  hammered at the forge.
- **Changes scene every 15 seconds** on long turns, whatever tools run, in an order shuffled per
  session that picks up where the last turn stopped, never the same scene twice in a row. A scene
  is picked when its act begins and holds for the whole act; nothing cuts it short.
- **Wanders the stage.** When all it carries is a thought bubble, notes or sparks, Clawd strolls
  left and right, swinging arms and legs, hopping at each turn and landing with a squash. By a pot,
  an oven, an anvil or a plant it stays put and works; the stage follows the terminal width (up to
  60 columns). At the blackboard the board stays put and Clawd steps back to admire its work. By the
  campfire it sits still with a purple friend, and only the fire and their eyes move. Under the
  disco ball it dances in place while the floor flashes.
- **Brings little friends.** Small Clawds in blue, yellow, green and pink tag along: one copies
  its idle hop a beat late, two dance backup, one dances under the disco ball, two walk in a row
  behind it (and lead the way back), two sit by the campfire when the stage is wide enough, and
  one hatches from the egg, stands in its shell and hops out to say hello.
- **Has a face.** Happy ^ ^ eyes, blinks, glances around, and sways so its far side falls into
  shadow, after the official Clawd animation; on the move it looks where it is going.
- **Talks back.** `/clawd` pets, feeds or waves at Clawd, or chats with it, even mid-turn (see
  below).
- **Leaves when the turn ends**, and draws nothing while idle (the frame timer only redraws
  during a turn), unless you call it out with `/clawd`.

| Scene | Spinner words (some of them) |
| --- | --- |
| think | Pondering, Musing, Clauding, Noodling, Ruminating |
| chalk | Deciphering, Elucidating, Philosophising, Deliberating, Reasoning |
| cook / bake / brew | Sautéing, Simmering, Whisking / Baking, Kneading / Brewing, Percolating |
| walk / run / moonwalk | Moseying, Wandering / Scampering, Galloping / Moonwalking |
| herd | Herding, Wrangling, Mustering |
| spin | Spinning, Churning, Reticulating, Combobulating |
| magic / levitate | Conjuring, Manifesting, Transmuting / Levitating, Hyperspacing |
| hatch / grow | Hatching, Incubating / Sprouting, Germinating |
| forge / compute | Forging, Crafting, Creating / Computing, Crunching, Synthesizing |
| dance / disco | Vibing, Jitterbugging, Jamming / Boogieing, Grooving — under a spinning mirror ball |
| juggle / honk | Juggling / Honking, Booping |
| sketch / weather / thunder | Sketching, Doodling / Misting, Billowing / Thundering |
| dig / flow | Burrowing, Spelunking / Flowing, Undulating |
| kick / skate / campfire | Kicking, Dribbling / Skating, Gliding / Kindling, Smoldering — no built-in word matches these yet, so they mostly turn up in the rotation |

## Talk to Clawd

`/clawd` runs at once, even while Claude is working, and never interrupts the turn:

![Mid-turn, while Clawd cooks, typing /clawd how's it going? makes Clawd ponder and answer in a speech bubble; then /clawd pet sets hearts floating up](https://raw.githubusercontent.com/BrianHuang813/clawd-actor/main/assets/chat.gif)

*Clawd's answer here is an example; in a session it comes from Haiku.*

| You type | Clawd |
| --- | --- |
| `/clawd pet` | purrs, with hearts floating up |
| `/clawd feed` | catches a cookie and munches it |
| `/clawd wave` (or `hi`, `hello`) | waves back |
| `/clawd dance` | dances under the disco ball |
| `/clawd <anything else>` | answers in a speech bubble |

Actions are free and instant. Anything else is a chat: Clawd ponders for a moment, then answers in
a sentence or two, in your language, knowing what Claude is up to right now. The answer comes from
Haiku (one small `haiku` call per message, on your usage) and shows only in Clawd's bubble: it is
not written to the transcript, so Claude's own conversation never sees it. Each message stands
alone; Clawd does not remember earlier ones. Between turns Clawd steps out for the reaction and
leaves again after it.

## Install

Requires a Claude Code build with function-hook mods (`claude plugin validate` knows `hooks.json`
`modules`). Developed and tested on Claude Code 2.1.296.

Clawd shows in `claude` in any terminal (including an editor's terminal and the JetBrains plugin)
and in the Code tab of the Desktop app. The VS Code chat panel, `claude -p` and cloud sessions draw
no mod interface, so Clawd does not show there.

From this repository as a marketplace:

```
/plugin marketplace add BrianHuang813/clawd-actor
/plugin install clawd-actor@clawd-actor
/reload-plugins
```

Or straight from a clone, for one session:

```sh
git clone https://github.com/BrianHuang813/clawd-actor
claude --plugin-dir ./clawd-actor
```

## Update

When a newer version is out, a notice says so a couple of seconds after Claude Code starts: the
mod compares its own version with the one on `main` once a session (one small request to GitHub;
nothing is shown when offline or up to date).

Run `/clawd-actor:update`, or just ask Claude to update clawd-actor. Either way Claude refreshes
this marketplace and updates the plugin with Claude Code's own plugin manager, tells you the
version it went from and to and sums up what is new, and `/reload-plugins` loads it. However it
was updated, the first session on a new version says so in a notice, with the release's headline
and a link to the release notes. By hand, the same is:

```sh
claude plugin marketplace update clawd-actor
claude plugin update clawd-actor@clawd-actor
```

A clone run with `--plugin-dir` updates with `git pull`.

## Plays well with other band mods

The stage is drawn in the `AbovePrompt` band. The hook always calls `next(e)` and stacks what the
mods beneath it draw under the stage, so other band mods keep showing. It hands them the band's
rows less the ones the stage and bubble take, so together they still fit without scrolling, and
when the band is too short for the stage Clawd stays out. A band mod that answers
without calling `next(e)` hides everything beneath it — if Clawd never shows up, look for one.

## How it works

- `ui.render` on `Spinner` only *observes*: it remembers the word and mode and lets the engine draw
  the spinner as usual.
- `tool.call` notes the tool in flight and forgets it when the call returns.
- `/clawd` is registered `immediate`, so it runs mid-turn. Its `command.run` hook returns no text
  (nothing for the transcript or the model); it sets a reaction the band plays over the show. A
  chat calls `$.model.complete` from a one-shot timer, so the prompt never waits on the model.
  `hooks/chat.ts` holds the parsing, Clawd's persona and the speech bubble.
- One timer, started in `session.start`, advances a frame counter in `$.state` every 140 ms while a
  turn runs; the band reads it, which subscribes it to redraws. A timer started inside a
  `turn.start` hook does not outlive that dispatch, which is why it lives in `session.start`.
- Whether to draw at all follows the band's own `isWorking` prop.
- `hooks/scenes.ts` is pure: a 4-row grid of cells, a scene per name, `sceneAt()` choosing an
  act's scene, `hold()` keeping it for the whole act, and `frameRows()` turning the grid into
  coloured runs.
- The update notice: `session.start` sets a one-shot timer that, two seconds later, reads the
  version in the installed `plugin.json`, fetches the one on `main`, and toasts when `main`'s is
  newer. `skills/update/SKILL.md` is the `/clawd-actor:update` skill that runs the update.

## Contributing

Bug reports, ideas and new scenes are welcome.

**Found a bug or have an idea?** [Open an issue](https://github.com/BrianHuang813/clawd-actor/issues):
say what you saw and what you expected, with your Claude Code version and terminal. A screenshot
helps with anything drawn wrong.

**Want to change something?** Send a pull request:

1. Fork the repository, clone your fork and make a branch for the change.
2. Run Clawd from your clone. If you have the marketplace version installed, turn it off while you
   work, as two plugins of the same name cannot load together:

   ```sh
   claude plugin disable clawd-actor@clawd-actor   # enable it again when you are done
   claude --plugin-dir .
   ```

3. Check the change; both must pass:

   ```sh
   claude plugin validate .
   claude plugin test .
   ```

4. If the change shows in one of the GIFs, regenerate it (see below).
5. Open a pull request against `main`. Say what changes on stage; a GIF or a few frames help.
   Leave `version` in `.claude-plugin/plugin.json` alone: it is bumped when a release goes out.

**Adding a scene:** write it as a function in `scenes` in `hooks/scenes.ts`, give it spinner-word
stems in `VERBS`, and add a word that picks it to `PROBE` in `tests/scenes.test.ts`. The tests then
check it on its own.

### What the tests check

That every scene keeps the stage size at 30, 40 and 60 columns and moves Clawd about only in the
scenes without set pieces (the rest are checked to stay put), that no prop is ever drawn over
Clawd's face, that a turn opens on the running tool or the spinner word and then rotates through
every other scene whatever tools run, picking up where the last turn stopped, that a scene holds
for its whole act, that the timer animates Clawd during a turn and lets go after it, that `/clawd`
plays its reactions between turns and shows Haiku's answer (or a fallback) in a bubble that fits
any script (combining marks included), that only the latest `/clawd` gets its answer shown, that
the mods beneath get the rows Clawd leaves them, that the update notice shows only when `main` carries a newer version, and that the
first session after an update says what is new, once.

Block characters and symbols are drawn one cell wide; a terminal font that draws some of them
wider may shift a frame.

### Regenerating the GIFs

With Node 22+ and Python with Pillow:

```sh
node tools/frames.ts > frames.json      # the frames, straight from hooks/scenes.ts
python tools/render.py frames.json assets/demo.gif
node tools/chat-frames.ts > chat.json   # a mid-turn /clawd chat, with hooks/chat.ts's bubble
python tools/render.py chat.json assets/chat.gif
```

`tools/render.py` uses DejaVu Sans Mono and draws block elements as exact rectangles; edit the
font path at its top for your system.

### Releasing (maintainers)

1. Bump `version` in `.claude-plugin/plugin.json` in the commit that ships the change.
   `claude plugin update` and the update notice go by that number alone, so code merged without a
   bump never reaches anyone (a change to docs alone needs none).
2. Merge or push it to `main`.
3. Tag the commit and publish its release notes; tags and releases are the changelog, updates do
   not read them:

   ```sh
   git tag -a v0.6.0 -m "clawd-actor 0.6.0" && git push origin v0.6.0
   gh release create v0.6.0 --title "clawd-actor 0.6.0 — …" --notes "…"
   ```

## Notes

Clawd is Claude Code's mascot; the sprite follows the one on Claude Code's welcome screen. This is
a fan-made mod, not affiliated with or endorsed by Anthropic.
