# Design: API versioning — compatibility across apidef, sdkgen, and aontu

Status: **discussion draft** (2026-08-18). Nothing here is implemented;
several items are deliberately sequenced *before* their principled aontu
form so the ecosystem is not coupled to an unbuilt roadmap. §12's open
questions gate most of the plan — answer those first.

Method: a survey of version handling as it exists in apidef and sdkgen
(every claim about the codebases below carries a file reference), a
reading of aontu's capability-review design docs (G3 subsumption and
evolution, G6 distribution) and progress register, a parallel research
pass over five areas — API-provider versioning practice, the
breaking-change tooling landscape, SDK-generator vendor practice, the
theory of schema evolution, and runtime version negotiation — and an
adversarial critique pass over the resulting draft, whose surviving
findings are folded in throughout (most importantly §10.1 and §11).
External claims were verified against current (2025–26) sources, listed
in §14.

---

## 1. The problem

APIs change. The ecosystem generates SDKs in 20+ languages from a model
derived from a spec, and today it has no answer to any of the questions
that follow from that:

- How does an SDK's version relate to the version of the API (or the
  deployed app serving it) that it was generated from?
- When the spec changes, what tells anyone whether the change was
  breaking — for the wire, or for the generated language surface?
- What happens at runtime when a deployed SDK meets a server that is
  newer than it, or older than it?
- Who is told, and how, when part of an API is deprecated?

The station design already states the ground truth for the whole domain
([voxgig-station.md](./voxgig-station.md) §8.6):

> Skew is the steady state — `add` is overwrite and adapters live for
> years in consumer diffs — so compatibility is designed, not hoped.

That sentence is this document's thesis, applied one level up: not just
station's wire protocol, but the API ↔ SDK ↔ app relationship
itself.

---

## 2. Current state: three versions that never meet

The survey found the versioning story is not weak so much as
*disconnected*. Three version concepts exist and none of them touch:

### 2.1 The API's own version

- `info.version` enters the apimodel at exactly one place — apidef's
  `transform/top.ts:42`, where the whole `info` object is copied
  wholesale (`kit.info = stringifyInfoScalars(def.info ?? {})`). The
  helper exists *because of* `version`: unquoted YAML `version: 2`
  parses as a number and fails unification against `version?: string`.
- It is declared at `apidef/model/apidef.aontu:33` as `version?:
  string` — the only `info` field with no consumer note, accurately,
  because **it has no consumer**. Grep across sdkgen's `ts/src` and
  `ts/project` finds zero reads of `info.version`. `ReadmeTop.ts` pulls
  title, tagline, summary, website, homepage, docs_url, meta_source,
  contact, servers — never version.
- The GraphQL branch round-trips it (`apidef.ts:196` passes it in,
  `parse/graphql.ts:279` writes it back out) — a passthrough so a
  schema with no version concept inherits the project's declared one,
  not a derivation.
- apidef's parse stage checks only that the *spec-format* version key
  exists (`parse.ts:99-103`); Swagger-2-vs-OpenAPI-3 differences are
  detected structurally, never by reading the value.
- The only *semantic* version logic in apidef is entity-name cleanup:
  `utility.ts:1253-1323` strips/restores `_v<N>` schema-name suffixes
  (`IncidentV2` keeps its version, a wrapper does not). Naming, not
  versioning.

### 2.2 The SDK's release version

- `publish.version` (`model/sdkgen.aontu:320-334`) is a per-target
  manual string defaulting `'0.0.1'`, with a good documented rationale
  (generated output is overwritten, so a hand-edited manifest version
  is lost on regeneration; per TARGET because ports publish to
  different registries on different clocks).
- **Contradiction:** `cmp/Deploy.ts:208-209` derives the release-tag
  version by reading `./ts/package.json` back out of generated output
  ("Lockstep SDK version, read from the canonical ts manifest") — the
  opposite of the per-target design three files away.
- The generated user-agent hardcodes `'0.0.1'` as a literal in every
  language's clienttrack template (`tm/ts/src/feature/clienttrack/
  ClienttrackFeature.ts:85-89` and its 20+ siblings). `ProjectName` is
  substituted; `'0.0.1'` is not a placeholder. It is connected to
  neither `publish.version` nor `info.version`.
- `cmp/Changelog.ts` seeds `## [0.0.1]`, declares semver, and is never
  updated again.
- The embedded `configDefinition` (`utility.ts:294-325`) carries no
  version field; adding `main.version` is proposed in the station
  design (§ "add `main.version` … so a running plugin can report what
  it is") but unimplemented.

### 2.3 The toolchain version — the only one actually built

- `engines.sdkgen` is enforced by the hand-rolled semver subset
  (`helpers/semver.ts`; caller `action/package.ts:181`), whose
  tri-state design — `true` / `false` / `undefined` where undefined
  means "outside my subset, let the install proceed with a warning" —
  is the right failure-direction instinct this document generalises.
  (**Rot:** `helpers/manifest.ts:57-63` still claims `engines` is
  "DECLARATIVE ONLY … nothing reads this range yet"; that has been
  false since the gate landed.)
- The manifest schema gate (`sdkgen.package`, `manifest.ts:45-49`,
  forward-only refusal at `:169-178`) versions the manifest's own
  shape.
- **Doctor compares content, never versions** — the deliberate trade
  recorded in [sdkgen-packages.md](./sdkgen-packages.md) §"A lockfile
  could also record the version": staleness detected by content is
  "strictly more honest than a version comparison, which can match
  while the content has diverged (and mismatch while it has not)". The
  transition-tolerance rule (a diff of only new provenance lines is
  `resync-pending`, not `forked` — `doctor.ts:876-905`) is the repo's
  one worked example of a migration policy.
- Cross-package: the apidef canon-vocabulary guard in
  `ts/test/canonsync.test.ts` skips when the installed apidef predates
  the exports — the only version-conditional compat check between the
  two packages, and it currently no-ops. (**Rot in apidef:**
  `go/apidef.go:14-17` claims a TS-side exported `VERSION` "to match
  the TypeScript side"; no such export exists.)

### 2.4 What is entirely absent

No spec diffing. No breaking-change detection. No deprecation
propagation — OpenAPI's `deprecated` flag is **not parsed at all**
(GraphQL's is, but only to *exclude* deprecated fields from selection
sets, `transform/field.ts:148`, never to record them). No compat
matrix. No version on the wire. The only worked compatibility policy
in the ecosystem — station §8.6's "proxy accepts wire and descriptor
versions N and N−1, rejects unknown versions with a structured error,
schemas evolve additively within a major, unknown fields ignored" — is
design, not code.

One prior decision to respect: [sdkgen-packages.md](./sdkgen-packages.md)
explicitly rejected version tracking for package copies in favour of
content comparison. This document does not reverse that; it extends the
same doctrine to the API axis, with one correction (§6.4).

---

## 3. Theory

Four results carry the design. They are stated here plainly enough to
be quoted, with sources in §14.

### 3.1 The variance theorem

Model an endpoint at version N as a function `f_N : Req_N → Resp_N`.
A deployed SDK built against N is a **writer of requests** and a
**reader of responses**. The upgraded server `f_{N+1}` is safe under
all old call sites iff `f_{N+1} <: f_N`, and by the standard
function-subtyping rule (parameters contravariant, results covariant —
Cardelli/TAPL ch. 15; behaviorally, Liskov & Wing 1994: preconditions
may only weaken, postconditions only strengthen):

- **Requests are contravariant:** the server's accepted-request set may
  only WIDEN. In subsumption terms, the NEW request schema must subsume
  the old one.
- **Responses are covariant:** every new response instance must still
  lie inside what the old reader tolerates. The OLD response schema
  must subsume the new one.

The subsumption arrow points in **opposite directions on the two
halves of one endpoint**. A whole-endpoint "backward compatible"
verdict is therefore not one `subsume(new, old)` call; it is
`subsume(new_req, old_req) ∧ subsume(old_resp, new_resp)`. The dual
(new SDK, old server) reverses both arrows and is exactly FORWARD
compatibility. In Avro/Confluent reader-writer vocabulary: the request
channel needs BACKWARD (new server as reader of old SDK output), the
response channel needs FORWARD (old SDK as reader of new server
output). An API operator who cannot force SDK upgrades — which is
every API operator; the installed fleet is a population that upgrades
on its own schedule — must hold both disciplines forever, on every
release. Confluent's corollary that compat direction dictates upgrade
order (BACKWARD ⇒ consumers first, FORWARD ⇒ producers first, FULL ⇒
any order) collapses, for SDKs, to: the server side carries the whole
obligation.

The apimodel knows which schemas sit in which role per operation, so
any checker built on it can and must apply the opposite arrows
automatically. A tool that asks the user to pick one direction per
file is wrong half the time.

### 3.2 Decidability is bought, not found

Avro is the only mainstream formalism where "is this evolution safe"
is a total, decidable, purely schema-level function — and it achieves
that by the unglamorous moves of matching fields by name and putting
the only repair mechanism (defaults) *in the schema*. Its exact rules
are worth internalising: add-a-field is backward-safe iff it carries a
default; remove-a-field is backward-safe unconditionally (writer-only
fields are ignored) but forward-safe only if the removed field had a
default. **Defaults are not ergonomics; they are the decidability
lever.**

Every richer language pays for expressiveness with incompleteness of
its compat checker: CUE's `Value.Subsume` documents false negatives;
JSON-subschema checking is sound-but-incomplete by design (Habib et
al., ISSTA 2021, with a VLDB 2022 companion generating concrete
*witness* instances separating two schemas); and asynchronous session
subtyping — the realistic model for multi-step flows over pipelined
HTTP — is formally **undecidable** (Bravetti/Carbone/Zavattaro;
Lange/Yoshida). Three-valued verdicts with an honest `undecided` arm
are therefore not an implementation cop-out but the mathematically
mandated interface, at the schema level and the flow level both.
Aontu G3's `{subsumes | does_not_subsume(witness) |
undecided(reason)}` contract matches the state of the art exactly.

Note also that CUE's documentation literally defines `Subsume` as
"tests whether a value is a backwards compatible (newer) API version
of another value" — subsumption-as-compatibility is not a novel
application; G3's genuinely novel parts are the witness, the profiles,
and (once added, §10.3) role-split direction.

### 3.3 Must-ignore, must-preserve, and the amended Postel

Forward compatibility is a property of the **processor**, not the
schema (Orchard; W3C TAG versioning drafts): old readers survive new
writers only if the v1 processor was *specified* to ignore unknown
content — a decision made in v1, before anyone knows what v2 needs.
Its soundness limit (raised by Henry Thompson in TAG discussion):
ignoring is sound only when the ignored element's semantics are
independent of the elements you did understand — you cannot safely
ignore `currency` beside `price`; that is when must-understand is
mandatory.

RFC 9413 (IAB, 2023) splits "be liberal in what you accept" into two
opposite policies a generator must implement simultaneously:

- Tolerance of **spec'd extensibility** — unknown fields at open
  points, unknown enum values where the set may grow — IS forward
  compatibility and is mandatory in generated readers.
- Tolerance of **malformed known content** — wrong types, out-of-range
  values, missing required fields — is Postel-rot (ossification,
  parser-differential security bugs); generated readers should fail
  loudly there. Generated request writers stay strict throughout.

And must-ignore is not the ceiling: proto3 originally *dropped*
unknown fields on parse, intermediaries silently destroyed data, and
Google reversed course in protobuf 3.5 (2017). For any client that
does read-modify-write — which sdkgen's entity update flows do —
must-**preserve** is the rule, not must-ignore. GREASE (RFC 8701) adds
the enforcement idea: deliberately exercise the unknown-value code
paths so tolerance cannot silently rot (§8.8 turns this into parity
rows).

### 3.4 Consumer contracts, and the generator's unfair advantage

Robinson (2006): provider evolution from P to P′ is safe iff every
consumer contract still holds — compat need only hold on the union of
consumers' *actually-used subsets*, strictly weaker than full-schema
subsumption. It is the difference between "breaking in principle" and
"breaks someone". Pact operationalises this as a matrix of executed
verifications per (consumer version, provider version) pair, queried
by `can-i-deploy` against what is *currently deployed* — never by
version-number correspondence.

A handwritten client's used subset must be inferred from tests. **A
generated SDK's used subset is knowable exactly at generation time** —
which operations were emitted, which fields the components bind. sdkgen
can emit the consumer contract as a generation artifact. No surveyed
vendor exploits this.

### 3.5 Limits of all schema-level checking

Two bounds that no subsumption engine crosses, which shape §9:

- **Resource-commitment asymmetry.** Google's AIP-180 counts *relaxing*
  a constraint (raising a string length limit) as breaking, because
  clients may have provisioned fixed-width storage. Subsumption is
  necessary but not sufficient once client-side commitments exist.
- **Behavioral breaks.** Same schema, different semantics; or a new
  server-emitted state in a polling loop's status alphabet — in
  session-type terms an internal-choice widening, breaking old clients
  with zero schema diff. G3's own boundary excludes behavioural
  compatibility. Only executing something (flows, §9.2) catches these.

---

## 4. Precedents

Compressed to what transfers. Full sources in §14.

### 4.1 How providers version

| Provider | Unit & channel | SDK mapping | Support | The transferable fact |
|---|---|---|---|---|
| Stripe | Global, date-named; `Stripe-Version` header; account pinned server-side at first-ever request | Since 2024: SDK **minor** per monthly (guaranteed non-breaking) version, SDK **major** per biannual named release (acacia/basil/clover/dahlia); each SDK pins its version constant | Old dated versions served essentially indefinitely; old SDK majors frozen, not maintained | Every breaking change is one isolated, reversible "version change module"; responses generated against current schema, then transformed backward down the chain to the caller's pinned version. Old versions live at the edge, never in core code |
| Kubernetes | Per API group (`apps/v1`); version in every object | client-go minor locked to server minor; ±1 documented skew | GA effectively forever; beta expires 9 months/3 releases | The machine-checked invariant that makes permanence affordable: lossless round-trip between served versions through a storage version — i.e. G3's `full` profile between adjacent versions |
| Shopify | Global, quarterly, date in URL path (REST *and* GraphQL) | One SDK, many versions: `apiVersion` config enum, new entries quarterly; SDK semver independent | ≥12 months, ≥9 months overlap | Retired versions **fall forward** to the oldest live version silently — the anti-pattern: stale apps "work" until a payload difference bites. For self-hosted targets, loud failure beats silent drift |
| GitHub REST | Global, date header `X-GitHub-Api-Version`; default frozen at `2022-11-28` | Octokit hardcodes the header per release | Old version ≥24 months after successor | One version sufficed for ~3.5 years (first successor `2026-03-10`) — the machinery's value was the option, not the exercise. GHES is the cleanest documented old-backend/new-SDK case: hard 400/410, user pins the SDK's knob |
| Salesforce | Global `vNN.0` in path, 3/year, all versions served concurrently per org | No canonical generated REST SDK; SOAP clients generated per-version from WSDL | Stated 3 years; practice 11–16 years | Every org serves ~34 versions simultaneously, selectable per request — version mediation entirely server-side |
| Azure | Per service; **mandatory** `api-version` query param | Each stable SDK release targets one api-version | Preview: GA-or-die in 1 year; GA retired rarely | Unknown version ⇒ 400 `UnsupportedApiVersionValue` whose message **lists the supported versions** — discovery built into the error contract. Also the strictest additive rule anywhere: adding a response field within a version is breaking, because clients round-trip GET output into PUT |
| AWS | Effectively versionless; per-service `apiVersion` dates frozen for decades | SDK semver decoupled; **explicitly not strict semver** — documented risk tiers under daily regeneration | n/a — nothing is ever removed | Additive-only discipline enforced org-wide by smithy model checks. And the year's biggest skew event needed no API change at all (§4.4) |
| Slack | None — versionless by policy | SDK semver pure library versioning | Variable, scaled to impact | Staged in-band deprecation: response-payload warnings → errors for new adopters only → behavior change. The signal rides the payload, so it reaches never-updated SDKs |

### 4.2 The tooling landscape

- **oasdiff** — ~500 per-check IDs over raw OpenAPI, three tiers
  (ERR definite / WARN "cannot be confirmed programmatically" / INFO),
  **directional per check** (the same nullability change is breaking in
  a request and not a response), CI action, suppression files. The WARN
  tier is the industry's admission that spec-level breaking-ness is
  three-valued.
- **buf breaking** — the four-category strictness lattice
  FILE ⊃ PACKAGE ⊃ WIRE_JSON ⊃ WIRE: the only mainstream tool that
  formally separates "breaks the generated source" from "breaks the
  wire". `--against` any git ref/tarball/registry module. And the Buf
  Schema Registry has **no semantic versions at all** — content-
  addressed commits, mutable labels, push-time compat enforcement with
  a Pending/review/quarantine flow for intentional breaks. Doctor's
  content-over-versions doctrine, validated at industry scale.
- **Confluent Schema Registry** — BACKWARD / FORWARD / FULL each with a
  `_TRANSITIVE` variant; 409 at publish time. The load-bearing detail:
  the default (BACKWARD, non-transitive) checks only against the
  *latest* version, and non-transitive compat does not compose — a
  chain of individually-compatible changes can break consumers two
  versions back. Any `--against` verb faces the same choice.
- **Apollo GraphOS / GraphQL Inspector** — usage-aware verdicts:
  removing a field FAILS only if tracked operations in a window
  actually select it; with zero telemetry, all dangerous changes fail
  (maximally conservative). Sound only in closed ecosystems where all
  consumers report — for public SDKs the static verdict must remain
  the gate, and usage only ever *relaxes* it.
- **Pact Broker `can-i-deploy`** — the strongest precedent for
  "matching SDK versions to app versions", and it explicitly does NOT
  match numbers: a matrix of **executed verifications** per (consumer
  version, provider version) pair, gated per environment against what
  is currently deployed; `record-deployment`/`record-release` handle
  fleets where old versions stay live (exactly the SDK situation).
  A matrix without executed verifications is a database of unverified
  claims.
- **Language-surface diff → version bump, deployed practice:**
  Elm computes and *enforces* the bump at publish (and its own open
  issue #868 shows the flaw: enforcement is exact rather than a floor,
  so a type-invisible behavioral break cannot be declared major);
  cargo-semver-checks (242+ lints, stated zero-false-positive budget —
  "FPs are bugs" — with false-negative classes openly documented; an
  official 2026 Rust project goal to merge it into cargo);
  go apidiff/gorelease (with the field's clearest disclaimer: "no tool
  can detect behavioral changes; and even if it could, whether a
  behavioral change is breaking depends on … whether it closes a
  security hole"); japicmp/Revapi (Revapi's `update-versions` writes
  the computed next version into the pom); release-plz auto-bumps from
  cargo-semver-checks verdicts in ordinary CI.
- **smithy-diff** — the closest existing analogue to what an apidef
  differ should be: compares two *semantic models*, severities not
  booleans, suppressions read from the NEW model so exceptions are
  versioned with it — and the distinctive architecture: **trait
  definitions carry their own `breakingChanges` declarations**, so
  compat policy lives in the schema language's metamodel and the
  differ stays generic. AWS also tuned one evaluator (ChangedMemberTarget)
  to ERROR only when the change would cause codegen type errors —
  severity calibrated by consequence-for-generated-code, the exact
  two-layer concern sdkgen has.
- **TypeSpec versioning (Azure's endgame)** — `@added(v2)` /
  `@removed` / `@renamedFrom` decorators make version history part of
  the *source model*; per-version specs are projected, not diffed. The
  strongest precedent for putting versioning INTO the model language.
- **api-extractor** — no verdicts at all: a canonical committed API
  report file plus a CI staleness gate, so surface changes appear as
  ordinary reviewable git diffs. Industrial proof that
  canonical-committed-artifact + git diff is a viable compat process —
  which apidef's byte-stable output already is, lacking only the
  review convention and the staleness guard.
- **Optic** — the category leader, VC-funded, acquired by Atlassian
  4/2024, archived 1/2026. There is no durable standalone business in
  spec diffing; own the diff engine.

### 4.3 How SDK-generator vendors answer "where does the SDK version come from"

Nobody who does this well derives it from `info.version`:

- **Stainless** and **Google (GAPIC)** version the *generated code
  diff*: deterministic regeneration, auto-authored conventional
  commits (`feat(api):` vs `fix(client)` vs `chore(internal)`),
  release-please computes semver. Byte-stable output is the
  load-bearing enabler — git itself is the diff engine. sdkgen's
  `each()` sorted-key byte-stability is already the hard half of this
  architecture.
- **Fern** diffs its IR (`fern diff` → `{bump, nextVersion}`,
  deterministic, exits non-zero on major so CI can require review) —
  and classifies against the *full SDK output*, so a generator-version
  or config change moves the version with zero spec change. Fern's
  spec → IR → many-generators architecture is the closest to
  apidef → apimodel → targets; "diff the IR, not the spec" is its most
  transferable idea.
- **Speakeasy** computes the bump from three independent inputs — spec
  checksum, config checksum, generator feature list in `gen.lock` —
  and takes the max. It is the only vendor that reads `info.version`
  at all (as a hint, checksum fallback), and its own field data
  condemns the field: real gen.lock files across novu / mistral /
  hookdeck / formance show `docVersion` frozen at `0.0.1`/`1.0.0`
  while `releaseVersion` advances to 7.0.0. **Spec version fields are
  socially dead; checksums and diffs drive real versioning.**
- **Stripe (first-party)** re-couples them — SDK major per biannual
  API release, pinned dated constant sent on every request — which
  works *only* because the server honors per-request date pinning.
  Coupling is either naivety (OpenAPI Generator's
  `artifactVersion ← info.version` default) or a luxury.
- **Kiota** dissolves SDK versioning: generate in the consumer's CI,
  the client is source in the consumer's repo, versioned by the app;
  `kiota-lock.json` records a `descriptionHash` + generator version +
  all parameters — content identity again. sdkgen's consumer `.sdk/`
  directory is already this mode, which is why versioning tooling must
  live in the generation pipeline, not a publishing service.
- **OpenAPI Generator** (the incumbent) is the cautionary tale on both
  axes: SDK version defaults to `info.version`; no diffing, no bump
  computation; regeneration overwrites everything
  (`.openapi-generator-ignore` is even deleted by `cleanupOutput`);
  and **forward-incompatible closed enums by default** — the safety
  flag `enumUnknownDefaultCase` is opt-in, unimplemented in some
  generators (Python request open), and broken in others (dart-dio,
  php-nextgen) because per-language degradation is not corpus-tested.
  sdkgen's parity-tier discipline is precisely the missing ingredient.

### 4.4 Runtime machinery

- **The converged robustness checklist** (every serious vendor):
  open enums preserving the raw wire value (AWS `UNKNOWN_TO_SDK_VERSION`
  + `fromValue()` + `...AsString()`; Stainless's Java `_UNKNOWN`
  wrapper; Speakeasy's typed `Unrecognized<string>`; proto3 open
  enums); unknown-union-variant capture (`{type: "UNKNOWN", raw}`);
  extra-fields capture/preservation; undocumented-endpoint escape
  hatch (`client.get/post` reusing auth/retry config); raw response
  access (Stripe's `lastResponse`). Validation posture is the fault
  line: Stainless never validates responses; Fern throws by default;
  Speakeasy validates but ships lax forward-tolerant types — "strict
  in development, lax in production" is the emerging consensus.
  One corner even the gold standard fails: AWS Java v2 silently
  **drops** map entries whose enum *keys* are unknown — an open-enum
  design for 20+ languages needs an explicit answer for enums in key
  position.
- **Version-mismatch errors** — MongoDB's handshake error is the gold
  standard: *"Server at X reports maximum wire version 5, but this
  version of the driver requires at least 6 (MongoDB 3.6)"* — names
  what the server reported, what the client requires, and the fix,
  detected at handshake before any operation half-succeeds.
- **Negotiation** — Kafka: `ApiVersionsRequest` per connection, broker
  answers (min,max) per RPC, client downgrades each request to the
  highest common version; the bootstrap trick that the negotiation
  channel itself can never version-lock (a too-new request gets
  version 0 of the response, which every client ever shipped
  understands); KIP-511 client name+version telemetry as broker
  metrics; net result, 2018 clients work against 2025 brokers, then a
  telemetry-informed cutoff (4.0/KIP-896). MCP (2025) re-learned the
  echo lesson within months: clients sending their favorite version
  instead of the *negotiated* one broke real servers — version echo
  discipline must live in generated code.
- **Deprecation at runtime** — RFC 9745 (`Deprecation`, a structured
  Date that may be in the *future* — an announcement channel; final
  March 2025) and RFC 8594 (`Sunset`, HTTP-date; Deprecation ≤ Sunset)
  have producer-side linters (Zalando makes emission and
  monitoring-before-sunset a MUST) and **essentially zero consuming
  clients in the wild**. Every system that surfaces deprecation at
  call time invented its own channel first: Kubernetes `Warning: 299`
  headers + client-go's pluggable, default-on, deduplicated
  `WarningHandler` (with kubectl's `--warnings-as-errors` escalation);
  Elasticsearch's compat-mode deprecation log; Slack's baked-in
  deprecated-method list firing `warnings.warn()` at call time even
  offline, *plus* in-payload warnings that stay current without an SDK
  release. The consumer side of the RFCs is an open niche a
  20-language generator can own.
- **Telemetry closes the sunset loop** — AWS runs a full telemetry
  pipeline inside the User-Agent: a versioned grammar (`ua/2.1`),
  `api/{service}#{version}`, per-request single-letter feature codes
  (`m/E,G`, 1024-byte cap), `app/{id}` attribution — no separate
  endpoint or consent flow. Stripe splits human UA from
  machine-parseable `X-Stripe-Client-User-Agent` JSON. Apollo's
  client-awareness headers gate field removal on observed usage
  reaching zero. Every provider that retires versions safely spent
  years on client-version telemetry first. Caveat from Elasticsearch:
  the telemetry header itself is a compat surface (its rollout broke
  third-party transports).
- **Client defaults are a compat surface** — the biggest SDK-compat
  outage of 2025 involved no API change, no version bump, no spec
  change: AWS SDKs flipped a default (automatic CRC32 request
  checksums, Jan 2025) and broke MinIO, Backblaze, Cloudflare R2, and
  S3A users. Every remedy was an SDK-side knob
  (`request_checksum_calculation = WHEN_SUPPORTED | WHEN_REQUIRED`).
  In any regime, generated-client defaults are part of the version
  surface.
- **Channels** — for machine-to-machine generated clients: custom
  header wins (GitHub/Stripe), query param is operationally simplest
  (Azure), path forces whole-API cliffs, media-type (Elasticsearch
  `compatible-with=8`) is HTTP-correct but tooling-hostile. The cache
  argument against headers is real but shrinking (Cloudflare only
  implemented standards-compliant Vary-based caching on 2026-07-02)
  and irrelevant for authenticated API traffic. Always send the
  version explicitly rather than relying on server defaults (Stripe's
  pin-on-first-request account default is exactly the implicit state a
  generated SDK should override).
- **Capability discovery** — earns its keep only where multiple server
  versions are simultaneously deployed (self-hosted: Kubernetes
  discovery API, MongoDB handshake, Kafka, GHES). A single-version
  SaaS needs only: a supported-versions endpoint (GitHub's), a version
  echo header, and typed 400s listing supported versions (Azure).
  Skip the bespoke capabilities protocol; generate the probe helper.

---

## 5. Design principles (distilled)

1. **Content over declared versions, corrected.** Doctor's doctrine,
   validated by Buf's registry and Kiota's lock file — but the hash
   must be of a *normalized, edits-excluded projection* (§6.4), and
   the record keeps hash AND declared version AND toolchain versions,
   because hashes are unordered and cannot express "newer", ranges, or
   support windows.
2. **Direction is per-role, not per-document** (§3.1). Requests and
   responses get opposite subsumption arrows, applied automatically.
3. **Verdicts are three-valued, with witnesses.** `undecided` is
   honest and mandated (§3.2); the witness doubles as the failing test
   case. Never promote `undecided` to blocking silently; fail-closed
   with a reason code and a downgrade flag (G3's `--allow-undecided`
   shape).
4. **Two verdicts, not one:** wire-breaking (model diff) and
   surface-breaking (per-target language surface) — buf's lattice
   projected onto sdkgen's template/component split. An entity rename
   is wire-irrelevant and renames classes in 20+ languages; a
   constraint change can break the wire with zero surface change.
5. **Computed bumps are a floor the author can raise, never a ceiling
   and never a truth** (Elm #868; go apidiff's disclaimer). If publish
   is ever human-free, an under-computed bump ships a silent breaking
   change under semver guarantees — the review gate question (§12.5).
6. **Compat class depends on the deployed SDK's feature set.** Removing
   a response field is breaking against a strict SDK and a minor
   against a tolerant reader with preserved extras. The classifier
   (§7) must know what the robustness feature (§8) shipped; they are
   coupled workstreams, not independent ones.
7. **Tolerant reader, strict writer, per RFC 9413's split** (§3.3):
   tolerance of spec'd extensibility mandatory; tolerance of malformed
   known content forbidden; must-*preserve* for read-modify-write.
8. **Fail loud on version skew** for self-hosted targets (Shopify's
   silent fall-forward is indefensible without vendor telemetry
   watching for drift); absorb routine skew silently only where
   negotiation exists (Kafka), warn where a channel exists (k8s).
9. **Every finding transform-shaped, not prose-shaped:** (path, old
   shape, new shape, direction). A Stripe version-change module is "a
   witness of non-subsumption plus a repair function"; G3's witness is
   the machine-readable half. Even if mediation is never built, the
   report format should permit it (station as the mediation point is
   an open question, §12.2).
10. **One rule, one place.** The stamp (§6.2) is written by one helper
    and consumed everywhere, or it becomes the next
    PROJECTVERSION-added-to-the-writer-alone incident
    (`helpers/stdrep.ts:34-39`).

---

## 6. Phase 0 — model fidelity and identity plumbing

Buildable now; everything later depends on it. The adversarial pass's
sequencing correction is accepted: compat tooling was initially
sequenced before model fidelity, and the dependency runs the other way
— a differ cannot flag what the model never saw.

### 6.1 Parse what the compat story needs (apidef)

- **`deprecated`** — from OpenAPI (currently unparsed) and GraphQL
  (parsed but only filtering) into a model data field
  `deprecated: {msg?, use?, since?}` on operations and fields. Plain
  data, richer than OpenAPI's boolean, isomorphic to Smithy's
  `@deprecated {since, message}` and to aontu's designed `deprecate()`
  record — deliberately NOT waiting for the aontu builtin (§10.2).
- **Enums** — currently dropped entirely (no enum handling in
  `ts/src/transform/*`). There are no closed enums to "open" (§8.1)
  until the model sees enums. Model them as value lists on the field.
- **Error responses** — `transform/field.ts:221-343` reads only
  `responses['200'|'201']` with `application/json`. Every 4xx/5xx body
  shape, problem+json adoption, status-code semantics, response
  headers, and non-JSON content type is dropped before the model
  exists — the entire error contract is invisible to any model-level
  diff, and the error contract is precisely what breaks deployed apps'
  catch-paths. Add per-status response schemas to the model (or accept
  the parallel-lane mitigation in §7.4 permanently).
- **Auth beyond the single-apikey reality** — `transform/top.ts`
  `resolveSecurity` models only the primary scheme; scheme changes
  (apikey→OAuth2, scope additions, header→query relocation) are
  simultaneously wire-breaking (401s indistinguishable from bad
  credentials) and constructor-breaking, and invisible today. oasdiff
  treats security-scheme removal as a first-class check; the model
  cannot represent it.
- Also in this bucket eventually: `oneOf`/`anyOf` completeness,
  formats/patterns/min-max (currently dropped — and the future
  substrate for aontu constraint atoms, §10.1), `servers[]` variables,
  callbacks/webhooks (§11.3).

### 6.2 The stamp block (sdkgen)

One helper computing, from the model plus the environment:

```
{ sdkVersion,        // publish.version for this target
  apiVersion,        // info.version, verbatim, unvalidated
  modelHash,         // §6.4 normalized projection hash
  sdkgenVersion,     // generator version (SDKGEN_VERSION)
  targetLang }
```

Consumed by — and only via the helper, per principle 10:

- **The user-agent**, replacing the 20+ hardcoded `'0.0.1'`s in
  clienttrack. Grammar (AWS `ua/2` + Speakeasy precedent), versioned
  so the format itself can evolve:
  `{ProjectName}-sdk-{lang}/{sdkVersion} ua/1.0 api/{apiVersion}
  model/{hash8} gen/{sdkgenVersion} lang/{lang}#{runtimeVersion}`.
  The `clientVersion` runtime option remains as an app-level override,
  but the default stops being a lie. This is the observability
  substrate for every sunset decision an API operator will ever make,
  and it costs one template line per language.
- **A generated constants file** per language (`ApiVersion`,
  `SdkVersion`, `ModelHash`) — Stripe's pinned-constant pattern.
- **The embedded `configDefinition`** — the station design's proposed
  `main.version`, extended.
- **The version request header** (§8.4) where enabled.
- Doctor's replacement maps (`templateReplacements`) — writer and
  checker share the definition, as PROJECTVERSION now does.

### 6.3 The generation ledger

A recorded manifest per generated SDK (gen.lock / kiota-lock
precedent): model hash, apidef version, sdkgen version, per-package
versions (from `package list`'s installed set), target, computed
`sdkVersion`, timestamp. This is doctor's provenance discipline
extended to the API axis, and it is the prerequisite for ever
**regenerating an old SDK major** to security-patch it — today old
majors are unreproducible because nothing pins generator versions per
published line (§11.6). It also answers where the computed version
*lives* under add-is-overwrite: in the ledger and the model, never
only in generated output (the defect `model/sdkgen.aontu:320-334`
documents — every manifest emitter hardcoding `'0.0.1'` — must not
recur one level up).

### 6.4 The hash, corrected

"Model hash is the API identity" is wrong as first drafted, on the
ecosystem's own documented semantics: the on-disk model is
merge-preserving and *meant to be edited*
(apidef `docs/explanation/the-internal-model.md`), and guide overrides
persist. The apimodel is therefore
`spec ⊕ human edits ⊕ apidef-heuristic-version`: two consumers of the
same spec get different hashes, and an apidef upgrade changes the hash
with zero API change. Corrections:

- Hash a **normalized, edits-excluded projection** of the model
  (entities/ops/fields/types/req/deprecated — the semantic surface;
  no `why_*` traces, no titles, no provenance comments). This
  projection is also §10.1's constraint form — one artifact serves
  both.
- Record the hash **alongside** `info.version` (untrusted but the only
  human-meaningful ordering signal) and the toolchain versions, never
  instead of them.
- Note for aontu G6: this is the same normalization problem semantic
  canon hashing has (`number|integer` vs `number`); when G6's
  `canonHash` exists it replaces the interim sha256-of-projection with
  a strictly better artifact. The interim hash should be clearly
  labelled as a canonical-*text* hash of the projection.

### 6.5 Housekeeping (do regardless)

- Fix `helpers/manifest.ts:57-63` ("nothing reads this range" — false
  since the engine gate landed).
- Fix or implement `go/apidef.go:14-17`'s claimed TS `VERSION` export.
- Reconcile `cmp/Deploy.ts:208-209` (lockstep tag) with the per-target
  `publish.version` design — the tag should read the model's
  per-target version via the stamp, not the ts manifest.
- Document `info.version` in `model/apidef.aontu` with its actual
  consumer note once §6.2 gives it one.

---

## 7. Phase 1 — `apidef breaking`: the diff gate

A domain-aware structural differ over the byte-stable apimodel — which
was *designed* for this ("byte-stable so drift shows in git diffs");
api-extractor proves canonical-committed-artifact-plus-git-diff works
as a compat process, and apidef already emits the artifact. **No aontu
dependency** (see §10.2 for why that is deliberate).

### 7.1 The verb

```
apidef diff     <old-model-dir> <new-model-dir>       # full changelog
apidef breaking --against <dir|git#rev> [--against …] # gate
```

- `--against` repeatable (Confluent's transitive lesson: the honest
  target set is "all revs with SDKs still in the field", i.e. release
  tags, not just HEAD~1).
- Exit classes mirroring G2/G3's convention: 0 compatible, 1 breaking,
  3 undecided (fail-closed, `--allow-undecided` downgrades), 4 engine
  error, 2 usage.
- Baseline convention (cold start): the committed apimodel in the
  consumer repo IS the baseline — the merge-preserving workflow
  already encourages committing it; document that as the convention
  and add an api-extractor-style staleness check (CI fails when the
  committed model is stale relative to the spec) as the first, trivial
  hook.

### 7.2 Classification

At the model's own granularity: entity added/removed/renamed*, field
added/removed/retyped, `req` flipped, enum value added/removed,
default changed, op added/removed, deprecated added/removed, auth
scheme changed. Three imported design rules:

- **Role-split direction** (§3.1): request-side and response-side
  changes get opposite arrows automatically. The model knows which
  fields participate in which direction per op.
- **Directional severity per rule** (oasdiff): e.g. enum value ADDED
  is safe in a request field, dangerous in a response field (it may
  widen a flow's status alphabet — §9.2); `req: false → true` is
  breaking on requests, safe on responses; field REMOVED is breaking
  on responses, safe on requests (Avro's rules, §3.2).
- **\*Rename detection is honest about its limits:** without stable
  identity, rename is formally indistinguishable from remove+add
  (breaking). The model's canonical-vs-orig dual naming and
  `rename.param` maps give partial rename evidence; the principled fix
  is aontu G4's identity mark (protobuf field numbers by another name
  — §10.3). Until then, a rename heuristic may *downgrade* to WARN
  with evidence, never silently pass.

### 7.3 Attribution — or the verdicts are unactionable

Every finding must be attributed to
`{spec change | heuristic change | human edit}`. This is the
guide-stability risk sharpened by the critique pass: not only path
classification — `inferFieldType` (apidef `utility.ts`) guesses field
types from name regexes, entity naming rides a curated depluralization
table, and all of it shifts under apidef upgrades with zero spec
change. **A compat gate that fires on apidef upgrades will be
blanket-suppressed within a month.** Mechanism: re-run the OLD apidef
version's pipeline output (from the ledger, §6.3) vs the NEW version's
over the same spec to isolate heuristic drift; diff the committed
model vs a fresh regeneration to isolate human edits. Corollary:
apidef's heuristics themselves need a compat contract — a guide
decision that reclassifies an existing path is a breaking change *of
apidef* and belongs in apidef's own changelog gate.

### 7.4 The parallel lane

Until §6.1's error/auth enrichment lands, run **oasdiff on the raw
specs as a complementary CI lane** — it covers today, for free,
exactly what the apimodel is blind to (security schemes, per-status
responses, callbacks). The apimodel differ does not replace the
spec-level gate until the model sees what oasdiff sees. (Do not build
on Optic; it is archived. Own the engine long-term — §4.2.)

### 7.5 The bump computation

`breaking → major, additive → minor, else patch` — as a **floor**,
**per target**, from **three inputs** (Speakeasy's max-bump-wins; Fern
full-output classification):

1. the model diff verdict (wire axis),
2. the per-target surface diff (an additive model change can be
   surface-breaking in specific targets: Go positional struct
   literals, Rust match exhaustiveness, name collisions with existing
   classes or keywords) — measurable mechanically by regenerating into
   memfs (`generate.test.ts` already stages this) and diffing, or by
   compiling pinned consumer snippets against the new SDK,
3. the generator fingerprint (template/component changes move the
   surface with zero spec diff — Fern's cleanest-in-industry answer;
   liblab's per-language generator pinning is the manual fallback).

Cheapest first increment (Stainless/Google shape): don't build a
bespoke version calculator — emit a **classified changelog entry**
(`feat`/`fix`/`breaking`, from the verdict) on each regeneration into
the seeded `CHANGELOG.md`, and let release tooling do the arithmetic.
If consumers regenerate continuously, don't promise strict semver you
can't keep (AWS's honest posture): G3-gated semver for deliberate
releases, machine-readable risk classification for HEAD-trackers.

### 7.6 Publish-time teeth

Advise in CI, enforce at the moment content reaches consumers
(Confluent's 409, Buf's push→Pending→review): sdkgen's publish moment
is `package add` / regeneration into a project, and doctor is already
the comparison engine. Missing pieces: a verdict that can block or
quarantine, and a **recorded approved-breaking-change artifact**
(Buf's review flow, Azure's suppression files, smithy's
suppressions-in-the-new-model) so an intentional break is not
re-flagged forever. Azure is the cautionary tale of the opposite
budget: a blocking check with false positives spawned a suppression
bureaucracy and a human review board. Adopt cargo-semver-checks'
budget for anything that blocks: zero false positives as a stated
goal, false negatives openly documented, undecidables to WARN.

---

## 8. Phase 2 — the `compat` feature: robustness in generated SDKs

A feature-system citizen (clienttrack is the precedent): model-
configurable, template-tier where language-independent, component-tier
where shape-dependent, **parity-tested** (§8.8). The current accidental
posture is tolerance-by-omission (generated response validation is
largely commented out — `PrepareParamsUtility.ts`); this phase makes
the posture chosen, stated, and tested — noting that any future
*strictness* (validation on, version asserted) is itself the breaking
change to running apps, and ships behind flags.

### 8.1 Open enums, everywhere, with the raw value

Pass-through where the language's types are open (TS unions widened
with `string`, Python `Literal` — Stainless's position);
UNKNOWN-member + `fromValue()` + `asString()` where closed
(Java/Kotlin/Swift/Rust/C#/Go — AWS semantics: excluded from
known-values enumeration, raw string always reachable). Decide the
**enum-as-map-key** corner explicitly (AWS silently drops such
entries; options: string-keyed map with typed accessor, or preserved
side-bag). Requires §6.1's enum modeling first.

### 8.2 Unknown fields: ignore AND preserve

Ignored, never fatal; **preserved** for round-trip on every entity
model, because the generated SDKs do read-modify-write update flows
(proto3's 3.5 reversal, §3.3). Language mechanism varies (extra-bag
member, `model_extra` dict, side map); the parity row (§8.8) pins the
observable behavior, not the mechanism. Azure's GET-then-PUT hazard is
the reason "never round-trip what you don't preserve" is a correctness
rule.

### 8.3 Strict writers

Send only modeled fields; fail loudly on locally-invalid known content
(RFC 9413's other half). No client-side echo of unknown *request*
fields.

### 8.4 The wire beacon and the skew error

- Send the version header (`X-{Project}-Api-Version: {apiVersion}`,
  from the stamp) on every request, behind a model flag defaulting on.
  Define absent-server behavior first: no existing backend in this
  ecosystem sends or checks any version header, so assertion is theater
  until servers participate — the generated README carries the
  server-side recommendation (Azure's typed 400 listing supported
  versions; GitHub's meta endpoint; echo header on responses).
- A generated **probe helper** (hello/version endpoint call if the
  model declares one; parse version/deprecation response headers when
  present). Full negotiation (Kafka/MCP style) only if self-hosted
  backends become a first-class target — and then the MCP lesson: the
  negotiated version must be echoed by generated code on every
  subsequent request.
- Version-mismatch errors in MongoDB's shape: what the server
  reported, what this SDK was built against, the concrete fix. A
  structured error code family in every language (the station
  `station_protocol` design is prior art *as policy* — accept N/N−1,
  structured rejection — but it versions the station wire protocol,
  a different layer; the SDK↔API taxonomy is its own).

### 8.5 The deprecation consumer nobody has built

Two channels, disjoint populations:

- **Runtime:** parse `Deprecation` (RFC 9745), `Sunset` (RFC 8594),
  and `Warning: 299` on every response; surface through a
  client-go-style handler — default-on, log-once deduplicated,
  pluggable sink, escalate-to-error option. This is the only evolution
  signal that reaches already-deployed clients.
- **Build time:** the model's `deprecated` marks (§6.1) become native
  annotations in every target — `@Deprecated`, `#[deprecated]`,
  `[Obsolete]`, `@available(*, deprecated)`, JSDoc/TSDoc
  `@deprecated`, Go `// Deprecated:` — plus the Slack pattern: the
  deprecated-operation list baked into the client fires a warning at
  call time even offline. IDE strikethroughs in 20+ languages from one
  model field; the cheapest genuinely idiomatic multi-language feature
  available (Speakeasy already ships the JSDoc half).

Deprecation needs the retirement half or surface accretes forever:
machine-readable removal dates (`x-sunset` in the spec, Sunset at
runtime), and the differ's downgrade rule — removing an
already-deprecated element warns instead of breaking (G3 designed
`--allow-deprecated-removal`; the apidef verb mirrors it).

### 8.6 Escape hatches

Raw request/response access; undocumented-endpoint calls reusing auth,
retry, and options; per-request extra headers/query/body params.
(Stripe `rawRequest`, Stainless `client.get/post`, Fern raw response —
universal among serious vendors.)

### 8.7 Defaults are versioned behavior

Any generated-client default that changes wire behavior (new header
sent, new validation performed, retry semantics) gets a
`WHEN_SUPPORTED`/`WHEN_REQUIRED`-style knob in every language and a
breaking-change entry in the *generator's* changelog (the AWS S3
checksum incident, §4.4 — the SDK's compat envelope is part of the
generator's semver, which is exactly input 3 of §7.5).

### 8.8 Parity corpus rows (GREASE for SDKs)

New rows in the zero-case corpus that **every target must pass**:
server sends unknown enum value; server sends unknown field (and it
survives a read-modify-write round-trip); server sends unknown union
variant; server sends Deprecation/Sunset/Warning headers (handler
fires once); version-mismatch error shape. This is the discipline
whose absence makes OpenAPI Generator's forward-compat flag broken in
practice (§4.3), and it is what keeps station §8.6's "unknown fields
ignored" true mechanically instead of by hope.

---

## 9. Phase 3 — the matrix: matching SDK versions to app versions

The direct answer to "how should we match SDK versions to app
versions": **don't match by numbering convention at all.** SDK-2.x ↔
API-2.x correspondence rots immediately (Pact's inversion, §3.4;
Kubernetes' matrix and Stripe's calendar coupling are the two
disciplined exceptions, and each requires infrastructure — a skew
policy with conversion machinery, or server-side date pinning).

### 9.1 The record

Every SDK **stamps what it was built against** (§6.2/6.3). The matrix
is then a table of rows

```
(target, sdkVersion, modelHash, apiVersion/appVersion, verifiedBy, when)
```

marked verified only by an **executed verification** — a matrix
without executed verifications is a database of unverified claims
(Pact's own design point). `can-i-use` queries gate: "does a verified
row exist between this SDK version and every backend version currently
deployed" — with the fleet reality that many old SDK versions stay
live (`record-release` semantics, not just `record-deployment`).

### 9.2 Flows are the verification engine — the ecosystem's native Pact

The constructive finding of the adversarial pass, and the piece the
ecosystem already owns: apidef emits **flows** — executable behavioral
expectations per entity (create → list → update → load → remove with
assertions) that generate into every SDK's test suite. Running the
**old** SDK's flow suite against the **new** server IS the
verification step, and it is the *only* mechanism in this design that
catches same-schema-different-semantics breaks — which subsumption
structurally cannot see (§3.5; G3's boundary says so itself). Flow
diffing also gets the session-type rule (§3.2): operations old clients
may call must keep existing and accepting old inputs (external choice
widens); server-emitted states per step must stay within the old
alphabet (internal choice narrows) — a new status enum value that
drives a generated polling loop is a breaking change no schema check
will flag. Flows exist today, making this the cheapest cold-start
deliverable of the whole matrix.

### 9.3 The consumer contract artifact

Emit the generated SDK's exact used subset (operations emitted, fields
bound) as a machine-readable generation artifact (§3.4). The differ
then reports two tiers: "breaking in principle" (full-model) vs
"breaks these SDKs" (used-subset) — the second gates releases.
Usage-aware narrowing beyond that (Apollo-style "no live client reads
this field") requires telemetry (§8's UA) and is only ever a
*relaxation* of the static verdict, never the gate, because public
SDKs have unobserved consumers.

### 9.4 Station, if it runs attached in production

Station sees wire truth across every SDK and language (transport-wrap
events, capture store). If it runs in production (open question
§12.2), it is the third verification engine and the runtime half of
this design: observed (sdkVersion, apiVersion) pairs feeding the
matrix (cheaper and truer than pre-verification), drift alarms
(unknown-field observations, post-deploy 4xx spikes), Sunset-header
surfacing, and — furthest out — the mediation point where
transform-shaped breaking findings (§5.9) compile to adapter config
(Stripe's version-change-module chain; Kong/APIM transformers are the
commodity form). The station descriptor should carry the model hash
either way.

### 9.5 Cadence

Stripe-style calendar coupling (SDK major per named API release,
pinned constant) is the cleanest mapping in the industry and is
available **only** to producers whose server honors per-request
version pinning — offer it as a model flag for that minority. The
defensible default for everyone else is decoupled diff-computed semver
(§7.5) plus the stamp. Support windows are product policy the tooling
merely records (observed range: 9 months to 16 years); carry
supported-versions metadata in the model so generated SDKs and doctor
can self-report staleness, and adopt Stripe's maintenance posture for
a 20-language matrix: old majors are **frozen**, not maintained —
which is only safe if old API versions stay served, and only possible
at all with §6.3's ledger (regenerability).

---

## 10. Aontu: the principled engine, and what it actually needs

### 10.1 The gap that matters: the apimodel is data, not schema

G3's design is validated from every direction the research looked —
three-valued verdicts with witnesses are what oasdiff (ERR/WARN/INFO),
GraphQL Inspector (breaking/dangerous/safe), smithy-diff
(ERROR/DANGER/WARNING/NOTE), and CUE independently converged on, and
`aontu breaking --against git#rev` lands exactly on the
industry-standard semantics. **But** — verified against the fixtures
(`ts/test/solar/entity/…planet.aontu`) — apidef emits concrete aontu
*data*, not aontu *constraints*: `fields` is a list of records with
`req: true` as a data flag and `` `$STRING` `` tokens as string
values. Under G3's own rules a scalar subsumes only itself, so
`subsume(newModel, oldModel)` over two such trees degenerates to
equality-with-noise: every changed title or trace reports as
non-subsumption, and "optional field" has no lattice meaning.

**The missing artifact is a constraint-projection builder in apidef:**
a builder emitting the apimodel (or a companion projection) in aontu
constraint form —

```
planet: close({
  id:       string
  name:     string
  diameter: number
  forbid?:  boolean
  state?:   "solid" | "liquid" | "gas"     # enums as disjunctions
  kind:     *"planet" | string             # defaults as *
})
```

— fields as types, optionality as `?`, enums as disjunctions, defaults
as `*`, closedness where the spec declares it, per-operation
request/response schema pairs. Once that exists: G3's `subsume` is
meaningful over real API schemas; G6's semantic canon hash has a real
substrate (and §6.4's normalized projection falls out of the same
artifact); G2's `vet` can validate live payloads against the API's
actual shape (runtime drift detection); and future spec constraints
(formats, patterns, min/max — §6.1) map directly onto G1's constraint
atoms (`re`, `min`, `max`, `length`), which have landed. This builder
is unplanned in both repos' roadmaps and is the single most important
new piece of design work this question surfaced.

### 10.2 Sequencing honesty

G3 phases 0–3 are NOT STARTED; G2's `vet` (which G3's CLI depends on)
does not exist; G6 is untouched and its design *consumes* G3 — the
furthest-out dependency. Routing the ecosystem's compat story through
aontu today couples it to the tail of an eight-phase roadmap. The plan
above therefore front-loads a bespoke differ (§7) that ships with no
aontu dependency, and assigns it a second job: **differential-testing
oracle** for the subsumption-based version when it lands (G3's
spec-rows-first method wants exactly such an oracle; its own design
retains derive-from-unification as an oracle where sound). This is not
an argument against the aontu route — the lattice version is strictly
better where it applies (computed relation vs curated rule catalogue,
located witnesses, default-awareness: the things the null-hypothesis
trap says JSON-Schema diffing and buf structurally cannot do). It is
an argument for building both, in that order. Similarly §6.1's
`deprecated` is plain model data now, migrating to the `deprecate()`
mark when G3 phase 4 lands; §6.4's hash is sha256-of-projection now,
migrating to `canonHash` when G6 lands.

### 10.3 Notes to file against the aontu capability review

Amendments the research motivates, recorded here for transfer into
the G-docs (per aontu's register protocol, in the commits that act on
them):

1. **G3 — role-split direction.** The endpoint-level backward check is
   two subsume calls with opposite arrows (§3.1). G3 frames direction
   per-document (`backward = new subsumes old`); add a reader/writer
   role axis to the profiles, or document that the *caller* (apidef)
   is responsible for orienting each call. oasdiff encodes
   request-vs-response variance per check; Confluent's
   BACKWARD/FORWARD are reader/writer directions.
2. **G3 — the transitive dimension.** `--against` should accept
   multiple refs and a "all tags since X" form; non-transitive compat
   does not compose (Confluent's default-mode footgun), and the honest
   target set is every rev with SDKs still deployed. G3's design
   already makes `--against` repeatable ("the manual transitive form
   until G6"); promote that from remark to requirement.
3. **G3 — rules on the construct, not (only) in the checker.**
   smithy-diff's trait definitions carry their own `breakingChanges`
   declarations, so new metadata teaches the differ. G3's boundary
   rejects "buf-style configurable rule packs" — rightly — but
   smithy shows a middle path consistent with the lattice: model
   *vocabulary* (e.g. a future ports/relations stdlib, G4) declaring
   its own subsumption consequences.
4. **G3 — subsumption is necessary, not sufficient.** AIP-180's
   resource-commitment cases (constraint *relaxation* breaking
   provisioned clients) and behavioral breaks (G3's own boundary) mean
   a `breaking` verdict of "compatible" needs a documented residual-
   risk statement. The `gen` profile covers part; flows (§9.2) cover
   the rest, outside aontu.
5. **G4 — identity marks are protobuf field numbers.** Without stable
   identity every rename diffs as remove+add (breaking); with it,
   rename detection is trivial, reserved-style tombstones prevent id
   reuse, and the G6 hash gets a spine that survives renames. Avro's
   aliases are the retrofit proving the need; protobuf's caveat
   transfers too — the benefit exists only in encodings that carry
   the identity (generated-code identifiers still break on rename,
   which is the wire/surface split of §5.4 again.)
6. **G3/G6 — the witness is half a version-change module** (§5.9):
   specify the finding format as (path, old shape, new shape,
   direction) so findings can compile to mediation transforms, not
   only fail CI.
7. **Already-landed prerequisite, for the record:** G1 phase 0's
   subsumption table exists (`docs/reference-language.md`,
   "Subsumption"), with `re` and `must` approximations failing toward
   "not subsumed" — the safe direction for this use. G3 phase 0 is
   unblocked. `PrefVal` now carries two yardsticks
   (`superpeg`/`familypeg`) since the number tower; a
   defaults-profile rule written to the one-yardstick text would be
   wrong (the register already notes this).

---

## 11. Surfaces this design does not yet cover

Named so silence doesn't read as coverage:

1. **The error contract** — until §6.1 lands, mitigated only by the
   oasdiff lane (§7.4).
2. **Auth/security-scheme evolution** — same status.
3. **Webhooks/callbacks** — direction inverts: the server is the
   producer and the app's handler — which sdkgen does not generate —
   is the consumer, so §3.1's rule doesn't cover it and the SDK isn't
   the artifact at risk. Stripe's field data says webhooks are where
   version skew actually bites generated SDKs (events carry the
   *endpoint's* pinned version, not the caller's — typed SDKs threw on
   event parsing). Either model event payloads or declare the surface
   out of scope explicitly.
4. **Behavioral contracts with zero schema footprint** — pagination
   semantics (the paging feature is client config; page→cursor
   migration is a zero-diff break), sort/filter meaning, rate-limit
   policy (the ratelimit feature is a client-side token bucket;
   server 429/Retry-After policy is a contract with no
   representation). Flows only.
5. **GraphQL's regime** — versionless additive evolution with
   usage-gated removal is a *different* compat model the pipeline also
   ingests; the deprecation plumbing should actually start there
   (parsing exists), and schema-drift detection for GraphQL is an
   already-recorded open risk (apidef
   `docs/design/graphql-ingestion.md`, "Schema drift") that this
   document generalises.
6. **Operational cost of N majors × 20+ languages** — real bill
   (Stripe sustains ~7 languages with a dedicated team). Mitigations
   in-design: frozen old majors (§9.5), ledger-backed regenerability
   (§6.3). Unaddressed: per-major docs, registry namespace churn,
   parity-suite cost multiplication.
7. **The migration story when an SDK majors** — the model's
   canonical-vs-orig naming and rename maps are machine-readable
   rename data nobody consumes; a classified diff can emit a
   per-language migration manifest (for humans as a changelog, or for
   agents as a change manifest — question §12.7). G3 punts rewriting
   to G7 and rename identity to G4; if this matters it is built
   ecosystem-side.
8. **Multi-tenant version topology** — one app build talking to
   several backend versions simultaneously means the API version is
   *runtime state*, not a build-time constant; per-connection version
   config in generated SDKs is unexamined.

---

## 12. Open questions

Answers change the design; roughly in leverage order.

1. **Who is the sdkgen user for this story — API producers shipping
   SDKs for their own API, or consumers wrapping third-party APIs?**
   Producer ⇒ spec-diff CI gate, release trains, sunset workflow,
   possibly Stripe-style pinning dominate. Consumer ⇒ tolerant
   readers, drift detection (scheduled spec re-fetch + diff alarm),
   and guide stability dominate; computed publish-semver of a private
   SDK is nearly worthless. Every phase above implicitly weights the
   producer; §8 weights the consumer.
2. **Does voxgig-station run attached in production at customer
   deployments, or is it a dev tool?** Production ⇒ it is the
   telemetry/mediation point and the matrix feeds from observed
   traffic (§9.4). Dev-only ⇒ all runtime robustness lives in §8 and
   the matrix needs the flow-based CI engine only.
3. **Are human edits to the emitted model and `base-guide.aontu` a
   permanent supported workflow or a stopgap?** Permanent ⇒ the hash
   can never be "the API identity" and attribution (§7.3) is forever.
   Stopgap ⇒ a pure normalized projection can eventually be frozen and
   the content-identity doctrine becomes fully sound.
4. **What release topology must be supported** — concurrent API
   versions per customer, support window per SDK major, calendar
   trains vs ad-hoc? Decides Stripe-style policy versioning vs
   per-diff semver, and whether frozen-old-majors is available.
5. **Will publishing ever be fully automated (no human between
   regenerate and registry)?** Yes ⇒ an under-computed bump ships a
   silent breaking change under semver guarantees; what review gate
   remains? No ⇒ the computation is a floor+advisory and can ship
   years earlier at lower fidelity.
6. **How representative is solardemo's shape** (single apikey, JSON
   CRUD, no webhooks, no streaming, no OAuth) of the customer base?
   Each "representative" removes a §11 surface from scope; each "not"
   means §6.1 enrichment precedes diff work on that surface.
7. **When an SDK majors, who migrates the app code — humans reading
   changelogs, or agents consuming a machine-readable change
   manifest?** The agent answer (consistent with station's agent-first
   stance) promotes the migration manifest to first-class and raises
   G4 identity/rename tracking above several runtime features.
8. **For aontu: is routing compat through G3/G6 primarily about making
   the ecosystem's story principled, or about giving aontu its
   flagship internal consumer?** Both are legitimate; they sequence
   differently. This document's answer is "both, in §10.2's order" —
   the bespoke differ first tells us within one release cycle whether
   subsumption-grade semantics are needed *and* hands G3 its oracle,
   at the cost of the compat story not being an aontu showcase on day
   one.
9. **How trustworthy is `info.version` in actual customer specs** —
   deliberately maintained, or export noise? Calibrates how loudly the
   stamp surfaces it vs the hash.
10. **Does scheduled third-party spec re-fetch (consumer-persona drift
    detection) fit the operating model, and where does the baseline
    live** — committed apimodel in the consumer repo (the
    merge-preserving workflow already encourages this; §7.1 assumes
    it) or a registry (new infrastructure)?

---

## 13. Traps to refuse

Documented failure modes from the survey, in the capability-review
tradition:

- **Version-number correspondence as the compat claim** ("SDK 2.x
  works with API 2.x"). Rots immediately; the matrix records verified
  pairs (§9.1).
- **Deriving SDK versions from `info.version`** (OpenAPI Generator's
  default). The field is socially dead (§4.3); at most a hint with
  checksum fallback.
- **Exact enforced bumps** (Elm #868). Floors, never ceilings.
- **Silent fall-forward on version skew** (Shopify) for self-hosted
  targets. Loud, typed, actionable errors.
- **Usage-aware verdicts as the gate** (Apollo's documented failure
  mode: unobserved consumers are invisible). Usage only relaxes the
  static verdict.
- **Blocking checks with false positives** (Azure's suppression
  bureaucracy). cargo-semver-checks' budget: FPs are bugs,
  undecidables go to WARN.
- **A compat gate that fires on toolchain upgrades** (§7.3). Without
  attribution, the gate trains its users to `--force`.
- **Must-ignore without must-preserve** in read-modify-write clients
  (proto3 pre-3.5).
- **Tolerance of malformed known content** (RFC 9413). Strict there,
  tolerant only at spec'd extension points.
- **New wire-behavior defaults without a knob** (AWS S3 checksums,
  Jan 2025).
- **Outsourcing the diff engine to a hosted service or one-maintainer
  dependency** (Optic archived 21 months after acquisition; oasdiff is
  one vendor deep — use it as the interim lane, not the foundation).
- **A verification matrix without executed verifications** — a
  database of claims.

---

## 14. Sources

Provider practice: Stripe API/SDK versioning docs and the 2017
"APIs as infrastructure" post (stripe.com/blog/api-versioning);
Kubernetes deprecation policy, CRD versioning, version-skew policy,
client-go README; Shopify API versioning docs; GitHub REST API
versions docs and the 2026-03-10 changelog; Salesforce REST EOL
articles; Azure api-guidelines, azure-rest-api-specs breaking-change
guidelines, TypeSpec versioning library; Smithy evolving-models guide
and smithy-diff; AWS api-models-aws, aws-sdk-java-v2 VERSIONING.md and
codegen sources (AbstractEnumClass, MemberCopierSpec), the Jan-2025
data-integrity default docs and the MinIO/R2/Backblaze breakage
threads; Slack engineering posts on API design and the rtm.start
staged deprecation.

Tooling: oasdiff BREAKING-CHANGES.md and checks catalogue; buf
breaking rules, BSR commits/labels, breaking-change governance posts;
Confluent schema-evolution docs and schema-registry issues #2278/#2234;
Apollo GraphOS operation checks; GraphQL Inspector; Pact Broker
can-i-deploy and versioning docs; cargo-semver-checks and the 2026
Rust project goal; release-plz semver-check; Elm package manager docs
and elm-lang.org issue #868; go apidiff/gorelease; japicmp; Revapi
update-versions and semver-ignore; api-extractor; Optic archive
notices; OpenAPI Generator issues #1815, #17640, #15047, #20012,
#18370, #20593.

Vendors: Stainless publish/custom-code docs and the Java
forward-compatible-enums post; Speakeasy versioning,
forward-compatibility, open-enums, and strict/lax posts, plus gen.lock
files in the wild (novu, mistral, hookdeck, formance); Fern
self-hosted-versioning and CLI reference; liblab config docs; Kiota
design docs and kiota-lock.json.

Theory: Avro 1.11 specification (schema resolution); Cardelli/TAPL
function subtyping; Liskov & Wing 1994; CUE `Value.Subsume` docs and
"The Logic of CUE"; Habib et al. ISSTA 2021 (JSON subschema) and the
VLDB 2022 witness-generation paper; Orchard's W3C TAG versioning
drafts; Fowler's Tolerant Reader; RFC 9413; RFC 8701 (GREASE); RFC
8594; RFC 9745; protobuf proto3 guide (field numbers, reserved,
unknown-field retention history), Buf "field names are forever";
Robinson's consumer-driven contracts; Gay & Hole 2005 and the
asynchronous session-subtyping undecidability line
(Bravetti/Carbone/Zavattaro; Lange/Yoshida); Google AIP-180/181.

Runtime: Kubernetes KEP-1693 and the warnings blog post; Elasticsearch
REST API compatibility docs and X-Elastic-Client-Meta; Slack
python-slack-sdk deprecation module; Apollo client-awareness docs;
Kafka KIP-511/KIP-896 and the client-compatibility blog; MongoDB wire-
version handshake errors; AWS SDK User-Agent 2.x convention; MCP
lifecycle spec, issue #2721, vercel/ai #14413; Cloudflare Vary
changelog (2026-07-02); Zalando RESTful API guidelines (deprecation
chapter).

Ecosystem-internal: apidef `transform/top.ts`, `transform/field.ts`,
`parse.ts`, `utility.ts`, `model/apidef.aontu`,
`docs/design/graphql-ingestion.md`, `docs/explanation/the-internal-model.md`;
sdkgen `model/sdkgen.aontu`, `helpers/semver.ts`, `helpers/stdrep.ts`,
`helpers/manifest.ts`, `action/package.ts`, `action/doctor.ts`,
`cmp/Deploy.ts`, `cmp/Changelog.ts`, clienttrack templates,
`docs/design/sdkgen-packages.md`, `docs/design/voxgig-station.md` §8.6,
`docs/design/feature-tags.md`; aontu `docs/capability-review/index.md`,
`g3-subsumption-evolution.md`, `g6-distribution.md`, `progress.md`,
`docs/reference-language.md` (constraint algebra & subsumption tables).
