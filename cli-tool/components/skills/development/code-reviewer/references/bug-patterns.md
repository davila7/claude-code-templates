# Bug patterns worth checking

Concrete patterns that reviews miss, grouped by area. Each is something to look for in the diff, not something to report on sight: confirm it with a failure scenario first (SKILL.md, step 5).

## Cross-language

| Pattern | What to look for |
|---|---|
| Inverted condition | `if (!user.isAdmin)` guarding the admin path; `filter` that keeps what it should drop |
| Off-by-one | `<=` against `length`, `slice(0, n - 1)`, pagination `offset = page * size` when `page` starts at 1 |
| Wrong variable | Copy-pasted block still using the first loop's variable or the old field name |
| Check-then-act race | `if not exists(x): create(x)` without a unique constraint or lock |
| Partial update | Two writes that must both happen, no transaction, the second can fail |
| Error swallowed | `catch {}` / `except: pass` / `_ = err`, or a log line followed by code that uses the failed result |
| Time | Naive datetimes compared to aware ones, `new Date('2026-03-08')` parsed as UTC, local midnight around DST, durations in ms vs s |
| Money | Floats for currency, rounding before summing, currency not stored next to the amount |
| Fallback hides failure | `value or default` where `0`, `""` or `False` are valid values |
| Identity from the client | `userId`, `role`, `price` or `ownerId` read from the request body instead of the session or the server |

## JavaScript / TypeScript

- Missing `await` on a promise whose result or failure matters; `array.forEach(async ...)` does not wait.
- `[10, 9, 1].sort()` sorts as strings; numeric sort needs `(a, b) => a - b`.
- `==` with mixed types; `typeof null === 'object'`; `if (count)` failing on `0`.
- `JSON.parse` on untrusted input without try/catch; `parseInt`/`Number` trusted as validation (`parseInt('12abc')` is 12, `Number('')` is 0).
- `as` casts and `!` non-null assertions that silence a real `undefined`.
- React: state updated from a stale closure, `useEffect` with a missing dependency or no cleanup, list keys from array index on a reorderable list, `dangerouslySetInnerHTML` with user content.
- Node: `child_process.exec` with a template string (shell injection, prefer `execFile` with an args array), `path.join(base, userInput)` with no check that the result stays under `base`.

## Python

- Mutable default arguments: `def f(items=[])` shares one list across calls.
- Late-binding closures in loops: `[lambda: i for i in range(3)]` all return 2.
- `except Exception:` (or bare `except:`) that hides the real error; `raise` in `finally` that replaces the original, or `return`/`break` in `finally` that silently drops it.
- `is` used for value comparison (`x is 1000`, `s is "abc"`).
- `subprocess` with `shell=True` and interpolated input; `yaml.load` with `Loader=yaml.Loader` or `UnsafeLoader` (use `yaml.safe_load`); `pickle` on untrusted data.
- Iterating a dict or list while mutating it.
- Async: a blocking call (`requests`, `time.sleep`, file I/O) inside `async def`; a coroutine called without `await`.
- Django/SQLAlchemy: `.raw()` / `text()` with f-strings; a queryset evaluated in a loop (N+1); `get()` without handling `DoesNotExist`.

## Go

- `err` shadowed by `:=` in an inner scope, so the outer `err` is still `nil`.
- `defer f.Close()` inside a loop keeps every file open until the function returns.
- Writing to a `nil` map panics; reading from a nil map does not, so the bug hides in tests.
- Closures, goroutines or `&v` capturing a loop variable when the `go` directive in `go.mod` is below 1.22 (the directive decides, not the toolchain).
- A goroutine or ticker with no way to stop (no `ctx.Done()` case), or a receive or `range` that can block forever because nothing guarantees a send or a close on its channel.
- `http.Response.Body` not closed; `context.Background()` where the request context should propagate.
- Returning a typed `nil` pointer as an `error` interface makes `err != nil` true.

## Java / Kotlin

- Java: `==` on `String` or boxed `Integer` outside the cache range. (Kotlin `==` is value equality; `===` is reference equality.)
- `equals` overridden without `hashCode`.
- Kotlin: a Java platform type (`String!`) assigned to a non-null Kotlin type, which throws an NPE later, far from the call.
- `Optional.get()` without `isPresent()`; a `stream()` with side effects.
- Resources not in try-with-resources / `use {}`.

## SQL and migrations

- String-built queries anywhere user input reaches them. Values (including `LIMIT`/`OFFSET`) can be bound parameters; identifiers (the `ORDER BY` column, sort direction, table or column names) cannot, so whitelist them.
- `ADD COLUMN ... NOT NULL` with no default fails on a table that has rows. On Postgres 11+ a constant default is cheap, but a volatile default (`clock_timestamp()`, `random()`, `gen_random_uuid()`; `now()` is stable and stays cheap) rewrites the table, and `SET NOT NULL` or a new constraint without `NOT VALID` scans every existing row while holding a lock that blocks writes (`ACCESS EXCLUSIVE` for `SET NOT NULL` and `CHECK`, `SHARE ROW EXCLUSIVE` for a foreign key).
- Dropping or renaming a column the currently deployed code still reads (deploy order matters: expand, migrate, contract).
- A new query on a column with no index, on a table that is large in production.
- `UPDATE` or `DELETE` whose `WHERE` can be empty or always true.

## Auth and web

- A new route, GraphQL field or RPC method without the auth check its siblings have.
- Object fetched by id with no ownership check (IDOR).
- Redirect target from a query parameter (open redirect).
- Server-side fetch of a user-supplied URL (SSRF to metadata endpoints or internal services).
- Tokens, passwords or full request bodies written to logs or error trackers.
- CORS that echoes the request `Origin` back with credentials allowed (`cors({ origin: true, credentials: true })`), which lets any site read authenticated responses; cookies without `HttpOnly`/`Secure`/`SameSite` where they hold a session.

## Tests

- The test mocks the very function under test, so it can never fail.
- Assertions only on "no exception" or on a mock being called, not on the result.
- Snapshot updated in the same diff as the behaviour change, with no reason given.
- A test that depends on the current date, timezone, test order or network.
