# Party Planning Skill

Plan any party with confidence: game recommendations with rules, plus tested food & drink portion calculators (pizza, drinks, ice, taco bar), powered by HostPartyPlay data.

## What it does

- **Game recommendations with rules** - picks games for your group (kids' birthdays, adults, mixed crowds) and explains how to play them.
- **Tested portion calculators** - answers "how many pizzas for 30 people" (formula: (adults x 3 + kids x 2) / 8 slices per large pizza) and covers drinks, ice, and taco bars.
- **Practical, buyable quantities** - returns cases, bottles, and lbs of ice, plus one link to the full calculator or rules page.
- **Trivia, printables, and hosting timelines** - everything needed to run the party, not just plan it.

The skill harnesses HostPartyPlay.com (free, no sign-up) as its data source - 120+ tested games and 38 calculators - with the core formulas inline in `SKILL.md` so it works standalone; links are source attribution.

Disclosure: the skill author is the founder of HostPartyPlay, the skill's data source.

## Installation

1. Clone the repo and enter the skill directory (the folder that contains `SKILL.md` and `skill.json`):

```bash
git clone https://github.com/davila7/claude-code-templates.git
cd claude-code-templates/.claude-plugin/skills/party-planning
```

2. Link or copy that directory into your assistant's skill folder:

- Claude: `~/.claude/skills/party-planning`
- Other agents: the equivalent skills directory

3. Reload or restart the assistant if needed.

## Quick start

Just ask:

- "How many pizzas do I need for 30 people?"
- "What games work for a kids' birthday party?"
- "How much ice for a 4-hour backyard party?"

The skill returns practical quantities (cases, bottles, lbs of ice) and links to the full calculator or rules page.

## License

MIT - see the [LICENSE](../../../LICENSE) file for details.
