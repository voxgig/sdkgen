# How to upgrade the generator in a project

A project pins `@voxgig/sdkgen` in `.sdk/package.json`, and `.sdk/` holds
copies of the templates and components that release installed. Upgrading
moves both: the package, then the copies. This page is the safe path, and
what to do where a project cannot take it.

## Prerequisites

- A scaffolded SDK project, run from its `.sdk/` directory.
- Everything committed, so `git diff` shows what the upgrade changed.

## The safe path

```bash
npx voxgig-sdkgen package update @voxgig/sdkgen
npx voxgig-sdkgen doctor
npm run generate
```

`package update` checks the copies before it fetches anything, then
installs the latest release with a tilde range and brings the copies up to
it. A copy the project changed takes the update by a three-way merge; one
it cannot merge stops the update with nothing changed, as
[The copies in `.sdk` merge](../explanation/copies-merge.md) explains.
`doctor` then reports anything left over, and exits non-zero while it does.

Run each target's own tests after `generate`, as after any regeneration.

## When `package update` stops

The error lists each file and the reason. For a file the copy record holds,
fold the incoming change into it and re-run with `--keep`, or re-run with
`--force` to take the incoming copy. For a file the record does not hold,
nothing shows whether it holds a local change or an older copy, so commit
and re-run with `--force`, then restore any local change from `git diff`.

## Copies older than the floor

Components copied from a release before 4.23.0 do not compile against the
current generator, and model files copied before 1.3.18 use `//` comments,
which the model compiler does not read. A merge cannot repair either.
`doctor` names such a target where the copy record or the model file shows
it, and `npm run generate` failing in `tsc` on files under `src/cmp/<t>/` is
the same problem. Replace the copies:

```bash
git commit -am "Before replacing the <t> copies"
npx voxgig-sdkgen target add <t> --force
```

Then compare with `git diff` and restore any local change by hand.

## An empty operation list in a README introduction

From 4.48.0, `introOps` names no operation when no active entity has one,
where it named `list` and `load` before. The README introductions copied
before 4.48.0 call it, so under the newer package they print an empty
list, `()`. The safe path brings the copies up with the package; this
happens only where the package moved alone, by an `npm install` say.
Re-add each target to bring its copies up to the package:

```bash
npx voxgig-sdkgen target add <t>
```

## Releases up to 4.41.0 do not run on a fresh install

A project whose pin resolves to 4.41.0 or earlier, such as `~4.40.1`,
installs with no lockfile a release whose command line fails on every verb
with `One is not a function`, because it resolves a newer `shape` than it
was written for. `package update` is one of those verbs, so it cannot move
the pin. Move it by hand, with the tilde range `package update` writes:

```bash
npm install --save-dev --save-prefix=~ @voxgig/sdkgen@latest
```

Then take the safe path.

## Copies newer than the package

`doctor` reports copies as **ahead** when the copy record dates them from a
newer release than the one installed: the package was moved back, by a
re-scaffold that lowered the pin, say. Move it up again with
`npx voxgig-sdkgen package update @voxgig/sdkgen`. `package update
--no-fetch` and `target add` would put the installed release's older copies
back.

## Related

- [The copies in `.sdk` merge](../explanation/copies-merge.md)
- [Command-line reference](../reference/cli.md)
- [Use an sdkgen package](./use-an-sdkgen-package.md)
