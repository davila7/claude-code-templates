---
name: website-from-template
allowed-tools: Bash(curl:*), Bash(mkdir:*), Bash(ls:*), Read, Edit, Write, Glob, Grep
argument-hint: "<business type, e.g. bakery, yoga studio, app launch>"
description: Start a one-page website from a free MIT single-file HTML template that matches a business type, then fill it with the owner's real details only
---

# Website From Template

Start a website for: **$ARGUMENTS**

## Current Folder

- Files here: !`ls -A`
- Existing index.html: !`ls index.html 2>/dev/null || echo "none"`

## Task

Adapt one of the free single-file HTML templates published at https://8b.com/templates/ into a site for the business described above. Each template is one `index.html` (CSS and GSAP animation inline, no build step) shipped with an `AGENTS.md` of editing rules, under the MIT license. Work on downloaded files, never on a summary of a web page.

If no business type was given, ask the user what the business is and who the site is for before doing anything else.

### 1. Match a design

- Run `curl -s https://8b.com/templates/llms.txt`. Under "Templates", each line describes one design, the kind of business it was written for, and its slug (the file name in the link, before `.md`).
- Compare those lines with the business type. Offer one design, or two when both are close, in one sentence each, with its preview page `https://8b.com/templates/<slug>/`. Wait for the user to choose.
- If nothing on the list is close, tell the user, point to the nearest design and do not force one to fit (a florist layout will not suit a dental practice).

### 2. Download into the project

- Run `curl -s https://8b.com/templates/<slug>.json`. In it, `get.curl` is a list of download lines (index.html, AGENTS.md, LICENSE, CREDITS.md) and `get.agent_prompt` is the editing plan written for that design.
- Choose the target folder: use the current folder only when none of `index.html`, `AGENTS.md`, `LICENSE` or `CREDITS.md` already exists there. Otherwise create a new, unused subfolder such as `site/`; never reuse an existing folder or overwrite a file without the user's explicit permission.
- Before each `get.curl` line, check that its destination does not exist yet; if it does, stop and ask the user. After downloading, confirm the four files are there.

### 3. Read the rules of this file

- Read `AGENTS.md` in full before changing `index.html`. It lists which selectors and attributes the animation code relies on, which elements carry `data-8b-placeholder`, and which details must come from the business owner.
- Use `get.agent_prompt` as the order of work: what to change first, what to drop without real material.

### 4. Collect real facts

- Ask the user in a single message for what the page needs: business name, what they offer, address or service area, hours, prices, phone, email, social links, plus anything AGENTS.md lists as owner-only.
- Use only what the user provides. Do not make up prices, hours, addresses, staff names, reviews, awards, certifications or contact details. When an answer is missing, leave that part as it is and note it for the final list.

### 5. Edit

- Replace text, links and images in `index.html`; change colours through the custom properties in `:root`.
- Keep the page as a single file and keep its layout and motion. Do not rename or remove anything AGENTS.md marks as required by the animation code.
- Where the design repeats items (team cards, plans, menu rows) and the user has fewer, delete the extras instead of padding them.
- Drop the `data-8b-placeholder` attribute wherever real content has replaced the sample.
- Keep `LICENSE`, `CREDITS.md` (photo credits) and the footer credit link with the site, as AGENTS.md describes; remove the link only if the user asks for that.

### 6. Check and hand over

- Suggest a local preview (for example `npx serve .` or `python -m http.server` in the target folder) and ask the user to scroll the whole page at desktop and phone width and look at the browser console.
- End with a list, section by section, of everything that is still demo content: copy, prices, quotes, photos of people, links. Point out that forms need a real handler (Formspree, Netlify Forms or the user's own backend) before launch.

## Examples

- `/website-from-template neighbourhood bakery with online orders`
- `/website-from-template landing page for a habit tracking app`
- `/website-from-template small architecture office`
