# i-tools: the review of a new port cannot miss a wrong word or a missing sentence

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `i-tools`; your directory is `P/i-tools/`. Write nowhere else.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md` (what the re-check found, the rule of this stage, and who owns
which files). Then, in `P/results/s3fix-check.txt`: `blockers`,
`classification`, `masking`, `note_lint`, `guide` and `numbers`; and
`P/results/s3fix-tools.txt` in full (the report of the engineer who built
the tools you are extending) with `P/base/tools/README.md`. The re-check's
own scripts are in `P/check-v31/mine` (`inj.js` with `inj3.json`,
`inj34.json`, `myinj.json`; `factcls.js`; `pnote.js` with `pnotes.json`;
`cites.js`): the clones they ran against are gone, so re-point them at
copies of yours.

## The job

You own the review tools. You work on tooling and on generated output, not
on sdkgen's source: two engineers change the source and the guard in
parallel (`P/i-shared`, `P/i-guard`); do not touch their directories and do
not wait for them.

Eleven languages are about to be ported, each by one engineer, each then
read by an independent reviewer. For a new language every class is new
(nothing was reviewed before), which is the mode the tools' controls never
exercised. The re-check showed three ways a new port's page can be wrong
with every number unchanged. Close them, and make each a permanent control.

Set up:

```sh
P/base/newport.sh ws P/i-tools          # makes P/i-tools/ws/{sdkgen,tools,out}
cd P/i-tools/ws && REGEN=1 tools/portcheck.sh sdkgen out rb | tail -3    # PASS; out/new identical to P/base/out/new
node tools/selftest.js --clone sdkgen --old out/old --new out/new --stage2 P/probe-ref/harness/out --tmp P/i-tools/tmp   # 84/84
```

Work in `P/i-tools/ws/tools`. Never build in `ws/sdkgen` while a check
reads it; where a control needs a changed provider, build it in a second
copy (`cp -a ws/sdkgen P/i-tools/mut`).

## 1. A wrong word in a language or convention fact

Shared-sentence matching masks a fact's value with its slot label, so a
sentence carrying a wrong value is matched as shared. For facts the guard
derives or cites, the guard checks the value. For the rest (`language` and
`convention`: the word for a map, the nouns, a heading, and whatever the
guard report lists in those two categories) nothing does. The guard
engineer is moving the null literal and the boolean literals to `cited`;
what remains has no runtime to be checked against. Check it against the old
page of the same language:

- For every string-valued fact whose account is `language` or `convention`,
  find the NEW units that carry its label, and for each the OLD unit it
  pairs with (identical, or the OLD side of its reworded pair). The fact is
  **attested** when the OLD side holds the same value in the same place in
  at least one unit, in the same variation. Otherwise it is **unattested**,
  and the one command fails until the porter records the fact by hand
  (`hand/<lang>.json`, a `facts` entry: the value, why it differs from the
  old page or why the old page has no such sentence, and what shows it is
  right). The fact sheet prints, per fact: the account, attested or not,
  the count, and one OLD and NEW pair.
- An enumerated fact (`named`, `prints`, `entityBy`, `keys`) chooses which
  sentence prints: say in the README how a wrong one shows (which classes
  it leaves for a person), and prove it with a control.
- Controls, permanent in the self-test: the re-check's provider mutations
  (rb `none` 'null', `maps` 'arrays', `noun` 'Functions', each alone; a
  wrong `entityNoun` and a wrong `heading` in a language that declares
  them; one enumerated fact changed). Each must fail the one command for a
  reason that names the fact, in the reviewed mode and from scratch, without
  relying on another class happening to change. Build the mutated providers
  once in your second copy, generate, and keep what the control needs under
  `controls/` so the self-test does not rebuild.

## 2. A missing sentence

Run from scratch, a shared sentence that OLD never printed and NEW drops in
some variations changes no number (`rb-direct-sentence-dropped` in
`myinj.json`). Beside the existing "printed more often than any reference"
check, add its opposite: where this language prints a matched shared
sentence in fewer variations (or fewer times in a variation) than the
reference it matched prints it, that is left for a person, with the
variations named. And a second list, not failing, in the review directory:
shared sentences that every reference language of the same result style
prints in a variation and this language prints nowhere (the porter says for
each why not).

Controls: the dropped `direct` sentence in one variation; a sentence
dropped from every variation; a table row dropped; each from scratch and in
the reviewed mode.

## 3. Every control also runs from scratch

The self-test exercises the reviewed mode only. Add the from-scratch mode
(`classify.js --scratch` on a separate root, as the re-check's `inj.js
--scratch` does) for the 24 injected regressions and the 7 false sentences,
and the re-check's own 19 (`myinj.json`). An injection that leaves no new
open class from scratch is a hole: fix it or list it with the reason.

## 4. Which sentences were ever read by a person

Shared-sentence matching accepts a new language's sentence when it equals a
reference class, and about 877 of the reference classes were accepted by
stage-3a rule records nobody re-read. Make that visible and closable:

- `tools/sentences.js` exports every distinct masked sentence the reference
  languages contribute as a reference (reworded and added classes): the
  masked text, one concrete example with its language and variation, how
  many languages and classes share it, how its classes were accepted (by
  hand, by a rule record), and, where you can find it mechanically, the
  shared source file whose template prints it. One file,
  `reviewed/sentences.json`, holds a verdict per masked sentence (`ok`,
  `false`, `awkward`, with a note), written by a reviewer and by no tool.
- Every `shared:` outcome records whether its reference sentence has a
  verdict. The one command prints the count matched against sentences
  nobody reviewed, and fails on it only with `STRICT_SENTENCES=1` (the
  review of the sentences happens after you; the strict mode is switched on
  then). A sentence whose verdict is `false` is never matched.
- Report the count of distinct masked reference sentences, by section, and
  how many classes each of the nine languages matches against them.

## 5. Smaller things the re-check found

- **Notes**: a note completed by concatenation with a constant outside the
  notes table is not linted (`note-tail-from-const` in `pnotes.json`). A
  note that is not one plain string literal in the table is a finding.
- **"Unverified 0"** in the block table means only that a compiler for the
  language is on PATH; the changed blocks of the 21 variations are not
  compiled by anything (the lanes compile their own models). Rename the
  column and say so on the screen, in one line.
- The block table's `classes` column is not explained (rb tutorial shows 27
  classes with 1 "otherwise"). Explain it on the screen or in the README.
- The fact sheet lists, for every `cited` fact, the citation's file and
  quote beside the value, and marks the pinned-prose ones: those are what
  the independent reviewer audits one by one.

## 6. The measure H1 is judged by

`sharewords.js` counts as "only this language" every sentence that one
ported language alone prints, although most are written once in shared code
and selected by a result style (go's pair sentences). H1 asks how much
prose cannot be shared, which is prose a language's own files hold. Add the
measure by source: per language and section, the words of the output that
come from the provider's own string literals (its notes, and its
prose-valued facts as substituted into shared sentences), against all prose
words; and beside it the existing "printed by this language alone". Say
exactly what each counts. Report both for the nine.

## 7. Prove it

- `node tools/selftest.js ...`: every earlier control still passes (84),
  plus the new ones; give the count by group.
- The nine one-command checks: say what each prints now. Where a new check
  fails a language at the frozen state (an unattested fact, a sentence
  printed less often than its reference), that is a finding: list each with
  the fact or sentence and the pages, and do not hide it; the next engineer
  decides each by hand.
- `tools/README.md` updated: one line per command, the files a porter
  writes, the outcomes, the new checks.

Report what you ran and what you read. Say what you did not get to.
