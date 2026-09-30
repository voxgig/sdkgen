# Secret redaction: handover

Status at hand-off, 2026-09-30. Work was stopped on request partway through a
second review round. This note says what is done, what is verified and how,
and exactly what is left.

The design itself is recorded in ADR.md (ADR-003) and
`docs/explanation/secret-redaction.md`. Read those first; this note does not
restate them.

## The three pull requests

| Repo | PR | Branch | State at hand-off |
| --- | --- | --- | --- |
| voxgig/sdkgen | #229 | `claude/amazing-goodall-33f6ox` | round 1 plus most of round 2 pushed with this note; CI not yet seen on the new head |
| voxgig/sdkgen-langpack | #24 | same | round 1 pushed (a8f8dc6, green); round 2 exists only as UNCOMMITTED changes in the working container, which is lost with it; eight Codex findings unanswered |
| voxgig/sdkgen-infrapack | #28 | same | round 1 pushed (0f5737a), green; nothing outstanding |

## sdkgen commits on the branch

| Commit | What |
| --- | --- |
| up to 4d26b41 | Round 1: `clean`, the registry, the sweep and a lane, across all 20 bundled targets. |
| 89dbfc5 | swift entity prints only its data (CustomReflectable); php lane runs with `zend.exception_ignore_args=0`. |
| c7629e6 | Round 2 in the ts reference: the six Codex findings (below). |
| dbcc817 | Round 2 ported to js, go, py, php, rb, perl, lua, rust, c, cpp, zig, swift, clojure, elixir and ocaml. Also: `direct()` cleans the error it returns; the php Xdebug fix; the Windows cpp lane path; the phpunit temp-project cleanup; config-level `clean` honoured (ts, js only). |

## What CI said about 89dbfc5, and what dbcc817 does about it

- **macOS:** green, which confirms the swift fix.
- **ubuntu:** php header, query and basic lanes failed.
  - The "near the leak" excerpt showed the leaking text is Xdebug's
    `xdebug_message`. In develop mode Xdebug writes every stack frame's
    arguments onto an exception AT THE THROW, after the SDK has cleaned it.
    Those frames include the caller's own `$sdk`, whose `options` hold the
    raw key.
  - The SDK cannot clean something written after `throw`. It is a debugger's
    view, like `err.ctx`.
  - The generated php sweep therefore unsets `xdebug_message` on the error
    and on its `getPrevious()` chain before searching. The explainer's Edges
    list says so.
- **windows:** the cpp lane passed `test\clean_test.out` to make, which has
  no such rule. It now passes `test/clean_test.out`.

## Round 2: the findings being fixed

Codex left seven threads on #229. One is outdated: it asked for the fleet
port, which landed in 9a82d7e and 4d26b41. The other six:

| Id | Finding | ts/js | Fleet |
| --- | --- | --- | --- |
| F1 | makeError dropped the cleaned copy of a non-Error throwable | fixed | n/a (typed errors) |
| F2 | `_features` enumerable on the client | fixed | n/a |
| F3 | a mistyped credential (`apikey: { value }`) leaked through the constructor's validation error; register every scalar under a sensitive name, any depth, BEFORE validation (`cleanAddSensitive`) | fixed | ported in dbcc817 except java, kotlin, scala, csharp |
| F4 | the sweep failed on an SDK with no argument-free op; retry with path params, skip visibly | fixed | same |
| F5 | the op catch path (`_unexpected`) rethrew an uncleaned error, e.g. from a hook | fixed | same |
| F6 | a registered secret used as a property NAME survived; mask names, suffix `#n` on collision | fixed | same |

Each sweep gained two scenarios. The first is a mistyped credential. The
second is a feature hook that fails while quoting `ctx.spec`. The ts and js
sweeps also gained a failing `direct()`. Every new scenario was shown to FAIL
with its fix reverted, wherever a toolchain was present.

Replies on the seven #229 threads have NOT been posted. Reply with the fixing
commit (c7629e6 for the ts reference, dbcc817 for the fleet), then resolve
each thread. The thread ids are:

- `PRRT_kwDOMfi0us6nUIAe` (F1)
- `PRRT_kwDOMfi0us6nUIAt` (F2)
- `PRRT_kwDOMfi0us6nUIA0` (F3)
- `PRRT_kwDOMfi0us6nUIA7` (outdated)
- `PRRT_kwDOMfi0us6nUIBB` (F4)
- `PRRT_kwDOMfi0us6nUIBH` (F5)
- `PRRT_kwDOMfi0us6nUIBJ` (F6)

## What is verified, and how

Run in this container, on dbcc817 or on the same patches before they were
applied:

- **Local lanes, 24 of 24 pass.**
  `node --test --test-name-pattern="(ts|js|go|py|rust|c|cpp|zig): no credential" dist-test/generatedcompile.test.js`.
  zig was a downloaded 0.16.0.
- **php, rb, perl and lua, 12 of 12 pass**, in the porting agent's worktree
  on the same patch. Lua 5.4 was apt-installed there. These were not re-run
  in the main checkout after the patches were applied.
- **`dist-test/clean.test.js`: 20 of 20 pass.** This includes the config
  `clean` block test, which fails with the L1 fix reverted.
- **`make comments` and `make scan-prose` are clean.** `npm run golden` was
  refreshed.
- **Not compiled here:** swift, clojure, elixir and ocaml. They were only
  desk-checked, and generate, parity, featuremodel and cleancoverage pass.
  CI compiles swift on macOS.
- **The full `npm test` was NOT run on dbcc817.** The first CI run on this
  head is the first full run.

## What is left

1. **java, kotlin, scala, csharp: port round 2 (F3 to F6) and L1/L5.** An
   agent had partial, unverified changes in a scratch worktree when work
   stopped. They were not preserved. Start from dbcc817 and mirror the ts
   diff in c7629e6 plus the ts MakeOptionsUtility change in dbcc817. javac is
   usually available here; kotlin, scala and csharp are compiled by CI.
2. **Round 3, fleet-wide.** Both findings come from Codex on langpack#24, and
   both apply to sdkgen targets too.
   - **L1:** the derived clean config must merge the schema defaults, then a
     COPY of the generated config's own `clean` block, then the caller's
     block. The `values` of both blocks must be registered. Done in ts and js
     only. Pattern: `ts/project/.sdk/tm/ts/src/utility/MakeOptionsUtility.ts`
     and the test "the generated config's own clean block is honoured" in
     `ts/test/clean.test.ts`.
   - **L5:** wherever clean cleans the error value, the `code` (or the
     printed error kind) is value-cleaned too. Done in ts, js (in place over
     own properties), rust, c, cpp and zig. Check and fix the rest.
3. **langpack#24.**
   - Re-apply round 2 for dart, haskell and lean. The uncommitted changes did
     not survive the container. They passed `npm test` and `make comments`
     but were never compiled. A dart SDK was downloaded for a real check,
     which was stopped before it reported.
   - Answer the eight Codex findings there:
     1. P1: the config's clean block is ignored (L1 above).
     2. P1: lean's `failOp` exits leave `ctrl.explain` holding the live spec.
     3. P2: a lean proxy password with a colon must split at the FIRST
        colon.
     4. P2: haskell and lean percent-decode proxy userinfo byte-by-byte;
        decode it as UTF-8.
     5. P2: the error `code` is not cleaned in dart, haskell or lean (L5).
     6. P2: map keys are not masked (F6).
     7. P2: haskell `2 * crHint` can overflow for a huge `hint`; cap it.
     8. P2: with clean off, lean's `doneExplain` mutates the live result;
        clone it first.
4. **Update the #229 body.** Cover:
   - the CI-found leaks (the swift `dump` of `entity.match`, and the php
     Xdebug annotation) and their fixes;
   - the observation below;
   - a coverage table that says CI verifies more targets than this container
     did.
5. **Record, but do not fix here:** every target copies the query-auth
   credential into `resmatch`, and so into `entity.match()`. It is a
   programmatic accessor rather than an egress, and it is masked wherever it
   is printed. Removing it is a behaviour change to propose separately.

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

## How to pick it up

```bash
cd ts && npm install && npm run build
node --test dist-test/clean.test.js dist-test/cleancoverage.test.js
node --test --test-name-pattern="no credential" dist-test/generatedcompile.test.js
cd .. && make comments scan-prose deps check-model
```

A lane whose toolchain is missing SKIPS visibly; it never passes silently.
Probe with `command -v` before concluding a target cannot be verified.
