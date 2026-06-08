# Components vs templates: the two-layer generator

Every language target in `@voxgig/sdkgen` is produced from two distinct
layers. Understanding the split is the key to working on the generator
without getting lost.

| | **Templates** | **Components** |
| --- | --- | --- |
| Location | `project/.sdk/tm/<lang>/` | `project/.sdk/src/cmp/<lang>/` |
| What they are | Plain source files in the *target* language | TypeScript that runs at generation time |
| How they become output | Copied verbatim, with placeholder substitution | Executed; they *emit* source by walking the model |
| Depend on the specific API? | No | Yes |
| Example | The HTTP transport, base feature class, utilities | One file per entity, the SDK constructor, the README |
| Mechanism | `Copy()` | `cmp()` + `File()` / `Content()` |

## Why two layers?

Most of an SDK is identical no matter which API it wraps: the code that
builds an HTTP request, runs the feature pipeline, parses a response.
Writing that as a code *generator* would be painful and unreadable — it
is ordinary source code, so it lives as a **template** and is copied.

The rest of an SDK is a direct function of the API: there is one entity
class per entity, one operation method per operation, a README that lists
the real entities. That part *must* be generated from the model, so it is
a **component**.

The rule of thumb:

> If a file looks the same for every API, it is a template. If its shape
> depends on the entities/operations in the model, it is a component.

## Templates in detail

A template is just a file under `tm/<lang>/`. During generation it is
copied into the target directory, and a small set of placeholder tokens
is replaced:

| Token | Replaced with | Set by |
| --- | --- | --- |
| `ProjectName` | The Pascal-case SDK name (e.g. `Solardemo`) | `target add` (`model.const.Name`) |
| `$$name$$` | The SDK name, via model interpolation | aontu, in the target `.jsonic` |
| `'BASE'` | The resolved template base path | `target add` |
| `FEATURE_Name` / `FEATURE_VERSION` | The feature's name / version | `feature add` |
| `GOMODULE` | The Go module path | generation (go target) |

`ProjectName` alone appears ~800 times across the templates — it is the
workhorse substitution.

Templates are copied by the `Copy()` component. Trailing-tilde files
(`*~`) and anything matched by a target's `exclude` list are skipped.

## Components in detail

A component is a `cmp(...)`-wrapped function. When invoked inside a
generation run it receives `props` (with the injected `ctx$`, which
carries the `model`, `log`, `fs`, etc.) and emits output by calling the
jostraca tree functions:

```ts
import { cmp, each, File, Content, getModelPath, KIT } from '@voxgig/sdkgen'

const Entities = cmp(function Entities(props: any) {
  const { model } = props.ctx$
  const entity = getModelPath(model, `main.${KIT}.entity`)

  each(entity, (ent: any) => {
    File({ name: `${ent.name}.ts` }, () => {
      Content(`export class ${ent.Name}Entity { /* ... */ }\n`)
    })
  })
})
```

Components compose: a top-level `Main` component pulls in `Package`,
`Config`, per-entity components, the README, and the test suite. The
shared, language-neutral components (`Main`, `Entity`, `Test`,
`Readme*`, `FeatureHook`) are exported from **this package** and
delegate to per-language components via `requirePath(...)`.

### The delegation pattern

The language-neutral components are thin. For example, the exported
`Entity` component looks up and calls the language-specific one:

```ts
const Entity_sdk = requirePath(ctx$, `./cmp/${target.name}/Entity_${target.name}`)
Entity_sdk['Entity']({ target, entity, entitySDK })
```

Many README sections are *optional* per language. They are loaded with
`requirePath(ctx$, path, { ignore: true })`, which returns `undefined`
when the language has no such component — but **propagates real load
errors** so a broken template is never silently skipped. (See the
[API reference](../reference/api.md#requirepath).)

## How they reach a generated SDK

Editing a template or component in this repo does not change a generated
SDK by itself. The change must propagate:

```
edit project/.sdk/tm/<lang>/...        (template)
  or project/.sdk/src/cmp/<lang>/...   (component)
        │
        ▼  in the consumer .sdk/:  npm run add-target <lang>
copies updated templates/components into the consumer's .sdk/
        │
        ▼  npm run generate
applies placeholder replacement + merges into the target dir
```

There is one important sharp edge: `generate` **merges** into existing
files, and placeholder replacement is *not* re-applied to merged
content. The fix is to delete the specific generated file and re-run
`generate` so it is created fresh. This is covered step by step in
[Customize templates and propagate the change](../how-to/customize-and-propagate-templates.md).

## See also

- [Project layout](../reference/project-layout.md) — every directory mapped.
- [The operation pipeline](./operation-pipeline.md) — what the generated code does.
- [Author a brand-new language target](../how-to/author-a-new-language.md) — apply this model in practice.
