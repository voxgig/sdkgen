# h-tools: a review process that cannot accept a false fact

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `h-tools`; your directory is `P/h-tools/`. Write nowhere else.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md` (what
the independent check found, the two layers, and the rules of this stage).
Then, in `P/results/s3a-check.txt`: `claims` [9] to [11], `tool_controls`,
`misclassified`, `ready_to_port`; in `P/results/s3a-pilot.txt`:
`guide_problems`; and `P/freeze/tools/README.md`. The check's own scripts are
in `P/check-v3/mine` (`myinject.js` with `inj1.json`, `inj2.json`,
`inj4.json`; `autoclass.js` with `inj3.json`; `autoclass2.js`;
`puritymut.js` with `pmuts.json`, `pmuts-notes.json`): reuse them on copies.

## The job

The ledger and the blocks tool flag what changed between the old output and
the new (24 of 24 injected regressions). The layer on top, which records a
reviewer's outcome for each changed class, is unsound: `my/rules.js` matches
loose patterns across every language and accepted injected false sentences
automatically, and its last rule switches the cross-document check off. Eleven
more languages are about to be ported by eleven engineers working in parallel,
each followed by an independent reviewer. You give them a process in which
nothing is accepted because a broad pattern matched it, and in which no two
of them edit the same file.

You work on review tooling and on generated OUTPUT, not on sdkgen's source.
Two engineers change the source in parallel (`P/h-shared`, `P/h-guard`): do
not touch their directories and do not wait for them.

Set up:

```sh
mkdir -p P/h-tools && cd P/h-tools
cp -a P/pilot-rb/tools tools && cp -a P/pilot-rb/my my && cp -a P/pilot-rb/harness harness
# output to work on: P/pilot-rb/out/old and P/pilot-rb/out/new (nine languages ported, rb included); read-only
# providers and their compiled form: P/pilot-rb/sdkgen (read-only; never build in it: copy it if you need a build)
```

Confirm the handed state first: `./portcheck.sh` passes for rb and for ts
with the pilot's files.

## 1. One directory, and a file per language

Fold `my/` into `tools/`. Everything a porter or a reviewer writes is in a
file of that language alone: the outcomes (`classes/<lang>.json`), the hand
entries, any block corrections particular to the language, the accepted
purity findings. Classifying one language never rewrites another's file. A
porter never edits a file another porter edits. Say in the README which
files are shared (read-only for a porter) and which are per language.

## 2. Classification that follows the two layers

a. **No rule spans languages.** Each existing rule in `rules.js` records the
   languages whose classes were read when it was written (the eight of stage
   3a; not rb, whose pilot leaned on those rules), and applies to no other.
   A rule with no language list is an error. Remove `echo-agrees`.
b. **Shared sentences, matched exactly.** A newly ported language prints the
   sentences the reference languages print, with its own fact tokens in
   them. Read the language's declared facts from its compiled provider
   (`<clone>/ts/dist-test-scaffold/.sdk/dist/cmp/<lang>/Syntax_<lang>.js`:
   `facts`, `ref.facts`, and what the naming hook gives through the
   description), mask those tokens in each unit, and compare with the
   reviewed classes of the reference languages masked with their own tokens.
   An exact match is recorded as the shared sentence it is, automatically,
   naming the reference language and class. Anything that does not match
   exactly is classified by hand for that language. Be strict about what is
   masked: a token must be a declared fact value, matched as a whole code
   span or whole word; say how you avoid masking a short token everywhere.
c. **A missing unit is never accepted automatically.** Something the old
   page said and the new one does not is classified by hand: restored (where),
   or dropped (why).
d. **A fact sheet per language** (`review/<lang>/facts.txt`): every declared
   fact with its value, each place a shared sentence substitutes it (one
   example unit, old text beside new), and a column for its account (derived
   by the guard, cited, language, convention), read from the guard's report
   when the clone's guard prints one (`SDKGEN_GUARD_REPORT=1`), else blank.
   Matching a shared sentence says nothing about whether the fact in it is
   true; the fact sheet is what the reviewer audits.
e. **Cross-document disagreements are counted, not hidden.** An `echo` class
   (a value the ported section changed that the same SDK still states
   differently elsewhere) gets its own outcome, `contradiction`, with where
   the other statement is and which side is true with the evidence. It does
   not fail the check; the count and the list print in the summary. An echo
   may be `same-meaning` only with a reason.
f. Outcomes otherwise as now. Keeping `n` (RECOUNT) stays.

Prove it:

- The check's four automatically accepted injections (py "`ok` is `True`",
  go "except for a non-2xx response", py "returns `None` on failure", ts
  `region` "Required." rebuilt from scratch) and its zig type echo are all
  left for a human.
- All 24 of the check's injected regressions are still flagged; recall on
  the stage-2 worklists is still 49 of 51 (`recall.js`).
- Positive control: for rb, how many of its classes are matched as shared
  sentences, how many are left for a human, and ten of each quoted. For one
  of the eight (py), taken as if newly ported against the other seven: the
  same numbers.
- Report how many of the eight languages' existing classifications came from
  rules, and how many a human gave; do not re-review them (the next engineer
  does that on corrected output).

## 3. The note lint and purity

- The note lint finds every provider's notes (it requires `notes` at column
  0 today and has never seen one). A provider that declares notes in which
  the lint finds no region is an error. The check's five injected notes are
  flagged; the four real providers' notes are clean.
- Purity also flags: a model read through a parameter or a cast
  (`(desc as any).features`, `m.main.kit...`); a condition on what the
  description says is shown, however it is spelled; an inline reserved-word
  test in a hook. Re-run the check's 13 purity mutations and report each.

## 4. Sharing, measured by sentence

`share.js` counts a unit as "only this language" whenever a fact token in it
differs (go's tutorial reads 62.6%). Using the masking of part 2, report per
language and section: words in units that are a shared sentence with this
language's facts; words in units only this language prints; words in notes.
And at the source: words in each provider's notes and prose literals,
against the words of the shared sentence templates
(`ts/src/helpers/runtimeprose.ts`, `ts/src/cmp/ReadmeRef.ts`,
`ts/src/cmp/ReadmeQuick.ts`, `ts/src/cmp/ReadmeRefFeatures.ts`). These are
the numbers H1's "unshareable per-language prose" will be judged by, so say
exactly what each counts.

## 5. Blocks

There are two sources of corrections (`tools/corrections.json`, and the
normalizers in `harness/corrections.js`, several of which name the ported
languages in a regex), so a newly ported language gets "identical after
corrections: 0" and must explain every changed block by hand. Make one
source. A normalizer says what it undoes and applies wherever its pattern
does, not to a list of languages; one that is truly particular to a language
lives in that language's file. Show rb's block table before and after
(identical; identical after named corrections; changed by a named
unification; changed otherwise), and that the eight languages' tables do not
change.

## 6. The one command

`portcheck.sh <clone> <out-root> <lang>` prints one screen: per section, the
ledger (same, shared sentences matched, by hand, missing, unclassified,
defects), contradictions, the blocks (identical, corrected, unified,
otherwise, and how many changed blocks are unverified for want of a
compiler: check with `command -v`, zig is present now), purity (open,
accepted, note regions found), the guard for the language, and the path of
the fact sheet. It exits 1 on anything unclassified, a defect, an impure
provider, notes with no region, or a failed guard. `REGEN=1` regenerates;
say what it skips (the go alias variation) so that a count of variations is
never silently short. Add a script that makes a porter's workspace from a
base directory in one step (a copy of the clone and of the tools; the old
output linked, not copied).

## 7. The tools test themselves

One command runs the controls of parts 2, 3 and 5 and fails if a tool has
gone blind (an injected regression not flagged, an injected false sentence
accepted, a note not found).

Write `P/h-tools/tools/README.md`: one line per command, the files a porter
writes, the files a reviewer reads, and the outcomes.

Report what you ran and what you read. Say what you did not get to.
