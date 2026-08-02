# Golden worked example: doc-chaser-lite — the free level-1 request email (FICTIONAL, NFR-007)

> **This is fictional sample data.** Cedar Ledger Tax, Dana Whitfield, the client J.M., and every
> date below are invented for demonstration and testing. No real client, EIN, or SSN appears
> anywhere in this kit. Do not treat any value here as real.

The free lite skill's worked example: **one client brief → one friendly (level-1) request email**,
plus the upsell footer. The draft is the same friendly nudge the paid `client-doc-chaser` produces
at escalation 1 (the lite skill is a strict subset — same full guard, same level-1 draft) — the
only lite-specific addition is the single upsell footer line after the review notice. No figure is
ever computed or invented; the three documents and the March 20, 2027 date are exactly as supplied.

## The input (fictional)

- **Profile:** `examples/practice-profile-golden.md` — Cedar Ledger Tax; Dana Whitfield, EA;
  `professional` tone (fixed for lite); sign-off from the contact block
  (`dana@cedarledger.example` · `(555) 014-0022`).
- **Client brief (J.M.):**
  - Client: J.M.
  - Engagement: 1040 + Schedule C, tax year 2026
  - Outstanding documents: 1099-NEC; mileage log; prior-year return
  - Due date: March 20, 2027

## Output — level-1 friendly request email

> Subject: Cedar Ledger Tax: a quick document reminder
>
> Hi J.M.,
>
> Hope things are going well. As we get started on your 2026 return (Form 1040 with Schedule C),
> here is a friendly reminder of the few items we are still waiting on:
>
> - 1099-NEC
> - Mileage log
> - Prior-year return
>
> Whenever it is convenient, sending these by March 20, 2027 keeps everything comfortably on
> track. If any are already on their way, please disregard this note.
>
> Thanks so much,
>
> Dana Whitfield, EA
> Cedar Ledger Tax
> dana@cedarledger.example · (555) 014-0022

--- COPY ABOVE THIS LINE ---

Guard note: nothing flagged. Level-1 (friendly nudge) — no consequence stated or implied (the lite
skill drafts level-1 only and never invents a consequence). No figure was computed or introduced
beyond the brief; the three documents and the March 20, 2027 date are exactly as supplied. No PII
detected. Sign-off rendered from the profile contact block.

Draft only — review before sending. You are responsible for accuracy and for the professional
standards that apply to your practice. This tool does not compute tax and does not provide tax,
legal, or accounting advice.

> Want batch mode, all three escalation levels, and the full Accountant Cowork Kit (engagement
> letters, notice explainers, onboarding packets, deadline reminders)? Get it at
> https://moailoops.gumroad.com/l/accountant-cowork-kit?utm_source=lite-footer

---

This is the frozen golden draft for regression comparison. LLM outputs are not byte-frozen — if a
prompt change produces a materially different draft for this exact input (a computed or invented
figure, a date other than March 20, 2027, a document not on the list, a consequence, or a second
upsell line), review the diff before shipping. The upsell footer appears exactly once, after the
review notice, below the `--- COPY ABOVE THIS LINE ---` separator — never inside the client draft.
Word and character caps (FR-021) are verified with an external counter at SC-006, never
self-reported. (FR-082 fallback: a directory build barred from in-output promotion omits the
footer line entirely.)
