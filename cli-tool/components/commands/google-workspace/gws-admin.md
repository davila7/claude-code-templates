---
allowed-tools: Bash, Read, Write, Edit
argument-hint: "[resource] [method] [flags]"
description: Google Workspace Admin SDK: Manage users, groups, and devices.
---

# Google Workspace Admin

Execute Google Workspace Admin operations: $ARGUMENTS

## Prerequisites

- Google Workspace CLI (`gws`) must be installed
- Authentication configured: Run `gws auth status` to verify
- Review `gws admin --help` for all available commands

## Available Resources and Methods

# admin (directory_v1)

> **PREREQUISITE:** Read `../gws-shared/SKILL.md` for auth, global flags, and security rules. If missing, run `gws generate-skills` to create it.

```bash
gws admin <resource> <method> [flags]
```

## API Resources

### asps

  - `delete` — Deletes an ASP issued by a user.
  - `get` — Gets information about an ASP issued by a user.
  - `list` — Lists the ASPs issued by a user.

### channels

  - `stop` — Stops watching resources through this channel.

### chromeosdevices

  - `action` — Use [BatchChangeChromeOsDeviceStatus](https://developers.google.com/workspace/admin/directory/reference/rest/v1/customer.devices.chromeos/batchChangeStatus) instead. Takes an action that affects a Chrome OS Device. This includes deprovisioning, disabling, and re-enabling devices. *Warning:* * Deprovisioning a device will stop device policy syncing and remove device-level printers. After a device is deprovisioned, it must be wiped before it can be re-enrolled.
  - `get` — Retrieves a Chrome OS device's properties.
  - `list` — Retrieves a paginated list of Chrome OS devices within an account.
  - `moveDevicesToOu` — Moves or inserts multiple Chrome OS devices to an organizational unit. You can move up to 50 devices at once.
  - `patch` — Updates a device's updatable properties, such as `annotatedUser`, `annotatedLocation`, `notes`, `orgUnitPath`, or `annotatedAssetId`. This method supports [patch semantics](https://developers.google.com/workspace/admin/directory/v1/guides/performance#patch).
  - `update` — Updates a device's updatable properties, such as `annotatedUser`, `annotatedLocation`, `notes`, `orgUnitPath`, or `annotatedAssetId`.

### customer

  - `devices` — Operations on the 'devices' resource

### customers

  - `get` — Retrieves a customer.
  - `patch` — Patches a customer.
  - `update` — Updates a customer.
  - `chrome` — Operations on the 'chrome' resource

### domainAliases

  - `delete` — Deletes a domain Alias of the customer.
  - `get` — Retrieves a domain alias of the customer.
  - `insert` — Inserts a domain alias of the customer.
  - `list` — Lists the domain aliases of the customer.

### domains

  - `delete` — Deletes a domain of the customer.
  - `get` — Retrieves a domain of the customer.
  - `insert` — Inserts a domain of the customer.
  - `list` — Lists the domains of the customer.

### groups

  - `delete` — Deletes a group.
  - `get` — Retrieves a group's properties.
  - `insert` — Creates a group.
  - `list` — Retrieves all groups of a domain or of a user given a userKey (paginated).
  - `patch` — Updates a group's properties. This method supports [patch semantics](https://developers.google.com/workspace/admin/directory/v1/guides/performance#patch).
  - `update` — Updates a group's properties.
  - `aliases` — Operations on the 'aliases' resource

### members

  - `delete` — Removes a member from a group.
  - `get` — Retrieves a group member's properties.
  - `hasMember` — Checks whether the given user is a member of the group. Membership can be direct or nested, but if nested, the `memberKey` and `groupKey` must be entities in the same domain or an `Invalid input` error is returned. To check for nested memberships that include entities outside of the group's domain, use the [`checkTransitiveMembership()`](https://cloud.google.com/identity/docs/reference/rest/v1/groups.memberships/checkTransitiveMembership) method in the Cloud Identity Groups API.
  - `insert` — Adds a user to the specified group.
  - `list` — Retrieves a paginated list of all members in a group. This method times out after 60 minutes. For more information, see [Troubleshoot error codes](https://developers.google.com/workspace/admin/directory/v1/guides/troubleshoot-error-codes).
  - `patch` — Updates the membership properties of a user in the specified group. This method supports [patch semantics](https://developers.google.com/workspace/admin/directory/v1/guides/performance#patch).
  - `update` — Updates the membership of a user in the specified group.

### mobiledevices

  - `action` — Takes an action that affects a mobile device. For example, remotely wiping a device.
  - `delete` — Removes a mobile device.
  - `get` — Retrieves a mobile device's properties.
  - `list` — Retrieves a paginated list of all user-owned mobile devices for an account. To retrieve a list that includes company-owned devices, use the Cloud Identity [Devices API](https://cloud.google.com/identity/docs/concepts/overview-devices) instead. This method times out after 60 minutes. For more information, see [Troubleshoot error codes](https://developers.google.com/workspace/admin/directory/v1/guides/troubleshoot-error-codes).

### orgunits

  - `delete` — Removes an organizational unit.
  - `get` — Retrieves an organizational unit.
  - `insert` — Adds an organizational unit.
  - `list` — Retrieves a list of all organizational units for an account.
  - `patch` — Updates an organizational unit. This method supports [patch semantics](https://developers.google.com/workspace/admin/directory/v1/guides/performance#patch)
  - `update` — Updates an organizational unit.

### privileges

  - `list` — Retrieves a paginated list of all privileges for a customer.

### resources

  - `buildings` — Operations on the 'buildings' resource
  - `calendars` — Operations on the 'calendars' resource
  - `features` — Operations on the 'features' resource

### roleAssignments

  - `delete` — Deletes a role assignment.
  - `get` — Retrieves a role assignment.
  - `insert` — Creates a role assignment.
  - `list` — Retrieves a paginated list of all roleAssignments.

### roles

  - `delete` — Deletes a role.
  - `get` — Retrieves a role.
  - `insert` — Creates a role.
  - `list` — Retrieves a paginated list of all the roles in a domain.
  - `patch` — Patches a role.
  - `update` — Updates a role.

### schemas

  - `delete` — Deletes a schema.
  - `get` — Retrieves a schema.
  - `insert` — Creates a schema.
  - `list` — Retrieves all schemas for a customer.
  - `patch` — Patches a schema.
  - `update` — Updates a schema.

### tokens

  - `delete` — Deletes all access tokens issued by a user for an application.
  - `get` — Gets information about an access token issued by a user.
  - `list` — Returns the set of tokens specified user has issued to 3rd party applications.

### twoStepVerification

  - `turnOff` — Turns off 2-Step Verification for user.

### users

  - `createGuest` — Create a guest user with access to a [subset of Workspace capabilities](https://support.google.com/a/answer/16558545). This feature is currently in Alpha. Please reach out to support if you are interested in trying this feature.
  - `delete` — Deletes a user.
  - `get` — Retrieves a user.
  - `insert` — Creates a user. Mutate calls immediately following user creation might sometimes fail as the user isn't fully created due to propagation delay in our backends. Check the error details for the "User creation is not complete" message to see if this is the case. Retrying the calls after some time can help in this case. If `resolveConflictAccount` is set to `true`, a `202` response code means that a conflicting unmanaged account exists and was invited to join the organization.
  - `list` — Retrieves a paginated list of either deleted users or all users in a domain.
  - `makeAdmin` — Makes a user a super administrator.
  - `patch` — Updates a user using patch semantics. The update method should be used instead, because it also supports patch semantics and has better performance. If you're mapping an external identity to a Google identity, use the [`update`](https://developers.google.com/workspace/admin/directory/v1/reference/users/update) method instead of the `patch` method. This method is unable to clear fields that contain repeated objects (`addresses`, `phones`, etc). Use the update method instead.
  - `signOut` — Signs a user out of all web and device sessions and reset their sign-in cookies. User will have to sign in by authenticating again.
  - `undelete` — Undeletes a deleted user.
  - `update` — Updates a user. This method supports patch semantics, meaning that you only need to include the fields you wish to update. Fields that are not present in the request will be preserved, and fields set to `null` will be cleared. For repeating fields that contain arrays, individual items in the array can't be patched piecemeal; they must be supplied in the request body with the desired values for all items.
  - `watch` — Watches for changes in users list.
  - `aliases` — Operations on the 'aliases' resource
  - `photos` — Operations on the 'photos' resource

### verificationCodes

  - `generate` — Generates new backup verification codes for the user.
  - `invalidate` — Invalidates the current backup verification codes for the user.
  - `list` — Returns the current set of valid backup verification codes for the specified user.

## Discovering Commands

Before calling any API method, inspect it:

```bash
# Browse resources and methods
gws admin --help

# Inspect a method's required params, types, and defaults
gws schema admin.<resource>.<method>
```

Use `gws schema` output to build your `--params` and `--json` flags.

## Usage

```bash
# List available resources and methods
gws admin --help

# Inspect method schema before calling
gws schema admin.<resource>.<method>

# Execute command with arguments
gws admin $ARGUMENTS
```

## Task

Execute the requested Admin operation: $ARGUMENTS

1. **Verify Prerequisites**
   - Check `gws` is installed: `gws --version`
   - Verify authentication: `gws auth status`
   - Review available commands: `gws admin --help`

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
**Original Skill**: `gws-admin`
