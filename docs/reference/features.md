# Reference: the feature catalogue

A **feature** is a self-contained piece of client behaviour that plugs into
the generated SDK's operation pipeline: retries, caching, rate limiting,
tracing, an offline mock transport, and so on. Features are the answer to
"my SDK needs to do X on every call" that does not involve forking
generated code.

Eighteen features ship with `@voxgig/sdkgen`. Every one of them is
implemented for **every bundled language target** (the only exception is
`seneca-provider`, which delegates to the `ts` SDK it wraps rather than
implementing features itself), so `retry` means the same thing in Go as it
does in TypeScript.

Everything below is generated into *your* repo, under your license. There
is no runtime to install and no service to call.

- To **add** a feature to a project, see
  [Add a feature](../how-to/add-a-feature.md).
- For the **hooks** a feature can implement, see
  [Operation pipeline and feature hooks](./hooks.md).
- For the **concepts**, see
  [The operation pipeline](../explanation/operation-pipeline.md).

---

## The catalogue at a glance

| Feature | Does | Seam |
| --- | --- | --- |
| [`retry`](#retry) | Retries transient failures with exponential backoff, jitter, and `Retry-After` | transport |
| [`timeout`](#timeout) | Bounds each request with a deadline and aborts the transport | transport |
| [`ratelimit`](#ratelimit) | Keeps the client under a quota with a token bucket | transport |
| [`cache`](#cache) | Serves safe reads from a bounded TTL cache | transport |
| [`proxy`](#proxy) | Routes outbound calls through an HTTP(S) proxy | transport |
| [`netsim`](#netsim) | Injects latency, failures and outages for offline tests | transport |
| [`cost`](#cost) | Prices every call, attributes the spend, and enforces a budget | transport + hooks |
| [`test`](#test) | An in-memory mock API served from seed data | transport (base) |
| [`idempotency`](#idempotency) | Stamps `Idempotency-Key` on mutating calls | `PreRequest` |
| [`paging`](#paging) | Reads and writes pagination signals for list operations | `PreRequest`, `PreResult` |
| [`streaming`](#streaming) | Consumes list results incrementally by async iteration | `PreResult` |
| [`rbac`](#rbac) | Denies disallowed operations before they reach the network | `PrePoint` |
| [`telemetry`](#telemetry) | Opens a span per operation, propagates W3C trace context | `PrePoint`, `PreRequest`, `PreDone`, `PreUnexpected` |
| [`metrics`](#metrics) | Counts calls and latency, in total and per operation | `PrePoint`, `PreDone`, `PreUnexpected` |
| [`audit`](#audit) | Emits a compliance record per operation: actor, outcome, correlation id | `PreDone`, `PreUnexpected` |
| [`debug`](#debug) | Captures a ring buffer of traces with redacted headers | `PreRequest`, `PreResponse`, `PreDone`, `PreUnexpected` |
| [`clienttrack`](#clienttrack) | Stamps `User-Agent`, client-session and per-request ids | `PostConstruct`, `PreRequest` |
| [`log`](#log) | Structured logging at every pipeline stage | every stage |

Loosely, they group as **resilience** (`retry`, `timeout`, `ratelimit`,
`cache`), **correctness under retry** (`idempotency`), **large result sets**
(`paging`, `streaming`), **observability** (`telemetry`, `metrics`, `audit`,
`debug`, `log`, `clienttrack`), **governance** (`rbac`, `proxy`, `cost`), and
**testing** (`test`, `netsim`).

---

## Turning a feature on

Two steps, and they are at different times.

**1. Generation time.** The feature's source has to be in the project.
From the project's `.sdk/`:

```bash
voxgig-sdkgen feature add retry,timeout,cache
npm run build && npm run generate
```

`feature add` copies the feature's model file and, for every active target,
that target's implementation of the feature. A project carries only the
features it asked for.

**2. Construction time.** Every feature is **off until you switch it on**.
An added but unactivated feature is not even instantiated: it costs
nothing.

```ts
const client = new MyapiSDK({
  apikey: process.env.MYAPI_APIKEY,
  feature: {
    retry:   { active: true, retries: 4, maxDelay: 5000 },
    timeout: { active: true, ms: 10000 },
    cache:   { active: true, ttl: 30000 },
  },
})
```

Each entry is that feature's options block. `active` is the only key every
feature shares; the rest are per-feature and documented below.

### Ordering, and why it matters

Six features work by **wrapping the transport**. Each one wraps whatever is
already installed, so the one initialised *last* ends up *outermost* and
sees the call first.

Given a map, the order is deterministic: `test` first (it installs the base
mock transport, so it must sit at the bottom of the chain), then the
remaining names **sorted alphabetically**. For the wrapping features that
resolves to:

```
call ──▶ timeout ──▶ retry ──▶ ratelimit ──▶ proxy ──▶ netsim ──▶ cache ──▶ transport
```

Read that as: with the default order, one `timeout` deadline covers the
*whole* retry sequence, not each attempt.

To choose a different chain, pass `feature` as an **ordered array** instead
of a map. Array position is init order, so a per-attempt timeout looks like
this:

```ts
const client = new MyapiSDK({
  feature: [
    { name: 'timeout', active: true, ms: 2000 },   // innermost: per attempt
    { name: 'retry',   active: true, retries: 3 }, // outermost: owns the loop
  ],
})
```

Both forms accept the same option keys; the array form just adds `name`.

Hook dispatch follows the same order, so where two features both act at
`PreRequest` the earlier one runs first.

### Adding a feature instance at runtime

`options.extend` takes already-constructed feature instances, which is how
a host application injects a feature the generated SDK does not carry:

```ts
const client = new MyapiSDK({ extend: [new MyOwnFeature()] })
```

Extended instances are added after the configured ones. An instance can
place itself precisely by carrying `__before__`, `__after__` or
`__replace__` in its own `_options`, naming another feature:

```ts
class MyOwnFeature extends BaseFeature {
  name = 'mine'
  _options: any = { __after__: 'test' }   // sit just outside the mock transport
}
```

That positioning is read off the instance, so it is available to `extend`
only; a `__after__` key in the `feature` options map has no effect.

---

## The two seams

A feature attaches to the SDK in one of two places. Which one it uses is
declared by `transport` in its model file, and it determines what the
feature can see.

### Transport wrapping (`transport: 'wrap'`)

The feature replaces `utility.fetcher` in `init()` with a function that
calls the previous one. It sees **every HTTP attempt**, including attempts
made by another wrapper, and it can suppress, delay, repeat or answer a
request without the pipeline knowing.

`retry`, `timeout`, `ratelimit`, `cache`, `proxy` and `netsim` work this
way, and none of them dispatches a pipeline hook: their model's `hook` block
is empty. That is why a single operation call can produce three HTTP
requests but exactly one `PreDone`.

Wrapping and hooking are **not** mutually exclusive, though, and the model
says which a feature does rather than inferring it from an empty `hook`
block. [`cost`](#cost) is the bundled feature that needs both: it wraps the
transport to price every attempt, and hooks `PrePoint`/`PreDone` to enforce
a budget and attribute the spend to one operation.

`test` is the special case, `transport: 'base'`: it *replaces* the
transport rather than wrapping one, so it belongs at the bottom of the
chain.

### Pipeline hooks (`transport: 'none'`)

The feature implements named methods that the pipeline calls at each stage:

```
PrePoint → PreSpec → PreRequest → PreResponse → PreResult → PreDone
                                                             │
                                           (exception) → PreUnexpected
```

A hook sees the operation, not the HTTP attempt: one call, one pass. This
is the right seam for anything that reasons about *what the caller asked
for* rather than *what went over the wire*: `rbac` (deny at `PrePoint`,
before an endpoint is even resolved), `paging` (read the operation's
result), `metrics` and `audit` (one record per call, however many attempts
it took).

Only hooks the feature's model marks `active: true` are dispatched. See
[the hooks reference](./hooks.md).

---

## Inspecting what a feature did

Every feature records its own activity on the client under `_<name>`. This
is deliberate and it is what the generated cross-feature test suite asserts
against, so it is stable enough to build on, and prefixed so it stays out
of the way of your API's own surface.

| Feature | Property | Shape |
| --- | --- | --- |
| `retry` | `client._retry` | `{ attempts, retries: [{ attempt, status, error, wait }] }` |
| `timeout` | `client._timeout` | `{ count, ms }` |
| `ratelimit` | `client._ratelimit` | `{ throttled, waitMs }` |
| `cache` | `client._cache` | `{ hit, miss, bypass }` |
| `proxy` | `client._proxy` | `{ routed, url }` |
| `netsim` | `client._netsim` | `{ calls, applied: [...] }` |
| `idempotency` | `client._idempotency` | `{ issued, last }` |
| `paging` | `client._paging` | `{ last: <paging> }`, and `result.paging` per call |
| `streaming` | `client._streaming` | `{ opened }` |
| `rbac` | `client._rbac` | `{ allowed, denied, last }` |
| `telemetry` | `client._telemetry` | `{ spans: [...], active }` |
| `metrics` | `client._metrics` | `{ total, ops: { '<entity>.<op>': {...} } }` |
| `audit` | `client._audit` | `{ records: [...] }` |
| `debug` | `client._debug` | `{ entries: [...] }` |
| `clienttrack` | `client._clienttrack` | `{ session, requests, clientName, lastRequestId }` |
| `cost` | `client._cost` | `{ currency, total, ops, actors, budget, last }` |

`audit`, `debug` and `telemetry` also take a callback (`sink`, `onEntry`,
`exporter`) so records can be forwarded as they happen instead of polled.

### Deterministic tests

Every feature that measures time or invents an identifier takes an
injectable version of it, so an offline test asserts on exact numbers
rather than sleeping. The conventional names:

| Option | Replaces | Used by |
| --- | --- | --- |
| `now()` | the clock | `cache`, `metrics`, `audit`, `debug`, `telemetry`, `ratelimit` |
| `sleep(ms)` | the wait | `retry`, `ratelimit`, `netsim`, `streaming` |
| `idgen(kind)` / `keygen()` | id generation | `clienttrack`, `telemetry`, `idempotency` |
| `setTimer` / `clearTimer` | timer scheduling | `timeout` |

Combined with `netsim` for the failure side, a resilience test needs no
network and no wall clock:

```ts
const sleeps: number[] = []
const client = new MyapiSDK({
  feature: [
    { name: 'test', active: true, entity: seed },
    { name: 'netsim', active: true, failTimes: 2, failStatus: 503 },
    { name: 'retry', active: true, retries: 3, minDelay: 10, jitter: false,
      sleep: (ms: number) => { sleeps.push(ms) } },
  ],
})

await client.Product().load({ id: 'p1' })
// client._retry.attempts === 2, sleeps === [10, 20]
```

---

# The features

## `retry`

> Automatic retry of transient failures with exponential backoff

Wraps the transport so one operation call may make several HTTP attempts.
A failure counts as retryable when the transport throws or returns an
`Error`, returns nothing at all, or responds with a status in `statuses`.
Anything else, including a `404` or a `422`, is returned to the caller
immediately: retrying a request the server understood and rejected only
wastes time.

Backoff is `minDelay * factor ^ attempt`, plus a random jitter of up to
`minDelay`, capped at `maxDelay`. A `Retry-After` header on the response
overrides the computed delay (still capped at `maxDelay`), so a server that
states its own recovery time is believed rather than guessed at.

**Seam:** transport wrapper. No pipeline hooks.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `retries` | `2` | Maximum retries *after* the first attempt. |
| `minDelay` | `50` | Base delay in ms, and the jitter ceiling. |
| `maxDelay` | `2000` | Upper bound on any single wait, in ms. |
| `factor` | `2` | Backoff multiplier. |
| `statuses` | `[408, 425, 429, 500, 502, 503, 504]` | Response statuses treated as transient. |
| `jitter` | on | Set `false` for exact, testable delays. |
| `sleep(ms)` | `setTimeout` | Injectable wait. |

```ts
feature: { retry: { active: true, retries: 4, minDelay: 100, maxDelay: 5000 } }
```

**Notes.** When the budget is exhausted, a *thrown* error is rethrown and a
failed *response* is returned, which preserves whatever the pipeline would
have done without retry. Pair `retry` with [`idempotency`](#idempotency)
before retrying writes.

## `timeout`

> Per-request timeout with transport abort

Races each transport attempt against a deadline. If the deadline wins the
call resolves to a `timeout` error instead of hanging. An `AbortController`
signal is attached to the request, so a live `fetch` is genuinely
cancelled rather than left running.

**Seam:** transport wrapper. No pipeline hooks.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `ms` | `30000` | Deadline in ms. `0` or less disables the race. |
| `setTimer` / `clearTimer` | `setTimeout` / `clearTimeout` | Injectable scheduling. |

```ts
feature: { timeout: { active: true, ms: 10000 } }
```

**Notes.** Whether the deadline covers one attempt or a whole retry
sequence is a question of [ordering](#ordering-and-why-it-matters). With
the default map ordering `timeout` sits outside `retry` and bounds the
lot; put it first in the array form for a per-attempt deadline.

## `ratelimit`

> Client-side rate limiting via a token bucket

Each request consumes a token. The bucket refills at `rate` tokens per
second up to `burst` capacity; when it is empty the request waits for a
token rather than being rejected. This keeps a client under a published
quota by construction instead of discovering the quota through 429s.

**Seam:** transport wrapper. No pipeline hooks.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `rate` | `5` | Tokens per second. |
| `burst` | `rate` | Bucket capacity, so the size of an allowed spike. |
| `now()` / `sleep(ms)` | wall clock | Injectable clock and wait. |

```ts
feature: { ratelimit: { active: true, rate: 10, burst: 20 } }
```

**Notes.** This is a per-client-instance budget, not a distributed one.
Two processes each get their own bucket.

## `cache`

> Response caching for safe read requests

Serves a cached snapshot instead of hitting the network when the same
method and URL was fetched within `ttl` milliseconds. Only successful
(2xx) responses to cacheable methods are stored, keyed by method plus URL.
The store is bounded: at `max` entries the oldest is evicted.

Response bodies are one-shot streams, so a hit cannot simply replay the
original object. The feature normalises the body on capture, which means
both the caller who caused the fetch and every later hit can read the JSON
repeatedly.

**Seam:** transport wrapper. No pipeline hooks.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `ttl` | `5000` | Freshness window in ms. |
| `max` | `256` | Maximum entries before eviction. |
| `methods` | `['GET']` | Methods eligible for caching. |
| `now()` | `Date.now` | Injectable clock. |

```ts
feature: { cache: { active: true, ttl: 30000, max: 1000 } }
```

**Notes.** `client._cache` counts `hit`, `miss` and `bypass` (a request
that was cacheable by method but whose response was not stored). This is
a plain TTL cache: it does not read `Cache-Control` or revalidate with
`ETag`.

## `proxy`

> Outbound HTTP(S) proxy routing

Attaches proxy routing to each request. The proxy comes from `url`, or
from the standard environment variables when `fromEnv` is set. Hosts
matching `noProxy` bypass it, including subdomain matches and `*` for
everything.

Constructing a concrete agent is dependency-specific, so the feature does
not pick one for you. Supply an `agent` factory (wrapping undici's
`ProxyAgent`, say) and its result is attached as both `dispatcher` and
`agent`; without one, the request is annotated with `fetchdef.proxy` for
the transport to honour.

**Seam:** transport wrapper. No pipeline hooks.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `url` | `''` | Proxy URL, e.g. `http://proxy.internal:8080`. |
| `fromEnv` | `false` | Read `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` (either case). |
| `noProxy` | `[]` | Bypass list, as an array or a comma-separated string. |
| `agent(proxyUrl, url)` | none | Factory returning a transport-specific agent or dispatcher. |

```ts
import { ProxyAgent } from 'undici'

feature: {
  proxy: {
    active: true,
    fromEnv: true,
    agent: (proxyUrl: string) => new ProxyAgent(proxyUrl),
  },
}
```

## `netsim`

> Network behaviour simulation for offline testing

Injects realistic network conditions over whatever transport is beneath
it, live or mocked, so a test suite can exercise slowness, transient
failure, rate limiting and total outage without a network.

Every mode is **counter-driven per client instance**, so simulations are
reproducible without mocking timers. `failRate` adds probabilistic
failures through a seeded generator when you want coverage-style testing
instead of a scripted sequence.

Conditions are evaluated in priority order: `offline`, then `errorTimes`,
then `rateLimitTimes`, then the failure modes, then latency plus a real
call.

**Seam:** transport wrapper. No pipeline hooks.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `latency` | `0` | Fixed ms, or `{ min, max }` for a uniform sample. |
| `failTimes` | `0` | First N calls return `failStatus`. |
| `failStatus` | `503` | The status those failures carry. |
| `failEvery` | `0` | Every Nth call fails. `0` never. |
| `failRate` | `0` | Probability 0..1 of a random failure. |
| `seed` | `1` | Seed for `failRate` and latency sampling. |
| `errorTimes` | `0` | First N calls fail at the connection level (`netsim_conn`). |
| `rateLimitTimes` | `0` | First N calls return HTTP 429 with `Retry-After`. |
| `retryAfter` | `0` | Seconds advertised in that header. |
| `offline` | `false` | Hard outage: every call fails (`netsim_offline`). |
| `sleep(ms)` | `setTimeout` | Injectable wait. |

```ts
feature: {
  netsim: { active: true, latency: { min: 20, max: 80 }, failTimes: 2 },
}
```

**Notes.** `netsim` is how you test [`retry`](#retry),
[`timeout`](#timeout) and [`ratelimit`](#ratelimit) honestly, so it wants
to sit *inside* them in the chain, which the default ordering already
does. The [`test`](#test) feature also accepts a smaller `net` block
directly for the common cases. See
[Simulate network conditions](../how-to/simulate-network.md).

## `test`

> In-memory mock transport for testing without a live server

Replaces the transport with a mock API served from seed data, so a
generated SDK's test suite runs with no server, no fixtures on disk, and
no network. `load`, `list`, `create`, `update` and `remove` are all served
from the seed map, including writes: a `create` is readable by a following
`load` in the same test.

The mock is **model-aware**, which is the part that makes it worth using.
It rebuilds whatever envelope the operation's response transform unwraps,
so an API that answers `{ item: {...} }` is simulated as such rather than
as a bare entity. It also seeds each record under the entity's real
identifier as the API names it, not a hardcoded `id`, so an API keyed on
`record_id` behaves like itself.

While `test` is active, the live transport refuses to send anything
(`fetch_test_block`), so a mis-seeded test fails loudly instead of quietly
calling production.

**Seam:** base transport. Also dispatches the lifecycle and pipeline hooks.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `entity` | `{}` | Seed data: `{ <entity>: { <id>: { ...fields } } }`. |
| `net` | none | Inline network simulation: `{ latency, failTimes, failStatus, errorTimes, offline, sleep }`. |

Every generated SDK also exposes a static `test()` shortcut that switches
the feature on for you, so a test does not have to spell out the options
block:

```ts
const client = MyapiSDK.test({
  entity: {
    product: { p1: { name: 'Panel', price: 220 } },
  },
})

const p = await client.Product().load({ id: 'p1' })   // { name: 'Panel', ... }
```

The long form is the same thing, and is what you want when combining
`test` with other features:

```ts
const client = new MyapiSDK({
  feature: {
    test: { active: true, entity: { product: { p1: { name: 'Panel' } } } },
  },
})
```

**Notes.** `feature add test` runs automatically as part of `target add`,
because every target's generated test suite depends on it. The inline
`net` block covers the common simulation cases; reach for
[`netsim`](#netsim) when you need `failEvery`, `failRate`,
`rateLimitTimes` or per-call inspection.

## `cost`

> Cost tracking and spend budget for API calls

Prices every call, attributes the spend, and refuses to keep spending past
a ceiling you set.

This is the one bundled feature that uses **both seams**, and it has to.
Money is spent per HTTP **attempt** (a retried call is charged again,
because the upstream API charges it again), but it is owed by an
**operation**. So the transport wrap prices each attempt, and `PreDone`
attributes the running total to `<entity>.<op>` and to the caller.

The price of an attempt comes from the first source that answers:

1. **A response header** — `header` names it, `perUnit` converts the
   reported figure to money. Read per attempt.
2. **The rate table** — `rates`, keyed `'<entity>.<op>'`, then `'<op>'`,
   then `'*'`. The same lookup grammar [`rbac`](#rbac) uses for its rules.
3. **The flat `unit`** — a single price for any call.

A **body** figure is different, and is read at `PreDone` from the parsed
result rather than at the transport seam: response bodies are one-shot
streams, and consuming one in the wrapper would leave the pipeline with
nothing. `path` is a dot path into the body (`usage.total_tokens` for an
LLM API, `extensions.cost.actualQueryCost` for Shopify GraphQL), priced by
`perUnit`. Because such a figure describes the whole call, it **replaces**
the per-attempt estimate rather than adding to it.

Every record carries its `source`, and the totals keep `reported` and
`estimated` apart: "the server told us" and "we guessed from a price list"
are different claims and should not be silently summed.

**Seam:** transport wrapper **and** `PrePoint`, `PreDone`, `PreUnexpected`.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `currency` | `'USD'` | Label for the amounts. No conversion is done. |
| `unit` | `0` | Flat cost per attempt, when nothing else applies. |
| `rates` | `{}` | Cost per attempt, keyed `'<entity>.<op>'` / `'<op>'` / `'*'`. |
| `header` | `''` | Response header carrying a reported usage figure. |
| `path` | `''` | Dot path into the response body carrying a usage figure. |
| `perUnit` | `0` | Price per reported unit. Multiplies a header or body figure. |
| `budget` | `0` | Spend ceiling. `0` means no ceiling. |
| `onBudget` | `'warn'` | `'warn'` records the overrun, `'deny'` refuses the call. |
| `actor` | `'anonymous'` | Default actor for attribution. |
| `sink(record)` | none | Called with each finished record. |

```ts
feature: {
  cost: {
    active: true,
    rates: { 'report.generate': 0.05, '*': 0.001 },
    budget: 25,
    onBudget: 'deny',
  },
}
```

Per-call attribution uses the same control key as [`audit`](#audit):

```ts
await client.Report().generate({ id: 'r1' }, { actor: 'user:42' })

client._cost.total          // { calls, attempts, amount, reported, estimated }
client._cost.ops['report.generate']
client._cost.actors['user:42']
client._cost.budget         // { limit, spent, remaining, exceeded }
```

### The budget

`budget` is checked at `PrePoint`, before an endpoint is even resolved, so
a refused call costs nothing and never touches the network. With
`onBudget: 'deny'` it raises `cost_budget`; with the default `'warn'` it
sets `budget.exceeded` and lets the call through.

That is the useful shape for agent traffic, which is bursty, repetitive and
prone to tight retry loops: a ceiling in the client is a better answer than
finding out from the invoice.

**Notes and limits.**

- **Order matters, and the default gets it wrong.** `cost` must sit
  **inside** the cache, or a response served from cache is charged for
  money that was never spent. Alphabetical map ordering puts `cache`
  innermost and `cost` outside it, so use the array form:

  ```ts
  feature: [
    { name: 'cost',  active: true, unit: 0.002 },   // inner: real calls only
    { name: 'cache', active: true, ttl: 30000 },
  ]
  ```

  Being *inside* `retry` is already correct under the default order, which
  is what makes the retry multiplier visible: `total.attempts` against
  `total.calls` is what your retry policy actually costs you.
- **It is an estimate, not an invoice.** What you think you spent; the
  bill is authoritative.
- **The budget is per client instance**, like [`ratelimit`](#ratelimit).
  Two processes get two budgets and neither knows about the other. It
  stops this client, not your account.
- **Spend is known after the fact** unless the API reports a pre-flight
  price, so `deny` enforces against spend-so-far, not against the call you
  are about to make.
- **A failed call still costs.** A rejecting transport is charged per
  attempt, and an operation that throws commits its spend through
  `PreUnexpected` rather than being lost. Otherwise a run of
  connection-level failures under `retry` would spend real money and record
  nothing, and no budget could stop it.
- **`direct()` and `graphql()` are counted too.** Those call the transport
  without dispatching pipeline hooks, so their spend is committed at the
  transport seam and attributed to `_.direct`. They are counted, but they
  cannot be gated before the fact, because there is no `PrePoint` to refuse
  at.
- No currency conversion. `currency` is a label.

## `idempotency`

> Idempotency keys for safe retries of mutating operations

Adds an `Idempotency-Key` header to unsafe requests so a server can
de-duplicate a write that was retried. The key is generated once, at
`PreRequest`, before the request is built, which means it stays **stable
across transport-level retries of the same call**: that is the entire
point, and it is why this is a hook rather than a transport wrapper. A key
the caller supplied is never overwritten.

An operation counts as mutating if its HTTP method is in `methods`, or its
operation name is in `ops`.

**Seam:** `PreRequest`.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `header` | `'Idempotency-Key'` | Header name. |
| `methods` | `['POST', 'PUT', 'PATCH', 'DELETE']` | Methods treated as mutating. |
| `ops` | `['create', 'update', 'remove']` | Operation names treated as mutating. |
| `keygen()` | random 24-char | Injectable key generation. |

```ts
feature: { idempotency: { active: true }, retry: { active: true } }
```

**Notes.** Turn this on whenever `retry` is on and the API supports it.
Retrying a `POST` without an idempotency key is how one order becomes
three.

## `paging`

> Pagination signals for list operations

On the way out, stamps page and limit (or a cursor) into the request. On
the way back, reads whatever pagination signal the server actually sent
and normalises it onto `result.paging`, so calling code does not have to
know which convention this API picked.

Signals understood:

- `Link: <...>; rel="next"`
- `X-Page`, `X-Total-Count`, `X-Next-Page` headers
- `next`, `cursor`, `nextCursor`, `hasMore` in the body
- GraphQL Relay connections, read from the `pageInfo` path the model
  recorded for the operation

Normalised result: `{ page, totalCount, nextPage, next, cursor, hasMore }`.

**Seam:** `PreRequest`, `PreResult`.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `pageParam` | `'page'` | Query parameter for the page number. |
| `limitParam` | `'limit'` | Query parameter for the page size. |
| `cursorParam` | `'cursor'` | Query parameter for a cursor. |
| `startPage` | `1` | First page number. |
| `limit` | unset | Page size to send. Omitted entirely when unset. |
| `ops` | `['list']` | Operation names treated as list operations. |
| `afterVar` | `'after'` | GraphQL variable carrying the cursor. |
| `firstVar` | `'first'` | GraphQL variable carrying the page size. |

```ts
feature: { paging: { active: true, limit: 100 } }

const items = await client.Product().list({})
const paging = client._paging.last
// { page: 1, totalCount: 240, nextPage: 2, next, cursor, hasMore: true }
```

An operation returns its items, so the normalised signals are read from
`client._paging.last` (they are also on the internal `result.paging`).
Advance a page by passing the cursor back through the call's **control**
argument, which is the second parameter of every operation:

```ts
while (client._paging.last?.hasMore) {
  const more = await client.Product().list(
    {}, { paging: { cursor: client._paging.last.cursor } })
  items.push(...more)
}
```

**Notes.** `hasMore` distinguishes a *stated* answer from an *inferred*
one. A final page typically carries both an end cursor and
`hasNextPage: false`; inferring "more" from the cursor there would loop
forever, so an explicit `hasMore` from the server always wins over the
inference. GraphQL paginates through operation variables rather than the
query string, and only variables the operation actually declares are
bound, or the server rejects the document.

## `streaming`

> Incremental streaming of list results via async iteration

Attaches `result.stream()` to list results so a caller can consume items
one at a time instead of materialising the whole array. Every generated
entity also has a `stream(action, args, callopts)` method that runs the
full pipeline and yields items, falling back to the materialised result
when this feature is off, so calling code does not branch on whether
streaming is enabled.

**Seam:** `PreResult`.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `chunkSize` | `0` | Yield batches of this size. `0` yields single items. |
| `chunkDelay` | `0` | Ms between chunks, for simulating paced delivery in tests. |
| `ops` | `['list']` | Operation names that get a stream. |
| `sleep(ms)` | `setTimeout` | Injectable wait. |

```ts
feature: { streaming: { active: true } }

for await (const product of client.Product().stream('list')) {
  console.log(product.name)
}
```

**Notes.** The entity-level `stream()` also honours an `AbortSignal` and,
for uploads, an async-iterable `body` in `callopts`.

## `rbac`

> Client-side role/permission enforcement

Checks the permission required for an entity and operation against the
permissions the client holds, at `PrePoint`, before an endpoint is even
resolved. A disallowed call short-circuits with an `rbac_denied` error and
never touches the network.

Required permissions are looked up in `rules`, most specific first:
`'<entity>.<op>'`, then `'<op>'`, then `'*'`. When no rule matches, `deny`
decides: allow by default, or default-deny if you set it. Held permissions
come from `permissions`, where `'*'` grants everything.

**Seam:** `PrePoint`.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `permissions` | `[]` | Permissions the client holds. `'*'` grants everything. |
| `rules` | `{}` | Required permission, keyed by `'<entity>.<op>'`, `'<op>'`, or `'*'`. |
| `deny` | `false` | Deny operations that match no rule. |

```ts
feature: {
  rbac: {
    active: true,
    deny: true,
    permissions: ['product:read'],
    rules: { 'product.list': 'product:read', 'product.remove': 'product:write' },
  },
}
```

**Notes.** This is client-side enforcement: it gives fast, local, honest
failures and keeps a UI from offering actions the caller cannot perform.
It is not a security boundary, and it does not replace server-side
authorization.

## `telemetry`

> Distributed tracing spans with W3C trace-context propagation

Opens a span per operation at `PrePoint`, propagates the trace context to
the server as a W3C `traceparent` plus `X-Trace-Id` and `X-Span-Id`
headers at `PreRequest`, and closes the span on completion or failure. One
span per operation, whatever the transport did underneath.

**Seam:** `PrePoint`, `PreRequest`, `PreDone`, `PreUnexpected`.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `exporter(span)` | none | Called with each finished span. |
| `headers` | `{ trace: 'X-Trace-Id', span: 'X-Span-Id', parent: 'traceparent' }` | Header names. |
| `idgen(kind)` | sequential | Injectable trace/span id generation. |
| `now()` | `Date.now` | Injectable clock. |

```ts
feature: {
  telemetry: { active: true, exporter: (span) => otelBridge.record(span) },
}
```

A finished span is `{ traceId, spanId, name, start, end, durationMs, ok }`,
where `name` is `<entity>.<op>`.

## `metrics`

> Statistics capture: per-operation counters and latency

Counts every call and times it from endpoint resolution to return: a
total, plus a breakdown keyed `<entity>.<op>`. Each bucket is
`{ count, ok, err, totalMs, maxMs }`.

**Seam:** `PrePoint`, `PreDone`, `PreUnexpected`.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `now()` | `Date.now` | Injectable clock. |

```ts
feature: { metrics: { active: true } }

// ... after some calls
client._metrics.total          // { count: 12, ok: 11, err: 1, totalMs: 840, maxMs: 210 }
client._metrics.ops['product.list']   // the same shape, for one operation
```

**Notes.** A non-2xx result reaches `PreDone` before the pipeline throws,
so `PreUnexpected` then fires for the same operation. The feature records
once per operation and classifies by the actual result, so a failed call
counts as one `err`, not one `ok` and one `err`.

## `audit`

> Structured audit trail of operations

Emits one record per operation: who (actor), what (entity and operation),
the outcome, the status, and a correlation id, which is the shape a
compliance log wants. Records accumulate on `client._audit.records`,
bounded by `max`, and are pushed to `sink` as they happen when one is
supplied.

The actor comes from a per-call `ctrl.actor` if present, else the `actor`
option, else `'anonymous'`.

**Seam:** `PreDone`, `PreUnexpected`.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `actor` | `'anonymous'` | Default actor recorded on each operation. |
| `max` | `1000` | Maximum retained records. |
| `sink(record)` | none | Called with each record, e.g. to forward to a SIEM. |
| `now()` | `Date.now` | Injectable clock. |

```ts
feature: { audit: { active: true, actor: 'svc-billing', sink: (r) => siem.send(r) } }

await client.Invoice().remove({ id: 'i1' }, { actor: 'user:42' })
```

A record is
`{ seq, ts, actor, entity, op, outcome, status, correlationId }`.

**Notes.** Exactly one record per operation: a `PreDone` followed by
`PreUnexpected` on a non-2xx does not double-log. A throwing `sink` is
swallowed, so audit forwarding can never take down a call.

## `debug`

> Request/response capture ring buffer for debugging

Records a bounded ring buffer of per-operation traces: operation, method,
URL, headers, response status, duration, and any error. Header values
matching `redact` are masked, so a captured trace can be pasted into a bug
report without leaking a token.

**Seam:** `PreRequest`, `PreResponse`, `PreDone`, `PreUnexpected`.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `max` | `100` | Maximum retained entries. |
| `redact` | `authorization`, `cookie`, `set-cookie`, `api-key`, `apikey`, `x-api-key`, `idempotency-key` | Header names to mask. |
| `onEntry(entry)` | none | Called with each finished entry, e.g. to stream to a console. |
| `now()` | `Date.now` | Injectable clock. |

```ts
feature: { debug: { active: true, onEntry: (e) => console.error(e) } }
```

An entry is
`{ op, method, url, headers, start, status, ok, durationMs, error }`.

**Notes.** Replacing `redact` replaces the whole list, so include the
defaults you still want. A throwing `onEntry` is swallowed.

## `clienttrack`

> Client identity and per-request correlation headers

Establishes a stable session id when the client is constructed and stamps
identifying headers on every request: a `User-Agent`, an `X-Client-Id`
carrying the session, and a fresh `X-Request-Id` per call. That gives a
server two correlation levels: all traffic from one SDK instance, and each
individual call.

**Seam:** `PostConstruct`, `PreRequest`.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `clientName` | `'<ProjectName>-SDK'` | Product token in the `User-Agent`. |
| `clientVersion` | `'0.0.1'` | Version in the `User-Agent`. |
| `sessionId` | generated | Fixed session id, e.g. for tests. |
| `headers` | `{ agent: 'User-Agent', client: 'X-Client-Id', request: 'X-Request-Id' }` | Header names. |
| `idgen(kind)` | random | Injectable id generation. |

```ts
feature: { clienttrack: { active: true, clientName: 'acme-portal', clientVersion: '2.4.0' } }
```

**Notes.** `User-Agent` and `X-Client-Id` do not overwrite a value the
caller already set, so a custom `User-Agent` survives. `X-Request-Id` is
always refreshed: it identifies this call, so a stale one would be wrong.

## `log`

> Structured request and response logging

Logs at every pipeline stage, with the operation, spec and context
attached. Uses [pino](https://getpino.io) with pretty printing by default,
and takes any pino-compatible logger instead.

**Seam:** every lifecycle, entity-state and pipeline hook.

| Option | Default | Meaning |
| --- | --- | --- |
| `active` | `false` | Enable the feature. |
| `level` | `'info'` | Log level. |
| `logger` | pino + pino-pretty | Supply your own logger instead. |

```ts
feature: { log: { active: true, level: 'debug' } }
```

**Notes.** This is the one feature with runtime dependencies: it declares
`pino` and `pino-pretty` as peers for the `ts` and `js` targets, and
`collectDeps` flows them into the generated `package.json`. It is verbose
by design, so it is a development and diagnosis tool rather than a
production logger; for production, prefer [`telemetry`](#telemetry),
[`metrics`](#metrics) or [`audit`](#audit), which emit structured records
at a rate you control.

---

## Combining features

The features are designed to compose, and a few combinations are worth
naming.

| Goal | Features | Why |
| --- | --- | --- |
| Survive a flaky API | `retry` + `timeout` + `idempotency` | Bounded attempts, bounded waits, and writes that de-duplicate. |
| Stay inside a quota | `ratelimit` + `cache` + `paging` | Fewer calls, and the ones you make are paced. |
| Production observability | `telemetry` + `metrics` + `audit` | Traces to correlate, counters to alert on, records to keep. |
| Diagnose an integration | `debug` + `log` | A redacted trace buffer, and full detail while you are looking. |
| Test resilience offline | `test` + `netsim` + `retry` | Scripted failures over a mock API, with injectable clocks. |
| Enterprise deployment | `proxy` + `clienttrack` + `rbac` | Egress through the corporate proxy, identifiable traffic, local policy. |
| Know what it costs | `cost` + `audit` | Spend per operation and per actor, with an audit record beside it. |
| Stop a runaway agent | `cost` + `retry` + `timeout` | A hard spend ceiling around bounded, bounded-wait attempts. |

Two ordering rules cover most of it: `test` first, because it is the base
transport, and the wrapping features in the order you want them to nest.

## Language parity

Every bundled language target implements every feature. The behaviour,
option names and recorded state are the same across languages; only
syntax and idiom differ, including how an error reaches the caller (see
[Idiomatic error returns](./hooks.md#idiomatic-error-returns)).

Each target also ships a cross-feature test suite exercising the features
its project selected, so parity is enforced by tests rather than asserted
in prose. `target add` copies source only for features the model selected,
so a project that asked for `retry` alone does not carry the other
sixteen. See
[Trimming the feature set](../how-to/add-a-feature.md#trimming-the-feature-set).

## See also

- [Add a feature](../how-to/add-a-feature.md) — install one, or author your own.
- [Operation pipeline and feature hooks](./hooks.md) — the hook contract.
- [The operation pipeline](../explanation/operation-pipeline.md) — the concepts.
- [Simulate network conditions](../how-to/simulate-network.md) — `netsim` in practice.
- [Model schema → features](./model.md#mainkitfeaturename) — the model fields.
