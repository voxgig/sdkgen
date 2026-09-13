# Out-of-tree targets: generating into another repo

Almost every target writes into the SDK repo it belongs to:
`<sdk-repo>/ts/`, `<sdk-repo>/go/`, and so on. Any target can be pointed
somewhere else instead, and one is normally used that way.

`seneca-provider` produces a Seneca plugin — an independently released
npm package, in its own repo, that depends on the generated `ts` SDK the
way any other consumer would. It ships as
[`@voxgig/sdkgen-infrapack`](https://github.com/voxgig/sdkgen-infrapack)
rather than in the box, so add it with `voxgig-sdkgen package add` first;
the mechanism below is the generator's and works for whichever target a
project points outward. This page explains why that needs a mechanism
rather than a different folder name, and what it means for a project that
uses it.

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
`.sdk/model/target/seneca-provider.aon`, which `target add` overwrites
(and which `voxgig-sdkgen doctor` now reports when it has been edited).
That holds whether the target came from the box or from a package: a
`package update` refreshes the installed copy the same way.

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

## One model, two layouts

`output: path` is committed, and it describes one developer's checkout
layout. Sometimes the same model has to be generated from a different one.

The case that forced this: a provider repository that carries a tagged
checkout of its SDK in a subfolder and regenerates itself from it. The SDK
then sits inside its own output folder, and the path to that folder is an
ancestor. Nothing in the SDK's committed model can say so, because the SDK
does not know it has been cloned into another repository.

A second committed value would not help. Two layouts would then each hold a
path the other disagrees with, and whichever regenerates last wins. So the
second layout arrives at generate time instead:

```js
// .sdk/build/sdkgen.js, or any caller holding the config
const config = {
  external: {
    'seneca-provider': {
      path: '../..',
      sdkrel: '.sdksrc/acme-sdk',
      enclosing: true,
    },
  },
}
```

The same shape is read from `SDKGEN_EXTERNAL` as JSON, and the environment
wins. That route exists for driving a checkout the caller does not own: a
script regenerating a provider from a cloned SDK has no business editing
files inside the clone, and the clone is disposable anyway.

One variable holding JSON, rather than one variable per item per field.
Item names carry hyphens, so a `SDKGEN_EXTERNAL_SENECA_PROVIDER_PATH`
scheme needs a name mangling with no inverse: `a-b` and `a_b` arrive
identical, and nothing can tell which was meant.

An override relocates an item. It can also send an item out of tree that
the model generates in tree, and every destination guard still runs on it.

## Writing into a folder that holds the project

`enclosing: true` is what lets a destination contain the SDK project. It is
a separate flag from `path`, and only an override can set it — never the
model.

Two decisions, said separately, because the second one fails silently. One
`..` too many fabricates a package tree over an unrelated repository,
replacing its manifest, README, licence and CI in place, and the only trace
is a line naming the resolved folder. Overriding a path is ordinary;
writing over the directory holding the project is not, and the guard stays
in front of everyone who did not ask for it.

`enclosing` also stands in for `adopt`. A folder that contains the project
always holds content, so asking whether it is empty can only ever give one
answer — and requiring `adopt` as well would put the layout back in the
SDK's committed model, which is the coupling the override exists to break.

The derived walk back needs no warning here either. It descends rather than
ascends: `.sdksrc/acme-sdk` names the subfolder holding the checkout and
then the checkout, both inside the output folder and both chosen by whoever
asked for this layout. Nothing sits above anything, so the warning above
would be false and its advice would write one layout's path into the
other's model.

Generation writes the files its components declare and removes nothing, so
a checkout inside its own output folder survives its own run.

## See also

- [Model reference: `output`](../reference/model.md#generating-outside-the-sdk-repo-output)
- [Architecture](./architecture.md)
- [Regeneration is overwrite, not merge](./regeneration-overwrite.md)
