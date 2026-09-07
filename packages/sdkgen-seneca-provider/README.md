# @voxgig/sdkgen-seneca-provider

The **Seneca provider target** for the
[Voxgig SDK Generator](https://github.com/voxgig/sdkgen).

```bash
npm install --save-dev @voxgig/sdkgen-seneca-provider
voxgig-sdkgen package add @voxgig/sdkgen-seneca-provider
npm run generate
```

It generates a [Seneca](https://senecajs.org) plugin that exposes your API's
entities as Seneca entities (`provider/<name>/<entity>`), layered on the
TypeScript SDK generated from the same model.

## It requires the `ts` target

This is a consumer target: it wraps the `ts` target rather than being a
language of its own, and the generated plugin imports the published
TypeScript SDK. Add `ts` to your project first. Without it, generation stops
with an error naming the missing target.

The manifest has no field for that requirement. Nothing in
`sdkgen-package.json` says "this target needs that one", so this paragraph
and the error at generation are where the requirement lives.

## It generates into its own repository

Unlike every other target, a Seneca provider is not a folder in the SDK
repository. It is an independently released npm package under the `@seneca`
scope, with its own license, workflow and release cadence, and it depends on
the SDK as an ordinary published dependency. Point it at that repository
from your project model:

```
main: kit: target: 'seneca-provider': output: path: '../../seneca/seneca-acme-provider'
```

The path resolves against the SDK repository root. Left unset, the provider
generates in-tree under `seneca-provider/`, which is a usable default for a
first look at the output.

Set that in `model/project.aon`, not in the target's own file — `target add`
overwrites the latter.

## Why this is a package and not bundled

It used to be bundled. It is the second target migrated out and the first
consumer target to move, following
[how-to/migrate-a-bundled-target](https://github.com/voxgig/sdkgen/blob/main/docs/how-to/migrate-a-bundled-target.md).

Two things chose it. Every bundled language target now drives the shared
test corpus, and that corpus is not yet published as a package, so moving
any of them would cap it below its declared tier. Consumer targets are
measured against no corpus, so they have no tier to cap. Of the four, this
one already generates into a separate repository on a separate release
cadence — so moving its definition into a separately released package is the
smallest change of situation.

Nothing about the generated provider changed in the move: installed from
this package it generates byte-identically to the bundled version it
replaces, verified before the trees moved.

## Parity

Declared `CONSUMER` in `sdkgen-package.json`. That is not a coverage tier
alongside `FULL`, `MIRRORED` and `UNCOVERED`, which grade how a language
target is measured against the shared corpus. A consumer target has no
utility layer to measure, so it is outside that system — and says so, rather
than omitting the field, which cannot be told apart from an author who did
not know it existed.

## Developing

```bash
npm install
npm test          # type-checks the components, then runs the suite
```

The suite runs on `@voxgig/sdkgen/testkit`: it installs this package into a
staged consumer through the real `package add`, compiles the components the
way a consumer's build does, and generates. `npm install` links
`@voxgig/sdkgen` from `../../ts`, so the loop runs against the working
checkout.

Validate the package itself with:

```bash
npx voxgig-sdkgen package check .
```
