# How to use an sdkgen package

Targets and features do not have to be the ones bundled with
`@voxgig/sdkgen`. An **sdkgen package** supplies its own, and installs
into your project's `.sdk/` the same way the built-in ones do.

## Prerequisites

- A scaffolded SDK project (see the [Tutorial](../tutorial.md)).
- Run everything below from the project's `.sdk/` directory.

## Install one

```bash
npm install --save-dev @acme/sdkgen-iot
voxgig-sdkgen package add @acme/sdkgen-iot
```

Two steps, deliberately: `npm` fetches, `sdkgen` installs. Keeping them
separate keeps their failure modes separate — a network problem and a
manifest problem do not look alike.

A package can also come from a checkout or a plain directory:

```bash
voxgig-sdkgen package add ../acme-sdkgen-iot
voxgig-sdkgen package add /abs/path/to/acme-sdkgen-iot
```

## Install part of one

```bash
voxgig-sdkgen package add @acme/sdkgen-iot --only target:iot-go
voxgig-sdkgen package add @acme/sdkgen-iot --only target:iot-go,feature:circuitbreaker
```

A name in `--only` that the package does not provide is an error listing
what it *does* provide — never a silent no-op.

## Install under a different name

```bash
voxgig-sdkgen package add @acme/sdkgen-iot --alias iot-go=acme-go
```

The alias becomes the target's name everywhere: `model/target/acme-go.aontu`,
`src/cmp/acme-go/`, `tm/acme-go/`. That model file is then **yours** —
`add` creates it once and never overwrites it again, because
differentiating it is the entire point of an alias.

Features cannot be aliased: a feature's name is part of the generated
`options.feature.<name>` config key and of the hook wiring in every
target.

## See what you have

```bash
voxgig-sdkgen package list
```

Read from the provenance recorded in your own model files — there is no
lockfile — grouped by the package that supplied each item. Anything
installed before provenance existed is listed under `(unrecorded)`.

## Update

```bash
voxgig-sdkgen package update @acme/sdkgen-iot
```

This **owns the fetch**, and the order is the reason:

1. it checks your copies against the source as currently installed;
2. it fetches the new version;
3. it re-installs each item.

Measured at step 1, a file that differs from its source is one you
changed. If you fetch first and check afterwards, everything differs
because the source moved — the check fires on every file and stops
meaning anything.

If it finds differences it stops and tells you, because it cannot know
which of two things they are:

```
@acme/sdkgen-iot: 1 file(s) differ from the installed source, so updating
would overwrite them:
  model/target/iot-go.aontu

  This means one of two things, and nothing recorded in the project tells
  them apart:
    - they are LOCAL EDITS, and `--force` will discard them;
    - or @acme/sdkgen-iot was already updated out of band (an `npm update`
      in another shell), in which case they are merely STALE and nothing
      is at risk.
```

- If you did not update it: copy anything you want to keep into
  `.sdk/model/`, then re-run with `--force`.
- If you did: reinstall the version you had and re-run, so the check runs
  against the right source.

Already fetched deliberately? `--no-fetch` uses the source you have.

An **aliased** item's model file is never rewritten by an update; its
`src/cmp` and `tm` trees are refreshed and the skip is reported, so you
can port upstream model changes by hand.

## Check for drift at any time

```bash
voxgig-sdkgen doctor
```

`doctor` compares every tree and every copied model file against the
source each records — including items from external packages, and
including a feature package's per-target source. It exits non-zero on
drift, so it works as a CI gate.

The rule it enforces: **`add` overwrites**, so a project decision belongs
in the project's own model (`.sdk/model/sdk.aontu`), never as a hand-edit
to a copied file.

## What can go wrong

| Message | Meaning |
| --- | --- |
| `Package not found` | Every probed path is listed. Usually the package is not installed, or the path is relative to the wrong directory — run from `.sdk/`. |
| `No package manifest` | The folder has a `.sdk` but no `sdkgen-package.json`. Add its items directly with `target add <path>/<name>`. |
| `package manifest does not match the package` | The package claims something it does not ship. An author bug — nothing was installed. |
| `needs @voxgig/sdkgen >=X` | The package requires a newer generator. Upgrade, or install an earlier version of the package. |
| `Name collision, nothing installed` | Something of that name is already installed from a *different* source. Install this one under an alias, or install the one you want by its own ref. |
| `which npm does not manage` | The package was installed from a local path, so `npm install` would update a different copy. Update that source yourself and re-run with `--no-fetch`. |

## See also

- [CLI reference](../reference/cli.md)
- [Project layout — an sdkgen package](../reference/project-layout.md#an-sdkgen-package)
- [Author an sdkgen package](./author-an-sdkgen-package.md)
- [The design note](../design/sdkgen-packages.md)
