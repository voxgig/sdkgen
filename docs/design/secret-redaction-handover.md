# Secret redaction: handover

Status at hand-off, 2026-09-30, at the end of the second session on this
work. The design is ADR-003 in ADR.md and
`docs/explanation/secret-redaction.md`; this note does not restate it.

## The three pull requests

| Repo | PR | Branch | State |
| --- | --- | --- | --- |
| voxgig/sdkgen | #229 | `claude/amazing-goodall-33f6ox` | Rounds 1 to 4 in all 20 bundled targets. All seven Codex threads answered and resolved. |
| voxgig/sdkgen-langpack | #24 | same | Rounds 2 to 4 compiled and run for dart, haskell and lean; the eight Codex findings fixed, answered and resolved. |
| voxgig/sdkgen-infrapack | #28 | same | Round 1 (0f5737a), green; nothing outstanding. |

## What the second session did

### Rounds 2 and 3, sdkgen

- **Round 2 (F3 to F6)** ported to java, kotlin, csharp and scala.
- **Round 3 in all 20 targets.** L1: a `clean` block in the generated config
  merges under the caller's, and both blocks' values are registered. L5: the
  error code is value-cleaned wherever the error is.
- **Two defects in the ts reference**, found by the csharp and scala port,
  fixed in every target:
  - *No `clean` block meant no redaction.* merge let an absent last layer
    replace every layer before it, leaving no keys and an empty registry, so
    a client built the ordinary way masked nothing. ts, js, rust, c and
    kotlin had it; swift had it for a non-map block. Every sweep passed
    `clean.values`, so none saw it. Every sweep now also builds a client
    with no `clean` block.
  - *Feature names read as field names.* The feature name `secrets`
    registered every setting of that feature, which was then masked in
    every message. Keys directly under `feature` no longer count; field
    names inside a feature's settings still do.
- **`direct()` cleans the error it returns** in every target. Round 2 had
  done it in ts, js and lua only.
- **Defects found by compiling targets for the first time:** scala had never
  compiled (a round-1 local named `given`, a Scala 3 keyword); the java
  sweep's capture feature was package-private, so the round-1 java sweep
  captured nothing from inside the pipeline; elixir's request bodies broke on
  a duplicate `omit_keys`, and its option spec was parsed at compile time;
  the lua and ocaml secrets suites were red; kotlin and scala debug tests
  expected the old `<redacted>` mask.

### Round 4, sdkgen: the first handover's follow-ups, and what porting them found

The first version of this note listed seven follow-ups. Round 4 took each
one inside the redaction contract, fixed it in the ts and js reference with a
sweep check that fails without the fix, and ported it to every target. Five
agents ported each step in parallel, one group of targets each; every new
check was shown to fail with its fix reverted, or, where a target needed no
fix, with the defect planted.

- **Entity blocks are not read.** Registration read every option key as a
  field name, so an entity named like `token` registered everything under it.
  The first note called this low risk because the generated config gives each
  entity an empty block. It missed the records `SDK.test()` seeds: they sit
  under `feature.test.entity`, keyed by entity name and by ids that spell it
  (`TOKEN01`), so every seeded value of such an entity was masked in
  test-mode errors, explain records and log lines. Registration now skips
  every `entity` block: at the top of the options, under `test`, and in each
  feature's settings, map or array form.
- **An explained failure keeps its error with clean off.** `done()` and the
  catch path pruned `err` from the live result when `clean` returned its
  input. Fixed where it occurred: ts, js, elixir, lua and perl. rust wrote
  the record back onto itself on that path, a double borrow that panics, and
  go emptied the caller's record; both are fixed.
- **Stream iteration goes through the catch path.** The audit covered every
  target, not only the three the note named. go, py, rb, php, perl, java,
  kotlin, scala, csharp, elixir, clojure, lua and ocaml, and haskell in the
  langpack, all iterated or realised a feature's stream outside the cleaning
  catch path. go's `Stream` goroutine now recovers a panic into a cleaned
  error and ends the stream. cpp and dart already iterated inside it; rust,
  c, zig, swift and lean have no stream that can raise.
- **Three more leaks, found while porting**, each in the ts reference too:
  - *The caller's explain record was replaced, not cleaned.* The pipeline
    writes spec, fetchdef and result into the record the caller passed, and
    `done()` then swapped in a cleaned copy, so a caller who kept the object
    it passed read the API key and custom header in every scenario. ts, js,
    dart and lean swapped the record; it is now cleaned in place everywhere.
  - *No stream path cleaned the explain record.* ts's stream call copies the
    caller's ctrl, so only the record object reaches back, and a stream a
    feature supplies never reached `done()`. The feature-stream path now
    cleans the record before it iterates, in every target that has one.
  - *A PreUnexpected hook could throw past the cleaning.* ts fires the
    PreUnexpected hooks in each operation's catch block before the cleaning;
    py, rb, perl, elixir, clojure, dart and ocaml had the same slot. go,
    scala, csharp and cpp fired it inside makeError without the guard java
    and kotlin had. An error a hook threw there escaped raw, with its
    explain record. Every slot is now guarded. csharp's catch path also
    never cleaned the record at all; elixir's, clojure's and ocaml's did not
    either when a hook failed mid-pipeline.
- **clojure query auth.** The five prepare-auth checks now probe where the
  credential lands, as the ts and go pipeline tests do, so the clojure clean
  lanes pass in all three auth modes.
- **Defects found on the way:** a second `omit-keys` that this branch added to
  clojure in dbcc817 replaced the request-body helper for every caller and
  threw on a nil or non-map body; rust's and c's debug-feature tests still
  expected the old `<redacted>` mask, and no lane runs them (the generated c
  suite now passes 132 of 132 and the rust one 76).

Every sweep now also covers the entity blocks, an explained 404 with clean
off, the record the caller holds, a PreUnexpected hook that throws where
hooks can, and, where the SDK has a stream, streams that fail part-way,
succeed through a feature, and materialise.

### langpack

dart, haskell and lean were compiled and run for the first time in rounds 2
and 3: haskell and lean needed compile fixes. The eight findings, both
defects above and `direct()` cleaning are in, plus a dart cross-client leak:
the module-level `Config` was merged without being cloned, so one client's
custom header was sent by every client built after it. The #24 replies name
each commit.

Round 4 there: entity blocks in all three; the haskell stream read inside the
operation's catch path; a throwing custom `system.fetch` leaves haskell's
`direct()` as a cleaned `{ok: false, err}`, and a body that does not parse
leaves `data` unset, as ts does; dart needed all three explain fixes and lean
the in-place one.

## What is verified, and how

### In this container, on the integrated sdkgen head

- **Clean lanes, header, query and basic, all pass for 19 targets:** ts, js,
  py, rb, php, go, perl, java, kotlin, csharp, scala, rust, c, cpp, zig, lua,
  ocaml, elixir and clojure. Only swift has no toolchain here.
- **How the toolchains got there** (a fact about this container, not a
  requirement): dotnet 8, ghc with cabal, ocaml 4.14, elixir 1.14, lua 5.4
  with busted and dkjson, and the libssl and libcurl headers from apt; zig
  and pytest from PyPI; dart from the Dart archive; scala-cli from its JVM
  artifacts on Maven Central; clojure through a stand-in for its CLI built
  from the Maven Central jars `deps.edn` names; phpunit through composer.
- **swift** was not compiled here. CI's ubuntu and macOS runners build and
  run its sweep, and they are green on every round-4 swift change.
- **The full `npm test`** passed here on 51ab68aa: 1816 tests, 1811 pass,
  0 fail, 5 skipped. The five are the swift lanes.
- **Each generated suite in full,** not only its sweep, was run by the agents
  for the targets they ported; the only failures need files a trimmed
  scratch generation does not write (the corpus `test.json`, per-entity test
  data, the root README).
- **langpack:** dart, haskell and lean pass in all three auth modes, with
  0 leaks, except the three lean checks that fail on the pack's main too.
  Its CI is green on c7410fa.

### In CI

The build runs on ubuntu, macOS and windows. Which clean lanes run:

| Platform | Run | Skipped, no toolchain |
| --- | --- | --- |
| ubuntu | ts js rb java php cpp go c rust perl csharp swift kotlin | py lua zig scala clojure elixir ocaml |
| macOS | ts js rb java cpp c rust perl csharp swift kotlin | php go py lua zig scala clojure elixir ocaml |
| windows | ts js rb java php cpp go c rust perl csharp | py swift kotlin lua zig scala clojure elixir ocaml |

CI never runs the py, lua, zig, scala, clojure, elixir or ocaml sweeps. py
skips on every platform because the runners have no pytest.

## What is left

1. **CI coverage.** Installing pytest in `build.yml` would make CI run the py
   sweep, and every other py lane with it, on all three platforms; lua with
   busted and dkjson, zig, scala-cli, elixir and ocaml would cover the rest.
   This container verified those; CI cannot. It is a CI cost decision.
2. **Recorded, not fixed:** `entity.match()` returns a query-auth
   credential. The explainer's Edges list says so.
3. **PreUnexpected coverage in haskell and lean.** Both fire it only inside
   makeError, so an error that bypasses makeError (a throwing hook, a
   throwing fetch, a failing stream) fires no PreUnexpected at all. That is
   a gap in what an observability feature sees, not a leak.
4. **haskell, pre-existing:** an entity operation whose fetch throws fails
   through `cleanUnexpected` (code `unexpected`, no operation-name prefix, no
   retry) where ts carries the throw into `response.err`; `runOpPipeline`
   rethrows under `throw: false`; `done()` runs before a feature's stream,
   so a failed result that a feature streams raises, where ts's does not.
5. **lua streams end silently** on a step error or a failed operation, where
   ts raises; an rbac denial on a lua stream is swallowed the same way.
6. **rbac rules** are keyed by `<entity>.<op>`, so for an entity whose name
   contains a sensitive word, a rule's permission value is registered and
   masked in diagnostics. Masking only; nothing leaks.
7. **lean with a plugin group active** was not built: its link needs a
   `link.rsp` that only `make ffi` writes, and the harness calls lake
   directly.
8. **Noticed, pre-existing:**
   - `src/cmp/c/TestDirect_c.ts` reads a parameter's `.name` where the compact
     params carry `.n` (go's reads `.n`), so c's `planet_direct_test` fails
     one check; it fails on main too.
   - `tm/rust/tests/vendor/omni/mod.rs` includes `../COMMENT-NOTES.md`, which
     the generated tree does not ship, so rust's omni and corpus tests do not
     compile.
   - elixir warns about an unused `H` alias and `Config.feature_plugins/1`;
     `src/cmp/py/fragment/SdkError.fragment.py` is unreferenced; the php
     clean-off control test warns about a circular reference in
     `var_export`; three lean checks (paging, streaming, one secrets exchange
     check) fail on the langpack's main as well.
   - The java, kotlin, scala, csharp and ocaml stream calls write `stream`
     into the caller's own ctrl map, a self-cycle ts avoids by copying ctrl.
     It leaks nothing.

## Deliberate per-target divergences reported by the ports

These are recorded so a reader can tell a decision from a bug. Each belongs
in a comment at the divergence if it is not there already.

- **Validators that do not reject a mistyped credential.** go's validator
  substitutes `""`, swift's collects its errors, and rust, c, zig and lean
  discard or skip validation. Their sweeps sweep the constructed client, plus
  a cleaned string quoting the value, instead of a rejection.
- **Hooks that cannot throw.** swift, rust, c and zig hooks set
  `result.err` or `response.err` instead, so their sweeps have no
  PreUnexpected throw. cpp throws `std::runtime_error`.
- **go.** `runOp` and `Stream` recover a panicking hook into a cleaned SDK
  error, which is a behaviour change; a panic in a goroutine a stream
  function starts is out of reach. `Stream` hands no error to the caller, so
  its sweep asserts on the explain record. When a PreUnexpected hook panics,
  the caller gets the hook's error, cleaned, as a plain error.
- **rust.** A panicking hook is not caught: the panic hook prints its message
  where the panic happens, before any `catch_unwind` could clean it. The
  explainer's Edges list says so.
- **php.** F5 still rethrows under `throw: false`, because the cost feature
  relies on the throw. `clean` walks `getPrevious()` and clears the cached
  `Exception::$string`. The explain record is an array, so the context holds
  its own copy and the held-record check cannot fail there. php's catch path
  fires no PreUnexpected for a hook's own error.
- **rb.** Re-raising inside `rescue` attached the raw original as `cause`;
  it is now raised with `cause: nil`. Under internal iteration the caller's
  block runs on the stream's stack, so an `inblock` flag re-raises what the
  caller raises untouched.
- **elixir.** The stream guard also cleans an error the caller's own reducer
  raises, because that code runs inside the reduce.
- **perl.** A foreign blessed exception object is returned unchanged; only a
  string error or the SDK's own error is cleaned.
- **lua.** The entity prints only its data, as ts does, because `_match`
  absorbed the query credential. Calling the stream iterator again after it
  ends returns `nil` rather than raising.
- **clojure and ocaml.** F5 returns a cleaned copy, because throwables are
  immutable, so the exception class can change. clojure realises a stream
  eagerly, so a stream error surfaces from the `stream` call.
- **Foreign exceptions.** java, kotlin, csharp and scala replace a foreign
  exception with a cleaned SDK error carrying the original stack, because
  their messages are immutable; the original is not attached as the cause,
  since a printed trace would show it. elixir and ocaml return a cleaned copy
  from the catch path. swift's `direct()` cleans only the SDK's own error.
- **Stream guards.** kotlin catches `Exception` and wraps a checked one, as
  its `featureHook` does; java catches `RuntimeException`, since an Iterator
  cannot throw a checked one; scala uses `NonFatal`. java and scala read one
  item ahead in `hasNext`, so a failing `next` ends the stream quietly under
  `throw: false`. csharp also guards `Dispose`.
- **Validators that collect errors** (java, kotlin, scala, like go and swift):
  the sweep checks the constructed client and a quoted value instead of a
  rejection.
- **csharp** prints its skip line, because xunit 2 has no runtime skip.
- **The feature-name and entity-block rules** live in `make_options` in the
  native targets, which scan each feature's settings separately.
- **langpack.** Its sweeps build no client with feature settings, so the
  entity-block check sits beside the feature-name check in each port's unit
  suite. dart falls back to replacing the explain record when the caller's
  record is typed too narrowly to hold the cleaned values.

## How to pick it up

```bash
cd ts && npm install && npm run build
node --test dist-test/clean.test.js dist-test/cleancoverage.test.js
node --test --test-name-pattern="no credential" dist-test/generatedcompile.test.js
cd .. && make comments scan-prose deps check-model
```

A lane whose toolchain is missing SKIPS visibly; it never passes silently.
Probe with `command -v` before concluding a target cannot be verified. The
php lanes find phpunit on PATH or through `PHPUNIT`; the clean lane falls
back to composer.
