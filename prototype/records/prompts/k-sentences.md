# k-sentences: read every shared sentence once, as a person

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Three reviewers share this job. Your part is named at the end of your
instructions; it is written `PART` below (`A`, `B` or `C`). Your directory
is `P/sentences/PART/`. Write nowhere else. `P/base32` and
`P/sentences/tools` are read-only.

Read first: `P/brief.md`, `P/brief3.md`, `P/brief4.md`, `P/brief5.md`, then
`P/base32/tools/README.md` (the parts on `sentences.js` and
`reviewed/sentences.json`) and `P/base32/PORTING.md` section 5 (how a new
port's sentences are matched).

## The job

The design under test says: a sentence is written once, in shared code,
and reviewed once; a language only supplies the tokens in it. When a new
language is ported, every sentence it prints that equals a reference
sentence (after its own tokens are masked) is accepted without a person
reading it. That is only sound if the reference sentences were read. Most
were accepted by pattern rules in an earlier stage, and nobody has read
them since: 297 distinct masked sentences, 229 of them accepted by rule
records alone.

The list is already exported:

- `P/sentences/tools/review/sentences/sentences.json` (`list`: one entry
  per sentence with `id`, `section`, `kind`, `masked`, `example`, `langs`,
  `classes`, `by`, `template`) and `sentences.txt` beside it.
- Your share: **A** = every sentence of section `tutorial` or `rootquick`
  (90); **B** = section `reference` whose `id` starts with a digit `0` to
  `7` (100); **C** = section `reference` whose `id` starts with `8`, `9` or
  a letter `a` to `f` (107). You give a verdict for every sentence of your
  share and for no other; you read the whole list when you look for pairs.

For each sentence of your share, with its concrete text in two or three
languages (find the units in `P/base32/out/new/<variation>/...`; the
entry's `example` says where one is) and the shared source that prints it
(`P/base32/sdkgen/ts/src/cmp/ReadmeRef.ts`, `ReadmeQuick.ts`,
`ReadmeRefFeatures.ts`, `ts/src/helpers/runtimeprose.ts`, `sdkdesc.ts`,
`example.ts`; `template` names the file where the tool found it):

- **Is it true** of every language that prints it? A sentence states
  something about the SDK: check it against the runtime of at least two
  languages that print it, of different families where two print it
  (`P/base32/sdkgen/ts/project/.sdk/src/cmp/<lang>/`,
  `ts/project/.sdk/tm/<lang>/`), and against the model where it states
  something about the API (`P/base32/harness` holds the models of the
  variations). Give file and line for a sentence you call false. A
  sentence only one language contributes is checked against that one
  runtime.
- **Is it one sentence?** Two masked sentences that say the same thing in
  different words are a place where shared code says one thing two ways,
  or where one language's old wording survived: list the pairs (either
  member in your share).
- **Does the mask hide a claim?** Where the masked slot carries the whole
  claim (the sentence is true or false only by its token), say which fact
  the truth then rests on, and whether that fact is derived, cited or
  pinned prose in the guard's report. The report is already written:
  `P/v32/logs/guard-report.txt` (if it is missing, in a copy of
  `P/base32/sdkgen` under your directory run
  `SDKGEN_GUARD_REPORT=1 node --test --test-name-pattern 'account, per language' dist-test/runtimefacts.test.js`
  in `ts/`, with `/opt/node24/bin` first on your PATH).
- **Is it good?** Awkward, vague, or saying less than the old page's
  sentence did for the same place (the old pages are in
  `P/base32/out/old`).
- **Who prints it?** For a sentence a single language contributes: is it
  that runtime's own fact (then it should be a note or a fact, and is it?),
  shared code that only one result style or one language's shape selects
  (say which condition), or one language's old wording that survived?

One question is already open, for whoever has it in their share: the
shared heading "Instance <noun>" reads oddly for c, clojure and elixir,
whose members are module functions taking the client. Say what it should
be.

Record a verdict per sentence in `P/sentences/PART/sentences.json`, in the
format `reviewed/sentences.json` takes
(`{ "sentences": { "<id>": { "verdict": "ok|false|awkward", "note": "..." } } }`).
Do not change shared code or providers: list each fix as an entry (the
file, the sentence, what it should say and why).

Work through your share in order of how many languages and classes share
each sentence, so that if you do not finish, what is left matters least.
Say exactly how many you read of how many.

## This job can be interrupted

Write your verdicts to the file as you go (every ten sentences), and keep
`P/sentences/PART/PROGRESS.md` (what is done, what you found so far). If
the verdict file exists when you start, an earlier run was interrupted:
keep its verdicts and continue with the sentences that have none. Other
engineers share this machine (4 CPUs): no heavy command is needed for this
job; if you run the guard report, run nothing else beside it.

## What you report

The counts (sentences in your share, read, verdicts by kind); every
`false` sentence with its evidence; the pairs that say one thing two ways;
the sentences whose truth rests entirely on a masked fact, with that
fact's account; the awkward ones with a better wording; the fixes, as
entries; and for the design, of the sentences in your share that a single
language contributes: how many are that runtime's own fact, how many are
shared code one condition selects, how many are old wording that survived.
Separate what you ran from what you read.
