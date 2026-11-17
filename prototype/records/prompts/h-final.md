# h-final: put the three together, review nine languages honestly, freeze version 3.1

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `v31`; you write in `P/v31/` (your working directory) and in
`P/base/` (what you hand to the porters). Write nowhere else.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`. Then
the three briefs your predecessors worked from: `P/prompts/h-shared.md`,
`P/prompts/h-guard.md`, `P/prompts/h-tools.md`. Their results are given to
you below this file's text in your instructions; they are claims, not facts.
Their directories: `P/h-shared` (shared documentation code and providers,
HEAD of `P/h-shared/sdkgen`), `P/h-guard` (the guard and the forms of all
twenty runtimes, HEAD of `P/h-guard/sdkgen`, and `runtime-table.md`),
`P/h-tools` (the review tools). The stage-3a results are in
`P/results/s3a-*.txt`; the old guide is `P/freeze/PORTING.md`.

## The job

Eleven engineers will each port one language (js php lua csharp java kotlin
scala swift cpp perl ocaml) on top of what you
freeze, in parallel, each followed by an independent reviewer, and their
work will be merged. After you, a port touches only that language's own
files, a porter can tell with one command whether the port is right, and
nothing in the process accepts a false sentence.

Do the parts in this order.

## 1. One clone

```sh
mkdir -p P/v31 && cd P/v31
cp -a P/h-shared/sdkgen sdkgen
cp -a P/h-tools/tools tools && cp -a P/h-tools/harness harness
```

Bring the guard engineer's commits onto it (they start from the same commit,
`2a87287f`, and touch only `ts/test/runtimefacts.test.ts`,
`ts/test/runtimeforms/**` and other test files): cherry-pick them in order.
Build. The guard now meets the shared engineer's changes for the first
time: make it pass for the nine ported languages honestly. Fix a provider
where the guard is right; fix the forms where the provider is right; every
declared fact ends derived, cited, language or convention. Fix every fact
the guard engineer marked `WRONG:` in a forms file. The reader test passes
for all twenty.

`P/freeze/oldclone` is the pristine old code, built: read-only. The old
output is `P/freeze/harness/out/old`. Regenerate NEW from your clone.

## 2. Review the nine languages with the new process

For ts go py c zig clojure rust elixir and rb, tutorial, root quick start
and REFERENCE: run the one command, and classify until it passes, by the
rules of the new tools (no rule spans languages; a missing unit is always
by hand; an echo is a contradiction or has a reason). Ruby was classified by
the pilot with rules that no longer apply to it: redo it. Correct the seven
classifications the check called wrong (`s3a-check.txt`, `misclassified`).
Where the review shows the output is wrong, fix the source and say so.
Unclassified ends at 0 for all nine, and the fact sheet of each language has
no blank account.

Record, per language and section: units same, shared sentences matched, by
hand, missing (restored, dropped with the reasons), contradictions (list
them: these are the two-documents-disagree items, and they are part of the
verdict); blocks identical, after named corrections, by named unification,
otherwise, and unverified. These are the baselines the ports are compared
with.

## 3. Freeze

At one commit, with a clean tree:

- `npm run build`, and `git status` clean after it;
- the suite without the toolchain lanes;
- the golden;
- the lanes: ts README, go README, py README, c DOC, rust DOC, `^rb: `, and
  the zig documentation lane (all six models), each on NEW, and the zig lane
  on the old clone for the comparison;
- the eleven unported languages byte-identical to OLD in README and REFERENCE
  except lines from already-shared components: list each line and its count;
- the tools' own controls (`P/h-tools` built one command for them);
- the check's 52 guard mutations: none "not caught, not accounted".

Tag it `v31-frozen`. Set `ok` to true in your result only if all of the above
hold at the tag and the nine ledgers are at 0.

## 4. The base the ports start from

Make `P/base/`:

- `sdkgen`: a copy of your clone at `v31-frozen`, built (with
  `node_modules`, `dist`, `dist-test`, `dist-test-scaffold`);
- `tools`: the tools, with the nine languages' classifications as the
  reference;
- `harness`, and the old output and your NEW output;
- `oldclone`: a link to `P/freeze/oldclone` (read-only);
- `runtime-table.md`: what the guard reads from each of the twenty runtimes;
- `newport.sh <lang> <dir>`: makes a porter's workspace in one step (a copy
  of `sdkgen` and `tools`; the old output linked). Run it once for a
  language you will not port and show the one command reports that language
  as not ported, without error.

Check free disk (`df -h /`): eleven workspaces will be made from it.

## 5. The porting guide, version 3.1

Write `P/base/PORTING.md`, complete on its own for an engineer who has read
only `brief.md`, `brief3.md` and `brief4.md`. It replaces
`P/freeze/PORTING.md`. Besides what that guide holds, corrected:

- **The order of work is guard-first.** The language's forms file and its
  section of `runtime-table.md` already exist: the porter reads the runtime
  table, writes the provider's facts to match it, and completes the parts of
  the forms file left to the porter (signature readers, citations).
- **What a port may touch**: the language's own files, listed exactly. What
  to do when a shared file seems to need a change: stop; record the
  construct with file and line, the smallest change, breaking or additive,
  the providers it would force work in; and only if the port cannot continue,
  make the change as a separate commit of shared files only, additive only.
- **The review**: the one command, what each number must be, how to classify
  (shared sentences are matched for you; everything else by hand; a missing
  unit is restored or dropped with a reason; an echo is a contradiction to
  count), the fact sheet (every fact with its account; a citation must show
  the value), blocks (a changed block in a language with no compiler here is
  unverified and reported as such; zig has a compiler now).
- **What the independent reviewer will do after the porter**: audit every
  cited fact against the runtime, read old and new pages side by side for
  three variations, re-run the one command, inject regressions. So a porter
  reports only what was run.
- Every problem the Ruby pilot found in the old guide (`s3a-pilot.txt`,
  `guide_problems`, ten items), fixed in the text.
- The table of the eleven languages, corrected against `runtime-table.md`: the
  result style, what the page names an entity by, the nouns, the stream
  kind, known constructs, and the exact commands that compile or run its
  examples here (`before/run.sh` for php, perl, java and cpp; the cpp
  documentation lane; nothing for js; no compiler for lua, csharp, kotlin,
  scala, swift, ocaml).
- How to commit (explicit paths; the four kinds apart; no tool or model name
  in a message), and that a build never runs while a suite or lane does.
- What a porter reports, as a list.

## 6. Measures at nine languages

Source lines (with and without the shared guard and the forms; each shared
file; per language the provider, hook and forms), measured and projected to
twenty; prose shared by sentence, per language and section, and the words in
notes; the guard's account per language (derived, cited, language,
convention); purity; interface changes since the first four languages,
breaking and additive, cumulative, and how many of them a newly ported
language caused.

Report against H1 to H5. Say plainly what crossed a line. Separate what you
ran from what you read. Say what you did not get to.
