---
name: stripe-integration
description: "Build or review a Stripe integration with current Stripe guidance: Checkout Sessions, Payment Element, Setup Intents, subscriptions and the Customer Portal, webhook-driven fulfillment, idempotency, restricted API keys and Stripe Tax. Use when: stripe, payments, checkout, subscription, billing, webhook, refund, payment intent."
metadata:
  source: "Rewritten 2026-10 from Stripe's documentation (docs.stripe.com) and its stripe-best-practices agent skill; first version from vibeship-spawner-skills (Apache 2.0)"
---

# Stripe Integration

Guidance for building payment code that does not lose orders, double-charge or
leak keys. It follows Stripe's own recommendations as of October 2026. When a
detail matters (a parameter, an event name, an API version), check
[docs.stripe.com](https://docs.stripe.com) or the Stripe MCP server's
`search_stripe_documentation` tool before relying on memory.

## Versions

- Latest API version: `2026-09-30.endive`. Pin it explicitly on the client so
  an account default change never alters response shapes under you.
- Latest server SDKs: Node.js 23, Python 16, Ruby 20, PHP 22, Java 34, Go 87,
  .NET 53. Create a client instance; the global key pattern
  (`stripe.api_key = …`, `Stripe.setApiKey`) is deprecated in every SDK.
- To move an existing integration to a newer version, read
  [Upgrading your API version](https://docs.stripe.com/upgrades) first.

```ts
// lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
  apiVersion: '2026-09-30.endive',
});
```

## Choose the API

| Building | Use |
|---|---|
| One-time payment, simple product | Payment Links (no code) or Checkout Sessions |
| One-time payment in your web app | Checkout Sessions (hosted or embedded) |
| Custom payment form | Checkout Sessions with `ui_mode: 'custom'` + Payment Element |
| Save a card for later | Setup Intents |
| Charge off-session (no customer present) | Payment Intents with a saved payment method |
| Subscriptions, seats, trials | Billing APIs + Checkout `mode: 'subscription'` + Customer Portal |
| New usage-based billing | Metronome (Stripe's usage platform), not raw Billing Meters |
| Marketplace or platform | Connect, Accounts v2 (`/v2/core/accounts`), Stripe-hosted onboarding |

Never use the Charges API, Sources API, Tokens API, Card Element or the
`plan` object. They are deprecated or legacy; use the rows above and Prices.

## Rules

### Fulfill from webhooks, never from the success page

A customer can pay and close the tab before the success page loads. Grant
access, send email and write orders only in the webhook handler.

- Handle `checkout.session.completed` **and**
  `checkout.session.async_payment_succeeded`. Fulfill only when
  `session.payment_status !== 'unpaid'`. Delayed methods (bank debits) send
  `completed` while still unpaid.
- Handle `checkout.session.async_payment_failed` for those failures.
- Subscriptions need `customer.subscription.created|updated|deleted`,
  `invoice.paid` and `invoice.payment_failed`. Renewals, dunning and
  cancellations only reach you this way.
- Webhooks are required before launch, not a follow-up.

### Verify every webhook signature on the raw body

Signature verification needs the exact bytes Stripe sent. Body-parsing
middleware breaks it.

```ts
// Next.js App Router: app/api/stripe/webhook/route.ts
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const body = await req.text(); // raw body, do not use req.json()
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return new Response('invalid signature', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      // Re-fetch instead of trusting the payload snapshot.
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
      // fulfillOrder must be idempotent: the same event can arrive twice.
      if (session.payment_status !== 'unpaid') await fulfillOrder(session.id);
      break;
    }
    case 'checkout.session.async_payment_failed':
      await markPaymentFailed(event.data.object.id);
      break;
  }
  return new Response(null, { status: 200 });
}
```

- On Cloudflare Workers, Deno or Bun use `await stripe.webhooks.constructEventAsync(...)`.
- In Express, mount `express.raw({ type: 'application/json' })` on the webhook
  route only, before any global `express.json()`.
- In live mode Stripe retries for up to three days and can deliver an event more than once
  or out of order. Make `fulfillOrder` idempotent (store processed event or
  session IDs with a unique constraint) and decide by the object's current
  state, not by event order.
- Return 2xx quickly; move slow work to a queue.

### Use idempotency keys on every create

A network retry without one can create a second charge or subscription.

```ts
await stripe.paymentIntents.create(
  { amount: 2000, currency: 'usd', customer: customerId },
  { idempotencyKey: `order-${orderId}-charge` },
);
```

Derive the key from your own record (order ID, user ID + action), not from a
random value per attempt, or retries get new keys.

### Let Stripe pick payment methods

Do not pass `payment_method_types` (not even `['card']`). Omitting it turns on
dynamic payment methods, configured in the Dashboard. To narrow the list use
`payment_method_configuration`, `excluded_payment_method_types`, or
`allowed_payment_method_types` on Payment and Setup Intents. The one exception
is Terminal: `payment_method_types: ['card_present']`.

### Map Stripe objects to your records by ID

Store the Stripe Customer, Subscription and Checkout Session IDs on your own
rows, and resolve webhook events through those IDs. Use `metadata` (for
example `client_reference_id` or `metadata.orderId` on the session) as a
fallback, not as the primary link.

### Keep subscription state in sync

Read access rights from your database, updated by the subscription webhooks
above, and re-fetch the subscription from Stripe when a decision depends on
it. Use the Customer Portal for upgrades, downgrades, cancellation and card
updates instead of building those screens. Create one Product per plan and
attach multiple Prices only for variants of the same plan (monthly, yearly,
currency). Do not build renewal loops on raw Payment Intents; Billing handles
retries and dunning (configure Smart Retries and emails in the Dashboard).

```ts
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: stripeCustomerId,
  line_items: [{ price: priceId, quantity: 1 }],
  subscription_data: { trial_period_days: 14 },
  success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${baseUrl}/pricing`,
});
```

### Tax

`automatic_tax: { enabled: true }` collects nothing, and returns no error,
until the account has an active tax registration for the customer's
jurisdiction. Check registrations before telling anyone tax is on.

## Keys and security

- Prefer restricted API keys (`rk_`) with only the permissions each service
  needs over full secret keys (`sk_`). Use separate keys per environment.
- Keep keys in the platform's secret store (Cloudflare and Vercel secrets,
  AWS Secrets Manager, GCP Secret Manager, Azure Key Vault). Never in source,
  client code, mobile apps, logs or error messages. Strings matching
  `[sr]k_live_` in a repo are live keys: roll them immediately.
- Treat the webhook signing secret (`whsec_`) like an API key.
- Add a pre-commit secret scan for `sk_` and `rk_` strings.
- Send a Content-Security-Policy that allows `https://*.stripe.com` in
  `script-src`, `frame-src` and `connect-src`.
- In Connect OAuth flows, send and verify a random `state` value.

## Testing

- Develop against a [sandbox](https://docs.stripe.com/sandboxes), one per
  developer or CI job, instead of the account's shared test mode.
  `stripe sandbox create` makes one without signing up.
- Forward events locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
  (prints the `whsec_` to use), then `stripe trigger checkout.session.completed`.
- Test cards: `4242 4242 4242 4242` succeeds, `4000 0025 0000 3155` requires
  3D Secure, `4000 0000 0000 9995` is declined (insufficient funds).
- Use test clocks to move subscriptions through renewals and failed payments.
- Before launch, walk the [go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)
  and register the production webhook endpoint with only the events you handle.

## Tools

- Stripe MCP server (`https://mcp.stripe.com`, OAuth) gives the agent account
  data and doc search: `npx claude-code-templates@latest --mcp devtools/stripe`.
- Ask before writes and money movement through the MCP:
  `npx claude-code-templates@latest --setting permissions/stripe-mcp-confirm-writes`.
- Forming the company: Stripe Atlas (Delaware C corp or LLC) can be started
  from the MCP (`atlas_company_formation`) or the CLI
  (`stripe plugin install tools`, then `stripe tools create_atlas_application`).
  Atlas validates every value; identity, payment, signatures and submission
  happen in the Stripe Dashboard. Record the founders' decisions on entity
  type, equity and vesting; never choose them for the user.
- Stripe publishes its own maintained agent skills (`npx skills add https://docs.stripe.com`
  or `stripe agent setup`), including `stripe-best-practices` and `upgrade-stripe`.

## Related Skills

Works well with: `nextjs-supabase-auth`, `nextjs-app-router-patterns`, `supabase-postgres-best-practices`, `api-security-best-practices`
