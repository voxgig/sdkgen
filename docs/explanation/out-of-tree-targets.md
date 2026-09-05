# Out-of-tree targets: generating into another repo

Almost every target writes into the SDK repo it belongs to:
`<sdk-repo>/ts/`, `<sdk-repo>/go/`, and so on. One does not.
`seneca-provider` produces a Seneca plugin — an independently released
npm package, in its own repo, that depends on the generated `ts` SDK the
way any other consumer would. This page explains why that needs a
mechanism rather than a different folder name, and what it means for a
project that uses it.

The model key is
[`main.kit.target.<t>.output`](../reference/model.md#generating-outside-the-sdk-repo-output).

## Why a folder name cannot do it

The obvious implementation is for the consumer's `Root.ts` to write
`Folder({ name: '../../seneca/acme-provider' })`. Two things stop it:

- **jostraca refuses a `..` segment in a folder name.** That is a guard,
  not an oversight: it keeps generation inside the tree it was pointed
  at. Generation OVERWRITES, so a folder name that can climb out of the
  output root is a folder name that can overwrite anything.
- **The output root is not a node in the component tree.** It is the
  `folder` option on the `generate()` *call*. Writing somewhere else
  means another call.

So an out-of-tree target gets its **own `generate()` pass**, rooted at
its output path, with `cmp/ExternalTarget` as the Root instead of the
project's own.

## What the second pass changes

| Concern | In-tree pass | Out-of-tree pass |
| --- | --- | --- |
| Output root | the SDK project folder | the resolved `output.path` |
| Root component | the project's `Root.ts` | `ExternalTarget` (sdkgen's own) |
| Targets rendered | every target *except* those with an `output.path` | exactly one |
| Repo furniture (root README, contributor guides, build scaffold) | emitted once | **not** emitted |
| Per-target components | resolved from the project | resolved from the project (`ctx$.cmpfolder`) |

Three of those rows are the failure modes worth naming:

- **The target must leave the in-tree pass.** The consumer `Root.ts`
  iterates the model's targets and knows nothing about `output`, so the
  external targets are removed from the model it is handed. Otherwise
  the package is generated twice — once in its own repo and once, wrongly,
  as `<sdk-repo>/<target>/`.
- **The SDK repo's own files must not follow it out.** A separate
  package's repo has its own README and its own agent guides; the SDK's
  would overwrite them.
- **Components live in the PROJECT, not the destination.** The pass has
  retargeted jostraca's output folder, which is what `requirePath`
  resolves against; without `ctx$.cmpfolder` the pass looks for
  `<destination>/.sdk/dist/cmp/...` and dies with "Cannot find module".

`ExternalTarget` applies the same phase gate as the consumer Root, so
`output.path` is not a consumer-target feature: point a language target
at another repo and it generates there exactly as it would in-tree.

## The destination is a decision, not a typo

The path is taken verbatim from the model, generation overwrites, and
jostraca creates missing parent directories. A mistyped path therefore
fabricates a package tree somewhere arbitrary — or replaces a real
repo's `package.json`, README, LICENSE, and CI workflow in place.

So every destination is validated **before any file is written**,
in-tree output included: an abort must not leave half a generation done.
A destination inside (or containing) the SDK project is refused, two
targets may not claim the same folder, and a folder already holding
content this generator did not write is refused until the project
declares `output: adopt: true`.

## What a consumer project has to declare

```jsonic
# .sdk/model/sdk.aontu
main: kit: target: 'seneca-provider': output: {
  path: '../../seneca/seneca-acme-provider'
  repo: 'senecajs/seneca-acme-provider'
  create: false
  sdkrel: '../../voxgig-sdk/acme-sdk'
}
```

`create: false` says that the other repo is an optional checkout. The target
remains active and remains excluded from the in-tree pass, but sdkgen skips
its external pass while the destination folder is absent. Once that folder
exists, generation proceeds without another model change and all ordinary
destination-safety checks still apply. The default is `true`, which preserves
the original behaviour of creating a missing destination and its parents.

In the project's OWN model — never in
`.sdk/model/target/seneca-provider.aontu`, which `target add` overwrites
(and which `voxgig-sdkgen doctor` now reports when it has been edited).

`sdkrel` is the walk back from the destination to the SDK project, which
the generated package's docs, scripts and live tests name — the companion
test server lives in the SDK repo and is not published. It is derived by
inverting `path` when unset, which is exact only while the walk back
crosses nothing the model names: true for `'../<repo>'`, false for
anything ascending further. A project declaring
`'../../seneca/solardemo-provider'` derived
`'../../voxgig-sdk/voxgig-solardemo-sdk'`, where `voxgig-sdk` is the name
of the *workspace directory* on one machine and no part of the model —
committed into the destination's README and three test files. Generation
warns until such a project declares it.

## See also

- [Model reference: `output`](../reference/model.md#generating-outside-the-sdk-repo-output)
- [Architecture](./architecture.md)
- [Regeneration is overwrite, not merge](./regeneration-overwrite.md)
