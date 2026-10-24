# Example: Thinking Method Selector

Illustrative case. All details are invented.

**User:** "We have to decide by Friday whether to move our auth to a hosted provider or keep our own. I keep going back and forth. Help me think this through."

**Restate:** the user must pick between two concrete options (hosted auth vs own auth) by Friday.

**Choose:** `tradeoff-analysis`. It fits because there are two real options and a deadline. `pre-mortem` is the nearest alternative, but it tests one chosen plan, so it comes after a choice exists.

**Run:** (the selector then follows the tradeoff-analysis steps, or its fallback outline if that skill is not installed.)

**Options:** A hosted provider, B keep own auth. **Must-haves:** passwords never leave the agreed regions; no downtime during migration.
**Criteria and weights:** security and compliance (35), cost over 3 years (25), time to migrate (20), control and customization (20).
*(Scoring table follows in the same format as the tradeoff-analysis skill.)*

**Offer:** once an option is picked, a pre-mortem on the migration plan would show what could fail before the cutover.
