---
name: pixeltable
description: >
  Build multimodal AI apps with Pixeltable. One application file (app.py)
  declares TableModel tables and FastAPIRouter routes. Create tables with
  pxt schema update. Start HTTP with pxt service update. Insert a row or
  POST to try the app. Use computed columns instead of LangChain,
  pandas-as-store, or a separate vector DB. Use when building RAG or
  tool-calling agents, processing images/video/audio/documents, or serving an
  API. Do NOT use for general Python or direct PostgreSQL administration.
license: Apache-2.0
source: https://github.com/pixeltable/pixeltable-skill
---

## STOP

If you find yourself importing any of these, you are off-path:

1. **Do not use LangChain / LlamaIndex / Haystack / LangGraph.** Chunking is `document_splitter`. Search is `.similarity()`. Tools are `pxt.tools()` + `invoke_tools()`.
2. **Do not use pandas as a working store.** Tables are the store. `.collect().to_pandas()` is export only.
3. **Do not write `for row in ...:` loops calling models.** Wrap the call in a computed column.
4. **Do not install a separate vector database.** In an app, `__indexes__ = [pxt.EmbeddingIndex(...)]` on the model. In a notebook, `t.add_embedding_index(col, embedding=fn)`. Search with `.similarity(string=query)`.
5. **Do not write `while not done:` agent loops.** Insert a row. The computed-column chain runs.

See [anti-patterns.md](references/anti-patterns.md) (6 macros).

## What is Pixeltable?

One application file (`app.py`) is the backend.

- `pxt schema update`: creates tables from `TableModel` classes. Does not start HTTP.
- Insert a sample, `.select()`, `pxt dashboard`, or `pxt schema diff`. Compute runs on insert. After `pxt service update`, curl POST.
- `pxt service update`: starts HTTP (local or `pxt://`). `pxt service list` prints the URL. This is the serving command; do not reach for `pxt service run`.

First run: [Quickstart](https://docs.pixeltable.com/overview/quick-start). Why: [Why Pixeltable](https://docs.pixeltable.com/overview/pixeltable).

## Starting a new project

```bash
pip install 'pixeltable[serve]'   # Python 3.11+
pxt init
pxt service example --out app.py
pxt schema check app.py           # validates the file; warns if 'app' is shadowed
pxt schema update app.py my_app
pxt service update app.py my_app -f   # no TTY: without -f a pending start exits 3
pxt service list                  # assigned port; do not hard-code :8000
```

`pxt service example` writes models plus a `FastAPIRouter`. Schema only (no HTTP): `pxt schema example --brief --out app.py`. Then edit `app.py` and run `pxt schema update` again. After a schema change, run `pxt service update ... -f` again if routes exist; until then they answer 409. Do not `python app.py`. Full flags: [cli.md](references/cli.md).

The last argument (`my_app`, or `pxt://org:db` on Cloud) is a catalog directory, not a folder on disk. `pxt init` marks the project root. Local handle: `pxt.get_table('my_app.docs')`, or bind the models: `import app; app.TableModel.bind_all('my_app')`, then `app.Docs.insert(...)` / `app.Docs.select(...).collect()`. Inspect: `pxt ls -l`, `pxt errors my_app/docs`, `pxt dashboard`.

Provider keys (`OPENAI_API_KEY`, ...) come from the environment or `~/.pixeltable/config.toml`, and the `pxt` daemon reads both once, at startup; local services get them from the daemon. After changing either, run `pxt daemon restart` (every command answers 409 until you do), then `pxt service restart my_app/ingest`.

Same file on [Cloud](https://docs.pixeltable.com/howto/deployment/cloud): add `[[pixeltable.database]]` with `name = 'pxt://org:db'` to `pixeltable.toml`, then:

```bash
pxt login                                  # browser sign-in; or export PIXELTABLE_API_KEY, which wins
pxt db update pxt://org:db -f              # project files, image, workers; not secrets, rows, or HTTP
pxt schema update app.py pxt://org:db -f
pxt service update app.py pxt://org:db -f
```

Provider keys on Cloud: `pxt secret set pxt://org OPENAI_API_KEY=...`, never in `pixeltable.toml`. Cloud handle: `pxt.get_table('pxt://org:db/docs')`. Media goes to the database's managed home bucket unless a column sets `destination=`. Try the app with a dashboard insert plus `pxt schema diff`; read failures with `pxt service logs` / `pxt db logs`.

## The application file

`pxt service example --out app.py` writes this shape. Edit it. Then `pxt schema update app.py my_app`.

```python
import pixeltable as pxt
import pixeltable.functions as pxtf
from pixeltable.serving import FastAPIRouter

TableModel = pxt.model_base()


@pxt.udf
def excerpt(text: str, n: int = 12) -> str:
    return text if len(text) <= n else f'{text[:n]}...'


class Docs(TableModel, name='docs'):
    id = pxt.Column(value=pxtf.uuid.uuid7(), primary_key=True)
    title: pxt.String
    body: pxt.String | None
    title_upper = pxtf.string.upper(title)
    summary = excerpt(title)


ingest = FastAPIRouter(name='ingest')
ingest.add_insert_route(
    Docs, path='/docs', inputs=[Docs.title, Docs.body],
    outputs=[Docs.id, Docs.title_upper, Docs.summary],
)
ingest.add_update_route(
    Docs, path='/docs/update', inputs=[Docs.title],
    outputs=[Docs.id, Docs.title_upper],
)
ingest.add_compute_route(Docs, path='/titles', inputs=[Docs.title], outputs=[Docs.title_upper])
```

Annotation is a stored column. Assignment is a computed column. Optional is `T | None`. Primary key is `pxt.Column(..., primary_key=True)`; `add_update_route` matches rows by it, so the request body carries `id` even though `inputs` does not list it. Indexes on the model: `__indexes__ = [pxt.EmbeddingIndex(...)]`.

Already have FastAPI: after schema update, `ingest.bind('my_app')` then `app.include_router(ingest)`. Or define the `fastapi.FastAPI` object in `app.py` and `include_router()` each router there; `pxt service update` then serves that one application. Call `pxt.get_table()` inside custom handlers. [workflows.md](references/workflows.md).

RAG, views, and search: [workflows.md](references/workflows.md). Do not add Hugging Face or spaCy unless the user asked.

## Apps vs notebooks

- **Apps:** `app.py` + `pxt schema update` + `pxt service update`. Indexes on the model.
- **Notebooks / REPL:** `pxt.create_table()`, `add_computed_column()`, `add_embedding_index()`. The appendix below uses that form.

## Where to look

| Need | Open |
|------|------|
| `pxt schema`, `pxt service`, inspect | [cli.md](references/cli.md) |
| Types, views, UDFs, UDAs, tool calling | [core-api.md](references/core-api.md) |
| Provider import, arguments, and output shape | [providers.md](references/providers.md) |
| Serving, FastAPIRouter, routes | [workflows.md](references/workflows.md) |
| Wrong stack | [anti-patterns.md](references/anti-patterns.md) |

Add video, audio, agents, or a UI by editing `app.py`. A view is either a filter (`base=Docs.where(...)`) or an iterator (`frame_iterator`, `audio_splitter`, `document_splitter`, `video_splitter`, `string_splitter`, `list_iterator`, `tile_iterator`). Check `pixeltable.functions` before writing a UDF. Start from `pxt service example` or `pxt schema example`. Do not invent a second `pxt schema update` path.

## API traps

| Wrong | Correct |
|-------|---------|
| `openai.vision(...)` | Deprecated (the only deprecated function in `pixeltable.functions`). Use `chat_completions` with `image_url`, or `responses` |
| `from pixeltable.iterators import ...` | The whole `pixeltable.iterators` package is a deprecated shim (`FrameIterator`, `VideoSplitter`, `DocumentSplitter`, `StringSplitter`, `AudioSplitter`, `TileIterator`). Import the function from `pixeltable.functions.*` -- e.g. `from pixeltable.functions.video import frame_iterator` |
| `similarity(query)` | `similarity(string=query)`. Also `image=` / `audio=` / `video=` / `document=` / `vector=`; `idx=` picks among several indexes on one column |
| Re-run with `if_exists='ignore'` to fix logic | App: edit the expression, `pxt schema update`, then `pxt recompute my_app/docs summary -f`: the update keeps the old values. Notebook: `t.alter_computed_column(summary=...)`, which recomputes it and its dependents |
| Change a column's type in place (`T` to `T \| None`, stored to computed, `stored=`) | `UNSUPPORTED`: the whole update applies nothing, and `--allow-destructive` does not help. A computed column: rename it (one `--allow-destructive -f` pass). A stored column: renaming drops its data, so declare `T \| None` up front |
| `t.summary_errortype` | `t.summary.errortype` / `t.summary.errormsg`, on stored computed or media columns. `t.<col>.fileurl` / `.localpath` for media |
| `pxt.Required[pxt.String]` | Non-nullable by default. Optional: `T \| None` |
| `@pxt.udf def f(x: str)` fed a nullable column | A non-nullable parameter that receives `None` **skips the call**: the cell is `None` and `errormsg` is empty. Annotate `x: str \| None` and handle `None` in the body |
| `whisper.load_model(...)` inside a UDF body | Weights reload on every row. Use the shipped wrapper (`pxtf.whisper.transcribe`, `clip.using(...)`), or a module-scope cached loader |
| `recompute_columns(columns=['summary'])` | `t.recompute_columns('summary', errors_only=True)` |
| TOML routes or a retired serve CLI | `FastAPIRouter` + `pxt schema update` + `pxt service update` |
| `add_embedding_index()` in `app.py` | `__indexes__` on the TableModel. Note the DSL names an index `name=`, the SDK `idx_name=` |
| `make_video(order_by=...)` / `stitch_tiles(order_by=...)` | Both are `requires_order_by` UDAs: the ordering expression is the **first positional** argument -- `make_video(t.pos, t.frame, fps=25)`. `order_by=` raises |
| `pxt.create_table()` / `get_table()` at import in `app.py` | `TableModel` + `pxt schema update`. Import must not mutate the catalog |
| `EmbeddingIndex(frame, image_embed=clip)` | `embedding=clip` (covers text and image). Or both `string_embed=` and `image_embed=`. `image_embed=` alone cannot answer `similarity(string=...)` |
| `uuid.astype(pxt.String)` | `uuid.to_string()` (`from pixeltable.functions.uuid import to_string`). `astype` does not cast UUID to String |
| `json_col.astype(pxt.String)` on a dict or list | Fails at insert: `Expected string, got dict`. Serialize with `pxtf.json.dumps(json_col)` |

Extract the field (`.text`, `.choices[0].message.content`). The field is Json holding a string: `.astype(pxt.String)` it before concatenating or embedding.

## Notebook / REPL appendix

```python
import pixeltable as pxt

pxt.create_dir('my_project', if_exists='ignore')
t = pxt.create_table('my_project.documents', {
    'title': pxt.String,
    'content': pxt.String,
    'image': pxt.Image,
    'video': pxt.Video,
    'audio': pxt.Audio,
    'doc': pxt.Document,
}, if_exists='ignore')
```

Types are non-nullable by default. Optional is `T | None`. Do not use `pxt.Required`.

```python
from pixeltable.functions.uuid import uuid7

t = pxt.create_table('my_project.items', {
    'content': pxt.String,
    'uuid': uuid7(),
}, primary_key=['uuid'], if_exists='ignore')
```

Insert: `t.insert([{...}])`. Computed column:

```python
from pixeltable.functions.openai import chat_completions

t.add_computed_column(
    summary=chat_completions(
        messages=[{'role': 'user', 'content': t.content}],
        model='gpt-4o-mini',
    ).choices[0].message.content,
    if_exists='ignore',
)
```

Views: `document_splitter`, `frame_iterator` (from `pixeltable.functions.video`), `string_splitter`, `audio_splitter`. Notebook indexes: `t.add_embedding_index('content', embedding=embed_fn, if_exists='ignore')`.

Query: `t.where(...).select(...).collect()`. Similarity: `t.content.similarity(string=query)`. In `@pxt.query`, alias as `score=sim`.

UDFs are recorded as a module path relative to the project root (`app.excerpt`).

Always `if_exists='ignore'` on notebook `create_*` / `add_*`. Failed cells: `t.recompute_columns('summary', errors_only=True)`, or `pxt recompute my_project/documents summary --errors-only -f`. `string_splitter` / `document_splitter(..., separators='sentence')` need spaCy. Embedding indexes need `.using(...)` to bind model arguments.

## Resources

- [Quickstart](https://docs.pixeltable.com/overview/quick-start)
- [CLI](https://docs.pixeltable.com/platform/cli)
- [Developer MCP](https://github.com/pixeltable/mcp-server-pixeltable-developer) (catalog component: `database/pixeltable`)
- [Cloud MCP](https://pixeltable.com/developers/mcp-cloud) (optional; reads and operates Cloud, see [cli.md](references/cli.md))
- [Docs](https://docs.pixeltable.com/llms-full.txt)
