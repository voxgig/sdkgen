# Regeneration is overwrite, not merge

## Decision

`@voxgig/sdkgen` generates SDK output by **overwriting** existing files, not by
3-way merging into them. Concretely, `makeBuild` runs jostraca with
`existing: { txt: { write: true, merge: false } }` (jostraca's default), and
never enables `merge`.

The invariant this enforces: **generated directories are disposable. The source
of truth is the model + templates/components; edits belong there, never in the
generated output.** Re-running generation against the same model produces
byte-stable output regardless of what was on disk before.

## Why (the failure modes merge caused)

Jostraca supports an opt-in 3-way merge (`existing.txt.merge = true`) intended to
**preserve human edits** in generated files. It merges the freshly generated
content against a *base* — a duplicate of the previously generated file kept
under `.jostraca/`. sdkgen used to enable this globally. Because SDK output is
100% model-derived and never hand-edited, merge bought nothing and actively
broke toolchain upgrades in three ways:

1. **Stale-file retention.** When a template gains a field (e.g.
   `core.Control.Actor`, `core.Result.Stream`) but the on-disk generated file
   still matches the stale `.jostraca` base, the merge treats the old file as
   authoritative and **keeps it**. A newer component that references the new
   field then fails to compile: `undefined: Actor` / `has no field Stream`. The
   generator exits 0; the break only surfaces at `go build`/parse time.

2. **Conflict-marker injection.** When a generated/index file is legitimately
   changed out-of-band (e.g. editing `model/target/target-index.aontu` to drop a
   target) it diverges from the base, and diff3 writes literal `<<<<<<<` /
   `>>>>>>>` markers **into the file**. Generation still succeeds; the corrupted
   file then blows up the next consumer (aontu parse error, compile error).

3. **Silent no-ops.** The "identical/untouched" fast-path keys off the stale
   base, so a genuine template change can be skipped entirely.

These are latent: they don't appear on a fresh scaffold, only when regenerating
an existing tree against a **newer** toolchain — exactly the fleet-upgrade case.
A concrete instance: bumping the fleet to a sdkgen with the typed-struct and
enterprise-feature work produced non-compiling Go (`undefined: Gon2`,
`Control.Actor`, `Result.Stream`) purely from merge keeping stale output.

## Consequences / how to work with this

- **Never hand-edit generated output.** It will be overwritten. Change the model
  (`model/entity/*`), templates (`tm/<lang>/`) or components (`src/cmp/<lang>/`)
  and regenerate. (Already the rule — overwrite now enforces it.)
- **Regeneration is safe and idempotent.** No need to wipe output dirs or clear
  `.jostraca` before regenerating to dislodge stale merges — overwrite handles it.
- **Adding/removing a target is clean.** `target add` overwrites the target
  files and rewrites `target-index.aontu` without diff3 markers. (A dedicated
  `target remove` is still worth adding so the index is never hand-edited.)
- **If a repo ever needs a genuinely hand-owned file**, protect *that path*
  specifically (per-file `existing.txt` policy / guarded regions) rather than
  switching the whole build back to global merge.

## Defense-in-depth (recommended follow-ups in jostraca)

Overwrite removes the trigger, but the engine should also be hardened so a future
opt-in merge can't silently corrupt output:

- **Fail loudly on conflict.** `Jostraca` already tracks `conflicted: string[]`;
  in non-interactive runs a non-empty `conflicted` should raise
  `merge conflict in <file>` rather than write markers that surface later as a
  cryptic downstream error.
- **Base the fast-path on new-vs-current, not vs the stale base**, so a template
  change always regenerates.
- **Fix `.jostraca` base provenance.** The merge base is effectively gitignored
  and desyncs on checkout, making merges unreproducible. Either commit the base
  with the output or drop the dependence (overwrite).

## Related

- [components-and-templates](./components-and-templates.md) — the two-layer model
- [architecture](./architecture.md)
- `AGENTS.md` → "Never edit generated output"
