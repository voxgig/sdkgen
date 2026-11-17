# i-guard: the reader sees every dimension a page states, and a category is not a hiding place

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `i-guard`; your directory is `P/i-guard/`. Write nowhere else.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md` (what the re-check found, the rule of this stage, and who owns
which files). Then, in `P/results/s3fix-check.txt`: `blockers`, `guard`,
`guard_neither`, `citations`, `runtime_table`, `note_lint` and `guide`; and
`P/results/s3fix-guard.txt` in full (the report of the engineer who built
the guard you are extending: `checks_added`, `forms_changes`, `still_passes`,
`gaps`). The mutation scripts of the last stage: `P/v31/mutwork` (75
mutations, `mutate.js`, `muts.json`) and `P/h-guard/work`.

## The job

You own `ts/test/runtimefacts.test.ts`, `ts/test/runtimereader.test.ts`,
everything under `ts/test/runtimeforms/` and `runtime-table.md`. **Do not
edit anything under `ts/src` or `ts/project`.** The shared engineer
(`P/i-shared`) changes those in parallel from the same commit, and both sets
of commits will be put together afterwards: keep yours to test files.

Eleven languages are about to be ported, four of them first (perl, swift,
ocaml, lua). A porter writes the provider's facts from `runtime-table.md`
and the guard is what stands between a fact and the page. The re-check
showed two holes: the reader cannot see some things a page states, and two
categories of fact are never compared with anything.

Set up:

```sh
mkdir -p P/i-guard && cd P/i-guard
cp -a P/base/sdkgen sdkgen
cd sdkgen && git status --short | head -3 && git log --oneline | head -2   # 9089ed48, clean
cd ts && npm run build && node --test dist-test/runtimefacts.test.js dist-test/runtimereader.test.js   # 61/61
```

Do the parts in this order; commit after each (shared test files; then each
language's forms file as a per-language change).

## 1. Every dimension of a declaration that a page states

Today a declaration is a name, parameters (name, type, optional), a return
and `bare`. Add what the pages also state, for all twenty runtimes, in the
reader, the table and (where a provider exists) the comparison:

a. **How a failure shows in the declaration**: a `throws` marker (swift:
   `EntityLoadOp.fragment.swift:8`, `Main.fragment.swift:96`,
   `EntityBase.fragment.swift:188-189`; java `throws`; any other), a second
   return value, an error parameter. The table shows it. For a ported
   language the provider's signature must state it when the runtime's does,
   and the provider's printed call for an operation must carry what the
   language requires to call such a declaration (swift's `try`): run the
   printer, as the record check does, and require the forms' word in it.
b. **What a member is called on**: an instance, the type or class, or a
   module or free function. swift `public static func testSDK`
   (`Main.fragment.swift:330`); lua `function ProjectNameSDK.test(` with a
   dot where the other members have a colon (`Main.fragment.lua:432`); perl
   `sub test { my ($class, ...` (`Main.fragment.pm:364`); every other
   runtime's test constructor and constructor. The table shows it. A member
   the runtime declares on the type may not be declared among a provider's
   instance members, and the call a provider prints for the constructor and
   the test constructor must be on what the runtime declares it on.
c. **A callable or a field**: ocaml's `entity_obj` holds both
   (`e_name : string`, `e_deleted : bool`, `e_data` and others are fields;
   `e_load : value -> value -> entity_obj` is a function,
   `tm/ocaml/sdk_types.ml:198-226`). The table must say which, and a
   provider's signature for a field may not take an argument (and the
   reverse). Check kotlin, scala, csharp, swift and cpp properties the same
   way.
d. **A return that is only a comment**: lua's operation returns are read
   from `---@return` comments, and the comment says `string? err` where
   `tm/lua/utility/make_error.lua:62-86` returns a table with `.status` and
   `.code`. Wherever the reader takes a type from a comment rather than
   from code, the table says so in that cell, and for lua the forms cite the
   code for what the second value is. Check which other runtimes' returns
   are comments (rb `@return`, py docstrings, elixir `@spec` or comments,
   perl, clojure).
e. **When a stream's items are read**: from the code, never the type. For
   all twenty runtimes read the implementation of `stream` and record in the
   forms, cited, whether items are produced as the caller iterates or all
   before it returns, and whether that depends on a feature. The table shows
   it beside the stream kind. (The shared engineer is correcting the
   sentences; report your table of twenty so the two can be compared.)
f. Anything else you find by this test: take the REFERENCE page of two
   ported languages (`P/base/out/new/doc-crud/{ts,c}/REFERENCE.md`) and list
   every kind of statement it makes about a member; for each, say which
   check of the guard would fail if it were false. Close what has none, or
   list it as not guarded with the reason.

Then read **every** row of **each** of the eleven unported sections of the
table against the runtime (`ts/project/.sdk/src/cmp/<lang>/`, `tm/<lang>/`):
the last engineer reported having done so, and the re-check then found
eight wrong or missing things in six languages by reading
(`runtime_table` in its result). Start with those eight, then the five
languages it did not read (js php csharp scala cpp). Report each correction
with file and line. Also correct: ocaml's client has no options or utility
member; java's operations have two required parameters.

## 2. The categories

a. **`lits` and `none` are the runtime's, so they are cited.** The shared
   engineer is making the `ok` literal of the `direct` result a fact every
   provider declares (today only py declares `lits`; the others print a
   default). Move `ref.facts.lits.*` and `ref.facts.none` to `cited` with
   the value's token required in the quote, and write the citations for the
   nine languages now, from each runtime (for `lits`: the lines of `direct`
   that set `ok`; for `none`: a default argument or a returned null). For
   the languages that do not declare `lits` yet, write the citation for the
   value the runtime shows, so that the merged guard fails if the shared
   engineer declares anything else. Give the list (language, value, file,
   line) in your report. `language` then holds only what no runtime file
   can show; list what remains in it and in `convention` per language: the
   review tools will compare those with the old pages.
b. **An absence is checked by a search.** `cancel: false` is cited today by
   a line that cannot show it (py `fetcher.py:97`, c `http.c:1`). Add a
   citation form for an absence: a pattern and the runtime files it must
   not match, checked on every run. Use it for every fact that says
   something is not there.
c. **Citations that show the value.** Of 19 the re-check audited, 10 do not
   (`citations` in its result). Audit all of them (about 106 over nine
   languages; the report prints them): each must show its value. Fix each
   that quotes an unrelated line, a comment where code exists, or
   contradicts what it supports. `unquoted` may excuse a token only when
   that token occurs nowhere in the runtime's files (check it mechanically:
   if it does occur, the citation must quote that place). A note's
   citation must hold every code token the note names. Report the audit as
   a table: citation, shows the value (yes, pinned prose, absence), what
   you changed. Count the pinned-prose ones per language: those are what
   only a reviewer checks.
d. Where your audit shows a declared fact or a note is false (the elixir
   arity notes are: `def list(ent, reqmatch \\ nil, ctrl \\ nil)` defines
   three arities), do not fix the provider: record it as a `WRONG:`
   exception with the language, the fact, the declared value and what the
   runtime shows, as the last stage did.

## 3. Controls

- The guard and every negative control pass for the nine; the reader test
  passes for all twenty; `runtime-table.md` is regenerated
  (`SDKGEN_RUNTIME_TABLE=P/i-guard/runtime-table.md node --test dist-test/runtimereader.test.js`).
- Re-run the 75 mutations of the last stage on a copy (`P/v31/mutwork`):
  none may be caught less than before.
- New mutations, each caught: swift `throws` removed from a runtime
  declaration and from the table's view; a static constructor made an
  instance method (two languages); an ocaml field made a function; rb
  `none` 'null', `lits.false` 'False' and py `lits` removed (the re-check's
  three, which passed 4/4 and 8/8 before); an absence citation whose search
  starts matching; an `unquoted` token that does occur in the runtime; a
  note naming a code token its citation lacks; a stream recorded as
  incremental when the code materialises.
- Say plainly what a wrong value still passes, per category, with counts.

## 4. Verify

`npm run build`; the whole suite without the toolchain lanes; `git status`
clean after a build (`ts/dist` must not change). Lines of the guard and of
each forms file, before and after.

Report against H1: what a language must supply, and every change of the
forms framework as breaking (it forced an edit in an existing forms file)
or additive. Separate what you ran from what you read. Say what you did not
get to.
