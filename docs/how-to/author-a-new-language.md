# How to author a brand-new language target

This is the most involved task in sdkgen: teaching it to emit a language
it doesn't yet support. Budget real time, and **work from an existing
target as your reference** — `ts` is the canonical one, `go` is the best
reference for a statically-typed, non-class language.

Before starting, read
[Components vs templates](../explanation/components-and-templates.md) and
[The operation pipeline](../explanation/operation-pipeline.md). A target
is not just code generation — it must implement the same runtime pipeline
every other SDK implements.

## The three pieces

| Piece | Location | What you provide |
| --- | --- | --- |
| Target definition | `ts/project/.sdk/model/target/<lang>.jsonic` | name, ext, comment token, module name, deps |
| Templates | `ts/project/.sdk/tm/<lang>/` | the language-neutral runtime, as real source |
| Components | `ts/project/.sdk/src/cmp/<lang>/` | API-specific generators (entities, main, tests, readme) |

## Step 1 — the target definition

Copy an existing one and adapt it:

```jsonic
// ts/project/.sdk/model/target/<lang>.jsonic
main: kit: target: <lang>: {
  title: "<Language>"
  ext: <ext>
  comment: line: "<line-comment-token>"
  module: name: '$$name$$'

  deps: &: { kind: *'prod' | string }
  deps: {
    // language package dependencies
  }
}
```

If your target is a tool rather than a library SDK (like `go-cli`), add a
`phase` map to disable the per-entity / readme / test phases and run only
`Main`.

## Step 2 — the runtime templates (`tm/<lang>/`)

These are the parts that are the same for every API: HTTP transport,
the feature runtime, base classes, utilities. Port them from `tm/ts/`:

- `src/` — the operation pipeline (`Point`, `Spec`, `Request`,
  `Response`, `Result`, `Operation`, `Context`, `Control`).
- `src/feature/base/` — the **base feature class** implementing every
  hook (see the [hooks reference](../reference/hooks.md)). This defines
  the contract your generated entities call.
- `src/utility/` — request/response building, params, headers, auth.
- `test/` — the test runner and shared test utilities. The runner's
  matching logic must mirror `js/test/runner.js`.

Use placeholders where the SDK name appears: `ProjectName` for the
Pascal-case name, plus any language-specific token (e.g. `GOMODULE`).

## Step 3 — the components (`src/cmp/<lang>/`)

These generate the API-specific source. The language-neutral components
in this package **delegate** to yours by name, so the file and export
names matter.

### Required components

The neutral `Main`, `Entity`, and `Test` components require these (they
are loaded *without* `ignore`, so a missing one is a hard error):

| Neutral component | Requires | Called as |
| --- | --- | --- |
| `Main` | `cmp/<lang>/Main_<lang>` | `Main_sdk['Main']({ model, target, stdrep })` |
| `Entity` | `cmp/<lang>/Entity_<lang>` | `Entity_sdk['Entity']({ target, entity, entitySDK })` |
| `Test` | `cmp/<lang>/Test_<lang>` | `Test_sdk['Test']({ model, target, stdrep })` |

`Main_<lang>` typically composes sub-components you also write:
`Package_<lang>` (the manifest), `Config_<lang>`, `MainEntity_<lang>`,
`EntityBase_<lang>`, `SdkError_<lang>`, `EntityOperation_<lang>`.

### Optional README components

Loaded with `{ ignore: true }`, so you can add them incrementally. If
absent, the neutral README still renders its shared scaffolding:

`ReadmeIntro_<lang>`, `ReadmeInstall_<lang>`, `ReadmeQuick_<lang>`,
`ReadmeModel_<lang>`, `ReadmeOptions_<lang>`, `ReadmeEntity_<lang>`,
`ReadmeHowto_<lang>`, `ReadmeExplanation_<lang>`, `ReadmeRef_<lang>`,
and for the top-level README: `ReadmeTopQuick_<lang>`,
`ReadmeTopTest_<lang>`, `ReadmeTopHowto_<lang>`.

### Component skeleton

```ts
// ts/project/.sdk/src/cmp/<lang>/Entity_<lang>.ts
import { cmp, each, File, Content } from '@voxgig/sdkgen'

const Entity = cmp(function Entity(props: any) {
  const { entity } = props
  File({ name: `${entity.name}.<ext>` }, () => {
    Content(`// ${entity.Name} entity\n`)
    // …emit operations from entity.op
  })
})

export { Entity }
```

Reuse the shared helpers where they apply: `collectDeps` (dependency
lists), `buildIdNames` and `getMatchEntries` (test id setup),
`isAuthActive` (gate auth code), `FeatureHook` (per-stage dispatch). See
the [API reference](../reference/api.md).

## Step 4 — exercise it

```bash
# in sdkgen
npm run build && npm test

# in a scaffolded project's .sdk
voxgig-sdkgen target add <lang>
npm run build && npm run generate

# in the generated target
cd ../<lang> && <build-and-test>
```

Iterate with the propagation workflow in
[Customize templates and propagate the change](./customize-and-propagate-templates.md),
and keep comparing against the `ts`/`js` reference for parity.

## See also

- [Components vs templates](../explanation/components-and-templates.md)
- [Operation pipeline and feature hooks](../reference/hooks.md)
- [Programmatic API](../reference/api.md)
