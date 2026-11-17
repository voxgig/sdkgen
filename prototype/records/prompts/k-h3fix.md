# k-h3fix: the catalogued issues the frozen state still shows, fixed once (hypothesis H3)

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/h3fix/`. Write nowhere else. Everything else under
`P` is read-only, and so is everything under `/home/user`.

Read first, in this order: `P/brief.md` (the proposal and the five
hypotheses; H3 is yours), `P/brief5.md`, `P/brief6.md`, `P/brief7.md` (the
rule each later round added, in its first section). Then
`P/results/s4-h3.txt` (the measurement of H3 against the whole issue
catalogue at the frozen state) and `P/results/s4-h3check.txt` (its
independent check): they are your work list and your instrument. Their
working directories are `P/h3` (the checker `issuecheck33.js`, the
generator with five added variations in `gen/`, `out/`) and `P/h3check`
(`issuecheck33-fenced.js`, the fence-aware copy, and the broader variants
of the checks). Then, in the catalogue
`/home/user/sdkgen/docs/design/model-dependent-text-issues.md`, the entries
X3, S22, U52, U53, V27, U102, D26, S09, S13 and U37 (each entry's Fix and
Check). Then the porting guide `P/base33/PORTING.md`, sections 5, 6 and 10
(how a changed shared sentence is reviewed, what the tools now fail on,
how commits are made), and the tools' `README.md`.

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

## What is being tested

The proposal: the model decides what is said, once; a language supplies
how its runtime spells it. H3 says the catalogued issues in the three
sections under test are **fixed once, for every language**, and is refuted
if more than about 10% of them still need a per-language edit. The
measurement found 36 in-scope entries that are fixed or should be: 29
fixed by shared code alone, 1 that needed a line in every language, and 7
not fixed or only partly fixed (X3, S22, U52, U53, V27, U102, and D26 in
part). All seven are in shared code (`ts/src/cmp/ReadmeRefFeatures.ts`,
`ts/src/cmp/FeatureDocs.ts`, `ts/src/helpers/sdkdesc.ts`). The measurement
calls each "one shared edit". Nobody has made them. You make them, and
you measure what each really took. If one of them needs a line in a
language's own files, that is the finding: do not hide it in shared code
by a branch on the language's name.

## Set up

Thirteen languages are ported at the tag `v33-frozen` (ts go py c zig
clojure rust elixir rb perl swift ocaml lua). Seven are being ported by
other engineers right now, from the same base: you never touch a file of
theirs (`ts/project/.sdk/src/cmp/<lang>/` and `ts/test/runtimeforms/<lang>.ts`
of js php csharp java kotlin scala cpp).

```sh
mkdir -p P/h3fix && cd P/h3fix
cp -a P/base33/sdkgen sdkgen && git -C sdkgen checkout -b h3fix v33-frozen     # built, node_modules included
cp -a P/base33/tools tools                                                    # the review tools with the thirteen's records
mkdir -p out && ln -s P/base33/out/old out/old && cp -a P/base33/out/new out/new
cp -a P/h3/gen h3gen && cp P/h3check/issuecheck33-fenced.js . && cp -a P/h3/out/old h3old   # the H3 instrument: 26 variations
(cd sdkgen/ts && npm run build)        # exit 0, and `git status` clean after it
REGEN=1 tools/portcheck.sh sdkgen out ts    # the start: PASS, as at the freeze
```

If a step does not work as written, find out why and say what you did
instead. `P/h3/out/old` holds links and five generated variations: copy it
so that the links still resolve, or rebuild it as `P/h3/PROGRESS.md` says.

## The job

### 1. Each entry, one at a time, one commit each

For X3, S22, U52, U53, V27, U102 and D26, in that order:

- Read the entry's Fix and Check in the catalogue, and the page that shows
  the defect (the H3 report names the variation).
- Make the fix where the proposal says it belongs: in shared code, reading
  the model once. Add or extend the unit test the entry's Check names (or
  the nearest existing test file under `ts/test/`), failing before and
  passing after.
- Record what it took: the files and lines changed; whether any language's
  own file (`Syntax_<lang>.ts`, `Naming_<lang>.ts`, a forms file, a
  runtime template) had to change, and why; whether it is breaking for a
  provider.
- **D26** is the large one. The catalogue's fix is that the option tables
  take their rows from the validated option schema (`main.kit.optspec`,
  through `ts/src/helpers/optspec.ts`), both ways: every option the schema
  has gets a row, and no row exists that the schema lacks. In the
  REFERENCE this is the constructor's option table, which shared code now
  writes from a hand list of eight rows (`ts/src/helpers/sdkdesc.ts`,
  `OPTION_TEXT`). Do the REFERENCE half (the README's model section is not
  ported and is outside the three sections). A type column must print in
  each language's own type words: that goes through the provider's
  existing type printer, and if it cannot, say what is missing. If the
  whole of D26's in-section half is more than a day of this kind of work,
  do the part that makes the table follow the schema both ways, and record
  the rest as not done, with why.

Then the residues the two reports name, each decided the same way (fix it
in shared code, or say why it is not a defect, or why it cannot be fixed
once):

- the feature-ordering note still prints escaped backticks around feature
  names, in all twenty languages;
- the log feature's REFERENCE section says to set `feature.log.active` to
  true although log is on by default (is this S09 in other words?); and
  the line prints the TypeScript literal `true` for every language (py's
  is `True`, perl's `1`): the literal belongs to the provider's printers;
- S13's residue: without the test feature, the test client's paragraph
  still calls its options "the test feature's options, which the call
  switches on";
- U37, arguably in scope: go's REFERENCE title says "Golang" where its
  README says "Go". Decide whether one shared label rule fixes it, and
  make it only if it is one.

### 2. What moved, in thirteen ported languages and seven unported

`ReadmeRefFeatures.ts` and `FeatureDocs.ts` print the features part of
every language's REFERENCE, ported or not. After your edits:

- regenerate, and run the one command for the thirteen ported languages.
  Every changed or new shared sentence opens classes: decide each as the
  guide says (one written rule per changed sentence, applied to every
  language, is how the last freeze did it: `P/v33/mine/decide2.py`). A
  sentence you changed has no verdict, and you are its author: list each
  with its old text, its new text and what makes the new one true, for an
  independent reader.
- for the seven unported languages: their pages change too. List every
  changed line with its count per language, and confirm nothing else
  moved (`diff -r` against `P/base33/out/new`).
- the suite without the toolchain lanes
  (`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`):
  0 failures; the golden regenerated once and passing; the guard and the
  reader for all twenty.

### 3. The measurement again

Generate the 26 variations of the H3 instrument from your clone
(`node h3gen/gen.js <dir>/new <absolute path of sdkgen/ts>`) and run
`issuecheck33-fenced.js` with the thirteen as ported. Every entry you
fixed must now be clean for the thirteen AND for the seven unported
(shared code serves all twenty: say so where it does, and where an
unported language still shows it because its own old component prints the
text). Add to the checker, for each of your entries, the broader variant
the independent check asked for (code-only and any-wording forms), and for
each of your checks put the defect back into a copy of a NEW page in other
words, to see whether the check fires: report each.

Then give H3's table again, as the measurement gave it: per entry and per
distinct defect; by the brief's rule, strict and strictest; with what is
still not fixed counted on each side.

### 4. Leave it mergeable

Other engineers will bring your commits onto a clone that also holds the
seven new ports. Commit as the guide says: shared source and tests in one
commit per entry; the build output (`ts/dist`) in its own commit at the
end; the golden in its own commit; the tools' records in the tools' git.
Messages name no tool and no model and carry no trailer of any kind. Tag
your last commit `h3fix`.

## This job can be interrupted, and the machine is shared

Keep `P/h3fix/PROGRESS.md` from your first step: one line per finished
entry (with the commit), what you are in the middle of, each decision with
its reason. If the file exists when you start, an earlier run was
interrupted: read it, check it against `git log` and `git status`, discard
uncommitted changes it does not describe, re-run what you rely on, and
continue. Several other engineers work on this machine (4 CPUs, 15 GB):
one heavy command at a time, the suite with `--test-concurrency=2`. After
every source change run `npm run build` and read its exit code before you
regenerate or measure.

## What you report

Per entry and per residue: fixed or not; the commit; the files and lines;
the test; whether any language's own file changed and why; breaking or
not. The pages that moved (ported: the classes opened and how each was
decided; unported: the lines and counts). The suite, golden, guard and
the thirteen one commands. The checker's table before and after, with the
broader variants and the attempts to fool each check. H3's numbers again,
and plainly: confirmed, refuted or not decided, and what remains. The
sentences that now need an independent reader. What you did not get to.
Separate what you ran from what you read.
