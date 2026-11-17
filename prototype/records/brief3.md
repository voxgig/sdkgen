# Stage 3 brief: what stage 2 showed, and interface version 3

Read `brief.md` (beside this file) first: the proposal, the five hypotheses
and the thresholds fixed in advance, the hard rules, the paths, the
toolchains. Then `brief2.md` (what stage 1 meant). `stage1.md` is the full
record of stage 1. The full, readable results of stage 2 are
`results/s2-*.txt` (v2, check_v2, ref, check_ref, probe_ref, restanatomy),
and `stage2-worklists.md` holds, verbatim, the lists this stage works from:
output defects, facts lost, the survey of the unported languages, the
interface changes recommended, what is still inside providers, the problems
in the porting guide.

Everything is under
`/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/`
(called `P` below).

## Where things stand

| | |
|---|---|
| Most advanced clone | `P/probe-ref/sdkgen`, HEAD `c66142da`, a linear history on `9aebaf9e` (`git log --oneline` shows every step since stage 1) |
| Its harness | `P/probe-ref/harness` (`gen.js`, `lib2.js`, `variations.js` with 21 model variations, `diff2.js`, `diffref.js`, `issuecheck.js`, `prose.js`, `proseref.js`, `purity.js`, `metrics2.js`, `metrics3.js`, `blockcount.js`; outputs in `out/old` and `out/new`) |
| Pristine old clone | `P/probe-ref/oldclone` at `9aebaf9e` (OLD output for the alias variation, and OLD lanes) |
| The checkers' own scripts | `P/check-v2/harness/mycmp.js`, `mychecks.js`; `P/check-ref/my/*.py`; `P/probe-ref/mine/*.js` |
| Upgrade walk | `P/v2/mig/bin/tool.js` |
| Porting guide, version 2 | `P/ref/PORTING.md` |

Ported so far, through shared code and a provider per language:

- README tutorial and root README quick start: ts go py c zig clojure rust
  elixir (8 of 20).
- REFERENCE page: ts go py c zig rust elixir (7 of 20; clojure is not ported
  because its client has no type name for the page's heading).
- Not ported: js php rb lua csharp java kotlin scala swift cpp perl ocaml.

Toolchains here (check with `command -v`): node 22 and node 24
(`/opt/node24/bin`), tsc, go, python3 with real pytest
(`/root/.local/share/uv/tools/pytest/bin`), ruby with bundle, php with
composer, perl, javac with mvn, rustc and cargo, gcc and g++. Missing: lua,
busted, dotnet, kotlinc, scala and sbt, swift, zig, clojure, elixir, ocaml.
Fetching dependencies from the public package registries (npm, PyPI,
crates.io, the Go proxy, Packagist, Maven Central, RubyGems, CPAN) is
allowed inside your own directory, as the repository's own lanes do. Send
nothing else anywhere.

## What stage 2 showed

Held up, and confirmed by independent checks that rebuilt everything:

- Names come from a per-language naming hook that calls the code generator's
  own functions. Eight providers read the model 0 times and hold 0 naming
  rules. elixir's accessor, which needs the whole entity collection, works in
  its hook.
- go's quick start is one complete program again, and it runs.
- A second section (the root quick start) cost 54 shared lines and 0 provider
  lines and retired 2,000 lines across twenty languages. The REFERENCE page
  reused the description, the example representation and the quick-start
  printers: +378 shared lines and about 50 per language against 418 to 473
  per language removed.
- Source lines. REFERENCE, five languages: 2,196 to 967 (2.27x; 1.89x to
  1.92x without blanks and comments). rust's three components (711 lines)
  became 188, elixir's 645 became 215. Both sections projected to twenty:
  14,896 to 5,437 (2.74x), 2.03x if the remaining providers are 1.5 times
  the measured size, 1.62x at twice. The quick start alone stays under 2x.
- Catalogued issues in the ported sections are fixed by shared code in every
  ported language.
- Examples: ts 16/16, go 12/12, py 12/12 with real pytest, c 6/6 (it was
  5/6), rust 6/6. Nothing that ran before now only compiles.
- A real 4.44.0 project upgraded cleanly with the 136-line lifecycle change.
- Porting rust and elixir needed 5 additive interface changes and 0
  breaking ones. Breaking changes since the first four languages: about 6.

Did not hold up. These are the work of this stage:

1. **"0 unexplained" was structural.** The diff tools explain a changed line
   by the section it sits in. That hid a real regression: every zig field
   type became `any`. A review has to be per sentence and per block.
2. **Sharing lost true facts and introduced false ones.** direct()'s result
   keys vanished in four languages; py says `ok` is `false`; zig's create
   comment says "returns the created entity"; clojure's prose names an
   unbound `entity`; C and Zig are told about a call "without arguments"
   that they cannot make. The full lists are in `stage2-worklists.md` A and
   B. The old failure was twenty copies drifting from the model. The new one
   is one sentence drifting from twenty runtimes.
3. **The guard checks names only**, and its regular expressions know six
   language forms. It passed wrong parameters, wrong return types, a wrong
   collection noun, and it would have passed an undeclared rust member.
4. **Naming hooks invented names the code generator never uses.**
   `vars: v + 's'` is copied into every hook and prints `utilitys` and
   `historys` (338 occurrences). `Name + 'SDK'` is restated in every hook.
5. **Examples were restructured without need.** The shared builders wrap the
   root quick start and the REFERENCE operation examples in error handling,
   so 0 of 17 to 19 root blocks and 181 to 292 REFERENCE blocks per language
   are byte-identical to today's. In the seven languages with no toolchain
   here, a restructured block cannot be verified at all.
6. **Per-language prose was relocated, not removed.** Sentences in the
   shared page that only one runtime can print (go's channel paragraph, ts's
   cancelling, zig's error union) are 29% of the words of the part of the
   page go used to write, and 18% of ts's.
7. **One section's imports serve other sections on the page** (rust: the
   lane compiles a block with every `use` line on its page).
8. **Porting one document makes two documents disagree.** The REFERENCE now
   says `region` defaults to `eu`, that log is on by default, and omits the
   test constructor without the test feature; the README of the same SDK
   says the opposite in each case. A fact has to move in every place that
   states it (`stage2-worklists.md` H).
9. **Not all documentation is the same kind of thing** (anatomy of the other
   ten families): Install and Explanation are documents about one language
   (0% of their prose shared by 15 languages), and across the README
   families 72% of prose units but only 42% of words are shared.

## The principle as it now stands

The original sentence, "a language supplies syntax, never facts", is too
strong. What the evidence supports, and what this stage builds, is:

> **The model decides what is said, once.** A language supplies how its
> runtime spells it, and nothing a language supplies can see the model.

A language supplies four things:

1. **Naming functions**, shared with its code generator, through its naming
   hook. The hook is the only per-language documentation file that may read
   the model. It holds no rule the code generator does not also use.
2. **Printers**: pure functions of a statement, the description and the
   scope.
3. **Declared runtime facts**: data, not sentences. A fact that two or more
   of the twenty runtimes share is an enumerated value, and its sentence is
   written once in shared code.
4. **Runtime notes**: prose that is true of that one runtime alone (for
   example zig's "under `throw: false` a failed stream is `.ok` with whatever
   data the failure left"). A note is static text in the provider, attached
   to a named slot of the shared page, shown exactly when the shared page
   shows that slot. It cannot depend on the model because the provider never
   sees the model. Notes are counted, per language, in every prose measure.

The shared page then holds no sentence that only one runtime can print, and
the per-language prose is explicit and countable. H1's line is 15% of the
sections' prose.

What a language never does: decide what is shown, read the model, or hold a
sentence whose truth depends on the model. A note that mentions a feature,
an option, an entity or an operation by name is suspect: flag it.

## Measures every stage-3 agent reports the same way

As `brief2.md`, and in addition:

- **Sentence ledger.** Every prose unit of the OLD output of a ported
  section (sentence, table cell, heading, code comment) is one of: the same
  in NEW; reworded in NEW; restored as a fact, a printer or a note; dropped
  with a stated reason. Unclassified must be 0. Count each class per
  language.
- **Blocks.** Code blocks per language and section: byte-identical to OLD;
  identical after undoing listed corrections (each correction named);
  changed otherwise, each one explained individually. In a language with no
  toolchain here, "changed otherwise" is unverified, and the count says so.
- **Language-supplied prose**, by words, per section and per language: fact
  tokens outside code spans, plus notes. And separately, any sentence in
  shared code that only one ported language prints.
- **Guard coverage.** Per language: which declared facts the guard
  re-derives from the runtime, and which it cannot.
- **Interface changes**, cumulative since stage 1's first commit, each
  marked breaking or additive, with the providers it forced work in.

## How to commit, so the work can be integrated

In your own clone, keep these in separate commits, in this order:

1. shared source and tests (`ts/src`, `ts/test`, shared docs);
2. per-language files (`ts/project/.sdk/src/cmp/<lang>/`, and a language's
   guard forms);
3. the build (`ts/dist`), on its own;
4. the golden (`ts/test/golden`), on its own.

Never rebuild while a suite or a lane is running. Regenerate the NEW output
after every source change before measuring anything.
