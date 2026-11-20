---
name: needle
description: |
  Needle is an outbound engine for AI agents: leads, campaigns, LinkedIn,
  Instagram, places, suppressions, and compose. One API key unlocks the REST
  API and the MCP server. Use when an agent needs to source leads, run
  outreach, integrate Needle into an app, or obtain an API key.
metadata:
  version: 1.0.0
  author: Needle
  tags: [Sales, Outreach, Leads, LinkedIn, Instagram, Email, MCP]
  repo: https://github.com/needle-ai/needle-mcp
---

# Needle

Needle helps agents search people and places, build lead lists, run multi-channel campaigns on LinkedIn and Instagram, keep suppressions, preview messages, and send from connected accounts.

The same outbound engine is available as a REST API and as MCP tools. One API key unlocks both. Listing MCP tools does not require a key; calling tools and REST endpoints does.

## Before anything destructive

Before any delete, withdraw, archive, stop or remove action (MCP tool or REST call), show the user exactly what will be removed or stopped and wait for an explicit yes. Never run these in bulk without that confirmation.

## Get started

No install. Get an API key, then pick a path.

- **Dashboard / API key**: https://needle.app/settings/api-keys
- **Sign up**: https://needle.app/login
- **MCP**: `https://needle.app/mcp/v1`
- **REST**: `https://needle.app/api/v1`
- **OpenAPI**: https://needle.app/api/v1/openapi
- **Docs**: https://needle.app/docs/introduction
- **Full index**: https://needle.app/llms-full.txt

This skill is the routing layer. After you know the path, use the API Reference or MCP catalog for schemas.

## Get credentials

Needle users create an API key in the dashboard:

- Open https://needle.app/settings/api-keys
- Create a key. It looks like `sk-ndl-…`.
- Each key is bound to one user and one workspace.

If they do not have an account yet, send them to Path D.

Sending, following, and inviting require a connected LinkedIn or Instagram account. Connecting an account is dashboard-only at `/accounts`. The API and MCP can list, update, and delete connected accounts; they cannot start the OAuth connect flow.

**Already have `NEEDLE_API_KEY`?** Skip credential setup. Pick a path below.

## Choose your path

All paths use the same API key. The difference is what you do next.

- **Need outbound during this session** → Path A (MCP tools)
- **Need to add Needle to app code** → Path B (REST in the product)
- **Need a finished outbound workflow** → Path C (source, campaign, or one-off send)
- **Need more than one of the above** → do them in sequence; one key covers everything
- **Need an account or API key** → Path D
- **Do not want to connect MCP** → Path E (REST directly)

| Path | Question it answers | Where the work runs |
| --- | --- | --- |
| A | Which Needle tool should I call right now? | In the agent session, over MCP |
| B | How do I add a Needle API call to this codebase? | Inside the user's product code |
| C | What is the finished outbound workflow? | In the agent session, producing a result |
| D | How does the human get a key? | Dashboard |
| E | How do I call Needle over HTTP? | REST at `/api/v1` |

## Path A: Live MCP tools

Use this when you need outbound during your work: searching people, building leads, running campaigns, sending LinkedIn or Instagram messages, or checking suppressions.

Connect at `https://needle.app/mcp/v1`. Apps sign in with OAuth, with a published app identity (a client metadata document, such as Claude, Codex and ChatGPT) or by registering themselves (RFC 7591, such as Cursor and OpenCode): on first connect they open a Needle page in the browser; the user signs in and clicks Allow, and the app stays connected until the user disconnects it under Settings. An API key from https://needle.app/settings/api-keys works instead of signing in. Per-app steps: https://needle.app/docs/mcp/introduction#setup. Listing tools at `https://needle.app/mcp/v1/tools` requires no sign-in; calling them does.

Works with Claude Code, Cowork, Codex, Cursor, Hermes, or any MCP client.

Route by job:

- **Who am I bound to?** → `needleGetMe`
- **Find a record you already have** → `needleSearchLeads`, `needleSearchCampaigns`, `needleSearchEnrollments`, `needleSearchConnectedAccounts`, or `needleSearchSuppressions`
- **What can I send from?** → `needleListConnectedAccounts`
- **Find people** → `needleSearchLinkedinPeopleClassic` or `needleSearchLinkedinPeopleSalesNavigator`, then `needleGetLinkedinProfile`
- **Find companies and jobs** → `needleSearchLinkedinCompaniesClassic`, `needleGetLinkedinCompany`, `needleListLinkedinCompanyJobs`, or `needleSearchLinkedinJobs` (searches all of LinkedIn unless you pass `companies`; resolve location, industry and title ids with `needleListLinkedinSearchParameters`). Read the full description and hiring team of one job with `needleGetLinkedinJob` (takes a job id or job URL)
- **Read LinkedIn posts** → `needleSearchLinkedinPosts`, `needleListLinkedinPosts`, `needleGetLinkedinPost`, `needleListLinkedinPostComments`
- **Engage on a post** → `needleCommentOnLinkedinPost` or `needleReactToLinkedinPost`
- **Read the LinkedIn inbox** → `needleListLinkedinConversations`, then `needleListLinkedinConversationMessages`
- **Answer inbound requests** → `needleListLinkedinReceivedInvitations`, then `needleRespondToLinkedinInvitation`
- **Find locations** → `needleSearchPlaces`, then `needleGetPlace`
- **Build a list** → `needleCreateLeads` / `needleUpsertLead` / `needleCreateLead` / `needleListLeads`
- **Do not contact** → `needleCheckSuppressions` / `needleCreateSuppressions`
- **Preview copy** → `needleComposePreview` before any send
- **One-off LinkedIn** → `needleSendLinkedinInvitation`, `needleSendLinkedinMessage`, or `needleSendLinkedinInMail`. Attach a file with `needleCreateFileUpload` first (upload bytes, or copy a public file with `sourceUrl`), or reuse one from `needleListFiles`.
- **One-off Instagram** → `needleFollowInstagramUser` or `needleSendInstagramMessage`
- **Campaign** → `needleCreateCampaign`, `needleEnrollCampaignLeads`, `needleListDrafts`

Default flow for live outbound:

1. `needleGetMe` to confirm the user and workspace.
2. `needleListConnectedAccounts` before any send. If none are connected, send the human to `/accounts`.
3. Search people or places, then create leads.
4. `needleCheckSuppressions` before outreach.
5. `needleComposePreview` when the message is generated.
6. Enroll in a campaign, or send a one-off invitation/message.
7. Watch `needleGetCampaignStats` / `needleSearchEvents` after a campaign is live.

If the task becomes "wire Needle into product code," switch to Path B.

### MCP tools

**Me**

- [`needleGetMe`](https://needle.app/docs/mcp/needle-get-me): Get the authenticated user

**Connected accounts**

- [`needleListConnectedAccounts`](https://needle.app/docs/mcp/needle-list-connected-accounts): List connected accounts
- [`needleSearchConnectedAccounts`](https://needle.app/docs/mcp/needle-search-connected-accounts): Search connected accounts
- [`needleGetConnectedAccount`](https://needle.app/docs/mcp/needle-get-connected-account): Get a connected account
- [`needleUpdateConnectedAccount`](https://needle.app/docs/mcp/needle-update-connected-account): Update a connected account
- [`needleDeleteConnectedAccount`](https://needle.app/docs/mcp/needle-delete-connected-account): Delete a connected account
- [`needleListConnectedAccountLimits`](https://needle.app/docs/mcp/needle-list-connected-account-limits): List connected account limits
- [`needleUpdateConnectedAccountLimit`](https://needle.app/docs/mcp/needle-update-connected-account-limit): Override a connected account limit
- [`needleResetConnectedAccountLimit`](https://needle.app/docs/mcp/needle-reset-connected-account-limit): Reset a connected account limit
- [`needleListConnectedAccountEvents`](https://needle.app/docs/mcp/needle-list-connected-account-events): List connected account events
- [`needleListConnectedAccountTasks`](https://needle.app/docs/mcp/needle-list-connected-account-tasks): List connected account tasks

**Leads**

- [`needleListLeads`](https://needle.app/docs/mcp/needle-list-leads): List leads
- [`needleListLeadProperties`](https://needle.app/docs/mcp/needle-list-lead-properties): List lead properties
- [`needleUpdateLeadProperty`](https://needle.app/docs/mcp/needle-update-lead-property): Update a lead property
- [`needleSearchLeads`](https://needle.app/docs/mcp/needle-search-leads): Search leads
- [`needleCreateLead`](https://needle.app/docs/mcp/needle-create-lead): Create a lead
- [`needleUpsertLead`](https://needle.app/docs/mcp/needle-upsert-lead): Create or update a lead
- [`needleCreateLeads`](https://needle.app/docs/mcp/needle-create-leads): Create leads in bulk
- [`needleGetLead`](https://needle.app/docs/mcp/needle-get-lead): Get a lead
- [`needleUpdateLead`](https://needle.app/docs/mcp/needle-update-lead): Update a lead
- [`needleUpdateLeads`](https://needle.app/docs/mcp/needle-update-leads): Update leads in bulk
- [`needleDeleteLead`](https://needle.app/docs/mcp/needle-delete-lead): Delete a lead
- [`needleDeleteLeads`](https://needle.app/docs/mcp/needle-delete-leads): Delete leads in bulk
- [`needleListLeadEvents`](https://needle.app/docs/mcp/needle-list-lead-events): List lead events
- [`needleListLeadTasks`](https://needle.app/docs/mcp/needle-list-lead-tasks): List lead tasks

**Campaigns**

- [`needleListCampaigns`](https://needle.app/docs/mcp/needle-list-campaigns): List campaigns
- [`needleSearchCampaigns`](https://needle.app/docs/mcp/needle-search-campaigns): Search campaigns
- [`needleSearchEnrollments`](https://needle.app/docs/mcp/needle-search-enrollments): Search enrollments
- [`needleCreateCampaign`](https://needle.app/docs/mcp/needle-create-campaign): Create a campaign
- [`needleGetCampaign`](https://needle.app/docs/mcp/needle-get-campaign): Get a campaign
- [`needleUpdateCampaign`](https://needle.app/docs/mcp/needle-update-campaign): Update a campaign
- [`needleArchiveCampaign`](https://needle.app/docs/mcp/needle-archive-campaign): Archive a campaign
- [`needleGetCampaignStats`](https://needle.app/docs/mcp/needle-get-campaign-stats): Get campaign stats
- [`needleListCampaignEvents`](https://needle.app/docs/mcp/needle-list-campaign-events): List campaign events
- [`needleListCampaignTasks`](https://needle.app/docs/mcp/needle-list-campaign-tasks): List campaign tasks
- [`needleListCampaignLeads`](https://needle.app/docs/mcp/needle-list-campaign-leads): List campaign leads
- [`needleEnrollCampaignLeads`](https://needle.app/docs/mcp/needle-enroll-campaign-leads): Enroll leads
- [`needleRemoveCampaignLead`](https://needle.app/docs/mcp/needle-remove-campaign-lead): Stop a lead in a campaign
- [`needleStopCampaignLeads`](https://needle.app/docs/mcp/needle-stop-campaign-leads): Stop leads in a campaign in bulk

**Drafts**

- [`needleListDrafts`](https://needle.app/docs/mcp/needle-list-drafts): List drafts
- [`needleCreateDraft`](https://needle.app/docs/mcp/needle-create-draft): Create a draft
- [`needleGetDraft`](https://needle.app/docs/mcp/needle-get-draft): Get a draft
- [`needleWithdrawDraft`](https://needle.app/docs/mcp/needle-withdraw-draft): Withdraw a draft

**Events**

- [`needleSearchEvents`](https://needle.app/docs/mcp/needle-search-events): Search events

**LinkedIn**

- [`needleGetLinkedinProfile`](https://needle.app/docs/mcp/needle-get-linkedin-profile): Get a LinkedIn profile
- [`needleSearchLinkedinPeople`](https://needle.app/docs/mcp/needle-search-linkedin-people): Search LinkedIn people
- [`needleSearchLinkedinPeopleClassic`](https://needle.app/docs/mcp/needle-search-linkedin-people-classic): Search LinkedIn people (Classic)
- [`needleSearchLinkedinPeopleSalesNavigator`](https://needle.app/docs/mcp/needle-search-linkedin-people-sales-navigator): Search LinkedIn people (Sales Navigator)
- [`needleSendLinkedinMessage`](https://needle.app/docs/mcp/needle-send-linkedin-message): Send a LinkedIn message
- [`needleSendLinkedinInMail`](https://needle.app/docs/mcp/needle-send-linkedin-in-mail): Send a Sales Navigator InMail
- [`needleGetLinkedinInMailBalance`](https://needle.app/docs/mcp/needle-get-linkedin-in-mail-balance): Get remaining InMail credits
- [`needleListLinkedinConversations`](https://needle.app/docs/mcp/needle-list-linkedin-conversations): List conversations
- [`needleListLinkedinConversationMessages`](https://needle.app/docs/mcp/needle-list-linkedin-conversation-messages): List messages in a conversation
- [`needleListLinkedinInvitations`](https://needle.app/docs/mcp/needle-list-linkedin-invitations): List pending invitations
- [`needleSendLinkedinInvitation`](https://needle.app/docs/mcp/needle-send-linkedin-invitation): Send a connection invitation
- [`needleWithdrawLinkedinInvitation`](https://needle.app/docs/mcp/needle-withdraw-linkedin-invitation): Withdraw an invitation
- [`needleListLinkedinReceivedInvitations`](https://needle.app/docs/mcp/needle-list-linkedin-received-invitations): List invitations sent to you
- [`needleRespondToLinkedinInvitation`](https://needle.app/docs/mcp/needle-respond-to-linkedin-invitation): Accept or decline a received invitation
- [`needleListLinkedinFollowers`](https://needle.app/docs/mcp/needle-list-linkedin-followers): List followers
- [`needleListLinkedinFollowing`](https://needle.app/docs/mcp/needle-list-linkedin-following): List accounts this account follows
- [`needleListLinkedinRelations`](https://needle.app/docs/mcp/needle-list-linkedin-relations): List first-degree connections
- [`needleGetLinkedinCompany`](https://needle.app/docs/mcp/needle-get-linkedin-company): Get a LinkedIn company
- [`needleListLinkedinCompanyJobs`](https://needle.app/docs/mcp/needle-list-linkedin-company-jobs): List jobs posted by a company
- [`needleListLinkedinCompanyPosts`](https://needle.app/docs/mcp/needle-list-linkedin-company-posts): List posts from a company page
- [`needleSearchLinkedinJobs`](https://needle.app/docs/mcp/needle-search-linkedin-jobs): Search LinkedIn jobs
- [`needleGetLinkedinJob`](https://needle.app/docs/mcp/needle-get-linkedin-job): Get a LinkedIn job
- [`needleSearchLinkedinCompaniesClassic`](https://needle.app/docs/mcp/needle-search-linkedin-companies-classic): Search LinkedIn companies (Classic)
- [`needleSearchLinkedinPosts`](https://needle.app/docs/mcp/needle-search-linkedin-posts): Search LinkedIn posts
- [`needleListLinkedinPosts`](https://needle.app/docs/mcp/needle-list-linkedin-posts): List posts by a person or company
- [`needleGetLinkedinPost`](https://needle.app/docs/mcp/needle-get-linkedin-post): Get a LinkedIn post
- [`needleListLinkedinPostComments`](https://needle.app/docs/mcp/needle-list-linkedin-post-comments): List comments on a post
- [`needleListLinkedinPostReactions`](https://needle.app/docs/mcp/needle-list-linkedin-post-reactions): List reactions on a post
- [`needleCommentOnLinkedinPost`](https://needle.app/docs/mcp/needle-comment-on-linkedin-post): Comment on a post
- [`needleReactToLinkedinPost`](https://needle.app/docs/mcp/needle-react-to-linkedin-post): React to a post
- [`needleListLinkedinSearchParameters`](https://needle.app/docs/mcp/needle-list-linkedin-search-parameters): List LinkedIn search parameters

**Instagram**

- [`needleGetInstagramProfile`](https://needle.app/docs/mcp/needle-get-instagram-profile): Get an Instagram profile
- [`needleGetInstagramAccountProfile`](https://needle.app/docs/mcp/needle-get-instagram-account-profile): Get the connected account profile
- [`needleSendInstagramMessage`](https://needle.app/docs/mcp/needle-send-instagram-message): Send an Instagram message
- [`needleReactToInstagramMessage`](https://needle.app/docs/mcp/needle-react-to-instagram-message): React to an Instagram message
- [`needleListInstagramConversations`](https://needle.app/docs/mcp/needle-list-instagram-conversations): List Instagram conversations
- [`needleListInstagramConversationMessages`](https://needle.app/docs/mcp/needle-list-instagram-conversation-messages): List messages in a conversation
- [`needleListInstagramConversationParticipants`](https://needle.app/docs/mcp/needle-list-instagram-conversation-participants): List the participants of a conversation
- [`needleListInstagramPosts`](https://needle.app/docs/mcp/needle-list-instagram-posts): List the posts of an account
- [`needleGetInstagramPost`](https://needle.app/docs/mcp/needle-get-instagram-post): Get an Instagram post
- [`needleCreateInstagramPost`](https://needle.app/docs/mcp/needle-create-instagram-post): Publish an Instagram post
- [`needleListInstagramPostComments`](https://needle.app/docs/mcp/needle-list-instagram-post-comments): List the comments on a post
- [`needleCommentOnInstagramPost`](https://needle.app/docs/mcp/needle-comment-on-instagram-post): Comment on a post
- [`needleListInstagramPostReactions`](https://needle.app/docs/mcp/needle-list-instagram-post-reactions): List the likes on a post
- [`needleLikeInstagramPost`](https://needle.app/docs/mcp/needle-like-instagram-post): Like a post
- [`needleListInstagramFollowers`](https://needle.app/docs/mcp/needle-list-instagram-followers): List followers
- [`needleListInstagramFollowing`](https://needle.app/docs/mcp/needle-list-instagram-following): List followed accounts
- [`needleFollowInstagramUser`](https://needle.app/docs/mcp/needle-follow-instagram-user): Follow an Instagram user
- [`needleUnfollowInstagramUser`](https://needle.app/docs/mcp/needle-unfollow-instagram-user): Unfollow an Instagram user

**Places**

- [`needleSearchPlaces`](https://needle.app/docs/mcp/needle-search-places): Search places
- [`needleGetPlace`](https://needle.app/docs/mcp/needle-get-place): Get a place

**Compose**

- [`needleComposePreview`](https://needle.app/docs/mcp/needle-compose-preview): Preview an AI-composed message

**Files**

- [`needleListFiles`](https://needle.app/docs/mcp/needle-list-files): List files
- [`needleCreateFileAccessUrl`](https://needle.app/docs/mcp/needle-create-file-access-url): Create a file preview URL
- [`needleDeleteFile`](https://needle.app/docs/mcp/needle-delete-file): Delete a file
- [`needleCreateFileUpload`](https://needle.app/docs/mcp/needle-create-file-upload): Create a file upload

**Suppressions**

- [`needleListSuppressions`](https://needle.app/docs/mcp/needle-list-suppressions): List suppressions
- [`needleSearchSuppressions`](https://needle.app/docs/mcp/needle-search-suppressions): Search suppressions
- [`needleCreateSuppressions`](https://needle.app/docs/mcp/needle-create-suppressions): Create suppressions
- [`needleCheckSuppressions`](https://needle.app/docs/mcp/needle-check-suppressions): Check people and companies against the suppression list
- [`needleDeleteSuppression`](https://needle.app/docs/mcp/needle-delete-suppression): Delete a suppression

**Webhooks**

- [`needleListWebhooks`](https://needle.app/docs/mcp/needle-list-webhooks): List webhooks
- [`needleCreateWebhook`](https://needle.app/docs/mcp/needle-create-webhook): Create a webhook
- [`needleGetWebhook`](https://needle.app/docs/mcp/needle-get-webhook): Get a webhook
- [`needleUpdateWebhook`](https://needle.app/docs/mcp/needle-update-webhook): Update a webhook
- [`needleDeleteWebhook`](https://needle.app/docs/mcp/needle-delete-webhook): Delete a webhook

**Onboarding**

- [`needleGetOnboardingInfo`](https://needle.app/docs/mcp/needle-get-onboarding-info): Get onboarding info

**Assistant chats**

- [`needleGetAssistantChat`](https://needle.app/docs/mcp/needle-get-assistant-chat): Get an assistant chat

**Docs**

- [`needleReadDocs`](https://needle.app/docs/mcp/needle-read-docs): Read the Needle docs

## Path B: Integrate Needle into an app

Use this when you are building an application, agent, or workflow that calls Needle **from code**, meaning the integration will run inside the user's product rather than from this session's MCP client.

This is the key difference from Path A: Path A calls MCP tools during the current session. Path B writes code that keeps running after the agent stops, using `NEEDLE_API_KEY` from the project's `.env` or runtime config.

```dotenv
NEEDLE_API_KEY=sk-ndl-…
```

**Base URL:** `https://needle.app/api/v1`

**Auth header:** `Authorization: Bearer sk-ndl-…`

- **OpenAPI:** https://needle.app/api/v1/openapi
- **API Reference:** https://needle.app/docs/api-reference/introduction

Smoke-test with `GET /api/v1/me` before writing feature code:

```bash
curl https://needle.app/api/v1/me \
  -H "Authorization: Bearer sk-ndl-…" \
  -H "Content-Type: application/json"
```

Route the feature the same way as Path A, then call the matching REST endpoint from Path E. Sends still need a connected account in the workspace that owns the key.

If you do not have a key yet, do Path D first.

## Path C: Repeatable outbound workflows

Use this when the goal is a finished outbound result (a lead list, a live campaign, a one-off send, or a suppression pass), not raw tool output and not product-code integration.

### Source a list

1. `needleSearchLinkedinPeopleClassic` or `needleSearchLinkedinPeopleSalesNavigator` (keywords, structured filters, or a matching search URL), or `needleSearchPlaces`. Resolve LinkedIn filter ids with `needleListLinkedinSearchParameters` using the matching service. For companies, posts and job listings, use `needleSearchLinkedinCompaniesClassic`, `needleSearchLinkedinPosts`, `needleGetLinkedinCompany` / `needleListLinkedinCompanyJobs`.
2. `needleGetLinkedinProfile` / `needleGetPlace` when you need details.
3. `needleCreateLeads` for the whole list at once, or `needleUpsertLead` per person (it reuses the lead if the person already is one; `needleCreateLead` refuses duplicates). Keep the lead ids that come back: enrolling needs them. LinkedIn identity accepts `john-doe`, `/in/john-doe`, `https://www.linkedin.com/in/john-doe`, or a user id (`ACoAAA…`). Instagram accepts `john-doe`, `@john-doe`, or `https://www.instagram.com/john-doe`.
4. `needleCheckSuppressions` and drop anyone you should not contact.

### Run a campaign

1. Confirm at least one connected account (`needleListConnectedAccounts`).
2. `needleCreateCampaign` with the sequence graph, schedule, limits, and the connected accounts to send from.
3. `needleEnrollCampaignLeads` with the lead ids from the list you sourced.
4. `needleListDrafts` when a send is waiting for review; ask the user to review it in the Needle inbox.
5. `needleGetCampaignStats` and `needleSearchEvents` to see what happened.

### One-off outreach

1. Get the profile.
2. `needleComposePreview` for the message.
3. LinkedIn: `needleSendLinkedinInvitation`, `needleSendLinkedinMessage`, or `needleSendLinkedinInMail` (check credits with `needleGetLinkedinInMailBalance`).
4. Instagram: `needleFollowInstagramUser` or `needleSendInstagramMessage`.

### Keep people off the list

`needleCreateSuppressions` for people or companies that should not be contacted. Campaigns honor the suppression policy you set on create/update.

If the request shifts to "wire Needle into product code," switch to Path B. If you only need a single tool call, stay on Path A.

## Path D: Account or API key

Use this when the human still needs to sign up, sign in, or create a key.

1. If they have no account, open https://needle.app/login and sign up.
2. Create a key at https://needle.app/settings/api-keys. Save it as `NEEDLE_API_KEY`.
3. To send, connect LinkedIn and/or Instagram at https://needle.app/accounts.
4. Continue with Path A, B, C, or E.

There is no keyless tier. Listing MCP tools at `/mcp/v1/tools` is public; every other call needs a key.

## Path E: REST API without MCP

Use this when you do not want to connect an MCP client. This works for both live work in this session and app integrations (Path B).

**Base URL:** `https://needle.app/api/v1`

**Auth header:** `Authorization: Bearer sk-ndl-…`

```bash
curl https://needle.app/api/v1/me \
  -H "Authorization: Bearer sk-ndl-…" \
  -H "Content-Type: application/json"
```

Successful requests return 2xx. `401` means a missing or invalid key. `422` means an invalid payload.

### REST endpoints

Every endpoint, with parameters and response schemas, is in the OpenAPI spec: https://needle.app/api/v1/openapi. Human-readable reference: https://needle.app/docs/api-reference/introduction.

## References

- **This skill:** https://needle.app/agent-onboarding/SKILL.md
- **Documentation:** https://needle.app/docs/introduction
- **API Reference:** https://needle.app/docs/api-reference/introduction
- **MCP catalog:** https://needle.app/docs/mcp/introduction
- **OpenAPI:** https://needle.app/api/v1/openapi
- **Full index:** https://needle.app/llms-full.txt
