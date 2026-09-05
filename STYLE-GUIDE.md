# Documentation style guide

How the Voxgig SDK Generator documentation is written. This guide is
normative for the root [`README.md`](./README.md), every page under
[`docs/`](./docs/README.md) except `docs/design/`, and the packaged
haskell target's
[`packages/sdkgen-haskell/README.md`](./packages/sdkgen-haskell/README.md)
— 30 pages, the ones a reader lands on from GitHub and npm. It exists so
that a page written next year sounds like a page written this year, and
so that a reviewer can point at a rule instead of arguing taste.

It is a port of [jostraca/jostraca](https://github.com/jostraca/jostraca)'s
guide, by way of [voxgig/struct](https://github.com/voxgig/struct)'s,
which share an author and a house voice with this project. The structure
and most of the rules are those projects'. Where this one differs — the
spaced em dash, the working-document set, the shape of the four kinds —
the difference is recorded with the measurement behind it, because a
divergence nobody wrote down reads later as drift.

Three sources feed the guide, in a fixed priority order. The same order is
encoded in [`.vale.ini`](./.vale.ini), and every rule switched off there
names the reason and the count it produced:

    house voice  ->  Google  ->  Vale defaults

1. **This file.** Where it rules, it rules. The house voice is Richard
   Rodger's blog register, and the places it wins are listed with their
   reasons rather than left as silent exceptions: the spaced em dash,
   first-person plural in the tutorial, British spellings, and quotation
   punctuation outside the quotes.
2. The [Google developer documentation style
   guide](https://developers.google.com/style) for everything this file
   does not cover: second person, present tense, active voice,
   sentence-style capitalisation in headings, serial commas, one idea per
   sentence.
3. [Vale](https://vale.sh) defaults, which mostly means spelling.

Two gates check it, and both run in CI:

| Gate | Runs | Checks |
|---|---|---|
| `vale --minAlertLevel=error $(python3 tools/check_prose.py --files)` | `make scan-prose`, `.github/workflows/docs.yml` | Google's rules plus the banned list, at the levels set in `.vale.ini` |
| `python3 tools/check_prose.py` | `make scan-prose`, `make test`, and the same workflow | the banned list, the em-dash spacing and ration, the first-person rules, no emoji, no citations of a working document, that every relative link resolves, and that the page set is complete |

The banned list is read from one file by both, so they cannot drift. The
page set comes from one function, `tools/check_prose.py --files`, for the
same reason: a gate reading a smaller set than the other is a gate that
reports green on a page nobody checked.

A Google rule sitting at `warning` rather than `error` was tried at error
level first and found wrong for these pages; `.vale.ini` records what it
produced and why it was demoted.

## The structure: four kinds, enforced by placement

Every page under `docs/` is exactly one of four kinds, and the kind
decides what the page may do:

| Kind | Files | May | May not |
|---|---|---|---|
| Tutorial | `docs/tutorial.md` | teach step by step, show output for every step, defer detail with a link | argue design, list every option, assume the reader's goal |
| How-to | `docs/how-to/*.md` (13 pages) | solve one named task, assume competence, link the reference | teach basics, explain design, drift into a second task |
| Reference | `docs/reference/*.md` (8 pages) | state facts exhaustively and dryly, pin claims to tests | narrate, persuade, teach |
| Explanation | `docs/explanation/*.md` (5 pages) | argue, compare, admit trade-offs, tell the design's story | be the only place a fact lives |

`README.md` and `docs/README.md` are doorways and belong to no kind: they
route, give the quick start, and state no fact of their own that a page
below them does not also state. The haskell package's README is a
package doorway of the same shape: what the package is, how to install
it, how to develop it, and a link into `docs/` for everything else.

One fact appears in all four kinds at different altitudes — met in the
tutorial, used in a how-to, specified in the reference, argued in the
explanation — but the normative statement lives in the reference and
everything else links to it.

**Documentation never names the framework.** The four kinds come from
`Diátaxis`, and that is a fact about how these pages were planned, not
one a reader needs in order to read them. Say **tutorial**, **how-to**,
**reference** and **explanation**, which are ordinary words that describe
themselves, and let the structure do the explaining. This guide and the
contributor guides are where the name belongs, because there it answers a
question somebody is actually asking.

### These pages document the generator, not a generated SDK

This project has an axis jostraca does not: it emits documentation of its
own. Every generated SDK carries a README, and that README is produced by
components (`ReadmeTop`, `ReadmeRef`, `ReadmeExplanation` and their
per-language delegates), not written by hand.

**A fact about a generated SDK belongs in the component that emits it.**
These pages say what the generator does with a target, a feature or a
model key, and where the generated text comes from; they do not carry a
second copy of what the generated README says, because that copy goes
stale the day the component changes. The feature catalogue documents the
options a feature declares; the generated README documents how to pass
them in one SDK.

**A per-language fact is stated once, against the reference.** The `ts`
and `js` targets are the reference implementation. A page states a
behaviour once, and names a target only where that target diverges — and
then says which test pins the divergence.

## Documentation does not cite a working document

**A documentation page never sends a reader to a plan, a review, a
decision record, or an agent instruction file.** Those are working
documents: written for the people changing this repository, argued rather
than stated, and stale the moment the code moves past them. A reader who
follows a link out of the documentation and lands in one has been handed
the project's notes in place of an answer.

The banned set, by name:

| Document | What it is |
|---|---|
| `AGENTS.md`, `CLAUDE.md` | instructions to contributors and agents working in the repository |
| `ADR.md` | the decision records: the choices everything else is built on, argued rather than stated |
| `NOTES.md` | working notes |
| `docs/design/*.md` | the design proposals, plans and discussion drafts: sdkgen packages, feature tags, the `py-data` target, the vendoring migration, API versioning |
| any `*_PLAN.md` or `*_REVIEW.md`, and `BUILD_LOG.md` | the shapes this project has not needed yet, guarded in advance |

The ban covers the name as much as the link. "The full checklist is in
`AGENTS.md`" fails for the same reason the URL does: the reader still
cannot act on the sentence without leaving the documentation.

State the fact instead. "Fix the template or component, never a generated
file, and mirror a per-language change across every target that has the
same component" is what a reader needs, and a link to the file that also
says so adds nothing to it. The root README and the documentation index
both used to close by sending the reader to the agent guide; both now
state the rule. Eight pages used to point at the packages design note for
what an sdkgen package is; they now point at the how-to that says it.
Where the fact belongs in the documentation and is missing, write it into
the page that owns it rather than pointing outside.

The rule runs one way. Working documents cite each other and cite the
documentation freely, because a decision record that does not show its
working is not a decision record. Only the direction out of documentation
is closed.

### What stays linkable, and why

| Linkable | Because |
|---|---|
| source and tests: `ts/src/`, `ts/test/`, the scaffold under `ts/project/.sdk/`, the base model `model/sdkgen.aon` | code is the thing a claim is pinned to |
| `.github/workflows/` | the release and CI definitions are what the release how-to describes, and a reader can act on them |
| this guide | normative rather than exploratory, and it names the working documents in order to ban them |
| the other READMEs, and the root of a sibling repository (`create-sdkgen`, `station`, `sekreto`) | documentation themselves; a repository root is a doorway, where a design note inside it is not |

The rule behind the split: **a specification is citable, an argument is
not.**

`tools/check_prose.py` enforces this over the reader-facing pages. Vale
does not, because Vale cannot tell a working document from a page.

## The voice

The house voice is Richard Rodger's blog register, adapted per document
kind. The portable part of that voice is its *rhythm*, not its stock
phrases. Ten habits, with the register they apply in:

1. **Open with a concrete fact or a plainly stated problem, then a short
   dry beat.** Tutorial and how-to pages. Reference pages open by stating
   what the thing is.
2. **Introduce code with a short colon-terminated sentence** — "Change
   into the build folder:", "Compile the generator components, then run
   generation:". Never "The following code snippet demonstrates".
   Everywhere.
3. **After a code block, point at the one interesting thing.** Do not
   recap the code. Everywhere.
4. **Parentheses carry definitions, caveats, and at most one dry aside per
   page.** Tutorial and how-to pages. In reference pages, parentheses
   carry facts only — a type, a default, a test name.
5. **A trade-off gets bolted on with a dash, and the dash earns its
   place.** One per paragraph at most, never two in a sentence.
6. **Alternate one long explanatory sentence with one short verdict
   sentence.** The short sentence is the payoff. Everywhere.
7. **Talk to the reader as "you", and route them** ("If you only want the
   CLI flags, skip to…"). "We" appears only in the tutorial, walking
   through code together. "I" appears nowhere.
8. **Show that the code is real.** The snippets on these pages are not
   executed by the gate, so a claim about what the generator emits names
   the test that covers it: `ts/test/generate.test.ts` generates a small
   SDK for every target and asserts on the text, `ts/test/feature.test.ts`
   drives the real feature templates through a simulated pipeline, and
   `ts/test/generatedcompile.test.ts` builds a generated SDK and runs the
   shared feature corpus through it. A reference entry that states an
   edge case names the test that pins it.
9. **Jokes are self-directed or about the industry's mundanity, and the
   register goes fully serious the moment correctness or a user's data is
   on the table.** Never joke about the reader, other tools, or the
   consequences of an overwrite.
10. **Close by handing the reader something**: a link, a next step, one
    sentence. No summary paragraphs that restate the page.

Exclamation marks: at most one per page, in the tutorial only, on a
genuine payoff.

## Banned phrases and patterns

These read as generated filler. Do not use them, in any document,
including commit messages that quote the docs.

**The list itself lives in
[`.vale/styles/config/vocabularies/Sdkgen/reject.txt`](./.vale/styles/config/vocabularies/Sdkgen/reject.txt)**,
one regular expression per line. That file is the single source of truth:
Vale reads it in CI, and `tools/check_prose.py` reads the same file rather
than keeping a second copy, so the two gates cannot disagree about what is
banned. Add a phrase there and both pick it up. What follows is a reader's
summary of it, not a second list; every phrase is shown as code so that
quoting a banned phrase in this guide does not fail the gate.

The list is upstream's, unchanged, and it draws on two sources: that
project's original house list, and [claudisms.ai](https://claudisms.ai/),
a catalogue of the patterns that mark machine-written prose. **It was
measured against these pages before it was adopted.** Six entries fired,
eleven times: `quietly` three times, `honest` three times (once as
`honestly`), `the entire point` twice, and `not just`, `load-bearing` and
`comprehensive` once each. All eleven were rewritten, and nothing was
dropped from the list to make it pass.

**Filler and false emphasis**: `worth noting` · `important to note` ·
`it cannot be overstated` · `at its core` · `when it comes to` ·
`let's break it down` · `here's where it gets interesting` ·
`the point is` · `because it matters`.

**Inflated vocabulary**: `delve` · `dive into` · `robust` · `seamless` ·
`comprehensive` · `holistic` · `intricate` · `leverage` · `foster` ·
`shed light on` · `pave the way` · `pivotal` · `transformative` ·
`game-changing` · `cutting-edge` · `groundbreaking` · `testament to` ·
`paradigm shift` · `realm` · `landscape of` · `underscores the` ·
`lean into` · `throughline` · `double-click on` · `mature setup`.

**Consultant register**: `north star` · `key takeaways` ·
`best practices` (name the practice instead) · `at the end of the day` ·
`pressure-test` · `right-size` · `strategic imperative` ·
`three things to know` · `dispatches from` · `best operators` ·
`lessons learned`.

**Metaphor inflation**: `load-bearing` · `heavy lifting` ·
`is doing the work` · `different physics` · `hits hardest` ·
`quietly` (say `silently`, which is the term of art for a failure that
reports nothing).

**The contrast frame and its cousins**: `not just` · `not only X but Y` ·
`it's not about` · `the whole game` · `the entire point` ·
`the only thing that matters`. Say what the thing is.

**False singularity**: `the right way/answer/tool/question` ·
`the best thing you can do` · `if I had to pick` · `what struck me` ·
`stuck with me` · `struck a chord` · `hit a nerve` ·
`we've seen this movie before`.

**Reflective pose**: `sit with` · `worth exploring/considering/asking` ·
`keeps coming back to` · `that's the tell` · `where I landed`.

**Invented observation about people**: `most people` ·
`everyone I've worked with` · `a lot of folks` · `nobody I know`. If it
did not happen, do not claim to have noticed it.

**Signposting**: `let's explore` · `now let's turn to` · `moving on to` ·
`in today's rapidly evolving` · `reflecting a broader trend` ·
`great question`.

**`honest`, and every form of it**, is banned differently from the rest.
The word is fine English; it is on the list because it had become a tic
across the repositories that share this list, where it flattered a
sentence rather than said anything the sentence did not already say. It
had reached these pages: three times, in the CLI reference and the
feature catalogue, flattering a check ("keeps the checks honest"), a test
("test them honestly") and a failure ("fast, local, honest failures"). The
word came out of each sentence and nothing was lost.

**The gate is absolute, and the lack of an inline exemption is the
point.** There is no `allow` comment and no suppression the second gate
would honour, because an escape hatch that exists is an escape hatch that
gets used. A use the author wants kept is approved by changing
`reject.txt`: one line, in one file, visible in review, which is where an
approval belongs.

### What is not banned, and why

Several entries on claudisms.ai are deliberately absent, because they name
things this project documents. A gate that fires on the subject matter is
a gate people learn to switch off. The same standard governs
`Sdkgen.WordChoice`, which carries three of Google's substitutions and
leaves the rest at warning.

| Not banned | Because |
|---|---|
| `canonical` | It is this project's word for the base model in `model/sdkgen.aon`, and for the `ts` target every other target is checked against. |
| `model` | The unified object generation reads, and the only input it has. There is no other word for it. |
| `surface` | The public API surface a feature must keep out of the way of, and the MCP agent surface station hosts. |
| `real` | `ts/test/generate.test.ts` runs the components for real; the corpus lanes build a real SDK with a real toolchain, as opposed to a simulated pipeline. |
| `hold`, `carry`, `hands` | A feature container carries a vendored port, a model file holds provenance, an op hands back the entity. |
| `lives` | `parity is where the tier now lives` is the migration how-to, and `the normative statement lives in the reference` is this guide. |

The rule behind the list: ban the phrase that adds nothing, never the word
that names a thing.

**Matching spans a line wrap.** These pages hard-wrap, and most of the
list is multi-word, so the gate joins each paragraph before matching:
`worth\nnoting` fails exactly as `worth noting` does. Upstream records
that the day its gate started reading paragraphs it found two phrases that
had been passing since the gate was written, each saved only by where its
line happened to break.

**Patterns** (not mechanically checkable, enforced at review):

- Announcing structure before delivering it ("There are three things to
  understand").
- Restating the question before answering it.
- A closing one-liner that restates the thesis.
- Stacked short declaratives (four or more in a row).
- Superlative self-ranking ("the most important thing", "the part that
  matters most").
- A list of `**Bold term**: explanation` pairs, which is the single most
  recognisable machine-written list. Write sentences, or a table.

## Punctuation rulings

**The em dash is spaced here**: `a dash — like this`. This is the one
place where the guide contradicts both Google and jostraca, and it is the
Voxgig convention rather than drift — 314 spaced dashes across the 30
pages when the gate was written, and not one unspaced. `Google.EmDash` is
therefore off, and `tools/check_prose.py` `em-dashes-are-spaced` enforces
the convention in the other direction: an unspaced dash fails.

Dashes stay **rationed to one aside per line**: either a single dash
before a trailing clause, or one matched pair around a parenthetical,
never both and never two asides. Three on a line is the stacking the
ration exists to stop. Prefer a comma or parentheses when the aside is
mild.

The rest:

- In a link list, separate the link from its gloss with a full stop, not a
  dash:

  ```markdown
  - [Generate your first SDK](docs/tutorial.md). From an OpenAPI spec to a tested TypeScript SDK.
  ```

- **Every relative link must resolve, and stay inside the repository.**
  `tools/check_prose.py` checks the path, not the anchor, since a heading
  slug depends on the renderer; it reads both `[text](target)` and
  `[text][label]` with its definition. A target that resolves on a Linux
  runner but climbs out of the checkout resolves nowhere on GitHub or in a
  published package, so it fails too. The day the check was written it
  found two broken links, both in the model reference and both to
  `model/sdkgen.aontu`, a file that had been renamed `sdkgen.aon`; they
  were retargeted.
- No emoji in documentation.
- Sentence-style capitalisation in headings (Google style), except where
  the heading names a proper noun or a code identifier: `CLI:
  voxgig-sdkgen`, `Bind imperatively: connect() and adopt()`.
- British spellings (`-ise`, `-isation`) for new prose. Google style is US
  English and so is the dictionary; this is one of the places the house
  voice wins, and
  [`accept.txt`](./.vale/styles/config/vocabularies/Sdkgen/accept.txt)
  carries the British forms — **listed one by one**, never matched by
  suffix, because `\w+ise` accepts any word ending in those three letters
  and punches a hole straight through the spelling gate. A US spelling
  already on a page is not a defect, and a filename keeps whatever
  spelling it was created with.
- Quotation punctuation goes **outside** the quotes, against US
  convention, because putting a period inside a quoted `code span` is
  actively wrong when the quote is a literal.

## Terminology

- The project is **Voxgig SDK Generator**, or **sdkgen** in prose; the
  package is `@voxgig/sdkgen` on npm and the command is `voxgig-sdkgen`.
  Never "the SDK" for the generator: an SDK is what it emits.
- **model** — the single unified object generation reads, assembled by
  aontu from the base schema, the target and feature definitions, and the
  project's own files. It is the only input; a page never describes the
  generator reading the OpenAPI spec directly, because it does not.
- **target** — a language (or a consumer such as `go-cli`) the generator
  can emit, defined by a model file, templates and components. Say
  **target** for the definition and **SDK** for what a run produces.
- **template** and **component** — the two layers of a target. A template
  is plain target-language source copied with placeholder substitution,
  the same for every API; a component is TypeScript that generates the
  API-specific source. The decision rule is *same for every API →
  template; depends on the API → component*, and a page states which
  layer a file is in before saying how to change it.
- **feature** — an opt-in behaviour a generated SDK carries (`retry`,
  `cache`, `test` and the rest), either a **transport wrapper** or a set
  of **pipeline hooks**; the feature model declares which. Features are
  off by default and a page says so.
- **sdkgen package** — a folder holding a `sdkgen-package.json` manifest
  beside a `.sdk/` directory shaped like the bundled scaffold. The bundled
  scaffold, `ts/project/`, is itself one. Say **scaffold** for that tree
  and **project** for the consumer's `.sdk/`.
- **add** and **generate** overwrite. Say **overwrite** or **regenerate**,
  never "merge" or "update in place", for what either does to a file it
  owns; a hand edit to a generated file or a copied template is lost on
  the next run, and a page that describes such an edit says so.
- **doctor** reports **drift**: a copied tree or model file that differs
  from the source it records. Its verdicts are **forked**, **edited**,
  **stale** and **missing**, and a page uses those words rather than
  "changed" or "out of date".
- **active** — an entity or feature the model switches on. Say **active**
  and **inactive**, not "enabled" or "included", because `active: false`
  is the key a page is talking about.
- **apidef**, **aontu**, **jostraca** — the tools the pipeline is built
  from, lowercase in prose as in code: apidef turns the spec into the
  model, aontu unifies it, jostraca renders it.

## Templates, kind by kind

**Tutorial** (`docs/tutorial.md`): goal sentence → snippet → output → the
one observation → forward link. Every step's output shown.

**How-to guide** (`docs/how-to/`): title is the task in imperative or
"-ing" form; one sentence of situation; the recipe; one paragraph of what
to watch for; links to the reference for the constructs and to the
tutorial for the basics it assumes.

**Reference page** (`docs/reference/`): definition, then behaviour, then
edge cases, then a pinned example. Every claim that has a test can name
it.

**Explanation page** (`docs/explanation/`): the question, the answer, the
argument, the trade-off admitted. May quote history when the history is
the argument.

## Updating this guide

Change it the way behaviour changes: in the same commit as the first page
that follows the new rule, with the reasoning in the commit message.

To ban a phrase, add the regular expression to
[`reject.txt`](./.vale/styles/config/vocabularies/Sdkgen/reject.txt)
and summarise it in the preceding list. Both gates pick it up from that
one file; there is no second list to update, and `tools/check_prose.py`
names this file, so a drift is a build failure with a pointer.

To change a Google rule's level, edit [`.vale.ini`](./.vale.ini) and write
down what the rule produced on a clean run. "It was noisy" is not a
reason; "it maps `touch` to `tap`, and it objects to `snake_case`, which
this project names on purpose — 22 hits" is. A rule demoted without that
note reads later as an oversight, and gets re-promoted by someone
repeating the work.

To widen what the gates read, change the configuration block at the top
of `tools/check_prose.py`. Both gates take their file set from it, so
widening it once widens both — and a page added to the repository without
being added there is a page neither gate has ever read.
