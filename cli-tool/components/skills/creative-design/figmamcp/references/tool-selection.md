# Tool selection

Heuristics for picking the right tool when several overlap.

No write against an existing object proceeds unless the caller-supplied current name matches the resolved object's actual name — nodes, variables, styles, and collections alike; creation verifies the identified parent or collection instead.

## `node_info` — the workhorse read

`node_info` is the one read tool for node data (it subsumes the old separate scan tools and the per-node variable read). Use its parameters to scope the read tightly:

- **`nodeIds: string[]`** — the roots of the traversal. If empty, defaults to the editable scope root ID.
- **`properties: string[]`** — return only these properties (populates each node's `properties` object in the response). Omitted properties are absent from the response (not `null`). Use aggressively to keep responses small. Common: `name`, `type`, `characters`, `fills`, `width`, `height`. The full property list (generated from `@figma/plugin-typings`, with types) is in the **`figmamcp://guide/node-fields`** resource.
- **`filter: { type: string | string[] }`** — prune the traversal tree. Only matching nodes (and their ancestors back to the root) are retained. Use for "all text nodes" / "all components" in a subtree.
- **`maxDepth: number`** — cap recursion. `maxDepth: 1` = immediate children; `maxDepth: 0` = the root nodes themselves.

| Goal | Call |
|---|---|
| All text in a frame | `node_info({ nodeIds: [frameId], filter: { type: "TEXT" }, properties: ["characters", "name"] })` |
| Immediate children of a node | `node_info({ nodeIds: [id], maxDepth: 1, properties: ["name", "type"] })` |
| All components in a page | `node_info({ nodeIds: [pageId], filter: { type: ["COMPONENT", "COMPONENT_SET"] }, properties: ["name"] })` |
| Full info on one known node | `node_info({ nodeIds: [id], maxDepth: 0 })` |
| Variables bound to a node | `node_info({ nodeIds: [id], properties: ["boundVariables", "explicitVariableModes"] })` |

The response includes `descendantCount` on top-level and boundary nodes — use it to gauge whether a deeper traversal is feasible before requesting it.

### Choosing properties: fast vs slow

Most fields are plain synchronous reads (**fast**) — request them freely. A few require async resolution or computed geometry (**slow**) and add latency; request them only when needed:

- **Slow:** `mainComponent`, `instances`, `vectorNetwork` / `vectorPaths`, `fillGeometry` / `strokeGeometry`, `absoluteRenderBounds`, and the **resolved names** of style/variable references.
- **The crux — raw vs resolved:** an ID is fast; the human-readable **name** behind it is slow. `fillStyleId`, `boundVariables`, `explicitVariableModes` return raw IDs cheaply; asking for the resolved style/variable/collection/mode names is the slow part.

When you only need to know *whether* something is bound, request the raw ID field. Ask for resolved names only when you'll show them to the user.

## Listings and Discovery Tools

* **`component_list`**: Defaults to a `scope` of `'document'`. If `scope` is set to `'page'`, a valid `pageId` (resolving to a `PAGE` type) **must** be provided. It only enumerates components that physically exist in the document's page trees, so it does **not** surface **remote (library)** component keys — a library's main components live in the library, not this file (only their *instances* do). To get a remote component's `key` for `create_instance`, read it off an existing instance: `node_info({ nodeIds: [instanceId], properties: ["mainComponent"] })` gives the main component id, then `node_info({ nodeIds: [mainComponentId], properties: ["key", "remote"] })` returns its `key` (and `remote: true`). For a component set, pass a **variant** component's key, not the set's.
* **`variable_list`**: The `includeConsumers` parameter is optional (defaults to no scan). It accepts `'page'` (requires `pageId` of a valid `PAGE` node) or `'document'`.
* **`annotation_list`**: Requires **exactly one** of `pageId` or `nodeId` (throws an error if neither or both are provided). If `pageId` is specified, it must resolve to a `PAGE` node. A `nodeId` is a traversal root: containers such as `GROUP` are valid even when the root itself lacks `AnnotationsMixin`; annotated descendants are still returned in grouped `annotatedNodes` entries.

### A successful read can still be partial

`page_info`, `node_info`, `component_list`, `variable_list` (consumer scans), and `annotation_list` return a `coverage` object: `{complete, pagesAttempted, pageErrors: [{pageId, error}]}`. A page that cannot be loaded or read no longer fails the whole call — the other pages still return their data, and `complete: false` is the signal that what you received is incomplete. Check it before summarising a result to the user or concluding that something does not exist; `coverage.pageErrors` carries a structured code and recovery per failing page (see the error-playbook).

`pagesAttempted` is the count of distinct pages the call tried to touch. **`pagesAttempted: 0` with `complete: true` means no page access was required — it is not evidence that the document was scanned and found clean.** A plain `variable_list` without `includeConsumers` reports exactly that.

Two per-tool fields join to it. `node_info` lists any requested node it had to drop in `pageFailedNodes: [{nodeId, pageId}]`, whose `pageId` indexes into `coverage.pageErrors`; `missingNodeIds` keeps its narrower "does not exist in the document" meaning, so the two answers stay distinguishable. `page_info`'s `missingPageIds` is every requested ID absent from `pages` whatever the cause, with `coverage.pageErrors` as the authoritative reason. Both fields are absent, not empty, when there is nothing to report.

> **Local vs remote (library) assets.** `variable_list` and `style_list` return **local** assets only — variables/styles subscribed from a **library** never appear there. To reference a remote asset, read it from a node that uses it: `node_info({ nodeIds, properties: ["boundVariables", "fillStyleId", "strokeStyleId", "effectStyleId", "textStyleId"] })` resolves each to `{ id, name }`. Recognizable IDs: remote **variables** look like `VariableID:<key>/<subid>`; remote **styles** end with `,<num>:<num>` (e.g. `S:abc…,18499:124`) while local styles end with a bare trailing comma (`S:abc…,`). Remote assets are **read-only** — editing/deleting the definition is denied (see the error-playbook); only an *instance* of a remote component is editable, via overrides.

## Disambiguating overlapping writes

| Want to… | Use | Not |
|---|---|---|
| Set an ad-hoc color, image, or clear fills | `node_set_fill` (literal RGBA, image payload, or `clear: true`) | `node_apply_style` (that links a shared paint style) |
| Make a value track a design token | `node_bind_variable` | `node_set_fill` (a literal won't update with the token) |
| Reuse a library style | `node_apply_style` (by `styleId`) | the raw `node_set_*` setters |
| Move and/or size a node | `node_transform` ({x?, y?, width?, height?}) | — |
| Create any basic shape | `create_shape` ({type, parentId, parentNodeName, …}) — parent must not be inside an instance | — |
| Create a frame, text, SVG, or instance | `create_frame`, `create_text`, `create_svg`, `create_instance` | parent must not be inside an instance |
| Convert a frame into a component | `create_component` after reading the source frame and its parent | Never target the scope root or a frame inside an instance |
| Combine variants | `create_component_set` with required `parentId` + `parentNodeName`; omit `componentSetName` for Figma's default or supply a non-empty name | Do not pass `componentSetName: ""`, omit the parent, or place the set inside one of its input components |

For native prototype metadata, use `reaction_list` to inspect and `reaction_update` to replace a node's reactions. There is no connector-template discovery or automatic connector-diagram workflow.

### Name assignment vs. name lookup

An explicit `""` is never valid for a field that assigns a user-visible name, but omission is not universally valid:

| Assignment | Correct empty-name recovery |
|---|---|
| `node_rename.name`; variable/style creation `name`; component-property ADD `propertyName` | Required: supply a non-empty name. |
| Creator/set/group name; `CREATE_COLLECTION.modeName` | Optional: omit for the established/native default. |
| Style/variable update `name`; component-property EDIT `newPropertyName` | Optional: omit to keep the current name. |

Fields that identify an existing node/parent/style/variable/property are lookup or verification inputs, not assignment defaults. Obtain them from the matching read tool and pass them verbatim. A dual-role field such as component-property `propertyName` is classified by action: assigned on ADD, lookup on EDIT.

All implicit creator/clone partial failures disclose a three-state survivor location. `survivingParentState: "located"` carries the exact readable `survivingParentId`; `"detached"` is reserved for an observed null parent; `"unknown"` means the parent or its ID could not be read safely. `create_component` uses the analogous `survivingComponentParentState`/`survivingComponentParentId`. Select a follow-up read or repair from that state—never treat a nullable ID alone as proof of detachment.

## Choosing an effects surface

Use `node_set_effects` for a literal effect array on one node; it accepts exactly `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, and `BACKGROUND_BLUR`. Use `style_manage({type:"EFFECT", …})` to create/update a shared effect style; it accepts those four plus `NOISE`, `TEXTURE`, and `GLASS`.

Both surfaces are strict per variant. Unknown and cross-variant keys are rejected rather than silently stripped, and `blendMode` must be one of the 19 literals advertised from Figma's pinned enum. In particular, `showShadowBehindNode` is DROP_SHADOW-only, and `startRadius`/`startOffset`/`endOffset` must all be present only when `blurType` is `"PROGRESSIVE"`. Supplied effect colors require full RGBA with channels in `0–1`; shadow/blur and GLASS radii are non-negative; GLASS `lightIntensity`, `refraction`, and `dispersion` are `0–1`; GLASS `depth` must be at least `1`; NOISE `density` is `0–1`; and NOISE/TEXTURE `noiseSize` and TEXTURE `radius` are `0–100`, because Figma silently clamps past those ceilings. Only one GLASS effect is allowed per node.

## Solid, Image, and Clear Fills (`node_set_fill`)

The `node_set_fill` tool supports three mutually-exclusive modes of operation:

1. **Solid Color**: Provide `r`, `g`, `b`, and optional `a` to apply a literal solid color.
2. **Clear Fills**: Provide `clear: true` to remove all fills from a node (setting `fills: []`). This is useful for returning a node to an empty state, or as a prerequisite before binding a color variable to a node that currently has an image fill.
3. **Image Fill**: Provide an `image` object. When applying an image fill, you must choose between two delivery methods:
   - **`bytesBase64`** (Raw bytes) — **Preferred for large images**. The server automatically downscales oversized PNG/JPEG images (keeping the aspect ratio) to fit within Figma's 4096px limit before sending them to the plugin. Use this when the image is large, local, or requires guaranteed delivery. Note that very large images (>~45 megapixels) will exceed the server's decode budget and throw an error; pre-resize these yourself. Heavy payload over the socket. GIF is never resized.
   - **`url`** (Figma fetch) — **Preferred for small, public images**. The Figma client fetches the URL directly. This is lightweight over the socket but has strict caveats:
     - The URL must be public and allow CORS.
     - Images are **not auto-resized** by the server. If the image exceeds 4096px on any side, Figma will reject it (`Image is too large`).
     - Use `bytesBase64` instead if you cannot guarantee the remote size or CORS headers.

## Batch vs single-item

Use a **batch** tool (`text_set_content`, `node_delete`, `annotation_set`, `instance_set_overrides`, `create_component_set`) when:

- You have more than 2–3 items of the same operation.
- The operations are independent of each other's results.
- Prevalidation atomicity is desired (all targets are checked for existence, scope, name, and node type before any write starts).

Use a **single-item** path when you have one item, later operations depend on earlier results, or you want per-item failure isolation.

The four aggregators — `node_delete`, `text_set_content`, `annotation_set`, `instance_set_overrides` — return one row per requested item; `create_component_set` shares the pre-validation rule but produces a single component set rather than rows. Treat `status: "partial_success"` as incomplete and retry every non-success row (`failed` and `skipped`) after accounting for successful rows; every row carries the shared `nodeId`/`status`/`error` vocabulary, with `error` required on failed and skipped rows. **`annotation_set` is the exception to an immediate retry:** append is not idempotent and a `failed` row may already have appended, so call `annotation_list` and compare labels before retrying any of its non-success rows.

Prevalidation atomicity is not a runtime transaction. After execution starts, tool-specific best-effort cleanup/restoration may run. If an error carries `details.partialMutation: true`, reconcile its `whatChanged` and `before` evidence before retrying. Creator evidence includes the located/detached/unknown survivor state and child states. Component-set evidence includes `appliedComponents`, `restoredComponents`, `unrestoredComponents`, `removedComponents`, `unknownRemovalComponents`, `reparentedComponents`, `unverifiedPlacementComponents`, `survivingComponentSets`, `retainedVariantComponents`, and `unconfirmedVariantComponents`. Confirmed surviving-set members keep their computed `Property=Value` names; unknown removal/placement and unconfirmed names remain partial and never authorize an optimistic write.

For `annotation_set`, nullable `beforeCount`/`afterCount` are trustworthy only with their required `beforeCountVerified`/`afterCountVerified` flags. `outcomeUnknown: true` means an append was attempted but readback failed; call `annotation_list` and compare labels before retrying, regardless of the secondary `postStateError`.

Error transport is total for hostile thrown values: unreadable error getters, optional details, or stringification fall back to the canonical `UNKNOWN_ERROR` envelope instead of making the registered callback reject. A readable coded error still passes through structurally. `UNKNOWN_ERROR` does not waive reconciliation—when partial-mutation evidence is present, use that evidence before choosing any retry or repair.

## Streaming progress

Tools that may run long (`node_info` at high depth, `page_info` on large files) emit `progress_update` events. Treat them as informational — they prevent timeouts and signal the call is still working. Wait for the actual response; do not treat a progress event as completion.
