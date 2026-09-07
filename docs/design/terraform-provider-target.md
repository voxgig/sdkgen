# The `terraform-provider` target

Working notes for a new CONSUMER target: a Terraform provider generated
from the same model as the SDK, layered on the `go` target, generating into
its own repository, and built as an sdkgen package
(`packages/sdkgen-terraform-provider`) from the start rather than bundled
and migrated out.

## Shape: `seneca-provider`, not `go-cli`

A Terraform provider is `terraform-provider-<name>`: a standalone Go module,
released to the Terraform Registry from a GitHub tag with a GPG-signed
GoReleaser artifact, on its own cadence. That is the same situation
`seneca-provider` is in — an independently released package that happens to
be generated from an API model — and it is not the situation `go-cli` is in,
which is a subfolder of the SDK repo consuming the sibling SDK by a relative
`replace` directive.

So the model follows `seneca-provider`:

- every standard generation phase off (`phase.<name>.active: false`), with
  `Main_terraform-provider` emitting the whole package, as all four consumer
  targets do;
- `output: path` left **unset** in the target's own `.aon` and declared per
  project, for the reason `seneca-provider.aon` gives at length: in aontu a
  concrete value does not yield to another concrete value, it conflicts, so
  a default here would take the choice away rather than offer one;
- the SDK consumed as a **published** module (`require` on the SDK's module
  path) rather than by a relative `replace`, because the two repos are not
  checked out together;
- `ext: go`, and a throw from `Main` when the `go` target is absent.

Parity: `"parity": {"terraform-provider": "CONSUMER"}` — a consumer target
is outside the FULL/MIRRORED/UNCOVERED tier system, and says so rather than
saying nothing. See [seneca-provider-package](./seneca-provider-package.md)
for that decision.

**Naming trap, checked.** The solardemo fixture has a `/planet/{id}/terraform`
action route — a planet being terraformed. A case-insensitive grep for
"terraform" hits `ts/src/helpers/opShape.ts`, `ReadmeRef_<lang>`,
`generate.test.ts` and the `ts/test/solardemo/app` server before it hits
anything to do with Terraform. Unrelated, in both directions: the target must
not be named from that route, and that route's coverage must not be edited
while working on the target.

## The hard part is metadata, not Go

The Go is mechanical: `terraform-plugin-framework`, one `Resource` per
entity, `Schema()` returning attributes, `Create`/`Read`/`Update`/`Delete`
calling the generated SDK's ops, `ImportState` on the id.

What is not mechanical is the **schema metadata**, and getting it wrong is
not cosmetic. Terraform's plan is computed from the schema, so a wrong
`Computed` produces a permanent diff on every plan, a wrong `Optional`
where the API requires a value fails at apply, a missing `RequiresReplace`
on an immutable attribute produces an update call the API rejects — or
worse, one it silently ignores, leaving state claiming a value the server
does not hold. The failure mode of a plausible-looking provider is state
corruption on the second apply, which is why the reporting section below is
not optional polish.

Per attribute Terraform needs `Required` / `Optional` / `Computed`,
`Sensitive`, and `RequiresReplace`. Per resource it needs a type name, a
drift-detecting `Read`, and an import path.

## What the model carries today — verified, and less than hoped

Verified against `@voxgig/apidef` 8.2.2 as installed
(`ts/node_modules/@voxgig/apidef/model/apidef.aon`) and against
`ts/src/helpers/opShape.ts`.

Available:

| model | shape |
|---|---|
| `entity.name` | `key()` |
| `entity.id?` | `{ field, name }` — absent when the spec models no id |
| `entity.fields[]` | `{ name, req, type, active, short? }` |
| `entity.relations.ancestors` | list of ancestor chains |
| `entity.op.<name>.points[]` | `method`, resolved `segments`, `args.params[]` with `reqd` |

apidef already infers which of create/read/update/delete an entity has.
`opRequestShape(entity, op)` in sdkgen gives an op's request payload with
required/optional already decided, and `entityIdField`, `entityOps`,
`entityPath` and `ownPoint` are all exported.

**The field record has exactly those five keys.** `readOnly`, `writeOnly`,
`format` and `deprecated` are in the OpenAPI document and are not carried
into the model. Stronger than "not declared": apidef 8.2.2's compiled
output contains no occurrence of the string `readOnly` at all, so nothing
reads them from the spec in the first place.

### The second gap, which is larger and was not anticipated

The brief for this work proposed two Tier-1 derivations from the difference
between an operation's request and response schemas:

- in the CREATE response but absent from the CREATE request → `Computed`;
- in the CREATE request but absent from the UPDATE request → `RequiresReplace`
  (if you cannot PATCH it, changing it must replace it — the one immutability
  signal OpenAPI genuinely encodes).

Both are sound reasoning about OpenAPI. Neither is computable from the model
today, and the reason is not the missing booleans.

`opRequestShape` does **not** read an op's declared body schema for `create`
or `update`. Read the code: for a body op it takes the op's path/query
params, and then mirrors **the entity's own fields**, filtered by
`fieldInOp(field, opname)` — which consults `field.op.<opname>.active` and
treats an absent entry as participating. So the create request payload is,
by construction, every active entity field; nothing can be "absent from the
create request" unless something set `field.op.create.active: false`.

And nothing does. That slot is a project-side override — `ts/test/opshape.test.ts`
exercises it with a hand-written model — and apidef never populates it. The
per-op request membership the two derivations need is not degraded in the
model, it is **absent**, and the difference matters: a derivation over a
degraded signal produces weak results a reviewer can correct, while one over
an absent signal silently marks every attribute the same way and looks like
it worked.

## The apidef prerequisite, rescoped

This is voxgig/apidef work and it comes before the target work. Two parts,
not one:

1. **Carry the field-level spec facts.** Add `readOnly?: boolean`,
   `writeOnly?: boolean`, `deprecated?: boolean` and `format?: string` to
   the `fields[]` record, set by the same transform that already sets
   `short` from `description`. Optional and unset-when-absent, so that
   "the spec said nothing" stays distinguishable from "the spec said false"
   — the same discipline `short` already documents.

2. **Populate per-op field participation into the slot that already
   exists.** Set `field.op.create.active: false` for a field the create
   request schema does not accept, and `field.op.update.active: false` for
   one the update request schema does not accept. This needs no new schema
   shape and no sdkgen change: `fieldInOp` already honours it, and
   `opRequestShape` already routes every language's typed models through it.

Both are independently justified, which is the test for whether a
prerequisite is really a prerequisite or a feature being smuggled into
another project. `readOnly` is the difference between a field a client may
send and one it may not; every generated SDK currently puts server-assigned
fields into its `CreateData` type and lets the caller set them. Part 2 is
the same defect one level up: today `<Name>CreateData` and `<Name>UpdateData`
have identical members for every entity in every one of the 22 targets,
whatever the spec's two request schemas actually say. Terraform is the
consumer that makes both visible, not the reason for either.

Until part 2 lands, the target must **not** guess the difference. The
honest behaviour is the reporting one: mark those attributes by tier-2
heuristic and say in `SCHEMA.md` that the spec's request schemas were not
available to the model.

## Three-tier derivation

The tiers are ordered by how much a maintainer should trust them, and every
decision records which tier and which signal produced it.

### Tier 1 — from the spec

Available today:

| signal | decision |
|---|---|
| required in the create request (`opRequestShape('create')` item not optional, i.e. `field.req`) | `Required` |
| entity has no `update` op | every attribute `RequiresReplace` |
| `entity.id` | the import ID, and the `Read` key |
| entity has `load`/`list` but no `create`/`update`/`remove` | data source, not resource |
| `relations.ancestors` | the parent id attribute is `Required` and `RequiresReplace` |
| entity has `create` but no `load` | emit **neither** resource nor data source, with a reported reason |

That last one is not a limitation to work around. Terraform's model is
reconcile-to-desired-state; without a read there is no drift detection, and
a resource that cannot detect drift reports success while the world diverges
from the plan. Refusing to emit it is the correct output.

After the apidef change:

| signal | decision |
|---|---|
| `readOnly` | `Computed` |
| in the create response, absent from the create request | `Computed` |
| in the create request, absent from the update request | `RequiresReplace` |
| `writeOnly`, or `format: password` | `Sensitive` |

### Tier 2 — heuristics, when the spec is silent

By exact name, `Computed`: `id`, `created_at`, `updated_at`, `etag`, `self`,
`href`, `status`, `state`.

By substring, `Sensitive`: `password`, `secret`, `token`, `key`,
`credential`. Deliberately over-inclusive, and the asymmetry is the whole
argument: a wrongly-sensitive attribute is redacted in plan output, which is
a cosmetic annoyance a maintainer can override in one line; a wrongly-public
one writes a credential in cleartext into the Terraform state file, which is
a disclosure with no undo. `key` will catch `sort_key` and `partition_key`.
That is the trade being made on purpose, and `SCHEMA.md` flags it for review.

Resource type name: `<provider>_<entity_snake_singular>`, which is the
registry's own convention.

Tier-2 rows are the ones a maintainer is being asked to check, so they are
marked as such rather than blended in.

### Tier 3 — explicit override, and where it goes

**Not in apidef's `guide.aon`.** Verified: `guide.aon` is keyed
entity → path → op, with `rename`, `active` and `transform` slots and no
per-attribute slot at all. Adding one would be the smaller problem. The
larger one is that "this attribute forces replacement" is a fact about one
target's rendering, not about the API — putting it in the guide makes all 22
language targets carry a Terraform concept, and invites the next target to
do the same.

Overrides go in the sdkgen project model under the target, exactly where
`seneca-provider` puts its deps and its publication identity:

```
main: kit: target: 'terraform-provider': entity: <Name>: field: <name>: {
  computed:  true
  forcenew:  true
  sensitive: true
}
```

That lands in `model/project.aon`, which create-sdkgen creates once and never
overwrites, so an override survives `target add` — unlike `model/sdk.aon`,
which is rewritten on every scaffold, and unlike the target's own `.aon`,
which `target add` overwrites (the mistake that cost voxgig-solardemo-sdk its
pinned npm package name).

**The target's own `.aon` must leave those three keys UNSET, not defaulted.**
In aontu two concrete values conflict, and two defaults conflict too, so a
`*false` here would not lose to a project's `true` — it would fail the
unify. The schema defaults that already exist for `publish.registry.*` are
the pattern to copy: default in `model/sdkgen.aon`, silent in the target.

## Report the derivation: `SCHEMA.md`

Generate a `SCHEMA.md` beside the provider, listing every resource and every
attribute with what it was marked, which tier decided it, and which signal —
with tier-2 rows flagged for review, and with the entities that were skipped
and why.

The argument is `doctor`'s: a guess a maintainer cannot see is one they
cannot correct. The generated provider will be plausible whether or not the
derivation was right, and the plausible-but-wrong case corrupts state on a
later apply, far from anything that would point at the schema. A table that
says `region — RequiresReplace — tier 1 — absent from the update request`
turns a silent inference into a reviewable claim, and the tier-2 rows tell a
maintainer exactly where to spend their attention.

It also gives the target a test surface that does not need Terraform: the
report is generated from the same decisions the schema is, so a suite can
assert on the decisions directly rather than parsing Go.

## Order of work

1. **apidef** — the two changes above, in voxgig/apidef, released.
2. **The package skeleton** — `packages/sdkgen-terraform-provider`, with
   its manifest (`provides.target`, `parity: CONSUMER`), its component
   type-check lane, its test-kit suite, and a CI step in this repo, all of
   which the haskell package establishes the pattern for.
3. **The derivation, headless** — the decision function and `SCHEMA.md`,
   testable without emitting a line of Go.
4. **The Go emission** — resources, data sources, provider configuration,
   GoReleaser and registry furniture.
5. **A real provider** — generated from solardemo, `terraform plan` against
   the companion test server.

Steps 3 and 4 can proceed before step 1 lands, against the tier-1 signals
that exist today plus tier 2, provided `SCHEMA.md` says plainly which
signals were unavailable. Shipping it that way and calling it complete is
what must not happen.
