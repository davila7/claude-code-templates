// The inputs of the built-in tools this build has, from each tool's
// input schema. Merges into ToolCallInput (BuiltinToolInputs) so
// `e.tool === "Bash"` narrows to the tool's arguments.
declare module 'claude-code' {
  interface BuiltinToolInputs {
    Agent: {
      /** A short (3-5 word) description of the task */
      description: string
      /** The task for the agent to perform */
      prompt: string
      /** The type of specialized agent to use for this task */
      subagent_type?: string
      /** Optional model override for this agent. Takes precedence over the agent definition's model frontmatter and the configured default subagent model. If omitted, uses the agent definition's model, else the default (inherits from the parent unless a default subagent model is configured). Ignored for subagent_type: "fork" — forks always inherit the parent model. */
      model?: "sonnet" | "opus" | "haiku" | "fable"
      /** Reasoning effort for this agent. Set this ONLY when the user, or instructions such as CLAUDE.md or a skill, explicitly ask that this agent or delegated work run at a specific effort level, never on your own judgment; otherwise omit it and the agent runs at its usual effort. Ignored for subagent_type: "fork": a fork runs at your own effort. */
      effort?: "low" | "medium" | "high" | "xhigh" | "max"
      /** Name for the spawned agent. Makes it addressable via SendMessage({to: name}) while running. */
      name?: string
      /** Deprecated; ignored. The session has a single implicit team. */
      team_name?: string
      /** Deprecated; ignored. Subagents inherit the parent session's permission mode; agent-definition frontmatter may override it. */
      mode?: "acceptEdits" | "auto" | "bypassPermissions" | "default" | "dontAsk" | "plan"
      /** Isolation mode. "worktree" creates a temporary git worktree so the agent works on an isolated copy of the repo. "remote" launches the agent in a remote cloud environment (always runs in background; availability is gated). */
      isolation?: "worktree" | "remote"
    }
    AppifactRepl: {
      /** Leave it out: the built-in SDK runs the code. Only to run a loaded appifact skill's own scripts/appifact_sdk.js instead: that skill's name. */
      skill?: string
      /** The existing artifact the code works on (its URL or id), bound for claude.use("db"). Omit it only when a named skill's code creates a new artifact. */
      artifact?: string
      /** Plain JavaScript for the SDK REPL: top-level statements, each on its own line or lines, run in order in one shared scope. The code is approved by reading, so it carries no invisible character raw: use emoji without joiners or variation selectors (single code points: 👩 🍳 ❤ rather than 👩‍🍳 ❤️), or write such a sequence as escapes inside a string ("\u{1F469}\u200D\u{1F373}", "\u2764\uFE0F"); a zero-width space or other format character goes in as a \u escape too. */
      code: string
    }
    Artifact: {
      /** One of 'publish', 'list', 'read', 'delete', 'open', 'pin', 'unpin', 'quickstart'. Omitting it means 'publish'. **Calls** in the description says what each one does and takes, except as noted here. */
      action?: "publish" | "list" | "read" | "delete" | "open" | "pin" | "unpin" | "quickstart"
      /** publish: the local page Claude publishes (.html, or .md only when a skill says so). For an Artifact created from an Artifact type, it is one of that Artifact's data files. With `asset: true`, it is the local file Claude uploads. A short, distinctive basename also serves as the title when nothing else gives one. */
      file_path?: string
      /** publish with `url`: true uploads `file_path` (or each of `file_paths`) to that artifact's asset store instead of publishing it as the page — or, with `from_url` and `asset_ids` in place of `file_path`, copies those assets of another artifact into it server side (see **Calls**). */
      asset?: boolean
      /** publish with `asset: true` only: several local image, video, PDF, font, stylesheet or script files in place of `file_path`, up to 25 in one call, all into the artifact that `url` names; one approval covers the call, and the result lists each file's id and url, or why it was not uploaded. A CSV, Markdown, JSON or plain-text file, a symbolic or hard link, and a file outside the working directory each go in a call of their own with `file_path`. */
      file_paths?: string[]
      /** publish with `asset: true`, in place of `file_path`: the SOURCE artifact's claude.ai URL — one the person can open. */
      from_url?: string
      /** publish with `asset: true` and `from_url` only: 1–10 distinct asset ids from the source artifact (from a `scope: "assets"` listing of it, or an upload result). */
      asset_ids?: string[]
      /** Deprecated; Claude omits it and uses `icon`. */
      favicon?: string
      /** One short generic word for the artifact's browser-tab icon, such as chart, calendar, recipe, code or map: a plain signifier, never a product or brand name. Claude includes it on every page's first publish and omits it on a redeploy so the artifact keeps its icon, passing a new one only when the person asks. Ignored on an Artifact created from an Artifact type. */
      icon?: string
      /** Supporting files to publish alongside the page, as a map {"published/path": "source/path" | {from, contentType} | {artifact, path, ver?} | null}. The key is what the HTML references. The source is a path on disk, or {from, contentType} when the type cannot be inferred from the published extension. An {artifact, path} source copies that Artifact's published file on the server: an Artifact the person can open, with its type carried over, never an HTML or XML document, and at most 4 source Artifact versions per publish. null removes that path on an update, and files left out are kept. A plain list publishes each file at its own spelling. Sources must be under the working directory or Claude's scratchpad directory. `preflight.js` at the artifact root is reserved: it runs against open pages when Claude publishes updates, and it must be a JavaScript module of at most 8 KiB whose default export is a function, or the publish is refused. */
      files?: Array<{
        /** Path relative to the working directory (or to `root`, which may be a folder in your scratchpad directory); the file is served at this same path next to the page. */
        path: string
        /** Servable media type; inferred from the extension for common types (css/js/json/png/…) — pass explicitly otherwise. */
        contentType?: string
      }> | {}
      /** The base directory that relative `files` sources resolve against, like a bundler root. It never changes published paths. It is relative to the working directory, or absolute within it or within Claude's scratchpad directory. It requires `files`, except on an Artifact made from a type, where a data `file_path` under it is served at its path relative to it. */
      root?: string
      /** publish only: true also pins the published artifact to the person's claude.ai sidebar once it is published. Claude passes it only when the person asked for that. A failed pin never fails the publish, and the result says so. */
      pin?: boolean
      /** list only: the maximum number of artifacts to return (default 25). */
      limit?: number
      /** list: which listing to return. 'mine' is the default. The others are 'shared', 'all', 'types', 'files' (with `url`) and 'assets' (with `url`, continued with `after`). See **Calls**. */
      scope?: "mine" | "shared" | "all" | "types" | "files" | "assets"
      /** list with scope 'types' only: limits the listing to the types whose title or description match this text best, ignoring case; a type that matches less well is left out, so a narrowed listing is not the whole catalog. Claude omits it when choosing a type for a request, unless a listing made without it says more types exist than it shows. */
      type_query?: string
      /** list only: the name of a published Artifact type, as a 'types' listing shows it (case does not matter). The listing then shows the Artifacts made from that type instead of the person's gallery. Claude passes this or `type_url`, not both. */
      type?: string
      /** quickstart only (required): what is being made — 'document' (text to read or edit together), 'slides' (a deck or one slide), 'design' (a visual design or prototype on a canvas), 'other' (anything else, or unsure). */
      intent?: "document" | "slides" | "design" | "other"
      /** quickstart only: false when a design system's link is already in hand (it is then read with its own call) or one was declined. Omitted or true, the result lists the design systems (not for a document) and, for slides or a design, attaches the default one's README. */
      design_systems?: boolean
      /** publish: the fallback title for an HTML page whose file has no <title>. It is a name, not a summary, and Claude keeps it the same across redeploys. On a `type_url` create, it is the new Artifact's name: what the person called it, or a short descriptive name. If it is left out, the Artifact is named after the type. */
      title?: string
      /** publish: one sentence for the subtitle on the gallery card. */
      description?: string
      /** A short name for this publish, at most 60 characters (e.g. "Draft to legal"). Optional. It is a few words, not a description. */
      label?: string
      /** publish with `files` or `root` to an existing artifact: published paths this call may replace or remove although you have not read or listed them in this session. Every other path the call touches must be one you read by its `path`, saw in a file listing, or published yourself, and must not have changed since — otherwise nothing is sent and the refusal names each path. Name a path here only when the user asked for it to be replaced without looking at what is there; it never excuses a path that changed after you read it. */
      overwrite_unread?: string[]
      /** An existing artifact's claude.ai link (claude.ai/artifact/{id} or claude.ai/code/artifact/{uuid}); a chat, project or session link is not one, and `action: "list"` lists the person's artifacts. On a publish, it is the artifact to update in place, one the person owns or was given edit access to (a read of it says "writer"). Before publishing to an artifact this conversation has neither read nor published, Claude reads it (`action: "read"`) and builds on what comes back; a publish sent without that read is refused. A refusal that hands Claude the live version counts as that read: Claude merges its changes into that version and publishes the result, and never resends the refused content unchanged. Claude omits `url` for a new artifact or to redeploy a file this conversation already published. For read, delete and the other calls that take a URL, it is the artifact to act on. */
      url?: string
      /** publish: the Artifact type to create this new, private Artifact from (a link from a 'types' listing). Claude omits `url`. Any `file_path`/`files` passed become the new Artifact's own files beside the type's fixed ones. read (no `url`): the type to describe. list: the type whose Artifacts to list, or Claude names the type with `type` instead. */
      type_url?: string
      /** Only with `type_url` and no `file_path`: when the new Artifact opens for the person. Claude passes "after_first_write" when it will fill the Artifact right after creating it with a files publish to its url, so the person does not first see it empty. The Artifact then opens on that first write. Otherwise Claude omits it, and the Artifact opens when created; Claude always omits it for a type whose content it writes through a connector, such as a Claude Docs document, since no publish or store write follows to open it. */
      auto_open?: "at_create" | "after_first_write"
      /** read, for an artifact shared with the person: what Claude needs from it, which steers the isolated summary. */
      prompt?: string
      /** publish: a last-resort overwrite that **discards** the newer published version. On a conflict, Claude merges its changes onto the newer content that the rejection hands it and publishes again. Claude passes true only when the person explicitly said to discard that specific version, and the server may still refuse it over a version saved from inside the page. */
      force?: boolean
      /** read with `path`: the directory to save into. The default is this artifact's folder in Claude's scratchpad directory, where saving needs no approval. A published file lands at <out_dir>/<published path>, and saving it outside that default folder asks the person first. An asset's file is named by its id plus its type's extension; saving it outside the default folder is an ordinary file save the person may be asked to approve. */
      out_dir?: string
      /** read: the file's published path inside the artifact, exactly as a 'files' listing printed it ("index.html" is the page itself). The file is saved locally, the result says where, and a small text file's contents are included. It can instead be an uploaded asset's id (32 hex characters, from an 'assets' listing or an upload result), and that asset is saved to a local file. delete: the id of the one asset to remove. */
      path?: string
      /** read: several published paths in place of `path`, up to 256 in one call. Each file is saved as a single `path` would be, and the result lists where each one landed, or why it could not be read, with small text files' contents included while they fit. */
      paths?: string[]
      /** list with scope 'assets' only: the `next` value from a previous listing, passed to continue it. */
      after?: string
      /** read only: true returns the rendered page in cases where a read otherwise returns something else. A typed Artifact's read leaves out the type's own page. */
      page?: boolean
      /** publish: the runtime capabilities this page declares, as {name: config}. Claude loads the `artifact-capabilities` skill before passing it. On a redeploy Claude omits the field to keep what the page has, and {} clears it. */
      capabilities?: {}
      /** publish: the artifact's runtime version. Leaving it out keeps the current version (the default), 'latest' upgrades, and an exact version pins or rolls back. It changes how the published page behaves, so Claude passes it only when the author explicitly intends that change. */
      contract?: "latest" | string
    }
    ArtifactCheck: {
      action: "verify"
    }
    ArtifactComments: {
      /** 'read' reads the comment threads on the artifact at `url` (add `thread_id` for one thread, or `cursor` to continue a listing); 'reply' posts `text` into the thread `thread_id`; 'resolve' marks that thread resolved; 'watch' manages this session's artifact watches — with `url` it starts watching that artifact (`on: false` stops), with no `url` it lists this session's watches and rooms, and `replies: true` re-enables automatic comment replies that were stopped or paused for the artifact at `url` (only when the user explicitly asked; approved the way a publish is). */
      action: "read" | "reply" | "resolve" | "watch"
      /** The artifact's claude.ai URL. Required for every action except a bare 'watch' listing. */
      url?: string
      /** reply: id of the comment thread to reply into. resolve: the thread to mark resolved. read: read just this one thread (the size cap can still elide a very long thread). Thread ids come from action "read" and from comment notifications. */
      thread_id?: string
      /** reply only: the reply text. Plain text, at most 4096 bytes of UTF-8. */
      text?: string
      /** read only: continue a listing that ended with a "more threads not listed" line — pass the cursor value that line names to render the threads it could not fit. */
      cursor?: string
      /** reply only: post even though a Claude reply already stands after every "sent to Claude" request on the thread. Without it such a reply is refused as a likely duplicate. Pass true only for a deliberate follow-up that adds something new — never to restate what the standing reply said. */
      acknowledge_duplicate?: boolean
      /** watch only: false stops watching the artifact at `url`; omit (or true) to start. */
      on?: boolean
      /** watch only: true re-enables automatic comment replies for the artifact at `url` after the user stopped or paused them — pass it ONLY when the user explicitly asked to resume. */
      replies?: boolean
    }
    ArtifactData: {
      /** Reads: 'get' (one document: `collection` + `doc_id`), 'list' (a page of a collection: `collection`, with optional `query.limit`/`query.cursor`), 'query' (filtered: `collection` + `query`), 'profiles' (people's display names: `ids`, nothing else). Writes: 'set' (replace) or 'update' (merge) with `collection`, `doc_id`, and either `data` or `file_path`; 'str_replace' with `collection`, `doc_id`, `field`, `old_str`, `new_str` — swaps one exact, unique piece of text inside a string field without resending the field (`replace_all`: every occurrence); 'delete' with `collection` + `doc_id`; 'batch' with `writes`. Every action takes the artifact's `url`. */
      action: "get" | "list" | "query" | "set" | "update" | "delete" | "str_replace" | "batch" | "profiles"
      /** The artifact's claude.ai URL. Required. */
      url?: string
      /** action 'batch' only: the writes to apply together, 1-50 entries of {op: 'set'|'update'|'delete', collection, doc_id, and for set/update exactly one of data (inline object) or file_path (a local JSON file), plus if_version — that document's last-read `version`, required for every entry whose document already exists (omit it only when creating); if any pinned document has changed since, or an existing document's entry carries no pin, the whole batch writes nothing and the result names the first such entry}. Each document is addressed at most once and the whole batch body is at most 1 MiB; the batch commits all-or-nothing where the server supports it, else (a batch with no pinned entry) in order one at a time (the result says which). Prefer it over separate calls whenever you write more than a couple of documents. */
      writes?: Array<{
        op: "set" | "update" | "delete"
        collection: string
        doc_id: string
        data?: {}
        file_path?: string
        if_version?: number
      }>
      /** Database collection path: an odd number (1-15) of "/"-separated segments (letters, digits, _ - . ~ : @ + per segment). Paths alternate collection/document, so "boards/b1/columns" is a collection and, with `doc_id` "c2", names the document "boards/b1/columns/c2". Per-user data: "data/users/<id>" (3 segments) is the collection holding that user's documents, "data/users/<id>/decks" is one document in it, and "data/users/<id>/decks/cards" a collection under that; "me" as the <id> means the current user. Required for every action except 'batch' and 'profiles'. */
      collection?: string
      /** action 'profiles' only: the people to name, 1-64 ids exactly as a document or live event showed them ("u_" plus 22 characters). */
      ids?: string[]
      /** Document id (one path segment). Required for action 'get', 'set', 'update', 'str_replace' and 'delete'; not accepted with 'list' or 'query'. */
      doc_id?: string
      /** Options for action 'list' and 'query': `limit` (1-1000, default 100) and `cursor` (from a prior result's `next_cursor`) page through a collection; `where` clauses ([field, operator, value] triples) and `order_by` filter and order a 'query' only. A query with `order_by` is a single page: it returns at most `limit` documents in that order and never a `next_cursor`, so pass the `limit` you mean (up to 1000), or drop `order_by` and page with `cursor` to read a whole collection. */
      query?: {
        where?: unknown[][]
        order_by?: {
          field: string
          direction?: "asc" | "desc"
        }
        limit?: number
        cursor?: string
      }
      /** action 'str_replace' only: the top-level string field of the document to edit — one plain key, e.g. "html" (1-200 bytes; no dots, slashes, brackets, quotes, backslashes, control or invisible formatting characters; not a reserved __name__ key). */
      field?: string
      /** action 'str_replace' only: the exact text to replace, as it appears in the field's value. It must occur exactly once in that field; otherwise nothing is written and the result says whether it was absent or not unique. */
      old_str?: string
      /** action 'str_replace' only: the replacement text (may be empty to delete old_str). */
      new_str?: string
      /** action 'str_replace' only: replace every occurrence of old_str in the field instead of requiring it to occur exactly once (default false). old_str must still occur at least once. */
      replace_all?: boolean
      /** action 'set', 'update', 'str_replace' or 'delete' (a 'batch' pins each entry in `writes` instead): the document's `version` as you last read it (every document a get, list or query returns carries it, and so does every set, update and str_replace result). Required on every write to a document that already exists; omit it only when creating one. The write applies only if the document is still at that version: if it changed, nothing is written and the result names the current version, so pin the write instead of re-reading first to check. A write to an existing document that carries no if_version is refused until you read the document. */
      if_version?: number
      /** set and update: the document fields to write, as a JSON object — pass exactly one of `data` or `file_path`. In an update, a field given as `{"__delete__": true}` is removed instead. */
      data?: {}
      /** set and update: a local JSON file whose top-level object is sent as the document — an alternative to inline `data`, so a large document need not pass through the conversation. */
      file_path?: string
      /** get, list and query: when given, each returned document is written as pretty-printed JSON to <out_dir>/<collection path>/<doc_id>.json (directories created as needed) and the result lists the files instead of the document contents — use it for large documents or many of them. */
      out_dir?: string
      /** Act at this access level instead of your own, to check what the page's access rules let such a user do — 'view' is someone the artifact is shared with who can only view it, 'interact' any signed-in viewer who can use the page, 'admin' someone who can edit it. It narrows, never raises, your access and keeps your identity (`me` is still you); at 'view' nothing can be written, your own data/users subtree included. At a lowered level a write the rules refuse reads as not found and a refused read as empty. Omit it to act as yourself. */
      as_level?: "view" | "interact" | "admin"
    }
    AskUserQuestion: {
      /** Questions to ask the user (1-4 questions) */
      questions: Array<{
        /** The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?" */
        question: string
        /** Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach". */
        header: string
        /** The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically. */
        options: Array<{
          /** The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice. */
          label: string
          /** Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications. */
          description: string
          /** Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format. */
          preview?: string
        }>
        /** Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive. */
        multiSelect: boolean
      }>
      /** User answers collected by the permission component */
      answers?: {}
      /** Optional per-question annotations from the user (e.g., notes on preview selections). Keyed by question text. */
      annotations?: {}
      /** Optional metadata for tracking and analytics purposes. Not displayed to user. */
      metadata?: {
        /** Optional identifier for the source of this question (e.g., "remember" for /remember command). Used for analytics tracking. */
        source?: string
      }
    }
    Bash: {
      /** The command to execute */
      command: string
      /** Optional timeout in milliseconds (max 600000 for a foreground command) */
      timeout?: number
      /** Clear, concise description of what this command does in active voice. Never use words like "complex" or "risk" in the description - just describe what it does. Say what the command does in plain words: do not echo the command's text, its flags, or file paths - the user reads this description, often without seeing the command. For simple commands (git, npm, standard CLI tools), keep it brief (5-10 words): - ls → "List files in current directory" - git status → "Show working tree status" - npm install → "Install package dependencies" For commands that are harder to parse at a glance (piped commands, obscure flags, etc.), add enough context to clarify what it does: - find . -name "*.tmp" -exec rm {} \; → "Find and delete all .tmp files recursively" - git reset --hard origin/main → "Discard all local changes and match remote main" - curl -s url | jq '.data[]' → "Fetch JSON from URL and extract data array elements" */
      description?: string
      /** Set to true to run this command in the background. */
      run_in_background?: boolean
      /** Set this to true to dangerously override sandbox mode and run commands without sandboxing. */
      dangerouslyDisableSandbox?: boolean
    }
    ClaudeDesign: {
      /** Claude Design action to perform. Call with "list" first to discover the available operations and their argument schemas. */
      operation: string
      /** Action input object (server-validated). Pass {} for operations that take no input. */
      arguments: {}
    }
    CronCreate: {
      /** Standard 5-field cron expression in local time: "M H DoM Mon DoW" (e.g. "* /5 * * * *" = every 5 minutes, "30 14 28 2 *" = Feb 28 at 2:30pm local once). */
      cron: string
      /** The prompt to enqueue at each fire time. */
      prompt: string
      /** true (default) = fire on every cron match until deleted or auto-expired after 7 days. false = fire once at the next match, then auto-delete. Use false for "remind me at X" one-shot requests with pinned minute/hour/dom/month. */
      recurring?: boolean
      /** Has no effect — durable persistence is not available. All jobs are session-only (in-memory, gone when this Claude session ends). */
      durable?: boolean
    }
    CronDelete: {
      /** Job ID returned by CronCreate. */
      id: string
    }
    CronList: {}
    DesignSync: {
      method: "list_projects" | "get_project" | "list_files" | "get_file" | "finalize_plan" | "write_files" | "delete_files" | "register_assets" | "unregister_assets" | "create_project" | "report_validate"
      /** Required for all methods except list_projects and create_project */
      projectId?: string
      /** get_file: file path to read */
      path?: string
      /** finalize_plan: exact paths or glob patterns that will be written. `*` matches within a single segment, `**` matches any depth (e.g. `ui_kits/acme/** /*.html`). Max 3 `*`/`**` wildcards per pattern and max 256 entries — use broader globs to cover more files rather than enumerating paths. */
      writes?: string[]
      /** finalize_plan: exact paths or glob patterns that will be deleted (same syntax and limits as writes). */
      deletes?: string[]
      /** write_files/delete_files/register_assets/unregister_assets: token from a prior finalize_plan call */
      planId?: string
      /** write_files: file contents to write (max 256 per call — split larger bundles across multiple write_files calls under the same planId). */
      files?: Array<{
        /** Path within the project, e.g. components/button/index.html */
        path: string
        /** Path on disk to read file contents from, relative to the localDir approved at finalize_plan. Preferred for anything you have on disk: the tool reads, encodes, and uploads directly so the contents never enter the model context. Mutually exclusive with data. */
        localPath?: string
        /** Inline file contents (UTF-8 text, or base64 when encoding is "base64"). For small dynamic content only — anything you have on disk should use localPath instead. */
        data?: string
        /** Set to "base64" for binary inline data */
        encoding?: "base64"
        mimeType?: string
      }>
      /** delete_files: paths to delete. unregister_assets: paths whose Design System pane card should be removed. Max 256 per call — split larger batches across multiple calls under the same planId. */
      paths?: string[]
      /** create_project: name for the new design-system project */
      name?: string
      /** register_assets: cards to register in the Design System pane. Each path must be in the finalized plan. Run after write_files succeeds. Max 256 per call. */
      assets?: Array<{
        /** Short human-readable label ("Primary buttons"), not a path */
        name: string
        /** Project-relative path to the preview/spec file this card renders */
        path: string
        /** Variants shown ("Primary / secondary / ghost, 3 sizes") */
        subtitle?: string
        /** Card dimensions in the Design System pane */
        viewport?: {
          width: number
          height?: number
        }
        /** Free-form section label for the Design System pane (max 64 chars). Use the source design system's own categorization if it has one — e.g. Material has Buttons/Cards/Forms/etc., a corporate kit might have Actions/Forms/Navigation. Common foundational labels: "Type", "Colors", "Spacing", "Components", "Brand". The pane groups by the value you send. */
        group?: string
      }>
      /** finalize_plan: directory the bundle was built into. write_files with localPath may only read files inside this directory. Defaults to the current working directory. Resolved to an absolute path and shown in the permission prompt. */
      localDir?: string
      /** report_validate: aggregate from the final .render-check.json — counts only, no component names or paths. */
      counts?: {
        total: number
        bad: number
        thin: number
        variantsIdentical: number
        iterations: number
      }
    }
    Edit: {
      /** The absolute path to the file to modify */
      file_path: string
      /** The text to replace */
      old_string: string
      /** The text to replace it with (must be different from old_string) */
      new_string: string
      /** Replace all occurrences of old_string (default false) */
      replace_all?: boolean
    }
    "enable__mcp__claude-in-chrome": {
      /** Optional: what you are about to do in the browser, in one or two sentences. */
      task?: string
    }
    "enable__mcp__remote-devices__Claude_Browser": {
      /** Optional: what you are about to do in the browser, in one or two sentences. */
      task?: string
    }
    "enable__mcp__remote-devices__computer": {
      /** Optional: what you are about to do on the computer, in one or two sentences. */
      task?: string
    }
    EndConversation: {}
    EnterPlanMode: {}
    EnterWorktree: {
      /** Optional name for a new worktree. Each "/"-separated segment may contain only letters, digits, dots, underscores, and dashes; max 64 chars total. A random name is generated if not provided. Mutually exclusive with `path`. */
      name?: string
      /** Path to an existing worktree to switch into instead of creating a new one. Must appear in `git worktree list` for the current repo — or, on first entry from the launch directory, for a repo nested inside it (multi-repo workspace). Mutually exclusive with `name`. */
      path?: string
    }
    ExitPlanMode: {
      /** Deprecated: no longer used. */
      allowedPrompts?: Array<{
        /** The tool this prompt applies to */
        tool: "Bash"
        /** Semantic description of the action, e.g. "run tests", "install dependencies" */
        prompt: string
      }>
    }
    ExitWorktree: {
      /** "keep" leaves the worktree and branch on disk; "remove" deletes both. */
      action: "keep" | "remove"
      /** Required true when action is "remove" and the worktree has uncommitted files or unmerged commits. The tool will refuse and list them otherwise. */
      discard_changes?: boolean
    }
    FetchInboxMessage: {
      /** The file_id from the session-inbox notification you received */
      file_id: string
    }
    GetTask: {
      /** The taskId from the result that moved the command to the background */
      taskId: string
    }
    ListAgents: {
      /** Not available in this build; leave unset. */
      channel?: string
      /** Not available in this build; leave unset. */
      q?: string
    }
    ListConnectors: {
      /** Optional filter; omit to list everything. */
      keywords?: string[]
    }
    ListMcpResourcesTool: {
      /** Optional server name to filter resources by */
      server?: string
    }
    ListPlugins: {
      /** Optional filter; omit to list everything. */
      keywords?: string[]
    }
    ListSkills: {
      /** Optional filter; omit to list everything. */
      keywords?: string[]
    }
    LSP: {
      /** The LSP operation to perform */
      operation: "goToDefinition" | "findReferences" | "hover" | "documentSymbol" | "workspaceSymbol" | "goToImplementation" | "prepareCallHierarchy" | "incomingCalls" | "outgoingCalls"
      /** The absolute or relative path to the file */
      filePath: string
      /** The line number (1-based, as shown in editors) */
      line: number
      /** The character offset (1-based, as shown in editors) */
      character: number
      /** The symbol name or partial name to search for (workspaceSymbol only). Most language servers return no results for an empty query, so always provide it when using workspaceSymbol. */
      query?: string
    }
    memory_list: {
      /** Id of the memory store to list. Omit to list the memory stores available in this session (id, description, writable or read-only, and the path of its index document). */
      store?: string
      /** Optional directory prefix to list only documents under it (e.g. /feedback/). Matching is directory-aligned (/x is the same as /x/). Omit to list the whole store. */
      path_prefix?: string
      /** Path of the last entry from a previous call. Returns entries after this path. */
      cursor?: string
    }
    memory_read: {
      /** Id of the memory store to read from (call memory_list with no arguments to see the stores available in this session). */
      store: string
      /** Path of the memory document to read (e.g. /MEMORY.md). */
      path: string
    }
    memory_write: {
      /** Id of the memory store to write to (call memory_list with no arguments to see the stores available in this session). */
      store: string
      /** Path of the document to create or update (e.g. /feedback_testing.md). */
      path: string
      /** Full text content to write (UTF-8). Replaces the entire document — any line you omit is deleted. Line endings are normalized to LF, invisible/format characters are stripped, and other control characters are replaced with U+FFFD. Empty or whitespace-only content is rejected. Capped at 100KB per document. */
      content: string
      /** Pass the 12-character version token from your most recent memory_read or memory_write of this file. For a file that does not yet exist (not shown in the listing), pass the literal word new (without quotes; an empty string is treated the same way). For any file already in the listing, memory_read it first to get its version token — the listing itself does not contain version tokens. Never invent a value. */
      if_version: string
    }
    Monitor: {
      /** Short human-readable description of what you are monitoring (shown in notifications). */
      description: string
      /** Kill the monitor after this deadline. Default 300000ms. Deadlines above 1800000ms are capped to 1800000ms. You are notified at expiry and can re-arm. */
      timeout_ms: number
      /** Shell command or script. Each stdout line is an event; exit ends the watch. */
      command?: string
      /** WebSocket to open. Each text frame is an event; binary frames are reported as a placeholder line. Socket close ends the watch. Cannot be combined with command. */
      ws?: {
        url: string
        protocols?: string[]
      }
    }
    NotebookEdit: {
      /** The absolute path to the Jupyter notebook file to edit (must be absolute, not relative) */
      notebook_path: string
      /** The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified. */
      cell_id?: string
      /** The new source for the cell */
      new_source: string
      /** The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required. */
      cell_type?: "code" | "markdown"
      /** The type of edit to make (replace, insert, delete). Defaults to replace. */
      edit_mode?: "replace" | "insert" | "delete"
    }
    OfferChromeSetup: {
      /** A short phrase naming what the task needs the user's own browser for. */
      reason?: string
    }
    Poll: {}
    Projects: {
      method: "project_info" | "project_read" | "project_search" | "project_write" | "project_delete" | "project_memory_list" | "project_memory_read"
      /** project_read/project_write/project_delete: doc path. project_write: an existing path is replaced in place; a new bare filename (no "/") is namespaced to "claude/<name>". project_memory_read: memory file path as listed by project_memory_list. */
      path?: string
      /** project_write: inline doc text. Mutually exclusive with local_path. Use local_path for anything you have on disk. */
      content?: string
      /** project_write: a file inside the working directory to upload. The tool reads, encodes, and uploads directly — contents never enter your context. Mutually exclusive with content. */
      local_path?: string
      /** project_write: true marks this doc as the file the user needs to see — the deliverable they asked for or must act on. Defaults to false; leave it unset for routine saves, notes, and bulk writes. */
      present_to_user?: boolean
      /** project_search: knowledge-base query */
      query?: string
      /** project_search: number of hits (default 5) */
      n?: number
    }
    propose_skills: {
      proposals: Array<{
        /** kebab-case skill slug; must not contain "claude" or "anthropic"; at most 64 characters for a new skill */
        name: string
        kind: "new" | "improvement"
        /** Name of the existing skill to update. Required when kind is 'improvement'; omit for 'new'. */
        target?: string
        /** One short sentence saying when to use this skill: aim for under 200 characters, never more than 1024, and no angle brackets. Shown on the review card and saved as the skill's description, which is what decides when the skill is used. For an improvement, reuse the existing skill's description unless the change alters when the skill applies. */
        description: string
        /** memory file paths where this procedure was observed */
        evidence?: string[]
        /** The complete SKILL.md exactly as it should be saved: frontmatter plus the full body. When the user saves, the body below the frontmatter becomes the skill's entire instructions and the name and description come from the fields above; other frontmatter keys are not kept. For an improvement this replaces the existing skill's SKILL.md entirely, so read that skill's current SKILL.md first and include everything worth keeping, not only the changes. */
        skillMd: string
      }>
    }
    ProposeGoal: {
      /** The completion condition to propose, written so a separate evaluator can verify it from the conversation (e.g. "all tests in test/auth pass (bun test exits 0)"). At most 500 characters — the user must be able to read the whole condition in the approval dialog. */
      condition: string
      /** Whether to ask the user for approval before the goal is set. Defaults to true — an approval dialog is shown. Set false ONLY when the user's own words in this conversation stated this outcome as what they want; the goal is then set directly, with a visible notice in the transcript, and the user can clear it with /goal clear. */
      ask_user?: boolean
    }
    PublishPlugin: {
      /** The plugin's folder on this machine: the one that holds .claude-plugin/plugin.json, or a mod's hooks/ where there is no manifest yet. */
      path: string
      /** Where to publish. The one destination is the library of the organization the session is signed in to. */
      destination?: "organization"
      /** What the plugin does, in a sentence: used only for a manifest written for a folder that has none. */
      description?: string
      /** True only when the person said to replace the plugin of the same name that is already in their uploads on claude.ai. */
      replace?: boolean
      /** Leave out. The tool fills it for the question the person answers: the organization, the folder, the steps, and the files sent. */
      shown?: string[]
      /** Leave out. The tool fills it with the same question as data, for a surface that draws its own: what a yes binds to, every file sent, and the entries that stay and are named. */
      question?: {
        /** What a yes binds to: the publish is of this, or refused. */
        digest: string
        title: string
        organization: {
          id: string
          name?: string
        }
        plugin: {
          name: string
          version?: string
        }
        folder: string
        /** Whether a plugin of this name on the shelf is replaced. */
        mode: "new" | "replace"
        /** What a yes sets off, a sentence each, in order. */
        steps: string[]
        /** What the person is warned of, a sentence each: a file sent although its name is one a secret hides under, and that other entries stay behind unnamed. */
        warnings: string[]
        /** The manifest a yes writes into the folder first, if any. */
        writes?: {
          path: string
          text: string
        }
        /** The whole count and size of what is sent. */
        sends: {
          files: number
          bytes: number
        }
        /** The files sent, in the order of their paths. */
        files: Array<{
          path: string
          bytes: number
          sha256: string
          /** Whether it is sent as runnable. */
          runs: boolean
        }>
        /** How many entries stay on the machine and are counted here. */
        staying: number
        /** The entries that stay and are named, each with why. */
        stays: Array<{
          path: string
          why: "link" | "hard-link" | "ignored" | "secret" | "never" | "generated" | "special" | "backslash"
          words: string
        }>
        /** The list, a line each, of every file sent and every entry that stays and is named, and a last line saying so where entries stay unnamed: its sha256, and the file that holds it. */
        list: {
          sha256: string
          path?: string
        }
        /** Present only when the lists are over the bound: how many files and entries they do not name. The list file names them. */
        unnamed?: {
          files: number
          stays: number
        }
      }
    }
    PushNotification: {
      /** The notification body. Keep it under 200 characters; mobile OSes truncate. */
      message: string
      status: "proactive"
    }
    Read: {
      /** The absolute path to the file to read */
      file_path: string
      /** The line number to start reading from. Only provide if the file is too large to read at once */
      offset?: number
      /** The number of lines to read. Only provide if the file is too large to read at once. */
      limit?: number
      /** Page range for PDF files (e.g., "1-5", "3", "10-20"). Only applicable to PDF files. Maximum 20 pages per request. */
      pages?: string
    }
    ReadMcpResourceDirTool: {
      /** The MCP server name */
      server: string
      /** The directory resource URI to list */
      uri: string
    }
    ReadMcpResourceTool: {
      /** The MCP server name */
      server: string
      /** The resource URI to read */
      uri: string
    }
    ReadNotifications: {}
    RemoteTrigger: {
      action: "list" | "get" | "create" | "update" | "run" | "create_webhook_trigger" | "list_runs" | "get_run_log"
      /** Required for get, update, run, and list_runs */
      trigger_id?: string
      /** Required for get_run_log: a run session id (cse_… or session_…, from list_runs) */
      session_id?: string
      /** next_cursor from a previous list_runs or get_run_log page */
      cursor?: string
      /** Required for create and update; optional for run */
      body?: {}
    }
    ReportFindings: {
      /** Effort level the review ran at */
      level?: "low" | "medium" | "high" | "xhigh" | "max"
      /** Verified findings, most-severe first; empty if none survived */
      findings: Array<{
        /** Repo-relative path of the file the finding is in */
        file: string
        /** 1-indexed line the finding anchors to */
        line?: number
        /** One-sentence statement of the defect */
        summary: string
        /** Compressed label for compact UI (≤60 chars): the claim alone, no rationale or consequence clause */
        short_summary?: string
        /** Concrete inputs/state → wrong output/crash */
        failure_scenario: string
        /** Short kebab-case slug of the finding type, e.g. "correctness", "simplification", "efficiency", "test-coverage" */
        category?: string
        /** Set when a verify pass ran; absent on inline-only reviews */
        verdict?: "CONFIRMED" | "PLAUSIBLE"
        /** Set ONLY when re-reporting after applying fixes: what happened to this finding */
        outcome?: "fixed" | "skipped" | "no_change_needed"
      }>
    }
    request_computer: {
      task?: unknown
    }
    ScheduleWakeup: {
      /** Seconds from now to wake up. Clamped to [60, 3600] by the runtime. Required unless `stop` is true. */
      delaySeconds?: number
      /** One short sentence explaining the chosen delay. Goes to telemetry and is shown to the user. Be specific. Required unless `stop` is true. */
      reason?: string
      /** The /loop input to fire on wake-up. Pass the same /loop input verbatim each turn so the next firing re-enters the skill and continues the loop. For autonomous /loop (no user prompt), pass the literal sentinel `<<autonomous-loop-dynamic>>` instead (the dynamic-pacing variant, not the CronCreate-mode `<<autonomous-loop>>`). Required unless `stop` is true. */
      prompt?: string
      /** Set to true to end the dynamic loop immediately instead of scheduling another wakeup. When true, all other fields are ignored and no further wakeups fire. */
      stop?: boolean
      /** true = nothing changed (you checked and there is nothing to report). false = something happened worth keeping (edited a file, posted a message, advanced state, surfaced a finding). Consecutive noop:true ticks are collapsed in the user's terminal view and tracked as a streak. Required unless `stop` is true. */
      noop?: boolean
    }
    SearchMcpRegistry: {
      /** Keyword phrases describing the user's intent or a named product. */
      keywords: string[]
    }
    SearchPlugins: {
      /** Keyword phrases describing the user's intent. */
      keywords: string[]
    }
    SearchSkills: {
      /** Keyword phrases describing the user's intent. */
      keywords: string[]
    }
    SendFeedback: {
      /** What kind of feedback this is. */
      type: "bug" | "idea" | "missing_capability"
      /** Short, specific one-line summary of the issue. */
      title: string
      /** Labeled bullets, in order: **What happened:** (observed vs. expected, exact error text if short); **What the user said:** (quoted, or "User didn't comment; observed by the model."); **Repro:** (minimal steps); **Evidence:** (request IDs, timestamps, paths, versions; omit if none); optionally a final **Cause:** only if verified in-session. One to three lines per bullet. No narrative paragraphs, no speculation, no secrets. */
      details: string
      /** Optional short tag naming the part of Claude Code this is about (e.g. "hooks config", "/help", "file editing"). Leave blank if unclear. */
      area?: string
      /** When the report is about MODEL BEHAVIOR (not a product bug), the closest failure mode, or `other` when it is a model-behavior issue that fits no listed value. Omit only when the report is a product/tool bug with no model-behavior component. */
      failure_mode?: "instruction_following" | "destructive_actions" | "code_quality" | "repetition_and_looping" | "model_regression" | "overconfidence_and_hallucination" | "context_and_memory" | "overeager" | "over_correction" | "stopping_short" | "dispute_or_decline" | "subagent_overspawn" | "tone_or_preachiness" | "excessive_questions" | "unwanted_scope" | "other"
      /** What kind of task the session was doing when the issue occurred, or `other` when it is a clear task that fits no listed value. Omit only if genuinely unclear. */
      task_category?: "code_edit" | "debug" | "explain" | "plan" | "shell" | "search" | "review" | "other"
    }
    SendFile: {
      /** Recipient: a peer session name from ListAgents, or an explicit uds:<socket> / bridge:<session id> address */
      to: string
      /** File paths (absolute or relative to cwd) to send. Always pass an array, even for a single file. */
      files: string[]
      /** Optional short message delivered alongside the files */
      message?: string
    }
    SendMessage: {
      /** Recipient: a name from ListAgents (append its " [ref]" only when a listing or an error shows one), a teammate name, "main", or a background agent's agentId */
      to: unknown & unknown
      /** A 5-10 word label for your own transcript row (not transmitted — the recipient previews the first line of `message`). Truncated to 200 characters rather than rejected. */
      summary?: string
      /** Plain text message content. The recipient's human sees only the FIRST LINE as a one-line preview until they expand it, so make the first line a clear, self-contained sentence saying what this is about — not a greeting, preamble, or bare @-mention. */
      message: string
      /** Ask a session ON THIS MACHINE to send you ONE notice when it next goes idle (finishes its turn with nothing queued) or exits — opt-in, one-shot, no polling. With a message: deliver it now AND subscribe. Without a message (omit it): a pure subscription that costs the other session nothing. */
      notify_when_idle?: boolean
    }
    SendUserFile: {
      /** File paths (absolute or relative to cwd) to send to the user. Always pass an array, even for a single file. */
      files: string[]
      /** Optional short caption for the file(s). */
      caption?: string
      /** Use 'proactive' when you're surfacing a file the user hasn't asked for and needs to see now — a generated artifact, a completed report. Use 'normal' when replying to something the user just said. */
      status: "normal" | "proactive"
      /** How the client should present the file. 'render' opens it inline in the side panel (for HTML, SVG, Mermaid, images, PDFs — anything the user wants to look at now). 'attach' shows a download card only, no inline preview (for deliverables the user will save and open elsewhere). Omit to let the client decide by file type — today that means renderable types render and everything else attaches, same as before this parameter existed. */
      display?: "render" | "attach"
    }
    SendUserMessage: {
      /** The message for the user. Supports markdown formatting. */
      message: string
    }
    ShareOnboardingGuide: {
      /** 'check' (default): if ONBOARDING.md is present locally, uploads it to the most-recent guide (creates one if none exist); otherwise reports the existing link without uploading. 'update': upload to a specific guide by short_code. 'create': always make a new link. 'delete': remove a guide. */
      mode: "check" | "update" | "create" | "delete"
      /** Short code of a specific guide to target (returned by a previous call). Honored by check, update, and delete — skips the org-wide lookup and targets this guide directly. */
      short_code?: string
    }
    ShowOnboardingRolePicker: {}
    Skill: {
      /** The name of a skill from the available-skills list. Do not guess names. */
      skill: string
      /** Optional arguments for the skill */
      args?: string
    }
    SuggestConnectors: {
      /** directoryUuid or server_id values to resolve. */
      uuids: string[]
    }
    SuggestPluginInstall: {
      /** Short header tying the suggestion to the user request. */
      contextLabel: string
      /** Plugins sourced from SearchPlugins results. */
      plugins: {
        pluginId: string
        pluginName: string
        description: string
        skills?: {
          name: string
          description?: string
        }[]
      }[]
      /** How this suggestion started: 'user_asked' or 'proactive'. */
      trigger?: "user_asked" | "proactive"
    }
    SuggestSkills: {
      /** Topic keywords from the user's request. */
      keywords: string[]
      contextLabel?: string
      /** How this suggestion started: 'user_asked' or 'proactive'. */
      trigger?: "user_asked" | "proactive"
    }
    TaskCreate: {
      /** A brief title for the task */
      subject: string
      /** What needs to be done */
      description: string
      /** Present continuous form shown in spinner when in_progress (e.g., "Running tests") */
      activeForm?: string
      /** Arbitrary metadata to attach to the task */
      metadata?: {}
    }
    TaskGet: {
      /** The ID of the task to retrieve */
      taskId: string
    }
    TaskList: {}
    TaskStop: {
      /** The ID of the background task to stop. Agent-team teammates and named background agents are also accepted by agent ID or name. */
      task_id?: string
      /** Deprecated: use task_id instead */
      shell_id?: string
    }
    TaskUpdate: {
      /** The ID of the task to update */
      taskId: string
      /** New subject for the task */
      subject?: string
      /** New description for the task */
      description?: string
      /** Present continuous form shown in spinner when in_progress (e.g., "Running tests") */
      activeForm?: string
      /** New status for the task */
      status?: "pending" | "in_progress" | "completed" | "deleted"
      /** Task IDs that this task blocks */
      addBlocks?: string[]
      /** Task IDs that block this task */
      addBlockedBy?: string[]
      /** New owner for the task */
      owner?: string
      /** Metadata keys to merge into the task. Set a key to null to delete it. */
      metadata?: {}
    }
    TodoWrite: {
      /** The updated todo list */
      todos: Array<{
        content: string
        status: "pending" | "in_progress" | "completed"
        activeForm: string
      }>
    }
    ToolSearch: {
      /** Query to find deferred tools. Use "select:<tool_name>" for direct selection, or keywords to search. */
      query: string
      /** Maximum number of results to return (default: 5) */
      max_results: number
    }
    WaitForMcpServers: {
      /** Server names to wait for (default: all pending) */
      servers?: string[]
    }
    WebFetch: {
      /** The URL to fetch content from */
      url: string
      /** The prompt to run on the fetched content */
      prompt: string
      /** Character position in the page text to start reading from. Use it to read on through a page too long for one call, with the value the previous result gave. */
      offset?: number
    }
    WebSearch: {
      /** The search query to use */
      query: string
      /** Only include search results from these domains */
      allowed_domains?: string[]
      /** Never include search results from these domains */
      blocked_domains?: string[]
      /** "standard": the normal web search: quick and cheap; right for straightforward lookups (reference facts, official pages, documentation, well-known people, places and topics) and simple follow-up lookups. "extended": a thorough, fresh search at several times the cost and latency. */
      mode: "standard" | "extended"
    }
    Workflow: {
      /** Self-contained workflow script. Must begin with `export const meta = { name, description, phases }` (pure literal, no computed values) followed by the script body using agent()/parallel()/pipeline()/phase(). */
      script?: string
      /** Name of a predefined workflow (built-in or from .claude/workflows/). Resolves to a self-contained script. */
      name?: string
      /** Ignored — set the workflow description in the script's `meta` block. */
      description?: string
      /** Ignored — set the workflow title in the script's `meta` block. */
      title?: string
      /** Optional input value exposed to the script as the global `args`, verbatim. Pass arrays/objects as actual JSON values, NOT as a JSON-encoded string — a stringified list breaks `args.filter`/`args.map` in the script. Use for parameterized named workflows (e.g. a research question). */
      args?: unknown
      /** Path to a workflow script file on disk. Every Workflow invocation persists its script under the session directory and returns the path in the tool result. To iterate, edit that file with Write/Edit and re-invoke Workflow with the same `scriptPath` instead of re-sending the full script. Takes precedence over `script` and `name`. */
      scriptPath?: string
      /** Run ID of a prior Workflow invocation to resume from. Completed agent() calls with unchanged (prompt, opts) return their cached results instantly; only edited or new calls re-run. Same-session only. Stop the prior run first (TaskStop) before resuming. */
      resumeFromRunId?: string
    }
    Write: {
      /** The absolute path to the file to write (must be absolute, not relative) */
      file_path: string
      /** The content to write to the file */
      content: string
    }
  }
}

// The structured results of the same tools, from each tool's output
// schema. Merges into ToolCallResult (BuiltinToolResults) so after
// `e.tool === "Bash"` the `result` of `next(e)` is the tool's record.
declare module 'claude-code' {
  interface BuiltinToolResults {
    Agent: {
      agentId: string
      /** @internal Count of leading harness-authored content blocks (hand-back provenance bookkeeping; not a stable consumer field) */
      harnessNoteCount?: number
      /** @internal Count of trailing harness-authored content blocks (hand-back provenance bookkeeping; not a stable consumer field) */
      harnessTailCount?: number
      /** @internal Fingerprint binding the harness section counts to the exact content they were computed against; a hook rewrite invalidates the counts rather than misplacing rewritten bytes */
      harnessSectionHash?: string
      agentType?: string
      /** @internal How the report reached this result when the subagent reports through the SubagentHandback tool: 'send' = delivered, passed by auto mode's review or with a note that the review could not run; 'flagged' = delivered under a SECURITY WARNING; 'withheld' = nothing was delivered */
      handback?: "send" | "flagged" | "withheld"
      /** @internal The report a 'send' or 'flagged' hand-back delivered, for a client to render instead of content */
      handbackReport?: {
        /** The subagent's whole report, never truncated, with a backslash inserted into text that imitates harness markup, such as a system tag (`<system-reminder>`), a `[harness:` line or a turn marker (`Human:` at the start of a line) */
        text: string
        /** Auto mode's warning to show above `text`: a SECURITY WARNING, or a note that the review could not run */
        warning?: string
      }
      content: Array<{
        type: "text"
        text: string
        citations?: unknown[] | null
      }>
      resolvedModel?: string
      modelsUsed?: string[]
      totalToolUseCount: number
      totalDurationMs: number
      totalTokens: number
      usage: {
        input_tokens: number
        output_tokens: number
        cache_creation_input_tokens: number | null
        cache_read_input_tokens: number | null
        server_tool_use: {
          web_search_requests: number
          web_fetch_requests: number
        } | null
        service_tier: string | null
        cache_creation: {
          ephemeral_1h_input_tokens: number
          ephemeral_5m_input_tokens: number
        } | null
        inference_geo?: string | null
        speed?: string | null
        iterations?: unknown
        output_tokens_details?: {
          thinking_tokens?: number | null
        } | null
        fallback_credit?: unknown
      }
      toolStats?: {
        readCount: number
        searchCount: number
        bashCount: number
        editFileCount: number
        linesAdded: number
        linesRemoved: number
        otherToolCount: number
        frameCount?: number
      }
      status: "completed"
      prompt: string
      worktreePath?: string
      worktreeBranch?: string
    } | {
      status: "async_launched"
      isAsync?: true
      /** The ID of the async agent */
      agentId: string
      /** The description of the task */
      description: string
      /** Model in use at the backgrounding transition (a pre-background swap is reflected here) */
      resolvedModel?: string
      /** Ordered distinct models used before backgrounding (length > 1 means a mid-run swap) */
      modelsUsed?: string[]
      /** The prompt for the agent */
      prompt: string
      /** Path to the output file for checking agent progress */
      outputFile: string
      /** Whether the calling agent has Read/Bash tools to check progress */
      canReadOutputFile?: boolean
      /** @internal True when this unisolated write-capable agent was launched into a working directory where another one is already running and a worktree could have been made here (drives a model-facing note; not a stable consumer field) */
      sharesCwd?: boolean
    } | {
      status: "remote_launched"
      /** The ID of the remote agent task */
      taskId: string
      /** The URL of the cloud session */
      sessionUrl: string
      /** The description of the task */
      description: string
      /** The prompt for the agent */
      prompt: string
      /** Path to the output file for checking agent progress */
      outputFile: string
    }
    AppifactRepl: {
      /** The script's stdout */
      output: string
      /** The script's stderr */
      stderr: string
      /** The script's exit code; null when a signal ended it or it never started */
      exitCode: number | null
      /** The signal that ended the script, if one did */
      signal: string | null
      /** Why the run ended without running the whole code: an interruption, or a spawn failure */
      note?: string
      /** What the script sent with claude.see(), one entry per call, as attached */
      seen?: Array<{
        /** The call's text block, fenced */
        text: string
        images: Array<{
          media_type: "image/png" | "image/jpeg"
          /** base64 */
          data: string
        }>
      }>
    }
    Artifact: {
      created_from_type: true
      already_created?: true
      url: string
      version: string
      path?: string
      title?: string
      type: {
        url: string
        release: string
      }
      own_files: string[]
      type_files: string[]
      files_written?: {
        path: string
        sha256: string
      }[]
      files_removed?: string[]
      auto_open?: "at_create" | "after_first_write"
      warnings?: string[]
      files_error?: string
      files_error_kind?: "type_owned_path"
      provisioned?: {
        store: string
        project_id: string
        file_id?: string
        node_id?: string
      }
      liveSubscription?: string
      pinned?: boolean
      instructions?: string
      instructions_chars?: number
      instructions_clipped?: boolean
      instructions_unavailable?: string
      init_references?: {
        docs: {
          path: string
          text: string
          chars: number
          clipped?: boolean
        }[]
        unavailable?: {
          path: string
          why: string
        }[]
      }
      after_quickstart?: {
        design_system?: string
        saved_system?: string
        saved_system_dir?: string
        saved_pages_dir?: string
        not_listed?: boolean
      }
      design_systems?: {
        type?: string
        type_url?: string
        scope: string
        instances: {
          title: string
          url: string
          description?: string
          created_at?: string
          rel?: string
          audience?: string
          default?: string
        }[]
        more?: boolean
        overflow?: boolean
        dropped?: number
        unavailable?: boolean
      }
      design_systems_note?: string
      design_system?: {
        url?: string
        default?: string
        title?: string
        store?: boolean
        docs?: {
          path: string
          text: string
          chars: number
          clipped?: boolean
        }[]
        unavailable?: string
      }
    } | {
      opened: true
      url: string
      artifact_id: string
      title?: string
    } | {
      url: string
      path: string
      artifact_id?: string
      title?: string
      version?: string
      capabilities?: unknown
      stored?: {
        contract: string
        preferredContract?: string
        capabilities?: {}
        carried?: boolean
        read?: string
      }
      warnings?: string[]
      publishesRemaining?: number
      publishesResetAt?: number
      contract?: string
      updated?: boolean
      icon?: string
      faviconSent?: true
      iconDropped?: true
      audience?: string
      seq?: number
      unchanged?: true
      merged_over?: {
        base: string
        live?: string
        changed?: Array<{
          path: string
          sha256: string | null
        }>
        omitted?: number
      }
      liveSubscription?: string
      verifyGuide?: string
      seededThread?: string
      copied?: {
        path: string
        from_url: string
        from_path: string
      }[]
      files_written?: {
        path: string
        sha256: string
      }[]
      files_removed?: string[]
      pinned?: boolean
      /** The Artifact type (and release) this Artifact was created from */
      type?: {
        url: string
        release: string
        latest?: string
        blocked?: {
          to?: string
          reason: string
          conflict_count?: number
          paths?: string[]
        }
      }
      own_files?: string[]
      type_files?: string[]
    } | {
      artifacts: Array<{
        title: string
        url: string
        favicon?: string
        updatedAt?: string
        rel?: "mine" | "shared"
        external?: true
        role?: "editor" | "commenter" | "reader" | "viewer"
        pinned?: boolean
      }>
      truncated?: boolean
      total?: number
      total_at_least?: true
      pins_enabled?: boolean
      scope?: "shared" | "all"
      external_listed?: true
    } | {
      read: {
        url: string
        bytes: number
        code: number
        codeText: string
        result: string
        durationMs: number
        title?: string
      }
      artifactRead?: {
        slug: string
        ver?: string
        seeded?: false
      }
    } | {
      artifact_types: {
        title: string
        type_url: string
        description?: string
        tier?: string
      }[]
      query?: string
      more?: boolean
      dropped?: number
      unavailable?: boolean
      docs_unfillable?: boolean
    } | {
      artifact_type: {
        title: string
        type_url: string
        description?: string
        tier?: string
        release?: string
        files: string[]
        files_omitted?: number
        instructions_file: boolean
        instructions?: string
        instructions_chars?: number
        instructions_clipped?: boolean
        instructions_unavailable?: string
        capabilities: string[]
        creatable?: boolean
      }
      read_of_type_link?: true
      type_file?: {
        path: string
        content?: string
        chars?: number
        clipped?: boolean
        unread?: "withheld" | "not_listed" | "not_text" | "too_large" | "unavailable"
        why?: string
      }
    } | {
      type_instances: {
        type?: string
        type_url?: string
        scope: string
        instances: {
          title: string
          url: string
          description?: string
          created_at?: string
          rel?: string
          audience?: string
          default?: string
        }[]
        more?: boolean
        overflow?: boolean
        dropped?: number
        unavailable?: boolean
      }
    } | {
      quickstart: {
        intent: string
        match?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }
        match_of?: number
        types?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }[]
        types_more?: boolean
        dashboard_type?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }
        types_unavailable?: boolean
        types_ruled?: boolean
        types_ambiguous?: boolean
        types_partial?: boolean
        types_note?: string
        types_hooked?: boolean
        docs_connector?: boolean
        design_systems?: {
          type?: string
          type_url?: string
          scope: string
          instances: {
            title: string
            url: string
            description?: string
            created_at?: string
            rel?: string
            audience?: string
            default?: string
          }[]
          more?: boolean
          overflow?: boolean
          dropped?: number
          unavailable?: boolean
        }
        design_systems_note?: string
        design_systems_off?: boolean
        design_system?: {
          url?: string
          default?: string
          title?: string
          store?: boolean
          docs?: {
            path: string
            text: string
            chars: number
            clipped?: boolean
          }[]
          unavailable?: string
        }
        design_guidance?: boolean
        start_kit?: {
          type?: {
            dir: string
            files: {
              path: string
              bytes: number
            }[]
            skipped: {
              path: string
              reason: string
            }[]
          }
          system_url?: string
          system?: {
            dir: string
            files: {
              path: string
              bytes: number
            }[]
            skipped: {
              path: string
              reason: string
            }[]
          }
          skill_in_result: boolean
          capabilities_skill: boolean
          repl_tool?: boolean
        }
      }
    } | {
      threads_dropped?: boolean
      thread_filter?: string
      scoped_dispatch?: boolean
      foreign?: true
      cursor?: string
      outside_org?: boolean
      page_owns_threads?: boolean
      names?: {}
      threads: {
        id: string
        created_at?: string
        resolved: boolean
        resolved_degraded?: boolean
        resolved_by_claude?: boolean
        claude_activated: boolean
        activated_degraded?: boolean
        carried?: boolean
        anchor_path?: string
        span_quote?: string
        anchor_file?: string
        anchor_file_degraded?: boolean
        anchor_file_sha?: string
        anchor_moved_at?: string
        anchor_label?: string
        anchor_detail?: string
        anchor_snippet?: string
        anchor_region?: boolean
        region_inside?: string[]
        comments_degraded?: boolean
        comments: {
          id: string
          account: string
          role?: string
          text: string
          created_at?: string
          sent_to_claude?: boolean
          sent_to_claude_degraded?: boolean
          sent_by_viewer?: boolean
          posted_by_artifact?: boolean
          awaiting_reply?: boolean
          presence?: string
          access?: string
          outside?: true
        }[]
      }[]
    } | {
      replied: boolean
      thread_id: string
      comment_id?: string
      replayed?: boolean
      not_activated?: boolean
      summon_answered?: boolean
      summon_foreign?: boolean
      already_answered?: boolean
      page_owns_threads?: boolean
      standing_reply_id?: string
    } | {
      thread_resolved: boolean
      thread_id: string
      not_activated?: boolean
      not_authorized?: boolean
      summon_foreign?: boolean
      relayed_credential?: boolean
      page_owns_threads?: boolean
    } | {
      watch: {
        url: string
        watching: boolean
        outcome: string
        reason?: string
        durable_skip_reason?: string
        task_id?: string
        since?: number
        token_expires_at?: number
        auto_reply?: string
        can_edit?: boolean
        user_turn?: boolean
        named_by_user?: boolean
        replies_declined?: boolean
        rail?: string
        trigger_id?: string
        durable_since?: string
        status?: number
        detail?: string
        note?: string
        events?: string[]
      }
    } | {
      unwatch: {
        url: string
        was_watching: boolean
      }
    } | {
      resume_replies: {
        url: string
        resumed: boolean
        outcome: string
        reason?: string
        task_id?: string
        stop_kind?: string
        in_place?: boolean
        connecting?: boolean
      }
    } | {
      watches: Array<{
        url: string
        task_id: string
        since: number
        explicit: boolean
        connected: boolean
        connecting?: boolean
        token_expires_at: number
        armed_via?: string
        auto_reply?: string
        unread_plain_comments?: number
        summons_awaiting_reply?: number
        comments_uncounted?: boolean
        comments_partially_counted?: boolean
      } | {
        url: string
        rail: "durable_wake"
        trigger_id: string
        since: string
        events?: string[]
        restored?: boolean
      } | {
        url: string
        rail: "live_stopped"
        since?: number
        explicit?: boolean
        armed_via?: string
        auto_reply: string
        stop_kind: string
      }>
      filter_url?: string
      arms?: {
        url: string
        rail?: string
        state: string
        reconnect?: boolean
        failures?: number
        max_failures?: number
        next_in_s?: number
        last_failure?: string
        reason?: string
        detail?: string
        server_message?: string
        at?: number
      }[]
    } | {
      db_read: {
        op: string
        collection: string
        doc_id?: string
        found?: boolean
        as_level?: string
        as_level_confirmed?: boolean
        docs?: {
          id: string
          data: {}
          version?: number
          updatedAt?: string
        }[]
        next_cursor?: string
        me_id?: string
        ordered_by?: {
          field: string
          limit: number
        }
        foreign?: true
        outside_writer?: true
        saved?: {
          dir: string
          files: {
            id: string
            path: string
            bytes: number
            compact?: boolean
            version?: number
            updatedAt?: string
          }[]
          skipped: {
            id: string
            reason: string
          }[]
        }
      }
    } | {
      db_profiles: {
        ids: string[]
        profiles?: {}
        unavailable?: true
      }
    } | {
      written?: {
        url: string
      }
      as_level?: string
      as_level_confirmed?: boolean
      db_write: {
        op: string
        collection: string
        doc_id: string
        field?: string
        replace_all?: true
        version?: number
        committed: boolean
        usage?: {
          documents: number
          max_documents: number
        }
        embedded?: {
          strings: number
          kb: number
        }
        warnings?: string[]
      } | {
        op: "batch"
        committed: boolean
        results: {
          op: string
          collection: string
          doc_id: string
          field?: string
          replace_all?: true
          version?: number
        }[]
        usage?: {
          documents: number
          max_documents: number
        }
        embedded?: {
          strings: number
          kb: number
        }
        warnings?: string[]
        fallback?: "sequential"
      }
    } | {
      room_send: {
        url: string
        topic: string
        delivered: boolean
        peers?: number
        reason?: string
      }
    } | {
      written?: {
        url: string
      }
      asset_upload: {
        id: string
        url: string
        size_bytes: number
        content_type: string
        sha256?: string
        file_name: string
      }
    } | {
      written?: {
        url: string
      }
      asset_uploads: {
        url: string
        results: Array<{
          file_path: string
          status: "uploaded"
          id: string
          url: string
          size_bytes: number
          content_type: string
          sha256?: string
          file_name: string
        } | {
          file_path: string
          status: "failed" | "not_attempted"
          reason: string
          message: string
          may_be_stored?: true
        }>
      }
    } | {
      asset_list: {
        url: string
        assets: {
          id: string
          url: string
          content_type: string
          size_bytes: number
          sha256?: string
          created_at: string
        }[]
        usage: {
          files: number
          bytes: number
          max_files: number
          max_bytes: number
        }
        next?: string
        cowritten?: true
        outside_writer?: true
      }
    } | {
      asset_read: {
        id: string
        path: string
        size_bytes: number
        content_type: string
        sha256: string
        cowritten?: true
        outside_writer?: true
        public_read?: true
        foreign?: true
      }
    } | {
      written?: {
        url: string
      }
      asset_delete: {
        id: string
        deleted: boolean
      }
    } | {
      asset_copy: {
        url: string
        from_url: string
        assets: {
          from_id: string
          id: string
          url: string
          size_bytes: number
          content_type: string
          sha256?: string
        }[]
      }
    } | {
      file_list: {
        url: string
        ver: string
        files: {
          path: string
          content_type: string
          size_bytes: number
          sha256: string
          live?: true
        }[]
        cowritten?: true
        outside_writer?: true
        public_read?: true
        narrowed?: true
        single_page?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
        stored?: {
          contract: string
          capabilities?: {}
        }
      }
    } | {
      file_read: {
        url?: string
        title?: string
        path: string
        saved_to: string
        ver: string
        size_bytes: number
        content_type: string
        sha256: string
        content?: string
        content_scrubbed?: true
        as_served?: true
        source?: true
        live?: true
        live_verified?: true
        seq?: number
        cowritten?: true
        outside_writer?: true
        public_read?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
      }
    } | {
      files_read: {
        url: string
        title?: string
        ver: string
        saved_dir: string
        files: Array<{
          path: string
          saved_to: string
          size_bytes: number
          content_type: string
          sha256: string
          content?: string
          content_scrubbed?: true
          as_served?: true
          source?: true
          foreign?: true
        } | {
          path: string
          error: string
        }>
        cowritten?: true
        outside_writer?: true
        public_read?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
      }
    } | {
      artifact_delete: {
        url: string
        deleted: true
        already_gone?: boolean
      }
    } | {
      pin: {
        action: "pin" | "unpin"
        url: string
        pinned: boolean
        title?: string
      }
    } | {
      shared: {
        url: string
        mode: string
        access: string
        read_mode: string
        added: number
        editors?: number
        unchanged?: boolean
        org_name?: string
        title?: string
      }
    } | {
      page_versions: {
        url: string
        rows: {
          id: string
          createdAt?: string
          current?: true
        }[]
        degraded?: true
        cut?: true
      }
    } | {
      verify: {
        url: string
        ver: string
        state: string
        entries: unknown[]
        truncated?: boolean
        dropped?: number
        waited?: boolean
        foreign?: true
      }
    } | {
      preview: {
        file: string
        bytes: number
        widths: number[]
        themes: string[]
        shots: {
          width: number
          theme: string
          height?: number
          pageHeight?: number
          path?: string
          base64?: string
          error?: string
        }[]
        issues: {
          kind: string
          text: string
        }[]
        issuesDropped?: number
        renderError?: string
      }
    } | {
      emulatorPreview: {
        file: string
        outcome: string
        pictures: {
          path: string
          base64?: string
        }[]
        marks?: string[]
        errors?: string[]
        outline?: string
        stopped?: string
      }
    }
    ArtifactCheck: {
      created_from_type: true
      already_created?: true
      url: string
      version: string
      path?: string
      title?: string
      type: {
        url: string
        release: string
      }
      own_files: string[]
      type_files: string[]
      files_written?: {
        path: string
        sha256: string
      }[]
      files_removed?: string[]
      auto_open?: "at_create" | "after_first_write"
      warnings?: string[]
      files_error?: string
      files_error_kind?: "type_owned_path"
      provisioned?: {
        store: string
        project_id: string
        file_id?: string
        node_id?: string
      }
      liveSubscription?: string
      pinned?: boolean
      instructions?: string
      instructions_chars?: number
      instructions_clipped?: boolean
      instructions_unavailable?: string
      init_references?: {
        docs: {
          path: string
          text: string
          chars: number
          clipped?: boolean
        }[]
        unavailable?: {
          path: string
          why: string
        }[]
      }
      after_quickstart?: {
        design_system?: string
        saved_system?: string
        saved_system_dir?: string
        saved_pages_dir?: string
        not_listed?: boolean
      }
      design_systems?: {
        type?: string
        type_url?: string
        scope: string
        instances: {
          title: string
          url: string
          description?: string
          created_at?: string
          rel?: string
          audience?: string
          default?: string
        }[]
        more?: boolean
        overflow?: boolean
        dropped?: number
        unavailable?: boolean
      }
      design_systems_note?: string
      design_system?: {
        url?: string
        default?: string
        title?: string
        store?: boolean
        docs?: {
          path: string
          text: string
          chars: number
          clipped?: boolean
        }[]
        unavailable?: string
      }
    } | {
      opened: true
      url: string
      artifact_id: string
      title?: string
    } | {
      url: string
      path: string
      artifact_id?: string
      title?: string
      version?: string
      capabilities?: unknown
      stored?: {
        contract: string
        preferredContract?: string
        capabilities?: {}
        carried?: boolean
        read?: string
      }
      warnings?: string[]
      publishesRemaining?: number
      publishesResetAt?: number
      contract?: string
      updated?: boolean
      icon?: string
      faviconSent?: true
      iconDropped?: true
      audience?: string
      seq?: number
      unchanged?: true
      merged_over?: {
        base: string
        live?: string
        changed?: Array<{
          path: string
          sha256: string | null
        }>
        omitted?: number
      }
      liveSubscription?: string
      verifyGuide?: string
      seededThread?: string
      copied?: {
        path: string
        from_url: string
        from_path: string
      }[]
      files_written?: {
        path: string
        sha256: string
      }[]
      files_removed?: string[]
      pinned?: boolean
      /** The Artifact type (and release) this Artifact was created from */
      type?: {
        url: string
        release: string
        latest?: string
        blocked?: {
          to?: string
          reason: string
          conflict_count?: number
          paths?: string[]
        }
      }
      own_files?: string[]
      type_files?: string[]
    } | {
      artifacts: Array<{
        title: string
        url: string
        favicon?: string
        updatedAt?: string
        rel?: "mine" | "shared"
        external?: true
        role?: "editor" | "commenter" | "reader" | "viewer"
        pinned?: boolean
      }>
      truncated?: boolean
      total?: number
      total_at_least?: true
      pins_enabled?: boolean
      scope?: "shared" | "all"
      external_listed?: true
    } | {
      read: {
        url: string
        bytes: number
        code: number
        codeText: string
        result: string
        durationMs: number
        title?: string
      }
      artifactRead?: {
        slug: string
        ver?: string
        seeded?: false
      }
    } | {
      artifact_types: {
        title: string
        type_url: string
        description?: string
        tier?: string
      }[]
      query?: string
      more?: boolean
      dropped?: number
      unavailable?: boolean
      docs_unfillable?: boolean
    } | {
      artifact_type: {
        title: string
        type_url: string
        description?: string
        tier?: string
        release?: string
        files: string[]
        files_omitted?: number
        instructions_file: boolean
        instructions?: string
        instructions_chars?: number
        instructions_clipped?: boolean
        instructions_unavailable?: string
        capabilities: string[]
        creatable?: boolean
      }
      read_of_type_link?: true
      type_file?: {
        path: string
        content?: string
        chars?: number
        clipped?: boolean
        unread?: "withheld" | "not_listed" | "not_text" | "too_large" | "unavailable"
        why?: string
      }
    } | {
      type_instances: {
        type?: string
        type_url?: string
        scope: string
        instances: {
          title: string
          url: string
          description?: string
          created_at?: string
          rel?: string
          audience?: string
          default?: string
        }[]
        more?: boolean
        overflow?: boolean
        dropped?: number
        unavailable?: boolean
      }
    } | {
      quickstart: {
        intent: string
        match?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }
        match_of?: number
        types?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }[]
        types_more?: boolean
        dashboard_type?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }
        types_unavailable?: boolean
        types_ruled?: boolean
        types_ambiguous?: boolean
        types_partial?: boolean
        types_note?: string
        types_hooked?: boolean
        docs_connector?: boolean
        design_systems?: {
          type?: string
          type_url?: string
          scope: string
          instances: {
            title: string
            url: string
            description?: string
            created_at?: string
            rel?: string
            audience?: string
            default?: string
          }[]
          more?: boolean
          overflow?: boolean
          dropped?: number
          unavailable?: boolean
        }
        design_systems_note?: string
        design_systems_off?: boolean
        design_system?: {
          url?: string
          default?: string
          title?: string
          store?: boolean
          docs?: {
            path: string
            text: string
            chars: number
            clipped?: boolean
          }[]
          unavailable?: string
        }
        design_guidance?: boolean
        start_kit?: {
          type?: {
            dir: string
            files: {
              path: string
              bytes: number
            }[]
            skipped: {
              path: string
              reason: string
            }[]
          }
          system_url?: string
          system?: {
            dir: string
            files: {
              path: string
              bytes: number
            }[]
            skipped: {
              path: string
              reason: string
            }[]
          }
          skill_in_result: boolean
          capabilities_skill: boolean
          repl_tool?: boolean
        }
      }
    } | {
      threads_dropped?: boolean
      thread_filter?: string
      scoped_dispatch?: boolean
      foreign?: true
      cursor?: string
      outside_org?: boolean
      page_owns_threads?: boolean
      names?: {}
      threads: {
        id: string
        created_at?: string
        resolved: boolean
        resolved_degraded?: boolean
        resolved_by_claude?: boolean
        claude_activated: boolean
        activated_degraded?: boolean
        carried?: boolean
        anchor_path?: string
        span_quote?: string
        anchor_file?: string
        anchor_file_degraded?: boolean
        anchor_file_sha?: string
        anchor_moved_at?: string
        anchor_label?: string
        anchor_detail?: string
        anchor_snippet?: string
        anchor_region?: boolean
        region_inside?: string[]
        comments_degraded?: boolean
        comments: {
          id: string
          account: string
          role?: string
          text: string
          created_at?: string
          sent_to_claude?: boolean
          sent_to_claude_degraded?: boolean
          sent_by_viewer?: boolean
          posted_by_artifact?: boolean
          awaiting_reply?: boolean
          presence?: string
          access?: string
          outside?: true
        }[]
      }[]
    } | {
      replied: boolean
      thread_id: string
      comment_id?: string
      replayed?: boolean
      not_activated?: boolean
      summon_answered?: boolean
      summon_foreign?: boolean
      already_answered?: boolean
      page_owns_threads?: boolean
      standing_reply_id?: string
    } | {
      thread_resolved: boolean
      thread_id: string
      not_activated?: boolean
      not_authorized?: boolean
      summon_foreign?: boolean
      relayed_credential?: boolean
      page_owns_threads?: boolean
    } | {
      watch: {
        url: string
        watching: boolean
        outcome: string
        reason?: string
        durable_skip_reason?: string
        task_id?: string
        since?: number
        token_expires_at?: number
        auto_reply?: string
        can_edit?: boolean
        user_turn?: boolean
        named_by_user?: boolean
        replies_declined?: boolean
        rail?: string
        trigger_id?: string
        durable_since?: string
        status?: number
        detail?: string
        note?: string
        events?: string[]
      }
    } | {
      unwatch: {
        url: string
        was_watching: boolean
      }
    } | {
      resume_replies: {
        url: string
        resumed: boolean
        outcome: string
        reason?: string
        task_id?: string
        stop_kind?: string
        in_place?: boolean
        connecting?: boolean
      }
    } | {
      watches: Array<{
        url: string
        task_id: string
        since: number
        explicit: boolean
        connected: boolean
        connecting?: boolean
        token_expires_at: number
        armed_via?: string
        auto_reply?: string
        unread_plain_comments?: number
        summons_awaiting_reply?: number
        comments_uncounted?: boolean
        comments_partially_counted?: boolean
      } | {
        url: string
        rail: "durable_wake"
        trigger_id: string
        since: string
        events?: string[]
        restored?: boolean
      } | {
        url: string
        rail: "live_stopped"
        since?: number
        explicit?: boolean
        armed_via?: string
        auto_reply: string
        stop_kind: string
      }>
      filter_url?: string
      arms?: {
        url: string
        rail?: string
        state: string
        reconnect?: boolean
        failures?: number
        max_failures?: number
        next_in_s?: number
        last_failure?: string
        reason?: string
        detail?: string
        server_message?: string
        at?: number
      }[]
    } | {
      db_read: {
        op: string
        collection: string
        doc_id?: string
        found?: boolean
        as_level?: string
        as_level_confirmed?: boolean
        docs?: {
          id: string
          data: {}
          version?: number
          updatedAt?: string
        }[]
        next_cursor?: string
        me_id?: string
        ordered_by?: {
          field: string
          limit: number
        }
        foreign?: true
        outside_writer?: true
        saved?: {
          dir: string
          files: {
            id: string
            path: string
            bytes: number
            compact?: boolean
            version?: number
            updatedAt?: string
          }[]
          skipped: {
            id: string
            reason: string
          }[]
        }
      }
    } | {
      db_profiles: {
        ids: string[]
        profiles?: {}
        unavailable?: true
      }
    } | {
      written?: {
        url: string
      }
      as_level?: string
      as_level_confirmed?: boolean
      db_write: {
        op: string
        collection: string
        doc_id: string
        field?: string
        replace_all?: true
        version?: number
        committed: boolean
        usage?: {
          documents: number
          max_documents: number
        }
        embedded?: {
          strings: number
          kb: number
        }
        warnings?: string[]
      } | {
        op: "batch"
        committed: boolean
        results: {
          op: string
          collection: string
          doc_id: string
          field?: string
          replace_all?: true
          version?: number
        }[]
        usage?: {
          documents: number
          max_documents: number
        }
        embedded?: {
          strings: number
          kb: number
        }
        warnings?: string[]
        fallback?: "sequential"
      }
    } | {
      room_send: {
        url: string
        topic: string
        delivered: boolean
        peers?: number
        reason?: string
      }
    } | {
      written?: {
        url: string
      }
      asset_upload: {
        id: string
        url: string
        size_bytes: number
        content_type: string
        sha256?: string
        file_name: string
      }
    } | {
      written?: {
        url: string
      }
      asset_uploads: {
        url: string
        results: Array<{
          file_path: string
          status: "uploaded"
          id: string
          url: string
          size_bytes: number
          content_type: string
          sha256?: string
          file_name: string
        } | {
          file_path: string
          status: "failed" | "not_attempted"
          reason: string
          message: string
          may_be_stored?: true
        }>
      }
    } | {
      asset_list: {
        url: string
        assets: {
          id: string
          url: string
          content_type: string
          size_bytes: number
          sha256?: string
          created_at: string
        }[]
        usage: {
          files: number
          bytes: number
          max_files: number
          max_bytes: number
        }
        next?: string
        cowritten?: true
        outside_writer?: true
      }
    } | {
      asset_read: {
        id: string
        path: string
        size_bytes: number
        content_type: string
        sha256: string
        cowritten?: true
        outside_writer?: true
        public_read?: true
        foreign?: true
      }
    } | {
      written?: {
        url: string
      }
      asset_delete: {
        id: string
        deleted: boolean
      }
    } | {
      asset_copy: {
        url: string
        from_url: string
        assets: {
          from_id: string
          id: string
          url: string
          size_bytes: number
          content_type: string
          sha256?: string
        }[]
      }
    } | {
      file_list: {
        url: string
        ver: string
        files: {
          path: string
          content_type: string
          size_bytes: number
          sha256: string
          live?: true
        }[]
        cowritten?: true
        outside_writer?: true
        public_read?: true
        narrowed?: true
        single_page?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
        stored?: {
          contract: string
          capabilities?: {}
        }
      }
    } | {
      file_read: {
        url?: string
        title?: string
        path: string
        saved_to: string
        ver: string
        size_bytes: number
        content_type: string
        sha256: string
        content?: string
        content_scrubbed?: true
        as_served?: true
        source?: true
        live?: true
        live_verified?: true
        seq?: number
        cowritten?: true
        outside_writer?: true
        public_read?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
      }
    } | {
      files_read: {
        url: string
        title?: string
        ver: string
        saved_dir: string
        files: Array<{
          path: string
          saved_to: string
          size_bytes: number
          content_type: string
          sha256: string
          content?: string
          content_scrubbed?: true
          as_served?: true
          source?: true
          foreign?: true
        } | {
          path: string
          error: string
        }>
        cowritten?: true
        outside_writer?: true
        public_read?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
      }
    } | {
      artifact_delete: {
        url: string
        deleted: true
        already_gone?: boolean
      }
    } | {
      pin: {
        action: "pin" | "unpin"
        url: string
        pinned: boolean
        title?: string
      }
    } | {
      shared: {
        url: string
        mode: string
        access: string
        read_mode: string
        added: number
        editors?: number
        unchanged?: boolean
        org_name?: string
        title?: string
      }
    } | {
      page_versions: {
        url: string
        rows: {
          id: string
          createdAt?: string
          current?: true
        }[]
        degraded?: true
        cut?: true
      }
    } | {
      verify: {
        url: string
        ver: string
        state: string
        entries: unknown[]
        truncated?: boolean
        dropped?: number
        waited?: boolean
        foreign?: true
      }
    } | {
      preview: {
        file: string
        bytes: number
        widths: number[]
        themes: string[]
        shots: {
          width: number
          theme: string
          height?: number
          pageHeight?: number
          path?: string
          base64?: string
          error?: string
        }[]
        issues: {
          kind: string
          text: string
        }[]
        issuesDropped?: number
        renderError?: string
      }
    } | {
      emulatorPreview: {
        file: string
        outcome: string
        pictures: {
          path: string
          base64?: string
        }[]
        marks?: string[]
        errors?: string[]
        outline?: string
        stopped?: string
      }
    }
    ArtifactComments: {
      created_from_type: true
      already_created?: true
      url: string
      version: string
      path?: string
      title?: string
      type: {
        url: string
        release: string
      }
      own_files: string[]
      type_files: string[]
      files_written?: {
        path: string
        sha256: string
      }[]
      files_removed?: string[]
      auto_open?: "at_create" | "after_first_write"
      warnings?: string[]
      files_error?: string
      files_error_kind?: "type_owned_path"
      provisioned?: {
        store: string
        project_id: string
        file_id?: string
        node_id?: string
      }
      liveSubscription?: string
      pinned?: boolean
      instructions?: string
      instructions_chars?: number
      instructions_clipped?: boolean
      instructions_unavailable?: string
      init_references?: {
        docs: {
          path: string
          text: string
          chars: number
          clipped?: boolean
        }[]
        unavailable?: {
          path: string
          why: string
        }[]
      }
      after_quickstart?: {
        design_system?: string
        saved_system?: string
        saved_system_dir?: string
        saved_pages_dir?: string
        not_listed?: boolean
      }
      design_systems?: {
        type?: string
        type_url?: string
        scope: string
        instances: {
          title: string
          url: string
          description?: string
          created_at?: string
          rel?: string
          audience?: string
          default?: string
        }[]
        more?: boolean
        overflow?: boolean
        dropped?: number
        unavailable?: boolean
      }
      design_systems_note?: string
      design_system?: {
        url?: string
        default?: string
        title?: string
        store?: boolean
        docs?: {
          path: string
          text: string
          chars: number
          clipped?: boolean
        }[]
        unavailable?: string
      }
    } | {
      opened: true
      url: string
      artifact_id: string
      title?: string
    } | {
      url: string
      path: string
      artifact_id?: string
      title?: string
      version?: string
      capabilities?: unknown
      stored?: {
        contract: string
        preferredContract?: string
        capabilities?: {}
        carried?: boolean
        read?: string
      }
      warnings?: string[]
      publishesRemaining?: number
      publishesResetAt?: number
      contract?: string
      updated?: boolean
      icon?: string
      faviconSent?: true
      iconDropped?: true
      audience?: string
      seq?: number
      unchanged?: true
      merged_over?: {
        base: string
        live?: string
        changed?: Array<{
          path: string
          sha256: string | null
        }>
        omitted?: number
      }
      liveSubscription?: string
      verifyGuide?: string
      seededThread?: string
      copied?: {
        path: string
        from_url: string
        from_path: string
      }[]
      files_written?: {
        path: string
        sha256: string
      }[]
      files_removed?: string[]
      pinned?: boolean
      /** The Artifact type (and release) this Artifact was created from */
      type?: {
        url: string
        release: string
        latest?: string
        blocked?: {
          to?: string
          reason: string
          conflict_count?: number
          paths?: string[]
        }
      }
      own_files?: string[]
      type_files?: string[]
    } | {
      artifacts: Array<{
        title: string
        url: string
        favicon?: string
        updatedAt?: string
        rel?: "mine" | "shared"
        external?: true
        role?: "editor" | "commenter" | "reader" | "viewer"
        pinned?: boolean
      }>
      truncated?: boolean
      total?: number
      total_at_least?: true
      pins_enabled?: boolean
      scope?: "shared" | "all"
      external_listed?: true
    } | {
      read: {
        url: string
        bytes: number
        code: number
        codeText: string
        result: string
        durationMs: number
        title?: string
      }
      artifactRead?: {
        slug: string
        ver?: string
        seeded?: false
      }
    } | {
      artifact_types: {
        title: string
        type_url: string
        description?: string
        tier?: string
      }[]
      query?: string
      more?: boolean
      dropped?: number
      unavailable?: boolean
      docs_unfillable?: boolean
    } | {
      artifact_type: {
        title: string
        type_url: string
        description?: string
        tier?: string
        release?: string
        files: string[]
        files_omitted?: number
        instructions_file: boolean
        instructions?: string
        instructions_chars?: number
        instructions_clipped?: boolean
        instructions_unavailable?: string
        capabilities: string[]
        creatable?: boolean
      }
      read_of_type_link?: true
      type_file?: {
        path: string
        content?: string
        chars?: number
        clipped?: boolean
        unread?: "withheld" | "not_listed" | "not_text" | "too_large" | "unavailable"
        why?: string
      }
    } | {
      type_instances: {
        type?: string
        type_url?: string
        scope: string
        instances: {
          title: string
          url: string
          description?: string
          created_at?: string
          rel?: string
          audience?: string
          default?: string
        }[]
        more?: boolean
        overflow?: boolean
        dropped?: number
        unavailable?: boolean
      }
    } | {
      quickstart: {
        intent: string
        match?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }
        match_of?: number
        types?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }[]
        types_more?: boolean
        dashboard_type?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }
        types_unavailable?: boolean
        types_ruled?: boolean
        types_ambiguous?: boolean
        types_partial?: boolean
        types_note?: string
        types_hooked?: boolean
        docs_connector?: boolean
        design_systems?: {
          type?: string
          type_url?: string
          scope: string
          instances: {
            title: string
            url: string
            description?: string
            created_at?: string
            rel?: string
            audience?: string
            default?: string
          }[]
          more?: boolean
          overflow?: boolean
          dropped?: number
          unavailable?: boolean
        }
        design_systems_note?: string
        design_systems_off?: boolean
        design_system?: {
          url?: string
          default?: string
          title?: string
          store?: boolean
          docs?: {
            path: string
            text: string
            chars: number
            clipped?: boolean
          }[]
          unavailable?: string
        }
        design_guidance?: boolean
        start_kit?: {
          type?: {
            dir: string
            files: {
              path: string
              bytes: number
            }[]
            skipped: {
              path: string
              reason: string
            }[]
          }
          system_url?: string
          system?: {
            dir: string
            files: {
              path: string
              bytes: number
            }[]
            skipped: {
              path: string
              reason: string
            }[]
          }
          skill_in_result: boolean
          capabilities_skill: boolean
          repl_tool?: boolean
        }
      }
    } | {
      threads_dropped?: boolean
      thread_filter?: string
      scoped_dispatch?: boolean
      foreign?: true
      cursor?: string
      outside_org?: boolean
      page_owns_threads?: boolean
      names?: {}
      threads: {
        id: string
        created_at?: string
        resolved: boolean
        resolved_degraded?: boolean
        resolved_by_claude?: boolean
        claude_activated: boolean
        activated_degraded?: boolean
        carried?: boolean
        anchor_path?: string
        span_quote?: string
        anchor_file?: string
        anchor_file_degraded?: boolean
        anchor_file_sha?: string
        anchor_moved_at?: string
        anchor_label?: string
        anchor_detail?: string
        anchor_snippet?: string
        anchor_region?: boolean
        region_inside?: string[]
        comments_degraded?: boolean
        comments: {
          id: string
          account: string
          role?: string
          text: string
          created_at?: string
          sent_to_claude?: boolean
          sent_to_claude_degraded?: boolean
          sent_by_viewer?: boolean
          posted_by_artifact?: boolean
          awaiting_reply?: boolean
          presence?: string
          access?: string
          outside?: true
        }[]
      }[]
    } | {
      replied: boolean
      thread_id: string
      comment_id?: string
      replayed?: boolean
      not_activated?: boolean
      summon_answered?: boolean
      summon_foreign?: boolean
      already_answered?: boolean
      page_owns_threads?: boolean
      standing_reply_id?: string
    } | {
      thread_resolved: boolean
      thread_id: string
      not_activated?: boolean
      not_authorized?: boolean
      summon_foreign?: boolean
      relayed_credential?: boolean
      page_owns_threads?: boolean
    } | {
      watch: {
        url: string
        watching: boolean
        outcome: string
        reason?: string
        durable_skip_reason?: string
        task_id?: string
        since?: number
        token_expires_at?: number
        auto_reply?: string
        can_edit?: boolean
        user_turn?: boolean
        named_by_user?: boolean
        replies_declined?: boolean
        rail?: string
        trigger_id?: string
        durable_since?: string
        status?: number
        detail?: string
        note?: string
        events?: string[]
      }
    } | {
      unwatch: {
        url: string
        was_watching: boolean
      }
    } | {
      resume_replies: {
        url: string
        resumed: boolean
        outcome: string
        reason?: string
        task_id?: string
        stop_kind?: string
        in_place?: boolean
        connecting?: boolean
      }
    } | {
      watches: Array<{
        url: string
        task_id: string
        since: number
        explicit: boolean
        connected: boolean
        connecting?: boolean
        token_expires_at: number
        armed_via?: string
        auto_reply?: string
        unread_plain_comments?: number
        summons_awaiting_reply?: number
        comments_uncounted?: boolean
        comments_partially_counted?: boolean
      } | {
        url: string
        rail: "durable_wake"
        trigger_id: string
        since: string
        events?: string[]
        restored?: boolean
      } | {
        url: string
        rail: "live_stopped"
        since?: number
        explicit?: boolean
        armed_via?: string
        auto_reply: string
        stop_kind: string
      }>
      filter_url?: string
      arms?: {
        url: string
        rail?: string
        state: string
        reconnect?: boolean
        failures?: number
        max_failures?: number
        next_in_s?: number
        last_failure?: string
        reason?: string
        detail?: string
        server_message?: string
        at?: number
      }[]
    } | {
      db_read: {
        op: string
        collection: string
        doc_id?: string
        found?: boolean
        as_level?: string
        as_level_confirmed?: boolean
        docs?: {
          id: string
          data: {}
          version?: number
          updatedAt?: string
        }[]
        next_cursor?: string
        me_id?: string
        ordered_by?: {
          field: string
          limit: number
        }
        foreign?: true
        outside_writer?: true
        saved?: {
          dir: string
          files: {
            id: string
            path: string
            bytes: number
            compact?: boolean
            version?: number
            updatedAt?: string
          }[]
          skipped: {
            id: string
            reason: string
          }[]
        }
      }
    } | {
      db_profiles: {
        ids: string[]
        profiles?: {}
        unavailable?: true
      }
    } | {
      written?: {
        url: string
      }
      as_level?: string
      as_level_confirmed?: boolean
      db_write: {
        op: string
        collection: string
        doc_id: string
        field?: string
        replace_all?: true
        version?: number
        committed: boolean
        usage?: {
          documents: number
          max_documents: number
        }
        embedded?: {
          strings: number
          kb: number
        }
        warnings?: string[]
      } | {
        op: "batch"
        committed: boolean
        results: {
          op: string
          collection: string
          doc_id: string
          field?: string
          replace_all?: true
          version?: number
        }[]
        usage?: {
          documents: number
          max_documents: number
        }
        embedded?: {
          strings: number
          kb: number
        }
        warnings?: string[]
        fallback?: "sequential"
      }
    } | {
      room_send: {
        url: string
        topic: string
        delivered: boolean
        peers?: number
        reason?: string
      }
    } | {
      written?: {
        url: string
      }
      asset_upload: {
        id: string
        url: string
        size_bytes: number
        content_type: string
        sha256?: string
        file_name: string
      }
    } | {
      written?: {
        url: string
      }
      asset_uploads: {
        url: string
        results: Array<{
          file_path: string
          status: "uploaded"
          id: string
          url: string
          size_bytes: number
          content_type: string
          sha256?: string
          file_name: string
        } | {
          file_path: string
          status: "failed" | "not_attempted"
          reason: string
          message: string
          may_be_stored?: true
        }>
      }
    } | {
      asset_list: {
        url: string
        assets: {
          id: string
          url: string
          content_type: string
          size_bytes: number
          sha256?: string
          created_at: string
        }[]
        usage: {
          files: number
          bytes: number
          max_files: number
          max_bytes: number
        }
        next?: string
        cowritten?: true
        outside_writer?: true
      }
    } | {
      asset_read: {
        id: string
        path: string
        size_bytes: number
        content_type: string
        sha256: string
        cowritten?: true
        outside_writer?: true
        public_read?: true
        foreign?: true
      }
    } | {
      written?: {
        url: string
      }
      asset_delete: {
        id: string
        deleted: boolean
      }
    } | {
      asset_copy: {
        url: string
        from_url: string
        assets: {
          from_id: string
          id: string
          url: string
          size_bytes: number
          content_type: string
          sha256?: string
        }[]
      }
    } | {
      file_list: {
        url: string
        ver: string
        files: {
          path: string
          content_type: string
          size_bytes: number
          sha256: string
          live?: true
        }[]
        cowritten?: true
        outside_writer?: true
        public_read?: true
        narrowed?: true
        single_page?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
        stored?: {
          contract: string
          capabilities?: {}
        }
      }
    } | {
      file_read: {
        url?: string
        title?: string
        path: string
        saved_to: string
        ver: string
        size_bytes: number
        content_type: string
        sha256: string
        content?: string
        content_scrubbed?: true
        as_served?: true
        source?: true
        live?: true
        live_verified?: true
        seq?: number
        cowritten?: true
        outside_writer?: true
        public_read?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
      }
    } | {
      files_read: {
        url: string
        title?: string
        ver: string
        saved_dir: string
        files: Array<{
          path: string
          saved_to: string
          size_bytes: number
          content_type: string
          sha256: string
          content?: string
          content_scrubbed?: true
          as_served?: true
          source?: true
          foreign?: true
        } | {
          path: string
          error: string
        }>
        cowritten?: true
        outside_writer?: true
        public_read?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
      }
    } | {
      artifact_delete: {
        url: string
        deleted: true
        already_gone?: boolean
      }
    } | {
      pin: {
        action: "pin" | "unpin"
        url: string
        pinned: boolean
        title?: string
      }
    } | {
      shared: {
        url: string
        mode: string
        access: string
        read_mode: string
        added: number
        editors?: number
        unchanged?: boolean
        org_name?: string
        title?: string
      }
    } | {
      page_versions: {
        url: string
        rows: {
          id: string
          createdAt?: string
          current?: true
        }[]
        degraded?: true
        cut?: true
      }
    } | {
      verify: {
        url: string
        ver: string
        state: string
        entries: unknown[]
        truncated?: boolean
        dropped?: number
        waited?: boolean
        foreign?: true
      }
    } | {
      preview: {
        file: string
        bytes: number
        widths: number[]
        themes: string[]
        shots: {
          width: number
          theme: string
          height?: number
          pageHeight?: number
          path?: string
          base64?: string
          error?: string
        }[]
        issues: {
          kind: string
          text: string
        }[]
        issuesDropped?: number
        renderError?: string
      }
    } | {
      emulatorPreview: {
        file: string
        outcome: string
        pictures: {
          path: string
          base64?: string
        }[]
        marks?: string[]
        errors?: string[]
        outline?: string
        stopped?: string
      }
    }
    ArtifactData: {
      created_from_type: true
      already_created?: true
      url: string
      version: string
      path?: string
      title?: string
      type: {
        url: string
        release: string
      }
      own_files: string[]
      type_files: string[]
      files_written?: {
        path: string
        sha256: string
      }[]
      files_removed?: string[]
      auto_open?: "at_create" | "after_first_write"
      warnings?: string[]
      files_error?: string
      files_error_kind?: "type_owned_path"
      provisioned?: {
        store: string
        project_id: string
        file_id?: string
        node_id?: string
      }
      liveSubscription?: string
      pinned?: boolean
      instructions?: string
      instructions_chars?: number
      instructions_clipped?: boolean
      instructions_unavailable?: string
      init_references?: {
        docs: {
          path: string
          text: string
          chars: number
          clipped?: boolean
        }[]
        unavailable?: {
          path: string
          why: string
        }[]
      }
      after_quickstart?: {
        design_system?: string
        saved_system?: string
        saved_system_dir?: string
        saved_pages_dir?: string
        not_listed?: boolean
      }
      design_systems?: {
        type?: string
        type_url?: string
        scope: string
        instances: {
          title: string
          url: string
          description?: string
          created_at?: string
          rel?: string
          audience?: string
          default?: string
        }[]
        more?: boolean
        overflow?: boolean
        dropped?: number
        unavailable?: boolean
      }
      design_systems_note?: string
      design_system?: {
        url?: string
        default?: string
        title?: string
        store?: boolean
        docs?: {
          path: string
          text: string
          chars: number
          clipped?: boolean
        }[]
        unavailable?: string
      }
    } | {
      opened: true
      url: string
      artifact_id: string
      title?: string
    } | {
      url: string
      path: string
      artifact_id?: string
      title?: string
      version?: string
      capabilities?: unknown
      stored?: {
        contract: string
        preferredContract?: string
        capabilities?: {}
        carried?: boolean
        read?: string
      }
      warnings?: string[]
      publishesRemaining?: number
      publishesResetAt?: number
      contract?: string
      updated?: boolean
      icon?: string
      faviconSent?: true
      iconDropped?: true
      audience?: string
      seq?: number
      unchanged?: true
      merged_over?: {
        base: string
        live?: string
        changed?: Array<{
          path: string
          sha256: string | null
        }>
        omitted?: number
      }
      liveSubscription?: string
      verifyGuide?: string
      seededThread?: string
      copied?: {
        path: string
        from_url: string
        from_path: string
      }[]
      files_written?: {
        path: string
        sha256: string
      }[]
      files_removed?: string[]
      pinned?: boolean
      /** The Artifact type (and release) this Artifact was created from */
      type?: {
        url: string
        release: string
        latest?: string
        blocked?: {
          to?: string
          reason: string
          conflict_count?: number
          paths?: string[]
        }
      }
      own_files?: string[]
      type_files?: string[]
    } | {
      artifacts: Array<{
        title: string
        url: string
        favicon?: string
        updatedAt?: string
        rel?: "mine" | "shared"
        external?: true
        role?: "editor" | "commenter" | "reader" | "viewer"
        pinned?: boolean
      }>
      truncated?: boolean
      total?: number
      total_at_least?: true
      pins_enabled?: boolean
      scope?: "shared" | "all"
      external_listed?: true
    } | {
      read: {
        url: string
        bytes: number
        code: number
        codeText: string
        result: string
        durationMs: number
        title?: string
      }
      artifactRead?: {
        slug: string
        ver?: string
        seeded?: false
      }
    } | {
      artifact_types: {
        title: string
        type_url: string
        description?: string
        tier?: string
      }[]
      query?: string
      more?: boolean
      dropped?: number
      unavailable?: boolean
      docs_unfillable?: boolean
    } | {
      artifact_type: {
        title: string
        type_url: string
        description?: string
        tier?: string
        release?: string
        files: string[]
        files_omitted?: number
        instructions_file: boolean
        instructions?: string
        instructions_chars?: number
        instructions_clipped?: boolean
        instructions_unavailable?: string
        capabilities: string[]
        creatable?: boolean
      }
      read_of_type_link?: true
      type_file?: {
        path: string
        content?: string
        chars?: number
        clipped?: boolean
        unread?: "withheld" | "not_listed" | "not_text" | "too_large" | "unavailable"
        why?: string
      }
    } | {
      type_instances: {
        type?: string
        type_url?: string
        scope: string
        instances: {
          title: string
          url: string
          description?: string
          created_at?: string
          rel?: string
          audience?: string
          default?: string
        }[]
        more?: boolean
        overflow?: boolean
        dropped?: number
        unavailable?: boolean
      }
    } | {
      quickstart: {
        intent: string
        match?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }
        match_of?: number
        types?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }[]
        types_more?: boolean
        dashboard_type?: {
          title: string
          type_url: string
          description?: string
          tier?: string
        }
        types_unavailable?: boolean
        types_ruled?: boolean
        types_ambiguous?: boolean
        types_partial?: boolean
        types_note?: string
        types_hooked?: boolean
        docs_connector?: boolean
        design_systems?: {
          type?: string
          type_url?: string
          scope: string
          instances: {
            title: string
            url: string
            description?: string
            created_at?: string
            rel?: string
            audience?: string
            default?: string
          }[]
          more?: boolean
          overflow?: boolean
          dropped?: number
          unavailable?: boolean
        }
        design_systems_note?: string
        design_systems_off?: boolean
        design_system?: {
          url?: string
          default?: string
          title?: string
          store?: boolean
          docs?: {
            path: string
            text: string
            chars: number
            clipped?: boolean
          }[]
          unavailable?: string
        }
        design_guidance?: boolean
        start_kit?: {
          type?: {
            dir: string
            files: {
              path: string
              bytes: number
            }[]
            skipped: {
              path: string
              reason: string
            }[]
          }
          system_url?: string
          system?: {
            dir: string
            files: {
              path: string
              bytes: number
            }[]
            skipped: {
              path: string
              reason: string
            }[]
          }
          skill_in_result: boolean
          capabilities_skill: boolean
          repl_tool?: boolean
        }
      }
    } | {
      threads_dropped?: boolean
      thread_filter?: string
      scoped_dispatch?: boolean
      foreign?: true
      cursor?: string
      outside_org?: boolean
      page_owns_threads?: boolean
      names?: {}
      threads: {
        id: string
        created_at?: string
        resolved: boolean
        resolved_degraded?: boolean
        resolved_by_claude?: boolean
        claude_activated: boolean
        activated_degraded?: boolean
        carried?: boolean
        anchor_path?: string
        span_quote?: string
        anchor_file?: string
        anchor_file_degraded?: boolean
        anchor_file_sha?: string
        anchor_moved_at?: string
        anchor_label?: string
        anchor_detail?: string
        anchor_snippet?: string
        anchor_region?: boolean
        region_inside?: string[]
        comments_degraded?: boolean
        comments: {
          id: string
          account: string
          role?: string
          text: string
          created_at?: string
          sent_to_claude?: boolean
          sent_to_claude_degraded?: boolean
          sent_by_viewer?: boolean
          posted_by_artifact?: boolean
          awaiting_reply?: boolean
          presence?: string
          access?: string
          outside?: true
        }[]
      }[]
    } | {
      replied: boolean
      thread_id: string
      comment_id?: string
      replayed?: boolean
      not_activated?: boolean
      summon_answered?: boolean
      summon_foreign?: boolean
      already_answered?: boolean
      page_owns_threads?: boolean
      standing_reply_id?: string
    } | {
      thread_resolved: boolean
      thread_id: string
      not_activated?: boolean
      not_authorized?: boolean
      summon_foreign?: boolean
      relayed_credential?: boolean
      page_owns_threads?: boolean
    } | {
      watch: {
        url: string
        watching: boolean
        outcome: string
        reason?: string
        durable_skip_reason?: string
        task_id?: string
        since?: number
        token_expires_at?: number
        auto_reply?: string
        can_edit?: boolean
        user_turn?: boolean
        named_by_user?: boolean
        replies_declined?: boolean
        rail?: string
        trigger_id?: string
        durable_since?: string
        status?: number
        detail?: string
        note?: string
        events?: string[]
      }
    } | {
      unwatch: {
        url: string
        was_watching: boolean
      }
    } | {
      resume_replies: {
        url: string
        resumed: boolean
        outcome: string
        reason?: string
        task_id?: string
        stop_kind?: string
        in_place?: boolean
        connecting?: boolean
      }
    } | {
      watches: Array<{
        url: string
        task_id: string
        since: number
        explicit: boolean
        connected: boolean
        connecting?: boolean
        token_expires_at: number
        armed_via?: string
        auto_reply?: string
        unread_plain_comments?: number
        summons_awaiting_reply?: number
        comments_uncounted?: boolean
        comments_partially_counted?: boolean
      } | {
        url: string
        rail: "durable_wake"
        trigger_id: string
        since: string
        events?: string[]
        restored?: boolean
      } | {
        url: string
        rail: "live_stopped"
        since?: number
        explicit?: boolean
        armed_via?: string
        auto_reply: string
        stop_kind: string
      }>
      filter_url?: string
      arms?: {
        url: string
        rail?: string
        state: string
        reconnect?: boolean
        failures?: number
        max_failures?: number
        next_in_s?: number
        last_failure?: string
        reason?: string
        detail?: string
        server_message?: string
        at?: number
      }[]
    } | {
      db_read: {
        op: string
        collection: string
        doc_id?: string
        found?: boolean
        as_level?: string
        as_level_confirmed?: boolean
        docs?: {
          id: string
          data: {}
          version?: number
          updatedAt?: string
        }[]
        next_cursor?: string
        me_id?: string
        ordered_by?: {
          field: string
          limit: number
        }
        foreign?: true
        outside_writer?: true
        saved?: {
          dir: string
          files: {
            id: string
            path: string
            bytes: number
            compact?: boolean
            version?: number
            updatedAt?: string
          }[]
          skipped: {
            id: string
            reason: string
          }[]
        }
      }
    } | {
      db_profiles: {
        ids: string[]
        profiles?: {}
        unavailable?: true
      }
    } | {
      written?: {
        url: string
      }
      as_level?: string
      as_level_confirmed?: boolean
      db_write: {
        op: string
        collection: string
        doc_id: string
        field?: string
        replace_all?: true
        version?: number
        committed: boolean
        usage?: {
          documents: number
          max_documents: number
        }
        embedded?: {
          strings: number
          kb: number
        }
        warnings?: string[]
      } | {
        op: "batch"
        committed: boolean
        results: {
          op: string
          collection: string
          doc_id: string
          field?: string
          replace_all?: true
          version?: number
        }[]
        usage?: {
          documents: number
          max_documents: number
        }
        embedded?: {
          strings: number
          kb: number
        }
        warnings?: string[]
        fallback?: "sequential"
      }
    } | {
      room_send: {
        url: string
        topic: string
        delivered: boolean
        peers?: number
        reason?: string
      }
    } | {
      written?: {
        url: string
      }
      asset_upload: {
        id: string
        url: string
        size_bytes: number
        content_type: string
        sha256?: string
        file_name: string
      }
    } | {
      written?: {
        url: string
      }
      asset_uploads: {
        url: string
        results: Array<{
          file_path: string
          status: "uploaded"
          id: string
          url: string
          size_bytes: number
          content_type: string
          sha256?: string
          file_name: string
        } | {
          file_path: string
          status: "failed" | "not_attempted"
          reason: string
          message: string
          may_be_stored?: true
        }>
      }
    } | {
      asset_list: {
        url: string
        assets: {
          id: string
          url: string
          content_type: string
          size_bytes: number
          sha256?: string
          created_at: string
        }[]
        usage: {
          files: number
          bytes: number
          max_files: number
          max_bytes: number
        }
        next?: string
        cowritten?: true
        outside_writer?: true
      }
    } | {
      asset_read: {
        id: string
        path: string
        size_bytes: number
        content_type: string
        sha256: string
        cowritten?: true
        outside_writer?: true
        public_read?: true
        foreign?: true
      }
    } | {
      written?: {
        url: string
      }
      asset_delete: {
        id: string
        deleted: boolean
      }
    } | {
      asset_copy: {
        url: string
        from_url: string
        assets: {
          from_id: string
          id: string
          url: string
          size_bytes: number
          content_type: string
          sha256?: string
        }[]
      }
    } | {
      file_list: {
        url: string
        ver: string
        files: {
          path: string
          content_type: string
          size_bytes: number
          sha256: string
          live?: true
        }[]
        cowritten?: true
        outside_writer?: true
        public_read?: true
        narrowed?: true
        single_page?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
        stored?: {
          contract: string
          capabilities?: {}
        }
      }
    } | {
      file_read: {
        url?: string
        title?: string
        path: string
        saved_to: string
        ver: string
        size_bytes: number
        content_type: string
        sha256: string
        content?: string
        content_scrubbed?: true
        as_served?: true
        source?: true
        live?: true
        live_verified?: true
        seq?: number
        cowritten?: true
        outside_writer?: true
        public_read?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
      }
    } | {
      files_read: {
        url: string
        title?: string
        ver: string
        saved_dir: string
        files: Array<{
          path: string
          saved_to: string
          size_bytes: number
          content_type: string
          sha256: string
          content?: string
          content_scrubbed?: true
          as_served?: true
          source?: true
          foreign?: true
        } | {
          path: string
          error: string
        }>
        cowritten?: true
        outside_writer?: true
        public_read?: true
        from_type?: true
        type?: {
          url: string
          title?: string
        }
        foreign?: true
      }
    } | {
      artifact_delete: {
        url: string
        deleted: true
        already_gone?: boolean
      }
    } | {
      pin: {
        action: "pin" | "unpin"
        url: string
        pinned: boolean
        title?: string
      }
    } | {
      shared: {
        url: string
        mode: string
        access: string
        read_mode: string
        added: number
        editors?: number
        unchanged?: boolean
        org_name?: string
        title?: string
      }
    } | {
      page_versions: {
        url: string
        rows: {
          id: string
          createdAt?: string
          current?: true
        }[]
        degraded?: true
        cut?: true
      }
    } | {
      verify: {
        url: string
        ver: string
        state: string
        entries: unknown[]
        truncated?: boolean
        dropped?: number
        waited?: boolean
        foreign?: true
      }
    } | {
      preview: {
        file: string
        bytes: number
        widths: number[]
        themes: string[]
        shots: {
          width: number
          theme: string
          height?: number
          pageHeight?: number
          path?: string
          base64?: string
          error?: string
        }[]
        issues: {
          kind: string
          text: string
        }[]
        issuesDropped?: number
        renderError?: string
      }
    } | {
      emulatorPreview: {
        file: string
        outcome: string
        pictures: {
          path: string
          base64?: string
        }[]
        marks?: string[]
        errors?: string[]
        outline?: string
        stopped?: string
      }
    }
    AskUserQuestion: {
      /** The questions that were asked */
      questions: Array<{
        /** The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?" */
        question: string
        /** Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach". */
        header: string
        /** How the user answers. "choice" (the default when omitted): picks from options. "text": a free-text box, no options — for open-ended input. "number": a slider/stepper between min and max — for quantities. */
        kind?: "choice" | "text" | "number"
        /** Optional single helper line shown under the question. */
        description?: string
        /** Choices for a "choice" question: 2-4 distinct options; with multiSelect false they must be mutually exclusive. Omit for "text" and "number" questions. There should be no 'Other' or 'Skip' option; the form lets the user type their own answer or leave a question unanswered. */
        options: Array<{
          /** The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice. */
          label: string
          /** Optional: add only when the label alone would be ambiguous. One short line on what choosing it leads to. */
          description?: string
          /** Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format. */
          preview?: string
        }>
        /** Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive. */
        multiSelect: boolean
        /** "text" questions only: placeholder for the empty text box. */
        placeholder?: string
        /** "number" questions only (required there): lowest value. */
        min?: number
        /** "number" questions only (required there): highest value. */
        max?: number
        /** "number" questions only: increment between values. */
        step?: number
        /** "number" questions only: the value the control starts at (within min..max). */
        defaultValue?: number
        /** "number" questions only: short unit shown next to the value, e.g. "px", "slides", "%". */
        unit?: string
      }>
      /** The answers provided by the user (question text -> answer string; multi-select answers are comma-separated) */
      answers: {}
      /** Freeform text the user typed instead of selecting a structured option */
      response?: string
      /** Optional per-question annotations from the user (e.g., notes on preview selections). Keyed by question text. */
      annotations?: {}
      /** Set when the dialog auto-resolved after this many milliseconds of idle (user away from keyboard). Absent on every human-resolved path. */
      afkTimeoutMs?: number
      /** Set when the user asked for another round of questions instead of (or after partially) answering. */
      followUp?: boolean
    }
    Bash: {
      /** The standard output of the command */
      stdout: string
      /** The standard error output of the command */
      stderr: string
      /** Path to raw output file for large MCP tool outputs */
      rawOutputPath?: string
      /** Whether the command was interrupted */
      interrupted: boolean
      /** Flag to indicate if stdout contains image data */
      isImage?: boolean
      /** ID of the background task if command is running in background */
      backgroundTaskId?: string
      /** True if the user manually backgrounded the command with Ctrl+B */
      backgroundedByUser?: boolean
      /** @internal True if a plugin's turn abort moved the running command to the background */
      backgroundedByTurnAbort?: boolean
      /** @internal True if the command was moved to the background so a message queued for the model could reach it */
      backgroundedToDeliverMessage?: boolean
      /** Set when the command hit its timeout and was auto-backgrounded; the timeout value in ms */
      timedOutAfterMs?: number
      /** Model-facing note that the session cwd was not changed by a backgrounded command containing a directory-change builtin (cd/pushd/popd/chdir) */
      backgroundCwdHint?: string
      /** True when this backgrounded command is terminated at its caller's final response, so no completion notification can follow (a synchronous subagent's command, or a headless session that takes no further input and is not waiting for background commands); absent when the command survives */
      backgroundEndsWithFinalResponse?: true
      /** Flag to indicate if sandbox mode was overridden */
      dangerouslyDisableSandbox?: boolean
      /** Semantic interpretation for non-error exit codes with special meaning */
      returnCodeInterpretation?: string
      /** Whether the command is expected to produce no output on success */
      noOutputExpected?: boolean
      /** Structured content blocks */
      structuredContent?: unknown[]
      /** Path to the persisted full output in tool-results dir (set when output is too large for inline) */
      persistedOutputPath?: string
      /** Total size of the output in bytes (set when output is too large for inline) */
      persistedOutputSize?: number
      /** Model-facing note listing readFileState entries whose mtime bumped during this command (set when WRITE_COMMAND_MARKERS matches) */
      staleReadFileStateHint?: string
      /** Model-facing system-reminder appended when a gh command reports a GitHub API rate-limit error */
      ghRateLimitHint?: string
      /** Structured classification of git/gh operations detected in this command (commit/push/merge/rebase/PR). Client-facing — lets clients render git activity without re-parsing stdout; not surfaced to the model. */
      gitOperation?: {
        commit?: {
          sha: string
          kind: "committed" | "amended" | "cherry-picked"
          branch?: string
        }
        push?: {
          branch: string
        }
        branch?: {
          ref: string
          action: "merged" | "rebased"
        }
        pr?: {
          number: number
          url?: string
          action: "created" | "edited" | "merged" | "commented" | "closed" | "reopened" | "ready" | "draft" | "auto-merge-enabled" | "auto-merge-disabled"
        }
      }
      /** @internal Per-file diff of the working-tree changes this command made, for rendering and for PostToolUse Bash hooks (changedFiles: absolute paths of every changed file known, shown or not, at most 200; cut when shorter than files.length + moreFiles); not surfaced to the model. */
      bashEditDiff?: {
        files: {
          filePath: string
          hunks: {
            oldStart: number
            oldLines: number
            newStart: number
            newLines: number
            lines: string[]
          }[]
          created?: true
          deleted?: true
        }[]
        moreFiles: number
        changedFiles?: string[]
        unavailable?: true
        skipped?: true
        shared?: true
      }
    }
    ClaudeDesign: {
      operation: string
      content: {}[]
      isError?: boolean
    }
    CronCreate: {
      id: string
      humanSchedule: string
      recurring: boolean
      durable?: boolean
    }
    CronDelete: {
      id: string
    }
    CronList: {
      jobs: {
        id: string
        cron: string
        humanSchedule: string
        prompt: string
        recurring?: boolean
        durable?: boolean
      }[]
    }
    DesignSync: {
      method: "list_projects"
      notice?: string
      projects: {
        projectId: string
        name: string
        ownerDisplayName?: string
        isOwned?: boolean
        updatedAt?: string
      }[]
    } | {
      method: "get_project"
      notice?: string
      projectId: string
      name: string
      type?: string
      ownerDisplayName?: string
      isOwned?: boolean
      canEdit?: boolean
    } | {
      method: "list_files"
      notice?: string
      paths: string[]
    } | {
      method: "get_file"
      notice?: string
      path: string
      content: string
      contentType: string
      isBase64: boolean
      truncated: boolean
    } | {
      method: "finalize_plan"
      notice?: string
      planId: string
      writes: string[]
      deletes: string[]
    } | {
      method: "write_files"
      notice?: string
      written: number
    } | {
      method: "delete_files"
      notice?: string
      deleted: number
    } | {
      method: "register_assets"
      notice?: string
      registered: number
    } | {
      method: "unregister_assets"
      notice?: string
      unregistered: number
    } | {
      method: "create_project"
      notice?: string
      projectId: string
      name: string
    } | {
      method: "report_validate"
      notice?: string
    }
    Edit: {
      /** The file path that was edited */
      filePath: string
      /** The original string that was replaced */
      oldString: string
      /** The new string that replaced it */
      newString: string
      /** The original file contents before editing */
      originalFile: string | null
      /** Diff patch showing the changes */
      structuredPatch: {
        oldStart: number
        oldLines: number
        newStart: number
        newLines: number
        lines: string[]
      }[]
      /** Whether the user modified the proposed changes */
      userModified: boolean
      /** Whether all occurrences were replaced */
      replaceAll: boolean
      gitDiff?: {
        filename: string
        status: "modified" | "added"
        additions: number
        deletions: number
        changes: number
        patch: string
        /** GitHub owner/repo when available */
        repository?: string | null
      }
      /** True when the edit was held for the machine owner to review instead of written; the file is unchanged */
      staged?: boolean
    }
    "enable__mcp__claude-in-chrome": {
      message: string
    }
    "enable__mcp__remote-devices__Claude_Browser": {
      message: string
    }
    "enable__mcp__remote-devices__computer": {
      message: string
    }
    EndConversation: {
      ended: boolean
      message: string
    }
    EnterPlanMode: {
      /** Confirmation that plan mode was entered */
      message: string
    }
    EnterWorktree: {
      worktreePath: string
      worktreeBranch?: string
      message: string
    }
    ExitPlanMode: {
      /** The plan that was presented to the user */
      plan: string | null
      isAgent: boolean
      /** The file path where the plan was saved */
      filePath?: string
      /** Whether the Agent tool is available in the current context */
      hasTaskTool?: boolean
      /** True when the user edited the plan (CCR web UI or Ctrl+G); determines whether the plan is echoed back in tool_result */
      planWasEdited?: boolean
      /** When true, the teammate has sent a plan approval request to the team leader */
      awaitingLeaderApproval?: boolean
      /** Unique identifier for the plan approval request */
      requestId?: string
    }
    ExitWorktree: {
      action: "keep" | "remove"
      originalCwd: string
      worktreePath: string
      worktreeBranch?: string
      tmuxSessionName?: string
      discardedFiles?: number
      discardedCommits?: number
      /** @internal Where the session's cwd ended up: originalCwd, or a fallback when it was gone. */
      restoredCwd?: string
      /** @internal originalCwd was gone (or a network path the session will not touch), so restoredCwd is a fallback directory. */
      originalCwdMissing?: boolean
      message: string
    }
    FetchInboxMessage: {
      ok: boolean
      file_id?: string
      message_id?: string
      enveloped_text?: string
      body?: string
      sender_display?: string
      sender_kind?: string
      source?: string
      slack_permalink?: string
      received_at?: string
      attachments_prefix?: string
      reason?: string
    }
    GetTask: {
      taskId: string
      statusMessage: string
      createdAt: string
      lastUpdatedAt: string
      status: "working"
    } | {
      taskId: string
      statusMessage: string
      createdAt: string
      lastUpdatedAt: string
      status: "completed"
      result: {
        content: {
          type: "text"
          text: string
        }[]
        isError: boolean
      }
    } | {
      taskId: string
      statusMessage: string
      createdAt: string
      lastUpdatedAt: string
      status: "failed"
      error: {
        code: number
        message: string
      }
    } | {
      taskId: string
      statusMessage: string
      createdAt: string
      lastUpdatedAt: string
      status: "cancelled"
    }
    ListAgents: {
      /** Formatted list of reachable agents */
      listing: string
      sections?: {
        kind: string
        total: number
        rows: {
          name?: string
          ref?: string
          id?: string
          type?: string
          status?: string
        }[]
      }[]
      notes?: {
        kind: string
        text: string
      }[]
    }
    ListConnectors: {
      connectors: {
        name?: string
      }[]
      opt_in_required?: true
      message?: string
    }
    ListMcpResourcesTool: Array<{
      /** Resource URI */
      uri: string
      /** Resource name */
      name: string
      /** MIME type of the resource */
      mimeType?: string
      /** Resource description */
      description?: string
      /** Server that provides this resource */
      server: string
    }>
    ListPlugins: {
      results: Array<{
        id: string
        name: string
        display_name?: string | null
        description?: string | null
        enabled?: boolean | null
        presents_as?: string | null
        installation_preference?: string | null
      }>
    }
    ListSkills: {
      results: Array<{
        id: string
        name: string
        display_name?: string | null
        description?: string | null
        enabled?: boolean | null
        presents_as?: string | null
        installation_preference?: string | null
      }>
    }
    LSP: {
      /** The LSP operation that was performed */
      operation: "goToDefinition" | "findReferences" | "hover" | "documentSymbol" | "workspaceSymbol" | "goToImplementation" | "prepareCallHierarchy" | "incomingCalls" | "outgoingCalls"
      /** The formatted result of the LSP operation */
      result: string
      /** The file path the operation was performed on */
      filePath: string
      /** Number of results (definitions, references, symbols) */
      resultCount?: number
      /** Number of files containing results */
      fileCount?: number
    }
    memory_list: {
      outcome: "ok" | "refused" | "failed"
      store_kind?: "personal" | "project"
      entries?: {
        path: string
        bytes?: number
        updatedAt?: string
      }[]
      remaining?: number
      stores?: {
        id: string
        description: string
        writable: boolean
        index: string
      }[]
      reason?: string
      message?: string
    }
    memory_read: {
      outcome: "ok" | "not_found" | "refused" | "failed"
      path: string
      store_kind?: "personal" | "project"
      content?: string
      updatedAt?: string
      version?: string
      reason?: string
      message?: string
    }
    memory_write: {
      outcome: "ok" | "conflict" | "missing" | "refused" | "failed"
      path: string
      store_kind?: "personal" | "project"
      version?: string
      bytes?: number
      content?: string
      op?: "created" | "updated"
      currentVersion?: string
      currentContent?: string
      reason?: string
      message?: string
    }
    Monitor: {
      /** ID of the background monitor task. */
      taskId: string
      /** Timeout deadline in milliseconds (0 when persistent). */
      timeoutMs: number
      /** No timeout — runs until TaskStop or session end. */
      persistent?: boolean
    }
    NotebookEdit: {
      /** The new source code that was written to the cell */
      new_source: string
      /** The previous cell source (replace/delete only). Enables cell-relative diff rendering without re-reading the notebook. */
      old_source?: string
      /** The ID of the cell that was edited */
      cell_id?: string
      /** The type of the cell */
      cell_type: "code" | "markdown"
      /** The programming language of the notebook */
      language: string
      /** The edit mode that was used */
      edit_mode: string
      /** Error message if the operation failed */
      error?: string
      /** The path to the notebook file */
      notebook_path: string
      /** The original notebook content before modification */
      original_file: string
      /** The updated notebook content after modification */
      updated_file: string
    }
    OfferChromeSetup: {
      outcome: "connected" | "not_now" | "no_attempt_yet"
    }
    Poll: {
      /** Rendered event envelopes, or "(no pending events)" */
      content: string
      /** Number of events delivered in this result */
      eventCount: number
      /** Wake events still queued after this chunk; they follow in the next delivery */
      remainingWakeCount: number
      /** Each delivered event's images and documents, 1:1 with the events. Absent when none has any */
      media?: Array<Array<{
        type: "image"
        source: {
          type: "base64"
          media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
          data: string
        }
      } | {
        type: "document"
        source: {
          type: "base64"
          media_type: "application/pdf"
          data: string
        }
      }>>
      provenance?: Array<{
        authority: "human-principal" | "human-other" | "peer-agent" | "world-event"
        senderId?: string
        senderText?: string
      } | null>
      declared?: Array<{
        kind: string
        at: string
        fields: {}
      } | null>
    }
    Projects: {
      method: "project_info"
      notice?: string
      name: string
      description: string
      instructions: string
      docs: Array<{
        path: string
        created_at: string | null
      }>
      files?: Array<{
        path: string
        file_kind: string
        created_at: string | null
      }>
      sync_sources?: Array<{
        type: string | null
        config: {}
      }>
      knowledge: {
        knowledge_size: number
        max_knowledge_size: number
      }
    } | {
      method: "project_read"
      notice?: string
      path: string
      file_kind?: string
      content?: string
      local_file?: string
      /** @internal Size in UTF-8 bytes of the document's whole text. Set only when the text is in local_file and project_read had a token limit on inline text. */
      size_bytes?: number
      created_at: string | null
    } | {
      method: "project_search"
      notice?: string
      rag: boolean
      hits?: {
        name?: string
        doc_uuid?: string
        text?: string
      }[]
      docs?: string[]
    } | {
      method: "project_write"
      notice?: string
      path: string
      doc_uuid: string
      replaced: boolean
      present_to_user?: boolean
      local_path?: string
    } | {
      method: "project_delete"
      notice?: string
      path: string
      deleted: boolean
    } | {
      method: "project_memory_list"
      notice?: string
      files: Array<{
        path: string
        size_bytes: number
        updated_at: string | null
        truncated: boolean
      }>
      truncated: boolean
    } | {
      method: "project_memory_read"
      notice?: string
      path: string
      content?: string
      local_file?: string
      size_bytes: number
      updated_at: string | null
      truncated: boolean
    }
    propose_skills: {
      /** Number of proposals shown on the review card */
      proposalCount: number
    }
    ProposeGoal: {
      /** The condition shown to the user for approval, or set directly when ask_user was false */
      condition: string
      /** Whether the user was asked for approval (true) or the goal was set directly (false) */
      askUser: boolean
    }
    PublishPlugin: {
      state: "published" | "in-review" | "publishing" | "on-shelf" | "refused"
      refusal?: string
      lines: string[]
    }
    PushNotification: {
      message: string
      pushSent?: boolean
      localSent?: boolean
      disabledReason?: "config_off" | "user_present" | "no_transport"
      /** ISO timestamp captured at tool execution on the emitting process. Optional — resumed sessions replay pre-sentAt outputs verbatim. */
      sentAt?: string
    }
    Read: {
      type: "text"
      file: {
        /** The path to the file that was read */
        filePath: string
        /** The content of the file */
        content: string
        /** Number of lines in the returned content */
        numLines: number
        /** The starting line number */
        startLine: number
        /** Total number of lines in the file */
        totalLines: number
        /** True when a whole-file read was auto-paginated because it exceeded the token cap (the content is a partial first page). A programmatic signal for internal consumers; survives output reconstruction (unlike the render-time banner). */
        truncatedByTokenCap?: boolean
      }
      /** Set when this Read completed a saved Artifact source file: the Artifact and the version of it that now counts as viewed. */
      artifactRead?: {
        slug: string
        ver: string
      }
    } | {
      type: "image"
      file: {
        /** Base64-encoded image data */
        base64: string
        /** The MIME type of the image */
        type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
        /** Original file size in bytes */
        originalSize: number
        /** Image dimension info for coordinate mapping */
        dimensions?: {
          /** Original image width in pixels */
          originalWidth?: number
          /** Original image height in pixels */
          originalHeight?: number
          /** Displayed image width in pixels (after resizing) */
          displayWidth?: number
          /** Displayed image height in pixels (after resizing) */
          displayHeight?: number
        }
      }
    } | {
      type: "notebook"
      file: {
        /** The path to the notebook file */
        filePath: string
        /** Array of notebook cells */
        cells: unknown[]
      }
    } | {
      type: "pdf"
      file: {
        /** The path to the PDF file */
        filePath: string
        /** Base64-encoded PDF data */
        base64: string
        /** Original file size in bytes */
        originalSize: number
      }
    } | {
      type: "parts"
      file: {
        /** The path to the PDF file */
        filePath: string
        /** Original file size in bytes */
        originalSize: number
        /** Number of pages extracted */
        count: number
        /** Directory containing extracted page images */
        outputDir: string
      }
      /** Document page number of the first extracted page (1 when no range was requested); labels the page images in the model-facing tool_result */
      firstPage?: number
      /** Extracted page images, in page order. Present only transiently in-process: the page image bytes are delivered solely as image blocks in the model-facing tool_result content and are not retained on the tool_use_result, so this key is absent on the emitted/persisted result */
      pages?: Array<{
        /** Base64-encoded page image; empty when the page could not be processed */
        base64: string
        /** The MIME type of the image */
        mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
        /** Why the page could not be processed as an image; set only when base64 is empty */
        error?: string
      }>
    } | {
      type: "file_unchanged"
      file: {
        /** The path to the file */
        filePath: string
      }
      /** Set when the dedup matched a startup-seeded entry (CLAUDE.md / nested memory) rather than a prior Read tool_result */
      source?: "seeded"
    }
    ReadMcpResourceDirTool: {
      /** Direct children of the directory resource. Subdirectories appear with mimeType "inode/directory". */
      resources: Array<{
        /** Child resource URI */
        uri: string
        /** Child resource name */
        name: string
        /** Child MIME type */
        mimeType?: string
      }>
      /** Human-readable error when the server could not list the directory */
      error?: string
    }
    ReadMcpResourceTool: {
      contents: Array<{
        /** Resource URI */
        uri: string
        /** MIME type of the content */
        mimeType?: string
        /** Text content of the resource */
        text?: string
        /** Path where binary blob content was saved */
        blobSavedTo?: string
      }>
      /** Human-readable error when the server could not read the resource */
      error?: string
    }
    ReadNotifications: {
      notifications: Array<{
        /** Server-assigned stable id — the dedup key across redeliveries. */
        notification_id: string
        /** Server-attested source token: "github_webhook" | "trigger_fire" | "mcp_send_message" (open set; unknown well-formed tokens pass through verbatim, off-grammar values coerce to "unknown"). */
        origin: string
        /** RFC3339 timestamp of when the backend queued it. */
        queued_at: string
        /** Verbatim notification body. */
        content: string
        /** RFC3339 timestamp, by this machine's clock, of when the notification reached this session's queue. Missing from results saved before this field existed. */
        arrived_at?: string
      }>
      /** Notifications still queued after this drain (drains are size-budgeted); call the tool again to read them. */
      remaining: number
      /** RFC3339 timestamp, by this machine's clock, of when this call read the queue. Missing from results saved before this field existed. */
      read_at?: string
    }
    RemoteTrigger: {
      status: number
      json: string
      summary?: string
    }
    ReportFindings: {
      /** Number of findings reported */
      count: number
      /** Effort level the review ran at */
      level?: "low" | "medium" | "high" | "xhigh" | "max"
      /** Echoed for the result body */
      findings: Array<{
        /** Repo-relative path of the file the finding is in */
        file: string
        /** 1-indexed line the finding anchors to */
        line?: number
        /** One-sentence statement of the defect */
        summary: string
        /** Compressed label for compact UI (≤60 chars): the claim alone, no rationale or consequence clause */
        short_summary?: string
        /** Concrete inputs/state → wrong output/crash */
        failure_scenario: string
        /** Short kebab-case slug of the finding type, e.g. "correctness", "simplification", "efficiency", "test-coverage" */
        category?: string
        /** Set when a verify pass ran; absent on inline-only reviews */
        verdict?: "CONFIRMED" | "PLAUSIBLE"
        /** Set ONLY when re-reporting after applying fixes: what happened to this finding */
        outcome?: "fixed" | "skipped" | "no_change_needed"
      }>
    }
    request_computer: {
      message: string
    }
    ScheduleWakeup: {
      /** Epoch ms timestamp when the next wakeup will fire */
      scheduledFor: number
      /** Actual delay used after clamping to runtime bounds */
      clampedDelaySeconds: number
      /** True if the requested delaySeconds was outside [60, 3600] */
      wasClamped: boolean
      /** True when the model ended the loop via `stop: true` */
      stopped?: boolean
      /** How many pending dynamic-loop wakeups stop:true cancelled. 0 means nothing was pending — a recurring /loop cron is not cancelled by stop:true. */
      cancelledWakeups?: number
    }
    SearchMcpRegistry: {
      results: {
        name?: string
      }[]
      opt_in_required?: true
      message?: string
    }
    SearchPlugins: {
      results: Array<{
        id: string
        name: string
        display_name?: string | null
        description?: string | null
        enabled?: boolean | null
        presents_as?: string | null
        installation_preference?: string | null
      }>
    }
    SearchSkills: {
      results: Array<{
        id: string
        name: string
        display_name?: string | null
        description?: string | null
        enabled?: boolean | null
        presents_as?: string | null
        installation_preference?: string | null
      }>
    }
    SendFeedback: {
      success: boolean
      message: string
    }
    SendFile: {
      success: boolean
      message: string
      msg_id?: string
      /** Per-file transfer outcome */
      files: {
        path: string
        size?: number
        sha256?: string
        file_uuid?: string
        error?: string
      }[]
    }
    SendMessage: unknown
    SendUserFile: {
      caption?: string
      display?: "render" | "attach"
      /** Resolved file metadata */
      attachments: {
        path: string
        size: number
        isImage: boolean
        file_uuid?: string
        media_type?: string
        pathValidated?: boolean
        upload_error?: string
        upload_error_code?: string
        upload_suspected_limit_bytes?: number
        scaled?: {
          width: number
          height: number
          original_width: number
          original_height: number
        }
        project_path?: string
        partial_error?: string
      }[]
      rendered_locally?: boolean
    }
    SendUserMessage: {
      /** The message */
      message: string
      /** Resolved attachment metadata */
      attachments?: {
        path: string
        size: number
        isImage: boolean
        file_uuid?: string
        media_type?: string
        pathValidated?: boolean
        upload_error?: string
        upload_error_code?: string
        upload_suspected_limit_bytes?: number
        scaled?: {
          width: number
          height: number
          original_width: number
          original_height: number
        }
      }[]
      /** ISO timestamp captured at tool execution on the emitting process. Optional — resumed sessions replay pre-sentAt outputs verbatim. */
      sentAt?: string
      rendered_locally?: boolean
    }
    ShareOnboardingGuide: {
      status: "created" | "updated" | "deleted" | "has_existing" | "unavailable"
      share_url?: string
      short_code?: string
      message: string
    }
    ShowOnboardingRolePicker: {
      role?: string
      dismissed?: boolean
    }
    Skill: {
      /** Whether the skill is valid */
      success: boolean
      /** The name of the skill */
      commandName: string
      /** Tools allowed by this skill */
      allowedTools?: string[]
      /** Resolved model the skill turn runs on when a frontmatter model override took effect; omitted otherwise */
      model?: string
      /** Execution status */
      status?: "inline"
      /** True when the skill instructions were loaded read-only (nothing was executed) */
      readOnly?: boolean
    } | {
      /** Whether the skill completed successfully */
      success: boolean
      /** The name of the skill */
      commandName: string
      /** Execution status */
      status: "forked"
      /** The ID of the sub-agent that executed the skill */
      agentId: string
      /** The result from the forked skill execution */
      result: string
      /** True when the sub-agent was launched in the background: `result` describes the launch, and the skill outcome arrives later as a task notification. */
      background?: boolean
    }
    SuggestConnectors: {
      connectors: {
        name?: string
      }[]
      opt_in_required?: true
      message?: string
    }
    SuggestPluginInstall: {
      contextLabel: string
      plugins: {
        pluginId: string
        pluginName: string
        description: string
      }[]
      note: string
      trigger?: "user_asked" | "proactive"
    }
    SuggestSkills: {
      results: Array<{
        id: string
        name: string
        display_name?: string | null
        description?: string | null
        enabled?: boolean | null
        presents_as?: string | null
        installation_preference?: string | null
      }>
      trigger?: "user_asked" | "proactive"
    }
    TaskCreate: {
      task: {
        id: string
        subject: string
      }
    }
    TaskGet: {
      task: {
        id: string
        subject: string
        description: string
        status: "pending" | "in_progress" | "completed"
        blocks: string[]
        blockedBy: string[]
      } | null
    }
    TaskList: {
      tasks: Array<{
        id: string
        subject: string
        status: "pending" | "in_progress" | "completed"
        owner?: string
        blockedBy: string[]
      }>
    }
    TaskStop: {
      /** Status message about the operation */
      message: string
      /** The ID of the task that was stopped */
      task_id: string
      /** The type of the task that was stopped */
      task_type: string
      /** The command or description of the stopped task */
      command?: string
    }
    TaskUpdate: {
      success: boolean
      taskId: string
      updatedFields: string[]
      error?: string
      statusChange?: {
        from: string
        to: string
      }
    }
    TodoWrite: {
      /** The todo list before the update */
      oldTodos: Array<{
        content: string
        status: "pending" | "in_progress" | "completed"
        activeForm: string
      }>
      /** The todo list after the update */
      newTodos: Array<{
        content: string
        status: "pending" | "in_progress" | "completed"
        activeForm: string
      }>
    }
    ToolSearch: {
      matches: string[]
      query: string
      total_deferred_tools: number
      pending_mcp_servers?: string[]
      failed_mcp_servers?: {
        name: string
        errorCode?: string
        error?: string
      }[]
    }
    WaitForMcpServers: {
      ready: boolean
      connected: string[]
      cached?: string[]
      failed: string[]
      stillPending: string[]
      needsAuth: string[]
      disabled: string[]
      unconfigured?: string[]
      unknown: string[]
    }
    WebFetch: {
      /** Size of the fetched content in bytes */
      bytes: number
      /** HTTP response code */
      code: number
      /** HTTP response code text */
      codeText: string
      /** Processed result from applying the prompt to the content */
      result: string
      /** Time taken to fetch and process the content */
      durationMs: number
      /** The URL that was fetched */
      url: string
      artifactRead?: {
        slug: string
        ver?: string
        seeded?: false
      }
    }
    WebSearch: {
      /** The search query that was executed */
      query: string
      /** Search results and/or text commentary from the model */
      results: Array<{
        /** ID of the tool use */
        tool_use_id: string
        /** Array of search hits */
        content: Array<{
          /** The title of the search result */
          title: string
          /** The URL of the search result */
          url: string
        }>
      } | string>
      /** Time taken to complete the search operation */
      durationSeconds: number
      /** Number of web searches performed */
      searchCount?: number
    }
    Workflow: {
      status: "async_launched" | "remote_launched"
      taskId: string
      /** TaskType of the registered background task — 'local_workflow' for in-process runs, 'remote_agent' when remote:true dispatches to CCR. Set on all new writes; absent only on transcripts written before this field existed. */
      taskType?: "local_workflow" | "remote_agent"
      /** meta.name from the workflow script — same value as task_started.workflow_name. Set on all new writes; absent only on transcripts written before this field existed. */
      workflowName?: string
      /** Local workflow run identifier for resumeFromRunId. Absent for remote_launched (the CCR session URL is the resume handle there) and on transcripts written before this field existed. */
      runId?: string
      summary?: string
      /** Directory where subagent transcripts are written during execution */
      transcriptDir?: string
      /** Path to the persisted workflow script for this invocation. Editable via Write/Edit; pass back as `scriptPath` to re-run without resending the script. */
      scriptPath?: string
      /** CCR session URL when status is remote_launched */
      sessionUrl?: string
      /** Non-blocking heads-up (e.g. local git state diverges from the pushed branch the cloud session will clone) */
      warning?: string
      /** Set if syntax check failed */
      error?: string
    }
    Write: {
      /** Whether a new file was created or an existing file was updated */
      type: "create" | "update"
      /** The path to the file that was written */
      filePath: string
      /** The content that was written to the file */
      content: string
      /** Diff patch showing the changes (empty when nothing changed, the diff timed out, or — with originalFile null on an update — the previous content was too large to diff) */
      structuredPatch: {
        oldStart: number
        oldLines: number
        newStart: number
        newLines: number
        lines: string[]
      }[]
      /** The original file content before the write (null for new files, or when the previous content was too large to include) */
      originalFile: string | null
      gitDiff?: {
        filename: string
        status: "modified" | "added"
        additions: number
        deletions: number
        changes: number
        patch: string
        /** GitHub owner/repo when available */
        repository?: string | null
      }
      /** True when the user edited the proposed content in the permission dialog before accepting */
      userModified?: boolean
      /** True when the write was held for the machine owner to review instead of written; the file is unchanged */
      staged?: boolean
    }
  }
}
