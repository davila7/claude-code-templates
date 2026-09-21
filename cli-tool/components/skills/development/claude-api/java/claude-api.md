# Claude API — Java

> **Note:** The Java SDK supports the Claude API and beta tool use with annotated classes. Agent SDK is not yet available for Java.

## Package Reference

Types are organized by package. If a class you need isn't shown in an example below, locate it via this table first - don't block on fetching SDK source over the network.

| `import` prefix | Contains |
|---|---|
| `com.anthropic.client` / `com.anthropic.client.okhttp` | `AnthropicClient`, `AnthropicOkHttpClient` |
| `com.anthropic.models.messages` | non-beta request/response types - `MessageCreateParams`, `Model`, `Message`, `TextBlockParam`, `ContentBlockParam`, `ToolUseBlockParam`, `ToolResultBlockParam`, `CacheControlEphemeral`, `Tool*` (e.g. `ToolBash20250124`, `ToolTextEditor20250728`), `StopReason`, `StructuredMessage*` |
| `com.anthropic.models.messages.batches` | Batch API - `BatchResultsParams`, `MessageBatchIndividualResponse` |
| `com.anthropic.models.beta` | `AnthropicBeta` (beta-flag constants) |
| `com.anthropic.models.beta.messages` | beta-endpoint types - `MessageCreateParams`, `BetaMessage`, `BetaStopReason`, `BetaContextManagementConfig`, `BetaMcpToolset`, `BetaRequestMcpServerUrlDefinition`, `BetaTool*` |
| `com.anthropic.core` | `JsonValue`, `JsonField`, `JsonSchemaLocalValidation`, `com.anthropic.core.http.StreamResponse` |
| `com.anthropic.errors` | typed exceptions - `AnthropicServiceException`, `RateLimitException`, `NotFoundException`, etc. (see `shared/error-codes.md`) |

`client.messages()` uses `com.anthropic.models.messages.*`; `client.beta().messages()` uses `com.anthropic.models.beta.messages.*`. Both packages define a `MessageCreateParams` - import the one matching the client path you call.

### Key types per feature

Write from this table instead of `javap`/jar inspection. Endpoint column tells you whether to use `client.messages()` or `client.beta().messages()`.

| Feature | Endpoint | Key Java types / builder calls |
|---|---|---|
| User profiles | beta | `client.beta().userProfiles().create(...)` / `.retrieve(id)` / `.list()`. Pass the returned profile id on the beta `MessageCreateParams`. Requires a beta header - check the SDK's beta-headers reference for the current flag. |
| Agent Skills | beta | `BetaContainerParams`, `BetaSkillParams`, `BetaCodeExecutionTool20250825`. `.addBeta("code-execution-2025-08-25")` (Skills is out of beta - no `skills-2025-10-02`). Download the output via `client.beta().files().download(fileId)`. |
| Cache diagnostics | beta | `BetaDiagnosticsParam`, `BetaCacheControlEphemeral` |
| Context editing | beta | `.contextManagement(BetaContextManagementConfig.builder()...)`. The edit strategy is a `BetaClearToolUses20250919Edit` (or `BetaClearThinking20251015Edit`); its trigger is a `BetaInputTokensTrigger` built separately and passed to the edit's builder - there is no direct `.inputTokensTrigger(N)` shortcut on the edit builder. `javap` the edit and trigger classes for the exact setter names. |
| Memory tool | non-beta | `.addTool(MemoryTool20250818.builder().build())` from `com.anthropic.models.messages` |
| Programmatic tool calling | non-beta | `CodeExecutionTool20260120`, `Tool`, `ContentBlockParam` |
| Strict tool use | non-beta | `Tool`, `Tool.InputSchema` |
| Task budgets | beta | `.outputConfig(BetaOutputConfig.builder().taskBudget(BetaTokenTaskBudget.builder()...))` |
| Tool search | non-beta | `.addTool(ToolSearchToolRegex20251119.builder()...)` from `com.anthropic.models.messages` |
| Web search | non-beta | `WebSearchTool20260209` from `com.anthropic.models.messages` - the latest variant with dynamic filtering (Claude Fable 5.1 + Claude Opus 5 + Opus 4.8/4.7/4.6 + Claude Sonnet 5 + Sonnet 4.6). For older models or Vertex, use `WebSearchTool20250305` |

### Discovering type and member names

If a class or builder method you need isn't in the tables above, `jar tf <anthropic-java-core jar> | grep -i <term>` or `javap -classpath <jar> com.anthropic.models....` is fast enough to locate names. **Do not compile and run a separate reflection program** to enumerate members - the first build is slow enough to be backgrounded in many environments, trapping you in a polling loop. Write the script with the names you found and let the compiler error (`cannot find symbol`) point at any wrong member.

## Installation

Maven:

```xml
<dependency>
    <groupId>com.anthropic</groupId>
    <artifactId>anthropic-java</artifactId>
    <version>2.34.0</version>
</dependency>
```

Gradle:

```groovy
implementation("com.anthropic:anthropic-java:2.34.0")
```

## Client Initialization

```java
import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;

// Default (reads ANTHROPIC_API_KEY from environment)
AnthropicClient client = AnthropicOkHttpClient.fromEnv();

// Explicit API key
AnthropicClient client = AnthropicOkHttpClient.builder()
    .apiKey("your-api-key")
    .build();
```

---

## Basic Message Request

```java
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Message;

MessageCreateParams params = MessageCreateParams.builder()
    .model("claude-opus-5")  // .model(String) overload - use it for ids with no typed Model constant yet
    .maxTokens(16000L)
    .addUserMessage("What is the capital of France?")
    .build();

Message response = client.messages().create(params);
response.content().stream()
    .flatMap(block -> block.text().stream())
    .forEach(textBlock -> System.out.println(textBlock.text()));
```

---

## Thinking

**Adaptive thinking is the recommended mode for Claude 4.6+ models.** Claude decides dynamically when and how much to think. The builder has a direct `.thinking(ThinkingConfigAdaptive)` overload - no manual union wrapping.

> **Fable 5, Claude Opus 5, Opus 4.8, Opus 4.7, Opus 4.6, and Sonnet 4.6:** Use adaptive thinking (below). `ThinkingConfigEnabled.builder().budgetTokens(N)` is removed on Fable 5, Claude Opus 5, Opus 4.8, and 4.7 (400 if sent); deprecated on Opus 4.6 and Sonnet 4.6.
> **Claude Opus 5:** thinking is on by default - omitting `.thinking(...)` runs adaptive (`ThinkingConfigAdaptive` is equivalent), unlike Opus 4.8/4.7 where omitting it meant no thinking. `ThinkingConfigDisabled` is accepted only at effort `HIGH` or lower; pairing it with `XHIGH`/`MAX` returns a 400.
> **Older models:** Use `.thinking(ThinkingConfigEnabled.builder().budgetTokens(N).build())` (budget must be < `maxTokens`, min 1024).

```java
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import com.anthropic.models.messages.ThinkingConfigAdaptive;

MessageCreateParams params = MessageCreateParams.builder()
    .model(Model.CLAUDE_SONNET_4_6)
    .maxTokens(16000L)
    .thinking(ThinkingConfigAdaptive.builder().build())
    .addUserMessage("Solve this step by step: 27 * 453")
    .build();

for (ContentBlock block : client.messages().create(params).content()) {
    block.thinking().ifPresent(t -> System.out.println("[thinking] " + t.thinking()));
    block.text().ifPresent(t -> System.out.println(t.text()));
}
```

`ContentBlock` narrowing: `.thinking()` / `.text()` return `Optional<T>` - use `.ifPresent(...)` or `.stream().flatMap(...)`. Alternative: `isThinking()` / `asThinking()` boolean+unwrap pairs (throws on wrong variant).

---

## Effort Parameter

Effort is nested inside `OutputConfig` - there is NO `.effort()` directly on `MessageCreateParams.Builder`.

```java
import com.anthropic.models.messages.OutputConfig;

.outputConfig(OutputConfig.builder()
    .effort(OutputConfig.Effort.HIGH)  // or LOW, MEDIUM, XHIGH, MAX
    .build())
```

Combine with `Thinking = ThinkingConfigAdaptive` for cost-quality control.

---

## Prompt Caching

System message as a list of `TextBlockParam` with `CacheControlEphemeral`. Use `.systemOfTextBlockParams(...)` - the plain `.system(String)` overload can't carry cache control. For placement patterns and the silent-invalidator audit checklist, see `shared/prompt-caching.md`.

```java
import com.anthropic.models.messages.TextBlockParam;
import com.anthropic.models.messages.CacheControlEphemeral;

.systemOfTextBlockParams(List.of(
    TextBlockParam.builder()
        .text(longSystemPrompt)
        .cacheControl(CacheControlEphemeral.builder()
            .ttl(CacheControlEphemeral.Ttl.TTL_1H)  // optional; also TTL_5M
            .build())
        .build()))
```

There's also a top-level `.cacheControl(CacheControlEphemeral)` on `MessageCreateParams.Builder` and on `Tool.builder()`.

Verify hits via `response.usage().cacheCreationInputTokens()` / `response.usage().cacheReadInputTokens()`.

---

## Token Counting

```java
import com.anthropic.models.messages.MessageCountTokensParams;

long tokens = client.messages().countTokens(
    MessageCountTokensParams.builder()
        .model(Model.CLAUDE_SONNET_4_6)
        .addUserMessage("Hello")
        .build()
).inputTokens();
```

---

## PDF / Document Input

`DocumentBlockParam` builder has source shortcuts. Wrap in `ContentBlockParam.ofDocument()` and pass via `.addUserMessageOfBlockParams()`.

```java
import com.anthropic.models.messages.DocumentBlockParam;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.TextBlockParam;

DocumentBlockParam doc = DocumentBlockParam.builder()
    .source(Base64PdfSource.builder().data(base64String).build())
    // or .source(UrlPdfSource.builder().url("https://...").build())
    .title("My Document")        // optional
    .build();
```

For **Files API** document references, use the beta path and beta types - see the Files API section below: `BetaRequestDocumentBlock.builder().source(BetaFileDocumentSource.builder().fileId(id).build())`.

```java
.addUserMessageOfBlockParams(List.of(
    ContentBlockParam.ofDocument(doc),
    ContentBlockParam.ofText(TextBlockParam.builder().text("Summarize this").build())))
```

---

## Stop Details

When `stopReason()` is `"refusal"`, the response includes structured `stopDetails()`:

```java
response.stopDetails().ifPresent(details -> {
    System.out.println("Category: " + details.category());
    System.out.println("Explanation: " + details.explanation());
});
```

**Refusal fallbacks (Claude Fable 5.1) - opt in by default.** Fallbacks are opt-in: without them a refused request simply stops. New `claude-fable-5-1` code should include the server-side `fallbacks` parameter (beta header `server-side-fallback-2026-06-01`, fallback model `claude-opus-4-8`, on the beta messages call) by default. The exact Java builder methods (and the client-side middleware for providers without server-side support) are not documented here - WebFetch the Java SDK repo's `examples/` from `shared/live-sources.md`; full semantics in `shared/model-migration.md` -> Migrating to Claude Fable 5.1 -> `refusal` stop reason.

---

## Error Type

`AnthropicServiceException` exposes `.errorType()` returning `Optional<ErrorType>` for programmatic error classification:

```java
try {
    client.messages().create(params);
} catch (AnthropicServiceException e) {
    e.errorType().ifPresent(type ->
        System.out.println("Error type: " + type)  // RATE_LIMIT_ERROR, OVERLOADED_ERROR, etc.
    );
}
```

---

## Tool Use (Beta)

The Java SDK supports beta tool use with annotated classes. Tool classes implement `Supplier<String>` for automatic execution via `BetaToolRunner`.

### Tool Runner (automatic loop)

```java
import com.anthropic.models.beta.messages.MessageCreateParams;
import com.anthropic.models.beta.messages.BetaMessage;
import com.anthropic.helpers.BetaToolRunner;
import com.fasterxml.jackson.annotation.JsonClassDescription;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import java.util.function.Supplier;

@JsonClassDescription("Get the weather in a given location")
static class GetWeather implements Supplier<String> {
    @JsonPropertyDescription("The city and state, e.g. San Francisco, CA")
    public String location;

    @Override
    public String get() {
        return "The weather in " + location + " is sunny and 72°F";
    }
}

BetaToolRunner toolRunner = client.beta().messages().toolRunner(
    MessageCreateParams.builder()
        .model("claude-opus-5")
        .maxTokens(16000L)
        .putAdditionalHeader("anthropic-beta", "structured-outputs-2025-11-13")
        .addTool(GetWeather.class)
        .addUserMessage("What's the weather in San Francisco?")
        .build());

for (BetaMessage message : toolRunner) {
    System.out.println(message);
}
```

### Memory Tool

The Java SDK provides `BetaMemoryToolHandler` for implementing the memory tool backend. You supply a handler that manages file storage, and the `BetaToolRunner` handles memory tool calls automatically.

```java
import com.anthropic.helpers.BetaMemoryToolHandler;
import com.anthropic.helpers.BetaToolRunner;
import com.anthropic.models.beta.messages.BetaMemoryTool20250818;
import com.anthropic.models.beta.messages.BetaMessage;
import com.anthropic.models.beta.messages.MessageCreateParams;
import com.anthropic.models.beta.messages.ToolRunnerCreateParams;

// Implement BetaMemoryToolHandler with your storage backend (e.g., filesystem)
BetaMemoryToolHandler memoryHandler = new FileSystemMemoryToolHandler(sandboxRoot);

MessageCreateParams createParams = MessageCreateParams.builder()
    .model("claude-opus-5")
    .maxTokens(4096L)
    .addTool(BetaMemoryTool20250818.builder().build())
    .addUserMessage("Remember that my favorite color is blue")
    .build();

BetaToolRunner toolRunner = client.beta().messages().toolRunner(
    ToolRunnerCreateParams.builder()
        .betaMemoryToolHandler(memoryHandler)
        .initialMessageParams(createParams)
        .build());

for (BetaMessage message : toolRunner) {
    System.out.println(message);
}
```

See the [shared memory tool concepts](../../shared/tool-use-concepts.md) for more details on the memory tool.

### Non-Beta Tool Declaration (manual JSON schema)

`Tool.InputSchema.Properties` is a freeform `Map<String, JsonValue>` wrapper - build property schemas via `putAdditionalProperty`. `type: "object"` is the default. The builder has a direct `.addTool(Tool)` overload that wraps in `ToolUnion` automatically.

```java
import com.anthropic.core.JsonValue;
import com.anthropic.models.messages.Tool;

Tool tool = Tool.builder()
    .name("get_weather")
    .description("Get the current weather in a given location")
    .inputSchema(Tool.InputSchema.builder()
        .properties(Tool.InputSchema.Properties.builder()
            .putAdditionalProperty("location", JsonValue.from(Map.of("type", "string")))
            .build())
        .required(List.of("location"))
        .build())
    .build();

MessageCreateParams params = MessageCreateParams.builder()
    .model(Model.CLAUDE_SONNET_4_6)
    .maxTokens(16000L)
    .addTool(tool)
    .addUserMessage("Weather in Paris?")
    .build();
```

For manual tool loops, handle `tool_use` blocks in the response, send `tool_result` back, loop until `stop_reason` is `"end_turn"`. See [shared tool use concepts](../../shared/tool-use-concepts.md).

### Building `MessageParam` with Content Blocks (Tool Result Round-Trip)

`MessageParam.Content` is an inner union class (string | list). Use the builder's `.contentOfBlockParams(List<ContentBlockParam>)` alias - there is NO separate `MessageParamContent` class with a static `ofBlockParams`:

```java
import com.anthropic.models.messages.MessageParam;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.ToolResultBlockParam;

List<ContentBlockParam> results = List.of(
    ContentBlockParam.ofToolResult(ToolResultBlockParam.builder()
        .toolUseId(toolUseBlock.id())
        .content(yourResultString)
        .build())
);

MessageParam toolResultMsg = MessageParam.builder()
    .role(MessageParam.Role.USER)
    .contentOfBlockParams(results)   // builder alias for Content.ofBlockParams(...)
    .build();
```

---

## Structured Output

The class-based overload auto-derives the JSON schema from your POJO and gives you a typed `.text()` return - no manual schema, no manual parsing.

```java
import com.anthropic.models.messages.StructuredMessageCreateParams;

record Book(String title, String author) {}
record BookList(List<Book> books) {}

StructuredMessageCreateParams<BookList> params = MessageCreateParams.builder()
    .model(Model.CLAUDE_SONNET_4_6)
    .maxTokens(16000L)
    .outputConfig(BookList.class)  // returns a typed builder
    .addUserMessage("List 3 classic novels")
    .build();

client.messages().create(params).content().stream()
    .flatMap(cb -> cb.text().stream())
    .forEach(typed -> {
        // typed.text() returns BookList, not String
        for (Book b : typed.text().books()) System.out.println(b.title());
    });
```

Supports Jackson annotations: `@JsonPropertyDescription`, `@JsonIgnore`, `@ArraySchema(minItems=...)`. Manual schema path: `OutputConfig.builder().format(JsonOutputFormat.builder().schema(...).build())`.

---

## Anthropic-Defined Tools

Version-suffixed types; `name`/`type` auto-set by builder. Direct `.addTool()` overloads exist for most tool types; where one is missing (newer or less-common tools - see the advisor note below), wrap via the union type's static factory: `.addTool(BetaToolUnion.of<ToolName>(builder...build()))`. Web search and code execution are server-executed; bash and text editor are client-executed (you handle the `tool_use` locally - see `shared/tool-use-concepts.md`).

```java
import com.anthropic.models.messages.WebSearchTool20260209;
import com.anthropic.models.messages.ToolBash20250124;
import com.anthropic.models.messages.ToolTextEditor20250728;
import com.anthropic.models.messages.CodeExecutionTool20260120;

.addTool(WebSearchTool20260209.builder()
    .maxUses(5L)                              // optional
    .allowedDomains(List.of("example.com"))   // optional
    .build())
.addTool(ToolBash20250124.builder().build())
.addTool(ToolTextEditor20250728.builder().build())
.addTool(CodeExecutionTool20260120.builder().build())
```

Also available: `WebFetchTool20260209`, `MemoryTool20250818`, `ToolSearchToolBm25_20251119`. For the advisor tool, use `BetaAdvisorTool20260301` in the beta namespace with `.addBeta("advisor-tool-2026-03-01")` (server-side; advisor model >= executor model). There is no direct `.addTool(BetaAdvisorTool20260301)` overload on the beta builder - wrap it via the `BetaToolUnion` static factory for the advisor type; if `javac` rejects the specific factory method name, `javap com.anthropic.models.beta.messages.BetaToolUnion | grep -i advisor` shows the exact one.

### Beta namespace (MCP, compaction)

For beta-only features use `com.anthropic.models.beta.messages.*` - class names have a `Beta` prefix AND live in the beta package. The beta `MessageCreateParams.Builder` has direct `.addTool(BetaToolBash20250124)` overloads AND `.addMcpServer()`:

```java
import com.anthropic.models.beta.messages.MessageCreateParams;
import com.anthropic.models.beta.messages.BetaToolBash20250124;
import com.anthropic.models.beta.messages.BetaCodeExecutionTool20260120;
import com.anthropic.models.beta.messages.BetaRequestMcpServerUrlDefinition;

MessageCreateParams params = MessageCreateParams.builder()
    .model(Model.CLAUDE_OPUS_4_8)
    .maxTokens(16000L)
    .addBeta("mcp-client-2025-11-20")
    .addTool(BetaToolBash20250124.builder().build())
    .addTool(BetaCodeExecutionTool20260120.builder().build())
    .addMcpServer(BetaRequestMcpServerUrlDefinition.builder()
        .name("my-server")
        .url("https://example.com/mcp")
        .build())
    .addUserMessage("...")
    .build();

client.beta().messages().create(params);
```

`BetaTool*` types are NOT interchangeable with non-beta `Tool*` - pick one namespace per request.

**Reading server-tool blocks in the response:** `ServerToolUseBlock` has `.id()`, `.name()` (enum), and `._input()` returning raw `JsonValue` - there is NO typed `.input()`. For code execution results, unwrap two levels:

```java
for (ContentBlock block : response.content()) {
    block.serverToolUse().ifPresent(stu -> {
        System.out.println("tool: " + stu.name() + " input: " + stu._input());
    });
    block.codeExecutionToolResult().ifPresent(r -> {
        r.content().resultBlock().ifPresent(result -> {
            System.out.println("stdout: " + result.stdout());
            System.out.println("stderr: " + result.stderr());
            System.out.println("exit: " + result.returnCode());
        });
    });
}
```

---

## Streaming

```java
import com.anthropic.core.http.StreamResponse;
import com.anthropic.models.messages.RawMessageStreamEvent;

MessageCreateParams params = MessageCreateParams.builder()
    .model(Model.CLAUDE_OPUS_4_8)
    .maxTokens(64000L)
    .addUserMessage("Write a haiku")
    .build();

try (StreamResponse<RawMessageStreamEvent> streamResponse = client.messages().createStreaming(params)) {
    streamResponse.stream()
        .flatMap(event -> event.contentBlockDelta().stream())
        .flatMap(deltaEvent -> deltaEvent.delta().text().stream())
        .forEach(textDelta -> System.out.print(textDelta.text()));
}
```

---

## Files API

> **Out of beta.** In current SDKs `client.beta().files()` has breaking shape changes from previous versions, matching the stable `client.files()` - migrate per the Files API row in `shared/live-sources.md`. Examples below predate this.

Under `client.beta().files()`. File references in messages need the beta message types (non-beta `DocumentBlockParam.Source` has no file-ID variant).

```java
import com.anthropic.models.beta.files.FileUploadParams;
import com.anthropic.models.beta.files.FileMetadata;
import com.anthropic.models.beta.messages.BetaRequestDocumentBlock;
import com.anthropic.models.beta.messages.BetaFileDocumentSource;
import java.nio.file.Paths;

FileMetadata meta = client.beta().files().upload(
    FileUploadParams.builder()
        .file(Paths.get("/path/to/doc.pdf"))  // or .file(InputStream) or .file(byte[])
        .build());

// Reference in a beta message:
BetaRequestDocumentBlock doc = BetaRequestDocumentBlock.builder()
    .source(BetaFileDocumentSource.builder().fileId(meta.id()).build())
    .build();
```

Other methods: `.list()`, `.delete(String fileId)`, `.download(String fileId)`, `.retrieveMetadata(String fileId)`.
