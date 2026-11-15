# Demo Clojure SDK Reference

Complete API reference for the Demo Clojure SDK.


## sdk.api

### Constructor

```clojure
(require '[sdk.api :as api]
         '[voxgig.struct :as vs])

(def client (api/make-sdk options))
```

Create a new SDK client instance. `options` is a `voxgig.struct` map
(`nil` for none).

**Parameters (`options` map keys):**

| Key | Value type | Description |
| --- | --- | --- |
| `apikey` | `string` | API key for authentication. |
| `base` | `string` | Base URL for API requests. |
| `prefix` | `string` | URL prefix appended after base. |
| `suffix` | `string` | URL suffix appended after path. |
| `headers` | `map` | Custom headers for all requests. |
| `feature` | `map` | Feature configuration. |
| `system` | `map` | System overrides (e.g. custom fetch). |
| `server` | `map` | Values for the variables the server URL is templated on. |
| `server.account` | `string` | Required. |
| `server.region` | `string` | Defaults to `eu`. |


### Test client

#### `(api/test-sdk testopts sdkopts)`

Create a test client with mock features active. `testopts` are the test
feature's options and `sdkopts` further client options, merged over the
test defaults; both may be `nil`. It returns a client in test mode.

```clojure
(def client (api/test-sdk nil nil))
```


### Instance Functions

The SDK utility object is reached through `sdk.client`, which `sdk.api`
does not re-export: `(sdk.client/get-utility client)` returns a copy of it.

#### `(api/ambient client data)`

Create a new `Ambient` instance. Pass `nil` for no initial
options.

#### `(api/console client data)`

Create a new `Console` instance. Pass `nil` for no initial
options.

#### `(api/graph_ql client data)`

Create a new `GraphQl` instance. Pass `nil` for no initial
options.

#### `(api/history client data)`

Create a new `History` instance. Pass `nil` for no initial
options.

#### `(api/planet client data)`

Create a new `Planet` instance. Pass `nil` for no initial
options.

#### `(api/record client data)`

Create a new `Record` instance. Pass `nil` for no initial
options.

#### `(api/utility client data)`

Create a new `Utility` instance. Pass `nil` for no initial
options.

#### `(api/options-map client) -> map`

Return a deep copy of the current SDK options.

#### `(api/direct client fetchargs) -> map`

Make a direct HTTP request to any API endpoint.

**Parameters (`fetchargs` map keys):**

| Key | Value type | Description |
| --- | --- | --- |
| `path` | `string` | URL path with optional `{param}` placeholders. |
| `method` | `string` | HTTP method (default: `GET`). |
| `params` | `map` | Path parameter values for `{param}` substitution. |
| `query` | `map` | Query string parameters. |
| `headers` | `map` | Request headers (merged with defaults). |
| `body` | `any` | Request body (maps are JSON-serialized). |
| `ctrl` | `map` | Control options (e.g. `(vs/jm "explain" true)`). |

**Returns:** `map`, a result map holding `ok`, `status`, `headers` and
`data`, even for a non-2xx response; on a failure `ok` is `false` and
`err` holds the error. A failed request is reported in the result, not
as an error, so branch on `(vs/getprop result "ok")`.

#### `(api/prepare client fetchargs) -> map`

Prepare a fetch definition without sending the request. Accepts the
same parameters as `direct`.

**Returns:** `map`, the fetch definition: the request `direct` would
send. It raises on failure.


---

## Ambient

```clojure
(require '[sdk.entity.ambient :as e-ambient])

(def ambient (api/ambient client nil))
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `flow` | `double` | No |  |
| `temperature` | `double` | No |  |

### Operations

#### `(load ent reqmatch ctrl) -> entity`

Load a single entity matching the given criteria. Returns the entity,
and raises on failure. `((:data-get result))` reads its record.

```clojure
(def result (e-ambient/load (api/ambient client nil) nil nil))
```

### Common Fields

State accessors are stored on the entity map and called via keyword lookup.

#### `((:data-get ent)) -> map`

Get the entity data. Returns a copy of the current data.

#### `((:data-set ent) data)`

Set the entity data.

#### `((:match-get ent)) -> map`

Get the entity match criteria.

#### `((:match-set ent) match)`

Set the entity match criteria.

#### `((:make ent)) -> entity`

Create a new `Ambient` instance with the same client and
options.

#### `(stream ent action args callopts) -> seq`

Run an operation through the pipeline and return a lazy stream of its
result items.

#### `((:get-name ent)) -> string`

Return the entity name.


---

## Console

```clojure
(require '[sdk.entity.console :as e-console])

(def console (api/console client nil))
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes |  |
| `maker` | `string` | No |  |

### Operations

#### `(list ent reqmatch ctrl) -> vector`

List entities matching the given criteria. The match is optional:
without one, every record is listed. Returns a vector of entities, one
per record, and raises on failure.

```clojure
(doseq [item (e-console/list (api/console client nil) nil nil)]
  (println ((:data-get item))))
```

### Common Fields

State accessors are stored on the entity map and called via keyword lookup.

#### `((:data-get ent)) -> map`

Get the entity data. Returns a copy of the current data.

#### `((:data-set ent) data)`

Set the entity data.

#### `((:match-get ent)) -> map`

Get the entity match criteria.

#### `((:match-set ent) match)`

Set the entity match criteria.

#### `((:make ent)) -> entity`

Create a new `Console` instance with the same client and
options.

#### `(stream ent action args callopts) -> seq`

Run an operation through the pipeline and return a lazy stream of its
result items.

#### `((:get-name ent)) -> string`

Return the entity name.


---

## GraphQl

```clojure
(require '[sdk.entity.graph_ql :as e-graph_ql])

(def graph_ql (api/graph_ql client nil))
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes |  |
| `query` | `string` | No |  |

### Operations

#### `(list ent reqmatch ctrl) -> vector`

List entities matching the given criteria. The match is optional:
without one, every record is listed. Returns a vector of entities, one
per record, and raises on failure.

```clojure
(doseq [item (e-graph_ql/list (api/graph_ql client nil) nil nil)]
  (println ((:data-get item))))
```

### Common Fields

State accessors are stored on the entity map and called via keyword lookup.

#### `((:data-get ent)) -> map`

Get the entity data. Returns a copy of the current data.

#### `((:data-set ent) data)`

Set the entity data.

#### `((:match-get ent)) -> map`

Get the entity match criteria.

#### `((:match-set ent) match)`

Set the entity match criteria.

#### `((:make ent)) -> entity`

Create a new `GraphQl` instance with the same client and
options.

#### `(stream ent action args callopts) -> seq`

Run an operation through the pipeline and return a lazy stream of its
result items.

#### `((:get-name ent)) -> string`

Return the entity name.


---

## History

```clojure
(require '[sdk.entity.history :as e-history])

(def history (api/history client nil))
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes |  |
| `year` | `long` | No |  |

### Operations

#### `(list ent reqmatch ctrl) -> vector`

List entities matching the given criteria. The match is optional:
without one, every record is listed. Returns a vector of entities, one
per record, and raises on failure.

```clojure
(doseq [item (e-history/list (api/history client nil) nil nil)]
  (println ((:data-get item))))
```

### Common Fields

State accessors are stored on the entity map and called via keyword lookup.

#### `((:data-get ent)) -> map`

Get the entity data. Returns a copy of the current data.

#### `((:data-set ent) data)`

Set the entity data.

#### `((:match-get ent)) -> map`

Get the entity match criteria.

#### `((:match-set ent) match)`

Set the entity match criteria.

#### `((:make ent)) -> entity`

Create a new `History` instance with the same client and
options.

#### `(stream ent action args callopts) -> seq`

Run an operation through the pipeline and return a lazy stream of its
result items.

#### `((:get-name ent)) -> string`

Return the entity name.


---

## Planet

```clojure
(require '[sdk.entity.planet :as e-planet])

(def planet (api/planet client nil))
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes |  |
| `radius` | `double` | No |  |
| `title` | `string` | Yes |  |

### Actions

This entity exposes custom API actions in addition to the standard
operations. Select one with `$action` in the call's argument, beside the
route's path parameters, as the Call column shows; the action's own
arguments go beside them too, and are sent as that action's payload.

| Action | Operation | Route | Call |
| --- | --- | --- | --- |
| `terraform` | `create` | `/planet/{id}/terraform` | `(e-planet/create (api/planet client nil) (vs/jm "$action" "terraform" "id" "planet_id") nil)` |

An action returns that action's OWN response, which is not necessarily a
Planet record — check the API definition for its shape.

### Operations

#### `(list ent reqmatch ctrl) -> vector`

List entities matching the given criteria. The match is optional:
without one, every record is listed. Returns a vector of entities, one
per record, and raises on failure.

```clojure
(doseq [item (e-planet/list (api/planet client nil) nil nil)]
  (println ((:data-get item))))
```

#### `(load ent reqmatch ctrl) -> entity`

Load a single entity matching the given criteria. Returns the entity,
and raises on failure. `((:data-get result))` reads its record.

```clojure
(def result (e-planet/load (api/planet client nil) (vs/jm "id" "planet_id") nil))
```

#### `(create ent reqdata ctrl) -> entity`

Create a new entity with the given data. Returns the created entity, and
raises on failure. `((:data-get result))` reads its record.

```clojure
(def result
  (e-planet/create (api/planet client nil)
    (vs/jm
      "id" "example_id"  ;; string
      "title" "example_title"  ;; string
      )
    nil))
```

#### `(update ent reqdata ctrl) -> entity`

Update an existing entity. The data must include the entity id, `id`.
Returns the updated entity, and raises on failure. `((:data-get
result))` reads its record.

```clojure
(def result
  (e-planet/update (api/planet client nil)
    (vs/jm
      "id" "planet_id"
      ;; Fields to update
      )
    nil))
```

#### `(remove ent reqmatch ctrl) -> entity`

Remove the entity matching the given criteria. Returns the entity,
marked as deleted, and raises on failure. `((:data-get result))` reads
its record.

```clojure
(def result (e-planet/remove (api/planet client nil) (vs/jm "id" "planet_id") nil))
```

### Common Fields

State accessors are stored on the entity map and called via keyword lookup.

#### `((:data-get ent)) -> map`

Get the entity data. Returns a copy of the current data.

#### `((:data-set ent) data)`

Set the entity data.

#### `((:match-get ent)) -> map`

Get the entity match criteria.

#### `((:match-set ent) match)`

Set the entity match criteria.

#### `((:make ent)) -> entity`

Create a new `Planet` instance with the same client and
options.

#### `(stream ent action args callopts) -> seq`

Run an operation through the pipeline and return a lazy stream of its
result items.

#### `((:get-name ent)) -> string`

Return the entity name.


---

## Record

```clojure
(require '[sdk.entity.record :as e-record])

(def record (api/record client nil))
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `fields` | `map` | No |  |
| `id` | `string` | Yes |  |

### Operations

#### `(list ent reqmatch ctrl) -> vector`

List entities matching the given criteria. The match is optional:
without one, every record is listed. Returns a vector of entities, one
per record, and raises on failure.

```clojure
(doseq [item (e-record/list (api/record client nil) nil nil)]
  (println ((:data-get item))))
```

### Common Fields

State accessors are stored on the entity map and called via keyword lookup.

#### `((:data-get ent)) -> map`

Get the entity data. Returns a copy of the current data.

#### `((:data-set ent) data)`

Set the entity data.

#### `((:match-get ent)) -> map`

Get the entity match criteria.

#### `((:match-set ent) match)`

Set the entity match criteria.

#### `((:make ent)) -> entity`

Create a new `Record` instance with the same client and
options.

#### `(stream ent action args callopts) -> seq`

Run an operation through the pipeline and return a lazy stream of its
result items.

#### `((:get-name ent)) -> string`

Return the entity name.


---

## Utility

```clojure
(require '[sdk.entity.utility :as e-utility])

(def utility (api/utility client nil))
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes |  |
| `tool` | `string` | No |  |

### Operations

#### `(list ent reqmatch ctrl) -> vector`

List entities matching the given criteria. The match is optional:
without one, every record is listed. Returns a vector of entities, one
per record, and raises on failure.

```clojure
(doseq [item (e-utility/list (api/utility client nil) nil nil)]
  (println ((:data-get item))))
```

### Common Fields

State accessors are stored on the entity map and called via keyword lookup.

#### `((:data-get ent)) -> map`

Get the entity data. Returns a copy of the current data.

#### `((:data-set ent) data)`

Set the entity data.

#### `((:match-get ent)) -> map`

Get the entity match criteria.

#### `((:match-set ent) match)`

Set the entity match criteria.

#### `((:make ent)) -> entity`

Create a new `Utility` instance with the same client and
options.

#### `(stream ent action args callopts) -> seq`

Run an operation through the pipeline and return a lazy stream of its
result items.

#### `((:get-name ent)) -> string`

Return the entity name.


---

## Features

| Feature | Version | Description |
| --- | --- | --- |
| `audit` | 0.0.1 | Audit trail |
| `cache` | 0.0.1 | Response cache |
| `clienttrack` | 0.0.1 | Client tracking |
| `cost` | 0.0.1 | Cost tracking |
| `debug` | 0.0.1 | Debug capture |
| `idempotency` | 0.0.1 | Idempotency |
| `log` | 0.0.1 | Logging |
| `metrics` | 0.0.1 | Metrics |
| `netsim` | 0.0.1 | Network simulation |
| `paging` | 0.0.1 | Paging |
| `proxy` | 0.0.1 | Proxy |
| `ratelimit` | 0.0.1 | Rate limiting |
| `rbac` | 0.0.1 | Access control |
| `retry` | 0.0.1 | Retry |
| `secrets` | 0.1.0 | Secrets |
| `streaming` | 0.0.1 | Streaming |
| `telemetry` | 0.0.1 | Telemetry |
| `test` | 0.0.1 | Test transport |
| `timeout` | 0.0.1 | Timeout |
| `validate` | 0.0.1 | Validation |


Features are activated via the `feature` option:

```clojure
(def client
  (api/make-sdk
    (vs/jm "feature"
      (vs/jm
        "audit" (vs/jm "active" true)
        "cache" (vs/jm "active" true)
        "clienttrack" (vs/jm "active" true)
        "cost" (vs/jm "active" true)
        "debug" (vs/jm "active" true)
        "idempotency" (vs/jm "active" true)
        "log" (vs/jm "active" true)
        "metrics" (vs/jm "active" true)
        "netsim" (vs/jm "active" true)
        "paging" (vs/jm "active" true)
        "proxy" (vs/jm "active" true)
        "ratelimit" (vs/jm "active" true)
        "rbac" (vs/jm "active" true)
        "retry" (vs/jm "active" true)
        "secrets" (vs/jm "active" true)
        "streaming" (vs/jm "active" true)
        "telemetry" (vs/jm "active" true)
        "test" (vs/jm "active" true)
        "timeout" (vs/jm "active" true)
        "validate" (vs/jm "active" true)
        ))))
```


### Configuring features

Each feature is inactive until switched on, except `log`, which
runs unless disabled. Every option below keeps its default
unless you name it.

The array form of `feature` is significant: several features wrap the
transport, and the order you list them in is the order they nest.

#### Ordering

`cache`, `cost`, `netsim`, `proxy`, `ratelimit`, `retry`, `secrets`, `timeout` wrap the transport. Each
wraps whatever is already installed, so **activation order is nesting order**:
a feature activated later sits OUTSIDE one activated earlier, and sees the call
first.

That decides behaviour, not just sequence. \`cost\` activated before \`cache\`
sits inside it, so a response served from the cache never reaches \`cost\` and is
correctly charged nothing; reverse them and every cache hit is billed for money
that was never spent.

`audit`, `clienttrack`, `debug`, `idempotency`, `log`, `metrics`, `paging`, `rbac`, `streaming`, `telemetry`, `test`, `validate` attach to pipeline hooks
rather than the transport, so their order does not affect what they observe.

#### `audit`

Audit trail.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `actor` | `'anonymous'` |
| `max` | `1000` |

| Option | Type |
|---|---|
| `now` | function |
| `sink` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.audit.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

#### `cache`

Response cache.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `max` | `256` |
| `methods` | `['GET']` |
| `ttl` | `5000` |

| Option | Type |
|---|---|
| `now` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.cache.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
- Inactive by default: leaving it out costs nothing at runtime.

#### `clienttrack`

Client tracking.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `clientVersion` | `'0.0.1'` |

| Option | Type |
|---|---|
| `clientName` | string |
| `headers` | map |
| `idgen` | function |
| `sessionId` | string |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.clienttrack.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

#### `cost`

Cost tracking.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `budget` | `0` |
| `currency` | `'USD'` |
| `header` | `''` |
| `onBudget` | `'warn'` |
| `path` | `''` |
| `perUnit` | `0` |
| `rates` | `{}` |
| `unit` | `0` |

| Option | Type |
|---|---|
| `actor` | string |
| `sink` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.cost.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
- Inactive by default: leaving it out costs nothing at runtime.

#### `debug`

Debug capture.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `max` | `100` |
| `redact` | `['authorization', 'cookie', 'set-cookie', 'api-key', 'apikey', 'x-api-key', 'idempotency-key']` |

| Option | Type |
|---|---|
| `now` | function |
| `onEntry` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.debug.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

#### `idempotency`

Idempotency.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `header` | `'Idempotency-Key'` |
| `methods` | `['POST', 'PUT', 'PATCH', 'DELETE']` |
| `ops` | `['create', 'update', 'remove']` |

| Option | Type |
|---|---|
| `keygen` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.idempotency.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

#### `log`

Logging.

**Configuration**

| Option | Default |
|---|---|
| `active` | `true` |

| Option | Type |
|---|---|
| `level` | string |
| `logger` | any |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.log.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Active by default: set `active: false` to switch it off.

#### `metrics`

Metrics.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |

| Option | Type |
|---|---|
| `now` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.metrics.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

#### `netsim`

Network simulation.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `errorTimes` | `0` |
| `failEvery` | `0` |
| `failRate` | `0` |
| `failStatus` | `503` |
| `failTimes` | `0` |
| `latency` | `0` |
| `offline` | `false` |
| `rateLimitTimes` | `0` |
| `retryAfter` | `0` |
| `seed` | `1` |

| Option | Type |
|---|---|
| `sleep` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.netsim.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
- Inactive by default: leaving it out costs nothing at runtime.

#### `paging`

Paging.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `afterVar` | `'after'` |
| `cursorParam` | `'cursor'` |
| `firstVar` | `'first'` |
| `limitParam` | `'limit'` |
| `pageParam` | `'page'` |
| `startPage` | `1` |

| Option | Type |
|---|---|
| `limit` | number |
| `ops` | list |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.paging.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

#### `proxy`

Proxy.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `fromEnv` | `false` |
| `noProxy` | `[]` |
| `url` | `''` |

| Option | Type |
|---|---|
| `agent` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.proxy.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
- Inactive by default: leaving it out costs nothing at runtime.

#### `ratelimit`

Rate limiting.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `burst` | `5` |
| `rate` | `5` |

| Option | Type |
|---|---|
| `now` | function |
| `sleep` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.ratelimit.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
- Inactive by default: leaving it out costs nothing at runtime.

#### `rbac`

Access control.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `deny` | `false` |
| `permissions` | `[]` |
| `rules` | `{}` |

**Usage**

Set `feature.rbac.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

#### `retry`

Retry.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `factor` | `2` |
| `maxDelay` | `2000` |
| `minDelay` | `50` |
| `retries` | `2` |
| `statuses` | `[408, 425, 429, 500, 502, 503, 504]` |

| Option | Type |
|---|---|
| `jitter` | boolean |
| `sleep` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.retry.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
- Inactive by default: leaving it out costs nothing at runtime.

#### `secrets`

Secrets.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `cache` | `true` |
| `exchange` | `{active: false, method: 'POST', path: 'auth/token', refresh: '', request: 'refresh_token', response: 'access_token', retries: 1, statuses: [401]}` |
| `name` | `'apikey'` |
| `providers` | `[]` |

**Usage**

Set `feature.secrets.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
- Inactive by default: leaving it out costs nothing at runtime.

#### `streaming`

Streaming.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `chunkDelay` | `0` |
| `chunkSize` | `0` |

| Option | Type |
|---|---|
| `ops` | list |
| `sleep` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.streaming.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

#### `telemetry`

Telemetry.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |

| Option | Type |
|---|---|
| `exporter` | function |
| `headers` | map |
| `idgen` | function |
| `now` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.telemetry.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

#### `test`

Test transport.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |

| Option | Type |
|---|---|
| `entity` | map |
| `net` | map |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.test.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Installs the BASE transport that the wrapping features wrap, so it must be
  activated before them.
- Inactive by default: leaving it out costs nothing at runtime.

#### `timeout`

Timeout.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `ms` | `30000` |

| Option | Type |
|---|---|
| `clearTimer` | function |
| `now` | function |
| `setTimer` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.timeout.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
- Inactive by default: leaving it out costs nothing at runtime.

#### `validate`

Validation.

**Configuration**

| Option | Default |
|---|---|
| `active` | `false` |
| `mode` | `'throw'` |
| `request` | `true` |
| `response` | `false` |
| `strict` | `false` |

| Option | Type |
|---|---|
| `onInvalid` | function |

These take no default: the feature behaves one way when you supply them and
another when you do not.

**Usage**

Set `feature.validate.active` to true in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

