# Cut a checkpoint and revendor

struct, omni, plugin and sekreto are vendored into the scaffold templates at
a single shared git tag, so "what is this SDK vendoring" has one answer.
Moving to newer upstream code is two steps in two repositories: cut a
checkpoint in `voxgig/admin`, then resync here against it.

This is the procedure. For why it is shaped this way, read
`../design/vendor-tag-rollout.md`; for the rules that keep it honest, read
the "Vendored libraries: one tag, one tool" section of `AGENTS.md`.

## Before you start

The checkpoint builds all four repositories **together**, which is the only
time cross-repo bugs appear — CI builds each one alone. Expect the run to
find real defects, and expect it to take hours on a 4-core machine.

Three things have cost a run before:

- **Stale build daemons.** A long-lived bloop/scala-cli JVM holding a few
  gigabytes gets the run OOM-killed, and the kill reads as a test failure.
  `gradle --stop`, each port's `./gradlew --stop`, `dotnet build-server
  shutdown`, then look for the rest:

  ```bash
  ps -eo pid,etime,rss,args | grep '[j]ava'
  ```

- **`scalac` from coursier.** The launcher on `PATH` has no `lib/*.jar`
  beside it, which breaks the `SCALAHOME` discovery struct, omni and sekreto
  share. Put the pinned release first:

  ```bash
  export PATH=$HOME/.local/opt/scala3-3.4.2/bin:$PATH
  ```

- **Stale `build/` directories** from a different compiler version, which
  produce confusing TASTy errors. Remove them in the port and in anything it
  depends on — but note that **`struct/build/` is tracked source, not
  output**. Deleting it is a `git checkout` away from being fixed, and is
  easy to do by accident with a `find -name build` sweep.

zig 0.16, lean, and `libssl-dev` + `libcurl4-openssl-dev` also have to be
present; see `dev-machine-toolchains` notes for this machine.

## 1. Cut the checkpoint

```bash
cd ~/Projects/voxgig/admin
make status        # one line per repository
make checkpoint    # preflight, tests, then tag all four
```

Three phases, in order, and **a failure in any one writes nothing**:
preflight (each repository on `main`, clean, at `origin/main`), then each
repository's own full gate, then annotate and push all four tags. Tags are
created locally for all four before any is pushed, and a part-way failure
rolls back the ones already made — a checkpoint that exists in three
repositories is worse than none, because it looks like one.

The tag is `sdk-<yyyymmdd>-<hhmm>-<n>` in UTC, the same name everywhere.
Each tag's message lists all four commit SHAs, so `git show <tag>` in any
one repository tells you what the other three were pinned at.

Useful variants:

| | |
|---|---|
| `DRY_RUN=1` | run preflight and the tests, print the tag, write nothing |
| `PUSH=0` | create the tags locally and stop |
| `make push-tag TAG=…` | send tags a previous run created but did not push |
| `ALLOW_UNTRACKED=1` | tolerate untracked files (tracked changes still fail) |

If preflight fails because a repository is behind, pull all four **before**
starting — do not pull while a run is in progress.

## 2. Point the route table at the new tag

One field, in `ts/vendor/routes.json`:

```json
"tag": "sdk-20260917-1042-0",
```

Do **not** touch the per-route `version`. A port that declares a version of
its own carries it by hand; a port that declares none omits the field and is
stamped with the tag automatically. Writing the tag out per route is what let
52 of 70 routes drift a checkpoint behind, and `vendor.js` now refuses a
`version` that looks like a tag.

## 3. Resync

```bash
make vendor          # rewrites the templates and ts/test/vendored.json
make vendor-check    # the no-write form CI runs
```

`vendor.js` reads content with `git show <tag>:<path>` — never a working
tree — applies each route's declared `adapt` rewrites, stamps a three-line
provenance header in the language's own comment syntax, and regenerates the
manifest. A missing `adapt.from` fails the run loudly: upstream moved, and
the route needs updating rather than the failure suppressing.

The run ends by listing every adapt marked `"backport"`. Those are API
backports with no upstream counterpart — check each one's issue at every
resync, and delete the rule once upstream carries the API.

## 4. Verify

```bash
make all             # build, then the full suite
```

Four guards matter here, and they fail in different ways:

- **`vendored.test.ts`** — every file's header agrees with the manifest,
  every manifest file exists, and no full-set plugin barrel was vendored.
- **`local deviations from vendored code stay marked`** — the `patched`
  table and the files must agree in both directions. A resync that carries
  an upstream fix should delete the `PATCH (…, pending upstream fix)` block
  *and* its table entry together. A new local deviation needs its own marker
  and an upstream issue; an unmarked hand-edit is indistinguishable from a
  resync that silently lost a fix, which is the failure this exists to stop.
- **`structnull.test.ts`** — characterizes each port's null semantics, so a
  resync that moves a port between auth-null failure classes fails rather
  than passing quietly.
- **`make vendor-check`** — byte-level drift against the tag.

Then regenerate a real SDK and run its suite. Generation compiling is not
the same as the vendored code behaving, and the difference has been a real
defect more than once.

## What is NOT covered here

`@voxgig/sdkgen-langpack` (dart, haskell, lean) is outside this tool's write
root. Its vendored sekreto and plugin trees keep their `VENDORED:` headers
but have no route table, no manifest and no guard of their own — resyncing
them is a manual copy. That gap is recorded in the routes.json note and in
`../design/pack-repositories.md`, not silently absent.
