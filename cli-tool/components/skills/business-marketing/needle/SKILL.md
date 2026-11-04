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
  repository: https://github.com/needle-ai/needle-mcp
---

# Needle

Needle helps agents search people and places, build lead lists, run multi-channel campaigns on LinkedIn and Instagram, keep suppressions, preview messages, and send from connected accounts.

The same outbound engine is available as a REST API and as MCP tools. One API key unlocks both. Listing MCP tools does not require a key; calling tools and REST endpoints does.

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
- **Find people** → `needleSearchLinkedinClassicPeople` or `needleSearchLinkedinSalesNavigatorPeople`, then `needleGetLinkedinProfile`
- **Find companies and jobs** → `needleSearchLinkedinCompanies`, `needleGetLinkedinCompany`, `needleListLinkedinCompanyJobs`, or `needleSearchLinkedinJobs` (searches all of LinkedIn unless you pass `companies`; resolve location, industry and title ids with `needleListLinkedinSearchParameters`). Read the full description and hiring team of one job with `needleGetLinkedinJob` (takes a job id or job URL)
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

#### Me

- [`needleGetMe`](/docs/mcp/needle-get-me): Get the authenticated user

#### Connected accounts

- [`needleListConnectedAccounts`](/docs/mcp/needle-list-connected-accounts): List connected accounts
- [`needleSearchConnectedAccounts`](/docs/mcp/needle-search-connected-accounts): Search connected accounts
- [`needleGetConnectedAccount`](/docs/mcp/needle-get-connected-account): Get a connected account
- [`needleUpdateConnectedAccount`](/docs/mcp/needle-update-connected-account): Update a connected account
- [`needleDeleteConnectedAccount`](/docs/mcp/needle-delete-connected-account): Delete a connected account
- [`needleListConnectedAccountLimits`](/docs/mcp/needle-list-connected-account-limits): List connected account limits
- [`needleUpdateConnectedAccountLimit`](/docs/mcp/needle-update-connected-account-limit): Override a connected account limit
- [`needleResetConnectedAccountLimit`](/docs/mcp/needle-reset-connected-account-limit): Reset a connected account limit
- [`needleListConnectedAccountEvents`](/docs/mcp/needle-list-connected-account-events): List connected account events
- [`needleListConnectedAccountTasks`](/docs/mcp/needle-list-connected-account-tasks): List connected account tasks

#### Leads

- [`needleListLeads`](/docs/mcp/needle-list-leads): List leads
- [`needleListLeadProperties`](/docs/mcp/needle-list-lead-properties): List lead properties
- [`needleUpdateLeadProperty`](/docs/mcp/needle-update-lead-property): Update a lead property
- [`needleSearchLeads`](/docs/mcp/needle-search-leads): Search leads
- [`needleCreateLead`](/docs/mcp/needle-create-lead): Create a lead
- [`needleUpsertLead`](/docs/mcp/needle-upsert-lead): Create or update a lead
- [`needleCreateLeads`](/docs/mcp/needle-create-leads): Create leads in bulk
- [`needleGetLead`](/docs/mcp/needle-get-lead): Get a lead
- [`needleUpdateLead`](/docs/mcp/needle-update-lead): Update a lead
- [`needleUpdateLeads`](/docs/mcp/needle-update-leads): Update leads in bulk
- [`needleDeleteLead`](/docs/mcp/needle-delete-lead): Delete a lead
- [`needleDeleteLeads`](/docs/mcp/needle-delete-leads): Delete leads in bulk
- [`needleListLeadEvents`](/docs/mcp/needle-list-lead-events): List lead events
- [`needleListLeadTasks`](/docs/mcp/needle-list-lead-tasks): List lead tasks

#### Campaigns

- [`needleListCampaigns`](/docs/mcp/needle-list-campaigns): List campaigns
- [`needleSearchCampaigns`](/docs/mcp/needle-search-campaigns): Search campaigns
- [`needleSearchEnrollments`](/docs/mcp/needle-search-enrollments): Search enrollments
- [`needleCreateCampaign`](/docs/mcp/needle-create-campaign): Create a campaign
- [`needleGetCampaign`](/docs/mcp/needle-get-campaign): Get a campaign
- [`needleUpdateCampaign`](/docs/mcp/needle-update-campaign): Update a campaign
- [`needleArchiveCampaign`](/docs/mcp/needle-archive-campaign): Archive a campaign
- [`needleGetCampaignStats`](/docs/mcp/needle-get-campaign-stats): Get campaign stats
- [`needleListCampaignEvents`](/docs/mcp/needle-list-campaign-events): List campaign events
- [`needleListCampaignTasks`](/docs/mcp/needle-list-campaign-tasks): List campaign tasks
- [`needleListCampaignLeads`](/docs/mcp/needle-list-campaign-leads): List campaign leads
- [`needleEnrollCampaignLeads`](/docs/mcp/needle-enroll-campaign-leads): Enroll leads
- [`needleRemoveCampaignLead`](/docs/mcp/needle-remove-campaign-lead): Stop a lead in a campaign
- [`needleStopCampaignLeads`](/docs/mcp/needle-stop-campaign-leads): Stop leads in a campaign in bulk

#### Drafts

- [`needleListDrafts`](/docs/mcp/needle-list-drafts): List drafts
- [`needleCreateDraft`](/docs/mcp/needle-create-draft): Create a draft
- [`needleGetDraft`](/docs/mcp/needle-get-draft): Get a draft
- [`needleWithdrawDraft`](/docs/mcp/needle-withdraw-draft): Withdraw a draft

#### Events

- [`needleSearchEvents`](/docs/mcp/needle-search-events): Search events

#### LinkedIn

- [`needleGetLinkedinProfile`](/docs/mcp/needle-get-linkedin-profile): Get a LinkedIn profile
- [`needleSearchLinkedinPeople`](/docs/mcp/needle-search-linkedin-people): Search LinkedIn people
- [`needleSearchLinkedinPeopleClassic`](/docs/mcp/needle-search-linkedin-people-classic): Search LinkedIn people (Classic)
- [`needleSearchLinkedinPeopleSalesNavigator`](/docs/mcp/needle-search-linkedin-people-sales-navigator): Search LinkedIn people (Sales Navigator)
- [`needleSendLinkedinMessage`](/docs/mcp/needle-send-linkedin-message): Send a LinkedIn message
- [`needleSendLinkedinInMail`](/docs/mcp/needle-send-linkedin-in-mail): Send a Sales Navigator InMail
- [`needleGetLinkedinInMailBalance`](/docs/mcp/needle-get-linkedin-in-mail-balance): Get remaining InMail credits
- [`needleListLinkedinConversations`](/docs/mcp/needle-list-linkedin-conversations): List conversations
- [`needleListLinkedinConversationMessages`](/docs/mcp/needle-list-linkedin-conversation-messages): List messages in a conversation
- [`needleListLinkedinInvitations`](/docs/mcp/needle-list-linkedin-invitations): List pending invitations
- [`needleSendLinkedinInvitation`](/docs/mcp/needle-send-linkedin-invitation): Send a connection invitation
- [`needleWithdrawLinkedinInvitation`](/docs/mcp/needle-withdraw-linkedin-invitation): Withdraw an invitation
- [`needleListLinkedinReceivedInvitations`](/docs/mcp/needle-list-linkedin-received-invitations): List invitations sent to you
- [`needleRespondToLinkedinInvitation`](/docs/mcp/needle-respond-to-linkedin-invitation): Accept or decline a received invitation
- [`needleListLinkedinFollowers`](/docs/mcp/needle-list-linkedin-followers): List followers
- [`needleListLinkedinFollowing`](/docs/mcp/needle-list-linkedin-following): List accounts this account follows
- [`needleListLinkedinRelations`](/docs/mcp/needle-list-linkedin-relations): List first-degree connections
- [`needleGetLinkedinCompany`](/docs/mcp/needle-get-linkedin-company): Get a LinkedIn company
- [`needleListLinkedinCompanyJobs`](/docs/mcp/needle-list-linkedin-company-jobs): List jobs posted by a company
- [`needleListLinkedinCompanyPosts`](/docs/mcp/needle-list-linkedin-company-posts): List posts from a company page
- [`needleSearchLinkedinJobs`](/docs/mcp/needle-search-linkedin-jobs): Search LinkedIn jobs
- [`needleGetLinkedinJob`](/docs/mcp/needle-get-linkedin-job): Get a LinkedIn job
- [`needleSearchLinkedinCompaniesClassic`](/docs/mcp/needle-search-linkedin-companies-classic): Search LinkedIn companies (Classic)
- [`needleSearchLinkedinPosts`](/docs/mcp/needle-search-linkedin-posts): Search LinkedIn posts
- [`needleListLinkedinPosts`](/docs/mcp/needle-list-linkedin-posts): List posts by a person or company
- [`needleGetLinkedinPost`](/docs/mcp/needle-get-linkedin-post): Get a LinkedIn post
- [`needleListLinkedinPostComments`](/docs/mcp/needle-list-linkedin-post-comments): List comments on a post
- [`needleListLinkedinPostReactions`](/docs/mcp/needle-list-linkedin-post-reactions): List reactions on a post
- [`needleCommentOnLinkedinPost`](/docs/mcp/needle-comment-on-linkedin-post): Comment on a post
- [`needleReactToLinkedinPost`](/docs/mcp/needle-react-to-linkedin-post): React to a post
- [`needleListLinkedinSearchParameters`](/docs/mcp/needle-list-linkedin-search-parameters): List LinkedIn search parameters

#### Instagram

- [`needleGetInstagramProfile`](/docs/mcp/needle-get-instagram-profile): Get an Instagram profile
- [`needleGetInstagramAccountProfile`](/docs/mcp/needle-get-instagram-account-profile): Get the connected account profile
- [`needleSendInstagramMessage`](/docs/mcp/needle-send-instagram-message): Send an Instagram message
- [`needleReactToInstagramMessage`](/docs/mcp/needle-react-to-instagram-message): React to an Instagram message
- [`needleListInstagramConversations`](/docs/mcp/needle-list-instagram-conversations): List Instagram conversations
- [`needleListInstagramConversationMessages`](/docs/mcp/needle-list-instagram-conversation-messages): List messages in a conversation
- [`needleListInstagramConversationParticipants`](/docs/mcp/needle-list-instagram-conversation-participants): List the participants of a conversation
- [`needleListInstagramPosts`](/docs/mcp/needle-list-instagram-posts): List the posts of an account
- [`needleGetInstagramPost`](/docs/mcp/needle-get-instagram-post): Get an Instagram post
- [`needleCreateInstagramPost`](/docs/mcp/needle-create-instagram-post): Publish an Instagram post
- [`needleListInstagramPostComments`](/docs/mcp/needle-list-instagram-post-comments): List the comments on a post
- [`needleCommentOnInstagramPost`](/docs/mcp/needle-comment-on-instagram-post): Comment on a post
- [`needleListInstagramPostReactions`](/docs/mcp/needle-list-instagram-post-reactions): List the likes on a post
- [`needleLikeInstagramPost`](/docs/mcp/needle-like-instagram-post): Like a post
- [`needleListInstagramFollowers`](/docs/mcp/needle-list-instagram-followers): List followers
- [`needleListInstagramFollowing`](/docs/mcp/needle-list-instagram-following): List followed accounts
- [`needleFollowInstagramUser`](/docs/mcp/needle-follow-instagram-user): Follow an Instagram user
- [`needleUnfollowInstagramUser`](/docs/mcp/needle-unfollow-instagram-user): Unfollow an Instagram user

#### Places

- [`needleSearchPlaces`](/docs/mcp/needle-search-places): Search places
- [`needleGetPlace`](/docs/mcp/needle-get-place): Get a place

#### Compose

- [`needleComposePreview`](/docs/mcp/needle-compose-preview): Preview an AI-composed message

#### Files

- [`needleListFiles`](/docs/mcp/needle-list-files): List files
- [`needleCreateFileAccessUrl`](/docs/mcp/needle-create-file-access-url): Create a file preview URL
- [`needleDeleteFile`](/docs/mcp/needle-delete-file): Delete a file
- [`needleCreateFileUpload`](/docs/mcp/needle-create-file-upload): Create a file upload

#### Suppressions

- [`needleListSuppressions`](/docs/mcp/needle-list-suppressions): List suppressions
- [`needleSearchSuppressions`](/docs/mcp/needle-search-suppressions): Search suppressions
- [`needleCreateSuppressions`](/docs/mcp/needle-create-suppressions): Create suppressions
- [`needleCheckSuppressions`](/docs/mcp/needle-check-suppressions): Check people and companies against the suppression list
- [`needleDeleteSuppression`](/docs/mcp/needle-delete-suppression): Delete a suppression

#### Webhooks

- [`needleListWebhooks`](/docs/mcp/needle-list-webhooks): List webhooks
- [`needleCreateWebhook`](/docs/mcp/needle-create-webhook): Create a webhook
- [`needleGetWebhook`](/docs/mcp/needle-get-webhook): Get a webhook
- [`needleUpdateWebhook`](/docs/mcp/needle-update-webhook): Update a webhook
- [`needleDeleteWebhook`](/docs/mcp/needle-delete-webhook): Delete a webhook

#### Onboarding

- [`needleGetOnboardingInfo`](/docs/mcp/needle-get-onboarding-info): Get onboarding info

#### Assistant chats

- [`needleGetAssistantChat`](/docs/mcp/needle-get-assistant-chat): Get an assistant chat

#### Docs

- [`needleReadDocs`](/docs/mcp/needle-read-docs): Read the Needle docs

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

1. `needleSearchLinkedinClassicPeople` or `needleSearchLinkedinSalesNavigatorPeople` (keywords, structured filters, or a matching search URL), or `needleSearchPlaces`. Resolve LinkedIn filter ids with `needleListLinkedinSearchParameters` using the matching service. For companies, posts and job listings, use `needleSearchLinkedinCompanies`, `needleSearchLinkedinPosts`, `needleGetLinkedinCompany` / `needleListLinkedinCompanyJobs`.
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

#### Me

- `GET /api/v1/me`: [Get the authenticated user](/docs/api-reference/get-me)

#### Connected accounts

- `GET /api/v1/connected-accounts`: [List connected accounts](/docs/api-reference/list-connected-accounts)
- `POST /api/v1/connected-accounts/search`: [Search connected accounts](/docs/api-reference/search-connected-accounts)
- `GET /api/v1/connected-accounts/{connectedAccountId}`: [Get a connected account](/docs/api-reference/get-connected-account)
- `PATCH /api/v1/connected-accounts/{connectedAccountId}`: [Update a connected account](/docs/api-reference/update-connected-account)
- `DELETE /api/v1/connected-accounts/{connectedAccountId}`: [Delete a connected account](/docs/api-reference/delete-connected-account)
- `GET /api/v1/connected-accounts/{connectedAccountId}/events`: [List connected account events](/docs/api-reference/list-connected-account-events)
- `GET /api/v1/connected-accounts/{connectedAccountId}/limits`: [List connected account limits](/docs/api-reference/list-connected-account-limits)
- `PATCH /api/v1/connected-accounts/{connectedAccountId}/limits/{action}`: [Override a limit](/docs/api-reference/update-connected-account-limit)
- `DELETE /api/v1/connected-accounts/{connectedAccountId}/limits/{action}`: [Reset a limit to defaults](/docs/api-reference/reset-connected-account-limit)
- `GET /api/v1/connected-accounts/{connectedAccountId}/tasks`: [List connected account tasks](/docs/api-reference/list-connected-account-tasks)

#### Leads

- `GET /api/v1/leads`: [List leads](/docs/api-reference/list-leads)
- `POST /api/v1/leads`: [Create a lead](/docs/api-reference/create-lead)
- `POST /api/v1/leads/search`: [Search leads](/docs/api-reference/search-leads)
- `GET /api/v1/lead-properties`: [List lead properties](/docs/api-reference/list-lead-properties)
- `PATCH /api/v1/lead-properties/{key}`: [Update a lead property](/docs/api-reference/update-lead-property)
- `POST /api/v1/leads/upsert`: [Create or update a lead](/docs/api-reference/upsert-lead)
- `POST /api/v1/leads/bulk`: [Create leads in bulk](/docs/api-reference/create-leads)
- `PATCH /api/v1/leads/bulk`: [Update leads in bulk](/docs/api-reference/update-leads)
- `POST /api/v1/leads/bulk-delete`: [Delete leads in bulk](/docs/api-reference/delete-leads)
- `GET /api/v1/leads/{leadId}`: [Get a lead](/docs/api-reference/get-lead)
- `PATCH /api/v1/leads/{leadId}`: [Update a lead](/docs/api-reference/update-lead)
- `DELETE /api/v1/leads/{leadId}`: [Delete a lead](/docs/api-reference/delete-lead)
- `GET /api/v1/leads/{leadId}/events`: [List lead events](/docs/api-reference/list-lead-events)
- `GET /api/v1/leads/{leadId}/tasks`: [List lead tasks](/docs/api-reference/list-lead-tasks)

#### Campaigns

- `GET /api/v1/campaigns`: [List campaigns](/docs/api-reference/list-campaigns)
- `POST /api/v1/campaigns`: [Create a campaign](/docs/api-reference/create-campaign)
- `POST /api/v1/campaigns/search`: [Search campaigns](/docs/api-reference/search-campaigns)
- `GET /api/v1/campaigns/{campaignId}`: [Get a campaign](/docs/api-reference/get-campaign)
- `PATCH /api/v1/campaigns/{campaignId}`: [Update a campaign](/docs/api-reference/update-campaign)
- `DELETE /api/v1/campaigns/{campaignId}`: [Archive a campaign](/docs/api-reference/archive-campaign)
- `GET /api/v1/campaigns/{campaignId}/stats`: [Get campaign stats](/docs/api-reference/get-campaign-stats)
- `GET /api/v1/campaigns/{campaignId}/events`: [List campaign events](/docs/api-reference/list-campaign-events)
- `GET /api/v1/campaigns/{campaignId}/tasks`: [List campaign tasks](/docs/api-reference/list-campaign-tasks)
- `GET /api/v1/campaigns/{campaignId}/leads`: [List campaign leads](/docs/api-reference/list-campaign-leads)
- `POST /api/v1/campaigns/{campaignId}/leads`: [Enroll leads](/docs/api-reference/enroll-campaign-leads)
- `POST /api/v1/campaigns/{campaignId}/leads/bulk-stop`: [Stop leads in a campaign in bulk](/docs/api-reference/stop-campaign-leads)
- `DELETE /api/v1/campaigns/{campaignId}/leads/{leadId}`: [Stop a lead in a campaign](/docs/api-reference/remove-campaign-lead)
- `POST /api/v1/enrollments/search`: [Search enrollments](/docs/api-reference/search-enrollments)

#### Drafts

- `GET /api/v1/drafts`: [List drafts](/docs/api-reference/list-drafts)
- `POST /api/v1/drafts`: [Create a draft](/docs/api-reference/create-draft)
- `GET /api/v1/drafts/{draftId}`: [Get a draft](/docs/api-reference/get-draft)
- `DELETE /api/v1/drafts/{draftId}`: [Withdraw a draft](/docs/api-reference/withdraw-draft)

#### Events

- `POST /api/v1/events/search`: [Search events](/docs/api-reference/search-events)

#### LinkedIn

- `GET /api/v1/linkedin/profiles/{identity}`: [Get a LinkedIn profile](/docs/api-reference/get-linkedin-profile)
- `POST /api/v1/linkedin/search`: [Removed LinkedIn people search](/docs/api-reference/removed-linkedin-people-search)
- `POST /api/v1/linkedin/people/search`: [Search LinkedIn people](/docs/api-reference/search-linkedin-classic-people)
- `POST /api/v1/linkedin/sales-navigator/people/search`: [Search Sales Navigator people](/docs/api-reference/search-linkedin-sales-navigator-people)
- `POST /api/v1/linkedin/messages`: [Send a LinkedIn message](/docs/api-reference/send-linkedin-message)
- `GET /api/v1/linkedin/conversations/{conversationId}/messages`: [List messages in a conversation](/docs/api-reference/list-linkedin-conversation-messages)
- `GET /api/v1/linkedin/invitations`: [List sent invitations](/docs/api-reference/list-linkedin-invitations)
- `POST /api/v1/linkedin/invitations`: [Send a connection invitation](/docs/api-reference/send-linkedin-invitation)
- `DELETE /api/v1/linkedin/invitations/{invitationId}`: [Withdraw an invitation](/docs/api-reference/withdraw-linkedin-invitation)
- `GET /api/v1/linkedin/relations`: [List first-degree connections](/docs/api-reference/list-linkedin-relations)
- `GET /api/v1/linkedin/companies/{identifier}`: [Get a LinkedIn company](/docs/api-reference/get-linkedin-company)
- `GET /api/v1/linkedin/companies/{identifier}/jobs`: [List jobs posted by a company](/docs/api-reference/list-linkedin-company-jobs)
- `POST /api/v1/linkedin/jobs/search`: [Search LinkedIn jobs](/docs/api-reference/search-linkedin-jobs)
- `GET /api/v1/linkedin/jobs/{jobId}`: [Get a LinkedIn job](/docs/api-reference/get-linkedin-job)
- `POST /api/v1/linkedin/companies/search`: [Search LinkedIn companies](/docs/api-reference/search-linkedin-companies)
- `POST /api/v1/linkedin/posts/search`: [Search LinkedIn posts](/docs/api-reference/search-linkedin-posts)
- `GET /api/v1/linkedin/posts`: [List posts by a person or company](/docs/api-reference/list-linkedin-posts)
- `GET /api/v1/linkedin/posts/{postId}`: [Get a LinkedIn post](/docs/api-reference/get-linkedin-post)
- `GET /api/v1/linkedin/posts/{postId}/comments`: [List comments on a post](/docs/api-reference/list-linkedin-post-comments)
- `POST /api/v1/linkedin/posts/{postId}/comments`: [Comment on a post](/docs/api-reference/comment-on-linkedin-post)
- `GET /api/v1/linkedin/posts/{postId}/reactions`: [List reactions on a post](/docs/api-reference/list-linkedin-post-reactions)
- `POST /api/v1/linkedin/posts/{postId}/reactions`: [React to a post](/docs/api-reference/react-to-linkedin-post)
- `POST /api/v1/linkedin/inmails`: [Send a Sales Navigator InMail](/docs/api-reference/send-linkedin-in-mail)
- `GET /api/v1/linkedin/inmails/balance`: [Get remaining InMail credits](/docs/api-reference/get-linkedin-in-mail-balance)
- `GET /api/v1/linkedin/conversations`: [List conversations](/docs/api-reference/list-linkedin-conversations)
- `GET /api/v1/linkedin/followers`: [List followers](/docs/api-reference/list-linkedin-followers)
- `GET /api/v1/linkedin/following`: [List followed accounts](/docs/api-reference/list-linkedin-following)
- `GET /api/v1/linkedin/invitations/received`: [List received invitations](/docs/api-reference/list-linkedin-received-invitations)
- `POST /api/v1/linkedin/invitations/received/{invitationId}`: [Accept or decline a received invitation](/docs/api-reference/respond-to-linkedin-invitation)
- `GET /api/v1/linkedin/search/parameters`: [List LinkedIn search parameters](/docs/api-reference/list-linkedin-search-parameters)

#### Instagram

- `GET /api/v1/instagram/profiles/{identity}`: [Get an Instagram profile](/docs/api-reference/get-instagram-profile)
- `GET /api/v1/instagram/me`: [Get the connected account profile](/docs/api-reference/get-instagram-account-profile)
- `POST /api/v1/instagram/messages`: [Send an Instagram message](/docs/api-reference/send-instagram-message)
- `POST /api/v1/instagram/messages/{messageId}/reactions`: [React to an Instagram message](/docs/api-reference/react-to-instagram-message)
- `GET /api/v1/instagram/conversations`: [List Instagram conversations](/docs/api-reference/list-instagram-conversations)
- `GET /api/v1/instagram/conversations/{conversationId}/messages`: [List messages in a conversation](/docs/api-reference/list-instagram-conversation-messages)
- `GET /api/v1/instagram/conversations/{conversationId}/participants`: [List the participants of a conversation](/docs/api-reference/list-instagram-conversation-participants)
- `GET /api/v1/instagram/posts`: [List the posts of an account](/docs/api-reference/list-instagram-posts)
- `POST /api/v1/instagram/posts`: [Publish an Instagram post](/docs/api-reference/create-instagram-post)
- `GET /api/v1/instagram/posts/{postId}`: [Get an Instagram post](/docs/api-reference/get-instagram-post)
- `GET /api/v1/instagram/posts/{postId}/comments`: [List the comments on a post](/docs/api-reference/list-instagram-post-comments)
- `POST /api/v1/instagram/posts/{postId}/comments`: [Comment on a post](/docs/api-reference/comment-on-instagram-post)
- `GET /api/v1/instagram/posts/{postId}/reactions`: [List the likes on a post](/docs/api-reference/list-instagram-post-reactions)
- `POST /api/v1/instagram/posts/{postId}/reactions`: [Like a post](/docs/api-reference/like-instagram-post)
- `GET /api/v1/instagram/followers`: [List followers](/docs/api-reference/list-instagram-followers)
- `GET /api/v1/instagram/following`: [List followed accounts](/docs/api-reference/list-instagram-following)
- `POST /api/v1/instagram/follows`: [Follow an Instagram user](/docs/api-reference/follow-instagram-user)
- `DELETE /api/v1/instagram/follows/{identity}`: [Unfollow an Instagram user](/docs/api-reference/unfollow-instagram-user)

#### Places

- `POST /api/v1/places/search`: [Search places](/docs/api-reference/search-places)
- `GET /api/v1/places/{placeId}`: [Get a place](/docs/api-reference/get-place)

#### Compose

- `POST /api/v1/compose`: [Preview an AI-composed message](/docs/api-reference/compose-preview)

#### Files

- `GET /api/v1/files`: [List files](/docs/api-reference/list-files)
- `POST /api/v1/files`: [Create a file upload](/docs/api-reference/create-file-upload)
- `DELETE /api/v1/files`: [Delete a file](/docs/api-reference/delete-file)
- `POST /api/v1/files/access`: [Create a file preview URL](/docs/api-reference/create-file-access-url)

#### Suppressions

- `GET /api/v1/suppressions`: [List suppressions](/docs/api-reference/list-suppressions)
- `POST /api/v1/suppressions`: [Create suppressions](/docs/api-reference/create-suppressions)
- `POST /api/v1/suppressions/search`: [Search suppressions](/docs/api-reference/search-suppressions)
- `POST /api/v1/suppressions/check`: [Check people and companies against the suppression list](/docs/api-reference/check-suppressions)
- `DELETE /api/v1/suppressions/{suppressionId}`: [Delete a suppression](/docs/api-reference/delete-suppression)

#### Webhooks

- `GET /api/v1/webhooks`: [List webhooks](/docs/api-reference/list-webhooks)
- `POST /api/v1/webhooks`: [Create a webhook](/docs/api-reference/create-webhook)
- `GET /api/v1/webhooks/{webhookId}`: [Get a webhook](/docs/api-reference/get-webhook)
- `PATCH /api/v1/webhooks/{webhookId}`: [Update a webhook](/docs/api-reference/update-webhook)
- `DELETE /api/v1/webhooks/{webhookId}`: [Delete a webhook](/docs/api-reference/delete-webhook)

#### Onboarding

- `GET /api/v1/onboarding`: [Get onboarding info](/docs/api-reference/get-onboarding)

#### Assistant chats

- `GET /api/v1/assistant-chats/{assistantChatId}`: [Get an assistant chat](/docs/api-reference/get-assistant-chat)

#### Docs

- `GET /api/v1/docs/{pageId}`: [Get a docs page](/docs/api-reference/get-docs-page)

## References

- **This skill:** https://needle.app/agent-onboarding/SKILL.md
- **Documentation:** https://needle.app/docs/introduction
- **API Reference:** https://needle.app/docs/api-reference/introduction
- **MCP catalog:** https://needle.app/docs/mcp/introduction
- **OpenAPI:** https://needle.app/api/v1/openapi
- **Full index:** https://needle.app/llms-full.txt
