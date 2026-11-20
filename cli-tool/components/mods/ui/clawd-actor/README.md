# clawd-actor

> Vendored from [BrianHuang813/clawd-actor](https://github.com/BrianHuang813/clawd-actor) (MIT, by Brian Huang). Install with `npx claude-code-templates@latest --mod ui/clawd-actor`, or from the author's marketplace as described below; only the marketplace install updates itself. Report issues and send changes upstream. Left out here: the GIFs (shown from upstream), the `tools/` that render them, and the marketplace manifest.

A Claude Code mod: while Claude works, **Clawd** walks onto a little stage above the prompt and
acts out what is going on: the spinner's `-ing` word (*Sautéing*, *Pondering*, *Herding*…), in
33 scenes with costumes and little friends. It also keeps your notes, todos and reminders, and
hands out badges.

![Clawd as a detective in a fedora, magnifying glass in hand, pondering under a thought bubble; calling out 閃身步 and flash-stepping across the stage and back; and as a homemaker in a curly perm and apron, cooking at a pot that stays put](https://raw.githubusercontent.com/BrianHuang813/clawd-actor/main/assets/demo.gif)

> **New in 0.8:** [the notebook](#the-notebook) and [badges](#badges). Ten badges still need a
> costume: [draw one and send it in](https://github.com/BrianHuang813/clawd-actor/blob/main/CONTRIBUTING.md#dress-clawd-for-a-badge).

- [Install](#install)
- [The show](#the-show)
- [Talk to Clawd](#talk-to-clawd)
- [The notebook](#the-notebook)
- [Badges](#badges)
- [Update](#update)
- [Contributing](#contributing)

## Install

```
/plugin marketplace add BrianHuang813/clawd-actor
/plugin install clawd-actor@clawd-actor
/reload-plugins
```

Or for one session from a clone: `claude --plugin-dir ./clawd-actor`.

Needs a Claude Code build with function-hook mods (developed on 2.1.296). Clawd shows in `claude`
in any terminal, in the Desktop app's Code tab and in the VS Code chat panel (drawn as an SVG
there). `claude -p` and cloud sessions draw no mod interface, so Clawd does not show there.

## The show

- **Acts out the spinner word**, matched by word stem, so *Flambéing* cooks and *Dilly-dallying*
  strolls. An unknown word, or a tool already running as the turn opens, picks the scene instead:
  `Bash` types, `Read`/`Grep` think, `Edit`/`Write` sketch, `Agent` herds sheep, and so on.
- **Changes scene every 15 seconds** on long turns, in an order shuffled per session, never the
  same one twice in a row.
- **Dresses for the part:** a detective's fedora for thinking, a homemaker's perm and apron for
  cooking, a wizard's hat, a cowboy hat, an astronaut's helmet, a clown's nose…
- **Wanders the stage**, swinging arms and legs; by a pot, an anvil or a blackboard it stays put
  and works. Little Clawds in blue, yellow, green and pink tag along, dance backup or hatch from
  an egg.
- **Leaves when the turn ends** and draws nothing while idle, unless you call it out with `/clawd`.

<details>
<summary>All 33 scenes and the words that pick them</summary>

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
| dance / disco | Vibing, Jitterbugging, Jamming / Boogieing, Grooving |
| juggle / honk | Juggling / Honking, Booping |
| sketch / weather / thunder | Sketching, Doodling / Misting, Billowing / Thundering |
| dig / flow | Burrowing, Spelunking / Flowing, Undulating |
| shift | Beaming, Shifting, Dodging |
| sixseven | Seesawing, Teetering, Weighing |
| kick / skate / campfire | no built-in word yet; they turn up in the rotation |

Tools: `Bash` types, `Read`/`Grep`/`Glob` think, `Edit`/`Write` sketch, `Agent` herds sheep,
`Web*` checks the weather, `TodoWrite`/`Skill` juggles, MCP tools cast spells, anything else is
hammered at the forge.
</details>

<details>
<summary>閃身步 (shift), the flash step</summary>

A martial-arts dodge so fast the eye catches only afterimages. Clawd calls the move first:

```
閃
身  ▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓  ▐▛███▛▌
步 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▝▜█████▙▖
     ▓▓ ▓▓   ▓▓ ▓▓
```

閃, 身, 步 appear one at a time, Clawd takes its stance, flashes across the stage in three frames
leaving afterimages that fade (▓ ▒ ░), lands sliding, then does it again the other way. It needs a
terminal font that draws CJK characters two columns wide, as nearly all do.
</details>

## Talk to Clawd

`/clawd` runs at once, even while Claude is working, and never interrupts the turn:

![Mid-turn, while Clawd cooks, typing /clawd how's it going? makes Clawd ponder and answer in a speech bubble; then /clawd pet sets hearts floating up, and /clawd shift sends Clawd flash-stepping across the stage and back](https://raw.githubusercontent.com/BrianHuang813/clawd-actor/main/assets/chat.gif)

| You type | Clawd |
| --- | --- |
| `/clawd pet` | purrs, with hearts floating up |
| `/clawd feed` | catches a cookie and munches it |
| `/clawd wave` (or `hi`, `hello`) | waves back |
| `/clawd dance` | dances under the disco ball |
| `/clawd shift` (or `閃身步`) | flash-steps across the stage |
| `/clawd 67` (or `sixseven`) | weighs it out, 6 in the raised left hand, 7 in the right |
| `/clawd <anything else>` | answers in a speech bubble |

A chat is one small Haiku call on your usage. The answer shows only in Clawd's bubble, in your
language: it is not written to the transcript, so Claude never sees it, and Clawd does not
remember earlier messages.

## The notebook

![/clawd todo saves a todo for later; /clawd plan has Clawd suggest two at the chalkboard and /clawd plan ok takes them on; /clawd remind 30m standup; /clawd done ticks one off with a dance; /clawd list shows the day; then the Marathon badge unlocks and Clawd runs by in a red headband and a 42 race bib](https://raw.githubusercontent.com/BrianHuang813/clawd-actor/main/assets/notebook.gif)

| Command | What it does |
| --- | --- |
| `/clawd note <text>` | jots a thought under today, with the time |
| `/clawd notes` | reads back today's notes |
| `/clawd todo <text>` | saves a todo for some day |
| `/clawd plan a; b; c` | puts todos on today's list |
| `/clawd plan` | Clawd suggests up to three of your waiting todos for today |
| `/clawd plan ok [1 3]` | takes the suggestions on (all, or the numbered ones) |
| `/clawd done [n]` | ticks off todo `n`, or the next one |
| `/clawd list` | today's list, reminders still to come, and the todos waiting |
| `/clawd remind 14:00 standup` | a reminder for later today (also `30m`, `1h30m`, `14：00`, `30分`) |

- **Reminders:** Clawd honks five minutes ahead and again when it is due, with a toast. They only
  work while Claude Code is open: they keep you on time while you code, they are not a calendar.
- **Suggestions** come from Haiku, which picks only among todos you wrote; when it does not
  answer, the oldest are offered.
- **Languages:** commands are English, what you write can be anything; Clawd answers in Chinese
  when it is about Chinese text, in English otherwise.

Everything goes to `~/.claude/clawd-notes.md`, a plain markdown file you can edit, or ask Claude
to plan your day from:

<details>
<summary>What the file looks like</summary>

```markdown
# Inbox

## Todo
- [ ] look into automating the restack
- [x] reply to PM → 11-14

# 2026-11-14

## Notes
- 10:32 ask PM about the field definitions

## Todo
- [x] write the tests
- [ ] reply to PM

## Reminders
- [ ] 14:00 standup
```
</details>

## Badges

| Badge | How |
| --- | --- |
| Hello there | say anything to Clawd |
| Best friends | pet Clawd 100 times |
| Cookie monster | feed Clawd 50 cookies |
| Scribe | write 20 notes |
| Finisher | tick off 50 todos |
| Clean slate | finish all of a day's todos, 3 or more |
| On time | set 10 reminders |
| Marathon | a 10-minute turn: Clawd runs in a red headband and a 42 race bib from then on |
| Busy bee | 50 turns in a day |
| Regular | 7 days in a row |
| Night owl | a turn between midnight and 4 a.m. |

Clawd cheers each one as you earn it; `/clawd badges` shows your shelf and the closest one to go.
Badges count across all your projects. Only Marathon has a costume so far:
[add one for another badge](https://github.com/BrianHuang813/clawd-actor/blob/main/CONTRIBUTING.md#dress-clawd-for-a-badge).

## Update

Claude Code shows a notice when a newer version is out. Run `/clawd-actor:update` (or ask Claude
to update clawd-actor), then `/reload-plugins`. A clone updates with `git pull`.

## Contributing

Bug reports, ideas and new scenes or costumes are welcome: [CONTRIBUTING.md](https://github.com/BrianHuang813/clawd-actor/blob/main/CONTRIBUTING.md)
covers running Clawd from a clone, testing, regenerating the GIFs and sending a pull request.

<details>
<summary>How it works, and other band mods</summary>

- `ui.render` on `Spinner` only observes: it remembers the word and mode and lets the engine draw
  the spinner as usual. `tool.call` notes the tool in flight.
- One timer, started in `session.start`, advances a frame counter in `$.state` every 140 ms while
  a turn runs; the `AbovePrompt` band reads it and redraws.
- `/clawd` is registered `immediate`, so it runs mid-turn; it returns no text, only a reaction the
  band plays. Chats call `$.model.complete` from a one-shot timer, so the prompt never waits.
- `hooks/scenes.ts` is pure: the grid, the scenes and costumes, and `frameRows()`. `hooks/chat.ts`,
  `hooks/notes.ts` and `hooks/badges.ts` hold the chat, the notebook and the badges.
- The band always calls `next(e)` and stacks what the mods beneath draw under the stage, so other
  band mods keep showing. A band mod that answers without calling `next(e)` hides everything
  beneath it: if Clawd never shows up, look for one.
</details>

Clawd is Claude Code's mascot; the sprite follows the one on Claude Code's welcome screen. This is
a fan-made mod, not affiliated with or endorsed by Anthropic.
