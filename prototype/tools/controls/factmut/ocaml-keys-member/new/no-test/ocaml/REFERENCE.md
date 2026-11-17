# Demo OCaml SDK Reference

Complete API reference for the Demo OCaml SDK.


## Sdk_client

### Constructor

```ocaml
open Voxgig_struct
open Sdk_helpers
open Sdk_types

let client = Sdk_client.make options
```

Create a new SDK client instance. `Sdk_client.make0 ()` uses the
defaults.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `` | `value` | SDK configuration options. |
| `apikey` | `string` | API key for authentication. |
| `auth` | `map` | Settings for how the credential is sent. |
| `base` | `string` | Base URL for API requests. |
| `prefix` | `string` | URL prefix appended after base. |
| `suffix` | `string` | URL suffix appended after path. |
| `headers` | `map` | Custom headers for all requests. |
| `allow` | `map` | Comma-separated allow-lists of the HTTP methods and the operations the client may use. |
| `feature` | `map` | Feature configuration. |
| `system` | `map` | System overrides (e.g. custom fetch). |
| `clean` | `map` | Redaction of everything the SDK emits. |
| `server` | `map` | Values for the variables the server URL is templated on. |
| `server.tenant` | `string` | Required. |
| `server.region` | `string` | Defaults to `eu`. |


### Test client

#### `test () : sdk_client`

Create a test client. This SDK is generated without the `test` feature,
so the client has no mock transport and refuses every request. It takes
no arguments.

```ocaml
let client = Sdk_client.test ()
```

#### `test_with (testopts : value) (sdkopts : value) : sdk_client`

Create a test client. This SDK is generated without the `test` feature,
so the client has no mock transport and refuses every request. The first
argument is set, switched on, as `feature.test` in the second, which
holds the other client options. Both may be `Noval`.

```ocaml
let client = Sdk_client.test_with Noval Noval
```


### Client functions

#### `ambient (client : sdk_client) (entopts : value) : entity_obj`

Create a new `Ambient` entity. Pass `Noval` for no initial
options.

#### `console (client : sdk_client) (entopts : value) : entity_obj`

Create a new `Console` entity. Pass `Noval` for no initial
options.

#### `graph_ql (client : sdk_client) (entopts : value) : entity_obj`

Create a new `GraphQl` entity. Pass `Noval` for no initial
options.

#### `history (client : sdk_client) (entopts : value) : entity_obj`

Create a new `History` entity. Pass `Noval` for no initial
options.

#### `planet (client : sdk_client) (entopts : value) : entity_obj`

Create a new `Planet` entity. Pass `Noval` for no initial
options.

#### `record (client : sdk_client) (entopts : value) : entity_obj`

Create a new `Record` entity. Pass `Noval` for no initial
options.

#### `utility (client : sdk_client) (entopts : value) : entity_obj`

Create a new `Utility` entity. Pass `Noval` for no initial
options.

#### `direct (client : sdk_client) (fetchargs : value) : value`

Make a direct HTTP request to any API endpoint.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `path` | `string` | URL path with optional `{param}` placeholders. |
| `method` | `string` | HTTP method (default: `GET`). |
| `params` | `map` | Path parameter values for `{param}` substitution. |
| `query` | `map` | Query string parameters. |
| `headers` | `map` | Request headers (merged with defaults). |
| `body` | `value` | Request body (maps are JSON-serialized). |
| `ctrl` | `map` | Control options. |

**Returns:** `value`, a result map. For a response whose body is read,
2xx or not, it holds the keys `ok`, `status`, `headers` and `data`, and
`ok` is `Bool false` unless the status is 2xx. When the body cannot be
read, `ok` is `Bool false` and the key `err` holds the error, read as
`getp result "err"`; a request that cannot be made gives only `ok`
(`Bool false`) and `err`. A failure is reported in the result, not as an
error, so branch on `getp result "ok" = Bool true`.

#### `prepare (client : sdk_client) (fetchargs : value) : value`

Prepare a fetch definition without sending the request. Accepts the
same parameters as `direct`.

**Returns:** `value`, the fetch definition: the request `direct` would
send. It raises on failure.


---

## Ambient

```ocaml
let ambient = Sdk_client.ambient client Noval
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `flow` | `float` | No |  |
| `temperature` | `float` | No |  |

### Operations

Each operation takes its match or data, then a control map, `ctrl`,
both by position: pass `Noval` for either to give none.

#### `e_load (value) (value) : entity_obj`

Load a single entity matching the given criteria. Returns the entity,
and raises on failure. `result.e_data_get ()` reads its record.

```ocaml
let result = (Sdk_client.ambient client Noval).e_load (Noval) Noval
```

### Common Fields

#### `e_data_get () : value`

Get the entity data. Returns a copy of the current data.

#### `e_data_set (value) : unit`

Set the entity data.

#### `e_match_get () : value`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `e_match_set (value) : unit`

Set the entity match criteria.

#### `e_make () : entity_obj`

Create another `Ambient` entity with the same client and
options.

#### `e_stream (string) (value) (value) : value Seq.t`

Run an operation through the pipeline and return an iterator over its
result items. The operation runs before the call returns. It ends early
once the `signal` in `callopts` reports an abort.

Its arguments are the name of the operation, its match, and `callopts`.

#### `e_name : string`

The entity name.


---

## Console

```ocaml
let console = Sdk_client.console client Noval
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes |  |
| `maker` | `string` | No |  |

### Operations

Each operation takes its match or data, then a control map, `ctrl`,
both by position: pass `Noval` for either to give none.

#### `e_list (value) (value) : entity_obj list`

List entities matching the given criteria. The match is optional.
Returns a `list` of entities, one per record, and raises on failure.

```ocaml
let results = (Sdk_client.console client Noval).e_list (Noval) Noval
let () = List.iter (fun item -> print_endline (stringify (item.e_data_get ()))) results
```

### Common Fields

#### `e_data_get () : value`

Get the entity data. Returns a copy of the current data.

#### `e_data_set (value) : unit`

Set the entity data.

#### `e_match_get () : value`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `e_match_set (value) : unit`

Set the entity match criteria.

#### `e_make () : entity_obj`

Create another `Console` entity with the same client and
options.

#### `e_stream (string) (value) (value) : value Seq.t`

Run an operation through the pipeline and return an iterator over its
result items. The operation runs before the call returns. It ends early
once the `signal` in `callopts` reports an abort.

Its arguments are the name of the operation, its match, and `callopts`.

#### `e_name : string`

The entity name.


---

## GraphQl

```ocaml
let graph_ql = Sdk_client.graph_ql client Noval
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes |  |
| `query` | `string` | No |  |

### Operations

Each operation takes its match or data, then a control map, `ctrl`,
both by position: pass `Noval` for either to give none.

#### `e_list (value) (value) : entity_obj list`

List entities matching the given criteria. The match is optional.
Returns a `list` of entities, one per record, and raises on failure.

```ocaml
let results = (Sdk_client.graph_ql client Noval).e_list (Noval) Noval
let () = List.iter (fun item -> print_endline (stringify (item.e_data_get ()))) results
```

### Common Fields

#### `e_data_get () : value`

Get the entity data. Returns a copy of the current data.

#### `e_data_set (value) : unit`

Set the entity data.

#### `e_match_get () : value`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `e_match_set (value) : unit`

Set the entity match criteria.

#### `e_make () : entity_obj`

Create another `GraphQl` entity with the same client and
options.

#### `e_stream (string) (value) (value) : value Seq.t`

Run an operation through the pipeline and return an iterator over its
result items. The operation runs before the call returns. It ends early
once the `signal` in `callopts` reports an abort.

Its arguments are the name of the operation, its match, and `callopts`.

#### `e_name : string`

The entity name.


---

## History

```ocaml
let history = Sdk_client.history client Noval
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes |  |
| `year` | `int` | No |  |

### Operations

Each operation takes its match or data, then a control map, `ctrl`,
both by position: pass `Noval` for either to give none.

#### `e_list (value) (value) : entity_obj list`

List entities matching the given criteria. The match is optional.
Returns a `list` of entities, one per record, and raises on failure.

```ocaml
let results = (Sdk_client.history client Noval).e_list (Noval) Noval
let () = List.iter (fun item -> print_endline (stringify (item.e_data_get ()))) results
```

### Common Fields

#### `e_data_get () : value`

Get the entity data. Returns a copy of the current data.

#### `e_data_set (value) : unit`

Set the entity data.

#### `e_match_get () : value`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `e_match_set (value) : unit`

Set the entity match criteria.

#### `e_make () : entity_obj`

Create another `History` entity with the same client and
options.

#### `e_stream (string) (value) (value) : value Seq.t`

Run an operation through the pipeline and return an iterator over its
result items. The operation runs before the call returns. It ends early
once the `signal` in `callopts` reports an abort.

Its arguments are the name of the operation, its match, and `callopts`.

#### `e_name : string`

The entity name.


---

## Planet

```ocaml
let planet = Sdk_client.planet client Noval
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes |  |
| `radius` | `float` | No |  |
| `title` | `string` | Yes |  |

### Actions

This entity exposes custom API actions in addition to the standard
operations. Select one with `$action` in the call's argument, beside the
route's path parameters, as the Call column shows; the action's own
arguments go beside them too, and are sent as that action's payload.

| Action | Operation | Route | Call |
| --- | --- | --- | --- |
| `terraform` | `e_create` | `/planet/{id}/terraform` | `let _ = (Sdk_client.planet client Noval).e_create (jo [("$action", Str "terraform"); ("id", (Str "planet_id"))]) Noval` |

Like any operation, an action's call gives back the entity; its data is
then that action's OWN response, which is not necessarily a Planet
record — check the API definition for its shape.

### Operations

Each operation takes its match or data, then a control map, `ctrl`,
both by position: pass `Noval` for either to give none.

#### `e_list (value) (value) : entity_obj list`

List entities matching the given criteria. The match is optional.
Returns a `list` of entities, one per record, and raises on failure.

```ocaml
let results = (Sdk_client.planet client Noval).e_list (Noval) Noval
let () = List.iter (fun item -> print_endline (stringify (item.e_data_get ()))) results
```

#### `e_load (value) (value) : entity_obj`

Load a single entity matching the given criteria. Returns the entity,
and raises on failure. `result.e_data_get ()` reads its record.

```ocaml
let result = (Sdk_client.planet client Noval).e_load (jo [("id", (Str "planet_id"))]) Noval
```

#### `e_create (value) (value) : entity_obj`

Create a new entity with the given data. Returns the created entity, and
raises on failure. `result.e_data_get ()` reads its record.

```ocaml
let result = (Sdk_client.planet client Noval).e_create (jo [
    ("id", (Str "example_id"));  (* string *)
    ("title", (Str "example_title"));  (* string *)
]) Noval
```

#### `e_update (value) (value) : entity_obj`

Update an existing entity. The data must include the entity id, `id`,
unless the entity already holds it. Returns the updated entity, and
raises on failure. `result.e_data_get ()` reads its record.

```ocaml
let result = (Sdk_client.planet client Noval).e_update (jo [
    ("id", (Str "planet_id"));
    (* Fields to update *)
]) Noval
```

#### `e_remove (value) (value) : entity_obj`

Remove the entity matching the given criteria. Returns the entity,
marked as deleted, and raises on failure. `result.e_deleted` reads the
mark. `result.e_data_get ()` reads its record.

```ocaml
let result = (Sdk_client.planet client Noval).e_remove (jo [("id", (Str "planet_id"))]) Noval
```

### Common Fields

#### `e_data_get () : value`

Get the entity data. Returns a copy of the current data.

#### `e_data_set (value) : unit`

Set the entity data.

#### `e_match_get () : value`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `e_match_set (value) : unit`

Set the entity match criteria.

#### `e_make () : entity_obj`

Create another `Planet` entity with the same client and
options.

#### `e_stream (string) (value) (value) : value Seq.t`

Run an operation through the pipeline and return an iterator over its
result items. The operation runs before the call returns. It ends early
once the `signal` in `callopts` reports an abort.

Its arguments are the name of the operation, its match, and `callopts`.

#### `e_name : string`

The entity name.


---

## Record

```ocaml
let record = Sdk_client.record client Noval
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `fields` | `value map` | No |  |
| `id` | `string` | Yes |  |

### Operations

Each operation takes its match or data, then a control map, `ctrl`,
both by position: pass `Noval` for either to give none.

#### `e_list (value) (value) : entity_obj list`

List entities matching the given criteria. The match is optional.
Returns a `list` of entities, one per record, and raises on failure.

```ocaml
let results = (Sdk_client.record client Noval).e_list (Noval) Noval
let () = List.iter (fun item -> print_endline (stringify (item.e_data_get ()))) results
```

### Common Fields

#### `e_data_get () : value`

Get the entity data. Returns a copy of the current data.

#### `e_data_set (value) : unit`

Set the entity data.

#### `e_match_get () : value`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `e_match_set (value) : unit`

Set the entity match criteria.

#### `e_make () : entity_obj`

Create another `Record` entity with the same client and
options.

#### `e_stream (string) (value) (value) : value Seq.t`

Run an operation through the pipeline and return an iterator over its
result items. The operation runs before the call returns. It ends early
once the `signal` in `callopts` reports an abort.

Its arguments are the name of the operation, its match, and `callopts`.

#### `e_name : string`

The entity name.


---

## Utility

```ocaml
let utility = Sdk_client.utility client Noval
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes |  |
| `tool` | `string` | No |  |

### Operations

Each operation takes its match or data, then a control map, `ctrl`,
both by position: pass `Noval` for either to give none.

#### `e_list (value) (value) : entity_obj list`

List entities matching the given criteria. The match is optional.
Returns a `list` of entities, one per record, and raises on failure.

```ocaml
let results = (Sdk_client.utility client Noval).e_list (Noval) Noval
let () = List.iter (fun item -> print_endline (stringify (item.e_data_get ()))) results
```

### Common Fields

#### `e_data_get () : value`

Get the entity data. Returns a copy of the current data.

#### `e_data_set (value) : unit`

Set the entity data.

#### `e_match_get () : value`

Get the entity match criteria. Returns a copy of the current match
criteria.

#### `e_match_set (value) : unit`

Set the entity match criteria.

#### `e_make () : entity_obj`

Create another `Utility` entity with the same client and
options.

#### `e_stream (string) (value) (value) : value Seq.t`

Run an operation through the pipeline and return an iterator over its
result items. The operation runs before the call returns. It ends early
once the `signal` in `callopts` reports an abort.

Its arguments are the name of the operation, its match, and `callopts`.

#### `e_name : string`

The entity name.


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

```ocaml
let client = Sdk_client.make (jo [
    ("feature", jo [
        ("audit", jo [("active", Bool true)]);
        ("cache", jo [("active", Bool true)]);
        ("clienttrack", jo [("active", Bool true)]);
        ("cost", jo [("active", Bool true)]);
        ("debug", jo [("active", Bool true)]);
        ("idempotency", jo [("active", Bool true)]);
        ("log", jo [("active", Bool true)]);
        ("metrics", jo [("active", Bool true)]);
        ("netsim", jo [("active", Bool true)]);
        ("paging", jo [("active", Bool true)]);
        ("proxy", jo [("active", Bool true)]);
        ("ratelimit", jo [("active", Bool true)]);
        ("rbac", jo [("active", Bool true)]);
        ("retry", jo [("active", Bool true)]);
        ("secrets", jo [("active", Bool true)]);
        ("streaming", jo [("active", Bool true)]);
        ("telemetry", jo [("active", Bool true)]);
        ("timeout", jo [("active", Bool true)]);
        ("validate", jo [("active", Bool true)]);
    ]);
])
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

Set `feature.audit.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.cache.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.clienttrack.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.cost.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.debug.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.idempotency.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

It runs without being switched on. Override any option above under `feature.log` in the client options; switching its `active` option off stops it. Every option keeps
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

Set `feature.metrics.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.netsim.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.paging.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.proxy.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.ratelimit.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.rbac.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.retry.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.secrets.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.streaming.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.telemetry.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.timeout.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
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

Set `feature.validate.active` to `Bool true` in the client options, and override any option above in the same entry. Every option keeps
its default unless you name it.

**Considerations**

- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
- Inactive by default: leaving it out costs nothing at runtime.

