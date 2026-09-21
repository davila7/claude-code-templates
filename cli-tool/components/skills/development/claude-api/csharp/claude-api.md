# Claude API — C#

> **Note:** The C# SDK is the official Anthropic SDK for C#. Tool use is supported via the Messages API with a beta `BetaToolRunner` for automatic tool execution loops. The SDK also supports Microsoft.Extensions.AI IChatClient integration with function invocation and Managed Agents (beta).

## Namespace Reference

Types are organized by namespace. If a type you need isn't shown in an example below, locate it via this table first - don't block on fetching SDK source over the network.

| `using` | Contains |
|---|---|
| `Anthropic` | `AnthropicClient`, top-level options |
| `Anthropic.Models.Messages` | non-beta request/response types - `MessageCreateParams`, `Model`, `Role`, `ContentBlock`, `TextBlock`, `ToolUseBlock`, `ToolResultBlockParam`, `Tool*` (tool definition classes) |
| `Anthropic.Models.Beta.Messages` | beta-endpoint equivalents - `MessageCreateParams`, `BetaMessage`, `BetaTool*`, `Speed`, `BetaRequestMcpServerUrlDefinition`, context-editing/compaction configs |
| `Anthropic.Models.Beta` | shared beta constants |
| `Anthropic.Models.Beta.Files` | Files API types |
| `Anthropic.Models.Messages.Batches` | Batch API types |
| `Anthropic.Helpers.Beta` | `BetaToolRunner`, beta helper utilities |
| `Anthropic.Exceptions` | `AnthropicApiException`, `AnthropicRateLimitException`, `Anthropic5xxException`, etc. - see `shared/error-codes.md` |
| `Anthropic.Bedrock` / `Anthropic.Vertex` / `Anthropic.Foundry` / `Anthropic.Aws` | platform clients (separate NuGet packages): `AnthropicBedrockMantleClient`, `AnthropicFoundryClient`, `AnthropicAwsClient` |

`client.Messages.*` uses non-beta types; `client.Beta.Messages.*` uses the `Anthropic.Models.Beta.Messages` types. Both namespaces define a `MessageCreateParams` - pick the one matching the client path you call.

### Key types per feature

Write from this table instead of reflecting the SDK assembly. Endpoint column tells you whether to use `client.Messages.*` or `client.Beta.Messages.*`.

| Feature | Endpoint | Key C# types (namespace per table above) |
|---|---|---|
| User profiles | beta | `client.Beta.UserProfiles.Create(...)` / `.Retrieve(id)` / `.List()`. Pass the returned profile id on the beta messages call. Requires a beta header - check the SDK's beta-headers reference for the current flag. |
| Agent Skills | beta | `BetaContainerParams` (with `Skills = [new BetaSkillParams { ... }]`), `BetaCodeExecutionTool20250825`. `Betas = ["code-execution-2025-08-25"]` (Skills is out of beta - no `skills-2025-10-02`). Download the output via `client.Beta.Files.Download(fileId)`. |
| Advisor tool | beta | `BetaAdvisorTool20260301` - may not be in all SDK releases yet |
| Cache diagnostics | beta | `Diagnostics = new() { PreviousMessageID = ... }`, `BetaCacheControlEphemeral`, `BetaContentBlockParam` |
| Context editing | beta | `ContextManagement = new BetaContextManagementConfig { Edits = [new BetaClearToolUses20250919Edit()] }`. `Betas = ["context-management-2025-06-27"]` (not `compact-2026-01-12` - that's for `BetaCompact20260112Edit`). |
| Memory tool | non-beta | `Tools = [new ToolUnion(new MemoryTool20250818())]` |
| Programmatic tool calling | non-beta | `CodeExecutionTool20260120`, `ToolResultBlockParam`, `ContentBlockParam` |
| Task budgets | beta | `BetaOutputConfig` with `TaskBudget = new BetaTokenTaskBudget { ... }` |
| Tool search | non-beta | `new ToolUnion(new ToolSearchToolRegex20251119 { Type = ToolSearchToolRegex20251119Type.ToolSearchToolRegex20251119 })` - `Type` must be set explicitly. |
| Web search | non-beta | `new ToolUnion(new WebSearchTool20260209())` - the latest variant with dynamic filtering (Claude Fable 5.1 + Claude Opus 5 + Opus 4.8/4.7/4.6 + Claude Sonnet 5 + Sonnet 4.6). For older models or Vertex, use `WebSearchTool20250305()` |

### Discovering type and member names

If a type or member you need isn't in the tables above, `strings ~/.nuget/packages/anthropic/*/lib/*/Anthropic.dll | grep -i <term>` is fast and sufficient for locating class and property names. **Do not escalate to a `dotnet run` reflection probe** to dump members precisely - the first compile is slow enough to be backgrounded in many environments, trapping you in a polling loop. Instead, write `Program.cs` using the names `strings | grep` found; if a member name is wrong the compiler error (`error CS1061: 'X' does not contain a definition for 'Y'`) points at it in a few seconds, faster than any reflection probe.

Note that `strings` will not surface wire-format snake_case field names (`output_tokens`, `stop_reason`) - those are stored in the DLL differently. **C# properties are the PascalCase equivalent of the wire field** (`response.Usage.OutputTokens`, `response.StopReason`). If you know the wire field name from the docs, write the PascalCase property and compile; do not probe for the snake_case string.

### Minimal working skeleton

**Write a plain `Program.cs` body** - `using` statements followed by top-level statements, as below. Do **not** add a `#!/usr/bin/env dotnet` shebang or `#:package Anthropic@*` directive: those are .NET file-based-app syntax and fail with `CS1024: Preprocessor directive expected` when the file is compiled via an existing `.csproj`. The standard project setup (per the [C# quickstart](https://platform.claude.com/docs/en/get-started): `dotnet new console` -> `dotnet add package Anthropic` -> edit `Program.cs` -> `dotnet run`) provides the `.csproj` and package reference.

Start from this - it compiles as-is. Fill in the feature-specific fields; do not spend turns running reflection or XML-doc inspection to discover type names first.

```csharp
using System;
using Anthropic;
using Anthropic.Models.Messages;       // or Anthropic.Models.Beta.Messages for beta endpoints

AnthropicClient client = new();

var message = await client.Messages.Create(new MessageCreateParams
{
    Model = "claude-opus-5",
    MaxTokens = 1024,
    Messages = [ new() { Role = Role.User, Content = "Hello, Claude" } ],
});

Console.WriteLine(message);
```

For beta features (anything behind an `anthropic-beta` header), use the beta client path and namespace - same overall shape:

```csharp
using System;
using Anthropic;
using Anthropic.Models.Beta.Messages;

AnthropicClient client = new();

var response = await client.Beta.Messages.Create(new MessageCreateParams
{
    Model = "claude-opus-5",
    MaxTokens = 4096,
    Betas = ["<beta-flag>"],
    Messages = [ new() { Role = Role.User, Content = "..." } ],
    // Tools = new BetaToolUnion[] { new BetaSomeTool { ... } },   // for tool features
});

Console.WriteLine(response);
```

If a type name the feature needs isn't in this file, write it following the naming pattern in the Namespace Reference above and fix from compiler output - producing a `Program.cs` and iterating beats researching.

### Common C# compile errors

- **CS8803 (top-level statements must precede type declarations):** put any `record`/`class`/`struct` definitions **after** the last top-level statement, at the end of the file. A record defined above `var client = new AnthropicClient()` will not compile.
- **`await foreach` on a `Task<...Page>`:** `client.Models.List()` returns a `Task<ModelListPage>`, which is not directly async-enumerable. Await it first, then iterate: `var page = await client.Models.List(); foreach (var m in page.Items) {...}`. For auto-pagination, check whether the page type exposes `AutoPagingEachAsync()` or similar before reaching for `await foreach`.

## Installation

```bash
dotnet add package Anthropic
```

## Client Initialization

```csharp
using Anthropic;

// Default (uses ANTHROPIC_API_KEY env var)
AnthropicClient client = new();

// Explicit API key (use environment variables - never hardcode keys)
AnthropicClient client = new() {
    ApiKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY")
};
```

---

## Basic Message Request

```csharp
using Anthropic.Models.Messages;

var parameters = new MessageCreateParams
{
    Model = "claude-opus-5",
    MaxTokens = 16000,
    Messages = [new() { Role = Role.User, Content = "What is the capital of France?" }]
};
var response = await client.Messages.Create(parameters);

// ContentBlock is a union wrapper. .Value unwraps to the variant object,
// then OfType<T> filters to the type you want. Or use the TryPick* idiom
// shown in the Thinking section below.
foreach (var text in response.Content.Select(b => b.Value).OfType<TextBlock>())
{
    Console.WriteLine(text.Text);
}
```

---

## Thinking

**Adaptive thinking is the recommended mode for Claude 4.6+ models.** Claude decides dynamically when and how much to think.

> **Fable 5, Claude Opus 5, Opus 4.8, Opus 4.7, Opus 4.6, and Sonnet 4.6:** Use adaptive thinking (below). `new ThinkingConfigEnabled { BudgetTokens = N }` is removed on Fable 5, Claude Opus 5, Opus 4.8, and 4.7 (400 if sent); deprecated on Opus 4.6 and Sonnet 4.6.
> **Claude Opus 5:** thinking is on by default - omitting `Thinking` runs adaptive (`ThinkingConfigAdaptive` is equivalent), unlike Opus 4.8/4.7 where omitting it meant no thinking. `ThinkingConfigDisabled` is accepted only at effort `high` or lower; pairing it with `xhigh`/`max` returns a 400.
> **Older models:** Use `new ThinkingConfigEnabled { BudgetTokens = N }` (budget must be < `MaxTokens`, min 1024).

```csharp
using Anthropic.Models.Messages;

var response = await client.Messages.Create(new MessageCreateParams
{
    Model = "claude-opus-5",
    MaxTokens = 16000,
    // ThinkingConfigParam? implicitly converts from the concrete variant classes -
    // no wrapper needed.
    // display opt-in: default is omitted (empty thinking text) on Fable 5 / Mythos 5 / Claude Opus 5 / Opus 4.8 / 4.7
    Thinking = new ThinkingConfigAdaptive { Display = Display.Summarized },
    Messages =
    [
        new() { Role = Role.User, Content = "Solve: 27 * 453" },
    ],
});

// ThinkingBlock(s) precede TextBlock in Content. TryPick* narrows the union.
foreach (var block in response.Content)
{
    if (block.TryPickThinking(out ThinkingBlock? t))
    {
        Console.WriteLine($"[thinking] {t.Thinking}");
    }
    else if (block.TryPickText(out TextBlock? text))
    {
        Console.WriteLine(text.Text);
    }
}
```

Alternative to `TryPick*`: `.Select(b => b.Value).OfType<ThinkingBlock>()` (same LINQ pattern as the Basic Message example).

---

## Context Editing / Compaction (Beta)

**Beta-namespace prefix is inconsistent** (source-verified against `src/Anthropic/Models/Beta/Messages/*.cs` @ 12.9.0). No prefix: `MessageCreateParams`, `MessageCountTokensParams`, `Role`, `Speed`. **Everything else has the `Beta` prefix**: `BetaMessageParam`, `BetaMessage`, `BetaContentBlock`, `BetaToolUseBlock`, all block param types. The unprefixed `Role` WILL collide with `Anthropic.Models.Messages.Role` if you import both namespaces (CS0104). Safest: import only Beta; if mixing, alias the beta `Role`:

```csharp
using Anthropic.Models.Beta.Messages;
using NonBeta = Anthropic.Models.Messages;  // only if you also need non-beta types
// Now: MessageCreateParams, BetaMessageParam, Role (beta's), NonBeta.Role (if needed)
```


`BetaMessage.Content` is `IReadOnlyList<BetaContentBlock>` - a 15-variant discriminated union. Narrow with `TryPick*`. **Response `BetaContentBlock` is NOT assignable to param `BetaContentBlockParam`** - there's no `.ToParam()` in C#. Round-trip by converting each block:

```csharp
using Anthropic.Models.Beta.Messages;

var betaParams = new MessageCreateParams   // no Beta prefix - see unprefixed list above
{
    Model = "claude-opus-5",
    MaxTokens = 16000,
    Betas = ["compact-2026-01-12"],
    ContextManagement = new BetaContextManagementConfig
    {
        Edits = [new BetaCompact20260112Edit()],
    },
    Messages = messages,
};
BetaMessage resp = await client.Beta.Messages.Create(betaParams);

foreach (BetaContentBlock block in resp.Content)
{
    if (block.TryPickCompaction(out BetaCompactionBlock? compaction))
    {
        // Content is nullable - compaction can fail server-side
        Console.WriteLine($"compaction summary: {compaction.Content}");
    }
}

// Context-edit metadata lives on a separate nullable field
if (resp.ContextManagement is { } ctx)
{
    foreach (var edit in ctx.AppliedEdits)
        Console.WriteLine($"cleared {edit.ClearedInputTokens} tokens");
}

// ROUND-TRIP: BetaMessageParam.Content is BetaMessageParamContent (a string|list
// union). It implicit-converts from List<BetaContentBlockParam>, NOT from the
// response's IReadOnlyList<BetaContentBlock>. Convert each block:
List<BetaContentBlockParam> paramBlocks = [];
foreach (var b in resp.Content)
{
    if (b.TryPickText(out var t)) paramBlocks.Add(new BetaTextBlockParam { Text = t.Text });
    else if (b.TryPickCompaction(out var c)) paramBlocks.Add(new BetaCompactionBlockParam { Content = c.Content });
    // ... other variants as needed
}
messages.Add(new BetaMessageParam { Role = Role.Assistant, Content = paramBlocks });
```

All 15 `BetaContentBlock.TryPick*` variants: `Text`, `Thinking`, `RedactedThinking`, `ToolUse`, `ServerToolUse`, `WebSearchToolResult`, `WebFetchToolResult`, `CodeExecutionToolResult`, `BashCodeExecutionToolResult`, `TextEditorCodeExecutionToolResult`, `ToolSearchToolResult`, `McpToolUse`, `McpToolResult`, `ContainerUpload`, `Compaction`.

**`BetaToolUseBlock.Input` is `IReadOnlyDictionary<string, JsonElement>`** - index by key then call the `JsonElement` extractor:

```csharp
if (block.TryPickToolUse(out BetaToolUseBlock? tu))
{
    int a = tu.Input["a"].GetInt32();
    string s = tu.Input["name"].GetString()!;
}
```

---

## Effort Parameter

Effort is nested under `OutputConfig`, NOT a top-level property. `ApiEnum<string, Effort>` has an implicit conversion from the enum, so assign `Effort.High` directly.

```csharp
OutputConfig = new OutputConfig { Effort = Effort.High },
```

Values: `Effort.Low`, `Effort.Medium`, `Effort.High`, `Effort.Max`. Combine with `Thinking = new ThinkingConfigAdaptive()` for cost-quality control.

---

## Prompt Caching

`System` takes `MessageCreateParamsSystem?` - a union of `string` or `List<TextBlockParam>`. There is no `SystemTextBlockParam`; use plain `TextBlockParam`. The implicit conversion needs the concrete `List<TextBlockParam>` type (array literals won't convert). For placement patterns and the silent-invalidator audit checklist, see `shared/prompt-caching.md`.

```csharp
System = new List<TextBlockParam> {
    new() {
        Text = longSystemPrompt,
        CacheControl = new CacheControlEphemeral(),  // auto-sets Type = "ephemeral"
    },
},
```

Optional `Ttl` on `CacheControlEphemeral`: `new() { Ttl = Ttl.Ttl1h }` or `Ttl.Ttl5m`. `CacheControl` also exists on `Tool.CacheControl` and top-level `MessageCreateParams.CacheControl`.

Verify hits via `response.Usage.CacheCreationInputTokens` / `response.Usage.CacheReadInputTokens`.

---

## Token Counting

```csharp
MessageTokensCount result = await client.Messages.CountTokens(new MessageCountTokensParams {
    Model = "claude-opus-5",
    Messages = [new() { Role = Role.User, Content = "Hello" }],
});
long tokens = result.InputTokens;
```

`MessageCountTokensParams.Tools` uses a different union type (`MessageCountTokensTool`) than `MessageCreateParams.Tools` (`ToolUnion`) - if you're passing tools, the compiler will tell you when it matters.

---

## PDF / Document Input

`DocumentBlockParam` takes a `DocumentBlockParamSource` union: `Base64PdfSource` / `UrlPdfSource` / `PlainTextSource` / `ContentBlockSource`. `Base64PdfSource` auto-sets `MediaType = "application/pdf"` and `Type = "base64"`.

```csharp
new MessageParam {
    Role = Role.User,
    Content = new List<ContentBlockParam> {
        new DocumentBlockParam { Source = new Base64PdfSource { Data = base64String } },
        new TextBlockParam { Text = "Summarize this PDF" },
    },
}
```

---

## Fast Mode (Beta)

```csharp
var response = await client.Beta.Messages.Create(new MessageCreateParams {
    Model = "claude-opus-5", MaxTokens = 4096,
    Speed = Speed.Fast,
    Betas = ["fast-mode-2026-02-01"],
    Messages = [...],
});
```

## Models API

```csharp
var page = await client.Models.List();
foreach (var m in page.Items) { Console.WriteLine(m.ID); }
var one = await client.Models.Retrieve("claude-opus-5");
```

## Long Output (128k) + Prefill

Set `MaxTokens = 128000` on `client.Messages` and use the streaming path (see the Streaming section below). On Claude 4+ models, 128k output is native - no `output-128k-*` beta header or beta namespace is needed.

**Prefilling the assistant message** (putting a trailing `Role.Assistant` message in the input) is **not supported** on Claude Fable 5.1, Claude Opus 5, Opus 4.8, Opus 4.7, Opus 4.6, and Sonnet 4.6 - requests return a 400. Use `OutputConfig.Format` (structured outputs) instead.

## Stop Details

When `StopReason` is `"refusal"`, the response includes structured `StopDetails`:

```csharp
if (response.StopReason == "refusal" && response.StopDetails is { } details)
{
    Console.WriteLine($"Category: {details.Category}");
    Console.WriteLine($"Explanation: {details.Explanation}");
}
```

**Refusal fallbacks (Claude Fable 5.1) - opt in by default.** Fallbacks are opt-in: without them a refused request simply stops. In `claude-fable-5-1` code, include `Fallbacks = [new(Model.ClaudeOpus4_8)]` plus the `AnthropicBeta.ServerSideFallback2026_06_01` beta on the beta messages call by default - a policy decline is re-served by the fallback model inside the same call. Not available on Amazon Bedrock, Vertex AI, or Microsoft Foundry - use the client-side handler there: `new AnthropicClient { Handlers = [new BetaRefusalFallbackHandler { Fallbacks = [new(Model.ClaudeOpus4_8)] }] }` (namespace `Anthropic.Helpers`), with per-conversation state via `BetaFallbackState.Create()` scoped with `using (fallbackState.Use()) { ... }`. Full semantics (billing, sticky routing, streaming) and a runnable example: `shared/model-migration.md` -> Migrating to Claude Fable 5.1 -> `refusal` stop reason, and the C# SDK repo's `examples/` (WebFetch via `shared/live-sources.md`).

---

## Managed Agents (Beta)

The C# SDK supports Managed Agents via `client.Beta.Agents`, `client.Beta.Sessions`, `client.Beta.Environments`, and related namespaces. See `shared/managed-agents-overview.md` for the architecture and `curl/managed-agents.md` for the wire-level reference.

## Tool Use

### Defining a tool

`Tool` (NOT `ToolParam`) with an `InputSchema` record. `InputSchema.Type` is auto-set to `"object"` by the constructor - don't set it. `ToolUnion` has an implicit conversion from `Tool`, triggered by the collection expression `[...]`.

```csharp
using System.Text.Json;
using Anthropic.Models.Messages;

var parameters = new MessageCreateParams
{
    Model = Model.ClaudeSonnet4_6,
    MaxTokens = 16000,
    Tools = [
        new Tool {
            Name = "get_weather",
            Description = "Get the current weather in a given location",
            InputSchema = new() {
                Properties = new Dictionary<string, JsonElement> {
                    ["location"] = JsonSerializer.SerializeToElement(
                        new { type = "string", description = "City name" }),
                },
                Required = ["location"],
            },
        },
    ],
    Messages = [new() { Role = Role.User, Content = "Weather in Paris?" }],
};
```

Derived from `anthropic-sdk-csharp/src/Anthropic/Models/Messages/Tool.cs` and `ToolUnion.cs:799` (implicit conversion).

See [shared tool use concepts](../../shared/tool-use-concepts.md) for the loop pattern.
### Converting response content to the follow-up assistant message

When echoing Claude's response back in the assistant turn, **there is no `.ToParam()` helper** - manually reconstruct each `ContentBlock` variant as its `*Param` counterpart. Do NOT use `new ContentBlockParam(block.Json)`: it compiles and serializes, but `.Value` stays `null` so `TryPick*`/`Validate()` fail (degraded JSON pass-through, not the typed path).

```csharp
using Anthropic.Models.Messages;

Message response = await client.Messages.Create(parameters);

// No .ToParam() - reconstruct per variant. Implicit conversions from each
// *Param type to ContentBlockParam mean no explicit wrapper.
List<ContentBlockParam> assistantContent = [];
List<ContentBlockParam> toolResults = [];
foreach (ContentBlock block in response.Content)
{
    if (block.TryPickText(out TextBlock? text))
    {
        assistantContent.Add(new TextBlockParam { Text = text.Text });
    }
    else if (block.TryPickThinking(out ThinkingBlock? thinking))
    {
        // Signature MUST be preserved - the API rejects tampering
        assistantContent.Add(new ThinkingBlockParam
        {
            Thinking = thinking.Thinking,
            Signature = thinking.Signature,
        });
    }
    else if (block.TryPickRedactedThinking(out RedactedThinkingBlock? redacted))
    {
        assistantContent.Add(new RedactedThinkingBlockParam { Data = redacted.Data });
    }
    else if (block.TryPickToolUse(out ToolUseBlock? toolUse))
    {
        // ToolUseBlock has required Caller; ToolUseBlockParam.Caller is optional - don't copy it
        assistantContent.Add(new ToolUseBlockParam
        {
            ID = toolUse.ID,
            Name = toolUse.Name,
            Input = toolUse.Input,
        });
        // Execute the tool; collect ONE result per tool_use block - the API
        // rejects the follow-up if any tool_use ID lacks a matching tool_result.
        string result = ExecuteYourTool(toolUse.Name, toolUse.Input);
        toolResults.Add(new ToolResultBlockParam
        {
            ToolUseID = toolUse.ID,
            Content = result,
        });
    }
}

// Follow-up: prior messages + assistant echo + user tool_result(s)
List<MessageParam> followUpMessages =
[
    .. parameters.Messages,
    new() { Role = Role.Assistant, Content = assistantContent },
    new() { Role = Role.User, Content = toolResults },
];
```

`ToolResultBlockParam` has no tuple constructor - use the object initializer. `Content` is a string-or-list union; a plain `string` implicitly converts.

---

## Structured Output

```csharp
OutputConfig = new OutputConfig {
    Format = new JsonOutputFormat {
        Schema = new Dictionary<string, JsonElement> {
            ["type"] = JsonSerializer.SerializeToElement("object"),
            ["properties"] = JsonSerializer.SerializeToElement(
                new { name = new { type = "string" } }),
            ["required"] = JsonSerializer.SerializeToElement(new[] { "name" }),
        },
    },
},
```

`JsonOutputFormat.Type` is auto-set to `"json_schema"` by the constructor. `Schema` is `required`.

---

## Anthropic-Defined Tools

Web search, bash, text editor, and code execution are Anthropic-defined tools with built-in schemas. Web search and code execution are server-executed; bash and text editor are client-executed (you handle the `tool_use` locally - see `shared/tool-use-concepts.md`). Type names are version-suffixed; constructors auto-set `name`/`type`. **Wrap each in `new ToolUnion(...)` explicitly.**

```csharp
Tools = [
    new ToolUnion(new WebSearchTool20260209()),
    new ToolUnion(new ToolBash20250124()),
    new ToolUnion(new ToolTextEditor20250728()),
    new ToolUnion(new CodeExecutionTool20260120()),
],
```

Also available: `new ToolUnion(new WebFetchTool20260209())`, `new ToolUnion(new MemoryTool20250818())`. `WebSearchTool20260209` optionals: `AllowedDomains`, `BlockedDomains`, `MaxUses`, `UserLocation`.

---

## Tool Runner (Beta)

The C# SDK provides a `BetaToolRunner` for automatic tool execution loops. Define tools with raw JSON schemas, and the runner handles the API call -> tool execution -> result feedback loop.

```csharp
using Anthropic.Models.Beta.Messages;

// Define tools and create params as shown in the Tool Use section above,
// but using the beta namespace types (BetaToolUnion, etc.)
var runner = client.Beta.Messages.ToolRunner(betaParams);

await foreach (BetaMessage message in runner)
{
    foreach (var block in message.Content)
    {
        if (block.TryPickText(out var text))
        {
            Console.WriteLine(text.Text);
        }
    }
}
```

---

## Streaming

```csharp
using Anthropic.Models.Messages;

var parameters = new MessageCreateParams
{
    Model = Model.ClaudeOpus4_8,
    MaxTokens = 64000,
    Messages = [new() { Role = Role.User, Content = "Write a haiku" }]
};

await foreach (RawMessageStreamEvent streamEvent in client.Messages.CreateStreaming(parameters))
{
    if (streamEvent.TryPickContentBlockDelta(out var delta) &&
        delta.Delta.TryPickText(out var text))
    {
        Console.Write(text.Text);
    }
}
```

**`RawMessageStreamEvent` TryPick methods** (naming drops the `Message`/`Raw` prefix): `TryPickStart`, `TryPickDelta`, `TryPickStop`, `TryPickContentBlockStart`, `TryPickContentBlockDelta`, `TryPickContentBlockStop`. There is no `TryPickMessageStop` - use `TryPickStop`.

---

## Files API

> **Out of beta.** In current SDKs `client.Beta.Files` has breaking shape changes from previous versions, matching the stable `client.Files` - migrate per the Files API row in `shared/live-sources.md`. Examples below predate this.

Files live under `client.Beta.Files` (namespace `Anthropic.Models.Beta.Files`). `BinaryContent` implicit-converts from `Stream` and `byte[]`.

```csharp
using Anthropic.Models.Beta.Files;
using Anthropic.Models.Beta.Messages;

FileMetadata meta = await client.Beta.Files.Upload(
    new FileUploadParams { File = File.OpenRead("doc.pdf") });

// Referencing the uploaded file requires Beta message types:
new BetaRequestDocumentBlock {
    Source = new BetaFileDocumentSource { FileID = meta.ID },
}
```

The non-beta `DocumentBlockParamSource` union has no file-ID variant - file references need `client.Beta.Messages.Create()`.

---

## Message Batches API

```csharp
var batch = await client.Messages.Batches.Create(new() {
    Requests = [
        new() { CustomID = "req-1", Params = new() { Model = "claude-opus-5", MaxTokens = 1024, Messages = [...] } },
    ],
});
// Poll client.Messages.Batches.Retrieve(batch.ID) until ProcessingStatus == "ended",
// then iterate client.Messages.Batches.Results(batch.ID).
```
