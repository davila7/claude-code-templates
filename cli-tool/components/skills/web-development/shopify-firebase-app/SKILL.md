---
name: shopify-firebase-app
description: Use when someone wants a Shopify app on Firebase (Cloud Functions, Firestore, Hosting) or a Shopify app without Remix, React Router or a server; when they mention Nitrogen or `npx @mksd0398/nitrogen`; or when working in a Nitrogen project, recognisable by `functions/src/api/`, `web/*.html` pages with `<s-app-nav>`, and an AGENTS.md that names Nitrogen. Applies to creating such an app, adding APIs, webhooks, pages, scopes or Firestore data to one, and deploying it.
license: MIT
author: mksd0398
repo: https://github.com/mksd0398/nitrogen
---

# Shopify apps on Firebase, with Nitrogen

Nitrogen scaffolds a Shopify embedded app on Firebase. It has one Cloud Function per API resource, Firestore, and Hosting. Its pages are plain HTML built from Polaris web components and App Bridge. The CLI is `npx @mksd0398/nitrogen`.

**Working inside an app?** Read its `AGENTS.md` first; it is the project's own guide. Apps made before Nitrogen 3.4 have none, so read [references/app-guide.md](references/app-guide.md) instead. It is the same guide, written for TypeScript; a JavaScript app has `.js` files.

**Building UI?** Use [references/polaris.md](references/polaris.md) for every Polaris web component, and [references/app-bridge.md](references/app-bridge.md) for the `shopify` global. Never use Polaris React or `@shopify/app-bridge-react`.

## Create an app

### 1. Get what only the user can give

| You need | Where the user finds it |
|---|---|
| Shopify client ID and secret | The app's settings in the Shopify Dev Dashboard. Create the app there first if it does not exist. |
| A Firebase project ID | An existing project, or a new id (6 to 30 characters: lowercase letters, digits, hyphens) for you to create with `--create-project`. |
| The Blaze plan on that project | `https://console.firebase.google.com/project/PROJECT_ID/usage/details`. Functions and Secret Manager need it. It is pay as you go, with a free monthly allowance. |
| One store, or any store | One store makes it single-tenant (`--shop=STORE.myshopify.com`). Any store makes it multi-tenant (leave `--shop` out). |
| Where the data lives | A Firestore location such as `us-central1` or `europe-west1`. It cannot be changed later, so ask. |

Choose the scopes from the feature yourself. Keep `read_products`, which the starter pages use, and add what the feature needs: orders need `read_orders`, and so on. Add `write_` scopes only for what the app changes.

Two steps open a browser, so the user runs them: `firebase login` now, and `shopify auth login` before the first `shopify app deploy`.

Ask the user to save the client secret to `secret.txt` in the folder you will run the CLI from, which is outside the app. Do not ask them to paste it into the chat, and never print it. Once it is stored in Secret Manager, they can delete the file.

### 2. Scaffold

There is no terminal to answer the wizard's questions in, so pass every answer as a flag:

```bash
SHOPIFY_API_SECRET="$(cat secret.txt)" npx @mksd0398/nitrogen@latest my-app \
  --api-key=CLIENT_ID \
  --project-id=PROJECT_ID \
  --firestore-region=us-central1 \
  --scopes=read_products,read_orders
```

| Flag | Use it when |
|---|---|
| `--create-project` | The Firebase project does not exist yet. |
| `--shop=STORE.myshopify.com` | The app is for one store. |
| `--language=javascript` | The user wants JavaScript. TypeScript is the default. |
| `--region=REGION` | The functions should run somewhere other than next to Firestore. |
| `--overwrite` | `my-app` exists and the user said to replace it. |
| `--skip-provision` | A trial run that touches nothing in Firebase. For a real app, leave it out. |

Run it from the parent folder; it creates `my-app/`. It stops with exit code 1 when a flag is missing or the folder already has files, and says why. It never replaces the folder it runs from. `--no-deploy` and `--skip-shopify` belong to the interactive wizard and do nothing here.

What it does: it creates Firestore and a Firebase web app (both only with `--firestore-region`), stores the secret in Secret Manager, installs dependencies, builds, runs `git init` and commits. It does not deploy, and "All done" means the scaffold is done.

Read its output for these warnings. Run the commands from inside `my-app`.
- **"Firebase project … not found in your account".** Either the project does not exist, so ask the user whether to create it (`firebase projects:create PROJECT_ID --display-name "App name"`), or they are signed in to another Google account (`firebase login:list`). Then set up Firebase by hand, as below.
- **"This project is on the Spark (free) plan".** The user upgrades to Blaze. Then store the secret: `firebase functions:secrets:set SHOPIFY_API_SECRET --data-file=../secret.txt --project=PROJECT_ID`.
- **"Could not store the Client Secret".** Run that same command once the project is on Blaze.

When the setup was skipped, or stopped early, finish it by hand:

```bash
firebase firestore:databases:create "(default)" --location=LOCATION --project=PROJECT_ID
firebase functions:secrets:set SHOPIFY_API_SECRET --data-file=../secret.txt --project=PROJECT_ID
```

### 3. Deploy and install

```bash
cd my-app
cd functions && npm test && cd ..
firebase deploy --force
shopify app deploy --allow-updates
```

`firebase deploy` ships the functions, the pages and the Firestore rules. `shopify app deploy` sends `shopify.app.toml` to Shopify: the app URL, scopes and webhook subscriptions. The user then installs the app from the Dev Dashboard onto a development store. `https://PROJECT_ID.web.app/auth?shop=STORE.myshopify.com` also works.

## Change an app

Follow the app's `AGENTS.md`. These are the steps agents miss most:

- **A new API** needs its file in `functions/src/api/`, an export in `functions/src/index`, and two rewrites in `firebase.json`. The rewrites use the lowercase export name and the same region as the others. `npm test` fails if the three disagree.
- **A new scope** goes in `shopify.app.toml` and `functions/.env`, then needs `shopify app deploy`. Merchants approve it the next time they open the app.
- **Orders and customers** are protected customer data. The user selects the data the app uses in the Partner Dashboard, under the app's API access; apps made in the Dev Dashboard are listed there too. Until then, Shopify refuses order and customer webhooks, even on a development store.
- **A new Firestore collection** is keyed by `tenantId(ctx.app, ctx.shop)` and listed in `TENANT_DOCS` or `TENANT_FIELD` in `functions/src/webhooks`. That way `shop/redact` deletes it.
- **A new page** needs its link added to the `<s-app-nav>` of every page, because each page carries its own copy.
- **A new webhook topic** reaches the app only after `shopify app deploy`.

Run `cd functions && npm test` after every change, and before every deploy.

## Rules that keep the app safe

- The shop and the app always come from what was verified, `ctx.shop` and `ctx.app`, never from a request's body, query or headers.
- A missing signature, session token or body is a refusal. Do not loosen any check in `functions/src/verify`.
- The client secret lives only in Secret Manager, and in `functions/.secret.local` for the emulator, which git ignores.
- Firestore is reached only through functions. Keep `firestore.rules` denying every client.

## When something fails

| Symptom | Cause | Fix |
|---|---|---|
| `There is no terminal to ask the setup questions in` | The wizard needs a terminal | Pass the flags in step 2 |
| `"my-app" already has files in it` | The folder exists | Use a new name, or `--overwrite` if the user agrees |
| `Firebase project "…" not found in your account` | It does not exist yet, or the user is signed in to another account | Create it with the user's go-ahead, or check `firebase login:list`; then finish the setup by hand |
| Deploy says billing or the Blaze plan is required | The project is on Spark | The user upgrades; then store the secret as in step 2 |
| The Dashboard says it could not load store information | `read_products` was dropped from the scopes | Put it back |
| Deploy asks for `SHOPIFY_API_SECRET` | The secret was never stored | `firebase functions:secrets:set SHOPIFY_API_SECRET --data-file=../secret.txt` |
| `/api/x` answers 404 from Hosting | The export and rewrite disagree, or the regions do | `npm test` names the mismatch |
| Google's 403 page instead of JSON | `invoker: "public"` was removed | Restore it in `functions/src/index` |
| Every call answers 429 `Rate exceeded.` just after billing was enabled | Google is still applying billing | Wait; it has taken 25 minutes |
| A GraphQL call says access denied | A scope is missing or not yet approved | Add it as above. If it persists, delete the shop's `shopSessions` document |
| `shopify app deploy` refuses an order or customer webhook | Protected customer data is not selected | The user selects it in the Partner Dashboard |
