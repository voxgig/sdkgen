# k-general: how far the proposal reaches across the issue catalogue

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
You write nothing to disk. Everything under `P` and `/home/user` is
read-only for you. Your product is the structured result you return.

Read first: `P/brief.md` (the proposal and its hypotheses). Then the first
50 lines of the catalogue,
`/home/user/sdkgen/docs/design/model-dependent-text-issues.md` ("How to
read an entry": what Fate, Class and Where mean), and the entries of your
slice, which is named at the end of your instructions. Then
`P/results/s2-restanatomy.txt` (an analyst's reading of the README
families the prototype did not build: which are restatements of facts the
shared description has, and which are documents about one language) and
the scope table in `P/h3/PROGRESS.md` (which 38 entries fall in the three
sections the prototype built, and which 5 concern the language pack only).
The repository at the commit the catalogue was read against is
`/home/user/sdkgen` (its `main` content is what `git -C /home/user/sdkgen
show 9aebaf9e:<path>` prints): open a source file whenever an entry's
Where does not settle its class.

## What is being asked

The proposal under test: **the model decides what is said, once; a
language supplies how its runtime spells it, and nothing a language
supplies can see the model.** A prototype built it for three sections of
the generated documentation (the README tutorial, the root README quick
start, the REFERENCE page), which hold 38 of the catalogue's 329 entries.
The maintainers asked whether there is a general solution, or only a long
list of individual fixes. So: for each of the other entries, what would
this proposal do? Classify every entry of your slice. Do not be kind to
the proposal: an entry it does nothing for is the finding.

## The classes

Give each entry exactly one:

- **T, tested.** One of the 38 entries the scope table marks `yes` or
  `part`. Do not reclassify; copy it.
- **S, the same mechanism, not tested.** The wrong text is written by a
  per-language documentation component of a section the prototype did not
  build (for example `ReadmeModel_<lang>`, `ReadmeEntity_<lang>`,
  `ReadmeHowto_<lang>`, `ReadmeIntro_<lang>`, `ReadmeTopHowto_<lang>`,
  `ReadmeTopTest_<lang>`, the per-language agent guide pieces), and the
  sentence or example depends on the model or on a fact about the runtime
  that many languages share. Writing that section once, with the
  language's provider supplying spelling, would fix it once. Say whether
  the fix needs only the model (`model`) or also a fact each runtime
  declares (`runtime fact`).
- **L, one language's own.** The wrong text is about one language or
  runtime (its install command, its module tree, an idiom), or the defect
  is in one language's component and is not a sentence other languages
  repeat. Under the proposal it stays an edit in that language's own
  file.
- **O, written once already.** The text is written by a shared component,
  helper or frame, for every language at once. It is one edit with or
  without the proposal. Say whether the edit needs a model fact that no
  shared function gives yet (`needs a derivation`) or is a plain edit
  (`plain`).
- **C, a consumer target or provider.** Written by the Main of go-cli,
  go-mcp, py-data or the infrastructure pack's provider: one writer each,
  no sentence shared across languages.
- **G, generated source, not documents.** A runtime template, a fragment,
  a generated test, or a comment in generated code. Say `comment` (a
  sentence in a source comment that depends on the model) or `behaviour`
  (the generated code or test does the wrong thing).
- **K, the tools.** A defect of the generator's own actions, doctor, CLI,
  build, guard or tests, or of another repository's tool (docgen,
  create-sdkgen, apidef, the model compiler): not generated text.
- **P, a pack's text.** Text written by the language pack's or the
  infrastructure pack's own components, which would follow whatever sdkgen
  does.
- **N, not a defect.** The catalogue's Fate says so.

An entry that names sites of two classes takes the class of the site that
carries most of the work its Fix describes, and you say so in `also`.
Where the Fate says the entry repeats another, record the id it repeats.

## What you return

For every entry of your slice: its id; the class; the sub-class where the
class has one; the catalogue's own "where written" value from its Class
line (`neutral-component`, `per-language-copy`, `helper`, `template`,
`fragment`, `consumer-main`, `action`, `model-schema`, `test`,
`target-or-feature-model`, `other`); the component or file that decides
it; `repeats` (an id, or empty); `also` (a second class, or empty); and
one sentence of reason that a reader could check. Then the counts per
class for your slice, and the three to six entries you were least sure
of, with what would settle each. Do not skip an entry: the number of rows
you return must equal the number of entries in your slice, and you say
what that number is.
