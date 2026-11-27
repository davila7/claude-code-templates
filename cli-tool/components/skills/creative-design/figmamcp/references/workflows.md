# Workflows

## The discover-before-acting pattern

Every workflow that touches a node should start with a read. There is no exception worth memorizing.

No write against an existing object proceeds unless the caller-supplied current name matches the resolved object's actual name — nodes, variables, styles, and collections alike; creation verifies the identified parent or collection instead.

1. **Discover pages** with `page_info` to learn the page structure.
2. **Discover nodes** with `node_info({ nodeIds, filter, properties, maxDepth })` to get IDs, names, types, and any properties you need.
3. **Plan** the operation using the IDs and names from the read — verbatim, no transformation.
4. **Act** with the appropriate write tool.
5. **Verify** with another `node_info` (or `node_export_visual`) when the result matters.

**Anti-patterns to avoid:**

- Writing to an ID the user mentioned without first reading it. The ID may be stale; the user's name for it may be wrong.
- Reusing IDs across sessions. Node IDs are stable within a file, but the *scope* and *connection* are session-bound; re-verify each session.
- Skipping the read because "I just read it." The file is a shared editable document — the designer may have moved or renamed nodes between your read and your write. A `NAME_MISMATCH` means the document changed; re-read.

### Assigned names: omit only when the field permits it

Never send `""` for a field that assigns a user-visible name. The server and plugin refuse it before mutation, but the correct recovery is action-specific:

- Supply a non-empty value for required `node_rename.name`, variable/style creation `name`, and component-property ADD `propertyName`.
- Omit optional creator/group names or `CREATE_COLLECTION.modeName` to accept the native default.
- Omit optional style/variable update `name` or component-property EDIT `newPropertyName` to leave the existing name unchanged.

Do not apply those omission rules to lookup/verification inputs. Read the current lookup name and pass it back verbatim.

---

## Editor Navigation (view_navigate)

You can navigate the editor view using **`view_navigate`**:
* **Page Target**: Pass a single `PAGE` node ID in `ids` to switch the user's active page. No selection is made.
* **Node Target(s)**: Pass one or more scene node IDs (which must all share the same containing page). The plugin will automatically switch to that page, select the nodes, and center the editor viewport on them (`scrollAndZoomIntoView`).

*Note*: Navigation is exempt from scope locks and works even in `READ_ONLY_MODE`.

---

## Visual Image Block Exports (node_export_visual)

When exporting nodes to verify changes visually, using `PNG` or `JPG` format is extremely powerful:
* The `node_export_visual` tool will return a **native MCP image block** containing the base64-encoded image and its correct MIME type (`image/png` or `image/jpeg`).
* Supporting MCP clients will automatically render this image inline within your chat response.
* Always request `PNG` or `JPG` when you need to visually verify a layout change or present the current design state to the user.
* Request `SVG` or `PDF` when you need the raw structural markup or a vector file format.

---

## Recipes

These are the canonical shapes. Adapt parameters; do not skip steps.

### Find and update text

```
1. page_info()                                          → find the page
2. node_info({ nodeIds: [pageId],
               filter: { type: "TEXT" },
               properties: ["characters", "name"] })         → list text nodes
3. text_set_content({ text: [
     { nodeId, nodeName, characters }, ...               → names verbatim from step 2
   ]})
```

### Create a node inside a frame

```
1. node_info({ nodeIds: [frameId], maxDepth: 0 })       → confirm parent name and check that parent is not inside an INSTANCE (structural edits inside instances are blocked)
2. create_shape({ type: "RECTANGLE", parentId: frameId,
                  parentNodeName: <verbatim name>,
                  x, y, width, height })                 → on success, confirm returned parentId === frameId
3. If the call fails with details.partialMutation: true, inspect
   details.before.survivingNodeId, survivingParentState, survivingParentId,
   and verifiedParentId; reconcile the survivor before retrying. "located"
   carries an exact parent ID, "detached" means observed null, and "unknown"
   means the parent or ID could not be read safely.
```

Figma's implicit creators construct on `currentPage` for part of one synchronous stack, then the plugin immediately inserts into the verified destination. Cleanup after a later failure is best-effort, which is why a failed call can carry survivor evidence even though a successful call cannot return at the wrong parent.

Error normalization is also fail-safe: a hostile thrown value whose error getters or string conversion throw becomes `UNKNOWN_ERROR` instead of breaking the response. That fallback does not cancel `details.partialMutation`; always reconcile any surviving evidence before issuing another write.

### Apply an image or clear a fill

```
1. (For large local images) resize manually if >45MP to avoid decode budget errors.
2. node_info({ nodeIds: [nodeId], maxDepth: 0 })         → confirm node name
3. node_set_fill({ nodeId, nodeName: <verbatim name>,
                   image: { bytesBase64: <base64 string> } })  → to apply image
   OR node_set_fill({ nodeId, nodeName, clear: true })         → to remove fills
```

### Variable Binding & Property Ordering

When applying variables, certain properties require the node to be in a specific state first:

1. **Auto-layout properties** (`paddingLeft`, `itemSpacing`, etc.):
   - **Prerequisite:** The node must have auto-layout enabled.
   - **Action:** If the node is a standard `FRAME`, use `node_set_auto_layout` first (e.g., `layoutMode: "HORIZONTAL"`), then call `node_bind_variable`.
2. **Color properties** (`fills`, `strokes`):
   - **Prerequisite:** To bind a color token to a fill, the node must either have **zero** fills, or one/multiple **solid** fills. You cannot bind a token to an image or gradient fill directly.
   - **Action:** If the node has an image fill, clear it first using `node_set_fill {clear:true}`. Once empty, binding a color variable will auto-create a bound solid paint.
   - **Action:** Alternatively, set a solid color first using `node_set_fill {r,g,b}` and then bind the variable.

### Modify a node by URL the user pasted

```
1. Pass the URL-format ID through unchanged (server normalizes dashes → colons)
2. node_info({ nodeIds: [urlId], maxDepth: 0 })          → discover real name
3. <write tool>({ nodeId: urlId, nodeName: <name from step 2>, ... })
```

### Convert a frame into a component (`create_component`)

```
1. node_info({ nodeIds: [frameId], maxDepth: 0 })       → verify exact name, type FRAME, and parent
2. Verify the frame is not the editable scope root and is not inside an INSTANCE.
3. create_component({ nodeId: frameId,
                      nodeName: <verbatim name> })       → on success, verify returned parentId
4. If refused as instance-interior, edit the main component or use instance overrides.
5. If details.partialMutation is true, inspect survivingComponentId,
   survivingComponentParentState, survivingComponentParentId,
   sourceFrameRemovalState, restoredChildIds, movedChildIds,
   unknownParentChildIds, relocatedChildren, restorationFailures, and
   componentChildCount before deleting, restoring, or retrying anything.
   Only "located" supplies a confirmed parent ID; "detached" requires an
   observed null parent, and "unknown" never authorizes deletion.
```

### Combine components into a component set (create_component_set)

```
1. node_info({ nodeIds: componentIds, maxDepth: 0 })   → verify each is an unlocked COMPONENT, not inside an instance,
                                                         not already inside a component set; take names verbatim
2. Choose properties (e.g. ["Size"]) and one propertyValues row per component — every combination must be
   unique, and values must be non-empty without '=' or ','
3. node_info({ nodeIds: [parentId], maxDepth: 0 })     → required parent: appendable, in scope, not inside an
                                                         instance, and NOT one of the combined components
4. create_component_set({
     components: [ { nodeId, nodeName: <name verbatim>, propertyValues: ["Small"] }, … ],
     properties: ["Size"],
     componentSetName: "My Component Set",
     parentId, parentNodeName: <parent name verbatim> })  → combine (variant names are computed from propertyValues)
   Omit `componentSetName` to keep Figma's default set name, or supply a
   non-empty name. An explicit `""` is rejected before any rename/combine
   because Figma would normalize it instead of preserving the request.
5. On success, verify returned parentId === requested parentId.
6. On details.partialMutation:
   - before.appliedComponents/restoredComponents/unrestoredComponents,
     removedComponents/unknownRemovalComponents, and
     reparentedComponents/unverifiedPlacementComponents means the combine
     failed during rename/combine recovery. Unknown removal or placement is
     never proof that another write is safe.
   - before.survivingComponentSets/retainedVariantComponents/
     unconfirmedVariantComponents means combine created or exposed a surviving
     set before throwing. Keep each member's computed `Property=Value` variant
     name; repair an unconfirmed variant name only after a fresh read proves it
     is safely writable, and never restore its old ordinary name. A changed
     parent whose type was unreadable also blocks an original-name restore.
   - before.componentSetId means the set already exists; inspect/finish that set and
     compare componentSetParentId with verifiedParentId; do not retry the combine
     while it remains.
   Reconcile every populated bucket before retrying, even when the initiating
   error code was normalized to UNKNOWN_ERROR.
```

### List annotations below a container root

```
1. node_info({ nodeIds: [rootId], maxDepth: 0 })       → verify the intended traversal root
2. annotation_list({ nodeId: rootId })                 → GROUP/FRAME roots are valid even when the root
                                                         itself has no annotations; annotated descendants
                                                         are returned in grouped annotatedNodes entries
```

Pass exactly one of `nodeId` or `pageId`. The `annotation_set` mixin restriction applies to the node being written, not to an `annotation_list` traversal root.

After `annotation_set`, treat counts as verified only when their matching flags are true. A failed row with `outcomeUnknown: true` means the append was attempted but post-state could not be read (`afterCount` is null and `afterCountVerified` is false); preserve the initiating `error`, treat `postStateError` as secondary evidence, and run `annotation_list` before retrying so an already-committed annotation is not duplicated.

For every accepted batch, treat `status: "partial_success"` as incomplete and handle every non-success row (`failed` and `skipped`); rows share `nodeId`/`status`/`error`, with `error` required on failed and skipped rows. The annotation list-before-retry rule above overrides an immediate retry because append is not idempotent.

### Inspect or update native prototype reactions

```
1. node_info({ nodeIds: [nodeId], maxDepth: 0 })       → verify the node and exact current name
2. reaction_list({ nodeIds: [nodeId] })                → inspect current native reaction metadata
3. reaction_update({ nodeId, nodeName, reactions })    → replace the node's reaction array
4. reaction_list({ nodeIds: [nodeId] })                → verify the resulting metadata
```

There is no connector-template discovery or automatic connector-diagram workflow. Native reaction reads and whole-array updates are the supported same-file surface.

### Set effects without silent field loss

```
1. node_info({ nodeIds: [nodeId], properties: ["name", "effects"], maxDepth: 0 })
2. node_set_effects({ nodeId, nodeName, effects: [...] })   → exactly DROP_SHADOW, INNER_SHADOW,
                                                              LAYER_BLUR, or BACKGROUND_BLUR
   OR style_manage({ type: "EFFECT", ... })                 → those four plus NOISE, TEXTURE, GLASS
```

Effect objects are strict per `type`: cross-variant keys are errors, not ignored hints, and `blendMode` must be one of the advertised Figma enum literals. `showShadowBehindNode` is DROP_SHADOW-only; progressive blur ramp fields must be supplied together with `blurType: "PROGRESSIVE"`. Supplied colors require complete RGBA channels in `0–1`; shadow/blur and GLASS radii are non-negative; GLASS `lightIntensity`, `refraction`, and `dispersion` are `0–1`; GLASS `depth` must be at least `1`; NOISE `density` is `0–1`; and NOISE/TEXTURE `noiseSize` and TEXTURE `radius` are `0–100`, because Figma silently clamps past those ceilings. Only one GLASS effect is allowed per node.

### Bulk text replacement (large designs)

For replacing many text nodes safely, work in verifiable chunks rather than one giant call:

1. **Map the structure** — `node_info({ nodeIds: [rootId], filter: { type: "TEXT" }, properties: ["characters", "name"], maxDepth: 10 })`.
2. **Chunk** by logical grouping (table rows, card groups, form sections) — not arbitrarily.
3. **Optionally clone first** — `node_clone` the target to keep a safe copy while iterating.
4. **Replace a chunk** with one `text_set_content` call (names verbatim from step 1).
5. **Verify** that chunk with a small targeted export — `node_export_visual({ nodeId: chunkId, format: "PNG", scale: 0.5 })` — then fix issues before the next chunk.
6. **Final pass** — export the whole frame at a reduced scale to check cross-chunk consistency.

Scale exports down as chunks grow (≈1.0 for a few nodes, 0.3–0.5 for large groups) to keep responses small.
