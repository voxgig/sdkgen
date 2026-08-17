# @voxgig/sdkgen-haskell

The **Haskell target** for the [Voxgig SDK Generator](https://github.com/voxgig/sdkgen).

```bash
npm install --save-dev @voxgig/sdkgen-haskell
voxgig-sdkgen package add @voxgig/sdkgen-haskell
npm run generate
```

That generates a Haskell SDK from your API model, exactly as the bundled
targets do — `package add` installs the target's definition, components and
templates into your project's `.sdk`, and generation is unchanged from there.

## Why this is a package and not bundled

It used to be bundled. It is the first target migrated out, following
[how-to/migrate-a-bundled-target](https://github.com/voxgig/sdkgen/blob/main/docs/how-to/migrate-a-bundled-target.md),
and it was chosen because it has the smallest blast radius of the candidates:
29 generated files, and components that import nothing beyond their siblings
and `@voxgig/sdkgen`.

The point of the move is not to make Haskell harder to get. It is that a
target in a package has its own release cadence, its own test suite, and can
be maintained by whoever cares about that language — none of which is true
while every target ships inside the generator.

Nothing about the generated SDK changed in the move: installed from this
package it generates byte-identically to the bundled version it replaces.

## Parity

Declared `MIRRORED` in `sdkgen-package.json`: this target has a
primary-utility suite, but it MIRRORS the shared `.aontu` corpus by hand
rather than executing it, so the cases can drift from the reference. Moving
it to FULL is the highest-value work available here, and it is blocked on the
corpus being published as a consumable package
([design §14](https://github.com/voxgig/sdkgen/blob/main/docs/design/sdkgen-packages.md)).

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
