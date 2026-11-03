# The copies in `.sdk` merge; generated output overwrites

A project has two kinds of file that the toolchain writes, and they are
treated differently on purpose.

| Kind | Where | Who owns it | On a rewrite |
| --- | --- | --- | --- |
| Generated SDK output | `ts/`, `go/`, `py/`, and the other target folders | the model | overwritten, every `generate` |
| Copies in `.sdk` | `.sdk/tm/**`, `.sdk/src/cmp/**`, `.sdk/model/<kind>/<name>.aontu` | the project, once an add writes them | merged, every add |

Generated output is disposable, and
[Regeneration is overwrite, not merge](./regeneration-overwrite.md)
explains why it is never merged. The copies are the opposite. `.sdk/` is
written once by `create-sdkgen`, and from then on it is the project's own
generator: a project changes its templates and components there. An add
(`target add`, `feature add`, `edition add`, `package add`,
`package update`) brings a newer source into those copies with a
three-way merge. The project's change survives, and the source's change
arrives.

## Choosing the mode

`main.kit.copies` in `.sdk/model/project.aontu` decides:

```
main: kit: copies: 'overwrite'
```

| Value | An add, for a copy the project changed |
| --- | --- |
| `'merge'` (the default) | merges the incoming copy into the change |
| `'overwrite'` | replaces it with the incoming copy |

`'overwrite'` is for a project that is regenerated in full from the
toolchain, where a local change is a mistake to undo rather than work to
keep. Fleet corpora are regenerated that way, except for the SDKs a fleet
records as customised.

`--force` makes one add overwrite whatever the mode says.

## How a merge finds its base

A three-way merge needs the version the change was made against: what the
add wrote last time. The copy record, `.sdk/log/copies.jsonl`, holds the
fingerprint of every copy an add wrote, and the fingerprint is what makes
the base trustworthy.

1. A copy whose bytes still match its recorded fingerprint is untouched.
   The incoming copy replaces it, whatever any base says. A stale base can
   never keep stale text in an untouched file.
2. A copy that differs from its fingerprint was changed by the project. Its
   base is looked up in `.sdk/log/base/<path>`, which keeps a base for every
   copy whose content differs from it, and then in the git versions of the
   file: the index, `HEAD`, and the commits that touched it. A candidate is
   used only when its fingerprint matches the record, so a base that drifted
   on a checkout is never used.
3. With no base found, there is nothing to merge against, and the add stops.

`.sdk/log/base/` stays small. An untouched copy needs no stored base,
because the file itself, checked against the record, is the base, so the
store holds only the copies the project changed. Both the record and the
store are in the repository, so a checkout moves them with the copies.

## What stops an add

An add stops when a changed copy cannot take the incoming copy:

- the incoming copy and the change touch the same lines;
- no base can be found;
- the file is binary;
- the file still holds conflict markers from an earlier attempt.

It then changes nothing. Every file the add wrote is restored, the copy
record and the base store are left as they were, and folders the add made
are removed. The incoming copies are left in `.sdk/log/conflict/`, which
git ignores, with conflict markers where both sides changed the same
lines. The error lists each file and the reason.

Two ways forward:

- Fold the incoming change into the local file by hand, then re-run the add
  with `--keep`. That keeps the local files as they are and records the
  incoming copies as their base, so the next update merges from there.
- Re-run with `--force` to take the incoming copies and drop the local
  changes. git keeps the local versions for anyone who committed them.

## Deletes

When a source stops providing a file, an add removes the copy only if it is
untouched. A changed copy stays and is listed in the log, and so does
a file in a copied tree that no add wrote.

## What `doctor` reports

In merge mode, a copy the record shows the project changed is reported as
**customized**. It is the project's own work, so it does not fail `doctor`.
A copy with no fingerprint in the record is still reported as forked or
edited, because no record separates a change from an old copy.

## Projects from before the copy record

A copy the record has no fingerprint for cannot be told from a local
change. In merge mode, the first add that rewrites such a copy stops on it.
Re-run with `--force` to overwrite, which is what an add did before merging
existed, or with `--keep` to keep the files. Either way the add records
fingerprints, and later adds merge normally.

## The scaffold's own files

`create-sdkgen` applies the same rules to the files it writes, such as
`.sdk/src/Root.ts` and the build scripts, when it is run again over an
existing project. It keeps its own record, `.sdk/log/scaffold.jsonl`, and
its own base store, `.sdk/log/scaffold-base/`, and reads the same
`main.kit.copies` value.

## Why not jostraca's merge

jostraca has a three-way merge of its own (`existing.txt.merge`). It keeps
its base under `.jostraca/generated/`, which its own `.gitignore` excludes. It
also advances the base even when a merge conflicts or is skipped, writes
conflict markers into the file, and either overwrites or skips silently
when the base is missing. The copy merge avoids each of those: the base is
checked by fingerprint, an untouched file always takes the incoming copy,
a conflict changes nothing, and the base moves only when the incoming copy
lands.

## Related

- [Regeneration is overwrite, not merge](./regeneration-overwrite.md)
- [Customize templates and propagate the change](../how-to/customize-and-propagate-templates.md)
- [Command-line reference](../reference/cli.md)
