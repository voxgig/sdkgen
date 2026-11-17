# k-h5check: an independent attack on the H5 measurement

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/h5check/`. Write nowhere else. Everything else under
`P` is read-only (`P/h5` included: copy from it), and so is everything
under `/home/user`.

Read first: `P/brief.md` (the proposal and the hypotheses; H5 is the one
checked here), `P/prompts/k-h5.md` (what the engineer before you was asked
to do, and what "safe" means there), section 4 of `P/stage1.md`, and in
`/home/user/sdkgen/AGENTS.md` the sections "Content can come from OUTSIDE
this package" and "Sharp edges". The engineer's report is given below this
file's text in your instructions; their working directory is `P/h5`
(`PROGRESS.md`, `sdkgen` on the branch `h5`, `bin/tool.js`, `bin/rows.sh`,
`work/`). Their report is a claim.

Your PATH, at the top of every shell: `export PATH=/opt/node24/bin:$PATH`.

## The job

You are trying to find a project state in which moving to the new
structure is not safe: an edit of the project's lost without the mode
that says so; a page written by a stale or wrong component while `doctor`
says the project matches; a verb that refuses what it wrote itself, or
deletes what it did not; a dry run that writes; a pack target that stops
generating or generates a different page.

```sh
mkdir -p P/h5check && cd P/h5check
cp -a P/h5/sdkgen sdkgen && cp -a P/h5/old old && cp -a P/h5/bin bin   # then point every path in bin at P/h5check
(cd sdkgen/ts && npm run build)    # exit 0
```

1. **Their rows, re-run** from their script on your copy: every row whose
   outcome differs from their report, with both outputs.

2. **States they did not try.** At least twelve, of your own choosing,
   each run for real. Among them, unless they already did:
   - a retired copy whose record entry was written by a version older
     than 4.44.0, and one whose record line is malformed or truncated;
   - a retired copy the project edited and then reverted (the fingerprint
     matches again);
   - merge mode with an edit to a file the new build also changed
     (`Syntax_<t>.ts` after a first upgrade, edited, then a second build
     in which the shared interface moved): the conflict, what is written,
     what `--keep` and `--force` do;
   - a target removed and re-added across the upgrade; a target removed
     by hand (its directory deleted) across the upgrade;
   - an alias of a ported language added by 4.44.0 whose base language is
     then removed;
   - two aliases of one language;
   - a project in `main.kit.copies: 'overwrite'` with an edited retired
     copy (their rule says the edit is deleted: is the project told
     before it happens, and is that the rule the mode already had?);
   - `package update` run twice; run with `-y` (dry run); run with the
     package not actually newer;
   - a feature added after the upgrade (`feature add` re-enters the
     target trees);
   - a pack target with the same name as a bundled one, under an alias;
   - a project whose `.sdk/dist` is stale or absent when `generate` runs;
   - the copy log ignored by the project's `.gitignore`, then cloned
     fresh (no record on the second machine).

3. **Their changes to the tool, read as a reviewer of the repository
   would**: every rule of `AGENTS.md`'s "Sharp edges" that the lifecycle
   change, the interface-version check and the stale-output fix touch
   (one rule in one place; `add` is overwrite and `doctor` compares what
   it writes; the copy record is the only thing that tells outdated from
   edited; a dry run reaches everywhere; junk is filtered in one place;
   provenance by exact line). Name each rule bent or duplicated, with the
   line.

4. **Row 11 again, with a provider of your own making**: take one ported
   provider at the frozen state, remove or misname one required fact and
   one optional fact, change one printer's arity, and install it as a
   project-owned target: what the author sees in each case, with their
   interface check and without.

Keep `P/h5check/PROGRESS.md` from your first step; if it exists when you
start, continue from it. The machine is shared (4 CPUs, 15 GB): one heavy
command at a time.

## What you report

Rows that differ. Every state you tried: what you did, what happened,
safe or not. Every rule bent, with the line. Row 11's outcomes. Your
verdict on H5: confirmed, refuted or not decided, how sure, and the worst
thing you found. What you did not get to. Separate what you ran from what
you read.
