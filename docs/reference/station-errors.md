# Station error codes

The [voxgig/station](https://github.com/voxgig/station) runtime
companion surfaces failures through each SDK's own error path
(`err.code`), using the SDKs' house grammar (`<subject>_<condition>`,
absence as `no_<thing>`, gates as `_allow`). This is the canonical
catalog; the `errors` section of station's conformance corpus pins the
exact strings in every language.

| code | when |
|---|---|
| `station_no_proxy` | attachment `require`d but not achieved within an operation's bounded wait, or proxy lost for a `resolve: proxy` plugin |
| `station_secret_no_value` | the chain ran and no store had the name (sekreto's `unknown secret`) |
| `station_secret_error` | a store could not answer — locked vault, refused login, unreachable host; carries sekreto's message verbatim and is never retried against a weaker store |
| `station_secret_name` | a configured secret name sekreto rejects as malformed, caught at profile load rather than first request |
| `station_host_allow` | egress denied by the hosts policy |
| `station_grant_expired` | grant TTL passed and re-registration failed |
| `station_wrap_order` | the wrap-position guard tripped: station's middleware was not immediately outside the base transport |
| `station_protocol` | wire/descriptor version rejected by the proxy |
| `station_no_plugin` / `station_no_entity` / `station_no_op` | unknown lookup; the payload lists the valid candidates |
| `station_agent_allow` | `agent.write`/`agent.read` policy denial, on call or replay |
| `station_body_limit` | `/v1/forward` request body over the configured limit |
| `station_replay_lossy` | replay refused: the capture's request cannot be reconstructed byte-for-byte |
| `station_open_conflict` | a second `Station.open()` with different options in one process |
| `station_bound_twice` | one client bound to a station more than once |

Proxy-dependent codes (`station_no_proxy` in attached mode,
`station_grant_expired`, `station_protocol`, `station_agent_allow`,
`station_body_limit`, `station_replay_lossy`) are defined now so the
catalog is stable, but only arise once the optional companion proxy
ships; solo-mode libraries raise the rest.
