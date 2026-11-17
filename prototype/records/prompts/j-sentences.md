# j-sentences: read every shared sentence once, as a person

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `sentences`; your directory is `P/sentences/`. Write nowhere
else. `P/base32` is read-only: copy what you need.

Read first: `P/brief.md`, `P/brief3.md`, `P/brief4.md`, `P/brief5.md`, then
`P/base32/tools/README.md` (the part on `sentences.js` and
`reviewed/sentences.json`) and `P/base32/PORTING.md` section 5 (how a new
port's sentences are matched).

## The job

The design under test says: a sentence is written once, in shared code,
and reviewed once; a language only supplies the tokens in it. When a new
language is ported, every sentence it prints that equals a reference
sentence (after its own tokens are masked) is accepted without a person
reading it. That is only sound if the reference sentences were read. Most
were accepted by pattern rules in an earlier stage, and nobody has read
them since.

You read them: every distinct masked sentence the nine ported languages
contribute as a reference, in the tutorial, the root quick start and the
REFERENCE page.

```sh
mkdir -p P/sentences && cd P/sentences
cp -a P/base32/tools tools
node tools/sentences.js --help        # how to export the list; the README says where the output is
```

For each sentence, with its concrete examples in two or three languages
and the shared source that prints it (`P/base32/sdkgen/ts/src/cmp/ReadmeRef.ts`,
`ReadmeQuick.ts`, `ReadmeRefFeatures.ts`, `ts/src/helpers/runtimeprose.ts`,
`example.ts`):

- **Is it true** of every language that prints it? A sentence states
  something about the SDK: check it against the runtime of at least two
  languages that print it, of different families
  (`P/base32/sdkgen/ts/project/.sdk/src/cmp/<lang>/`, `tm/<lang>/`), and
  against the model where it states something about the API. Give file and
  line for a sentence you call false.
- **Is it one sentence?** Two masked sentences that say the same thing in
  different words are a place where shared code says one thing two ways,
  or where one language's old wording survived: list the pairs.
- **Does the mask hide a claim?** Where the masked slot carries the whole
  claim (the sentence is true or false only by its token), say which fact
  the truth then rests on, and whether that fact is derived, cited or
  pinned prose in the guard's report
  (`SDKGEN_GUARD_REPORT=1 node --test --test-name-pattern 'account, per language' dist-test/runtimefacts.test.js`
  in a copy of the clone).
- **Is it good?** Awkward, vague, or saying less than the old page's
  sentence did for the same place (the old pages are in `P/base32/out/old`).

Record a verdict per sentence in `P/sentences/sentences.json`, in the
format `reviewed/sentences.json` takes: `ok`, `false` or `awkward`, with a
note. Do not change shared code or providers: list each fix as an entry
(the file, the sentence, what it should say and why).

Work through them in order of how many languages and classes share each
sentence, so that if you do not finish, what is left matters least. Say
exactly how many you read of how many, by section.

## What you report

The counts (distinct sentences by section; verdicts by kind); every `false`
sentence with its evidence; the pairs that say one thing two ways; the
sentences whose truth rests entirely on a masked fact, with that fact's
account; the fixes, as entries. And two numbers for the design: how many
distinct sentences the three sections of nine languages come to, and how
many of them only one language prints. Separate what you ran from what you
read.
