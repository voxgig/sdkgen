# k-h5fixcheck: attack the two structures built for H5

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/h5fixcheck/`. Write nowhere else. Everything else
under `P` is read-only (`P/h5fix` included: copy from it), and so is
everything under `/home/user`.

Read first: `P/brief.md` (the proposal and the hypotheses; H5 is the one
checked here), `P/prompts/k-h5.md` (what "safe" means), `P/prompts/k-h5fix.md`
(what the engineer before you was asked to build), the first attack
`P/results/s4-h5check.txt` (the states that were not safe, and why), and
in `/home/user/sdkgen/AGENTS.md` the sections "Content can come from
OUTSIDE this package" and "Sharp edges". The engineer's report is given
below this file's text in your instructions; their working directory is
`P/h5fix` (`PROGRESS.md`, `sdkgen` on the branch `h5fix`, `bin/`,
`checkbin/`, logs). Their report is a claim.

Your PATH, at the top of every shell: `export PATH=/opt/node24/bin:$PATH`.

```sh
mkdir -p P/h5fixcheck && cd P/h5fixcheck
cp -a P/h5fix/sdkgen sdkgen && cp -a P/h5fix/old old && cp -a P/h5fix/bin bin && cp -a P/h5fix/checkbin checkbin   # then point every path at P/h5fixcheck
(cd sdkgen/ts && npm run build)    # exit 0
```

## The job

You are trying to find a project or pack state in which moving to the new
structure is still not safe, now that these two structures exist: an edit
of the project's lost without the mode that says so; a page written by a
stale or wrong component while `doctor` says the project matches; a verb
that refuses what it wrote itself, or deletes what it did not; a dry run
that writes; a pack target that stops generating or silently generates a
different page.

1. **Their rows and the first attack's states, re-run** on your copy:
   every outcome that differs from their report.

2. **The fingerprint list, attacked.** At least ten states of your own,
   each run for real. Among them: a copy from a release the list does not
   hold (an older version; a version released after the list was made); a
   copy that differs from a release by whitespace only, by line endings,
   by a trailing newline; a copy the project edited that happens to equal
   another release's file; a file the project wrote itself under a
   retired name with different content; a retired name in an aliased
   target; a retired name in a pack's own target of the same name (the
   pack still ships that component: it must not be removed); the list
   missing, empty, or corrupted; a retired file that a LATER release ships
   again; the rule for an edited copy in each of the two readings, in
   merge mode and in overwrite mode, with and without `--force`, and as a
   dry run. Is the list reproducible (made twice, the same bytes)? What
   does a release that forgets to regenerate it do?

3. **The compatibility layer, attacked.** Run the two version 3.2
   providers through it yourself and compare the pages with their table.
   Then: a provider that declares 3.2 and already satisfies 3.3; one that
   declares 3.3 and does not; one that declares a version that never
   existed; two providers on different versions in one project; a provider
   whose declared version is the imported constant; the mutations they say
   are now loud, and five of your own (a fact of the wrong type, a printer
   that returns nothing, a note in an unknown slot, a required fact set to
   an empty string, an extra argument). For each: loud at build, loud at
   generate, or silent, and whether the page is right.

4. **Their changes, read as a reviewer of the repository would**: each
   rule of "Sharp edges" touched, bent or duplicated, with the line; the
   tests (do they fail without the change: revert one hunk at a time for
   three of them and see); what the suite says.

5. **H5's own words.** "Retiring per-language components cannot be made
   safe for doctor, remove, target add and package update without
   breaking their rules, or a pack's targets stop generating." Go through
   them one by one against what you ran, and say which the evidence now
   supports.

Keep `P/h5fixcheck/PROGRESS.md` from your first step; if it exists when
you start, continue from it. The machine is shared (4 CPUs, 15 GB): one
heavy command at a time.

## What you report

Rows and states that differ. Every state you tried: what you did, what
happened, safe or not. The compatibility layer's outcomes. Every rule
bent, with the line; the tests that do not fail without their change.
Your verdict on H5: confirmed, refuted or not decided, how sure, and the
worst thing you found. What you did not get to. Separate what you ran
from what you read.
