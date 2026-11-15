# Demo Swift SDK Reference

Complete API reference for the Demo Swift SDK.


## DemoSDK

### Constructor

```swift
let client = DemoSDK(options)
```

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `VMap` | SDK configuration options. |
| `options["apikey"]` | `String` | API key for authentication. |
| `options["base"]` | `String` | Base URL for API requests. |
| `options["prefix"]` | `String` | URL prefix appended after base. |
| `options["suffix"]` | `String` | URL suffix appended after path. |
| `options["headers"]` | `VMap` | Custom headers for all requests. |
| `options["feature"]` | `VMap` | Feature configuration. |
| `options["system"]` | `VMap` | System overrides (e.g. custom fetch). |
| `options["server"]` | `VMap` | Values for the variables the server URL is templated on. |
| `options["server"]["tenant"]` | `String` | Required. |
| `options["server"]["region"]` | `String` | Defaults to `eu`. |


### Test client

#### `DemoSDK.testSDK(_ testopts: VMap?, _ sdkopts: VMap?) -> DemoSDK`

Create a test client with mock features active. The first argument holds
the test feature's options, which the call switches on, and replaces any
`options["feature"]["test"]` in the second, which holds the other client
options; both may be `nil`.

```swift
let client = DemoSDK.testSDK(nil, nil)
```


### Client Methods

#### `Ambient(_ entopts: VMap? = nil) -> DemoEntityBase`

Create a new `Ambient` entity. Pass `nil` for no initial
options.

#### `Console(_ entopts: VMap? = nil) -> DemoEntityBase`

Create a new `Console` entity. Pass `nil` for no initial
options.

#### `GraphQl(_ entopts: VMap? = nil) -> DemoEntityBase`

Create a new `GraphQl` entity. Pass `nil` for no initial
options.

#### `History(_ entopts: VMap? = nil) -> DemoEntityBase`

Create a new `History` entity. Pass `nil` for no initial
options.

#### `Planet(_ entopts: VMap? = nil) -> DemoEntityBase`

Create a new `Planet` entity. Pass `nil` for no initial
options.

#### `Record(_ entopts: VMap? = nil) -> DemoEntityBase`

Create a new `Record` entity. Pass `nil` for no initial
options.

#### `Utility(_ entopts: VMap? = nil) -> DemoEntityBase`

Create a new `Utility` entity. Pass `nil` for no initial
options.

#### `optionsMap() -> VMap`

Return a deep copy of the current SDK options.

#### `getUtility() -> Utility`

Return a copy of the SDK utility object.

#### `direct(_ fetchargs: VMap?) -> VMap`

Make a direct HTTP request to any API endpoint.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `fetchargs["path"]` | `String` | URL path with optional `{param}` placeholders. |
| `fetchargs["method"]` | `String` | HTTP method (default: `GET`). |
| `fetchargs["params"]` | `VMap` | Path parameter values for `{param}` substitution. |
| `fetchargs["query"]` | `VMap` | Query string parameters. |
| `fetchargs["headers"]` | `VMap` | Request headers (merged with defaults). |
| `fetchargs["body"]` | `Value` | Request body (maps are JSON-serialized). |
| `fetchargs["ctrl"]` | `VMap` | Control options. |

**Returns:** `VMap`, a result map. For a response whose body is read,
2xx or not, it holds the keys `ok`, `status`, `headers` and `data`, and
`ok` is `false` unless the status is 2xx. When the body cannot be read,
`ok` is `false` and the key `err` holds the error, read as
`result.entries["err"]`; a request that cannot be made gives only `ok`
(`false`) and `err`. A failure is reported in the result, not as an
error, so branch on `result.entries["ok"] == .bool(true)`.

#### `prepare(_ fetchargs: VMap?) throws -> VMap`

Prepare a fetch definition without sending the request. Accepts the
same parameters as `direct()`.

**Returns:** `VMap`, the fetch definition: the request `direct()` would
send. It throws on failure.


---

## Ambient

```swift
let ambient = client.Ambient()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `flow` | `Double` | No |  |
| `temperature` | `Double` | No |  |

### Operations

#### `load(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value`

Load a single entity matching the given criteria. Returns a value
holding the entity, and throws on failure. `asNative as? Entity` takes
the entity out, and `result.data()` reads its record.

```swift
let result = try client.Ambient().load(nil, nil)
```

### Common Methods

#### `data(_ newdata: Value?) -> Value`

Get the entity data. Returns a copy of the current data. Pass a `Value`
to set it.

#### `matchv(_ newmatch: Value?) -> Value`

Get the entity match criteria. Returns a copy of the current match
criteria. Pass a `Value` to set it.

#### `make() -> Entity`

Create another `Ambient` entity with the same client and
options.

#### `stream(_ action: String, _ args: VMap? = nil, _ callopts: VMap? = nil) throws -> AsyncStream<Value>`

Run an operation through the pipeline and yield its result items as an
async iterator. The operation runs before the call returns. It ends
early once `callopts.signal` reports an abort.

#### `getName() -> String`

Return the entity name.


---

## Console

```swift
let console = client.Console()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `String` | Yes |  |
| `maker` | `String` | No |  |

### Operations

#### `list(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value`

List entities matching the given criteria. The match is optional; a call
without one is `list(nil, nil)`. Returns a value holding a `VList` of
entities, one per record, and throws on failure.

```swift
let results = try client.Console().list(nil, nil)
for item in results.asList?.items ?? [] {
    if let item = item.asNative as? Entity {
        print(item.data())
    }
}
```

### Common Methods

#### `data(_ newdata: Value?) -> Value`

Get the entity data. Returns a copy of the current data. Pass a `Value`
to set it.

#### `matchv(_ newmatch: Value?) -> Value`

Get the entity match criteria. Returns a copy of the current match
criteria. Pass a `Value` to set it.

#### `make() -> Entity`

Create another `Console` entity with the same client and
options.

#### `stream(_ action: String, _ args: VMap? = nil, _ callopts: VMap? = nil) throws -> AsyncStream<Value>`

Run an operation through the pipeline and yield its result items as an
async iterator. The operation runs before the call returns. It ends
early once `callopts.signal` reports an abort.

#### `getName() -> String`

Return the entity name.


---

## GraphQl

```swift
let graphQl = client.GraphQl()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `String` | Yes |  |
| `query` | `String` | No |  |

### Operations

#### `list(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value`

List entities matching the given criteria. The match is optional; a call
without one is `list(nil, nil)`. Returns a value holding a `VList` of
entities, one per record, and throws on failure.

```swift
let results = try client.GraphQl().list(nil, nil)
for item in results.asList?.items ?? [] {
    if let item = item.asNative as? Entity {
        print(item.data())
    }
}
```

### Common Methods

#### `data(_ newdata: Value?) -> Value`

Get the entity data. Returns a copy of the current data. Pass a `Value`
to set it.

#### `matchv(_ newmatch: Value?) -> Value`

Get the entity match criteria. Returns a copy of the current match
criteria. Pass a `Value` to set it.

#### `make() -> Entity`

Create another `GraphQl` entity with the same client and
options.

#### `stream(_ action: String, _ args: VMap? = nil, _ callopts: VMap? = nil) throws -> AsyncStream<Value>`

Run an operation through the pipeline and yield its result items as an
async iterator. The operation runs before the call returns. It ends
early once `callopts.signal` reports an abort.

#### `getName() -> String`

Return the entity name.


---

## History

```swift
let history = client.History()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `String` | Yes |  |
| `year` | `Int` | No |  |

### Operations

#### `list(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value`

List entities matching the given criteria. The match is optional; a call
without one is `list(nil, nil)`. Returns a value holding a `VList` of
entities, one per record, and throws on failure.

```swift
let results = try client.History().list(nil, nil)
for item in results.asList?.items ?? [] {
    if let item = item.asNative as? Entity {
        print(item.data())
    }
}
```

### Common Methods

#### `data(_ newdata: Value?) -> Value`

Get the entity data. Returns a copy of the current data. Pass a `Value`
to set it.

#### `matchv(_ newmatch: Value?) -> Value`

Get the entity match criteria. Returns a copy of the current match
criteria. Pass a `Value` to set it.

#### `make() -> Entity`

Create another `History` entity with the same client and
options.

#### `stream(_ action: String, _ args: VMap? = nil, _ callopts: VMap? = nil) throws -> AsyncStream<Value>`

Run an operation through the pipeline and yield its result items as an
async iterator. The operation runs before the call returns. It ends
early once `callopts.signal` reports an abort.

#### `getName() -> String`

Return the entity name.


---

## Planet

```swift
let planet = client.Planet()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `String` | Yes |  |
| `radius` | `Double` | No |  |
| `title` | `String` | Yes |  |

### Actions

This entity exposes custom API actions in addition to the standard
operations. Select one with `$action` in the call's argument, beside the
route's path parameters, as the Call column shows; the action's own
arguments go beside them too, and are sent as that action's payload.

| Action | Operation | Route | Call |
| --- | --- | --- | --- |
| `terraform` | `create` | `/planet/{id}/terraform` | `_ = try client.Planet().create(VMap([("$action", .string("terraform")), ("id", .string("planet_id"))]), nil)` |

Like any operation, an action's call gives back the entity; its data is
then that action's OWN response, which is not necessarily a Planet
record — check the API definition for its shape.

### Operations

#### `list(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value`

List entities matching the given criteria. The match is optional; a call
without one is `list(nil, nil)`. Returns a value holding a `VList` of
entities, one per record, and throws on failure.

```swift
let results = try client.Planet().list(nil, nil)
for item in results.asList?.items ?? [] {
    if let item = item.asNative as? Entity {
        print(item.data())
    }
}
```

#### `load(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value`

Load a single entity matching the given criteria. Returns a value
holding the entity, and throws on failure. `asNative as? Entity` takes
the entity out, and `result.data()` reads its record.

```swift
let result = try client.Planet().load(VMap([("id", .string("planet_id"))]), nil)
```

#### `create(_ reqdata: VMap?, _ ctrl: VMap?) throws -> Value`

Create a new entity with the given data. Returns a value holding the
created entity, and throws on failure. `asNative as? Entity` takes the
entity out, and `result.data()` reads its record.

```swift
let result = try client.Planet().create(VMap([
    ("id", .string("example_id")),  // String
    ("title", .string("example_title"))  // String
]), nil)
```

#### `update(_ reqdata: VMap?, _ ctrl: VMap?) throws -> Value`

Update an existing entity. The data must include the entity id, `id`,
unless the entity already holds it. Returns a value holding the updated
entity, and throws on failure. `asNative as? Entity` takes the entity
out, and `result.data()` reads its record.

```swift
let result = try client.Planet().update(VMap([
    ("id", .string("planet_id"))
    // Fields to update
]), nil)
```

#### `remove(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value`

Remove the entity matching the given criteria. Returns a value holding
the entity, marked as deleted, and throws on failure.
`asNative as? Entity` takes the entity out, and `result.data()` reads
its record.

```swift
let result = try client.Planet().remove(VMap([("id", .string("planet_id"))]), nil)
```

### Common Methods

#### `data(_ newdata: Value?) -> Value`

Get the entity data. Returns a copy of the current data. Pass a `Value`
to set it.

#### `matchv(_ newmatch: Value?) -> Value`

Get the entity match criteria. Returns a copy of the current match
criteria. Pass a `Value` to set it.

#### `make() -> Entity`

Create another `Planet` entity with the same client and
options.

#### `stream(_ action: String, _ args: VMap? = nil, _ callopts: VMap? = nil) throws -> AsyncStream<Value>`

Run an operation through the pipeline and yield its result items as an
async iterator. The operation runs before the call returns. It ends
early once `callopts.signal` reports an abort.

#### `getName() -> String`

Return the entity name.


---

## Record

```swift
let record = client.Record()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `fields` | `VMap` | No |  |
| `id` | `String` | Yes |  |

### Operations

#### `list(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value`

List entities matching the given criteria. The match is optional; a call
without one is `list(nil, nil)`. Returns a value holding a `VList` of
entities, one per record, and throws on failure.

```swift
let results = try client.Record().list(nil, nil)
for item in results.asList?.items ?? [] {
    if let item = item.asNative as? Entity {
        print(item.data())
    }
}
```

### Common Methods

#### `data(_ newdata: Value?) -> Value`

Get the entity data. Returns a copy of the current data. Pass a `Value`
to set it.

#### `matchv(_ newmatch: Value?) -> Value`

Get the entity match criteria. Returns a copy of the current match
criteria. Pass a `Value` to set it.

#### `make() -> Entity`

Create another `Record` entity with the same client and
options.

#### `stream(_ action: String, _ args: VMap? = nil, _ callopts: VMap? = nil) throws -> AsyncStream<Value>`

Run an operation through the pipeline and yield its result items as an
async iterator. The operation runs before the call returns. It ends
early once `callopts.signal` reports an abort.

#### `getName() -> String`

Return the entity name.


---

## Utility

```swift
let utility = client.Utility()
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `String` | Yes |  |
| `tool` | `String` | No |  |

### Operations

#### `list(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value`

List entities matching the given criteria. The match is optional; a call
without one is `list(nil, nil)`. Returns a value holding a `VList` of
entities, one per record, and throws on failure.

```swift
let results = try client.Utility().list(nil, nil)
for item in results.asList?.items ?? [] {
    if let item = item.asNative as? Entity {
        print(item.data())
    }
}
```

### Common Methods

#### `data(_ newdata: Value?) -> Value`

Get the entity data. Returns a copy of the current data. Pass a `Value`
to set it.

#### `matchv(_ newmatch: Value?) -> Value`

Get the entity match criteria. Returns a copy of the current match
criteria. Pass a `Value` to set it.

#### `make() -> Entity`

Create another `Utility` entity with the same client and
options.

#### `stream(_ action: String, _ args: VMap? = nil, _ callopts: VMap? = nil) throws -> AsyncStream<Value>`

Run an operation through the pipeline and yield its result items as an
async iterator. The operation runs before the call returns. It ends
early once `callopts.signal` reports an abort.

#### `getName() -> String`

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

```swift
let feature = VMap()
feature.entries["audit"] = .map([("active", .bool(true))])
feature.entries["cache"] = .map([("active", .bool(true))])
feature.entries["clienttrack"] = .map([("active", .bool(true))])
feature.entries["cost"] = .map([("active", .bool(true))])
feature.entries["debug"] = .map([("active", .bool(true))])
feature.entries["idempotency"] = .map([("active", .bool(true))])
feature.entries["log"] = .map([("active", .bool(true))])
feature.entries["metrics"] = .map([("active", .bool(true))])
feature.entries["netsim"] = .map([("active", .bool(true))])
feature.entries["paging"] = .map([("active", .bool(true))])
feature.entries["proxy"] = .map([("active", .bool(true))])
feature.entries["ratelimit"] = .map([("active", .bool(true))])
feature.entries["rbac"] = .map([("active", .bool(true))])
feature.entries["retry"] = .map([("active", .bool(true))])
feature.entries["secrets"] = .map([("active", .bool(true))])
feature.entries["streaming"] = .map([("active", .bool(true))])
feature.entries["telemetry"] = .map([("active", .bool(true))])
feature.entries["test"] = .map([("active", .bool(true))])
feature.entries["timeout"] = .map([("active", .bool(true))])
feature.entries["validate"] = .map([("active", .bool(true))])
let options = VMap()
options.entries["feature"] = .map(feature)
let client = DemoSDK(options)
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

