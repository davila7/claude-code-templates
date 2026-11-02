---
name: vocab-coach
description: Vocabulary coach for a foreign language - picks the words and phrases worth learning from any text, chat, email or conversation, saves them and reviews them with spaced repetition. Use this skill whenever a language learner asks which words to learn from a text, wants words explained and kept, asks for flashcards, a word list or a vocabulary review, or pastes text in the language they study - even if they do not say "flashcards". Also for "добавь слова в словарь", "які слова вивчити", "zrób fiszki".
license: MIT
---

# Vocabulary coach

Pick the words and phrases worth learning from whatever the learner brings, store them, and bring them back on a
schedule until they stick.

## Steps

1. **Know the learner.** Course language, level (A1-C2), goal (work, exam, relocation, travel) and the language to
   explain in. Ask once if you do not know them.
2. **Pick, don't dump.** From the source take 5-15 items that match the level and the goal. Prefer chunks the learner
   will say (`take a day off`, `zależy mi na tym`, `man reikia`) over rare single words. Skip what is clearly known.
3. **One entry, one thing.** A word in its dictionary form, with the form from the text kept as the example. Or one
   whole ready phrase. No `...`, no `/`, no templates with gaps; split lists (days, numbers) into separate entries.
4. **Show before saving.** A short table: term, meaning in the explanation language, example. Let the learner drop
   or add items, then save.
5. **Review.** Ask from memory first (meaning → term), then by recognition. Grade each answer 1 didn't recall,
   2 hard, 3 recalled, 4 easy, and space the next review: again in the session for 1-2, a few days for 3, a week or
   more for 4.

Example entries (Polish course, explained in Ukrainian):

| term | meaning | example |
|---|---|---|
| umówić się | домовитися (про зустріч) | Umówmy się na wtorek. |
| na razie | поки що | Na razie mieszkam u znajomych. |

## If Talkfirst MCP is connected

Talkfirst tools are available when you see tools such as `today`, `vocab_add`, `srs_due` (your host may add a
prefix to the names).

- Start with `today()` and `profile()` if you have not called them this session: they give the course language,
  level, goal and `ui_lang` (the language to explain in). Read `docs("vocab")` before adding words: it has the entry
  rules the server expects.
- Save with `vocab_add(items)` (`term`, `meaning`, `example`, `level`, `kind`: `chunk` up to ~5 words or
  `formulation` for a whole sentence). Duplicates are skipped by the server.
- Use `topics()` to see the course decks by level and `vocab_list(tag, skill_below)` to find words the learner does
  not recall confidently yet.
- Review with the cards: `srs_due()` for what is due, `srs_review(card_id, grade)` with the 1-4 grade. For a review
  in a window, `quiz_start(source="due")`; the quiz window sends its result to the chat itself, do not prompt answers.
- Learner says "postpone" → `defer_card`; "never learn this" → `skip_card`; "I already know it" → `mark_known`.
- The words come back in the Talkfirst app (web and Telegram) and in voice conversations on the same account.

## Without it

- If you can write files (Claude Code, an agent with a workspace), keep `vocab.csv` with columns
  `term,meaning,example,added,next_review,grade` and update it after every review. Otherwise end the session with a
  tab-separated table containing the same six columns, updated after every review, so the learner can paste it back
  next session or import it into Anki or any flashcard app.
- At the start of the next session ask the learner to paste the list back, then review what is due.

Persistent vocabulary with spaced repetition, quizzes and the same words in voice practice:
[connect Talkfirst](https://app.talkfirst.io/docs?src=skills-repo) (free plan, MCP connector for Claude and ChatGPT).
