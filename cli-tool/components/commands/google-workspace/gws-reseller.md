---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [resource] [method] [flags]
description: Google Workspace Reseller: Manage Workspace subscriptions.
---

# Google Workspace Reseller

Execute Google Workspace Reseller operations: $ARGUMENTS

## Prerequisites

- Google Workspace CLI (`gws`) must be installed
- Authentication configured: Run `gws auth status` to verify
- Review `gws reseller --help` for all available commands

## Available Resources and Methods

# reseller (v1)

> **PREREQUISITE:** Read `../gws-shared/SKILL.md` for auth, global flags, and security rules. If missing, run `gws generate-skills` to create it.

```bash
gws reseller <resource> <method> [flags]
```

## API Resources

### customers

  - `get` — Gets a customer account. Use this operation to see a customer account already in your reseller management, or to see the minimal account information for an existing customer that you do not manage. For more information about the API response for existing customers, see [retrieving a customer account](https://developers.google.com/workspace/admin/reseller/v1/how-tos/manage_customers#get_customer).
  - `insert` — Orders a new customer's account.
  - `patch` — Updates a customer account's settings. This method supports patch semantics. You cannot update `customerType` via the Reseller API, but a `"team"` customer can verify their domain and become `customerType = "domain"`. For more information, see [Verify your domain to unlock Essentials features](https://support.google.com/a/answer/9122284).
  - `update` — Updates a customer account's settings. You cannot update `customerType` via the Reseller API, but a `"team"` customer can verify their domain and become `customerType = "domain"`. For more information, see [update a customer's settings](https://developers.google.com/workspace/admin/reseller/v1/how-tos/manage_customers#update_customer).

### resellernotify

  - `getwatchdetails` — Returns all the details of the watch corresponding to the reseller.
  - `register` — Registers a Reseller for receiving notifications.
  - `unregister` — Unregisters a Reseller for receiving notifications.

### subscriptions

  - `activate` — Activates a subscription previously suspended by the reseller. If you did not suspend the customer subscription and it is suspended for any other reason, such as for abuse or a pending ToS acceptance, this call will not reactivate the customer subscription.
  - `changePlan` — Updates a subscription plan. Use this method to update a plan for a 30-day trial or a flexible plan subscription to an annual commitment plan with monthly or yearly payments. How a plan is updated differs depending on the plan and the products. For more information, see the description in [manage subscriptions](https://developers.google.com/workspace/admin/reseller/v1/how-tos/manage_subscriptions#update_subscription_plan).
  - `changeRenewalSettings` — Updates a user license's renewal settings. This is applicable for accounts with annual commitment plans only. For more information, see the description in [manage subscriptions](https://developers.google.com/workspace/admin/reseller/v1/how-tos/manage_subscriptions#update_renewal).
  - `changeSeats` — Updates a subscription's user license settings. For more information about updating an annual commitment plan or a flexible plan subscription’s licenses, see [Manage Subscriptions](https://developers.google.com/workspace/admin/reseller/v1/how-tos/manage_subscriptions#update_subscription_seat).
  - `delete` — Cancels, suspends, or transfers a subscription to direct.
  - `get` — Gets a specific subscription. The `subscriptionId` can be found using the [Retrieve all reseller subscriptions](https://developers.google.com/workspace/admin/reseller/v1/how-tos/manage_subscriptions#get_all_subscriptions) method. For more information about retrieving a specific subscription, see the information descrived in [manage subscriptions](https://developers.google.com/workspace/admin/reseller/v1/how-tos/manage_subscriptions#get_subscription).
  - `insert` — Creates or transfer a subscription. Create a subscription for a customer's account that you ordered using the [Order a new customer account](https://developers.google.com/workspace/admin/reseller/v1/reference/customers/insert.html) method.
  - `list` — Lists of subscriptions managed by the reseller. The list can be all subscriptions, all of a customer's subscriptions, or all of a customer's transferable subscriptions. Optionally, this method can filter the response by a `customerNamePrefix`. For more information, see [manage subscriptions](https://developers.google.com/workspace/admin/reseller/v1/how-tos/manage_subscriptions).
  - `startPaidService` — Immediately move a 30-day free trial subscription to a paid service subscription. This method is only applicable if a payment plan has already been set up for the 30-day trial subscription. For more information, see [manage subscriptions](https://developers.google.com/workspace/admin/reseller/v1/how-tos/manage_subscriptions#paid_service).
  - `suspend` — Suspends an active subscription. You can use this method to suspend a paid subscription that is currently in the `ACTIVE` state. * For `FLEXIBLE` subscriptions, billing is paused. * For `ANNUAL_MONTHLY_PAY` or `ANNUAL_YEARLY_PAY` subscriptions: * Suspending the subscription does not change the renewal date that was originally committed to. * A suspended subscription does not renew.

## Discovering Commands

Before calling any API method, inspect it:

```bash
# Browse resources and methods
gws reseller --help

# Inspect a method's required params, types, and defaults
gws schema reseller.<resource>.<method>
```

Use `gws schema` output to build your `--params` and `--json` flags.

## Usage

```bash
# List available resources and methods
gws reseller --help

# Inspect method schema before calling
gws schema reseller.<resource>.<method>

# Execute command with arguments
gws reseller $ARGUMENTS
```

## Task

Execute the requested Reseller operation: $ARGUMENTS

1. **Verify Prerequisites**
   - Check `gws` is installed: `gws --version`
   - Verify authentication: `gws auth status`
   - Review available commands: `gws reseller --help`

2. **Inspect Method Schema**
   - Before calling any method, inspect its parameters
   - Use `gws schema` to understand required fields
   - Review parameter types and constraints

3. **Execute Operation**
   - Build command with appropriate flags
   - Use `--params` for query/path parameters
   - Use `--json` for request body
   - Handle pagination with `--max-results` or `--page-token`

4. **Error Handling**
   - Check command output for errors
   - Review API quotas and rate limits
   - Handle authentication issues
   - Retry transient failures

---

**License**: Apache License 2.0
**Source**: [Google Workspace CLI](https://github.com/googleworkspace/cli)
**Original Skill**: `gws-reseller`
