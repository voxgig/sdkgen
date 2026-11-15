# tools: review of a ported section, one language at a time

Node 24 (`export PATH=/opt/node24/bin:$PATH`). One directory: what used to be
`my/` (classify, rules, manual entries, the block explainer) is folded in, and
the block normalizers of `harness/corrections.js` and `corrections.json` are
one source, `normalizers.js`. Languages, titles and ported sets come from
`ported.json`; every tool also takes `--lang` / `--section`. An output root
holds `old/` and `new/`, one directory per model variation.

## Commands, one per line

- `./mkworkspace.sh <base> <lang> [<clone>] [<out-old>]` — a porter's workspace in one step: a copy of the clone, a copy of these tools, `out/old` linked (never copied), `out/new` empty.
- `REGEN=1 ./portcheck.sh <clone> <out-root> <lang>` — everything below for one language on one screen; exit 1 on anything open (RECOUNT and INVALID included, and a shared sentence printed less often than its reference), a defect, an impure provider, declared notes the lint did not read, a language or convention fact the OLD page does not attest and no hand record explains, or a failed guard. `REGEN=1` regenerates `new/` first and prints what it SKIPPED (the `alias-go2` variation is skipped unless the clone sits inside the workspace), so a short count of variations is never silent. `SCRATCH=1` runs it from scratch (no hand entries, rule records or hand-recorded facts; classes to `review/<lang>/scratch-classes/`), as for a language nobody has reviewed. `STRICT_SENTENCES=1` also fails on a shared match against a reference sentence with no verdict.
- `node classify.js --clone <c> --old <r> --new <r> --lang <l>` — writes `classes/<l>.json` (and only that) from hand entries, stage-3a rule records for that language, and exact shared sentences; leaves the rest in `review/<l>/<section>.open.json`. A shared sentence printed MORE often in a variation than any reference prints it (a duplicate), or LESS often than the reference it matched (a dropped sentence: the variations are named in the hint), is left open. Writes `review/<l>/<section>.absent.json`: sentences every reference language of the same result style prints in a variation and this language prints nowhere (code spans compared as placeholders; not failed; the porter says why in `hand/<l>.json` `absent`). Every `shared:` record names its reference sentences and how many have no verdict; a sentence marked `false` is never matched. `--scratch` ignores hand and rule records (a language taken as newly ported); `--refs` names the reference languages; `--human-only` matches only against classes a person classified; `--sentences <file>` another verdict file.
- `node ledger.js --old <r> --new <r> --lang <l>` — every prose unit of OLD against NEW (same / reworded / missing / added; dangling; echo); per class: shared, by hand, missing, contradictions, open.
- `node blocks.js --old <r> --new <r> --lang <l>` — every OLD block against NEW: identical, corrected, unified, otherwise; only "otherwise" makes a class; UNVERIFIED when no compiler (`command -v`, per `ported.json`) is on PATH; a changed normalizer count (`counts/<l>.json`) is open. `--record-counts` records the counts (a person's step).
- `node blocktable.js <old> <new> <lang>..` — the block table, per language and section.
- `node factsheet.js --clone <c> --old <r> --new <r> --lang <l>` — `review/<l>/facts.txt` and `facts.json`: every declared fact, its value, where a shared sentence substitutes it (OLD beside NEW), its account from the clone's guard report, for a cited fact its file and quote (PINNED where the value is prose no quote can hold: the reviewer audits each), and for a `language` or `convention` fact whether the OLD page attests it (below). Fails on a fact with no account or an unattested fact. `--scratch` ignores hand-recorded facts; `--guard-report <file>` caches the guard's report.
- `node sentences.js --clone <c> --old <r> --new <r> [--match]` — every distinct masked sentence the reference languages contribute (the NEW side of their reviewed reworded and added classes): its id, masked text, an example (language, variation), how many languages and classes share it, how those were accepted (by hand, by a stage-3a rule record), the shared source file whose literals print it where found, and its verdict. `--match` adds, per reference language taken from scratch, how many of its classes match a reference sentence. Writes `review/sentences/sentences.{json,txt}`; reads, never writes, `reviewed/sentences.json`.
- `node purity.js --providers <clone>/ts/project/.sdk/src/cmp --lang <l> --root <new>` — model reads (under any name or cast), conditions on the description (cast, bracket, alias, destructuring), reserved words (list or inline test), name surgery, operation literals, notes (found at any indentation; a declared note outside every region read is an error; a note naming a feature, option, entity or operation, or stating a number, is a finding).
- `node puritymut.js <mutations.json> <copy of cmp> <new>` — each provider mutation must be an open purity finding.
- `node sharewords.js --clone <c> --root <new> [--lang ..]` — words per language and section, outside code spans: shared sentence (masked equal to another language's unit), only this language (a unit no other compared language prints, wherever it was written: mostly shared code selected by a result style), notes; and BY SOURCE, the measure for H1: the words that come from the provider's own string literals (a note's units, plus each prose-valued fact, a word at a prose slot such as `ref.noun` or a value with a space such as `body.values`, where shared code substitutes it outside a code span), against all words. And at the source, notes and prose literals against the shared templates.
- `node share.js`, `node lines.js`, `node recall.js [--review <dir>]` — as before (unit-level sharing, source lines, recall of the stage-2 checker items).
- `node selftest.js --clone <c> --old <r> --new <r> [--stage2 <root>]` — the controls of the tools themselves (below); exit 1 when one has gone blind.

## Who writes what

Shared, read-only for a porter (a change here is a change for every language; it goes through the tools' owner):
`ported.json`, `cut.js`, `common.js`, `facts.js`, `ledger.js`, `blocks.js`, `normalizers.js`, `classify.js`, `rules.js`, `pinned/*` (stage-3a rule records, frozen), `factsheet.js`, `purity.js`, `share.js`, `sharewords.js`, `selftest.js`, `controls/*`, `gen/*`, `portcheck.sh`, `summary.js`, `mkworkspace.sh`.

Per language, each written for that language only (no two porters edit the same file):

| file | written by | what |
| --- | --- | --- |
| `hand/<lang>.json` | porter, then reviewer | an outcome for each open class: `{ "<id>": { outcome, why, n } }`; `facts: { "<path>": { value, why, evidence } }` for a language or convention fact the OLD page does not attest; `absent: { "<sentence id>": "<why>" }` for each entry of `<section>.absent.json` |
| `classes/<lang>.json` | `classify.js` (generated) | every class's outcome and `by` (hand, rule:<name>, shared) |
| `normalizers/<lang>.js` | porter | normalizers whose pattern is that language's syntax |
| `counts/<lang>.json` | porter, `blocks.js --record-counts` after reading the pairs | how many block pairs each normalizer explains |
| `purity-allow/<lang>.json` | porter, accepted by the reviewer | accepted purity findings, each with a `why` |
| `review/<lang>/` | the tools (generated) | worklists, `*.open.json`, `*.absent.json`, `facts.txt`/`facts.json`, `sentences.json`, logs |

Shared, written by a reviewer and by no tool: `reviewed/sentences.json`, one verdict per reference sentence: `{ "sentences": { "<id>": { "verdict": "ok|false|awkward", "note": "..." } } }`.

## Outcomes

`same-meaning` · `restored:shared|fact|printer|note` · `correction:<catalogue id>` · `unification:<name>` · `dropped` (needs `why`) · `defect` (needs `why`; fails until fixed) · `contradiction` (an echo only; needs `where`, `true`, `evidence`; counted, not failed) · `shared:<lang>:<id>` (written by classify.js only).

An `echo` class is `contradiction`, `defect`, or `same-meaning` with a reason; anything else is INVALID. A `missing` class is never accepted automatically: a person says restored (where) or dropped (why). A class whose count changed (RECOUNT) is open again whatever accepted it before.

## The checks a new port meets, and how each shows on the screen

- **A wrong language or convention fact** (`ref.none`, `ref.maps`, `ref.noun`, `ref.entityNoun`, `ref.heading`, `ref.valueType.ANY`, ... whatever the guard report accounts `language` or `convention`). Masking hides a value, so nothing about the sentence shows it; the fact sheet compares it with the OLD page of the same language. Each distinct NEW unit carrying the fact's label is a context; a context is *held* when one of its NEW units pairs (identical, or reworded) with an OLD unit holding the label beside the same word, *contradicted* when its OLD units hold something else, *new* when OLD has no such unit. The fact is ATTESTED only when every context is held: a value that is also an ordinary word elsewhere (`Fields` is a heading of its own) is held by that word and new where it was substituted, so one held context alone does not attest it. Otherwise the screen prints `UNATTESTED <path> = <value>` and the one command fails until `hand/<lang>.json` records the fact at its current value (a record of another value does not count).
- **A wrong enumerated fact** (`named`, `prints`, `entityBy`, `keys`, and any other enumeration accounted `language` or `convention`). It is not printed; it chooses which sentence prints. The sentences a value selects are read off the reference languages: units printed by a reference declaring the same value and by none declaring another. A wrong value makes this language print another value's sentences in place of its own. Those show as reworded classes whose NEW side matches the other value's reviewed sentences and whose OLD side matches no reviewed pair (left for a person, with the hint "the OLD side matches no reviewed pair"), as vanished tokens, and, on the fact sheet, as `UNATTESTED <path>` when none of the units the value selects pairs with an OLD unit that is identical or uses a word only that value's sentences use. A value no reference declares selects sentences no reference prints: each class is new and left for a person, so the sheet says "not judged".
- **A dropped shared sentence.** From scratch a sentence OLD never printed is an `added` class that matches a reference; dropping it from some variations changes its count and nothing else. A shared match printed in fewer variations, or fewer times in one, than the reference it matched (the most favourable of the references holding it) is left open, the variations named. Dropped from every variation it leaves no class at all; it is then in `<section>.absent.json` when every reference of the same result style prints it (not failed: the porter says why).
- **Sentences nobody read.** About 877 reference classes were accepted by stage-3a rule records. `sentences.js` lists the distinct sentences they amount to; `reviewed/sentences.json` takes a verdict for each; the screen prints how many matches stand on a sentence with no verdict, and `STRICT_SENTENCES=1` fails on them.
- **Notes**: each entry of a notes table is one plain string literal (v3.2: several literals joined by `+` are a finding too), and every declared note is, whole, the literals of one entry. A constant, a call or a `${...}` is a finding.

The blocks table: `classes` counts the "otherwise" pairs grouped by their masked diff, plus OLD-only and NEW-only blocks, plus identifiers that are new to or gone from the code of the section (novel and vanished tokens, novel shapes); the screen prints the split. `compiler on PATH` means only that `command -v` finds one: no tool compiles the changed blocks of these variations; the toolchain lanes compile their own models.

## What the reviewer reads

`review/<lang>/facts.txt` (every fact a shared sentence carries: matching a sentence says nothing about whether its fact is true; the PINNED cited facts one by one; each hand-recorded fact), `hand/<lang>.json` against `review/<lang>/*.ledger.txt` and `*.blocks.diff`, the contradictions in the portcheck summary, `purity-allow/<lang>.json`, `counts/<lang>.json`, and the porter's `normalizers/<lang>.js`.

## The controls (`selftest.js`)

`controls/injections.json` (24 regressions: each must leave a new open class), `controls/accept.json` (7 false sentences: none of their classes may be accepted automatically), `controls/recheck.json` (the independent re-check's 19 injections), `controls/missing.json` (a shared sentence dropped from one variation and from every variation, a table row dropped) — each of these in the reviewed mode AND from scratch (`--modes`); `controls/factmut/` (provider mutations built once in a second copy of the clone: rb `maps` 'arrays', `noun` 'Functions', clojure `entityNoun` 'Fields' and `heading` '{client}', py `keys` 'bare'; the fact sheet must fail naming the fact, in the reviewed mode against `controls/factmut/hand/<lang>.json`, which records the true values so that the unmutated output passes, and from scratch), a false sentence verdict (never matched), `controls/purity.json` (22 provider mutations: each an open finding; the real notes found and clean), `controls/blocktables.txt` (the recorded block tables; and an unexplained block stays "otherwise"), `controls/recall-floor.txt` (49 of the 51 stage-2 checker items).

## Changes at v3.1 (the integration of the guard, the shared fixes and these tools)

- `ported.json` lists rb: the nine ported languages are the reference set a new port is matched against.
- A `missing` class is never classified by a stage-3a rule record (`classify.js`), and `ledger.js` marks a `missing` outcome INVALID when it came from a rule or has no `why`.
- A hand entry recorded at the class's current count settles the class even when a stale rule record holds another count; any other record at another count is still RECOUNT.
- The fact sheet reads every leaf's account from the guard report (`<lang> account <path>: <category>`, printed by `SDKGEN_GUARD_REPORT=1`) and fails (portcheck exits 1) when a fact or a note has none.
- `normalizers/zig.js` gains `zig-env-io` (Zig 0.16's environment read); `normalizers/rb.js` is new (the pilot's rb blocks, reviewed by hand at v3.1).
- `selftest.js` counts a note finding a reviewer accepted in `purity-allow/<lang>.json` as not open; `controls/blocktables.txt` records the v3.1 tables (zig tutorial and rb changed).
- A language with no provider is reported `PORTCHECK <lang>: NOT PORTED` (exit 1) rather than as an error.
- The porter's workspace comes from `P/base/newport.sh <lang> <dir>`, which calls `mkworkspace.sh` with `P/base/sdkgen` and `P/base/out/old`.

## Changes at v3.2 (i-tools)

- The fact sheet compares every `language` and `convention` fact with the OLD page (attested, recorded by hand, UNATTESTED), and every enumerated one with the sentences its value selects among the references; it lists each cited fact's file and quote and marks the pinned prose ones. `portcheck` fails on an unattested fact.
- `classify.js`: printed less often than its reference (open), the absent list (not failed), sentence verdicts (`false` never matched; `unreviewed` recorded on every shared match).
- `sentences.js` (new) and `reviewed/sentences.json` (verdicts, empty at v3.2).
- `portcheck.sh`: `SCRATCH=1`, `STRICT_SENTENCES=1`; the block column `compiler on PATH`; the `classes` split on the screen.
- `facts.js`: `ref.heading` masked as a whole heading; `TOOLS_SYNTAX_OVERRIDE` (controls only).
- `purity.js`: a note that is not plain string literals is a finding; a declared note must equal an entry's literals.
- `sharewords.js`: the by-source measure.
- `selftest.js`: `--modes reviewed,scratch`; parts `recheck`, `missing`, `facts`, `sentences`.
- `classify.js`: the duplicate check ("printed more often than any reference") now counts only variations some reference has the section in. Before, go's direct() sentence, printed in `lone-go` and `alias-go2` where no reference exists, was taken for a duplicate and left open, so dropping it from one variation was invisible from scratch (the selftest's `sentence-removed-go [scratch]`).
- `selftest.js` runs 176 controls: ledger 24 + recheck 19 + accept 7 + missing 3, each in both modes (106); facts 6 in both modes (12); sentences 2; purity 27 (22 mutations, 5 real-notes checks); blocks 28; recall 1.

## Changes at v3.3 (sfix: what "the same sentence" is)

- `cut.js`: a word equal to an entity or field name is masked only where the model supplied it: per unit template, the word must change across the learners' units (OLD of every language, NEW of the reference languages; the language masked left out). `learn: false` keeps the v3.2 mask for code lines, blocks, heading paths and tokens (block ids are unchanged). Article and step number are no part of a template. Composite entity forms (planet_entity) are left out of the learned vocabulary, so PlanetEntity is ⒺEntity everywhere. A bold lead ending in `.`, `!` or `?` (`**Create a client.**`) ends a sentence; `**Returns:**` does not.
- `ident.js` (new): sentence identity and the match form (see its header). Verdicts and sentence ids are keyed by the identity; `classify.js` accepts by the match form; text the fixture model holds (an entity's or a field's description, a project's entity_desc) is no sentence and takes no verdict.
- `rekey.js` (new): maps every record keyed by a class or sentence id from the v3.2 identity (`legacy/v32`) to this one, through the units; `--verdicts` carries sentence verdicts.
- `reviewed/sentences.json`: the 297 verdicts of the sentence review, carried by `rekey.js --verdicts` (written by that tool, from the reviewers' file).
- `classify.js`: an accepted class whose NEW sentence a reviewer called false is counted on the screen (not failed: the fix is in shared code).
- `buildfresh.js` (new), in the one command: a source under `ts/src`, `ts/test` or `ts/project/.sdk/src/cmp` (fragments: their staged copy) newer than its build output fails, naming the file.
- `handstale.js` (new), in the one command (not from scratch): a hand record whose reason quotes a code span or a quoted passage that no OLD or NEW page of the language and no file of the clone holds fails as STALE.
- `sentences.js`: identity ids; model text left out; one-language sentences classified (note, code, shared-condition, provider-literal, unexplained). `sharewords.js`: identity (`--v32` for the old mask).
- `selftest.js`: parts `masking` (controls/masking.json, both modes) and `identity`.

### For a port started from v3.2 (its records keyed by the v3.2 ids)

Tested on a copy of the lua port (`P/sfix/try-lua`): 0 conflicts, 173 of 174 hand entries carried (one merge of two agreeing entries), 34 absent reasons mapped, counts unchanged; the one command then leaves open exactly the five classes whose sentence the review marked false (record them as rb's are recorded, or wait for the shared fix).

```sh
export PATH=/opt/node24/bin:$PATH
# W: the port's workspace (W/tools the v3.2 tools with the port's records, W/sdkgen, W/out); L: the language
cp -a <sfix>/tools W/tools-v33 && rm -rf W/tools-v33/.git W/tools-v33/review
for d in counts purity-allow; do [ -f W/tools/$d/L.json ] && cp W/tools/$d/L.json W/tools-v33/$d/; done
[ -f W/tools/normalizers/L.js ] && cp W/tools/normalizers/L.js W/tools-v33/normalizers/
node W/tools-v33/rekey.js --clone W/sdkgen --old W/out/old --new W/out/new --lang L --from W/tools --to W/tools-v33 --dry          # read it
node W/tools-v33/rekey.js --clone W/sdkgen --old W/out/old --new W/out/new --lang L --from W/tools --to W/tools-v33 --json W/rekey-L.json
W/tools-v33/portcheck.sh W/sdkgen W/out L        # decide each CONFLICT, UNSOURCED and open class in W/tools-v33/hand/L.json
node W/tools-v33/rekey.js --clone W/sdkgen --old W/out/old --new W/out/new --lang L --from W/tools-v33   # again: "already keyed", nothing changed
```
rekey.js exits 1 when something is listed for a person (a merge whose decisions disagree, a class holding units no old class held, a hand entry that could not be carried). Records stale before the re-key (no class has their id) are kept as they are.

The merging engineer: the nine reference languages' records in this directory are already keyed by v3.3; a port's re-keyed `hand/L.json`, `classes/L.json`, `counts/L.json`, `purity-allow/L.json` (and `normalizers/L.js`) are copied in as they are, `ported.json` gains L, and the nine plus L are run again (adding L to the learners can move a template's slots; if `portcheck` then shows RECOUNT or open classes in the nine, run `rekey.js --code <a checkout of the tools before the merge>` for each, as `logs/rekey2` and `logs/rekey3` did here).
