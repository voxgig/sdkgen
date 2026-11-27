# Plan: resolving the open issues of sdkgen, December 2026

Status: **plan** (2026-11-27). Nothing here is implemented. The plan was
checked against sdkgen `main` at 033305a8 (4.45.0 plus the merges of #500,
#501, #513 and #522) and the tracker as read on 2026-11-26: 57 open issues,
#196 to #512. Paths are relative to the sdkgen repository root unless another
repository is named.

The request, in full:

> review the open issues and ask me for rulings where needed, then prepare a
> plan to resolve all issues

Twelve rulings were asked and answered on 2026-11-26 and 2026-11-27; they are
DQ1 to DQ12 in section 6, and the plan follows them. Decisions the plan makes
on its own are D1 to D43, each beside the item it decides; any of them can be
reversed before its package starts.

---

**Identifiers.** An issue is named by its tracker number. WP names a work
package, T a tier, R a release, DQ a ruling the maintainer gave and D a
decision this plan makes.

## 1. Summary

The 57 issues divide into 48 defects and 9 capabilities. None of them is
covered by a delivery or a plan in force: the November round fixed apidef's
issues and sdkgen's CI and CLI, and the two plans in force (the generated
text, files in the generated SDKs) touch five of these only at their edges
(#365 and #435 are documentation defects of the kind the text plan's
catalogue holds; #398 and #465 need the file plan's noun and form codec;
#455 and #491 sit beside its security rules).

The order is by harm. Four issues let one caller's data or credential reach
another caller or a log (#427, #491, #510, #455); they go first, alone, in
R1. The features the SDKs ship then get the behaviour their reference
promises (R2). Correctness of the generator, the typed models, the transports
and the live tests follows (R3), then the documentation, the Agent Skills
surface, Windows and the test infrastructure (R4), and last the two CLI
capabilities and one investigation (R5). Two items leave the plan by ruling:
the fuzz feature (#459) waits for a later round, and nested types (#220) get
a delivery of their own.

Every package changes every target that has the thing being changed. That
is the repository's parity rule and it is also what makes this round large:
twenty bundled targets, three packaged, and most defects are in the shared
feature templates that exist once per language. The sizes in section 4 count
that.

## 2. Rules every package follows

These are the repository's standing rules, restated because every package
here meets them.

- **Fix the class, not the instance.** A defect found in one language's
  template or component is fixed in every language that has the same shape,
  in the same change, with ts and js first (`AGENTS.md`, "Language parity is
  CRITICAL"). Each package below names the targets it touches; "all 20" means
  the bundled SDK targets, and the three packaged targets (dart, haskell,
  lean) get an issue in voxgig/sdkgen-langpack where the change reaches them.
- **A behaviour change is pinned where the behaviour is specified.** A
  feature's behaviour is specified by the shared feature corpus in
  create-sdkgen's `.sdk/test/feature/<name>.aontu`, run by every target's
  `Corpus.test.*`; `ts/test/feature.test.ts` drives the real template source
  offline; `ts/test/generatedcompile.test.ts` builds real SDKs. A fix to a
  feature adds a corpus case first, which fails in every target that has the
  defect, then the fix, then the case passes in all of them. A fix a corpus
  case cannot express (a function, a language idiom) gets a harness test.
- **Documentation follows the code, once.** The features reference
  (`docs/reference/features.md`), the hooks reference, the model reference
  and the generated README components change in the same package as the
  behaviour they describe, and a fact generated text depends on is computed
  once in the model (`ts/model/fact.aontu`).
- **Anything that leaves the pipeline is cleaned** (ADR-003). A new field on a
  result, an error or a log record passes through `clean` in every language,
  and the canary sweep in `ts/test/cleancoverage.test.ts` sees it.
- **A documented example runs or compiles.** A README change is checked by
  the README example lanes (go, lua, perl, php, py, rb run theirs; c, cpp,
  rust, zig, ocaml, csharp, scala, swift and clojure compile theirs).
- **No manifest change without `make deps`;** no vendored file edited by hand
  (an upstream change and a resync at a new tag); comments follow
  `COMMENT-POLICY.md`; a release is a workflow dispatch, never `npm publish`.
- **Verify on the real toolchain.** A target changed in a package is built
  and its suite run where the toolchain is, in the nightly where the push
  runners lack it, before the package merges.

## 3. Tiers and order

| Tier | Packages | Why this order | Release |
|---|---|---|---|
| T1 | WP01 | Data or credentials reach the wrong party today. | R1 |
| T2 | WP02 | Features the SDKs ship do not do what their reference says; six were reported in one sweep on 24 November. | R2 |
| T3 | WP03, WP04, WP05, WP06 | Generator, typed models, transports and live tests: wrong output, blocked consumers, false test results. | R3 |
| T4 | WP07, WP08, WP10 | Documentation and the Agent Skills surface, Windows, and the lanes that would have caught T2 and T3. | R4 |
| T5 | WP09, WP11 | Two CLI capabilities and one design note. | R5 |

Within a tier the packages are independent and can run in parallel. Across
tiers the order is the order of harm, not of dependency; the dependencies
that exist are named in each package, and two run the other way: WP08's
whole-suite lanes would have caught most of T2 and T3, and WP06's live-test
fixes make the fleet's live runs trustworthy earlier. A maintainer who wants
the detection first can run WP08 and WP06 in T2 at the cost of a later R2.

The releases are one minor version each, cut when the tier's packages are
on main (DQ2); the text plan's R1 to R3 take minor versions of their own, so
numbers are assigned at the time, in whichever order the tiers and that
plan's releases land. Each release that changes a default carries a
migration note (DQ3) in the release notes and in the features reference.

## 4. Work packages

Each package lists its issues, what changes, where, what pins it and what it
depends on. Size: S is hours, M is days, L is one to two weeks, XL more. The
size counts every target.

### WP01. Security and leakage (T1)

Issues: #510, #491, #427, #455, #431. Size: L.

- **#510.** The cost feature keeps per-actor and per-operation totals in a
  plain object, so an actor named `__proto__` or `constructor` writes onto
  `Object.prototype` (ts, js). D1: every keyed table in the ts and js feature
  templates becomes a `Map`, or an object with a null prototype where a plain
  object is read back by callers; the sweep covers cost, metrics, paging,
  ratelimit, cache and audit. Pinned by a corpus case whose actor is
  `__proto__` and whose later call sees no `calls` or `amount` on a fresh
  object, which every target runs (a dynamic target that keys on strings
  passes it today; a typed target passes it by construction).
- **#491.** `client.options()` clones the whole options object,
  `__derived__.clean.values` included, so a credential moved out of the
  options by station is still readable in its four encoded forms. D2: the
  clean registry moves out of the options, onto the client's root context,
  where `cleanConfig` reads it; `options()` returns the caller's options
  only. Every target that builds the registry in `make_options` moves it the
  same way. Pinned by the canary sweep: construct a client with a canary
  key, serialise `client.options()`, and find the canary only under the
  option the caller set.
- **#427.** The cache keys on method and URL, so a header that selects the
  tenant or the credential selects nothing; a write does not invalidate; the
  server's `Cache-Control` is not read. D3: the key is the method, the URL and
  an HMAC under a per-client random secret over the request headers sorted
  by name (headers, not their values, appear nowhere in the key); a `create`,
  `update`, `patch` or `remove` drops every entry whose URL is under the
  entity's route; `Cache-Control: no-store` and `private` prevent storing,
  `max-age` caps the TTL; `Expires` and `ETag` revalidation are out of scope
  and the reference says so, as it says the store is per client. Pinned by
  corpus cases for the tenant header, the write, `no-store` and `max-age`.
  Changes a default (DQ3).
- **#455.** The secrets feature's token exchange posts through
  `options.system.fetch` (ts, js) or the vendored sekreto `httpjson` plugin,
  so `VOXGIG_GETONLY_GUARD` does not reach it. D4: the exchange goes through
  the SDK's own guarded transport in every target, and the sekreto plugin
  gets the guard upstream (voxgig/sekreto) and is re-vendored at the next
  checkpoint. Pinned by a lane that sets the guard and runs the secrets
  suite, expecting `fetch_getonly_block`.
- **#431.** The rb audit feature holds every context in a Hash it never
  empties. D5: the entry is removed at the call's `PreDone`, and the same
  check is made of every feature that keys on a context in every language
  (audit, debug, clienttrack, telemetry). Pinned by a harness test counting
  live contexts after a run.

Depends on nothing. Releases as R1 with a migration note for the cache.

### WP02. The shipped features do what their reference says (T2)

Issues: #503, #504, #502, #508, #425, #428, #429, #430, #422, #489, #388,
#426, and the Retry-After parsing #459 found. Size: XL.

- **#503 ratelimit.** Concurrent calls compute their wait from the same token
  count and sleep without taking a token. D6: a call reserves its token
  before it sleeps, from a shared "next slot" time under the language's lock
  (a mutex in go, a lock in py, a promise chain in ts and js, and so on in
  each), so overlapping calls pace as sequential ones do; the README's
  `burst` default text follows the code. Pinned by a corpus case that
  starts N calls together under `rate: 4, burst: 1` against a stub that
  counts requests per second.
- **#504 paging.** A body `next` is recorded but never sent. D7: a body
  `next` that is not a URL is the cursor and goes out as `cursorParam`; a
  `next` URL, from the body or a `Link` header, builds the next request from
  that URL. Pinned by corpus cases for `next` as cursor and as URL.
- **#502 streaming.** A body cut off mid-stream yields nothing and ends
  without error when the feature is on. D8: the feature attaches
  `result.stream` only when the result carries no error, so the entity's
  `stream()` raises `response_body_read` as `list()` does. Pinned by a corpus
  case with a truncated body.
- **#508 retry.** py reads `statuses: []` as unset (`or` on an empty list).
  D9: `None` alone means unset, in py and in every target whose idiom has the
  same trap (rb's `||` does not, lua's `or` does). Pinned by a corpus case
  with `statuses: []` and a 503.
- **Retry-After.** The table in #459 shows three targets reading the header
  three ways. D10: RFC 9110 rules in every target: a decimal integer of
  seconds, or an HTTP-date, and anything else falls back to the backoff.
  Pinned by corpus cases for `""`, `-5`, `0x10`, `1e3`, `nan` and a date.
- **#425 telemetry.** Default ids are not W3C trace context. D11: random
  lowercase hex of 32 and 16 digits from the platform's random source; the
  `idgen` option stays for a caller's own. Pinned by a corpus case matching
  the regular expressions OpenTelemetry's propagator uses.
- **#428 hooks.** `PreDone` is skipped when a hook refuses at `PrePoint` or
  throws; `PreSpec` and `PreRequest` do not see what the reference says. D12:
  `PreDone` runs on every exit path (a `finally` in each language's op
  runner), and the hooks reference states each stage's inputs as the code
  provides them; the stages keep their names and positions, because the
  secrets, cost and station features are written to them. Pinned by a
  corpus case that refuses at `PrePoint` and asserts `PreDone` ran.
- **#429 hooks map.** The README documents passing hooks as a map the runtime
  ignores. D13: the README documents the form the runtime reads (a feature
  object with stage methods) and the map form is removed; with DQ5, an
  unknown `hooks` key is refused.
- **#430 model defaults.** DQ6: model `config.options` are runtime defaults.
  `make_options` in every target merges `config.feature.<name>.options`
  under the caller's options, so `active: true` in the model turns the
  feature on; a feature passed in `extend` fires its hooks only when active,
  as a generated feature does. The pipeline explanation, the features
  reference and the generated README say one thing. Pinned by a corpus case
  generated with `log` active in the model and no caller option, expecting
  the log feature present, and one with an inactive `extend` feature,
  expecting no hook fired. Changes a default (DQ3).
- **#422 strict.** DQ5: `strict` defaults to `true` in
  `ts/model/sdkgen.aontu`; a feature that takes arbitrary keys declares
  `strict: false` (none of the bundled 21 needs to, which the package
  confirms feature by feature); `featureOptionSpec` closes the spec. A
  misspelled option fails at construction with the key named. Station follows
  the SDK's spec, so it refuses the same key. Pinned by a corpus case with
  `retires: 5`. Changes a default (DQ3).
- **#489 extend placement.** An `extend` feature whose `__after__` anchor is
  absent is appended after every transport feature. D14: the first pass of
  the constructor adds the `extend` instance at the slot `featureorder`
  computed for its name and the second pass skips it, in ts and js, and the
  thirteen other constructors that take `extend` are read and brought to the
  same rule. Pinned by a harness test binding a stand-in with
  `__after__: 'test'` under a live-mode options set, asserting its position.
- **#388 test feature.** Eighteen targets match an update or patch on `id`
  alone. D15: port ts's rule (the id or its alias, plus the route's required
  parameters taken from the request data, plus `id.parts` and `id.from`) to
  every target. Pinned by corpus cases for a wrong parent (404) and a
  composite id.
- **#426 metrics.** No exporter; counters on an undocumented `_metrics`. D16:
  a `sink` option called with the counters at each `PreDone`, as the audit
  and debug features expose theirs, and the README lists every option the
  feature reads. Pinned by a corpus case counting sink calls.

Depends on nothing. Releases as R2 with migration notes for strict
options, model defaults, ratelimit pacing, paging `next` and streaming
errors.

### WP03. Typed models, the small defects (T3)

Issues: #511, #269, #398. Size: M.

- **#511.** `skipUntaggable` in `EntityTypes_go.ts` reads `member.name`
  where the field carries `n`, and drops every field before the warning it
  would log; `uniqueGoFields` reads the same. D17: read `n`, and add to the
  typed-model guard a case that fails when an entity's struct has fewer
  fields than its model (the eight `EntityTypes_<lang>` components are all
  checked against the same fixture).
- **#269.** Result types take requiredness and nullability from the request
  shape. D18: a response type is derived from the response schema's facts,
  which apidef publishes (`rs` with its required list and `nullable`); if
  the facts are missing, the first step is an apidef issue to publish them,
  and the sdkgen half waits on it.
- **#398.** A `$STRING` field with `fo: binary` is typed as text. D19: with
  the file plan's noun (ADR-006, binary), a binary field sent as multipart or
  raw gets each language's bytes type (go `[]byte`, java `byte[]`, csharp
  `byte[]`, ts `Blob | Uint8Array`, and so on) and stays a string where the
  field travels inside JSON; `canonToType` reads `fo`. Lands after
  file-handling-0's codec work names the roles.

Depends on apidef for #269 and on file-handling-0 for #398. #220 is out
(DQ12).

### WP04. The generator and the packages (T3)

Issues: #509, #506, #507, #432, #505, #512, #392. Size: M.

- **#509.** `SdkGen.makeBuild` constructs the generator from the build's
  options and never from `build.fs` or `build.dryrun`, so a dry run writes
  and prunes. D20: `makeBuild` passes the build's `fs` and `dryrun` through,
  the prune step honours `dryrun`, and `test/cli.test.ts` or a sibling runs a
  dry generate over a scaffold and asserts the tree is byte-identical after.
- **#506.** A package added by a relative path records `base` as written,
  and the copy check renders the expected copy with the absolute base. D21:
  the stamp is rendered with the base as recorded, in `doctor`, `warnCopies`
  and `package update` alike (one function). Pinned by an action test
  adding a package by relative path and asserting no outdated copy.
- **#507.** `target add` renders `VERSION` with the version of the day and
  `generate` copies it. D22: `VERSION` files are generated from
  `publish.version` on every generate (the VERSION template is replaced by a
  component, as the manifests are), for every target that has one. Pinned
  by a generate test changing the version and reading `go/VERSION`.
- **#432.** `package check` refuses a declared option with no default. D23:
  the check evaluates the option spec with declared-but-unset options
  reported as "required, no default", not as a parse failure.
- **#505.** DQ7 and DQ3: `requires-python = ">=3.10"`, `setuptools` pinned to
  a range that accepts `license = "MIT"`, and the vendored struct gets `from
  __future__ import annotations` upstream (voxgig/struct) and is re-vendored.
  The transport change is WP05's.
- **#512.** go-mcp returns a list as `structuredContent`. D24: a list result
  is `{ "items": [...] }`, documented in the go-mcp README; the MCP session
  test (`mcpSession`) asserts an object.
- **#392.** go-cli and go-mcp require the SDK at `v0.0.0` through a `replace`.
  D25: they require `github.com/<repo>/go` at `publish.version`, with no
  `replace`; local builds use a `go.work` the Makefile creates and git
  ignores (`make deps` forbids a committed one); the Makefile's publish
  target refuses to tag go-cli or go-mcp until `go/v<version>` exists on
  origin; the root README's Install cells carry `go install` again.

Depends on nothing. Releases as R3.

### WP05. Transport capabilities and parity (T3)

Issues: #408, #351, #407, #416, #420, #465, #402, #404. Size: XL.

- **#408 TLS trust.** D26: one client option in `main.kit.optspec`,
  `tls: { fingerprint, ca }`, honoured by every target's transport:
  `fingerprint` pins the server certificate's SHA-256 (bare or
  colon-paired), `ca` trusts a PEM as the authority, verification is never
  switched off, and no request byte is sent before the pin matches. The
  closed-union targets carry it in their option structs. Pinned by a probe
  lane against a local TLS server with a self-signed certificate, pinned
  right and wrong, counting requests (the TLS probes exist for the pinning
  case in several targets already; the lane extends them to all twenty).
- **#351 cancellation.** D27, in three groups: the native idioms, go
  `context.Context`, csharp `CancellationToken`, java and kotlin futures,
  swift `Task`, carried from the control to the transport and the waits; the
  synchronous targets (py, rb, php, perl, lua, rust), a cancel object on the
  control polled by the waits in retry, ratelimit, netsim and timeout, so a
  request stops at the next wait; the closed-union targets (c, cpp, zig,
  ocaml) and elixir and clojure, a cancel flag in the control that the waits
  check. Pinned by a corpus case cancelling during a retry wait and
  expecting `request_aborted`.
- **#407 body text.** DQ8: every target reads the body as text, keeps it on
  the result as `text` and parses from it, so parsing happens once and a
  consumer has the payload verbatim; `clean` covers the new field.
- **#416 per-call accept.** D28: `ctrl.accept` names one of the point's
  declared response alternatives, validated against them; it wins over the
  client-wide header. Pinned by a corpus case asking for the second
  alternative and reading the request's `accept`.
- **#420 go cause.** D29: the SDK error wraps the fetcher's error so
  `errors.As` finds it, for errors a caller-supplied fetcher returned (the
  caller owns that code); the SDK's own transport errors stay cleaned
  copies. java, kotlin, csharp and rust carry the same rule through their
  cause chains. Pinned by a harness test with a typed fetcher error.
- **#465 client credentials.** D30: a declared `Authorization` argument wins
  over the client credential when the operation declares the header as its
  own parameter; the secrets feature gains a `client_credentials` grant
  (Basic client authentication, form body); the form body codec itself
  comes from file-handling-0, which this package follows. Pinned by corpus
  cases for the header precedence and the grant.
- **#402 Python transport.** DQ7: the default transport is `http.client`
  with a pooled connection and no runtime dependency; `requests` is an
  opt-in transport. Pinned by the py suite run in an environment without
  `requests`.
- **#404 rb namespaces.** D31: entity classes move under the SDK's module
  (`Joplin::TagEntity`), and the vendored struct is routed through the
  vendor tool with a per-SDK module prefix, so two SDKs and station load in
  one process without redefinition. Pinned by a harness test loading two
  generated SDKs.

Depends on file-handling-0 for #465's codec. Releases as R3 with migration
notes for the Python transport and floor, `result.text` and the go error
cause.

### WP06. The live-test harness (T3)

Issues: #436, #467, #470, #473, #481, #482, #456. Size: M.

- **#436.** `definitionPlan` takes the scheme from `info.security.scheme`
  alone. D32: it takes the scheme that matches the resolved placement
  (`resolveAuthIn`, `resolveAuthName`) across `info.security` and its
  alternatives, falling back to the first; the secrets test templates read
  the same resolved placement.
- **#467.** Compare identities as strings in ts and js, and in any target's
  live identity check that compares typed values.
- **#470.** Every target's live entity and direct tests call its
  `live_delay_ms()` between requests; the seven defined-but-unused helpers
  are wired in.
- **#473.** When the discovered record has no identity, the flow falls back
  as it does without a list: the `*_ENTID` variable, then the route
  example, in go, py, rb, php and lua as in ts.
- **#481.** The live direct test chooses its route as the entity flow does:
  the first whose required parameters are exemplified or bound.
- **#482.** The ts and js live transport's abort timer bounds the wait for
  headers; body reads get their own, larger budget.
- **#456.** The go, php, rb and lua README example suites accept only the
  not-found a test-mode call can get, as ts and py do; the package first runs
  the stricter check across the fleet's READMEs and fixes what turns red.

Each is pinned by a case in the live harness's offline tests (the
`liveprobes` and `loadprobes` lanes), and #456 by the README lanes. Depends
on nothing. Releases as R3.

### WP07. Documentation and the Agent Skills surface (T4)

Issues: #365, #435, #490, #483, #424. Size: L.

- **#365.** D33: `ReadmeErrors` and `ReadmeExplanation`'s entity-state block
  get a per-language entry for all twenty targets, in each language's own
  idiom (c's `PNError**`, zig's `.err`, rust's `Result`), and a per-target
  hook (`ReadmeErrors_<t>`) so a pack supplies its own; a target without an
  entry gets no snippet rather than another language's. The README lanes
  compile or run the new blocks where a lane exists.
- **#435.** D34: two helpers, `entityItemsPhrase(name)` and
  `entityListVar(name, lang)`, replace every `${eName}s` in the sixty
  components; no generated text pluralises an entity name. Pinned by the
  text guard's reaction scan and a generate test over an entity named
  `Entity`.
- **#490.** D35: `SELF_REGISTER_TARGETS` narrows to ts and js now, so the
  README is true; generating the registration in the other eight is a task
  of the station delivery.
- **#483.** D36: one neutral component writes a short "set up this SDK with
  an agent" prompt into the root README and each target's, naming the
  install step and the test constructor.
- **#424.** DQ9: a `SKILL.md` per SDK, at the project root and beside each
  target, with `name` and `description` frontmatter and the entity and
  operation reference, following the Agent Skills specification; `doctor`
  treats a project-owned template as additive, as it treats a project-owned
  component. voxgig.com's wording (metsitaba/voxgig-web01#82) follows the
  release.

Depends on nothing; the text plan's text guard checks the new components
under every variation. Releases as R4.

### WP08. Test infrastructure and vendoring (T4)

Issues: #255, #397, #463. Size: L.

- **#255.** D37: a nightly lane per target generates a full project (root
  README and per-entity test data included) and runs its `make test`, in
  the three cheapest steps the issue proposes first (feature suites for py,
  rb, php and perl; the `fullset` suites; then whole suites), so a
  generated suite that fails on main is seen before a consumer sees it.
- **#397.** D38: the ten unrouted struct copies get routes at the shared
  tag, scala's `Struct.java` first (`java/src/Struct.java` with a package
  adapt); a copy that cannot be routed says why in `ts/vendor/routes.json`.
- **#463.** D39: the cpp TSan binary runs under `setarch -R`; a signal death
  with no ThreadSanitizer report is retried once and then set aside as a
  platform gap, as `laneVerdict` already does for an unusable toolchain.

Depends on nothing. Releases with R4 (no SDK change).

### WP09. CLI capabilities (T5)

Issues: #196, #198. Size: M.

- **#196.** D40: `--json` on `doctor`, `package list` and `package check`,
  one JSON document on stdout, diagnostics on stderr, exit codes unchanged;
  the flag is a `Skip` in the closed shape; `cli.test.ts` spawns the binary
  and parses the output.
- **#198.** D41: `doctor prune --orphans` previews the unreachable model
  files doctor already finds and deletes only those named with `--select`,
  under dry run, within the model tree.

Releases as R5.

### WP10. Windows (T4)

Issues: #433, #234. Size: L. DQ11: Windows is supported.

- **#433.** `generate` fails on Windows with `api/api-info.aontu` not found.
  The first step reproduces it on the `windows-latest` runner build.yml
  already has and finds whether the include path is resolved in sdkgen,
  @voxgig/model or aontu; the fix lands in whichever repository owns it.
- **#234.** D42: the ts and js npm scripts use node for cleanup instead of
  `rm -rf`; each target's Makefile delegates to its toolchain's own
  cross-platform commands where it can (dotnet, cargo, go, swift, gradle)
  and the remaining shell-only recipes are named in the README as needing
  a Unix shell; a Windows lane in CI generates and tests the ts, js, go,
  csharp, rust and java projects.

Depends on nothing. Releases as R4.

### WP11. Credentials in memory, a design note (T5)

Issue: #274. Size: M.

- D43: a design note under `docs/design/` weighs XOR-masking every held
  credential under a per-instance key against what `clean` and WP01's
  registry move already give, target by target, and recommends. No
  implementation starts from this plan; a recommendation to build becomes
  a delivery of its own.

## 5. Releases and repository order

| Release | After | Carries | Other repositories |
|---|---|---|---|
| R1 | WP01 | the four leaks closed, the rb audit leak | voxgig/sekreto (the httpjson guard), then a re-vendor |
| R2 | WP02 | the twelve feature corrections; migration notes for strict options, model defaults, ratelimit, paging, streaming | create-sdkgen (corpus cases; the pin on `@voxgig/sdkgen`) |
| R3 | WP03 to WP06 | typed-model fixes, generator fixes, transports, live tests; migration notes for the Python transport and floor, `result.text`, the go cause | voxgig/struct (annotations), apidef (#269 facts), create-sdkgen (dry-run docs, pins) |
| R4 | WP07, WP08, WP10 | per-language README sections, no pluralisation, `SKILL.md`, the setup prompt, Windows | voxgig/station (#490 registrations), voxgig-web01 (#424 wording), sdkgen-langpack (the per-target README hook) |
| R5 | WP09, WP11 | `--json`, orphan cleanup; the credential note | none |

Each release is `make publish V=<next minor>` from `main`, with the nightly
dispatched beside it for the targets the publish runner cannot build
(`AGENTS.md`, "Releasing"). The fleet's generated SDKs take each release at
their next regeneration; R2 and R3 change behaviour their READMEs describe,
so the fleet regeneration lane runs after each.

## 6. Decisions and authorisations

Rulings given by the maintainer, 2026-11-26 and 2026-11-27:

| Ruling | Question | Answer |
|---|---|---|
| DQ1 | Which issues does the plan take on? | All 57, in tiers. |
| DQ2 | How do the fixes reach npm? | One release per tier. |
| DQ3 | May defaults that are wrong today change? | Yes, with migration notes. |
| DQ4 | Is the plan a nexus delivery now? | Yes, a task per work package. |
| DQ5 | #422 strict options | Strict by default; a feature taking arbitrary keys declares `strict: false`. |
| DQ6 | #430 model options | Model `config.options` are runtime defaults; `extend` features follow `active`. |
| DQ7 | #402, #505 Python | Standard-library transport by default, `requests` opt-in; floor `>=3.10`. |
| DQ8 | #407 body text | Always keep `result.text`. |
| DQ9 | #424 Agent Skills | Generate a `SKILL.md` per SDK; `doctor` treats a project-owned template as additive. |
| DQ10 | #459 fuzz feature | Deferred to a later round; the Retry-After parsing is fixed in WP02. |
| DQ11 | #234, #433 Windows | Supported: both fixed, with a Windows lane for generated projects. |
| DQ12 | #220 nested types | A delivery of its own after this round; #269, #398 and #511 now. |

Decisions this plan makes (D1 to D43) are beside their items in section 4.
Three of them touch other repositories and need their owners: D4 (sekreto),
D18 (apidef) and D35 (station). D25 changes how a Go consumer installs the
CLI and MCP server and so belongs in R3's notes. Nothing here authorises a
release; each one is the maintainer's dispatch.

## 7. Not fixed, and why

- **#459, the fuzz feature.** Deferred by DQ10. The one defect its
  investigation found, the three readings of `Retry-After`, is fixed in WP02.
  The issue stays open with a note pointing here.
- **#220, nested types.** A delivery of its own by DQ12, across apidef (the
  nested shapes in the model) and every `EntityTypes_<lang>`; its plan starts
  after R3, when the small typed-model fixes are in.
- **#490, the registrations.** The README is made true in WP07 by narrowing
  the list; generating the registration in eight targets is station's Stage 4
  and goes to that delivery.
- **#274** is a note, not a build (WP11).

## Appendix A. Issue index

Size: S is hours, M is days, L is one to two weeks, XL more, counting every
target.

| Issue | Title (short) | Class | Where | Targets | Size | Package |
|---|---|---|---|---|---|---|
| #510 | cost: an actor named `__proto__` writes onto `Object.prototype` | security defect | `tm/ts`, `tm/js` cost feature; every keyed table in ts/js features | ts, js | S | WP01 |
| #491 | `client.options()` returns the clean registry with every credential | security defect | `Main.fragment`, `MakeOptionsUtility`, `CleanUtility` | all 20 | M | WP01 |
| #427 | cache keys on method and URL only; no `Cache-Control`; writes do not invalidate; tenant leak | security defect | cache feature | all 20 | M | WP01 |
| #455 | secrets token exchange bypasses the GET-only guard | security defect | secrets feature; vendored sekreto `httpjson` | all with secrets | M | WP01 |
| #431 | rb audit keeps every context alive | defect (memory) | `tm/rb/feature/audit_feature.rb` | rb; audit siblings to check | S | WP01 |
| #503 | ratelimit lets concurrent calls through; go data races | defect | ratelimit feature | all 20 | M | WP02 |
| #504 | paging records body `next` but never sends it; `Link` URL | defect | paging feature | all 20 | M | WP02 |
| #502 | streaming: a cut body ends `stream()` with no items and no error | defect | streaming feature, `EntityBase` stream path | all with streaming | M | WP02 |
| #508 | py retry: `statuses: []` reads as unset | defect | `tm/py` retry | py; audit siblings | S | WP02 |
| #425 | telemetry default ids are not W3C trace context | defect | telemetry feature | all 20 | S | WP02 |
| #428 | PreDone skipped on refusal or throw; PreSpec and PreRequest differ from docs | defect | entity op fragments, hooks reference | all 20 | M | WP02 |
| #429 | README documents a `hooks` map the runtime ignores | defect (docs or runtime) | `ReadmeHowto_ts/js`, `FeatureHookUtility` | ts, js (+ docs) | S | WP02 |
| #430 | model `config.options` are not runtime defaults; `extend` ignores `active` | defect | `MakeOptionsUtility`, `Main.fragment`, explanation | all 20 | M | WP02 |
| #422 | every feature defaults to `strict: false` | defect | `ts/model/sdkgen.aontu`, feature models, `optspec.ts` | generator | S | WP02 |
| #489 | an `extend` feature with an absent `__after__` anchor is appended | defect | `Main.fragment` ts/js; 13 other constructors to read | all with extend | M | WP02 |
| #388 | test feature: update and patch match by different rules per target | parity defect | test feature in 18 targets | 18 | L | WP02 |
| #426 | metrics has no exporter; counters on undocumented `client._metrics` | defect | metrics feature, README | all 20 | M | WP02 |
| #511 | every typed Go entity struct is empty | defect | `EntityTypes_go.ts` (`member.name` vs `n`) | go | S | WP03 |
| #269 | response requiredness and nullability lost in result types | defect | `EntityTypes_<lang>`, apidef facts | typed targets | M | WP03 |
| #398 | binary string field rendered as text | defect | `canonToType`, `EntityTypes_<lang>` | typed targets | M | WP03 |
| #220 | nested objects are `any` in every typed target | capability | apidef (nested shapes), `EntityTypes_<lang>` | typed targets | XL | own delivery (DQ12) |
| #509 | a dry run writes and deletes files | defect | `sdkgen.ts` `makeBuild` (fs, dryrun) | generator | S | WP04 |
| #506 | a package added by relative path warns outdated on every generate | defect | `action/resolve`, `doctor`, `copies` | generator | S | WP04 |
| #507 | go/VERSION and php/VERSION keep the version the target was added with | defect | `stdrep`, `target add`, VERSION templates | go, php | S | WP04 |
| #432 | `package check` refuses an option with no default | defect | `action/check.ts` | generator | S | WP04 |
| #505 | Python floor `>=3.8` admits versions that cannot install or import | defect | `Package_py.ts`, `py.aontu`, vendored struct annotations (upstream) | py | S | WP04 |
| #512 | go-mcp list tool returns an array as `structuredContent` | defect | `go-mcp/fragment/tools.fragment.go` | go-mcp | S | WP04 |
| #392 | go-cli and go-mcp cannot be installed from the Go proxy (`replace` at v0.0.0) | defect | `Main_go-cli`, `Main_go-mcp`, release order | go-cli, go-mcp | M | WP04 |
| #196 | `--json` output for doctor, package list, package check | capability | `bin/voxgig-sdkgen`, actions | generator | M | WP09 |
| #198 | previewable cleanup of orphan model files | capability | `doctor`, `doctor prune` | generator | M | WP09 |
| #408 | no TLS trust option (fingerprint, CA) in any transport | capability (consumer blocker) | `main.kit.optspec`, every transport | all 20 | L | WP05 |
| #351 | only ts and js can cancel a request in flight | parity capability | control, transports, waiting wrappers | 18 | L | WP05 |
| #407 | the response body text is discarded | capability | `ResultBodyUtility` | all 20 | M | WP05 |
| #416 | a point's response alternatives cannot be chosen per call | capability | `MediaUtility`, ctrl | all 20 | M | WP05 |
| #420 | go error keeps no cause | defect | `tm/go/utility/make_error.go` (+ typed-error siblings) | go (+ java, kotlin, csharp, rust) | S | WP05 |
| #465 | OAuth client-credentials: form body as JSON; client credential overwrites a declared `Authorization`; secrets refresh only | defect | `MakeSpecUtility` (auth precedence), secrets feature; form codec | all 20 | M | WP05 |
| #402 | py depends on `requests`; lazy import hides it | defect | `tm/py` fetcher, `py.aontu` | py | M | WP05 |
| #404 | rb entity classes and `VoxgigStruct` are top-level constants | defect | `cmp/rb`, `tm/rb` vendored struct (route) | rb | M | WP05 |
| #436 | `config.auth` changes the request but not the definition and secrets tests | defect | `definitionPlan.ts`, secrets test templates | ts, js (+ secrets tests in 6) | M | WP06 |
| #467 | live identity mismatch for integer identities | defect | `tm/ts/test/live-entity.ts` (+ js) | ts, js | S | WP06 |
| #470 | `test.live.delayMs` ignored outside ts and js | parity defect | live runners in 7 targets | go, py, php, rb, lua, perl, rust | S | WP06 |
| #473 | non-ts live flows load with no identity | parity defect | `TestEntity_<lang>` live flows | go, py, rb, php, lua | M | WP06 |
| #481 | live direct test calls an unexemplified primary route | defect | `TestDirect_<lang>` | all with live tests | M | WP06 |
| #482 | ts/js live transport aborts a large body at 30 s | defect | `tm/ts/test/live-runner.ts` (+ js) | ts, js | S | WP06 |
| #456 | README example suites in go, php, rb, lua accept any error | defect | `ReadmeExamplesTest_<lang>` ×4 | go, php, rb, lua | M | WP06 |
| #365 | README Error handling and Entity state sections are TypeScript in 13 targets | docs defect | `ReadmeErrors.ts`, `ReadmeExplanation.ts` (+ per-target hook for packs) | 13 + packs | M | WP07 |
| #435 | docs pluralise by appending `s` | docs defect | ~60 README components | all 20 | M | WP07 |
| #490 | `ReadmeStation` claims self-registration for ten targets; two do it | docs defect / parity | `ReadmeStation.ts`, `Main_<lang>` registration fragments | 8 | S + M | WP07 |
| #483 | docs should carry a setup prompt for the SDK | capability | README components | all 20 | S | WP07 |
| #424 | no Agent Skills output (`SKILL.md`) | capability | new component; doctor's rule for project templates | all | M | WP07 |
| #255 | lanes do not run each SDK's own suite | test infrastructure | `generatedcompile.test.ts`, nightly | all 20 | L | WP08 |
| #397 | ten struct copies the vendor tool does not route | vendoring | `ts/vendor/routes.json`, `make vendor` | 10 | M | WP08 |
| #463 | cpp TSan concurrency test segfaults intermittently | test infrastructure | cpp concurrency lane | cpp | S | WP08 |
| #459 | a fuzz feature | capability | new feature across targets | all 20 | XL | deferred (DQ10); its Retry-After finding in WP02 |
| #433 | Windows: generate fails, `api/api-info.aontu` not found | defect | model path resolution on Windows | generator | M | WP10 |
| #234 | cross-platform build and test scripts for Windows | capability | Makefiles and scripts of every target | all 20 | L | WP10 |
| #274 | hold credentials XOR-masked in memory | investigation | design note | all | M | WP11 |
