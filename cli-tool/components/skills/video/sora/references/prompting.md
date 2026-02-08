# Prompting best practices (Sora)

## Contents
- [Mindset & tradeoffs](#mindset--tradeoffs)
- [API-controlled params](#api-controlled-params)
- [Structure](#structure)
- [Specificity](#specificity)
- [Style & visual cues](#style--visual-cues)
- [Camera & composition](#camera--composition)
- [Motion & timing](#motion--timing)
- [Lighting & palette](#lighting--palette)
- [Character continuity](#character-continuity)
- [Multi-shot prompts](#multi-shot-prompts)
- [Ultra-detailed briefs](#ultra-detailed-briefs)
- [Image input](#image-input)
- [Constraints & invariants](#constraints--invariants)
- [Text, dialogue & audio](#text-dialogue--audio)
- [Avoiding artifacts](#avoiding-artifacts)
- [Remixing](#remixing)
- [Iterate deliberately](#iterate-deliberately)

## Mindset & tradeoffs
- Treat the prompt like a cinematography brief, not a contract.
- The same prompt can yield different results; rerun for variants.
- Short prompts give more creative freedom; longer prompts give more control.
- Shorter clips tend to follow instructions better; consider stitching two 4s clips instead of a single 8s if precision matters.

## API-controlled params
- Model, size, and seconds are controlled by API params, not prose.
- Put desired duration in the `seconds` param; the prompt cannot make a clip longer.

## Structure
- Use short labeled lines; omit sections that do not matter.
- Keep one main subject and one main action.
- Put timing in beats or counts if it matters.
- If you prefer a prose-first template, use:
```
<Prose scene description in plain language. Describe subject, setting, time of day, and key visual details.>

Cinematography:
Camera shot: <framing + angle>
Mood: <tone>

Actions:
- <clear action beat>
- <clear action beat>

Dialogue:
<short lines if needed>
```

## Specificity
- Name the subject and materials (metal, fabric, glass).
- Use camera language (lens, angle, shot type) for stability.
- Describe the environment with time of day and atmosphere.

## Style & visual cues
- Set style early (e.g., "1970s film", "IMAX-scale", "16mm black-and-white").
- Use visible nouns and verbs, not vague adjectives.
- Weak: "A beautiful street at night."
- Strong: "Wet asphalt, zebra crosswalk, neon signs reflecting in puddles."

## Camera & composition
- Prefer one camera move: dolly, orbit, lateral slide, or locked-off.
- Straight-on framing is best for UI and text.
- For close-ups, use longer lenses (85mm+); for wide scenes, 24-35mm.
- Depth of field is a strong lever: shallow for subject isolation, deep for context.
- Example framings: wide establishing, medium close-up, aerial wide, low angle.
- Example camera motions: slow tilt, gentle handheld drift, smooth lateral slide.

## Motion & timing
- Use short beats: "0-2s", "2-4s", "4-6s".
- Keep actions sequential, not simultaneous.
- For 4s clips, limit to 1-2 beats.
- Describe actions as counts or steps when possible (e.g., "takes four steps, pauses, turns in the final second").

## Lighting & palette
- Describe light quality and direction (soft window light, hard rim, backlight).
- Name 3-5 palette anchors to stabilize color across shots.
- If continuity matters, keep lighting logic consistent across clips.

## Character continuity
- Keep character descriptors consistent across shots; reuse phrasing.
- Avoid mixing competing traits that can shift identity or pose.

## Multi-shot prompts
- You can describe multiple shots in one prompt, but keep each shot block distinct.
- For each shot, specify one camera setup, one action, one lighting recipe.
- Treat each shot as a creative unit you can later edit or stitch.

## Ultra-detailed briefs
- Use when you need a specific, filmic look or strict continuity.
- Call out format/look, lensing/filters, grade/palette, lighting direction, texture, and sound.
- If needed, include a short shot list with timing beats.

## Image input
- Use an input image to lock composition, character design, or set dressing.
- The input image should match the target size and be jpg/png/webp.
- The image anchors the first frame; the prompt describes what happens next.
- If you lack a reference, generate one first and pass it as `input_reference`.

## Constraints & invariants
- State what must not change: "same shot", "same framing", "keep background".
- Repeat invariants in every remix to reduce drift.

## Text, dialogue & audio
- Keep text short and specific; quote exact strings.
- Specify placement and avoid motion blur.
- For dialogue, use a dedicated block and keep lines short.
- Label speakers consistently for multi-character scenes.
- If silent, you can still add a small ambient sound cue to set rhythm.
- Sora can generate audio; include an `Audio:` line and a short dialogue block when needed.
- As a rule of thumb, 4s clips fit 1-2 short lines; 8s clips can handle a few more.

Example:
```
Audio: soft ambient café noise, clear warm voiceover
Dialogue:
<dialogue>
- Speaker: "Let's get started."
</dialogue>
```

## Avoiding artifacts
- Avoid multiple actions in 4-8 seconds.
- Keep camera motion smooth and limited.
- Add explicit negatives when needed: "avoid flicker", "avoid jitter", "no fast motion".

## Remixing
- Change one thing at a time: palette, lighting, or action.
- Keep camera and subject consistent unless the change requests otherwise.
- If a shot misfires, simplify: freeze the camera, reduce action, clear background, then add complexity back in.

## Iterate deliberately
- Start simple, then add one constraint per iteration.
- If results look chaotic, reduce motion and simplify the scene.
- When a result is close, pin it as a reference and describe only the tweak.
