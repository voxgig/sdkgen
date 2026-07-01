# How to drive generation from code

Most users invoke sdkgen through the CLI and the `generate` script. This
guide is for when you need to call it programmatically — embedding it in a
build, or testing a component you are writing.

## Run the scaffolding actions in code

The `target`/`feature` actions have a code API equivalent to the CLI:

```ts
import { SdkGen } from '@voxgig/sdkgen'

const sdkgen = SdkGen({ folder: '/path/to/project/.sdk' })

await sdkgen.target.add(['ts', 'go'])
await sdkgen.feature.add(['log'])
```

Or dispatch the raw CLI-style action:

```ts
await sdkgen.action(['target', 'add', 'ts'])
```

Pass `dryrun: true` to plan without writing — it is honoured for both the
target and feature steps:

```ts
const sdkgen = SdkGen({ folder, dryrun: true })
await sdkgen.target.add(['go'])   // logs the plan, writes nothing
```

## Embed the generation step

Generation (model → SDK source) is normally orchestrated by
`@voxgig/model`. It obtains a build function from `SdkGen.makeBuild`:

```ts
import { SdkGen } from '@voxgig/sdkgen'

const build = await SdkGen.makeBuild({
  root,   // path to the compiled Root component module
  def,    // API definition path
  model,  // { folder, entity }
  meta,   // { name }
})

// later, inside the model build:
await build(model, buildCtx, ctx)   // → sdkgen.generate({ model, build, config })
```

`generate` resolves the Root component (from `spec.root` or
`config.root`), runs jostraca, merges the output against existing files,
and resolves `{ ok: true, name: 'sdkgen' }`.

## Test a component in isolation

Components emit into a jostraca file tree, so you can render one into an
in-memory filesystem and assert on the output. This is exactly how this
repo's own tests work:

```ts
import { Jostraca, Project, Folder, File } from 'jostraca'
import { memfs } from 'memfs'
import { ReadmeExplanation } from '@voxgig/sdkgen'

const { fs, vol } = memfs({})
const jostraca = Jostraca()

const model = { name: 'demo', main: { kit: { feature: {
  log: { active: true, name: 'log', title: 'Logging' },
} } } }

await jostraca.generate(
  { fs: () => fs, folder: '/out', model },
  () => {
    Project({ folder: 'p' }, () => {
      Folder({ name: 'd' }, () => {
        File({ name: 'README.md' }, () => {
          ReadmeExplanation({ target: { name: 'ts' } })
        })
      })
    })
  },
)

const out = vol.toJSON()   // inspect the generated file(s)
```

Key points:

- `ctx$.model` comes from the `model` option you pass to `generate`.
- `cmp` wraps a single function child as `[child]`; a component's hook
  children fire during the **define** phase, so you can count or capture
  them even with `build: false`.
- `each(...)` iterates objects in sorted-key order, so output is
  deterministic.

See the test suite (`ts/test/*.test.ts`) for worked examples covering the
helpers (`collectDeps`, `buildIdNames`, `getMatchEntries`), `resolveTarget`,
`requirePath`, and `ReadmeExplanation`.

## See also

- [Programmatic API reference](../reference/api.md)
- [Components vs templates](../explanation/components-and-templates.md)
