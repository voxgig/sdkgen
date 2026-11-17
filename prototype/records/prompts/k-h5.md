# k-h5: existing projects, packs and aliases on the real structure (hypothesis H5)

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/h5/`. Write nowhere else. Everything else under `P`
is read-only (`P/migrate` included: copy from it), and so is everything
under `/home/user`.

Read first, in this order: `P/brief.md` (the proposal and the five
hypotheses; H5 is yours). Then section 4 of `P/stage1.md` ("Migration and
the copy channel") completely: an engineer measured H5 once already, with
a stand-in, and that section is their record (the rows, the change to the
tool, the override rule, the risks). Their working directory is
`P/migrate`: `sdkgen` (a clone of `main` at 9aebaf9e = 4.44.0, plus a
stand-in commit, a version commit, and the lifecycle change in three
commits: a49fddc0, 7bb5161b, c193a603), `old` (the unmodified 4.44.0
build), `langpack` (the language pack, c6069bb), `bin/tool.js` (the driver
of real `.sdk` projects under `work/`), `bin/rows.sh` (every row), and the
logs. Then, in `/home/user/sdkgen/AGENTS.md`, the sections "Content can
come from OUTSIDE this package" and "Sharp edges" (the rules of `add`,
`doctor`, `remove`, `package update` and the copy record that H5 must not
break). Then the frozen state's record, `P/results/s3c-freeze33.txt`
(`interface_changes` above all).

Your PATH, at the top of every shell: `export PATH=/opt/node24/bin:$PATH`.

## What is being tested

The proposal: the model decides what is said, once; a language supplies
how its runtime spells it. For three sections of the documentation (the
README tutorial, the root README's quick start, the REFERENCE page) the
per-language components `ReadmeQuick_<t>.ts`, `ReadmeTopQuick_<t>.ts` and
`ReadmeRef_<t>.ts` are retired, and each language instead ships
`Syntax_<t>.ts` (printers and declared facts) and `Naming_<t>.ts` (a
naming hook), which the shared `ts/src/cmp/ReadmeQuick.ts`,
`ReadmeTop.ts` and `ReadmeRef.ts` call. A target's own old-style
component, if present, is still called first
(`loadOptional(ctx$, './cmp/<t>/ReadmeQuick_<t>')`): that is what keeps
packs and unported languages working. The frozen state is
`P/v33/sdkgen` at the tag `v33-frozen`: thirteen languages ported (ts go
py c zig clojure rust elixir rb perl swift ocaml lua), seven not yet (js
php csharp java kotlin scala cpp; being ported while you work).

Those per-language components are COPIED into every project
(`.sdk/src/cmp/<t>/`) by `target add`, compiled there, and loaded from the
project's `.sdk/dist/cmp/<t>/`. H5 says existing projects, packs and
aliases can move to the new structure safely. It is refuted if retiring
per-language components cannot be made safe for `doctor`, `remove`,
`target add` and `package update` without breaking their rules, or if a
pack's targets stop generating.

Stage 1 measured it with a stand-in: one retired component in three
languages, placeholder text. You measure it on the real thing. A clean
refutation is worth as much as a confirmation.

## Set up

```sh
mkdir -p P/h5 && cd P/h5
git clone P/v33/sdkgen sdkgen && git -C sdkgen checkout -b h5 v33-frozen
cp -a P/v33/sdkgen/ts/node_modules sdkgen/ts/node_modules
cp -a P/migrate/old old                 # the unmodified 4.44.0 build
cp -a P/migrate/bin bin                 # then point every path in it at P/h5
cp -a P/migrate/langpack langpack       # relink its node_modules/@voxgig/sdkgen as tool.js does
```

Bring the lifecycle change onto the frozen clone: fetch `P/migrate/sdkgen`
and cherry-pick a49fddc0, 7bb5161b and c193a603 (not the stand-in
177c44ec; the version commit 98f87b2b only if you need the version to
differ, which the copy record's from/to does). List every conflict and how
you settled it. Build (exit 0). Run the suite's action tests (the files
under `ts/dist-test` whose names contain doctor, remove, target, package,
copies, retire, action, cli) and say what passes. Commit as you go;
messages name no tool and no model and carry no trailer.

## The job

### 1. Stage 1's rows, on the real structure

Every row of stage 1 (1, 2a, 2b, 2c, 3, 3b, 4a, 4b, 4c, 5, 6, 7a, 7b, 8
and the row marked NOT OK), re-run with projects made by 4.44.0 and
upgraded to your build. Now a project's targets are a mix, as a real one
is: at least ts, go, py, perl and lua (ported) with js and php (not
ported), so that one upgrade retires three components in some targets and
none in others. For each row: what happens today (the unmodified tool at
the frozen state, without the lifecycle change), what happens with it, and
whether the outcome is safe. "Safe" is: no edit of the project's is lost
without the mode that says so; no page is silently written by a stale
component while `doctor` says the project matches; no verb refuses what it
wrote itself; a dry run writes nothing.

### 2. Rows stage 1 could not have

- **9. Twenty targets.** A project with every bundled SDK target added by
  4.44.0, upgraded: how many copies retire, what `doctor`, `package
  update` and `generate` print and how long each takes before and after,
  and whether the generated READMEs and REFERENCE pages of the thirteen
  are the shared ones afterwards and those of the seven unchanged.
- **10. Version skew, both ways.** (a) The package is upgraded and the
  copies are not refreshed: which pages does `generate` write, does
  anything throw, what does the project see? (b) The copies are refreshed
  and the package is then older (a lockfile rolled back, a second machine
  not yet installed): the project's new `Syntax_<t>.ts` imports names the
  old package does not export. What fails, where, and how clearly?
- **11. An interface that moves under a pack.** The shared code's
  interface to a provider changed in a breaking way about 25 times while
  thirteen languages were ported (the freeze report lists them). A pack
  author's provider is written against one version and runs against
  another. Take a provider written for the interface of version 3.2 (the
  first port of lua or ocaml: `P/ports/lua/sdkgen` and
  `P/ports/ocaml/sdkgen` hold them as their porters left them, on the 3.2
  base) and install it, as a pack or project-owned target would hold it,
  against your build (3.3): what does the author see for each breaking
  change that applies: a type error in the project's own `tsc --build`, a
  thrown error at generate naming the missing fact, or a page that is
  silently different or wrong? Count each kind. Then say what the
  structure would need so that every case is the first or second kind (an
  interface version the provider declares and the shared code checks, in
  the manifest's `engines.sdkgen` or beside the provider), and build the
  smallest form of it if it is small.
- **12. The language pack.** dart, haskell and lean still ship the three
  old components. Run the pack's own suite against 4.44.0 and against
  your build, and compare every generated `.md` byte for byte.
- **13. Aliases.** `target add go~go2` (a ported language) and `target
  add js~js2` (not ported), each made by 4.44.0 and upgraded, and each
  made fresh on your build: the files under `src/cmp/<alias>/` and their
  names, the generated README and REFERENCE (field types must be the
  language's own, not `any`), `doctor`, `remove`.
- **14. Overrides of the new files.** A project edits its copy of
  `Syntax_ts.ts` (a printer) and of `Naming_ts.ts`: what `doctor` says,
  what `target add` does in merge mode and in `main.kit.copies:
  'overwrite'`, and whether the project's edit can make a page say
  something the model does not (it can: say what the structure offers
  against that, if anything). And a project-owned target with only an
  old-style `ReadmeQuick_mine.ts`: still generates.
- **15. The stale compiled output** (stage 1's NOT OK row): a component
  deleted by hand keeps being loaded from `.sdk/dist/cmp/<t>/`, and
  `doctor` says the project matches. Implement the smallest fix (a
  `doctor` finding for a compiled component with no source, or a loader
  rule), with a test, and show the row passes. Say which rule of the tool
  it leans on or bends.
- **16. The author's side.** What `voxgig-sdkgen package check` says for
  a pack whose target has a provider and no hook, a hook and no provider,
  both, or neither (old style).

### 3. The cost

The lifecycle change after the port: lines added and removed per file,
tests added, and what in it is specific to documentation components (it
should be nothing: say if it is not).

## This job can be interrupted, and the machine is shared

Keep `P/h5/PROGRESS.md` from your first step: one line per finished row
(with the commit), what you are in the middle of, each decision with its
reason. If the file exists when you start, an earlier run was
interrupted: read it, check it against `git log` and `git status` in
`P/h5/sdkgen`, re-run what you rely on, and continue. Other engineers work
on this machine (4 CPUs, 15 GB): one heavy command at a time, any test run
with `--test-concurrency=2`. After every source change run `npm run build`
and read its exit code before you measure. Free disk is about 14 GB: a
project under `work/` is small, but do not copy the clone more than twice.

## What you report

The set-up (commits, conflicts, the action tests). Every row: today,
after, safe or not, and the rule it touches. Rows 9 to 16 with their
measurements. The interface-version finding of row 11 in numbers. The
cost. A script that re-runs every row (`P/h5/bin/rows.sh`) and its log.
H5 plainly: confirmed, refuted, or not decided, with what would decide
it; and every NOT OK row. What you did not get to. Separate what you ran
from what you read.
