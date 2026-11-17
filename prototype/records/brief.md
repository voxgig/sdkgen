# Brief: prototype to validate (or refute) the write-once documentation structure

You are testing a PROPOSAL by building it. Nothing you build ships; what
matters is what you measure. A clean refutation is as valuable as a
confirmation. Do not make the proposal look better than it is.

## The problem, in the maintainer's words

`@voxgig/sdkgen` generates client SDKs in 20 bundled languages from one
model, with a README and a REFERENCE per language. Many sentences in those
documents are wrong or go stale when the model changes (a feature removed, an
operation absent, HTTP Basic auth, a templated server URL). The maintainer's
challenge, after seeing a plan of 46 work packages to fix 329 catalogued
issues:

> the plan seems to miss the one thing that is vital and most important -
> what is your actual design principle for solving this problem? do you have
> a general solution? it looks like you are just suggesting large amounts of
> individual fixes

Then, after the proposal below was put to them:

> Do the prototyping to validate the proposal

## The proposal

**Write each sentence once; a language supplies syntax, never facts.**

Measured on a full generation of all 20 languages (stored outputs, below):
the documentation is written by 260 per-language components (about 36,000
lines) against 16 shared ones (about 2,200 lines), and about three quarters
of the prose lines in the READMEs and REFERENCEs are the same sentence in at
least 15 of the 20 languages once identifiers and the language's name are set
aside. Each sentence is written about twenty times and each copy decides for
itself when it applies. So:

1. **One resolved description of the SDK per target**, computed once from
   the model by the generator core: what the constructor takes, which
   entities and operations exist, their ids and required parameters, which
   features apply and their defaults, where things live, how to install. The
   code generators can read the same description.
2. **Shared documents hold every sentence**, each written once and
   conditioned once on that description.
3. **Each language supplies only how to write things**: a constructor call,
   a method call, an import, an error-handling block, a signature, a type
   name. A provider is a printer. It receives values from the description and
   never the model.
4. **A runtime difference is data.** A language whose runtime lacks an
   option or a capability says so in its description, and the shared
   sentence follows; there is no separate paragraph.

sdkgen 4.43.0 already works this way for the README introduction
(`ts/src/cmp/ReadmeIntro.ts`: a shared frame around a per-language
`ReadmeIntroBody`).

## What would refute it (fixed before any prototype was built)

| | Claim | Refuted if |
|---|---|---|
| H1 | The two sections under test (the README quick start and the REFERENCE page) can be written as one shared component plus one syntax provider per language, for all 20 languages | providers for 3 or more languages have to read model facts or carry model-dependent conditions; or per-language prose that cannot be shared exceeds about 15% of the sections' prose; or the provider interface needs more than about 10 breaking changes after the first four languages |
| H2 | The source shrinks substantially | less than 2x fewer lines for those sections |
| H3 | The catalogued issues in those sections are fixed once, for every language | more than about 10% of them still need a per-language edit |
| H4 | Examples still compile and run | an example test fails, in a language with a toolchain here, for a reason intrinsic to the approach |
| H5 | Existing projects, packs and aliases can move to it safely | retiring per-language components cannot be made safe for `doctor`, `remove`, `target add` and `package update` without breaking their rules, or a pack's targets stop generating |

Report against these. Say plainly when a threshold is crossed.

## Hard rules

- Never modify anything under `/home/user`. It holds the user's checkouts.
  Reading them is fine. No `git worktree add` there, no `npm install` there.
- Write only under your own directory:
  `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/<your key>/`
- No `git push`, no GitHub write, no `npm publish`. A local `git commit`
  inside your own clone is fine and useful for diffs.
- `npm install` from the public registry is allowed inside your directory
  only. Send nothing else anywhere.
- Never `rm -rf` a path held in a variable; type the literal absolute path.
- Four CPUs are shared with one other agent. Timings are perturbed: measure
  three times and report the minimum.
- RETURN your findings in the structured result you are asked for. You may
  keep notes and scripts in your directory, but a report file may be refused
  by the harness, so the structured result is the record.

## Where things are (read-only unless inside your own directory)

| Path | What |
|---|---|
| `/home/user/sdkgen` | sdkgen at 7f3fc9c3 = `main` 9aebaf9e (4.44.0) plus three documents only. Built: `ts/dist`, `ts/dist-test`, `ts/dist-test-scaffold`. This is the OLD implementation; generate "before" output from it. |
| `/home/user/sdkgen/docs/design/model-dependent-text-issues.md` | The catalogue: 329 issues by id (S49, U44, ...), each with where, evidence, fix, check. `grep -n '^### S49\.'` and read the entry. |
| `/home/user/sdkgen/docs/design/model-dependent-text.md`, `...-plan.md` | The earlier design note and plan (the approach being challenged). |
| `/home/user/voxgig/sdkgen-langpack` | The language pack (dart, haskell, lean) at c6069bb: targets shipped OUTSIDE sdkgen, with their own per-language README components. |
| `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/spike/` | An earlier spike. `lib.js`: model builder (`makeModel`), a Root mirroring the standard project Root (`stdRoot`), in-memory `generate(spec)`, `mdOf`. `spike.js`: 146 single-switch model variations (their specs are reusable). `docsonly.js`: a docs-only Root (about 0.7 s a generation against 2.7 s). `lib.js` hard-codes `TS = '/home/user/sdkgen/ts'`: copy it and point `TS` at your clone to generate "after" output. |
| `.../scratchpad/design/spike/out/<variation>/md/` | Stored OLD output, every markdown file, for the baseline `B` (all 23 targets, all features, 7 entities, SDK name `Demo`) and for each of the 146 variations (`auth-basic`, `auth-query`, `auth-off`, `server-none`, `op-absent-readonly`, `ent-only-ambient`, `ent-none`, `lone-go`, ...). `B/md/<lang>/README.md` and `REFERENCE.md` are the quickest way to see what all 20 languages print today. |

The 20 bundled SDK languages: `ts js go py php rb lua csharp java kotlin
scala swift rust c cpp zig perl clojure elixir ocaml`. Three more bundled
targets (`go-cli`, `go-mcp`, `py-data`) wrap an SDK and are out of scope.

Per-language documentation components live in
`ts/project/.sdk/src/cmp/<lang>/Readme*_<lang>.ts` (they import the
generator's public API from `@voxgig/sdkgen`); the shared ones in
`ts/src/cmp/Readme*.ts`, which find a per-language component through
`optionalComponent(ctx$, target, '<Name>')` (`ts/src/helpers/optional.ts`).
Per-language example helpers are in `cmp/<lang>/utility_<lang>.ts`
(`exampleValue`, ...). The shared helpers already hold much of the
selection logic (`ts/src/helpers/opShape.ts`, `opExample.ts`,
`serverVars.ts`, `packageMeta.ts`, `ts/src/utility.ts`).

## A writable copy of sdkgen

```sh
export PATH=/opt/node24/bin:$PATH
D=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/<your key>
mkdir -p "$D" && cd "$D"
git clone -q /home/user/sdkgen sdkgen && cd sdkgen && git checkout -q 9aebaf9e
git config user.name proto && git config user.email proto@example.invalid
cp -a /home/user/sdkgen/ts/node_modules ts/node_modules
cd ts && npm run build      # dist, dist-test, dist-test-scaffold IN THE CLONE; a few minutes
```

`npm run build` type-checks the per-language components (`check-scaffold`)
and stages a miniature consumer in `ts/dist-test-scaffold/` whose
`node_modules/@voxgig/sdkgen` re-exports the clone's own `dist`, so
components there run against YOUR changes. Print the resolved path once
before relying on that.

The repository's suite without the slow toolchain lanes:

```sh
cd <clone>/ts && node --enable-source-maps --test \
  $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)
```

`ts/test/generatedcompile.test.ts` holds the lanes that generate an SDK and
compile or run it with a real toolchain, including the README example lanes
(`README_LANES` near line 8798, the ts README loop near line 1089,
`DOC_LANES` near line 9203). Run one lane with
`node --test --test-name-pattern '<name>' dist-test/generatedcompile.test.js`.

## Toolchains on this machine (measured; check again with `command -v`)

Present: node 22 by default and node 24 at `/opt/node24/bin`, tsc, go
(`go version`), python3, ruby with bundle, php with composer, perl, javac
with mvn, rustc with cargo, gcc and g++.

Missing: lua, busted, dotnet, kotlinc, scala and sbt, swift, zig, clojure,
elixir, ocaml, ghc, dart, lean.

So examples can be compiled or run here for ts, js, go, py, rb, php, perl,
java, rust, c and cpp. For the other nine, the test is that a code block is
byte-identical to what the current component prints for the same model,
except where a listed correction changes it.

## Honesty rules

- Separate what you RAN from what you READ. A number without the command
  that produced it is not a measurement.
- When the proposal turns out wrong somewhere, say what is true instead,
  with the file and line or the command output.
- Say what you did not get to. "Not tested" is worth more than a guess.
- Do not soften a refutation and do not invent agreement.
- Do not name AI models or tools anywhere in code, comments or commits.
