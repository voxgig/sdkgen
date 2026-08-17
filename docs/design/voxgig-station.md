# Design: voxgig/station — one control surface for outbound integrations

Status: **proposal** (2026-08-17). Revised same-day after an adversarial
design review against the codebase; the review's corrections are folded
in throughout (wrap ordering, adopt semantics, identity fields, support
tiers, proxy-side policy authority).

Station is the component that sits between an application and all of its
generated SDKs. Every sdkgen SDK an application uses registers with a
local `Station` as a **plugin**, and station becomes the single place
where outbound integrations are configured, credentialed, observed,
policed, and debugged — for the developer and, just as importantly, for
an AI agent working on or through the application.

Five architecture decisions are settled and everything below follows
from them:

- **D1 — Library-first core.** Station's core is a per-language library.
  It is fully functional in-process with no other component running.
- **D2 — Companion proxy.** `voxgig/station` also ships one optional
  companion binary (Go), runnable locally or deployed remotely. When a
  station library attaches to it, the proxy provides consolidated
  cross-process/cross-language observability, debugging (capture,
  replay, mock), proxy-boundary credential injection, and the MCP agent
  surface. The proxy is an amplifier, never a required dependency.
- **D3 — Generated adapter.** SDKs become plugins via a `station`
  sdkgen **feature**: generated per-target adapter source plus a
  machine-readable descriptor derived from the config every SDK already
  embeds. Deep integration, not transport-sniffing.
- **D4 — Secrets are brokered with isolation.** Application code holds
  secret *references*, never values. Station resolves references
  through pluggable providers and injects credentials at the last
  possible boundary — the transport seam in-process, the proxy hop when
  attached.
- **D5 — Hand-written libraries.** The per-language station libraries
  are hand-written idiomatic code, *not* generated. What makes that
  sustainable is a deliberate design constraint (§10) and a shared
  conformance corpus (§13), the same discipline that keeps the SDK
  targets honest today.

Developer and agent experience are the fundamental values: every
mechanism in this design has to earn its place in a two-line quickstart
(§11) or an agent transcript (§12).


## 1. How much of this already exists

More than expected. The generated SDKs already contain nearly every seam
station needs; what is missing is the thing on the other side of those
seams — a consolidated consumer. The inventory, with receipts:

- **A uniform transport seam in every language.** All SDK traffic flows
  through one function slot, `utility.fetcher`. The `test` feature
  installs the base (mock) transport by replacing that slot; `proxy`,
  `retry`, `cache`, `ratelimit`, `timeout`, and `netsim` wrap whatever
  is current, onion-style, in their `init()`
  (`ts/project/.sdk/tm/ts/src/feature/proxy/ProxyFeature.ts`). Wrap
  nesting is *feature init order* — first-inited is innermost — and the
  default order is `test` first, then **alphabetical**
  (`ts/project/.sdk/tm/ts/src/utility/MakeOptionsUtility.ts`). That
  default would place a `station` wrap outermost, which is the wrong
  place (§3.3); ordering is therefore a mechanism this design must pin,
  not a property it inherits. The wrap sees **all** traffic, including
  the `direct()`/`graphql()` escape hatches, which bypass the *hook
  pipeline* but not the transport.
- **A 14-stage hook pipeline in every language.** `init`,
  `PostConstruct`, `PostConstructEntity`, entity-state hooks, then
  per-operation `PrePoint → PreSpec → PreRequest → PreResponse →
  PreResult → PreDone`, with `PreUnexpected` on escaped errors
  (`docs/reference/hooks.md`,
  `ts/project/.sdk/tm/ts/src/feature/base/BaseFeature.ts`). Hooks give
  station *operation semantics* (which entity, which op); the transport
  wrap gives it *HTTP truth*. Station uses both.
- **A ready-made plugin descriptor.** `configDefinition(model)`
  (`ts/src/utility.ts`) builds the machine-readable object every
  generated SDK embeds in all targets: name, per-feature config,
  options (base URL, server variables, auth prefix, headers), and the
  full entity/op/points map including HTTP methods and path templates.
  A station descriptor is a view over this, not a new artifact (§4).
- **Observability features with nowhere to send anything.** `log`,
  `debug`, `telemetry`, `metrics`, `audit`, `clienttrack` all exist per
  language, and all buffer in-process on the client
  (`client._debug.entries`, `client._telemetry.spans`, …) with only
  per-feature callbacks (`onEntry`, `exporter`) as egress. There is no
  consolidated sink, no cross-SDK view, no cross-process view. Station
  is that sink (§6).
- **A redaction list.** The `debug` feature's `redact` header list
  (`authorization`, `cookie`, `set-cookie`, `api-key`, `apikey`,
  `x-api-key`, `idempotency-key` —
  `ts/project/.sdk/model/feature/debug.aontu`) is the current source of
  truth for what must never appear in captured traffic. Station adopts
  and extends it (§15). The *body*-field equivalent (`clean.keys`) is
  currently disabled in the reference implementation
  (`CleanUtility.ts`'s redaction body is commented out) — reviving it
  is a station prerequisite (§15).
- **A vault shape.** Runtime secret management does not exist — the
  entire consumer secret story is one env var, `<NAME>_APIKEY`. But
  publish-time credentials already have a modeled shape:
  `publish.registry.vault` `{recipe, alias, env}` and
  `publish.tag.vault` `{recipe, alias}`, with the stated principle
  "credentials are always injected by the aql key vault (never on disk
  or argv)" (`model/sdkgen.aontu`). Station's secret references reuse
  the recipe/alias shape (§5).
- **An agent surface precedent.** `go-mcp` is a consumer target that
  turns one generated Go SDK into an MCP server: slug-prefixed tools,
  generic tools with an `entity` argument rather than per-entity tool
  explosion, stdio + streamable-HTTP transports, env-var-only config
  explicitly annotated "injectable by a secrets vault"
  (`ts/project/.sdk/src/cmp/go-mcp/`). Station's MCP surface (§7)
  generalizes this pattern across *all* registered plugins — and,
  unlike go-mcp, without needing a language runtime per SDK.
- **Distribution machinery.** The sdkgen package system
  (`docs/design/sdkgen-packages.md`) lets an external package ship a
  feature plus per-target source overlays for every language,
  installable with `package add`, with provenance stamping and doctor
  drift-detection. The `station` feature ships this way (§9).
- **Env-var grammar.** `<NAME>_APIKEY`, `<NAME>_TEST_LIVE`,
  `<NAME>_TEST_<ENTITY>_ENTID` (`ts/src/helpers/packageMeta.ts`
  `envName`/`envToken`) and the proxy feature's
  `HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY` handling define the naming
  conventions station's own env surface composes with (§8).

What does **not** exist anywhere today: named environments
(dev/staging/prod), any runtime secret provider besides a raw env var,
any consolidated or remote collection point for the observability
features, any cross-SDK control surface, and any way for an agent to
see what an application's integrations are *doing*. That is station's
job description.


## 2. The shape

Three parts, one contract:

```
┌────────────────────────── application process ──────────────────────────┐
│                                                                         │
│   app code ──► SolardemoSDK ──┐   (generated station feature:           │
│                               │    descriptor + hooks + fetcher wrap)   │
│   app code ──► PaymentsSDK ──┤                                          │
│                               ▼                                         │
│                        Station (library)                                │
│                • plugin registry   • secret broker                      │
│                • profiles/policy   • event buffer                       │
│                • in-process credential injection                        │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │ station wire protocol v1 (optional)
                                ▼
                 voxgig-station proxy (one Go binary)
          • consolidated capture across processes/languages
          • proxy-boundary credential injection (grants)
          • proxy-side policy authority   • replay / mock / record
          • MCP server (stdio + HTTP)     • OTLP export
          • tap/status/secrets/approve/revoke CLI
                                │
                                ▼
                        upstream APIs (outbound only)
```

- **The station library** (per language, hand-written): the in-process
  hub. Owns the plugin registry, profile/config loading, the secret
  broker, policy application, the event buffer, and the transport
  middleware that the generated station feature installs into each SDK.
  Complete on its own — this is D1.
- **The generated station feature** (sdkgen feature, per target): the
  adapter that connects a generated SDK to the library — registers the
  descriptor, bridges hooks to events, wraps the transport. Thin by
  design; all logic it calls lives in the library.
- **The proxy** (`voxgig-station`, one Go binary): everything that
  benefits from living outside the application process or being shared
  across processes and languages. Also the *only* place heavyweight
  integrations (OTLP, OS keychain, vault backends, capture storage,
  TLS termination for remote mode) are implemented — so the libraries
  never grow N copies of them.

### 2.1 Attachment modes

A station instance is always in exactly one of:

- **`solo`** — no proxy. Everything in-process: env/file secret
  resolution, in-process credential injection, ring-buffer events,
  in-process tap.
- **`attached`** — a proxy was configured or discovered (§8). Traffic
  is enveloped through the proxy's data plane, events stream to it,
  secrets may be proxy-held (grants), and the plugin appears on the
  proxy's MCP and CLI surfaces.

Mode is chosen at `Station.open()` from config (`proxy: 'auto' | 'off'
| <url> | 'require'`). `auto` (the default) probes and degrades to
`solo` with a single warning event; `require` fails closed
(`station_no_proxy`) for deployments where unproxied egress is not
acceptable. Degradation semantics are in §14 — they interact with
secrets.

`open()` is **non-blocking** in every language (JS cannot do
synchronous network I/O, so no language gets to depend on it): probe
and registration run in the background; operations that need only
library-resolved secrets proceed immediately in the meantime; the
first operation that needs a proxy-issued grant awaits registration
with a bounded timeout and then fails per §14. The `degrade`
conformance-corpus section pins these transitions.

### 2.2 Support tiers

"~23 languages" is not one capability level, and pretending otherwise
was the biggest defect of this doc's first draft. The template trees
disagree per target on four axes: whether the platform/stdlib provides
an HTTP client (C has none at all — the C SDK ships no HTTP and
requires an app-supplied `system.fetch`; Lua's fetcher pcall-requires
optional luasocket; Haskell's target prides itself on zero non-boot
dependencies), whether a package manifest exists to declare the
library dependency in (`Package_c` is an explicit no-op; zig hardcodes
empty dependencies), whether the `options.extend` seam exists (absent
in c, zig, haskell, ocaml, lean), and whether feature source is
per-feature files or one monolithic module (§9.1).

Station therefore ships with an explicit tier table, referenced
wherever this doc says "every language", maintained in the station
repo, and assessed per target at implementation time. The starting
assessment from today's trees:

| tier | targets (initial assessment) | solo | attached | mechanism notes |
|---|---|---|---|---|
| **A** | ts, js (node), go, py, rb, php, java, kotlin, scala\*, clojure\*, swift, dart, csharp, elixir, perl | full | full | platform/core HTTP stack; deps via manifest |
| **B** | rust, lua, haskell\*, ocaml\* | full | with one declared, well-known dependency (client crate; luasocket; http-client; …) | deps via manifest; \* single-module/static constraints in §9.1 |
| **C** | c, cpp, zig, lean | solo only in v1 (no wire client) | — | no manifest (c/cpp/zig: library vendored, §9.2); c/zig SDKs also have **no default transport** — see below |
| n/a | go-cli, go-mcp, py-data, seneca-provider | consumer targets, out of scope as plugins | | |

Remote-proxy attachment (TLS) is a stricter cut of the same table:
targets without platform TLS (perl's core HTTP::Tiny, lua) attach
locally only, or reach a remote proxy through a local `voxgig-station`
forwarding to it — a supported topology.

Two honesty notes the tiers force. In **c and zig** the SDKs' default
fetcher returns "live transport unavailable" unless the application
supplies `options.system.fetch` — so there, station's "HTTP truth" is
whatever that app-supplied callback does, and R1 injection necessarily
hands the credential back into app code (§5). In the **browser**, the
ts/js library must ship browser-safe entry points (conditional
exports; no unconditional `node:` imports for the file provider, token
file, or socket probe), and R1/R2 isolation does not exist at all —
any injected credential is readable by page code and DevTools; browser
station is observability-only with app-held credentials, and a
same-origin proxy endpoint is the only upgrade path. Both are Phase 1
statements, not Phase 2 discoveries, because bundlers consume the ts
package for browsers today.


## 3. The plugin contract

A **plugin** is a generated SDK bound to a station. The binding is made
by the generated station feature and consists of:

1. **Registration.** At SDK construction (`init` + `PostConstruct`),
   the feature builds the descriptor (§4) and registers it with the
   station, receiving a `Binding`: resolved base URL and server
   variables for the active profile, the credential plan (§5), the
   effective policy (§16), and capture settings.
2. **Transport middleware.** The feature wraps `utility.fetcher` with
   the station middleware, positioned per §3.3. The wrap covers
   `direct()` and `graphql()` traffic, which skip the hook pipeline
   but not the transport. In `attached` mode with proxied egress, this
   middleware is also where requests are enveloped to the proxy.
3. **Semantic events.** `PrePoint`, `PreDone`, and `PreUnexpected`
   hooks emit operation-level events (entity, op, outcome, duration)
   correlated with the HTTP-level events from the middleware via a
   per-operation id carried on the SDK's own `ctx`.
4. **Credential placement.** The feature never handles secret values.
   It arranges for `options.apikey` to hold a placeholder and lets the
   middleware perform injection (§5).

### 3.1 Binding forms

Three, all producing the identical binding (the placeholder is planted
at construction in each), because one shape does not fit 20 languages:

- **`station.connect(SDK, opts?)`** — where passing a
  class/constructor is idiomatic (ts, js, py, rb, …). Station
  constructs the SDK itself: merges the active profile's options,
  activates the station feature with explicit ordering (§3.3), plants
  the placeholder, returns the client.
- **Inverted binding** — where it is not (go, java, csharp, swift,
  c, zig): the app constructs the SDK its normal way and hands it the
  station — `solardemo.New(station.With(st))` in go, builder-style
  `.station(st)` in java/csharp. The generated feature reads the
  handle from its feature options and performs the same registration
  and placement during construction. This is the *primary* binding
  form for static languages, not a fallback.
- **`station.adopt(SDK, opts?)`** — the retrofit path for projects
  whose generated SDK predates the station feature. This is
  **construction-time sugar, not post-hoc attachment**: the first
  draft claimed `options.extend` could instrument an existing client
  instance, and the review killed that — `extend` is consumed exactly
  once, inside the constructor, and an extend-supplied feature's
  `init()` (where the transport wrap happens) only runs when a
  matching `feature.station.active: true` options entry exists.
  `adopt(SDK, opts)` therefore constructs the client itself with
  `extend: [station.adapterFeature()]` plus the activation entry and
  `__after__: 'test'` positioning, using the library's carried copy of
  the adapter. There is no supported late-attach of a live client in
  v1; a public `client.extend(feature)` runtime seam is noted in §9 as
  a possible future sdkgen change. In the five targets with no
  `extend` seam at all (c, zig, haskell, ocaml, lean), regeneration
  with the feature is the only retrofit.

If `adopt()` finds a real credential already resident in the options,
it hoists the value into the broker, overwrites `options.apikey` with
the placeholder before construction completes, and emits a one-time
warning event — so `options()`/`prepare()` become placeholder-safe
from that point, and the residual exposure is only "the value existed
in app code beforehand". The plugin's isolation rung (§5) is a visible
property everywhere plugins are listed — `station.plugins()`,
`voxgig-station status`, `station_integrations`, `station_secrets` —
never a silent downgrade.

An activated station feature with **no opened station** in the process
is an inert no-op that emits nothing and fails nothing (one warning
event once a station does open). Binding is never implicit: the
ambient instance exists (§10.2), but only `Station.open()` creates it.

### 3.2 Registry

The registry is explicit and queryable: `station.plugins()` returns
descriptors + live status + isolation rung. Nothing about the binding
is ambient magic; `connect`/`With`/`adopt` are sugar over documented
seams.

### 3.3 Wrap ordering — a pinned mechanism, not an assumption

Station's middleware must sit **immediately outside the base
transport** (i.e. inside `retry`, `cache`, `ratelimit`, `netsim`):
that position is what makes its `http` events wire-truth (each retry
attempt seen individually; cache hits *not* recorded as wire traffic)
and what keeps the injected credential below every
recording/buffering feature. The default feature order —
test-first-then-alphabetical — produces the *opposite* placement, and
the `__before__`/`__after__` controls are unusable for
config-constructed features (`makeFeature` builds instances without
`_options`). So the mechanism is explicit:

- `connect()`/`adopt()` pass the **ordered-array feature form** that
  `makeOptions` already supports, placing `station` immediately after
  `test`;
- for the plain map-form activation (inverted binding, hand-written
  options), the generated `makeOptions` gains a station special case
  mirroring test's — a required sdkgen change listed in §9.3;
- the adapter verifies its position at runtime (mark the fetchdef,
  detect an unmarked inner wrapper) and fails loudly with
  `station_wrap_order` rather than silently reporting non-wire
  events;
- injection is skipped entirely when the base transport is a mock
  (`test`, `netsim` replay), so real credentials never enter
  in-memory mock stores;
- the `order` conformance-corpus section pins all of the above (a
  retried op yields N station `http` events; a cache hit yields
  none).

### 3.4 Lifecycle

Birth is §3-items-1-4. Death and duration, equally specified:

- **`station.close()`** — flush events with a bounded timeout,
  release grants, end the proxy session (`DELETE /v1/session`).
  Libraries hook the runtime's natural exit point where one exists;
  close is idempotent.
- **Sessions expire.** The proxy expires sessions on TTL; liveness
  piggybacks on `/v1/events` batches (no separate heartbeat
  endpoint). `status`/`station_integrations` therefore show truthful
  liveness, not ghosts.
- **Grants renew by re-registration.** On grant expiry the middleware
  re-registers (same descriptor, fresh session) transparently;
  reattachment after proxy loss is always a full re-register.
- **Process-per-request runtimes** (php, CGI perl) run solo by
  default; attached mode uses a cheap rejoin handshake (the register
  response is cacheable across requests keyed by descriptor hash) —
  specified so the per-request cost is one conditional, not one
  registration.

### 3.5 Config resolution

One total order, lowest to highest precedence, identical in every
library and pinned by the `profile` corpus section:

1. generated SDK `Config` defaults (including the feature's model
   defaults),
2. station feature options passed at SDK construction (in-code
   defaults),
3. `station.json` base (`profiles.default`),
4. `station.json` selected profile overlay (deep-merge per plugin),
5. `VOXGIG_STATION_*` env vars,
6. `Station.open(opts)`,
7. `connect`/`adopt` per-plugin opts.

`station.json` is looked up from cwd upward to the repo root, then
`~/.voxgig/station.json`. The profile is `VOXGIG_STATION_PROFILE`,
else `default`. All station env vars are namespaced
`VOXGIG_STATION_*` (`VOXGIG_STATION_URL`, `VOXGIG_STATION_PROFILE`) —
one prefix, stated as a rule so future vars don't drift.


## 4. The descriptor

The descriptor is the machine-readable answer to "what is this
integration and what can it do?" — consumed by the station library,
the proxy, the MCP tools, and any agent that asks.

**Rule: the descriptor is a view over the embedded config, not a
second model.** Every generated SDK already carries the
`configDefinition()` output in every language. The station feature
exposes it; the library normalizes it into:

```
descriptor v1
├─ station: 1                    (descriptor schema version)
├─ name, slug, envtoken          (identity — slug carried, not derived; see below)
├─ version                       (SDK package version)
├─ target                        (language target id, e.g. 'ts', 'go')
├─ base, server[]                (base URL + server-variable spec)
├─ auth: { active, prefix, secretref-default }
├─ entities: { <name>: { fields, ops: { <op>:
│      { points: [{ method, path, params, select? }] } } } }
└─ features: [ present features + active state ]
```

Three small sdkgen changes fall out (all additive, all in
`configDefinition()` in `ts/src/utility.ts`, the single place the
embedded config is built):

- add `main.version` (the target's `publish.version`), so a running
  plugin can report what it is;
- add `main.target` (the generating target name), so the proxy can
  label cross-language traffic;
- add `main.slug` (= `model.name`, the hyphenated slug). Today the
  embedded config's only identity is the camel `Name`, and deriving
  an env token from the camel form *swallows hyphens* — the exact
  defect `packageMeta.ts` documents (`voxgig-solardemo` yielding
  `VOXGIGSOLARDEMO_…` instead of `VOXGIG_SOLARDEMO_…`). The slug is
  carried, `envtoken = envToken(slug)`, and the default secret ref
  `env:<envtoken>_APIKEY` is thereby correct for hyphenated names —
  without this field the "a project that does nothing gets current
  behavior" promise in §5 silently breaks.

For SDKs generated before these fields existed (`adopt()` targets),
the normalizer emits fixed sentinels — `version: "0.0.0"`, `target:
"unknown"`, `slug` derived best-effort from `name` with the hyphen
caveat surfaced as a warning event — and the corpus carries a
legacy-config case so all libraries agree.

Ops keep the **points array** (an op can multiplex several routes —
apidef folds `$action` routes into `create` today, e.g. `POST /planet`
and `POST /planet/{id}/terraform` under one op with `select.$action`).
`station_call` v1 targets each op's canonical point (the `opShape`
canonical-point rule); action routes via station are an open question
(§18), but the descriptor does not throw the information away.

**Canonical form.** "Byte-equivalent descriptors across languages" is
only meaningful with a serialization spec, so descriptor v1 defines
one: UTF-8, object keys sorted bytewise, no insignificant whitespace,
integers only in descriptor-defined numeric fields, minimal JSON
escaping. `canonical-serialize` is its own corpus section with
adversarial cases (non-ASCII entity names, large ints), because Lua's
`pairs()` and friends guarantee nothing without it. The proxy depends
on this when it synthesizes requests (§7) and when it dedupes
re-registrations by descriptor hash (§3.4).


## 5. Secrets: broker + isolation

The design principle: **application code configures references; only
station resolves values; values live in the narrowest scope the
deployment allows.**

### 5.1 Secret references

A reference is a string with a tiny grammar,
`provider:selector[#field]`:

| ref | resolved by | where the value lives |
|---|---|---|
| `env:SOLARDEMO_APIKEY` | library | process env (as today) |
| `file:.env.local#SOLARDEMO_APIKEY` | library | local file |
| `keychain:voxgig/solardemo` | proxy | OS keychain |
| `vault:npm/acme#apikey` | proxy | aql key vault (`recipe/alias#field`, the `publish.registry.vault` shape) |
| `proxy:solardemo` | proxy | proxy memory; the process never sees it |

The default for every plugin is `env:<envtoken>_APIKEY` — exactly
today's documented convention, so a project that does nothing gets
current behavior with hygiene added, not a migration.

The library implements only `env:` and `file:` (§10 — the modem
principle). Everything heavier is a proxy capability; in `solo` mode a
`keychain:`/`vault:`/`proxy:` ref is a clear, immediate configuration
error (`station_ref_no_proxy`), not a silent fallback.

### 5.2 Isolation rungs — what each one actually is

- **R0 (legacy, no station):** `options.apikey` as today. Unchanged.
- **R1 (solo): hygiene, not a security boundary.** Station resolves
  the ref and holds the value privately; the SDK's `options.apikey`
  is an inert placeholder; `prepareAuth` runs normally and produces
  an `authorization` header containing the placeholder; the
  middleware swaps in the real value at send time. What R1 buys, by
  construction: `client.options()` never exposes the value;
  `client.prepare()` output is safe to log or hand to an agent (today
  it carries the real key); captures, events, and `ctrl.explain`
  never contain it. What R1 does **not** buy — stated plainly because
  the first draft overclaimed it: protection against hostile
  in-process code. In dynamic runtimes closures are introspectable
  (`__closure__`, `debug.getupvalue`), transport slots are
  reassignable, and the default `env:` ref's value sits in process
  env regardless. R1 keeps secrets out of the places they *leak by
  accident* — logs, captures, diffs, agent context windows. R2 is the
  rung that removes the value from the process.
- **R2 (attached, proxy-held ref):** the process never resolves the
  value at all. Registration yields a **grant** — a token bound to
  the registration session, plugin-scoped, TTL'd (default 15m,
  renewed by re-registration, §3.4), revocable (`voxgig-station
  revoke <plugin>` / `DELETE /v1/grants/{plugin}`; `mode: block` is
  the hammer). The middleware sends the envelope with the grant; the
  proxy swaps in the real credential on the outbound hop. On a
  single-user local machine, the register token file is the true
  boundary — a process that can read it can mint grants — so R2's
  honest local value is that **the secret value never enters or
  persists in the application process**; containment of a live local
  attacker is not claimed. Plugin-scoping becomes a real boundary on
  a remote proxy, where registration is authenticated per app
  identity (§8.4).

**Copy-on-inject is mandatory.** The generated request machinery
shares object references — `fetchdef.headers` *is* `spec.headers`,
and `ctrl.explain` stores `fetchdef`/`spec` by reference before the
fetcher runs — so an in-place header swap would leak the real value
into `ctrl.explain`, `ctx.spec`, and every post-request hook. The
middleware clones the fetchdef and its headers map before swapping;
the object graph reachable from `ctx`/`spec`/`ctrl` holds only the
placeholder, ever. The `inject` corpus section asserts exactly this
(after a completed op, `ctrl.explain.fetchdef.headers` still holds
the placeholder) in every language.

**Injection placement:** below every recording feature and never into
mock transports (§3.3). In c/zig, where the app supplies the base
transport, the injected value necessarily crosses into that
app-supplied function — R1 there is conditional, and the tier table
(§2.2) says so.

SDKs whose model opted out of auth (`isAuthActive` false) skip
credential planning entirely but get everything else. The model's
single-credential reality (one `apikey`, no OAuth flows, no rotation)
keeps v1 honest: one ref per plugin; the `Binding` reserves a keyed
ref map for when the model grows multi-scheme auth (§18).


## 6. Observability and debugging

Station defines one normalized event stream and makes everything else
a producer into it or a consumer of it.

**`StationEvent` v1** (schema pinned by the `event` corpus section;
evolves additively — unknown fields are ignored):

```
{ t, session, plugin, corr,
  kind: construct | op | http | error | feature | station,
  op?:   { entity, op, outcome, durationMs },
  http?: { method, host, path, status, durationMs, bytes },
  err?:  { code, status, message },
  meta?: { … } }
```

Producers: the transport middleware (`http` events — wire truth,
including `direct()`/`graphql()`, one event per attempt); the hook
bridge (`op` events, correlated via `corr`); and the existing features
when active — `debug.onEntry`, `telemetry.exporter`, the `metrics`
counters, the `log` feature's injectable logger, `audit` entries
(bridged as `feature`-kind events; audit is the compliance-flavored
stream, so consolidation matters most there), and `clienttrack`'s
correlation ids (folded into `corr`). Projects already using those
features get consolidation for free; station requires none of them.

**Delivery semantics** are per execution model, stated because
"fire-and-forget" assumes concurrency some targets lack: threaded and
async runtimes flush batches in the background; synchronous
single-threaded libraries (c, lua, perl) flush inline at operation
boundaries under an explicit time/size budget that §14's latency
budget includes; process-per-request runtimes use the §3.4 rejoin
path or stay solo. In every model: events never block or fail an
operation, buffers are bounded, overflow drops oldest, and drop
counts are visible in `status`.

Consumers: **solo** — a bounded ring buffer (`station.events()`), a
live subscription (`station.tap(fn)`, callbacks serialized), nothing
else. **attached** — NDJSON batches to the proxy, which holds the
cross-process capture store and exports **OTLP** from one place.

Capture depth is policy, not code: `capture: meta | headers | full`
(default `meta`; `headers`/`full` apply redaction, §15).

Debugging is a loop on top of the capture store:

- `voxgig-station tap [plugin]` — live redacted traffic across every
  attached process, any language (CLI-only surface; the MCP
  equivalent is cursor-based `station_traffic`).
- `voxgig-station traffic --plugin solardemo --since 5m --grep 404`.
- `voxgig-station replay <capture-id> [--set query.id=42]` — re-issue
  a captured request through the same policy/injection path.
  **Replay semantics per header class** (these two decisions collide
  otherwise): redacted auth headers are re-injected through the
  credential path; one-time headers (`idempotency-key` and
  project-configured equivalents) are stripped and freshly minted,
  with the response annotated that dedup identity changed; replaying
  a *mutating* capture refuses by default and requires an explicit
  flag — and, from the agent surface, the `agent.write` gate (§16).
  `--set` mutations are bound to query/params/body — never method,
  host, or path root.
- `voxgig-station mock --record` / `--replay` — record real traffic,
  serve it back; the complement of `netsim` (netsim fabricates
  conditions; mock replays reality).

The CLI and MCP tools are two skins over one proxy API. Parity is
enumerated, not aspirational: every query/replay/secrets/policy/call
verb exists on both; `tap` live-follow and `mock` control are
documented CLI-only surfaces in v1.


## 7. The agent surface (MCP)

The proxy is an MCP server (`voxgig-station mcp`, stdio for `claude
mcp add`; streamable HTTP on the daemon for shared use — the two
transports go-mcp already established, same official Go SDK).

**Design choice: few generic tools driven by descriptors, not tool
explosion.** go-mcp's precedent (generic tools with an `entity`
argument) scales to N plugins as station-prefixed tools; per-entity
registration would blow MCP hosts' tool budgets by the second SDK.

| tool | does |
|---|---|
| `station_status` | is station itself healthy: proxy version, per-plugin mode + isolation rung + secret resolution state, drop counters |
| `station_integrations` | list plugins with a compact entity/op summary — one call answers "what can I call" |
| `station_describe {plugin, entity?}` | drill into a descriptor: entities, ops, params, field types and requiredness |
| `station_call {plugin, entity, op, query?, data?}` | execute an operation (canonical point, §4) |
| `station_traffic {plugin?, since?, grep?, cursor?}` | query recent redacted captures (cursor-based; the MCP skin of tap) |
| `station_replay {id, mutate?}` | replay a capture, under §6's per-class semantics and §16's gates |
| `station_secrets {plugin?}` | resolution *status* per ref — provider that answered, never values — plus secret-free remediation per unresolved ref ("set env var SOLARDEMO_APIKEY"; "requires proxy: start voxgig-station") |
| `station_policy {plugin?}` | effective policy view |

Agent-facing affordances are specified, not hoped for: entity/op
matching is case-insensitive with the canonical form echoed back;
unknown plugin/entity/op errors list the valid candidates in the
error payload; every error carries a §14 catalog code.

`station_call` is the significant one: the proxy synthesizes the HTTP
request directly from the descriptor and sends it through the same
policy, injection, and capture path as library traffic. **The agent
surface therefore has no dependency on any language runtime** — a
Python app's integrations are callable by an agent whether or not
Python is installed where the proxy runs. This is what the canonical
descriptor (§4) buys.

Safety defaults, because agents are a first-class *threat* as well as
a first-class user: `station_call` allows `load`/`list` by default;
mutating ops require the plugin's policy to opt in (`agent.write:
true`), and `station_replay` of a mutating capture sits behind the
same gate. An `agent.read` knob exists too — default true on a local
proxy, default false on a remote one (§8.4). Tool *output* is
untrusted content: `station_traffic` and `station_call` feed
upstream-controlled response bodies into the agent's context, and the
threat model (§15) names prompt injection through that channel
explicitly — the MCP server labels tool results as external data and
never embeds instructions in them.

Secrets are structurally invisible on this surface: there is no tool
whose output contains a value, so an agent given full station access
can operate every integration without ever being *able* to read a
credential — the §5 caveats about in-process code do not apply to an
agent on the MCP side of the proxy.


## 8. The wire protocol and the proxy

**Protocol v1: HTTP/1.1 + JSON**, versioned in the path (`/v1/…`) and
a `Station-Protocol: 1` header; NDJSON for event batches. Tier A
languages implement it with their platform stack; tier B with one
declared dependency; tier C not at all in v1 (§2.2).

### 8.1 Discovery and local auth

1. explicit `proxy: <url>` in config;
2. `VOXGIG_STATION_URL`;
3. `auto` probe: the unix socket `~/.voxgig/station/station.sock`
   first **where the library's HTTP stack supports it** (an optional
   per-library optimization — several stacks can't speak HTTP over
   UDS), else loopback TCP (default `127.0.0.1:8299`, configurable
   via `--listen`/`VOXGIG_STATION_URL`).

Local auth is a token file (`~/.voxgig/station/token`, 0600, in a
0700 directory, created by the proxy on first run). But a fixed
loopback port is not the Docker-socket model — any local user can
bind it first — so the client **authenticates the proxy before
sending anything sensitive**: on TCP, a challenge-response
proof-of-token (client sends a nonce; proxy answers
`HMAC(token, nonce)`; both sides hold the token file) precedes the
bearer token, envelopes, and events. Probe failures — including
auth/proof failures against an imposter — degrade exactly like
absence, with the cause named in the warning event. Every request on
every transport requires the bearer token (only `/v1/health` is
exempt, and it returns nothing sensitive); the daemon validates
`Host` against expected local values and rejects unexpected `Origin`s
(the MCP endpoint per the MCP spec) — a loopback JSON daemon is the
classic DNS-rebinding target and is hardened as such.

### 8.2 Control and data planes

Control:

- `POST /v1/register` — descriptor + process identity `{ pid, lang,
  app }` + reserved `identity: { org?, app?, principal? }` (ignored
  by a local proxy, load-bearing on a remote one — reserved *now* so
  remote does not force a wire v2) → `{ session, binding }`
- `POST /v1/events` — NDJSON batch; carries session liveness
- `DELETE /v1/session` — clean shutdown (§3.4)
- `DELETE /v1/grants/{plugin}` — revocation
- `GET /v1/policy/{plugin}` — long-poll for policy updates
- `GET /v1/health`

Data:

- `POST /v1/forward` — an explicit request **envelope**: `{ url,
  method, headers, body }` plus `Station-Session` /
  `Station-Plugin` / `Station-Corr` headers. The proxy applies
  policy, injects credentials (R2), sends upstream, captures, and
  returns `{ status, headers, body }`. Streaming responses pass
  through chunked; request bodies are buffered in v1 with a size
  limit (below); streaming uploads are an open question (§18).

A transparent HTTP forward proxy (the existing `proxy` feature's
`fetchdef.proxy` seam) was considered and **rejected** for the data
plane: HTTPS through a forward proxy means `CONNECT`, and a `CONNECT`
tunnel is opaque — no injection, no capture — unless the proxy
terminates TLS with an installed MITM CA, which is a developer-trust
and operational disaster. The envelope keeps the proxy a first-party
recipient, not an interceptor. (The `proxy` feature remains what it
is — egress routing through corporate proxies — and composes: the
station proxy's own upstream calls honor `HTTPS_PROXY`.)

### 8.3 Proxy-side policy authority

The review's most important finding: **everything a client registers
is untrusted input.** The descriptor is built client-side; the ref
selection comes from client-side profile loading; process identity is
self-reported. If the proxy derived the egress allowlist and the
plugin→secret binding from registration, a compromised (or merely
local, token-holding) process could register `slug: solardemo, base:
https://evil.example, secret: vault:npm/solar#apikey` and have the
proxy inject the real vault credential into a request to the
attacker's host.

So, as policy: for proxy-held refs (`keychain:`/`vault:`/`proxy:`),
the plugin→ref mapping and the `hosts` egress allowlist come from
**proxy-side configuration** — the proxy loads `station.json`
profiles itself, or pins the first-seen descriptor and requires
explicit approval (`voxgig-station approve <plugin>`) for any change
to `base`, `hosts`, or the ref. A registered descriptor can only
*narrow* what proxy-side policy allows, never widen it, and never
selects which secret is injected. Library-resolved refs (`env:`,
`file:`) don't route secrets through the proxy, so registration for
them is lower-stakes — capture and policy still apply.

### 8.4 Remote mode

Remote is the same binary behind TLS with per-app bearer tokens, and
in v1 it is **explicitly single-team and fully mutually trusting**:
every attached app can see every capture, and `agent.read` defaults
off (§7). Grants bind to the authenticated app identity, which is
where plugin-scoping becomes a real boundary (§5.2). Visibility
partitioning, per-principal authz on call/replay/secrets, and tenant
isolation are the open question that gates any shared deployment
(§18) — the `identity` field in `/v1/register` and per-app tokens are
reserved now precisely so answering it doesn't break wire v1.

### 8.5 Bounds and storage

Named defaults, all configurable, all visible in `status`: library
ring 1k events; proxy capture store 10k entries / 256 MB LRU;
`capture: full` bodies truncated at 64 KB with a `truncated` marker;
`/v1/forward` request-body limit 32 MB with a structured error.
In-memory by default; the optional SQLite capture store (for
replay/record across restarts) carries age/size retention config;
secret values live in memory only — keychain and vault backends are
readers, not stores. Encryption at rest for the SQLite store: §18.

### 8.6 Compatibility

Five artifacts version independently — wire protocol, descriptor
schema, StationEvent schema, each library's semver, and the generated
adapter frozen into consumer repos at add time. The policy: the proxy
accepts wire and descriptor versions N and N−1 and rejects unknown
versions with a structured error (`station_protocol`) the library
surfaces; descriptor and event schemas evolve additively within a
major (unknown fields ignored); an adapter pins its library to
`^major` via the feature model's `deps.<lang>` entry, and bumping
that range on a library major is the station repo's job (it owns the
sdkgen-station package). Skew is the steady state — `add` is
overwrite and adapters live for years in consumer diffs — so
compatibility is designed, not hoped.


## 9. The sdkgen integration

What lands in sdkgen or the sdkgen-station package — the
generator-side half:

1. **The `station` feature.** A feature model
   (`model/feature/station.aontu`) declaring top-level `active: true`
   like every shipped feature (model-level `active: false` would
   exclude it from the embedded config and strip its source at
   generation — the off-by-default convention lives at
   `config.options.active: false`, which station follows), hooks
   `PostConstruct`, `PrePoint`, `PreDone`, `PreUnexpected` active,
   and `config.options`: `{ active: false, url: '', fromEnv: true,
   profile: '', secret: '', register: true, capture: 'meta' }`.
   Per-target adapter source lives in each target's feature container,
   wherever the discovery walk (`ts/src/helpers/featureSource.ts`)
   finds it — `src/feature/station/` for ts/js, `feature/
   station_feature.go` for go, `pkg/feature/` for py, `lib/feature/
   station/` for dart, and so on; the walk exists precisely because
   the container path differs per target. Six targets declare
   `feature.trim: false`, in two distinct shapes: **zig and scala**
   keep per-feature files but statically reference every feature
   (root.zig/build.zig; SdkTestMain.scala) — a station adapter there
   is a new file plus edits to those reference points; **haskell,
   clojure, ocaml, lean** hold all feature code in one monolithic
   module an external package cannot safely overlay (a whole-file
   overlay would fork the base scaffold's copy and resync-clobber —
   the exact defect class CLAUDE.md warns about). Adapters for those
   four are deferred until either the modules become model-driven or
   station graduates into the bundled scaffold where the module has
   one owner — consistent with their tier-B/C placement and Phase 3
   (§17).
2. **A per-language dependency on the station library.** For the ~14
   targets whose `Package_<lang>` components consume `collectDeps`,
   the feature model's `deps.<lang>` blocks flow the dependency into
   generated manifests (peer for ts/js — the `log` feature's pino
   precedent — prod elsewhere). Targets whose manifests are hardcoded
   today (haskell, clojure, elixir, ocaml, lean, scala) need their
   Package components taught to consume `collectDeps` first — a
   listed prerequisite, not a footnote. Registry-less targets (c,
   cpp, zig) get the library **vendored** through the sdkgen-station
   `tm` overlay, accepting the consequences: the vendored source
   falls under add-overwrite/doctor semantics and its release cadence
   couples to `package add`. (Their tier-C solo-only scope keeps that
   vendored surface small.)
3. **Three additive `configDefinition()` fields** (§4:
   `main.version`, `main.target`, `main.slug`) and **one ordering
   change**: the generated `makeOptions` gains a station featureorder
   special case mirroring test's, so map-form activation gets the
   §3.3 placement without the ordered-array form.
4. **README, agent-guide, and repo docs.** A `ReadmeStation` section
   (composed by `Readme.ts`, gated on the feature) documenting the
   binding forms, refs, and the proxy quickstart; a station paragraph
   in generated `AGENTS.md` via `AgentGuide`/`AgentGuideFeature`; and
   in this repo's own docs map: `docs/how-to/use-station.md` (the
   §11 install flow is a textbook how-to), the station feature's
   options in the model reference, and an error-code catalog page
   under `docs/reference/` that ReadmeStation links — one canonical
   catalog, seeded with the existing SDK codes.
5. **Distribution: external package first.** The feature ships as
   `@voxgig/sdkgen-station` — an sdkgen package (manifest +
   `.sdk/model/feature/station.aontu` + per-target `tm/` overlays),
   installed with `voxgig-sdkgen package add @voxgig/sdkgen-station`.
   This exercises the package system's feature-overlay path with a
   real external package (it has none today) and keeps station's
   release cadence off sdkgen's. Because the bundled test suites
   cannot exercise a feature that isn't installed, **pre-graduation
   generator-side testing runs from the package side**: sdkgen-
   station's CI installs sdkgen, runs `package add` + `add-feature
   station` + generate into a fixture consumer across all shipped
   targets (the `generate.test.ts` memfs pattern), plus `package
   check`. The bundled suites take over at graduation.
6. **A sequencing rule, stated once:** *an adapter never ships for a
   target before that target's station library exists* — otherwise
   the generated manifest depends on a package that doesn't resolve
   and the consumer's first five minutes is a broken build. §17's
   phases obey it.

Existing targets are repositioned, not changed: **go-mcp** stays the
right answer for "one SDK, standalone MCP server, no other moving
parts"; the station proxy is the answer for "all my integrations, one
agent surface". go-cli similarly. Neither grows a station dependency
in v1.

Constraints inherited from the feature system, stated so nobody
relearns them: feature names cannot be aliased (`station` is the
name, everywhere); `add` is overwrite, so adapter source must stay
doctor-comparable (project customization goes through options, never
edits); feature source reaches only targets present at add time, and
`package add` orders targets-then-features correctly. A possible
future sdkgen change — a public `client.extend(feature)` late-attach
seam — would upgrade `adopt()` beyond construction-time sugar; it is
deliberately not required for v1.


## 10. The libraries: the modem principle

D5 says hand-written. Twenty-odd hand-written libraries stay
sustainable only if they are small, and they stay small only if the
design *forbids* them from growing. The rule:

> **The library is a modem, the proxy is the machine.** A station
> library implements exactly: config/profile loading, the ref grammar
> with `env:` + `file:` providers, the credential placeholder +
> copy-on-inject middleware, the event buffer/batcher, the descriptor
> normalizer + canonical serializer, the wire-protocol client (tier
> A/B only), and the ambient instance. Nothing else — no OTel, no
> keychain, no vault clients, no storage, no TLS configuration beyond
> the platform default.

### 10.1 Budgets, honestly

Roughly 1–2k lines for GC'd languages with a platform HTTP stack (tier
A) — the ballpark of a larger existing feature implementation. That
number does **not** hold for c/cpp/zig, where there is no substrate to
lean on (the C SDK's value/JSON machinery ships inside each generated
SDK, not as a reusable library) — which is one more reason those
targets are tier C: a solo-only station with no wire client, no
canonical serializer duty beyond the descriptor it hands the app, and
a shared vendored C core for c/cpp (the voxgig-struct precedent) if
demand pulls them further. Budgets are per tier, in the tier table's
repo home, and a library that busts its budget is redesigned, not
merged.

### 10.2 Shared contracts

- **Ambient instance:** `Station.open()` returns the process-ambient
  singleton; it is idempotent, and a second `open()` with conflicting
  options is an error. `new Station(opts)` (or the idiomatic
  equivalent) creates an isolated instance for tests and multi-tenant
  hosts. `adopt` and feature-driven binding target the ambient
  instance; binding one client twice is an error.
- **Concurrency:** all public station operations are safe to call
  from any thread; registry and buffers are internally synchronized;
  `tap` callbacks are serialized. Each library uses its idiom; the
  observable contract is fixed. The JSON corpus cannot express this,
  so per-language stress tests against the testkit proxy cover it
  (§13).
- **Layout:** the `voxgig/station` repo mirrors a generated SDK
  project's shape — per-language directories (`ts/`, `go/`, `py/`,
  …), the proxy under `proxy/`, the conformance corpus under
  `spec/`, and `sdkgen-station/` holding the sdkgen package. Every
  voxgig engineer and agent already knows how to navigate that shape.

Rollout follows the tier table and the parity-tier spirit (§17):
reference implementation is `ts`, as it is for the SDK targets.


## 11. Developer experience

The walkthroughs the design is accountable to:

**Zero to station (existing app, two lines):**

```ts
import { Station } from '@voxgig/station'
import { SolardemoSDK } from '@voxgig/solardemo-sdk'

const station = Station.open()               // profile/env/proxy all defaulted
const solar = station.connect(SolardemoSDK)  // was: new SolardemoSDK({ apikey: … })

const planets = await solar.Planet().list()
```

No proxy running, no config file: `open()` finds no `station.json`,
uses profile defaults, resolves `env:SOLARDEMO_APIKEY` (the ref
default — today's env var, unchanged), runs solo. Strictly better
than before: the key is out of app code's way — no longer in
`options()`, `prepare()` output, captures, or logs (§5.2's honest
scope) — and `station.tap(console.log)` shows live traffic.

**Quickstart parity** is part of the accountability, not a ts-only
demo. The same two lines in the first-wave languages:

```go
st := station.Open()                                  // go
solar := solardemo.New(station.With(st))
```
```py
station = Station.open()                              # py
solar = station.connect(SolardemoSDK)
```
```java
var st = Station.open();                              // java
var solar = new SolardemoSDK.Builder().station(st).build();
```

Inverted binding (§3.1) is what keeps these idiomatic; the isolation
guarantees are identical in all forms.

**Add the proxy when you want eyes:**

```
$ voxgig-station run          # local daemon on 127.0.0.1:8299
$ voxgig-station tap          # live view: every SDK, every process, every language
```

Restart the app (auto-attach), and the same two lines now stream to
the consolidated surface. `voxgig-station status` shows plugins,
modes, isolation rungs, secret resolution status, drop counters. The
CLI also carries `call` and `describe` — the human skins of the §7
tools.

**Profiles (`station.json`, committable — refs, never values):**

```json
{ "station": 1,
  "profiles": {
    "dev":  { "plugin": { "solardemo": { "base": "http://localhost:8000" } } },
    "prod": { "plugin": { "solardemo": {
      "secret": "vault:npm/solar#apikey",
      "policy": { "hosts": ["api.solar.example.com"] } } } } } }
```

The `plugin` map is keyed by **descriptor slug** (= the model's
hyphenated `name`), discoverable via `station.plugins()` /
`voxgig-station status` / `station_integrations`; a key matching no
registered plugin produces a warning event at register time, because
a typo'd key silently configuring nothing is the worst outcome for a
secrets-and-policy file. Lookup path, profile selection, and merge
order are §3.5; a JSON Schema for `station.json` ships in the
packages so editors and agents validate as they type.
`VOXGIG_STATION_PROFILE=prod` or `Station.open({ profile: 'prod' })`
selects. This is where the ecosystem finally gets named environments
— the model has none, deliberately; environments are a deployment
concern and station is the deployment-facing component.

**New SDK project:** `voxgig-sdkgen package add
@voxgig/sdkgen-station && npm run add-feature station && npm run
generate` — the generated README now carries the "Use with Station"
section, and the generated `AGENTS.md` tells agents the station
story. The full recipe is `docs/how-to/use-station.md` (§9.4).

**Debug a failing integration:** `tap` → spot the 401 →
`voxgig-station traffic --plugin solardemo --grep 401` →
`station_secrets` says the `prod` ref fell through to nothing, and
its remediation line says which env var or provider to fix → fix the
ref → `replay` the captured request → green. No print statements, no
code changes, same loop in every language.

**CI:** `voxgig-station mock --record` against a live run once,
commit the transcript, `--replay` in CI — deterministic integration
tests that exercise the real SDK pipeline, complementing the
in-memory `test` feature and `netsim`.

## 12. Agent experience

Symmetric walkthroughs, because agents are users:

**Agent operating the app's integrations:** `claude mcp add station
-- voxgig-station mcp`. The agent calls `station_status` (is station
itself healthy), `station_integrations` (what exists, with a
per-plugin op summary — one call, not N), `station_call {plugin:
solardemo, entity: planet, op: list}` (reads allowed by default; a
wrong entity name gets the candidate list back in the error), and
`station_traffic` (what actually happened). It never connects to N
servers, never reads a credential, and cannot mutate — by call or by
replay — unless the policy says `agent.write: true`.

**Agent debugging the app:** `station_traffic {since}` and
`station_status` answer "what is this app doing over the network and
why is it failing" from *outside* the process, in any language, with
redaction guaranteed and error codes from one catalog (§14).

**Agent working on the app's code:** the generated `AGENTS.md` in
every SDK plus the station section (§9.4) tells it the seams;
`client.prepare()` output being placeholder-safe (§5) means an agent
can inspect request construction without a secret entering its
context window.

**Agent safety posture, stated plainly:** station's job is to make
the *capable* path the *safe* path — an agent with full station
access can list, describe, call, observe, and replay, but the design
gives it no operation whose output contains a secret value; writes
are a policy grant, not a default; and upstream response content
flowing through the tools is treated as untrusted input by the
server and should be by the agent's harness too (§7, §15).


## 13. Testing

The discipline that keeps N of anything honest is a shared corpus
with a zero-case guard — proven by the 22-section parity corpus and
`ts/test/parity.test.ts`. Station adopts it wholesale:

- **`spec/` conformance corpus** (JSON, language-neutral), sections:
  `refparse`, `descriptor` (config-in → descriptor-out, including
  the legacy-config sentinel case), `canonical-serialize`
  (adversarial: non-ASCII names, large ints), `inject`
  (placeholder/copy-on-inject: `ctrl.explain` still holds the
  placeholder after an op), `order` (station sees N retry attempts;
  cache hits produce no http event; `station_wrap_order` guard),
  `redact` (headers and body fields, including a credential echoed
  in a response body), `envelope` (forward serialization),
  `event` (StationEvent shapes), `errors` (the §14 catalog: exact
  code strings and trigger conditions), `profile` (the §3.5 merge
  order), `degrade` (solo/attached transitions, non-blocking open).
  Every library runs every section; an empty or missing section
  fails loudly (the zero-case guard, copied deliberately).
  Concurrency is the one contract the JSON corpus cannot express —
  per-language stress tests against the testkit cover it (§10.2).
- **Proxy contract tests** in Go, plus `voxgig-station testkit` —
  the proxy binary in deterministic mode (fixed clock,
  transcript-driven upstreams) used by every library's CI to test
  attachment, forward, grants, and degradation without a real
  network.
- **Generator-side:** pre-graduation, from the package side — the
  sdkgen-station CI fixture-consumer flow of §9.5, plus `package
  check`; post-graduation, the bundled `generate.test.ts` memfs
  suite (adapter source compiles in all targets) and
  `feature.test.ts` harness (ts template against the miniature
  pipeline) take over.
- **End-to-end:** the solardemo validation flow (the repo's
  existing `validate-solardemo` loop) extended with station:
  generate with the feature, run apps in the shipped-library
  languages against a local testkit proxy, assert captures,
  injection, and `station_call` round-trips.

## 14. Failure modes and error codes

Specified, because "optional component" is only true if absence is
well-behaved:

- **Proxy absent at startup (`auto`)** → solo mode, one
  `station`-kind warning event naming the cause (not found, auth
  failed, proof-of-token failed — an imposter reads as absence).
  `require` → constructor-time `station_no_proxy`.
- **Proxy dies mid-flight** → the next envelope fails; refs the
  library can resolve (`env:`/`file:`) degrade to solo seamlessly
  (events buffer, capture gap noted); proxy-held refs fail closed
  with `station_no_proxy` — there is no secret to fall back to, and
  inventing a fallback would quietly downgrade the isolation the
  deployment chose. Reattachment is automatic with backoff and is
  always a full re-register (§3.4).
- **Events never block.** Fire-and-forget within each execution
  model's delivery semantics (§6), bounded buffers, drop-oldest,
  drop counts in `status`. An observability outage must not become
  an application outage.
- **Latency budget:** solo middleware overhead target < 0.1ms/op
  (including the synchronous-runtime inline flush amortized);
  attached envelope over loopback p50 < 1ms, p99 < 5ms —
  benchmarked in testkit CI, because a control surface that taxes
  the data path gets turned off.

**Error codes** follow the SDKs' house grammar
(`<subject>_<condition>`, absence as `no_<thing>`, gates as
`_allow` — the `point_op_allow` / `request_no_spec` /
`fetch_mode_block` family), surface through the SDK's own error path
(`err.code`), live in one catalog page (§9.4), and are pinned by the
`errors` corpus section. The v1 set:

| code | when |
|---|---|
| `station_no_proxy` | `require` unmet at open, or proxy lost with proxy-held refs |
| `station_ref_no_proxy` | a `keychain:`/`vault:`/`proxy:` ref in solo mode |
| `station_ref_no_value` | a ref that resolved to nothing |
| `station_host_allow` | egress denied by the hosts policy |
| `station_grant_expired` | grant TTL passed and re-registration failed |
| `station_wrap_order` | the §3.3 position guard tripped |
| `station_protocol` | wire/descriptor version rejected by the proxy |

## 15. Security posture

- **Redaction:** capture defaults to `meta`; `headers`/`full` apply
  the header redaction list seeded from the `debug` feature's, plus
  body-field redaction in the spirit of `clean.keys` — noting
  honestly that the `clean()` body-redaction in the reference SDK is
  currently disabled and must be revived and corpus-pinned before
  `capture: full` ships. Redaction is applied at capture time, never
  retroactively. Defense in depth: any body substring equal to an
  injected credential is scrubbed as well.
- **"By construction", scoped truthfully:** §5's placement makes the
  *injected credential* absent from request headers in captures,
  events, `options()`, `prepare()`, MCP tools, and CLI output
  without scrubbing. Bodies are not covered by construction — apps
  put credentials in bodies (token exchanges, GraphQL mutations)
  and upstreams echo them in diagnostics — so body redaction remains
  load-bearing at `capture: headers|full`.
- **Local daemon:** loopback/unix-socket only by default;
  token-on-every-request; proxy authenticated by proof-of-token
  before anything sensitive is sent; `Host`/`Origin` validation
  against DNS rebinding; 0700 directory (§8.1).
- **No MITM, ever:** the envelope design (§8.2) exists so the proxy
  never needs a CA in anyone's trust store.
- **Untrusted registration:** every field of a client-registered
  descriptor is untrusted input; it may only narrow proxy-side
  policy and never selects which secret is injected (§8.3).
- **Threat model, abbreviated:** malicious/compromised agent on the
  MCP surface → no secret-bearing tool output + `agent.write`/
  `agent.read` gates + prompt injection via upstream response
  content named and mitigated (tool results labeled external, never
  instruction-bearing); hostile in-process code → *not* an R1 claim
  (§5.2); R2 bounds what a compromised process holds to a
  session-bound revocable grant, with the token file as the honest
  local boundary; imposter local proxy → proof-of-token before
  disclosure; DNS rebinding → Host/Origin checks; leaked capture
  store → redaction-at-capture; compromised proxy → it holds
  secrets, so it is the hardening focus: minimal dependencies,
  memory-only default, no execution of plugin-supplied code; supply
  chain → the sdkgen posture holds (adapter source lands in the
  consumer's diff at add time and executes only when the consumer
  builds).

## 16. Policy

Per-plugin, declared in profiles, enforced twice where possible (in
the library and again in the proxy — the proxy cannot be bypassed in
R2, the library catches early in solo). For proxy-held secrets the
authoritative copy is proxy-side (§8.3).

- `allow.op` / `allow.method` — the same vocabulary the SDKs already
  enforce (`options.allow`, and the raw-access gate every target
  implements); station sets these SDK options from policy so
  enforcement is in the SDK's own pipeline, with station's checks as
  backstop.
- `hosts:` egress allowlist — defaulted from the *proxy-side* view
  of the descriptor's base + server-variable expansion, per §8.3;
  anything else is a policy edit, not a surprise.
- `budget:` rps/concurrency ceilings (the SDK `ratelimit` feature,
  configured by station, plus proxy-side enforcement in R2).
- `agent.write:` gates mutating `station_call` **and** replay of
  mutating captures (§6, §7); default false. `agent.read:` default
  true locally, false on remote proxies.
- `mode: live | record | replay | mock | block` — per plugin, per
  profile; `block` is the kill switch.

## 17. Delivery phasing

Obeying §9.6's rule — an adapter never precedes its library:

- **Phase 1 — prove the loop (narrow and deep):** ts library
  (browser-safe entry points included, §2.2) + proxy core (register
  with proof-of-token, envelope forward, R1+R2 with
  `env:`/`file:`/`proxy:` refs, proxy-side policy authority,
  capture, tap, status) + MCP
  (`station_status`/`integrations`/`describe`/`call`/`traffic`) +
  `@voxgig/sdkgen-station` with adapters for **ts/js only** + the
  three `configDefinition` fields and the featureorder change +
  package-side CI fixture flow + solardemo end-to-end (ts/js). Exit:
  the §11 two-line quickstart and the §12 agent transcript both
  real.
- **Phase 2 — breadth and depth:** go library then go adapter
  (unblocking go-heavy consumers and dogfooding next to the proxy);
  py, then the rest of tier A in demand order (java, csharp, kotlin,
  swift, dart, rb, php, scala/clojure on the JVM stack); keychain +
  vault (aql recipe) backends; replay/mock/record with the §6
  per-class semantics; OTLP export; grants hardening + revocation
  UX; `station.json` schema; ReadmeStation + AgentGuide +
  `docs/how-to/use-station.md`; conformance corpus enforced in CI
  for every shipped library.
- **Phase 3 — long tail and remote:** tier B (rust, lua, haskell,
  ocaml — the latter two gated on §9.1's single-module work), tier C
  scope decisions (c/cpp/zig/lean solo-only or vendored-core), zig/
  scala static-reference work; remote proxy mode against the §8.4
  tenancy answer; policy long-poll; `station_call` write-scopes in
  anger.

Each language library is a bounded, independent deliverable (modem
principle + tier budgets + corpus), so the long tail parallelizes
and never blocks the core.

## 18. Open questions

- **Remote multi-tenancy.** Visibility partitioning (who sees whose
  captures), per-principal authz on call/replay/secrets, grant
  scoping per app identity — must be answered before any shared
  deployment; until then remote v1 is single-team by policy (§8.4).
- **Streaming uploads through the envelope** (downloads pass through
  chunked; uploads are buffered with a size cap in v1). Matters for
  the `streaming` feature's upload half.
- **`$action`/multi-point ops via `station_call`** — the descriptor
  keeps the points array (§4); v1 calls the canonical point only.
  Expose action routes generically or require per-op annotation?
- **Multi-credential plugins.** Blocked on the model growing
  multi-scheme auth; the `Binding` reserves a keyed ref map.
- **Non-sdkgen outbound traffic.** A `station.fetch` for arbitrary
  HTTP would extend the control surface beyond SDKs; deliberately
  out of v1 to keep the descriptor story crisp.
- **A public `client.extend()` late-attach seam** in generated SDKs
  (§9), which would upgrade `adopt()` beyond construction-time
  sugar. Cross-language parity cost vs. value.
- **Graduation timing** of `@voxgig/sdkgen-station` into the bundled
  scaffold catalog — which also unblocks the four single-module
  targets (§9.1).
- **Proxy capture store encryption at rest** once SQLite persistence
  is on.

## 19. Non-goals

- Inbound traffic. Station is outbound-only, permanently.
- Replacing API gateways, service meshes, or egress firewalls.
- A general-purpose secret manager. Station brokers and isolates; it
  does not aspire to be Vault. (`Full secret manager` was explicitly
  considered and declined.)
- Generating the station libraries with sdkgen (D5 decided
  hand-written; the *adapter* is generated, the *library* is not).
- An OTel SDK dependency in every language library (proxy-only,
  §10).
- Replacing go-mcp / go-cli as standalone single-SDK tools (§9).
- Claiming R1 as an in-process security boundary (§5.2 — it is
  hygiene; R2 is the boundary, and only against value exposure, not
  a live local attacker holding the token file).
