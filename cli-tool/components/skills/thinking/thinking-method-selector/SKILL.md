---
name: thinking-method-selector
description: >
  Use when the user describes a problem, decision or stuck situation but names no method: "how should I approach this?", "help me think this through", "we can't decide", "where do I start?". Picks the best-fit thinking method and runs it. Skip for plain execution tasks or when a method is named.
license: MIT
metadata:
  author: ysskrishna
  version: "2026.10.5"
---

# Thinking Method Selector

Match the user's situation to one thinking method, say why, and run it. Pick by what the user must **decide or produce next**, not by keywords.

## When to use

- The user is stuck, torn or overwhelmed and has not said how they want to think about it.
- A problem is stated loosely and several methods could apply.
- The user asks "which framework should I use?".

Skip: execution tasks (write, fix, build), plain factual questions, or any request that already names a method (use that method).

## How to run

1. **Restate** the situation in one line, including the decision or output the user needs next.
2. **Gather first.** If you can read the repo, docs or data that frame the problem, do it before choosing. Ask **at most one** question, only if two methods fit equally and the answer would change the pick.
3. **Choose** one method from the table below. Say in one sentence why it fits and why the nearest alternative does not.
4. **Run it.** If the named skill is installed, follow its instructions. If it is not, use the matching outline under "Fallback outlines" and say which method you are using.
5. **Offer** at most one follow-on method (for example "after the pre-mortem, a tradeoff analysis would settle which option").

## Situation to method

| The user needs to... | Method | Core move |
|----------------------|--------|-----------|
| Pick among concrete options | `tradeoff-analysis` | Weighted criteria, sensitivity, reversibility |
| Order a long list with limited capacity | `prioritization` | RICE, ICE, MoSCoW, cut line |
| Find why something failed or keeps recurring | `five-whys` | Evidence-backed chain to a fixable cause |
| Check a plan before committing | `pre-mortem` | Assume failure, list causes, mitigate |
| Test whether a claim or plan holds up | `critical-thinking` | Assumptions, evidence, logic gaps |
| Explain a number or break a question into drivers | `analytical-thinking` | Tree, hypotheses, evidence |
| Get a rough number fast | `fermi-estimation` | Factors, ranges, cross-check |
| Assess where a team, product or company stands | `swot-analysis` | S, W, O, T plus TOWS actions |
| Choose a direction under constraints | `strategic-thinking` | Intent, options, bets, risks |
| See side effects and why a problem recurs across parts | `systems-thinking` | Loops, delays, leverage points |
| Question an inherited default or a copied approach | `first-principles-thinking` | Strip analogies, rebuild from fundamentals |
| Understand user needs before designing | `design-thinking` | Empathize, define, ideate, test plan |
| Generate many options | `creative-thinking` | Diverge, connect, harvest |
| Break out when ideas feel incremental | `lateral-thinking` | Provocation, principle, concept fan |
| Judge whether a plan is fair or could harm people | `ethical-thinking` | Stakeholders, harms, power, consent |
| See one issue from separate angles in sequence | `six-thinking-hats` | Facts, feelings, risks, benefits, ideas |

When two fit, prefer the one that matches the decision the user must make next: options to pick from means a tradeoff analysis; a plan to commit to means a pre-mortem; a past failure means five whys.

## Fallback outlines

Use these only when the matching skill is not installed. Keep each to the steps shown.

- **tradeoff-analysis:** list options (include do nothing), screen must-haves, 3-7 independent criteria with weights, score with a basis, test what flips the winner, check how hard it is to reverse, recommend and say what would change it.
- **prioritization:** state the goal and capacity, choose RICE (Reach x Impact x Confidence / Effort) or MoSCoW, score with bases, rank, draw the cut line, name what is not done.
- **five-whys:** write an observable problem; ask why of each previous answer; mark each `verified` or `hypothesis`; stop at a cause the team can change; add contain, fix, prevent actions.
- **pre-mortem:** assume the plan failed; list specific causes across people, process, tech, market; rank by likelihood and impact; add prevent, detect or respond actions with owners; set tripwires.
- **critical-thinking:** restate the claim; list evidence as cited or missing; list assumptions with "if false"; trace the logic for gaps and bias; give alternatives; conclude with strength and what would change it.
- **analytical-thinking:** frame the question and baseline; build a driver tree; rank hypotheses with falsifiers; map evidence; answer with the key uncertainty and next data.
- **fermi-estimation:** write the formula; give low and high with a basis for each factor; combine; cross-check a second way; name the dominant factor.
- **swot-analysis:** define subject and scope; sort items by the internal / external test with evidence; keep the top ones; pair cells into actions; name next steps.
- **strategic-thinking:** define the win and non-goals; read the landscape; test for advantage; compare 2-4 options with bet, cost, kill signal; choose; list risks and a review trigger.
- **systems-thinking:** set the boundary; list stocks and flows; find reinforcing and balancing loops; note delays; pick leverage points and their backfire risk.
- **first-principles-thinking:** state the convention; question each assumption; keep only what is fundamental; rebuild from it; compare with the conventional path.
- **design-thinking:** describe users, jobs and pains from real input; write a point of view and how-might-we questions; ideate; sketch low-fidelity prototypes; plan a test that can fail.
- **creative-thinking:** set the brief; generate many ideas using different triggers; combine pairs; pick three with reasons; list a next step.
- **lateral-thinking:** write a provocation; extract a usable principle; step back to broader directions and fan out to concepts and ideas; tag candidates.
- **ethical-thinking:** list who is affected; name value tensions; weigh harms and benefits with plausibility; check who bears cost and who can say no; give options with safeguards and the strongest objection.
- **six-thinking-hats:** run facts, feelings, risks, benefits, new ideas as separate passes; close with the main tension, a recommendation and a next step.

## Pitfalls

- Choosing by keywords. "Why" can mean five whys, analytical thinking or systems thinking; match the next decision, not the word.
- Running two methods at once. Run one, then offer the next.
- Interrogating the user. One question at most, then proceed.
- Claiming a skill is loaded when it is not. Say which outline you are following.

Worked example: [references/example.md](references/example.md).

## Checklist

- [ ] Situation restated with the decision or output needed next
- [ ] One method chosen, with the reason and why the nearest alternative does not fit
- [ ] Method run (skill if installed, otherwise the fallback outline), not just named
- [ ] At most one question asked and at most one follow-on offered
