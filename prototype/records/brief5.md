# Stage 3a-fix2: every kind of fact gets a check, before the ports

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.

Read `P/brief.md` (the proposal, the hypotheses H1 to H5, the hard rules),
`P/brief3.md` (the principle, the measures, how to commit) and `P/brief4.md`
(the two layers, and the rules for every engineer, which all still hold:
your own directory only, the PATH with zig, no installing of compilers, never
a build during a suite or a lane, commits by explicit path with no tool or
model name, ran apart from read) before this file.

## Where things stand

- `P/base` is version 3.1: `sdkgen` at the tag `v31-frozen` (9089ed48),
  built; `tools` (the review tools, with the nine languages' reviewed
  classes); `harness`; `out/old` and `out/new` (21 model variations);
  `oldclone` (the pristine old code, built: read-only, never build in it);
  `runtime-table.md` (what the guard reads from each of the twenty
  runtimes); `newport.sh`; `PORTING.md` (the porting guide, version 3.1).
  **`P/base` is read-only for everyone. Copy what you need.**
- Nine languages are ported (ts go py c zig clojure rust elixir rb): README
  tutorial, root README quick start and REFERENCE page come from shared code
  and one provider each. At the tag: build clean; suite 2,588 pass, 0 fail;
  golden; guard and reader 61/61; lanes ts 16/16, go 12/12, py 12/12, c 6/6,
  rust 6/6, rb 49/49, zig documentation 6/6 (5/6 on the old code); the nine
  one-command checks pass; the tools' self-test 84/84.
- Results of the stage that made it, in full: `P/results/s3fix-{shared,guard,tools,final}.txt`.
  The independent re-check of it: `P/results/s3fix-check.txt`; its scripts
  are in `P/check-v31/mine` (reuse them on copies; the clones they ran in
  are gone, so re-point them at a copy of `P/base/sdkgen`).

## What the independent re-check found

The blockers of the last check are closed (no rule spans languages; 0 of 27
injected false sentences accepted; the note lint runs; the guard catches 43
of 52 source mutations and the other 9 are in a stated category; the forms
read ocaml and perl). It still said **not ready**, for three new reasons,
each of which lets a port print a false fact with nothing failing:

1. **A wrong fact in the `language` or `convention` category hides behind
   the mask.** Shared-sentence matching replaces a fact's value with its
   slot label, so a sentence carrying a wrong value is matched as shared.
   The guard never compares these categories. Shown in rb with a wrong
   `none` ('null'), `maps` ('arrays'), `noun` ('Functions') and
   `lits.false` ('False'): the guard passed and 1 to 5 classes per mutation
   were accepted automatically; they were flagged only by accident, because
   OLD rb happened to state the true value in another class. And shared code
   states one runtime value **by a default nobody declares**:
   `lit(r, false)` in `ts/src/cmp/ReadmeRef.ts:78` prints `false` unless
   `lits` is declared. perl's `direct` sets `'ok' => 0`
   (`fragment/Main.fragment.pm:226,245,260,264,310`), OLD perl already
   prints `false` elsewhere, and nothing would flag "on a failure `ok` is
   `false`".
2. **The reader of the runtimes cannot see some things a page states.** It
   does not see swift's `throws` (`EntityLoadOp.fragment.swift:8`,
   `Main.fragment.swift:96`, `EntityBase.fragment.swift:188-189`), so a
   signature without it, or an example without `try`, passes. It does not
   see that a constructor is static or class-level (swift
   `public static func testSDK`, `Main.fragment.swift:330`; lua
   `function ProjectNameSDK.test(` with a dot where every other member has a
   colon, `Main.fragment.lua:432`; perl `sub test { my ($class, ...`,
   `Main.fragment.pm:364`). It lists ocaml record fields
   (`e_name : string`, `e_deleted : bool`, `sdk_types.ml:198-204,223`) as
   functions of no arguments. It takes lua's error value from a doc comment
   (`---@return string? err`) when `tm/lua/utility/make_error.lua:62-86`
   returns a table with `.status` and `.code`. It classes ocaml's stream as
   lazy from its type (`value Seq.t`) when `Entity_ocaml.ts:141-152` runs the
   operation and materialises every item before building the sequence (java
   and kotlin are similar: `runOp` runs before the stream is returned).
3. **A dropped sentence leaves no trace in a new port.** Run from scratch
   (every class new, as for a new language), removing a shared sentence that
   OLD never printed from one of nineteen variations changed no number.

Also found: of 19 citations audited, 10 do not show the value they are cited
for (they rely on `unquoted`, quote an unrelated line such as
`timeout = fetchdef.get("timeout")` for "cannot be cancelled", cite a
comment, or contradict the note they support); c's REFERENCE load and remove
examples still lack the `NULL` check and the read of the record that OLD had
(only the sentence was fixed), and are now inconsistent with c's own root
quick start, which does check; elixir's restored note "Named with its
arity, it is `list/2`" is false (`def list(ent, reqmatch \\ nil, ctrl \\ nil)`
defines `list/1`, `/2` and `/3`, and the example under it calls `list/1`);
a note assembled by concatenation with a constant outside the notes table is
not linted; about 877 classes of the eight reference languages are still
accepted by stage-3a rule records nobody re-read, and shared-sentence
matching stands on them.

## The rule this stage makes real

Stage 3a-fix made two layers: sentences shared and reviewed once; facts per
language, each accounted for. The re-check showed that an account is not a
check. So:

**Every fact a page prints is checked by something other than the person who
wrote it, and the kind of check follows from the kind of fact.**

| Kind of fact | Its check |
| --- | --- |
| derived | the guard re-derives it from the runtime's own declarations |
| cited, a code token | the guard requires the token inside a quote of a runtime file |
| cited, an absence ("cannot be cancelled") | the guard runs a search over named runtime files that must stay empty |
| cited, prose | pinned to the audited value; counted; the independent reviewer audits each one |
| language or convention | nothing in the runtime can show it, so it is compared with the OLD page of that language: the value must be attested there in the same place, or a person records why it changed |
| a sentence | reviewed once as a sentence; and where the reference languages print it, a language that does not is flagged |

And three things follow:

- **Shared code never supplies a runtime value by default.** A literal, a
  key or a word that differs between runtimes is a declared fact, with an
  account, or it is not printed.
- **The reader sees every dimension of a declaration that a page states**:
  the name; each parameter's name, type and whether it may be left out; the
  return; how a failure shows (a `throws` marker, a second return value, an
  error slot); what it is called on (an instance, the type or class, a
  module); whether it is a callable or a field; whether it resolves later.
  For a stream, also whether its items are read as the caller iterates or
  before it returns: that is read from the code, never from the type.
- **A category is not a hiding place.** `language` is only what no runtime
  file can show (how a map is called in prose, the blank identifier). The
  null literal, the boolean literals a result carries and the like are in the
  runtime's source, so they are cited.

## Who does what in this stage

Three engineers work in parallel from `P/base`, on disjoint files, and a
fourth puts their work together:

- `i-shared` (`P/i-shared/`): `ts/src/**` and `ts/project/.sdk/src/cmp/**`
  (shared documentation code, providers, naming hooks) and tests other than
  the guard's. Never `ts/test/runtimefacts.test.ts`,
  `ts/test/runtimereader.test.ts` or `ts/test/runtimeforms/**`.
- `i-guard` (`P/i-guard/`): `ts/test/runtimefacts.test.ts`,
  `ts/test/runtimereader.test.ts`, `ts/test/runtimeforms/**`, and
  `runtime-table.md`. Never `ts/src` or `ts/project`.
- `i-tools` (`P/i-tools/`): the review tools (`tools/`), on generated
  output. No sdkgen source.
- `v32` (`P/v32/`, and it builds `P/base32/`): merges the three, reviews the
  nine languages where their output changed, freezes version 3.2, and writes
  the porting guide version 3.2.

Where a change of yours needs something from another engineer's files, do
not make it: say exactly what is needed in your report (file, the change,
why) and leave your own side so that the build passes without it.

## What comes after

Eleven languages remain: js php lua csharp java kotlin scala swift cpp perl
ocaml. The four the re-check named (perl, swift, ocaml, lua) are ported
first, each by one engineer following the guide and then read by an
independent reviewer; what they find in shared files is fixed once; then the
other seven; then one integration, the measures and the verdict against H1
to H5. So anything a porter needs must be in the base, and anything a
porter could get wrong silently must fail somewhere.
