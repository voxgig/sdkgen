# How to simulate network conditions in offline tests

Generated SDKs test against an **in-memory mock transport** (the `test`
feature) — no live server required. Real networks are slow, flaky, and rate
limited, though, and you want to prove your integration copes. Two
mechanisms let offline unit tests reproduce those conditions
deterministically.

## 1. The `test` feature's `net` block (no extra feature)

`SDK.test(...)` accepts an optional `net` block that layers simulated
network behaviour over the mock transport. Nothing else to enable — the
`test` feature is always present in a generated SDK.

```ts
// Slow network: every request delayed 250ms
const slow = SDK.test({ net: { latency: 250 } })

// Latency jitter: uniform sample between 50–400ms
const jittery = SDK.test({ net: { latency: { min: 50, max: 400 } } })

// Transient failures: the first 2 calls return HTTP 503, then succeed
const flaky = SDK.test({ net: { failTimes: 2, failStatus: 503 } })

// Connection errors: the first call throws a connection-level error
const dropped = SDK.test({ net: { errorTimes: 1 } })

// Total outage: every call fails at the transport level
const down = SDK.test({ net: { offline: true } })
```

| `net` field | Meaning |
| --- | --- |
| `latency` | Delay per request: a fixed number of ms, or `{ min, max }`. |
| `failTimes` | The first N calls return `failStatus` (default 503). |
| `failStatus` | The status returned by `failTimes` failures. |
| `errorTimes` | The first N calls throw a connection-level error. |
| `offline` | Every call fails at the transport level. |
| `sleep` | Injectable delay function (tests can pass a virtual clock). |

Counters are per client instance, so simulations are reproducible without
mocking timers.

## 2. The `netsim` feature (composes with `retry`, `timeout`, …)

`netsim` is a standalone feature that wraps whatever transport is active
(the mock, or a live `fetch`) and injects the same conditions. Because it
composes with the other transport features, it is how you prove `retry`,
`timeout`, `ratelimit` and `cache` behave under adverse conditions.

```ts
// retry should recover from two transient failures
const sdk = new SDK({
  feature: {
    netsim: { active: true, failTimes: 2, failStatus: 503 },
    retry:  { active: true, retries: 3, minDelay: 50 },
  },
})
// A single logical call now makes three transport attempts and succeeds.
```

`netsim` options additionally include `failEvery`, `rateLimitTimes` +
`retryAfter` (HTTP 429), `failRate` + `seed` (seeded random failures), and
`latency`. See `model/feature/netsim.aontu` for the full list.

> **Ordering:** transport features wrap `ctx.utility.fetcher` in `init()`,
> so a feature initialised later wraps one initialised earlier. To make
> `retry` re-issue through `netsim`, ensure `retry` initialises after
> `netsim`. In tests that need a specific order, activate them in that
> order or use the `__after__` / `__before__` feature-add controls.

## Determinism

Timing-sensitive features (`retry` backoff, `ratelimit` refill, `timeout`,
`netsim`/`test` latency) accept injectable `now()` and `sleep()` functions.
Pass a virtual clock to assert on elapsed time without real waits:

```ts
let t = 0
const clock = { now: () => t, sleep: (ms: number) => { t += ms } }
const sdk = new SDK({ feature: {
  netsim: { active: true, rateLimitTimes: 1, retryAfter: 2 },
  retry:  { active: true, retries: 2, sleep: clock.sleep },
} })
// after a recovered call, t === 2000 (the honoured Retry-After)
```

## Where this is tested

`@voxgig/sdkgen` exercises the **real feature template source** against a
simulated pipeline and network entirely offline in
`ts/test/feature.test.ts` (driven by `ts/test/featureharness.ts`). That
harness transpiles each shipped `tm/ts/src/feature/**` template and runs it
through a faithful miniature of the generated operation pipeline, so a
regression in a template is caught without generating a full SDK.

## See also

- [Add a feature](./add-a-feature.md)
- [Operation pipeline and feature hooks](../reference/hooks.md)
