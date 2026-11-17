# k-h3: the issue catalogue against the frozen state (hypothesis H3)

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/h3/`. Write nowhere else. Everything else under `P`
is read-only, and so is everything under `/home/user`.

Read first, in this order: `P/brief.md` (the proposal and the five
hypotheses; H3 is yours), `P/brief5.md`, `P/brief6.md`, `P/brief7.md` (the
rules later rounds added). Then the catalogue,
`/home/user/sdkgen/docs/design/model-dependent-text-issues.md` (330
entries; its "How to read an entry" section tells you what Where, Class and
Fix mean), with the plan beside it
(`/home/user/sdkgen/docs/design/model-dependent-text-plan.md`) only where
an entry's Fate needs it. Then what earlier stages said about H3, which is
partial and unchecked: `P/stage1.md` (search "H3"), `P/results/s2-ref.txt`
and `s2-check_ref.txt` (search "catalog"), and the script they used,
`P/base32/harness/issuecheck.js`. Then the frozen state's own record,
`P/results/s3c-freeze33.txt`.

Your PATH, at the top of every shell: `export PATH=/opt/node24/bin:$PATH`.

## What is being tested

The proposal: the model decides what is said, once; a language supplies
how its runtime spells it, and nothing a language supplies can see the
model. Thirteen of the twenty bundled languages are ported to that
structure for three sections of their documentation: the README tutorial
(quick start), the root README's quick start, and the REFERENCE page. The
frozen state is `P/v33/sdkgen` at the tag `v33-frozen`: ts go py c zig
clojure rust elixir rb perl swift ocaml lua are ported; js php csharp java
kotlin scala cpp still use their old per-language components and are being
ported while you work.

H3 says: *the catalogued issues in those sections are fixed once, for
every language.* It is refuted if more than about 10% of them still need a
per-language edit. Nobody has measured it against the whole catalogue.
You do, and you leave a command that repeats the measurement when the last
seven languages are in.

A clean refutation is worth as much as a confirmation. Do not round in the
proposal's favour: where a call is arguable, report both readings.

## Set up

```sh
mkdir -p P/h3 && cd P/h3
git clone P/v33/sdkgen sdkgen && git -C sdkgen checkout v33-frozen
cp -a P/v33/sdkgen/ts/node_modules sdkgen/ts/node_modules && (cd sdkgen/ts && npm run build)   # exit 0
cp -a P/v33/tools/gen gen          # the page generator: gen/gen.js <out>/new <clone>/ts ; its variations are in gen/
mkdir -p out && ln -s P/base32/out/old out/old
node gen/gen.js out/new sdkgen/ts  # NEW pages at the tag, every variation; read its SKIPPED lines
```

`out/old/<variation>/<lang>/{README.md,REFERENCE.md}` and
`out/old/<variation>/README.md` (the root) are the pages `main` generates
(sdkgen 4.44.0, 9aebaf9e: the commit the catalogue was read against);
`out/new` the same from the frozen clone. If a step of this set-up does
not work as written, find out why from `P/v33/tools/portcheck.sh` and the
tools' README, and say what you did instead.

## The job

### 1. Scope: all 330 entries, one row each

An entry is **in scope** when the wrong text (or the code that writes it)
is in one of the three sections under test, that is, written at `main` by
`ReadmeQuick_<lang>.ts`, `ReadmeTopQuick_<lang>.ts` or `ReadmeRef_<lang>.ts`
under `ts/project/.sdk/src/cmp/<lang>/`, by the shared
`ts/src/cmp/ReadmeRef.ts` or `ReadmeRefFeatures.ts`, or by a helper only
they call. Decide from the entry's Where and from the source at `main`
(`git -C P/h3/sdkgen show 9aebaf9e:<path>`), never from the title alone.

- `yes`: every site the entry names is in those sections.
- `part`: some sites are and some are not (an entry about "README and
  REFERENCE", a D entry about a rule derived in many places). Only the
  part inside the sections is judged; say which part.
- `no`: none is. One short reason (the component that writes it).
- `pack`: the entry is about the language pack's dart, haskell or lean
  only. Counted apart: they are outside the twenty.

Give the counts per catalogue section (S, X, G, V, U, N, M, D, A) and the
list of `yes` and `part` entries. Several entries repeat one another (the
catalogue says so in Fate): keep each as its own row, and mark the
repeats, so that the count can be given both per entry and per distinct
defect.

### 2. Every in-scope entry, measured

For each `yes` and `part` entry:

a. **The variation that shows it.** One of the existing ones (list them:
   `ls out/old`), or a new one you add to your copy of the generator's
   variations (then generate OLD for it too, from the old clone
   `P/freeze/oldclone`, as the generator's README and
   `P/base32/harness/README.txt` show). An entry no variation can show
   (it needs a state the harness cannot make) is read from the source
   instead, and marked `read`.

b. **A check a machine runs**: a function of a page that is true when the
   defect shows, as in `issuecheck.js`. Run it on OLD and NEW for all
   twenty languages. Each check must be able to fail: show for each that
   it is true on OLD for at least one language (if the defect does not
   show on OLD at all, the entry is stale or your check is wrong: find out
   which). A check that matches words (a regular expression) is fooled by
   a page that says the same wrong thing in other words: after a check
   says NEW is clean, read the NEW page of two ported languages of
   different families where the defect used to be, and say what it says
   now.

c. **Where the decision is made now.** The shared file and line that
   reads the model for this. And every line in a language's own files
   (`Syntax_<lang>.ts`, `Naming_<lang>.ts`, a runtime template under
   `ts/project/.sdk/tm/<lang>/`, a forms file under
   `ts/test/runtimeforms/`) that exists because of this issue. Find them
   by reading, and by `git log -S` / `git log -G` on the clone where that
   helps.

d. **Its class**, by rules fixed before you measure:
   - `once`: NEW is clean for every ported language where OLD showed it,
     the model is read in shared code only, and no language's own file
     holds a line for this issue beyond what every provider declares
     anyway (a constructor's spelling, a type printer).
   - `per-language`: clean, but at least one language needed a line of its
     own for it: a declared fact added for this issue, a note, a printer
     branch, a template change. Name the lines and count the languages.
     Report this class two ways: **strict** (any line of a language's own
     that exists because of the issue) and **lenient** (only where the
     language's line holds a condition on the model, or the fix could not
     have been made in shared code at all).
   - `not fixed`: NEW still shows it for a ported language. Say whether
     the fix under the proposal would be one shared edit or per-language
     edits, and why it has not happened.
   - `unported only`: OLD shows it only for languages not ported yet.
     Nothing can be measured until they are; say what the port will have
     to show.
   - `not a documentation fix`: the entry is a defect of a runtime or of
     the generator, which the sections only expose.

e. **The numbers.** Of the in-scope entries (per entry, and per distinct
   defect): how many `once`, `per-language` (strict and lenient), `not
   fixed`, `unported only`, `not a documentation fix`. H3's ratio is
   per-language over the entries that are fixed or should be: give it
   both ways, with `not fixed` counted first on the proposal's side and
   then against it. Say which reading you think is right, and why.

### 3. The other direction

Short, with pointers and counts rather than a full table:

- defects of the three sections that the prototype found and the
  catalogue does not list (the sentence review's false sentences in
  `P/results/s3b-sentences.txt`; the wave-1 reviewers' findings in
  `P/results/s3b-wave1-consolidated.md`; the "uncatalogued" entries of
  `P/results/s2-ref.txt`): how many, and how many were fixed by one shared
  edit;
- defects NEW has that OLD did not (regressions the reviews found and that
  the frozen state still carries: search the freeze report's `not_done`,
  `surprises` and the consolidated file).

### 4. Leave the measurement repeatable

`P/h3/issuecheck33.js`: one command that prints, for a given `out`
directory and any list of languages, the table of step 2b (entry,
variation, per language OLD/NEW), and exits non-zero when a check is true
on NEW for a language listed in a `ported` argument. It must run unchanged
after the last seven are ported. Show its output for the twenty languages
now (the seven unported show the defect on both sides: that is the
contrast, and the proof each check still fires).

## This job can be interrupted, and the machine is shared

Keep `P/h3/PROGRESS.md` from your first step: one line per finished step,
what you are in the middle of, each decision with its reason, and the
scope table as you build it (so that an interrupted run loses nothing).
If the file exists when you start, an earlier run was interrupted: read
it, re-run what you rely on, and continue. Other engineers work on this
machine (4 CPUs, 15 GB): one heavy command at a time (the build and the
generation are heavy; reading is not).

## What you report

The scope: counts per section, and every `yes` and `part` entry with its
reason. For each in-scope entry: the variation, the check and what it
printed (OLD/NEW per language, compactly), where the decision is made,
the lines a language holds for it, the class. The numbers of 2e, both
ways, and your reading. Part 3's counts. The command of part 4 and its
output. What you could only read and not run. What you did not get to.
Report against H3 plainly: confirmed, refuted, or not decided, and what
would decide it. Separate what you ran from what you read.
