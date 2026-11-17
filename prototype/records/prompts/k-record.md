# k-record: write the record of the prototype, as far as it has got

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/record/`. Write nowhere else. Everything else under
`P` and everything under `/home/user` is read-only.

Read first: `P/brief.md` (the proposal and the hypotheses), then
`P/brief5.md`, `P/brief6.md` and `P/brief7.md` (the rule each later round
added, in its first section). Then the documents the record sits beside in
the repository, for their voice and conventions:
`/home/user/sdkgen/docs/design/model-dependent-text.md` (the design note)
and the first 60 lines of
`/home/user/sdkgen/docs/design/model-dependent-text-issues.md` (the
catalogue). The digests of the prototype's records, made by six readers,
are given below this file's text in your instructions. The records
themselves are in `P/results/` (`.txt` and `.json`): open one whenever a
digest is unclear, thin, or disagrees with another.

## The job

Write `P/record/model-dependent-text-prototype.md`: the record of a
prototype that tested a design proposal, for the maintainers of the
repository, who have not followed the work. It will be committed under
`docs/design/` beside the design note and the issue catalogue. It is a
record in progress: thirteen of twenty languages are ported, seven are
being ported, and three measurements are still running (the catalogue
against the ported sections; existing projects, packs and aliases on the
real structure; the measures at twenty languages). Write it so that those
results can be added later without rewriting what is there.

The reader wants to know, in this order: what was proposed; what would
have refuted it, as fixed before anything was built; what was built and
how it was checked; what was measured, hypothesis by hypothesis, for and
against; what the build found that the proposal did not say; what it
cost; what this evidence cannot show; what is not done yet.

### The outline

```
# Prototype: the generated text written once, measured

Status line: a record in progress, the date 2026-11-15, what is in and what is not.

## 1. What was tested
   The proposal in one paragraph: the model decides what is said, once; a
   language supplies how its runtime spells it, and nothing a language
   supplies can see the model. What a language supplies (a naming hook, a
   syntax provider of printers and declared facts, the forms the guard
   reads); what is shared. The three sections under test and the twenty
   bundled languages. The five hypotheses with what would refute each, as
   a table, in the words of P/brief.md.
## 2. How it was tested
   The stages, as a table: what each built, with how many builders, and
   which independent check followed. The rule each round added and the
   finding that forced it. What "ported" means: the one command, the
   guard, the review tools, the hand records. Which toolchains the
   environment had and lacked (a fact about that environment, said as
   such).
## 3. Results so far, hypothesis by hypothesis
   H1 to H5, each: the evidence for, the evidence against, the numbers
   with who measured them (builder or independent) and whether they were
   run or read, and the standing at this point: holds, refuted on which
   criterion, or not yet measured. Do not give an overall verdict: the
   work is not finished.
## 4. What the build found that the proposal did not say
   For example: shared sentences that were false of some runtimes, and
   what fixing one once took; that a declared fact needs a check, and
   what the guard catches and cannot; what "the same sentence" has to
   mean before a sentence can be reviewed once; that the comparison with
   the old page is a reading aid and not a check. Then two lists: defects
   of the generated runtimes found by reading them for the documentation,
   and defects of the pages and tests of main found on the way. Each list
   entry is one line with the language and the file where the record
   gives them.
## 5. What it cost
   Interface changes by round (breaking, additive, cause, and how many a
   newly ported language caused). Review labour (classes decided by hand,
   records, controls that had to be re-aimed when shared text changed).
   The review tools (what they are, the self-test's size and time). The
   effort of one port in the first wave.
## 6. What this evidence cannot show
## 7. Not done yet
## Appendix A. The thirteen languages at version 3.3 (one row each)
## Appendix B. Interface changes, one row each
## Appendix C. Attacks that nothing mechanical catches
```

Change the outline where the material demands it, and say that you did.

### How to write it

- Plain technical English, for a reader who is intelligent and was not
  there. Lead each section with what was found; give the number; say who
  measured it. Keep sentences short. No first person, no rhetorical
  questions, no emoji, and no dash used as punctuation (use a comma, a
  colon, parentheses or a new sentence).
- Every number comes from a digest or a record and is given with enough
  context to be checked: what it counts, at which version. When two
  records disagree, say so and say which stands. A number that a later
  round replaced is not quoted as current.
- Evidence against the proposal gets the same space and care as evidence
  for it. Two hypotheses are refuted on at least one criterion already
  (the source did not shrink by half once the guard is counted; the
  interface needed more breaking changes than the limit): say so plainly,
  with the numbers, and say what the criterion did and did not measure.
- The prototype's files are not in the repository. Refer to them as the
  catalogue refers to its prototypes ("their working files are not in
  this repository"); never give a path under a temporary directory. Paths
  of the repository's own files are given as they are in the repository.
- Do not name any AI model or tool. The people are "the builder", "the
  porter", "the reviewer", "the checker".
- The stages have internal names in the records (3a, 3a-fix2, v3.2,
  "brief 7", "wave 1", T7, G1 to G8). The reader does not know them:
  describe a stage by what it did, and use a short name only after
  defining it. Version numbers of the interface (3.1, 3.2, 3.3) may be
  used once defined.
- Length: as long as the evidence needs; expect 500 to 900 lines. Tables
  for numbers; prose for what they mean.

Then read your document as a maintainer who must decide whether to adopt
the proposal: list what they would ask that it does not answer, and
answer what the records can.

## What you report

The path of the document, its length, the outline as written (with any
change and why), the questions you could not answer from the records, and
every place where two digests or records disagreed and what you wrote.
