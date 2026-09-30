# Secret redaction: handover

Status at hand-off, 2026-09-30, at the end of the second session on this
work. The design is ADR-003 in ADR.md and
`docs/explanation/secret-redaction.md`; this note does not restate it.

## The three pull requests

| Repo | PR | Branch | State |
| --- | --- | --- | --- |
| voxgig/sdkgen | #229 | `claude/amazing-goodall-33f6ox` | Rounds 1 to 3, and two later defects, fixed in all 20 bundled targets. All seven Codex threads answered and resolved. |
| voxgig/sdkgen-langpack | #24 | same | Round 2 compiled and run for dart, haskell and lean; the eight Codex findings fixed, answered and resolved. |
| voxgig/sdkgen-infrapack | #28 | same | Round 1 (0f5737a), green; nothing outstanding. |

## What the second session did

### sdkgen

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
- **Defects found by compiling targets for the first time:**
  - scala had never compiled: a round-1 local was named `given`, a Scala 3
    keyword.
  - The java sweep's capture feature was package-private, so reflective
    hook dispatch skipped it, and the round-1 java sweep captured nothing
    from inside the pipeline.
  - elixir: a duplicate `omit_keys` from round 2 broke request bodies, and
    the option spec was parsed at compile time, so any other VM got garbage
    specs (pre-existing).
  - The lua and ocaml secrets suites were red, lua since round 1.
  - kotlin and scala debug tests still expected the old `<redacted>` mask.
- **Every sweep** now also covers the config block, a coded SDK error, the
  bare client, the feature-name rule and a failing `direct()`.

### langpack

dart, haskell and lean were compiled and run for the first time: haskell and
lean needed compile fixes. The eight findings, both defects above and
`direct()` cleaning are in, plus a dart cross-client leak: the module-level
`Config` was merged without being cloned, so one client's custom header was
sent by every client built after it. The #24 replies name each commit.

## What is verified, and how

### In this container, on the integrated sdkgen head

- **Clean lanes, header, query and basic, all pass for 18 targets:** ts, js,
  py, rb, php, go, perl, java, kotlin, csharp, scala, rust, c, cpp, zig, lua,
  ocaml and elixir.
- **How the toolchains got there** (a fact about this container, not a
  requirement): dotnet 8, ghc with cabal, ocaml 4.14, elixir 1.14, lua 5.4
  with busted and dkjson, and the libssl and libcurl headers from apt; zig
  0.16.0 and pytest from PyPI; dart from the Dart archive; scala-cli from its
  JVM artifacts resolved from Maven Central, with every dependency pinned to
  its highest requested version.
- **clojure** ran through a stand-in for its CLI built from the Maven
  Central jars `deps.edn` names. Header and basic pass. Query auth fails
  five checks that fail identically before this work (see below).
- **swift** was not compiled here.
- **Also passing:** every secrets-feature lane except swift and clojure; the
  auth-null, credential-name and java feature-corpus lanes; the clean,
  cleancoverage, generate, parity, featuremodel and characterize suites.
- **The full `npm test`** ran green in CI on all three platforms at 7933ddd
  (1814 tests; 32 skipped on ubuntu, 53 on macOS and windows).

### In CI

Run 36748626078 on 7933ddd was green on all three platforms. Which clean
lanes ran:

| Platform | Run | Skipped, no toolchain |
| --- | --- | --- |
| ubuntu | ts js rb java php cpp go c rust perl csharp swift kotlin | py lua zig scala clojure elixir ocaml |
| macOS | ts js rb java cpp c rust perl csharp swift kotlin | php go py lua zig scala clojure elixir ocaml |
| windows | ts js rb java php cpp go c rust perl csharp | py swift kotlin lua zig scala clojure elixir ocaml |

CI never runs the py, lua, zig, scala, clojure, elixir or ocaml sweeps. py
skips on every platform because the runners have no pytest.

## What is left

1. **CI coverage.** Installing pytest in `build.yml` would make CI run the py
   sweep; lua with busted and dkjson, zig, scala-cli, elixir and ocaml would
   cover the rest. This container verified those; CI cannot.
2. **swift round 3** was desk-checked (every generated file parses); CI's
   ubuntu and macOS runners are its first compile.
3. **clojure query auth.** Five checks in `tm/clojure/test/sdk/test/pipeline.clj`
   assume an `authorization` header, and a query-auth SDK puts the key in
   the query. They fail the same way at 047db305, and no CI runs clojure.
4. **Pre-existing on main: an explained failure can lose its error.**
   `done()` and EntityBase's `_unexpected` prune `err` from
   `ctrl.explain.result`, which is the live result unless `clean` returned a
   copy. On main `clean` returned its input, so an explained failure
   reported `unknown error`. This branch fixes the default path; with
   `clean.active: false` it recurs. The langpack prunes a copy in lean
   (b7312ab). The fix is to prune a copy in every target.
5. **Entity names under `options.entity`** are read as field names during
   registration, as feature names were, so an entity named like `token`
   registers its override settings. Low risk: the generated config gives
   each entity an empty block.
6. **F5 gaps.** An error raised while iterating a stream result is not
   cleaned in go, csharp and scala; the go `Stream` goroutine has no
   recover; a panicking rust hook is not caught; an exception from a custom
   haskell `system.fetch` propagates uncleaned.
7. **Recorded, not fixed:** `entity.match()` returns a query-auth
   credential. The explainer's Edges list now says so.
8. **Noticed, pre-existing:** `tm/rust/tests/vendor/omni/mod.rs` includes
   `../COMMENT-NOTES.md`, which the generated tree does not ship; elixir
   warns about an unused `H` alias and `Config.feature_plugins/1`;
   `src/cmp/py/fragment/SdkError.fragment.py` is unreferenced; the php
   clean-off control test warns about a circular reference in `var_export`;
   three lean checks (paging, streaming, one secrets exchange check) fail on
   the langpack's main as well.

## Deliberate per-target divergences reported by the ports

These are recorded so a reader can tell a decision from a bug. Each belongs
in a comment at the divergence if it is not there already.

- **Validators that do not reject a mistyped credential.** go's validator
  substitutes `""`, swift's collects its errors, and rust, c, zig and lean
  discard or skip validation. Their sweeps sweep the constructed client, plus
  a cleaned string quoting the value, instead of a rejection.
- **Hooks that cannot throw.** swift, rust, c and zig hooks set
  `result.err` or `response.err` instead. cpp throws `std::runtime_error`.
- **go.** `runOp` now recovers a panicking hook into a cleaned SDK error,
  which is a behaviour change. The `Stream` goroutine still has no recover.
- **rust.** A panicking hook is not caught.
- **php.** F5 still rethrows under `throw: false`, because the cost feature
  relies on the throw. `clean` now walks `getPrevious()` and clears the
  cached `Exception::$string`.
- **rb.** Re-raising inside `rescue` attached the raw original as `cause`;
  it is now raised with `cause: nil`.
- **perl.** A foreign blessed exception object is returned unchanged; only a
  string error or the SDK's own error is cleaned.
- **lua.** The round-1 lane had never been run and failed on a clean
  checkout; it is fixed in dbcc817. The entity now prints only its data, as
  ts does, because `_match` absorbed the query credential.
- **clojure and ocaml.** F5 returns a cleaned copy, because throwables are
  immutable, so the exception class can change.
- **Foreign exceptions.** java, kotlin, csharp and scala replace a foreign
  exception with a cleaned SDK error carrying the original stack, because
  their messages are immutable; the original is not attached as the cause,
  since a printed trace would show it. elixir and ocaml return a cleaned copy
  from the catch path. swift's `direct()` cleans only the SDK's own error.
- **Where F5 sits.** java and kotlin already route a failed stage through
  `makeError`, so their gap was a `PreUnexpected` hook; that error still
  propagates under `throw: false`, now cleaned. csharp and scala route a
  non-SDK exception through `makeError`, as go and cpp do.
- **Validators that collect errors** (java, kotlin, scala, like go and swift):
  the sweep checks the constructed client and a quoted value instead of a
  rejection.
- **csharp** prints its skip line, because xunit 2 has no runtime skip.
- **The feature-name rule** lives in `make_options` in the native targets,
  which scan the feature map as a list of each feature's options.

## How to pick it up

```bash
cd ts && npm install && npm run build
node --test dist-test/clean.test.js dist-test/cleancoverage.test.js
node --test --test-name-pattern="no credential" dist-test/generatedcompile.test.js
cd .. && make comments scan-prose deps check-model
```

A lane whose toolchain is missing SKIPS visibly; it never passes silently.
Probe with `command -v` before concluding a target cannot be verified.
