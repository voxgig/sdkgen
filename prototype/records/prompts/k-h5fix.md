# k-h5fix: the two structures H5 still needs, built and measured

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/h5fix/`. Write nowhere else. Everything else under
`P` is read-only (`P/h5` and `P/h5check` included: copy from them), and so
is everything under `/home/user`.

Read first, in this order: `P/brief.md` (the proposal and the five
hypotheses; H5 is yours), then `P/prompts/k-h5.md` (what the first
engineer was asked, and what "safe" means there), then their report
`P/results/s4-h5.txt` and the independent attack on it,
`P/results/s4-h5check.txt`, both completely: the attack's `worst`,
`states`, `rules_bent` and `row11` are your work list. Then, in
`/home/user/sdkgen/AGENTS.md`, the sections "Content can come from OUTSIDE
this package" and "Sharp edges". Their working directories are `P/h5`
(clone `sdkgen` on the branch `h5`, the 4.44.0 build `old`, `today` (the
same tree with the lifecycle change reverted), `bin/tool.js`,
`bin/rows.sh` and the other row scripts, `work/` projects, logs) and
`P/h5check` (`bin/st.sh`, `bin/st2.sh`, `bin/r11own.sh`, their logs, and
`PROGRESS.md`).

Your PATH, at the top of every shell: `export PATH=/opt/node24/bin:$PATH`.

## Where H5 stands

H5: existing projects, packs and aliases can move to the new structure
safely. It is refuted if retiring per-language components cannot be made
safe for `doctor`, `remove`, `target add` and `package update` without
breaking their rules, or if a pack's targets stop generating.

The measurement says: confirmed with conditions. The attack says: not
decided. The two agree on the facts:

- With an intact copy record, every state tried is safe.
- **Any retired copy the record does not hold as unchanged is kept, used,
  and never fails `doctor`.** Reached four ways: a project with no record
  (row 5b); a record that was never committed, then a fresh clone (S14);
  one truncated record line (S2b); retired files restored from git after
  an update (S17b). In each, an old component keeps writing the pages
  while `doctor` says the project matches.
- **A provider written for one version of the interface and run against
  another** changes pages silently. The first engineer built a declared
  interface version that turns this into a refusal. The attack found: the
  refusal stops ALL generation in a project or pack at every raise until
  its copies are refreshed (and the interface broke about 25 times while
  thirteen languages were ported); a clean 3-way merge raises a customized
  provider's declared version on the project's behalf; declaring the
  imported constant defeats the check; and for a provider that declares
  the current version the check adds nothing (a removed optional fact and
  a printer with fewer parameters stay silent).

You build the two structures that would decide it, and measure them.

## Set up

```sh
mkdir -p P/h5fix && cd P/h5fix
cp -a P/h5/sdkgen sdkgen && git -C sdkgen checkout -b h5fix      # the branch h5 at its last commit; node_modules included
cp -a P/h5/old old && cp -a P/h5/bin bin && cp -a P/h5check/bin checkbin     # then point every path in them at P/h5fix
(cd sdkgen/ts && npm run build)        # exit 0
```

Re-run the first engineer's rows and the attack's states on your copy
before you change anything, so that you start from outcomes you have seen
(`bin/rows.sh` and the row scripts; `checkbin/st.sh`, `st2.sh`).

## The job

### 1. A retired copy is recognised without the record

Build it: the package ships, for every file it has retired, the
fingerprints of every released version of that file (a data file made at
build or release time from the repository's history, by the same
fingerprint function the copy record uses). A copy in a project that is
named as a retired file and whose fingerprint is in that list is an
unchanged copy of a release, whatever the record says or lacks: `doctor`
reports it as retired (and fails, as it does for a recorded one), `target
add` and `package update` remove it and its compiled output, `remove`
does not refuse it. A copy whose fingerprint is not in the list is the
project's edit, as now.

- Where does the list come from? The repository here has the history
  (`git -C sdkgen log -- <path>`; the release tags are `v4.x.y`). Make the
  generator of the list a build script, and say what a release would have
  to run. Measure the list: files, fingerprints, bytes.
- Then decide the case the list cannot decide: an EDITED copy named after
  a retired shared section, with no record (or a record that calls it
  additive). Today it is kept, used and passes `doctor`. Two readings: it
  is the project's override and `doctor` says so without failing (the
  first engineer's rule); or `doctor` fails until the project says it
  means it (a model key naming the override, for example). Build the
  second as an option if it is small, and say which rule of the tool each
  reading keeps or bends.
- A damaged record line must not be silent: a line `readCopies` cannot
  parse is a `doctor` finding.
- Re-run rows 5b, S14, S2b, S17b and every row and state that touches
  retirement. The table: before, after, safe or not.
- The attack's `rules_bent` lists duplicated rules in the lifecycle
  change (the path of a component and of its compiled output rebuilt by
  hand in six places; the list of compiled extensions twice; two lists of
  which components a shared section replaces; two readings of the
  declared interface). Put each in one function, or say why not.
- Tests for each, in the action test files; the action tests and the
  whole suite without the toolchain lanes pass.

### 2. An interface that can move without stopping a pack

The refusal is safe and costly. Measure the alternative: **shared code
that still serves a provider of the previous version.** Take the raise
from 3.2 to 3.3 (the first engineer's row 11 lists the changes that act at
generation; `P/ports/lua/sdkgen` and `P/ports/ocaml/sdkgen` hold providers
written for 3.2). Build the smallest compatibility layer: a provider that
declares `interface: '3.2'` generates, on the 3.3 shared code, the pages
it generated on 3.2 where 3.2's page was right, and the corrected page
where the change fixed a false sentence (say which is which, per change),
with one warning naming what the provider should now declare. Measure:

- lines of the layer per breaking change, and whether each change could be
  served at all (a required fact with no honest default cannot);
- the pages of the two 3.2 providers on 3.2, on 3.3 with the layer, and
  as 3.3 providers: lines differing, per section;
- what a pack author sees, and when the layer could be deleted (a
  deprecation window, in releases);
- then the attack's row 11 mutations again (a removed optional fact, a
  printer with fewer parameters): can each be made loud, by making every
  opt-in fact required with an explicit absent value, and by a check of
  each printer's arity at load? Build it for the facts and printers the
  attack names, and count what a provider must then write.

Say plainly what this costs against the refusal, and which you would
ship. If serving the previous version is not feasible for some change,
that is the finding.

### 3. What it adds up to

The lifecycle change, the orphan check, the retired-fingerprint list, the
record finding, the interface version and the compatibility layer: lines
per file, tests, and what in them is specific to documentation components
(the rest serves any per-target component). And the rows that are still
not safe, if any.

## This job can be interrupted, and the machine is shared

Keep `P/h5fix/PROGRESS.md` from your first step: one line per finished
step (with the commit), what you are in the middle of, each decision with
its reason. If the file exists when you start, an earlier run was
interrupted: read it, check it against `git log` and `git status`, discard
uncommitted changes it does not describe, re-run what you rely on, and
continue. Several other engineers work on this machine (4 CPUs, 15 GB):
one heavy command at a time, any test run with `--test-concurrency=2`.
After every source change run `npm run build` and read its exit code
before you measure. Commit as you go; messages name no tool and no model
and carry no trailer of any kind.

## What you report

Part 1: the list (size, how it is made), the rule for an edited copy and
which reading you built, the record finding, the table of rows before and
after, the rules put in one place, the tests. Part 2: per breaking change,
served or not, the lines, the page differences, the mutations made loud
or not, and your recommendation with its cost. Part 3: the totals. H5
plainly: confirmed, refuted or not decided, with every row still not safe
and what the hypothesis's own refutation words say about it. The commits,
in the order another engineer should bring them onto a clone that also
holds seven more ported languages. What you did not get to. Separate what
you ran from what you read.
