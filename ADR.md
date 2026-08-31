# Architecture Decision Record

This is the register of **fundamental** decisions for sdkgen: the small
set of choices that everything else in the repository is built on, and
that a contributor (human or agent) must not quietly reverse.

An entry belongs here when reversing it would change what the project
*produces* rather than how one part of it works. Ordinary design choices
— which data structure a component uses, how a message is worded — live
in the code and in [`docs/`](docs/README.md), not here. Design documents
that work a subsystem out in depth live in
[`docs/design/`](docs/design/); an ADR states the decision those
documents are built on.

Each entry states the decision, the context that forced it, the
consequences we accept in exchange, and how the decision is enforced in
practice. Entries are append-only and numbered in order. A decision that
no longer holds is not deleted: its status changes to **Superseded by
ADR-NNN**, so the reasoning that led there stays readable.

| ADR | Decision | Status |
|-----|----------|--------|
| [ADR-001](#adr-001--the-model-is-the-only-input-no-spec-annotations) | The model is the only input; no spec annotations | Accepted |
| [ADR-002](#adr-002--a-generated-sdk-carries-only-what-it-uses) | A generated SDK carries only what it uses | Accepted |

---

## ADR-001 — The model is the only input; no spec annotations

**Status:** Accepted

**Companion:** [apidef ADR-002](https://github.com/voxgig/apidef/blob/main/ADR.md#adr-002--guideaon-is-the-only-correction-surface)
— the same decision, stated where the inference happens.

### Context

sdkgen generates from a **model**, not from a spec. The pipeline is
`OpenAPI → apidef → model (.aontu) → aontu → jostraca → SDK source`, and
sdkgen enters at the model. That boundary has been quietly under
pressure from both ends.

From the apidef end: a spec describes things that are not resources. The
case that forced this was the **access-token exchange** — a
`POST /auth/token` that buys a short-lived credential with a long-lived
one. It is a path with a method and a response schema, so every
inference apidef makes says "entity", and sdkgen dutifully generated a
`Token` entity with a `create` operation in all 22 target languages: a
credential exchange dressed as a CRUD resource, in every SDK the fleet
publishes.

Three fixes were available, and the two obvious ones are the wrong ones.

1. **Read the spec in sdkgen.** sdkgen would look for
   `x-voxgig-auth: exchange`, or for the token endpoint's shape, and
   skip it. This puts spec knowledge on both sides of the apidef
   boundary, where it will drift — and sdkgen would then be parsing
   OpenAPI, which is the one job it does not have.
2. **Exclude the operation.** Give sdkgen a list of operations not to
   generate. This is real (`doctor` would need to learn it, per the
   `add`-is-overwrite contract) but it treats the symptom: the exchange
   is not merely *unwanted output*, it is a FACT ABOUT THE API that the
   `secrets` feature needs and currently has to be told by hand, per
   project, in a file that repeats what the spec already said.
3. **Move the fact into the model.** apidef recognises the exchange,
   deactivates the entity, and records what it found on
   `main.kit.info.security.exchange`. sdkgen reads the model, as it
   always has.

### Decision

**sdkgen's only input is the model. It does not read OpenAPI specs,
vendor extensions, or overlay documents, and it has no per-project list
of operations to suppress.**

When sdkgen needs to know something about the API, the answer is a
**model fact** that apidef records, and the request goes to apidef.
Correction of that fact happens in `guide.aon`, on apidef's side of the
boundary, where the inference was made.

A feature receives spec-derived facts by **declaring** which it wants:

```
spec: { authexchange: 'exchange' }
```

— the same declare-never-infer rule `needs` and `transport` already
follow, and for the same reason: the alternative is `configDefinition`
knowing feature names, which is exactly the coupling the generic feature
loop exists to avoid. The vocabulary of facts is CLOSED (`SPEC_FACTS` in
`ts/src/utility.ts`), so a feature cannot reach arbitrarily into the
model.

**A fact says what something IS, never that it should run.** The
exchange facts carry the endpoint's path, method, and field names; they
do not carry `active`. Resolving a static credential through the
`secrets` feature on an API that also happens to have a token endpoint
is a legitimate configuration, so turning the exchange on stays the
project's deliberate act. This is what keeps the mechanism additive: an
SDK that already used the feature sees its declared defaults replaced by
better ones and no change in behaviour.

### Consequences we accept

- **A new fact costs a round trip through apidef**, including its own
  TS-and-Go parity work. That is slower than reading the spec here, and
  it is the price of one pipeline rather than two.
- **sdkgen cannot fix a misclassification.** If apidef calls something
  an entity and it is not, the SDK carries it until `guide.aon` says
  otherwise. There is deliberately no override on this side — a second
  correction surface is how the two drift out of agreement.
- **Facts overlay a feature's declared defaults, so a default is a
  GUESS, not a contract.** `secrets` declares `path: 'auth/token'`; a
  spec saying `oauth/token` wins. A project needing something else still
  overrides at runtime through `options.feature`, which beats the
  embedded config either way. A feature author must not treat a
  `config.options` default as a value only they can set.
- **An unknown fact name is ignored, not an error.** A project on an
  older sdkgen whose model carries a fact this version does not know
  keeps generating. The cost is that a typo in `spec:` fails silently —
  the same trade the applicability tags make, and it is guarded the same
  way.

### Enforcement

- `SPEC_FACTS` in `ts/src/utility.ts` is the closed vocabulary, and
  `configDefinition` is the single site that performs the overlay. A
  component reaching into `main.kit.info.security` directly is a
  reversal of this ADR.
- `ts/test/utility.test.ts` pins the overlay in both directions: a
  declaring feature receives the fact over its defaults, a
  non-declaring one is untouched, and `active` is never overlaid.
- `model/sdkgen.aon` declares `spec: &: string` on a feature. It is
  canonical there and mirrored by `make sync-model`; `make check-model`
  fails on drift.
- **Grep for `x-` and for `def.paths` before adding a branch that reads
  API shape.** Neither belongs in this repository. If sdkgen needs to
  know it, apidef records it.


---

## ADR-002 — A generated SDK carries only what it uses

**Status:** Accepted

**Companion:** [sekreto's provider-plugin design](https://github.com/voxgig/sekreto/blob/main/docs/design/plugin-providers.md)
— the library half of the same decision.

### Context

The `secrets` feature is a thin layer over a vendored
[sekreto](https://github.com/voxgig/sekreto). sekreto shipped thirteen
provider kinds in one file, reachable from a `makeprovider` switch, so
every SDK with the feature on carried all thirteen: AWS SigV4 request
signing, seven HTTP vault clients, and the `node:crypto` and `node:fs`
edges behind them. The elementdemo SDK's chain is `[dotenv, env]`. It
carried a 5,153-byte `Sigv4.ts` it will never execute.

sekreto had already made the *platform module* lazy — `nodemod()` defers
`require('node:fs')` to first use — and that was worth doing: importing
the library is now safe on a runtime that has no `fs`. But laziness is
not absence. A bundler still resolves a `require` it can see, so the
code remained in every build, and sekreto's own comment said so.

The generator is where absence can actually be decided, because the
generator chooses what is written at all.

### Decision

**A generated SDK contains the code paths its configuration reaches, and
no others. Where a feature has optional parts, they are declared as
PLUGINS and trimmed like features.**

A plugin is `main.kit.feature.<f>.plugin.<p>`: a name, an `active` flag,
the runtime it `needs`, and the template `path`s it owns. The generate
step drops an inactive plugin's paths exactly as it drops an inactive
feature's tree — the same rule, one level deeper
(`pluginExcludes`, beside `srcFeatureExcludes`).

**`path` is declared, not conventional.** The obvious design — a plugin
owns `src/feature/<f>/plugin/<p>/` — cannot express this case, and the
reason generalises: **a plugin's files are frequently not free to move.**
sekreto's provider modules are vendored, so the vendoring guard holds
each one against its upstream path, and their relative imports
(`./support`, `../Sigv4`) only resolve at upstream's directory depth.
Relocating them under a convention would break the guard and the imports
at once. A plugin therefore states which paths it owns; the convention
remains the default for a plugin whose files sdkgen owns outright.

### Consequences we accept

- **Leanness is a CONFIGURATION property, so a misconfiguration is a
  missing provider rather than a slower SDK.** A project that names
  `awssecrets` in its chain without activating the `aws` plugin gets a
  registry error at construction. That error is written to say so
  precisely — it distinguishes an unknown kind (a typo) from a known
  kind whose module was not imported (the trim working), because
  collapsing the two is what made the split confusing to use.
- **Plugin granularity is a judgement, and ours is by platform cost.**
  The five secrets plugins group by what they need — `dotenv` (fs),
  `vault` (fs+fetch), `cloud` and `saas` (fetch), `aws` (fetch+crypto) —
  not one per provider kind. Finer granularity buys little once the
  expensive edge is gone, and thirteen entries would obscure the one
  that matters: `aws` is the only plugin that costs `node:crypto`.
- **The vendored tree gained a second level**, so the vendoring guard
  had to learn that a directory is not an unlisted file. It now requires
  a nested vendored directory to be declared in `VENDOR_DIRS` rather
  than walking recursively — a recursive walk that discovers its own
  directories would quietly accept a subtree nobody listed, which is the
  failure that guard exists to prevent.
- **This is TypeScript-only today.** sekreto has ten ports and the split
  has landed in one. The other nine still carry every provider, and the
  five with no voxgig/plugin port (csharp, java, perl, php, rust) cannot
  take the full plugin model at all until it lands there. The file split
  is worth doing in all ten regardless — it delivers the leanness — and
  the plugin model replaces the registry underneath it port by port.

### Enforcement

- `pluginExcludes` in `ts/src/helpers/featureSource.ts` is the single
  implementation, applied beside `srcFeatureExcludes` in each target's
  Main component. `ts/test/helpers.test.ts` pins both polarities and the
  inactive-feature case.
- `model/sdkgen.aon` declares `plugin: &:`; canonical there, mirrored by
  `make sync-model`.
- sekreto's own `typescript/test/lazyload.test.ts` pins the library-side
  invariant that the core surface reaches no platform-dependent
  provider. If that regresses, this ADR's mechanism still runs and
  trims nothing worth trimming.
