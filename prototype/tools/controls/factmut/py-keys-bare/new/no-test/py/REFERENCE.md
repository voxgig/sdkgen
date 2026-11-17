# Demo Python SDK Reference

Complete API reference for the Demo Python SDK.


## DemoSDK

### Constructor

```python
from demo_sdk import DemoSDK

client = DemoSDK(options)
```

Create a new SDK client instance. `options` is a `dict` map
(`None` for none).

**Parameters (`options` map keys):**

| Key | Value type | Description |
| --- | --- | --- |
| `options["apikey"]` | `str` | API key for authentication. |
| `options["auth"]` | `dict` | Settings for how the credential is sent. |
| `options["base"]` | `str` | Base URL for API requests. |
| `options["prefix"]` | `str` | URL prefix appended after base. |
| `options["suffix"]` | `str` | URL suffix appended after path. |
| `options["headers"]` | `dict` | Custom headers for all requests. |
| `options["allow"]` | `dict` | Comma-separated allow-lists of the HTTP methods and the operations the client may use. |
| `options["feature"]` | `dict` | Feature configuration. |
| `options["system"]` | `dict` | System overrides (e.g. custom fetch). |
| `options["clean"]` | `dict` | Redaction of everything the SDK emits. |
| `options["server"]` | `dict` | Values for the variables the server URL is templated on. |
| `options["server"]["tenant"]` | `str` | Required. |
| `options["server"]["region"]` | `str` | Defaults to `eu`. |


### Test client

#### `DemoSDK.test(testopts=None, sdkopts=None)`

Create a test client. This SDK is generated without the `test` feature,
so the client has no mock transport and refuses every request. The first
argument is set, switched on, as `options["feature"]["test"]` in the
second, which holds the other client options. Both may be `None`.

```python
client = DemoSDK.test()
```


### Client Methods

#### `Ambient(data=None)`

Create a new `AmbientEntity` instance. Its `data` argument holds the
entity options: pass `None` for none.

#### `Console(data=None)`

Create a new `ConsoleEntity` instance. Its `data` argument holds the
entity options: pass `None` for none.

#### `GraphQl(data=None)`

Create a new `GraphQlEntity` instance. Its `data` argument holds the
entity options: pass `None` for none.

#### `History(data=None)`

Create a new `HistoryEntity` instance. Its `data` argument holds the
entity options: pass `None` for none.

#### `Planet(data=None)`

Create a new `PlanetEntity` instance. Its `data` argument holds the
entity options: pass `None` for none.

#### `Record(data=None)`

Create a new `RecordEntity` instance. Its `data` argument holds the
entity options: pass `None` for none.

#### `Utility(data=None)`

Create a new `UtilityEntity` instance. Its `data` argument holds the
entity options: pass `None` for none.

#### `options_map() -> dict`

Return a deep copy of the current SDK options.

#### `get_utility() -> Utility`

Return a copy of the SDK utility object.

#### `direct(fetchargs=None) -> dict`

Make a direct HTTP request to any API endpoint.

**Parameters (`fetchargs` map keys):**

| Key | Value type | Description |
| --- | --- | --- |
| `fetchargs["path"]` | `str` | URL path with optional `{param}` placeholders. |
| `fetchargs["method"]` | `str` | HTTP method (default: `GET`). |
| `fetchargs["params"]` | `dict` | Path parameter values for `{param}` substitution. |
| `fetchargs["query"]` | `dict` | Query string parameters. |
| `fetchargs["headers"]` | `dict` | Request headers (merged with defaults). |
| `fetchargs["body"]` | `any` | Request body (dicts are JSON-serialized). |
| `fetchargs["ctrl"]` | `dict` | Control options. |

**Returns:** `dict`, a result map. For a response whose body is read,
2xx or not, it holds the keys `ok`, `status`, `headers` and `data`, and
`ok` is `False` unless the status is 2xx. When the body cannot be read,
`ok` is `False` and the key `err` holds the error, read as
`result["err"]`; a request that cannot be made gives only `ok` (`False`)
and `err`. A failure is reported in the result, not as an error, so
branch on `result["ok"]`.

#### `prepare(fetchargs=None) -> dict`

Prepare a fetch definition without sending the request. Accepts the
same parameters as `direct()`.

**Returns:** `dict`, the fetch definition: the request `direct()` would
send. It raises on failure.


---

## AmbientEntity

```python
ambient = client.Ambient()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `flow` | `float` | No |  |
| `temperature` | `float` | No |  |

### Operations

#### `load(reqmatch=None, ctrl=None) -> AmbientEntity`

Load a single entity matching the given criteria. Returns the entity,
and raises on failure. `data_get()` reads its record.

```python
result = client.Ambient().load()
```

### Common Methods

#### `data_get() -> dict`

Get the entity data. Returns a copy of the current data.

#### `data_set(args=None)`

Set the entity data.

#### `match_get() -> dict`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `match_set(args=None)`

Set the entity match criteria.

#### `make() -> Entity`

Create a new `AmbientEntity` instance with the same client and
options.

#### `stream(action, args=None, callopts=None)`

Run an operation through the pipeline and yield its result items as a
generator. The operation runs when iteration starts, not when the call
returns. It ends early once the `signal` in `callopts` reports an abort.

#### `get_name() -> str`

Return the entity name.


---

## ConsoleEntity

```python
console = client.Console()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `str` | Yes |  |
| `maker` | `str` | No |  |

### Operations

#### `list(reqmatch=None, ctrl=None) -> list[ConsoleEntity]`

List entities matching the given criteria. The match is optional; a call
without one is `list()`. Returns a `list` of entities, one per record,
and raises on failure.

```python
results = client.Console().list()
for item in results:
    print(item.data_get())
```

### Common Methods

#### `data_get() -> dict`

Get the entity data. Returns a copy of the current data.

#### `data_set(args=None)`

Set the entity data.

#### `match_get() -> dict`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `match_set(args=None)`

Set the entity match criteria.

#### `make() -> Entity`

Create a new `ConsoleEntity` instance with the same client and
options.

#### `stream(action, args=None, callopts=None)`

Run an operation through the pipeline and yield its result items as a
generator. The operation runs when iteration starts, not when the call
returns. It ends early once the `signal` in `callopts` reports an abort.

#### `get_name() -> str`

Return the entity name.


---

## GraphQlEntity

```python
graph_ql = client.GraphQl()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `str` | Yes |  |
| `query` | `str` | No |  |

### Operations

#### `list(reqmatch=None, ctrl=None) -> list[GraphQlEntity]`

List entities matching the given criteria. The match is optional; a call
without one is `list()`. Returns a `list` of entities, one per record,
and raises on failure.

```python
results = client.GraphQl().list()
for item in results:
    print(item.data_get())
```

### Common Methods

#### `data_get() -> dict`

Get the entity data. Returns a copy of the current data.

#### `data_set(args=None)`

Set the entity data.

#### `match_get() -> dict`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `match_set(args=None)`

Set the entity match criteria.

#### `make() -> Entity`

Create a new `GraphQlEntity` instance with the same client and
options.

#### `stream(action, args=None, callopts=None)`

Run an operation through the pipeline and yield its result items as a
generator. The operation runs when iteration starts, not when the call
returns. It ends early once the `signal` in `callopts` reports an abort.

#### `get_name() -> str`

Return the entity name.


---

## HistoryEntity

```python
history = client.History()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `str` | Yes |  |
| `year` | `int` | No |  |

### Operations

#### `list(reqmatch=None, ctrl=None) -> list[HistoryEntity]`

List entities matching the given criteria. The match is optional; a call
without one is `list()`. Returns a `list` of entities, one per record,
and raises on failure.

```python
results = client.History().list()
for item in results:
    print(item.data_get())
```

### Common Methods

#### `data_get() -> dict`

Get the entity data. Returns a copy of the current data.

#### `data_set(args=None)`

Set the entity data.

#### `match_get() -> dict`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `match_set(args=None)`

Set the entity match criteria.

#### `make() -> Entity`

Create a new `HistoryEntity` instance with the same client and
options.

#### `stream(action, args=None, callopts=None)`

Run an operation through the pipeline and yield its result items as a
generator. The operation runs when iteration starts, not when the call
returns. It ends early once the `signal` in `callopts` reports an abort.

#### `get_name() -> str`

Return the entity name.


---

## PlanetEntity

```python
planet = client.Planet()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `str` | Yes |  |
| `radius` | `float` | No |  |
| `title` | `str` | Yes |  |

### Actions

This entity exposes custom API actions in addition to the standard
operations. Select one with `$action` in the call's argument, beside the
route's path parameters, as the Call column shows; the action's own
arguments go beside them too, and are sent as that action's payload.

| Action | Operation | Route | Call |
| --- | --- | --- | --- |
| `terraform` | `create` | `/planet/{id}/terraform` | `client.Planet().create({"$action": "terraform", "id": "planet_id"})` |

Like any operation, an action's call gives back the entity; its data is
then that action's OWN response, which is not necessarily a Planet
record — check the API definition for its shape.

### Operations

#### `list(reqmatch=None, ctrl=None) -> list[PlanetEntity]`

List entities matching the given criteria. The match is optional; a call
without one is `list()`. Returns a `list` of entities, one per record,
and raises on failure.

```python
results = client.Planet().list()
for item in results:
    print(item.data_get())
```

#### `load(reqmatch=None, ctrl=None) -> PlanetEntity`

Load a single entity matching the given criteria. Returns the entity,
and raises on failure. `data_get()` reads its record.

```python
result = client.Planet().load({"id": "planet_id"})
```

#### `create(reqdata, ctrl=None) -> PlanetEntity`

Create a new entity with the given data. Returns the created entity, and
raises on failure. `data_get()` reads its record.

```python
result = client.Planet().create({
    "id": "example_id",  # str
    "title": "example_title",  # str
})
```

#### `update(reqdata, ctrl=None) -> PlanetEntity`

Update an existing entity. The data must include the entity id, `id`,
unless the entity already holds it. Returns the updated entity, and
raises on failure. `data_get()` reads its record.

```python
result = client.Planet().update({
    "id": "planet_id",
    # Fields to update
})
```

#### `remove(reqmatch=None, ctrl=None) -> PlanetEntity`

Remove the entity matching the given criteria. Returns the entity,
marked as deleted, and raises on failure. `result.deleted()` reads the
mark. `data_get()` reads its record.

```python
result = client.Planet().remove({"id": "planet_id"})
```

### Common Methods

#### `data_get() -> dict`

Get the entity data. Returns a copy of the current data.

#### `data_set(args=None)`

Set the entity data.

#### `match_get() -> dict`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `match_set(args=None)`

Set the entity match criteria.

#### `make() -> Entity`

Create a new `PlanetEntity` instance with the same client and
options.

#### `stream(action, args=None, callopts=None)`

Run an operation through the pipeline and yield its result items as a
generator. The operation runs when iteration starts, not when the call
returns. It ends early once the `signal` in `callopts` reports an abort.

#### `get_name() -> str`

Return the entity name.


---

## RecordEntity

```python
record = client.Record()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `fields` | `dict` | No |  |
| `id` | `str` | Yes |  |

### Operations

#### `list(reqmatch=None, ctrl=None) -> list[RecordEntity]`

List entities matching the given criteria. The match is optional; a call
without one is `list()`. Returns a `list` of entities, one per record,
and raises on failure.

```python
results = client.Record().list()
for item in results:
    print(item.data_get())
```

### Common Methods

#### `data_get() -> dict`

Get the entity data. Returns a copy of the current data.

#### `data_set(args=None)`

Set the entity data.

#### `match_get() -> dict`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `match_set(args=None)`

Set the entity match criteria.

#### `make() -> Entity`

Create a new `RecordEntity` instance with the same client and
options.

#### `stream(action, args=None, callopts=None)`

Run an operation through the pipeline and yield its result items as a
generator. The operation runs when iteration starts, not when the call
returns. It ends early once the `signal` in `callopts` reports an abort.

#### `get_name() -> str`

Return the entity name.


---

## UtilityEntity

```python
utility = client.Utility()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `str` | Yes |  |
| `tool` | `str` | No |  |

### Operations

#### `list(reqmatch=None, ctrl=None) -> list[UtilityEntity]`

List entities matching the given criteria. The match is optional; a call
without one is `list()`. Returns a `list` of entities, one per record,
and raises on failure.

```python
results = client.Utility().list()
for item in results:
    print(item.data_get())
```

### Common Methods

#### `data_get() -> dict`

Get the entity data. Returns a copy of the current data.

#### `data_set(args=None)`

Set the entity data.

#### `match_get() -> dict`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `match_set(args=None)`

Set the entity match criteria.

#### `make() -> Entity`

Create a new `UtilityEntity` instance with the same client and
options.

#### `stream(action, args=None, callopts=None)`

Run an operation through the pipeline and yield its result items as a
generator. The operation runs when iteration starts, not when the call
returns. It ends early once the `signal` in `callopts` reports an abort.

#### `get_name() -> str`

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
| `timeout` | 0.0.1 | Timeout |
| `validate` | 0.0.1 | Validation |


Features are activated via the `feature` option:

```python
client = DemoSDK({
    "feature": {
        "audit": {"active": True},
        "cache": {"active": True},
        "clienttrack": {"active": True},
        "cost": {"active": True},
        "debug": {"active": True},
        "idempotency": {"active": True},
        "log": {"active": True},
        "metrics": {"active": True},
        "netsim": {"active": True},
        "paging": {"active": True},
        "proxy": {"active": True},
        "ratelimit": {"active": True},
        "rbac": {"active": True},
        "retry": {"active": True},
        "secrets": {"active": True},
        "streaming": {"active": True},
        "telemetry": {"active": True},
        "timeout": {"active": True},
        "validate": {"active": True},
    },
})
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

That decides behaviour, not just sequence. `cost` activated before `cache`
sits inside it, so a response served from the cache never reaches `cost` and is
correctly charged nothing; reverse them and every cache hit is billed for money
that was never spent.

`audit`, `clienttrack`, `debug`, `idempotency`, `log`, `metrics`, `paging`, `rbac`, `streaming`, `telemetry`, `validate` attach to pipeline hooks
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

Set `options["feature"]["audit"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["cache"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["clienttrack"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["cost"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
- Also attaches to pipeline hooks.
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

Set `options["feature"]["debug"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["idempotency"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

It runs without being switched on. Override any option above under `options["feature"]["log"]` in the client options; switching its `active` option off stops it. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Active by default: switching its `active` option off stops it.

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

Set `options["feature"]["metrics"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["netsim"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["paging"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["proxy"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["ratelimit"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["rbac"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["retry"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["secrets"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
- Also attaches to pipeline hooks.
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

Set `options["feature"]["streaming"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["telemetry"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
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

Set `options["feature"]["timeout"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
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

Set `options["feature"]["validate"]["active"]` to `True` in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

