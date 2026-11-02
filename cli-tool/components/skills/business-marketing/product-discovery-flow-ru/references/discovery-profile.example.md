# Discovery Profile — Larkfield (example)

> **This is a worked example on a made-up company**, deliberately far from any one industry, so
> you can see what "filled in well" looks like. Copy `discovery-profile.template.md`, not this file.
>
> Notice two things: (1) several sources are honestly marked `not configured` — the flow still
> runs, it just records those as data gaps; (2) section 5 anchors the Job levels to *this*
> product, which is what makes Core / Big / Small mean anything.

---

## 1. Company and product — *required*

- **Company:** Larkfield Software Ltd.
- **Product:** Larkfield Rota
- **What the product does, in one sentence (for whom, what outcome):** Scheduling and shift-swap
  software for independent veterinary clinics with 4–30 staff, so the practice manager can staff
  every shift without spending their evenings on a spreadsheet and a phone.
- **Category / market it competes in:** Vertical workforce scheduling for small healthcare practices.
- **Business model and pricing:** SaaS, per-clinic monthly subscription, £49 / £99 / £189 tiers by
  headcount. Annual discount 20%. No usage fees. 14-day trial, no card.
- **Markets and languages you sell in:** UK and Ireland (English). First non-UK pilots in the
  Netherlands, English UI.
- **Stage:** growth — 410 paying clinics, £61k MRR, growing ~4% MoM.

## 2. Strategic narrative

Independent clinics lose staff to burnout faster than they lose them to pay. The rota is where the
burnout becomes visible first: one person holds the whole schedule in their head, changes arrive by
text message at 22:00, and nobody can see how unevenly the weekend load is distributed until
someone quits. Generic scheduling tools solve the grid and ignore the profession — they do not know
about on-call rotations, RCVS-registered vs. lay staff, or the fact that a single locum cancellation
breaks the day. Larkfield bets that the under-served buyer is the practice manager, who has full
responsibility for staffing and zero authority to hire, and who therefore needs the rota to defend
itself rather than to be prettier.

**What we do better than the alternatives:**
- Shift swaps settle between staff without the manager approving each one, but never break a
  qualification requirement.
- Fairness view — weekend and on-call load per person over any window, which is the number
  managers actually get argued with about.
- Works when a locum agency sends a name 40 minutes before the shift.

**Known gaps and weaknesses (be honest — this improves the research):**
- No payroll export. Managers re-key hours into their payroll tool monthly.
- Mobile app is a wrapped web view and is visibly slower than competitors' native apps.
- Nothing for multi-site groups — the moment a customer acquires a second clinic they outgrow us.

## 3. Target segments — *required*

| Segment | Priority | Core Jobs they perform | Notes |
|---|---|---|---|
| Practice manager, single-site clinic, 4–12 staff | primary | *I want to fill every shift for the coming fortnight without chasing people individually* | Buys and uses. Success criteria, in their order: no unstaffed shift → no argument about fairness → time spent < 1h/week. Price is fourth. |
| Practice manager, single-site clinic, 13–30 staff | primary | *I want to prove the rota is fair when a vet challenges it* | Same Core Job, different criteria order — fairness first. Longer sales cycle, higher retention. |
| Clinic owner / partner (buyer, not user) | secondary | *I want to stop losing staff to rota resentment* | Signs the invoice, logs in twice a year. Needs a different message than the manager. |
| Locum vets (participant, not customer) | secondary | *I want to pick up shifts that fit my week without phoning round* | Not billed. Their adoption drives the manager's value — watch the Critical Chain here. |

**Legacy / historical segments** — mention separately in reports, never merge with the primary ones:
- Equine and farm practices (first 40 customers, 2022–2023). Different shift shape entirely
  (call-outs, not sessions). Still paying, deliberately not developed for.

## 4. Competitors and adjacent solutions

| Name | Type | Notes |
|---|---|---|
| Deputy | direct | Generic, strong mobile, no veterinary awareness. Cheaper at low headcount. |
| RotaCloud | direct | UK, generic SMB, strong payroll exports — our main loss reason. |
| Provet Cloud | adjacent | Practice management suite with a weak rota module bundled in. Displacement risk. |
| WhatsApp group + Excel | in-house-DIY | The real incumbent. Free, already installed, and everyone knows how to use it. |
| Locum agency portals | substitute | Solve staffing gaps by selling people, not software. |

**Brand names that must never be translated or localised:**
- Larkfield Rota, Deputy, RotaCloud, Provet Cloud, RCVS

## 5. Job Graph anchor

- **Core Job** — the topmost Job the product performs **fully**: *I want to publish a fortnight's
  rota that is fully staffed and defensible.*
- **Big Job** — one level above Core; the product contributes but does not perform it fully:
  *I want to keep the clinic fully staffed without losing people to burnout.*
- **Small Jobs** — **siblings** of the Core Job that the product does **not** perform:
  *I want to pay staff correctly for what they worked* (payroll — currently manual re-keying);
  *I want to find a locum when nobody in-house can cover* (agency phone calls);
  *I want to track holiday entitlement* (done in a separate HR tool).

## 6. Data sources

| Source | Status | Where / how to reach it | Notes |
|---|---|---|---|
| Research archive — past discovery reports | configured | Notion, "Product / Discovery" space | 2023 onward; earlier work is in Google Docs and not indexed |
| Product knowledge base / help docs | configured | https://help.larkfield.example/kb | Public, crawlable |
| Internal product or engineering wiki | configured | Notion, "Engineering" space | Roadmap and tech constraints live here |
| Subscription and revenue metrics | configured | ChartMogul | MRR, churn, cohorts, ARPA |
| CRM — deals, win/loss, pipeline | configured | HubSpot | Loss reasons are filled in reliably from Jan 2025 only |
| Team chat — customer feedback, support | configured | Slack: `#customer-feedback`, `#support-escalations`, `#churn-saves` | `#general` is noise, skip it |
| Community chat / forum / subreddit | not configured | — | We have none. Closest public signal is r/VetTech and the VetSurgeon forum — treat as external research, not as our community. |
| Product analytics — usage, funnels | configured | Metabase, `product_events` database | Ask for a query, do not assume table names |
| Support tickets | configured | Intercom | Conversation tags are inconsistent before mid-2025 |
| Other | not configured | — | |

**Methodology canon on disk** (optional; the AJTBD Canon Validator reads it if present):
- Path: `~/Next-Move-Theory-Canon-and-Skills/Next-Move-Theory-Canon/`

## 7. Where reports are published

- **Destination:** Notion, under the "Product / Discovery" space.
- **Page title convention:** `Discovery — <topic> — <YYYY-MM-DD>`
- **Primary language:** English
- **Also translate into:** none

## 8. Who reads the reports

- **Primary readers and their roles:** CEO (decides what gets funded), Head of Product (decides what
  gets built), one designer, and the Head of Customer Success (checks it against what she hears).
- **Technical depth expected:** non-technical exec — the CEO is a former practice owner, not an engineer.
- **Tone:** direct, no hedging, name the risk. Say "we don't know" rather than filling the gap.
