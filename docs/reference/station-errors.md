# Station error codes

The [voxgig/station](https://github.com/voxgig/station) runtime
companion surfaces failures through each SDK's own error path
(`err.code`), using the SDKs' house grammar (`<subject>_<condition>`,
absence as `no_<thing>`, gates as `_allow`). This is the canonical
catalog — the generated "Use with Station" README section links here
rather than restating it. The source of truth for the strings is the
station library's own code list
([`typescript/src/error.ts`](https://github.com/voxgig/station/blob/main/typescript/src/error.ts)),
**29 codes**, and the `errors` section of station's conformance corpus
pins the exact strings — known and unknown alike — in every language.

Five codes are **reserved for the proxy**, marked below: defined and
corpus-pinned now so the catalog is stable across ports, but raised by
nothing until the optional companion proxy ships. Solo-mode libraries
raise the rest.

## The base set

Station's core contract:

| code | when |
|---|---|
| `station_no_proxy` | attachment `require`d but not achieved within an operation's bounded wait, or proxy lost for a `resolve: proxy` plugin |
| `station_secret_no_value` | the chain ran and no store had the name (sekreto's `unknown secret`) |
| `station_secret_error` | a store could not answer — locked vault, refused login, unreachable host; carries sekreto's message verbatim and is never retried against a weaker store |
| `station_secret_name` | a configured secret name sekreto rejects as malformed, caught at profile load rather than first request |
| `station_host_allow` | egress denied by the hosts policy |
| `station_grant_expired` | grant TTL passed and re-registration failed *(reserved for the proxy)* |
| `station_wrap_order` | the wrap-position guard tripped: station's middleware was not immediately outside the base transport |
| `station_protocol` | wire/descriptor version rejected by the proxy *(reserved for the proxy)* |
| `station_no_plugin` | unknown plugin lookup; the payload lists the valid candidates |
| `station_no_entity` | unknown entity lookup; the payload lists the valid candidates |
| `station_no_op` | unknown operation lookup; the payload lists the valid candidates |
| `station_agent_allow` | `agent.write`/`agent.read` policy denial, on call or replay *(reserved for the proxy)* |
| `station_body_limit` | `/v1/forward` request body over the configured limit *(reserved for the proxy)* |
| `station_replay_lossy` | replay refused: the capture's request cannot be reconstructed byte-for-byte *(reserved for the proxy)* |
| `station_open_conflict` | a second `Station.open()` with different options in one process — the ambient instance is idempotent, and a conflicting reopen fails rather than silently answering with the first configuration |
| `station_bound_twice` | a second binding of one **instance** name. Keyed by instance, not api: two clients of one api is the normal case, and `create()` auto-tags precisely so it cannot trip this |

## The declarative front door

Added by the declarative config:
shape errors are fatal at `open()`; availability errors are fatal at
first use (`station.sdk(name)`), so a fleet of twenty declared SDKs
does not die because the eighteenth has a mistyped package name —
`station.check()` is the CI verb that surfaces those eagerly.

| code | when |
|---|---|
| `station_config_invalid` | struct validation of `station.json` failed; the message carries every error with paths |
| `station_config_secret` | a credential-shaped key or value in an `options`/`feature` block — the config file holds names, never values |
| `station_secret_collision` | two instances derive the same secret name, at least one of them derived rather than written |
| `station_feature_reserved` | a `feature.station` key, or `options.feature`, in a declarative config |
| `station_instance_api` | `connect(SDK, {as})` given a full ref whose name is not the SDK's api slug |
| `station_no_instance` | `sdk(ref)` for an undeclared ref; the message lists the declared ones |
| `station_instance_inactive` | the instance is declared with `active: false` |
| `station_sdk_load` | `package` could not be imported, `export` is absent from it, or it is ESM-only and `station.load()` was not awaited |
| `station_no_factory` | no factory for the api; the message names both remedies (self-registration via the package, or `Station.provide`) |
| `station_factory_conflict` | two different factories registered for one api — picking one of two SDK builds is not a thing to do silently |
| `station_feature_unknown` | a configured feature the SDK does not have; the message lists what it does |
| `station_feature_option` | an option key the feature does not declare, or the wrong type — checked against the schema the SDK's embedded config carries |
| `station_feature_order` | a feature-order constraint cycle, a `base` feature resolved anywhere but innermost, or an ordering that would move the pinned station wrap |
