# Issues: the generated text, and the defects found beside it

Status: **catalogue** (2026-11-12). Nothing here is fixed. These are the 329
issues that `docs/design/model-dependent-text-plan.md` resolves, one entry
each; the mechanism most of the fixes share is in
`docs/design/model-dependent-text.md`.

Each entry was read again against the code before the plan was written: sdkgen
`main` at 9aebaf9e (4.44.0), sdkgen-langpack c6069bb, sdkgen-infrapack 5e91250
(0.0.19), docgen 9ca5221 (0.30.9), apidef 3058271 and create-sdkgen 6fe1759
(0.31.8). An entry that says f42124e4 means the same sdkgen source: that
commit is `main` plus the design note. Paths are relative to the sdkgen
repository root unless the entry names another repository.

---

## How to read an entry

- **Fate.** The work package of the plan that resolves the issue, the issue it
  repeats, or why it is not a defect.
- **Class.** The kind of issue; the repository; where the text or code is
  written; how many source files change; a size (`xs` one line in one file,
  `s` up to 5 files, `m` up to 25, `l` more); and what a project sees change.
  Then the derivations and decisions the fix needs.
- **Where.** The files and lines, at the commits above.
- **At head.** Whether the issue is still present, and what was read or
  measured to say so.
- **Fix.** The change proposed. The plan's package is the authority where the
  two differ, because review moved some fixes.
- **Check.** The test or guard relation that holds the fix.

Where a fix is written decides how it reaches a project. A
`neutral-component`, `helper`, `action` or `model-schema` change is in
`ts/src` or `ts/model` and reaches a project at its next generate once its
package version moves. A `per-language-copy`, `template`, `fragment`,
`consumer-main` or `target-or-feature-model` change is under
`ts/project/.sdk/` (or a pack's `.sdk/`), is copied into each project, and
reaches one only through `package update` or `target add`.

The entries keep the words they were written in. Stages 0 to 4 are the design
note's stages (its section 10), and DQ1 to DQ24 are the plan's decisions. "The
map" is the survey of every model-dependent sentence that preceded the design.
`guard-core`, `guard-stage`, `facts`, `auth-ctor`, `ops-claims` and `floor`
are the prototypes run against the design, and `compat` one of its reviews;
the design note summarises what they measured (its section 3 and appendix C),
and their working files are not in this repository. Counts of files, lines and
cells are the ones first measured: not all were counted again at the commits
above, so a fix enumerates its files from the code.

## S. Sentences that go stale or are wrong under one switch (S01 to S50)

Found by generating the documentation under variations that each change one
thing: a target, a feature, a feature's default, an entity, an operation,
auth, a phase or a placement.

### S01. CHANGELOG first entry always promises "plus CLI and MCP surfaces" whatever consumer targets the model has

- **Fate.** WP15.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: targetSurface; DQ2.
- **Where.** `ts/src/cmp/Changelog.ts:23`
- **At head.** Present. Opened `Changelog.ts` at f42124e4: lines 22-24 are one
  fixed template string; the File is written with exclude: true, and
  `generate.test.ts:1375` pins that an existing `CHANGELOG.md` survives
  regeneration.
- **Fix.** Build the parenthesis from the model: the titles of active targets
  whose targetSurface is 'sdk', then 'plus &lt;surface words>' only for active
  targets whose surface is cli/mcp/data; omit the 'plus' clause when there are
  none. Because the file is exclude: true, the fix reaches only projects that
  have no `CHANGELOG.md` yet; existing projects keep their text (state this in
  the release note, do not rewrite their file).
- **Check.** Text guard relation off (variations removing go-cli/go-mcp,
  `lone-<t>`); add an assertion in `ts/test/generate.test.ts` next to the
  CHANGELOG case (:1375) that a lone-ts model's CHANGELOG names neither CLI
  nor MCP.

### S02. CHANGELOG lists six fixed languages (TypeScript, Python, PHP, Go, Ruby, Lua) regardless of the targets present

- **Fate.** WP15.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: targetSurface.
- **Where.** `ts/src/cmp/Changelog.ts:22`
- **At head.** Present. `Changelog.ts:22-23` hard-codes the six language
  names; no read of the target map anywhere in the component.
- **Fix.** Same sentence as S01, one change: list target.title for each active
  target with targetSurface 'sdk' in model order (Oxford-comma join); drop the
  parenthesis if none. Reaches only projects without a `CHANGELOG.md`
  (exclude: true).
- **Check.** Text guard off relation over `lang-off-<t>` and `lone-<t>`;
  assertion in `ts/test/generate.test.ts` that a lone-zig CHANGELOG names Zig
  and not TypeScript.

### S03. `SECURITY.md` scope names a fixed registry list (npm, PyPI, Packagist, RubyGems, LuaRocks, Go module)

- **Fate.** WP15.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size s;
  changes generated documents. Needs: targetSurface.
- **Where.** `ts/src/cmp/Security.ts:34`
- **At head.** Present. `Security.ts:33-34` is a literal; `packageMeta.ts`
  already exports registryName(model,target) and registryState (which marks
  go/go-cli/go-mcp as tag-only), and every bundled target model declares
  publish.registry.name.
- **Fix.** Derive the parenthesis from active targets with targetSurface
  'sdk': the distinct registryName values mapped to display names through a
  table keyed by REGISTRY name (npm, pypi, packagist, rubygems, luarocks,
  ...), plus 'the Go module' when a target's origin is go, plus 'git tags' for
  tag-only ports; drop the parenthesis when the list is empty. Separately,
  registryState's literal 'go'/'go-cli'/'go-mcp' should read targetSurface.
- **Check.** Text guard off relation over `lang-off-<t>/lone-<t>`; extend the
  `SECURITY.md` assertion in `ts/test/generate.test.ts` (:2218) to a lone-js
  model expecting only npm.

### S04. `PUBLISHING.md` first-release command is literal "cd ts &amp;&amp; npm publish" though the worked example uses targets\[0\]

- **Fate.** WP14.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents and code. Needs: targetPlace; DQ3.
- **Where.** `ts/src/cmp/PublishWorkflow.ts:417`
- **At head.** Present. publishingDoc() interpolates targets\[0\].name
  everywhere else (lines 349-368) but :417 is the literal `cd ts`; the
  generated workflow's working-directory (:194-254) uses target.name too,
  which shares the cause for root and external targets.
- **Fix.** Replace the literal with the folder of targets\[0\] from
  targetPlace: 'folder' -> `cd <dir> && npm publish --access public`; 'root'
  -> `npm publish --access public` with no cd; 'external' -> name the external
  repository/path instead of a cd. Apply the same targetPlace answer to the
  workflow's working-directory.
- **Check.** Text guard link relation (cd lines resolve in the written tree)
  for lang-off-ts and output-external-ts; add a case to
  `ts/test/publishworkflow.test.ts` with only js as npm target asserting `cd
  js`.

### S05. Error-handling section in 13 non-JS READMEs prints a TypeScript try/catch example from the DEFAULT\_LANG fallback row

- **Fate.** WP07.
- **Class.** wrong-language; sdkgen; neutral-component; 2 source files; size
  m; changes generated documents. Needs: DQ3.
- **Where.** `ts/src/cmp/ReadmeErrors.ts:25-53` (DEFAULT\_LANG); :212
  (LANGS\[target.name\] || DEFAULT\_LANG); `ts/src/helpers/opExample.ts:20`
  (helperLang supports 7 languages)
- **At head.** Present. LANGS has rows for py, php, rb, lua, go only (lines
  59-175); selection at :212 is keyed by target.name with a TypeScript
  default, and helperLang falls back to 'ts' for every other language. Pack
  targets (dart, haskell, lean) get the same fallback since ReadmeErrors has
  no override hook.
- **Fix.** Key the table by origin language (originName), not target.name; add
  a row for every bundled language (ts, js with a js fence, c, clojure, cpp,
  csharp, elixir, java, kotlin, ocaml, perl, rust, scala, swift, zig) with
  each language's own failure idiom, and remove DEFAULT\_LANG: a language with
  no row writes only the language-neutral direct() prose or nothing. The
  entity example needs a call expression per language, so either extend
  opExample's ExampleLang beyond seven or let the per-language component
  supply the snippet via optionalComponent. Design stage 2 'wording tables
  keyed by origin, no default row'.
- **Check.** Exact fence-tag check in the text guard (a target's document
  carries only its language's or a neutral fence); extend
  `ts/test/readme.test.ts` to assert no \`\`\`ts block in `c/README.md` Error
  handling; alias case (go\~go2) in `ts/test/alias.test.ts` gets the go row.

### S06. Root `AGENTS.md` calls a single-target project "multi-language SDK project"

- **Fate.** WP15.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: targetSurface.
- **Where.** `ts/src/cmp/AgentGuideTop.ts:33`
- **At head.** Present. `AgentGuideTop.ts:33` is unconditional although
  activeTargets(model) is computed three lines above (:26).
- **Fix.** Count active targets with targetSurface 'sdk': more than one -> 'a
  generated multi-language SDK project'; exactly one -> 'a generated `<Title>`
  SDK project'; and write 'each language directory' only when there is more
  than one.
- **Check.** Text guard off relation on `lone-<t>` (needs 'multi-language' in
  the synonym table) plus an assertion in `ts/test/agentguide.test.ts` for a
  lone-ts model.

### S07. Root `AGENTS.md` names `ts/` and `go/` as the project's build-output directories whether or not they exist

- **Fate.** WP14.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: targetPlace; DQ3.
- **Where.** `ts/src/cmp/AgentGuideContent.ts:126`
- **At head.** Present. workflowSection() at :121-136 takes no model argument;
  line 126 is literal. Line 131's add-target example list is how-to text and
  stays.
- **Fix.** Pass the model to workflowSection and list the directories of the
  active targets from targetPlace ('folder' entries, first two plus an
  ellipsis); with only root/external targets, write 'The generated target
  output' without naming directories.
- **Check.** Text guard off relation (path segment `ts/`) under
  `lang-off-ts/lone-<t>`; assertion in `ts/test/agentguide.test.ts` that a
  lone-py guide names `py/` and not `ts/`.

### S08. Features intro says unconfigured SDK has "no retries, no cache, no logging" whether or not those features exist

- **Fate.** WP16.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: featureOnByDefault.
- **Where.** `ts/src/cmp/ReadmeFeatures.ts:31`
- **At head.** Present. `ReadmeFeatures.ts:28-31` is one fixed paragraph after
  featureDocs(model,target); retry/cache/log are named literally. The same
  paragraph carries S09.
- **Fix.** Rewrite the paragraph as one sentence from featureOnByDefault (see
  S09) and delete the 'no retries, no cache, no logging' enumeration, or build
  it from the default-off features actually listed (their titles), never from
  literal names.
- **Check.** Text guard off relation over feat-off/absent-{retry,cache,log};
  assertion in `ts/test/readme.test.ts` that a feat-test-only README does not
  contain 'retries' or 'cache'.

### S09. README and REFERENCE say every feature is inactive until switched on; `log` defaults on and its own table prints `active | true`

- **Fate.** WP16.
- **Class.** contradiction; sdkgen; neutral-component; 2 source files; size s;
  changes generated documents. Needs: featureOnByDefault.
- **Where.** `ts/src/cmp/ReadmeFeatures.ts:29-30`;
  `ts/src/cmp/ReadmeRefFeatures.ts:24`; `ts/src/cmp/ReadmeRefFeatures.ts:133`
  (correct rule: `ts/src/cmp/AgentGuideFeature.ts:31`)
- **At head.** Present. Opened all three sites at head: each is unconditional;
  `AgentGuideFeature.ts:31` alone reads config.options.active and prints
  'Active by default: yes' for log, so two generated documents contradict each
  other.
- **Fix.** Add featureOnByDefault(model,name) (`helpers/applicability.ts`) and
  have `AgentGuideFeature.ts:31` call it. ReadmeFeatures: 'Each is inactive
  until you switch it on' only when no listed feature is on by default, else
  'Each is inactive until you switch it on, except &lt;on-by-default list>,
  which run unless disabled.' ReadmeRefFeatures :24 same rule; :133 writes
  'Inactive by default...' only when !featureOnByDefault(f), else 'Active by
  default: set `active: false` to switch it off.'
- **Check.** Exact check in the text guard ('a sentence says features start
  off only when every feature it covers does'); the design's derivation test
  (featureOnByDefault equals each Config entry's options.active);
  `readme.test.ts` assertion under the baseline that log's section does not
  say 'Inactive by default'.

### S10. Root README Features line says all features are "opt-in, inactive until switched on" while `log` defaults on

- **Fate.** WP16.
- **Class.** contradiction; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: featureOnByDefault.
- **Where.** `ts/src/cmp/ReadmeTop.ts:245-246`
- **At head.** Present. `ReadmeTop.ts:244-248` writes the claim for any
  non-empty featureDocs(model); no read of config.options.active.
- **Fix.** Same featureOnByDefault rule as S09: name the on-by-default
  features ('`log` runs by default; the rest are opt-in') and keep 'opt-in,
  inactive until switched on' only when none is on by default. One stage-2
  commit with S08/S09.
- **Check.** Same exact check as S09 applied to the root README;
  `ts/test/readme.test.ts` or `generate.test.ts` root README assertion under
  the baseline.

### S11. Root README 'Offline unit testing' promises a built-in test mode with no `test` feature in the model

- **Fate.** WP22.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size s;
  changes generated code. Needs: test-feature generate/doctor error (design
  section 13); targetSurface.
- **Where.** `ts/src/cmp/ReadmeTop.ts:348-353`;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeTopTest_<lang>.ts` (20 files, e.g. ts,
  go)
- **At head.** Present. `ReadmeTop.ts:348` gates only on sdkTargets.length.
  But `target.ts:131-134` installs `test` on every target add and
  `remove.ts:179` refuses `feature remove test`; no generate-time or doctor
  check for a missing test feature exists (grep of ts/src found none).
- **Fix.** Per design section 13: do NOT gate documents on the test feature.
  Add a check in generate (beside guardModelNames in `ts/src/sdkgen.ts`) and
  in `action/doctor.ts` that reports an ERROR when an SDK-surface target's
  model lacks the `test` feature, naming `voxgig-sdkgen target add <t>` as the
  repair. The sentence then holds by construction and is pinned 'true by
  construction' in the guard.
- **Check.** New cases in `ts/test/doctor.test.ts` and
  `ts/test/generate.test.ts`: a model with test removed fails with the named
  repair; the text guard pins the S11-S14/S19/S20 family as true by
  construction.

### S12. Every target README's "\#\#\# Use test mode" how-to is written with no `test` feature present

- **Fate.** Repeats S11 and is resolved with it in WP22.
- **Class.** stale-mention; sdkgen; per-language-copy; 0 source files; size
  xs; changes nothing in generated output. Needs: test-feature generate/doctor
  error (design section 13).
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeHowto_<lang>.ts` (ts:134,
  go:128; 20 files)
- **At head.** Present. grep finds the heading in all 20
  `ReadmeHowto_<lang>.ts`, unconditional; `generatedcompile.test.ts:1186`
  reads the '\#\#\# Use test mode' block, so the heading is load-bearing.
- **Fix.** No text change and no copy change: resolved by the S11
  generate/doctor error (test-absent is a hand-edited, already-broken
  project). Keep the heading (a test depends on it).
- **Check.** S11's tests; the guard pin for the test-feature family.

### S13. Constructor tables document `SDK.test()` as creating a mock client when the mock transport is not shipped

- **Fate.** Repeats S11 and is resolved with it in WP22.
- **Class.** stale-mention; sdkgen; per-language-copy; 0 source files; size
  xs; changes nothing in generated output. Needs: test-feature generate/doctor
  error (design section 13).
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeModel_<lang>.ts`
  (ts:112,118) and `ReadmeRef_<lang>.ts` (ts:98); about 40 files
- **At head.** Present. Opened `ts/ReadmeModel_ts.ts:112,118` and
  `ts/ReadmeRef_ts.ts:98`; 42 Readme\*`_<lang>` files carry the test-client
  wording, all unconditional.
- **Fix.** No text change: resolved by the S11 error at generate/doctor; with
  `test` always installed the description is true.
- **Check.** S11's tests.

### S14. Pipeline explanation says PreRequest is replaced "as TestFeature does with mocks" with no TestFeature present

- **Fate.** Repeats S11 and is resolved with it in WP22.
- **Class.** stale-mention; sdkgen; neutral-component; 0 source files; size
  xs; changes nothing in generated output. Needs: test-feature generate/doctor
  error (design section 13).
- **Where.** `ts/src/cmp/ReadmeExplanation.ts:281`
- **At head.** Present. `ReadmeExplanation.ts:280-281` is a fixed string
  inside the stage list.
- **Fix.** No change beyond the S11 error; with `test` guaranteed, the
  parenthesis is true by construction. Optional hardening: drop the
  parenthesis if the guard's pin is not wanted.
- **Check.** S11's tests; guard pin.

### S15. Module-structure trees name "Built-in features (Base, Test, Log)" in 18 READMEs regardless of declared features

- **Fate.** WP34.
- **Class.** stale-mention; sdkgen; per-language-copy; 18 source files; size
  m; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeExplanation_<lang>.ts`
  (ts:15, go:28, py:27, c:38); 18 files; sdkgen-langpack
  `.sdk/src/cmp/dart/ReadmeExplanation_dart.ts:36`
- **At head.** Present. grep: 7 files write '(Base, Test, Log)', 6 '(Base,
  Test, Log, ...)', 5 lowercase variants (18 naming features); elixir writes
  bare 'Built-in features', clojure has no such line. dart in the language
  pack carries the lowercase variant.
- **Fix.** In the copy wave, change each tree comment to name no feature (e.g.
  '\# Feature implementations'), keeping each language's comment syntax;
  elixir's line may stay. The pack's dart file follows in the pack release.
- **Check.** New assertion in `ts/test/generate.test.ts` that no target README
  tree line names a feature; the off relation only sees it in a real-add case
  because the fixture copies every template.

### S16. Root `AGENTS.md` says "Built-in features are `log` and `test`" though new projects have no `log`

- **Fate.** WP09.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/AgentGuideContent.ts:189`
- **At head.** Present. featureSection() at :185-190 takes no model; the
  model-driven '\*\*Features\*\* (N):' list in the same file disagrees.
- **Fix.** Delete the sentence (the model-driven feature list already says
  what the project has), or replace it with 'Every SDK target always carries
  `test`.' which holds by construction under the S11 error.
- **Check.** Text guard off relation over feat-off-log; assertion in
  `ts/test/agentguide.test.ts` that the sentence is absent.

### S17. "The SDK ships with built-in features:" lead-in written before a loop that may emit no items

- **Fate.** WP08.
- **Class.** omission; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeExplanation.ts:300`
- **At head.** Present. `ReadmeExplanation.ts:300-314` writes the lead-in and
  the 'initialized in order' paragraph unconditionally, then loops feature
  (targetFeatures) filtering inactive ones. Reachable only with every feature
  removed, which under section 13 is the hand-edited state.
- **Fix.** Compute the active list first; write the lead-in, the list and the
  ordering paragraph only when it is non-empty (stage 2 'empty tables').
- **Check.** Exact guard check 'no lead-in or table header without rows' on
  feat-none; case in `ts/test/readme.test.ts`.

### S18. Root README "\#\#\# Features" heading and table header written before the row loop; empty table possible

- **Fate.** WP08.
- **Class.** omission; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeTop.ts:588-605`
- **At head.** Present. `ReadmeTop.ts:588` heading and :592 header precede
  each(feature) with an inner active filter; the 'extend' line follows
  unconditionally.
- **Fix.** Filter the active features first and write the heading/table only
  when non-empty; keep the `extend` sentence as its own paragraph. Stage 2
  'empty tables'.
- **Check.** Exact guard check 'no table header stands without rows';
  generate-time table well-formedness check (section 8).

### S19. Feature agent guides illustrate activation with "e.g. the `test` feature is switched on" regardless of the model

- **Fate.** Repeats S11 and is resolved with it in WP22.
- **Class.** stale-mention; sdkgen; neutral-component; 0 source files; size
  xs; changes nothing in generated output. Needs: test-feature generate/doctor
  error (design section 13).
- **Where.** `ts/src/cmp/AgentGuideFeature.ts:50`
- **At head.** Present. `AgentGuideFeature.ts:47-50` picks the sentence on
  defaultOn and always names `test` in the off branch.
- **Fix.** No change needed once the S11 error lands (test is always present);
  optionally drop the 'e.g.' clause so the sentence names nothing.
- **Check.** S11's tests; guard pin.

### S20. ts and js options tables illustrate `feature` with `{ test: { active: true } }`

- **Fate.** Repeats S11 and is resolved with it in WP22.
- **Class.** stale-mention; sdkgen; per-language-copy; 0 source files; size
  xs; changes nothing in generated output. Needs: test-feature generate/doctor
  error (design section 13).
- **Where.** `ts/project/.sdk/src/cmp/ts/ReadmeModel_ts.ts:93`;
  `ts/project/.sdk/src/cmp/js/ReadmeModel_js.ts:71`
- **At head.** Present. Both lines are fixed table rows.
- **Fix.** No change once the S11 error lands; `test` is always installed, so
  the example names a real feature.
- **Check.** S11's tests.

### S21. py-data says the SDK's paging feature fetches every page; paging is absent or default-off, so one page

- **Fate.** WP36.
- **Class.** stale-mention; sdkgen; consumer-main; 1 source file; size s;
  changes generated documents and code. Needs: targetSurface; py-data paging
  activation decision.
- **Where.** `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:700-703`, :781,
  :424, :628, :876; `ts/project/.sdk/tm/py-data/pkg/fetch.py:78-80`
- **At head.** Present, in a different form or place than first recorded.
  Wider than the map says: `paging.aontu` sets config.options.active: false;
  data() (`Main_py-data.ts:244-250`) passes only apikey/base; `fetch.py:78-80`
  documents that inactive paging leaves no `_paging`, so drain stops after one
  page; py `test_feature.py:760` 'inactive paging stamps nothing'. So the
  claim is false in the BASELINE, not only when paging is removed.
- **Fix.** Two parts. Code: when the consumed py target's features include
  paging (targetFeatures for the target targetSurface(...).consumes names),
  have data() activate it (opts feature.paging.active true unless the caller
  set it). Text: write 'every page' sentences only when the consumed target
  has paging; otherwise 'Each accessor fetches one page: the SDK has no paging
  feature.' The maintainer may choose text-only instead.
- **Check.** Text guard off relation over feat-off-paging; a py-data generated
  test (`tm/py-data/test/test_fetch.py`) proving more than one page is drained
  with paging declared; `generate.test.ts` py-data case asserting the one-page
  sentence without paging.

### S22. REFERENCE ordering note illustrates short-circuiting with "a cache serving a hit" when no cache feature exists

- **Fate.** WP08.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeRefFeatures.ts:50-53`
- **At head.** Present. The cost+cache branch (:45-49) is gated; the else
  branch (:50-53, moved from the map's :55-58) names cache unconditionally.
- **Fix.** In the else branch write the 'such as a cache serving a hit' clause
  only when cache is among features; otherwise 'a feature that short-circuits
  the call stops every feature nested inside it from ever seeing that call.'
- **Check.** Text guard off relation over feat-off-cache;
  `ts/test/readme.test.ts` REFERENCE assertion.

### S23. Entity section "Operations:" line lists an operation marked `active: false` (raw `Object.keys(ent.op)`) in all 20 languages

- **Fate.** WP21.
- **Class.** contradiction; sdkgen; per-language-copy; 20 source files; size
  s; changes generated documents and code. Needs: DQ1; guardModel.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeModel_<lang>.ts`
  (ts:180/198, go:160/178); 20 files; sdkgen-langpack
  `dart/ReadmeModel_dart.ts:123`, `haskell/ReadmeModel_haskell.ts:133`
- **At head.** Present. grep: all 20 compute `opnames = Object.keys(ent.op ||
  {})` (go included); entityOps (`helpers/opShape.ts:409`) and introOps (:419)
  filter `active: false`. Per G05 the generated entity code keeps the op, so
  the tables match the code and the introductions do not.
- **Fix.** Under DQ1 (recommended): a pre-pass before Root (beside
  guardModelNames in `ts/src/sdkgen.ts`, also applied by guardModel for
  docgen) deletes inactive operations, so raw reads, entityOps, introOps and
  the entity code agree with no copy change; the schema declares op: &amp;:
  active: \*true | boolean. If DQ1 is answered the other way (op stays in
  code), these lines are right and the fix moves to introOps/entityOps and the
  introductions (G05). Separately, java/js/kotlin/scala/ts print lowercase
  names while 15 capitalise: an undeclared divergence to settle in the copy
  wave.
- **Check.** A test in `ts/test/opshape.test.ts` or `generate.test.ts` that
  op-off-planet-remove output equals a never-declared remove; text guard
  parity relation; generated entity no longer has remove (G05).

### S24. Per-entity README method table keeps `remove(match)` when the op is `active: false` in 19 languages (all but go)

- **Fate.** Repeats S23 and is resolved with it in WP21; the DQ1 pre-pass
  removes the operation; the parity port to entityOps is D10 in WP31.
- **Class.** contradiction; sdkgen; per-language-copy; 19 source files; size
  m; changes generated documents. Needs: DQ1.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts` (ts:42,
  py likewise); 19 files; gated one `go/ReadmeEntity_go.ts:45`;
  sdkgen-langpack `dart/ReadmeEntity_dart.ts:60`,
  `haskell/ReadmeEntity_haskell.ts:65`, `lean/ReadmeEntity_lean.ts:8`
- **At head.** Present. Only go's ReadmeEntity imports entityOps (grep); ts:42
  reads Object.keys(entity.op) and filters only opNeedsAction.
- **Fix.** Under DQ1 the pre-pass of S23 makes this correct without a copy
  change. For parity, in the copy wave port the 19 to entityOps(entity) as go
  does (also excludes action-only ops consistently). Under the other DQ1
  answer, the tables are right and go's two components are the outliers.
- **Check.** Same as S23; parity relation in the text guard over op-off
  variations.

### S25. REFERENCE documents `remove(match, ctrl?)` with example for an `active: false` op in 19 languages

- **Fate.** Repeats S23 and is resolved with it in WP21.
- **Class.** contradiction; sdkgen; per-language-copy; 19 source files; size
  m; changes generated documents. Needs: DQ1.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeRef_<lang>.ts` (ts:199); 19
  files; gated one `go/ReadmeRef_go.ts:169`; sdkgen-langpack
  `dart/ReadmeRef_dart.ts:179`, `haskell/ReadmeRef_haskell.ts:176`
- **At head.** Present. `ts/ReadmeRef_ts.ts:199` reads Object.keys(ent.op);
  `go/ReadmeRef_go.ts:169` uses entityOps; the field-op filter at ts:249 does
  check op.active, so one file uses two rules.
- **Fix.** Same as S24: resolved by the DQ1 pre-pass; port the 19 to entityOps
  in the copy wave for parity.
- **Check.** Same as S23/S24.

### S26. Every ts/js feature guide lists six operations "(load, list, create, update, patch, remove)" whatever the entities declare

- **Fate.** WP09.
- **Class.** wrong-baseline; sdkgen; neutral-component; 1 source file; size
  xs; changes generated documents.
- **Where.** `ts/src/cmp/AgentGuideFeature.ts:41`
- **At head.** Present. Opened `AgentGuideFeature.ts` at head: line 41 is a
  literal op list inside the Content template, written for every feature of ts
  and js (40 guides), with no read of the model's operations.
- **Fix.** Build the parenthesis from the union of active operations in
  canonical order: introOps(model) without its \['list','load'\] fallback (see
  S30), or a shared active-op-union helper beside entityOps in
  `ts/src/helpers/opShape.ts`. Drop the parenthesis when the union is empty.
  Under DQ1 the pre-pass already removes inactive operations, so no extra
  filter is needed.
- **Check.** off relation (op-absent-readonly and the patch-free baseline must
  no longer name patch); add an assertion to `ts/test/agentguide.test.ts` that
  a feature guide for a model without patch does not contain 'patch'.

### S27. ocaml README says "`e_remove` resolves to the entity marked deleted" when no entity has remove

- **Fate.** WP31.
- **Class.** stale-mention; sdkgen; per-language-copy; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/ocaml/ReadmeModel_ocaml.ts:103-107`
- **At head.** Present. Read `ReadmeModel_ocaml.ts`. The op rows are gated on
  opUnion (lines 20-22, 31-32), but the 'Result shape' prose at 103-107 names
  e\_list and e\_remove unconditionally.
- **Fix.** Gate the e\_remove sentence on opUnion.has('remove') and the
  'e\_list to one entity per record' clause on opUnion.has('list'). opUnion is
  already computed in the same component. Ships in the stage-3 copy wave.
- **Check.** off relation over op-absent-readonly and ent-only-ambient; parity
  relation against siblings that already gate the same prose (go, lua
  resultRows).

### S28. Tutorial lead-in promises "listing entities" for an entity without list; its steps are numbered 1 then 3

- **Fate.** WP31.
- **Class.** wrong-baseline; sdkgen; per-language-copy; 19 source files; size
  m; changes generated documents.
- **Where.** `ts/src/cmp/ReadmeQuick.ts:14-17`;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeQuick_<lang>.ts`
  (ts:46,70,104,132,192; py:80), 18 files (all but go and js)
- **At head.** Present. `ReadmeQuick.ts:14-17` writes the lead-in
  unconditionally. A grep finds literal '\#\#\# 1.'..'\#\#\# 4.' headings in
  18 `ReadmeQuick_<lang>.ts` files; step 2 is gated on list and step 3 keeps
  its literal number. go and js use unnumbered headings. The language pack's
  dart and haskell ReadmeQuick carry the same literals.
- **Fix.** Neutral (stage 2): build the lead-in from entityOps of the tutorial
  entity that pickExampleEntity chooses, naming 'listing' only with list and
  'loading a record' only with load. Copies (stage 3): number the headings
  from a running counter instead of literals in all 18 files. The packs (dart,
  haskell) follow in their own releases.
- **Check.** Add the exact check 'numbered headings in one section are
  consecutive' to the text guard. off relation on ent-only-ambient. parity
  relation across the 18 siblings.

### S29. 'Result shape' prose says `list` returns entities, one per record, when no entity has list (14 targets)

- **Fate.** WP31.
- **Class.** stale-mention; sdkgen; per-language-copy; 14 source files; size
  m; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeModel_<lang>.ts` (c:97-98,
  py:98, clojure:103-104, csharp:95, swift:96), 14 files
- **At head.** Present. Grep of 'one per record' at head: the result-shape
  paragraphs of c, clojure, cpp, csharp, elixir, java, kotlin, ocaml, perl,
  php, py, rb, scala and swift are unconditional. go and lua build theirs from
  opUnion (`go/ReadmeModel_go.ts:41`, lua:34). The amendment makes it 17
  targets with X6. The pack's `dart/ReadmeModel_dart.ts:99` is the same.
- **Fix.** In each `ReadmeModel_<lang>.ts`, build the result-shape sentence
  from the opUnion the component already computes for its op rows, as go and
  lua do: name `list` only when opUnion.has('list'). Ships in the stage-3 wave
  together with X6. dart follows in the pack.
- **Check.** off relation on ent-only-ambient (no generated document names the
  list result); parity relation against go and lua.

### S30. With no active entity the intro invents `client.Entity()` and the fixed op list (`list`, `load`)

- **Fate.** WP31.
- **Class.** stale-mention; sdkgen; per-language-copy; 22 source files; size
  m; changes generated documents.
- **Where.** `ts/src/helpers/opShape.ts:430`; `ts/src/cmp/ReadmeTop.ts:317`;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeIntro_<lang>.ts` (ts:15,24; go:21,27),
  20 files
- **At head.** Present. introOps returns \['list','load'\] when it finds no
  operation (`opShape.ts:430`), and `ReadmeTop.ts:317` repeats that fallback.
  ts, js, go and lua intros fall back to 'Entity' as the accessor name. All 20
  `ReadmeIntro_<lang>.ts` import introOps.
- **Fix.** Remove the fallback in both places, so introOps returns \[\]. The
  intros (copies, stage 3) write the Entities sentence only when an active
  entity exists. ReadmeTop drops its op-list sentence when the list is empty.
  introOps is public and old copies call it, so an empty result would print
  '()' in an un-updated project. Either change introOps in the same release as
  the wave, or add a no-fallback function in a new file and leave introOps as
  it is until the wave lands.
- **Check.** off relation on ent-none; an assertion in
  `ts/test/readmeintro.test.ts` that a model with no active entity names no
  accessor and no operations.

### S31. MCP text says create/update/remove "become tools when ... tool: write: true" for an API with no write operations

- **Fate.** WP36.
- **Class.** stale-mention; sdkgen; consumer-main; 2 source files; size s;
  changes generated documents. Needs: targetSurface.
- **Where.** `ts/src/cmp/ReadmeTop.ts:451-460`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:158-170`
- **At head.** Present. Both sites write the 'only reads ... become tools'
  sentence whenever the write toggle is false. They write the correct 'no
  entity has a create, update, patch or remove' wording only when the toggle
  is already true. ReadmeTop also reads the toggle under the literal key
  'go-mcp' (line 452).
- **Fix.** Compute whether any entity has a write op that a plain call runs:
  call mcpTools with write forced on, or add a small helper beside it in
  `ts/src/helpers/mcpTools.ts`. When none has one, write 'It only reads: no
  entity has a create, update, patch or remove' whatever the toggle says.
  ReadmeTop finds the MCP target and its toggle through targetSurface (surface
  'mcp'), never the key 'go-mcp'.
- **Check.** `ts/test/generate.test.ts` already pins 'It only reads'; add a
  read-only fixture case. off relation on op-absent-readonly.

### S32. go-cli README says `list` / `load` / `update` are words bound to the SDK whatever operations exist

- **Fate.** WP36.
- **Class.** stale-mention; sdkgen; consumer-main; 1 source file; size s;
  changes generated documents and code. Needs: DQ6.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:317,323`
- **At head.** Present. Lines 317 and 323 are literal. The Words table row is
  gated through verbRows/firstHas (:73-83). The binary side
  (`words.fragment.go:13`, `main.fragment.go:37,122`) is G08 and has the same
  literal.
- **Fix.** Derive one word list from verbRows filtered to operations some
  active entity has, as design note section 9 describes. Pass it as a replace
  token to `words.fragment.go` and `main.fragment.go` (G08) and use it in
  these two sentences. Fix it in the same commit as G08.
- **Check.** off relation on op-absent-readonly. go-cli stays byte-identical
  for an all-on model. `generatedcompile.test.ts` compiles go-cli with update
  off where a Go toolchain exists.

### S33. py-data README and `AGENTS.md` point at `ad.sdk.SomeEntity().create(...)`, a placeholder write the API may lack

- **Fate.** WP36.
- **Class.** stale-mention; sdkgen; consumer-main; 1 source file; size s;
  changes generated documents and code.
- **Where.** `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:720-728`;
  :793-800; :203-206 (docstring)
- **At head.** Present. Opened `Main_py-data.ts`. The 'Writes.' bullet, its
  example, the `AGENTS.md` 'When there is no accessor' example and the frame()
  docstring all use the literal SomeEntity, and none reads the model.
- **Fix.** Name a real entity and a write op it has: the first active entity
  whose entityOps includes create, update or remove, with the call written
  through the existing py example helpers. With no such entity, write 'The API
  has no create, update or remove operations' and drop the example. Replace
  SomeEntity in the docstring with a real entity class name.
- **Check.** off relation on op-absent-readonly; check that no generated
  py-data file contains 'SomeEntity'.

### S34. "Use it for standard CRUD operations" in every README, including read-only APIs

- **Fate.** WP08.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeExplanation.ts:338`
- **At head.** Present. `ReadmeExplanation.ts:336-339` writes the sentence
  unconditionally under 'Direct vs entity access'.
- **Fix.** Replace it with a sentence that names no operation set: 'Use it for
  the operations each entity declares; use direct for anything else.'
- **Check.** off relation on op-absent-readonly (synonym 'CRUD' admitted only
  when it raises no false finding).

### S35. go-cli README tells the reader to export `<ENV>_APIKEY` and lists it when the API has no auth

- **Fate.** WP36.
- **Class.** stale-mention; sdkgen; consumer-main; 1 source file; size s;
  changes generated documents and code. Needs: requiredOptions; DQ6.
- **Where.**
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:67,119,175,233-236,273`
- **At head.** Present. Every API-key line in the go-cli Main is written
  unconditionally. The file never calls isAuthActive. The env name is derived
  inline (String(model.name).toUpperCase().replace(/\[^A-Z0-9\]/g,'\_'))
  rather than with envName.
- **Fix.** Gate every key line on requiredOptions(model).apikey and take the
  env name from it, so the inline derivation goes. Under HTTP Basic in the
  header, add the secret line from requiredOptions.secret (G06). Fix it with
  the code side, G09 (`main.fragment.go` env help), in the same commit.
- **Check.** off relation on auth-off and auth-inactive: no go-cli file names
  APIKEY. parity relation against the SDK READMEs, which already drop the key.

### S36. go-mcp README says "Set your API key" and lists `<ENV>_APIKEY` when the API has no auth

- **Fate.** WP36.
- **Class.** stale-mention; sdkgen; consumer-main; 1 source file; size s;
  changes generated documents and code. Needs: requiredOptions; DQ6.
- **Where.**
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:155,281,303-306,325,370`
- **At head.** Present. Same pattern as go-cli: unconditional key lines, an
  inline env-name derivation at :155, and no isAuthActive read.
- **Fix.** Gate on requiredOptions(model).apikey, with the secret from
  requiredOptions.secret, as in S35. The fragment's env text (G09) changes in
  the same commit.
- **Check.** off relation on auth-off and auth-inactive.

### S37. py-data README and `AGENTS.md` describe `<ENV>_APIKEY` credentials when the API has no auth

- **Fate.** WP36.
- **Class.** stale-mention; sdkgen; consumer-main; 2 source files; size s;
  changes generated documents and code. Needs: requiredOptions; DQ6.
- **Where.**
  `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:238-239,658-666,770,850-859`;
  `ts/project/.sdk/tm/py-data/pkg/auth.py:97`
- **At head.** Present. The Credentials section, the docstring and the
  notebook cell write the key unconditionally. needsBase (:48) is
  model-driven, but nothing gates the key. `auth.py` raises a
  missing-credential error, so this is behaviour as well (G12).
- **Fix.** Gate every key line on requiredOptions(model).apikey. `auth.py`
  takes whether a key is required as a generated token, or Main writes the
  auth module so that it does not raise when auth is off (G12). Add the secret
  under Basic in the header (G06).
- **Check.** off relation on auth-off; a py-data runtime check that data()
  does not raise with auth off.

### S38. Every SDK README's "live alongside this one" note links `../README.md` even when no root README is written

- **Fate.** WP14.
- **Class.** dangling-link; sdkgen; helper; 1 source file; size s; changes
  generated documents. Needs: docLink; targetSurface; DQ3.
- **Where.** `ts/src/helpers/alongside.ts:20-23,36-37` (called from
  `ts/src/cmp/ReadmeIntro.ts:32`)
- **At head.** Present. alongsideNote(model, self) receives no ctx\$ or pass,
  always writes the link, and finds the consumers by the literal keys
  'go-cli'/'go-mcp' and isConsumer. It is exported from
  `ts/src/sdkgen.ts:1332`, and no pack calls it.
- **Fix.** Take the link from docLink(ctx\$, target, '`README.md`'). When it
  is undefined (top phase off, or an out-of-tree pass) write no note. Name the
  CLI and MCP surfaces through targetSurface and delete isConsumer. Keep the
  exported (model, self) call working with an optional third argument, because
  the function is public API.
- **Check.** link relation on phase-top-off; the generate-time
  'doc-link-dangling' check; `ts/test/readmeintro.test.ts` and
  `ts/test/generate.test.ts` pin 'alongside this one' and need a phase-top-off
  case.

### S39. Per-target and per-feature agent guides link `../AGENTS.md` and `../../../../AGENTS.md` when no root guide exists

- **Fate.** WP14.
- **Class.** dangling-link; sdkgen; neutral-component; 2 source files; size s;
  changes generated documents. Needs: docLink; targetPlace; DQ3.
- **Where.** `ts/src/cmp/AgentGuide.ts:43-44,120`;
  `ts/src/cmp/AgentGuideFeature.ts:84,89-90`
- **At head.** Present. Opened both files. The links and 'cd
  `../../../../.sdk`' are literals that assume `<repo>/<target>/` and a root
  guide, whatever the top phase or `output.root/output.path` says.
- **Fix.** Resolve both project-guide links with docLink(ctx\$, target,
  '`AGENTS.md`'), and drop the sentence when it is undefined. Derive the
  feature guide's depth and its cd line from targetPlace (folder, root or
  external) rather than the four-level literal.
- **Check.** link relation on phase-top-off, root-ts and output-external-ts;
  `ts/test/agentguide.test.ts` gains a phase-top-off case.

### S40. ts agent guide says paths are "one level up from this ts/ directory" and `cd ../.sdk` at the root or out of tree

- **Fate.** WP14.
- **Class.** stale-mention; sdkgen; neutral-component; 2 source files; size s;
  changes generated documents. Needs: targetPlace; DQ3.
- **Where.** `ts/src/cmp/AgentGuide.ts:46-54`;
  `ts/src/cmp/AgentGuideContent.ts:59`
- **At head.** Present. `AgentGuide.ts` writes the path note and 'cd
  `../.sdk`' literally. AgentGuideContent.langCommandsBlock writes '\# in this
  target directory (`<name>/`)'. ExternalTarget sets ctx\$.sdkrelpath
  (`ExternalTarget.ts:30`) and the guide never reads it.
- **Fix.** Derive the note and the cd line from targetPlace: 'root' gives no
  note and 'cd .sdk'; 'external' gives the path from ctx\$.sdkrelpath;
  'folder' keeps today's text. langCommandsBlock names the target's directory
  from the same answer.
- **Check.** link relation (cd lines resolve) on root-ts and
  output-external-ts.

### S41. Install and test commands assume `<repo>/<target>/`: `npm install ./<repo>/ts`, `cd ts && npm test`, and 19 sibling `cd` literals

- **Fate.** WP32.
- **Class.** stale-mention; sdkgen; per-language-copy; 21 source files; size
  m; changes generated documents. Needs: targetPlace; DQ3.
- **Where.** `ts/project/.sdk/src/cmp/ts/ReadmeInstall_ts.ts:22-29`;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeHowto_<lang>.ts` (ts:183, go:173), 20
  files
- **At head.** Present. Grep of 'cd ' in ReadmeHowto\_\*: 13 files use the
  literal language directory (ts, js, go, py, php, rb, lua, java, kotlin,
  csharp, scala, swift), so an alias is wrong too; 7 use target.name.
  ReadmeInstall\_ts names the tag `${target.name}/vX.Y.Z`.
  PublishWorkflow.releaseTag (`PublishWorkflow.ts:87-90`) gives the primary
  npm target the bare `v$VERSION`, and `Deploy.ts:218` tags
  `<name>/v<version>`, so the README's tag disagrees with the workflow for the
  default ts target.
- **Fix.** Add a neutral helper in a new file (copy-wave rule) that answers
  the directory a reader enters, from targetPlace (folder: the installed key;
  root: no cd; external: from `sdkrelpath/output.path`). Every
  `ReadmeHowto_<lang>` uses it in place of its literal. ReadmeInstall\_ts
  takes the clone path from the same helper and the tag from the single
  releaseTag derivation (see S47).
- **Check.** link relation (cd resolves) on root-ts and output-external-ts;
  parity relation across the 20 ReadmeHowto siblings; an alias case in
  `ts/test/alias.test.ts`.

### S42. Out-of-tree ts README (`../demo-ts`) keeps "live alongside this one — see the top-level README"

- **Fate.** Repeats S38 and is resolved with it in WP14.
- **Class.** dangling-link; sdkgen; helper; 1 source file; size xs; changes
  generated documents. Needs: docLink; DQ3.
- **Where.** `ts/src/helpers/alongside.ts:36-37`
- **At head.** Present. Same writer as S38. An external pass runs the same
  ReadmeIntro, and alongsideNote has no view of the pass.
- **Fix.** As S38: docLink returns undefined for a root document in an
  out-of-tree pass, so no note is written there.
- **Check.** link relation on output-external-ts; `ts/test/external.test.ts`
  asserts that the destination README has no `../README.md` link.

### S43. Root `AGENTS.md` links `go-cli/AGENTS.md` and `go-mcp/AGENTS.md`, which are never generated

- **Fate.** WP14.
- **Class.** dangling-link; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: docLink; targetPlace.
- **Where.** `ts/src/cmp/AgentGuideTop.ts:53-56`
- **At head.** Present. Lines 53-56 write a build-guide link for every active
  target without reading its phase.agentguide, which the go-cli and go-mcp
  models switch off. The directory cell is also `${t.name}/`, whatever
  `output.root/path` says, and the note comes from langCmd(t.name), keyed by
  target name.
- **Fix.** Take the cell from docLink(ctx\$, t, '`AGENTS.md`'), which answers
  undefined when that target's agentguide phase is off or the target is not
  written in this pass, and print '—' then. Take the directory cell from
  targetPlace and key the note by origin.
- **Check.** link relation on the baseline (85 lines today); the generate-time
  doc-link-dangling check; `ts/test/agentguide.test.ts`.

### S44. Root `AGENTS.md` still links `ts/AGENTS.md` when ts's agentguide phase is switched off

- **Fate.** Repeats S43 and is resolved with it in WP14.
- **Class.** dangling-link; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: docLink.
- **Where.** `ts/src/cmp/AgentGuideTop.ts:53-56`
- **At head.** Present. Same unconditional link as S43, reached through the
  project's own switch.
- **Fix.** As S43.
- **Check.** link relation on phase-agentguide-off-ts.

### S45. Root README links `<t>/README.md` (three places) when that target's readme phase is off

- **Fate.** WP14.
- **Class.** dangling-link; sdkgen; neutral-component; 1 source file; size s;
  changes generated documents. Needs: docLink.
- **Where.** `ts/src/cmp/ReadmeTop.ts:392,396,418,689`
- **At head.** Present. The map's :396/:418/:675 have moved to 392/396, 418
  and 689 at head. Each builds `${tgt.name}/README.md` without reading
  phase.readme or the target's place.
- **Fix.** Take every link from docLink(ctx\$, tgt, '`README.md`'). A table
  cell whose README is not written prints the install text with no link. The
  'See the `<lead>` README' sentence and the index entry are dropped when the
  link is undefined.
- **Check.** link relation on phase-readme-off-ts; the generate-time
  doc-link-dangling check.

### S46. With ts phase.entity off, README/REFERENCE describe entity classes, and Main\_ts still imports `./entity/<cls>`

- **Fate.** WP22.
- **Class.** code-defect; sdkgen; other; 1 source file; size s; changes
  generated code. Needs: targetSurface; guardModel.
- **Where.** `ts/project/.sdk/src/cmp/ts/Main_ts.ts:80-83`;
  `ts/project/.sdk/src/cmp/ts/ReadmeModel_ts.ts`;
  `ts/project/.sdk/src/cmp/ts/ReadmeEntity_ts.ts`
- **At head.** Present. `testkit.ts:603` and the scaffold Root skip Entity
  generation when phase.entity is off. `Main_ts.ts:80-83` still emits an
  import per entity from `./entity/`, so the SDK should not compile (read
  only, not compiled here). No Readme component reads phase.
- **Fix.** Do not gate documents on this switch. Treat phase.entity off on a
  target whose targetSurface is 'sdk' as invalid: guardModel (generate)
  reports an error naming the target, and package check does the same for a
  package's model. This matches the default for the test feature (design note
  section 13).
- **Check.** A `ts/test/generate.test.ts` case: a model with ts phase.entity
  off fails with the named error.

### S47. `publish.tag.active` (and `publish.tag.prefix`) are declared and documented, and nothing reads them

- **Fate.** WP25.
- **Class.** unread-switch; sdkgen; model-schema; 0 source files; size s;
  changes generated documents and code. Needs: decision: implement or remove
  `publish.tag.active/prefix`.
- **Where.** `ts/model/sdkgen.aontu:150-153`;
  `ts/src/cmp/PublishWorkflow.ts:87-90`; `ts/src/cmp/Deploy.ts:218`;
  `docs/reference/model.md:317-318`; `ts/src/helpers/modelcheck.ts:130`
- **At head.** Present. Grep finds tag.vault and tag.via read in `Deploy.ts`
  and never .active or .prefix. Three tag-name rules disagree: Deploy tags
  `<name>/v<ver>`; releaseTag gives the primary npm target `v$VERSION`;
  ReadmeInstall\_ts writes `<target>/vX.Y.Z`.
- **Fix.** Decide whether to implement the slots or remove them. Implement:
  one releaseTag derivation beside packageName in
  `ts/src/helpers/packageMeta.ts`, honouring tag.active and tag.prefix, read
  by PublishWorkflow (tag job and the PUBLISHING table), Deploy's
  tagPushRecipe and ReadmeInstall\_ts (S41). With active false, no tag job, no
  recipe and no tag sentence. Remove: delete the two slots, the `model.md`
  rows and the modelcheck example. Removing lines is safe at the comment-gate
  density limit.
- **Check.** `ts/test/publishworkflow.test.ts` and `ts/test/deploy.test.ts`
  assert one tag name per target across the workflow, the Makefile and the
  README; an off-relation variation tag-off-ts.

### S48. Root README keeps the link `voxgig.com/sdk/custom` under a custom publisher

- **Fate.** Not a defect: voxgig.com/sdk/custom is generator documentation,
  not a claim by the publisher; the guard pins it in the off relation for
  publisher-custom with that reason.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes nothing in generated output.
- **Where.** `ts/src/cmp/ReadmeTop.ts:680`
- **At head.** Not a defect. Line 680 (map :666) sits in 'Customizing this
  SDK' beside a github sdkgen how-to link. It documents the generator, which
  is Voxgig's under any publisher, and claims no publisher. The URL answered
  HTTP 200 when checked.
- **Fix.** None required. Optional: link the sdkgen docs on github instead, so
  every generator link points at one host.
- **Check.** Pin it in the off relation for publisher-custom, with the reason
  'generator documentation, not a publisher claim'.

### S49. 16 of 20 quick starts omit the required `server` option when the server URL is templated

- **Fate.** WP29.
- **Class.** omission; sdkgen; per-language-copy; 32 source files; size l;
  changes generated documents. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeQuick_<lang>.ts` and
  `ReadmeTopQuick_<lang>.ts` (only ts:32/25, py:28/35, go:27/27, java:39/28
  call serverVariables), 32 files
- **At head.** Present. Grep at head: serverVariables is imported only in ts,
  py, go and java Readme components. c, clojure, cpp, csharp, elixir, js,
  kotlin, lua, ocaml, perl, php, rb, rust, scala, swift and zig never read it,
  while their Config and runtime honour server variables (map amendment).
- **Fix.** Stage 3: every quick start and top quick start prints the server
  block from requiredOptions(model).server, listing as required only the
  variables the URL references with no default (which also corrects G01 in
  ts). Add one README-lane model with a templated URL first, so a lane renders
  it. The packs follow: dart and haskell (lean has no server option).
- **Check.** parity relation (found today); the README-lane model with a
  templated URL in `generatedcompile.test.ts` compiles each block.

### S50. HTTP Basic: 19 targets document only `apikey`; only ts and the root README mention `secret`

- **Fate.** WP29.
- **Class.** omission; sdkgen; per-language-copy; 100 source files; size l;
  changes generated documents. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeQuick_<lang>.ts`,
  `ReadmeTopQuick_<lang>.ts`, `ReadmeModel_<lang>.ts`, `ReadmeRef_<lang>.ts`,
  `ReadmeHowto_<lang>.ts` (ts uses isHttpBasicAuth at `ReadmeQuick_ts.ts:39`,
  `ReadmeModel_ts.ts:52`; c:37 has apikey only)
- **At head.** Present, in a different form or place than first recorded.
  Grep: isHttpBasicAuth is used only in the five ts Readme components. The ts
  ones test isHttpBasicAuth alone, without header placement or suppression, so
  under Basic in the query or cookie the ts README asks for a secret that no
  PrepareAuth reads (design 14.2).
- **Fix.** Stage 3: every language's constructor rows, quick starts, reference
  and live-test env lines read requiredOptions(model).secret (Basic AND header
  placement AND not suppressed). The ts components switch from isHttpBasicAuth
  to the same derivation. haskell and lean have no secret. The README-lane
  model gets Basic in the header.
- **Check.** parity relation; generated-output hold: the secret is documented
  exactly when the generated PrepareAuth reads it (design section 6).

## X. Wrong with nothing switched off (X1 to X7)

Statements that contradict the same project's other documents, or its code, in
an all-on model.

### X1. 13 non-JS READMEs carry a TypeScript entity-state example and feature prose from ReadmeExplanation's default row

- **Fate.** WP07.
- **Class.** wrong-language; sdkgen; neutral-component; 1 source file; size s;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeExplanation.ts:40-70` (DEFAULT\_LANG), :71-216
  (rows py, php, rb, lua, go), chosen at :225
- **At head.** Present. LANGS has rows for py, php, rb, lua and go only, and
  :225 indexes it by target.name with a DEFAULT\_LANG fallback, so every other
  target and every alias gets the TypeScript row. The ReadmeErrors sibling
  (S05) has the same shape.
- **Fix.** Stage 2: key the wording table by the target's origin language
  (originName), give every bundled language its own row (including explicit ts
  and js), and remove DEFAULT\_LANG. An unknown origin (a pack language)
  writes no example and no fenced block; the pack supplies its own through an
  optional component. Land it together with the ReadmeErrors fix (S05) and
  design 14.5.
- **Check.** The exact fence-tag check (a fenced block in a target's document
  uses that language's tag or a neutral one); an alias case in
  `ts/test/alias.test.ts`.

### X2. "Activate a feature ... alongside the options shown above" when no options section is ever rendered

- **Fate.** WP08.
- **Class.** wrong-baseline; sdkgen; neutral-component; 21 source files; size
  m; changes generated documents. Needs: decision: delete ReadmeOptions or
  rebuild it from main.kit.optspec.
- **Where.** `ts/src/cmp/ReadmeFeatures.ts:32-33`;
  `ts/src/cmp/ReadmeOptions.ts:11-20`;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeOptions_<lang>.ts` (ts:9-13, go:9-13),
  20 files
- **At head.** Present. `ReadmeOptions_<lang>` renders only target.options
  entries marked publish. Grep finds no 'options' slot in the schema and none
  in any bundled target model, so the section is dead in all 20 targets and
  the lead-in refers to nothing.
- **Fix.** Stage 2: the neutral sentence becomes 'Activate a feature by name
  in the `feature` client option:', with no back-reference. Decision: delete
  the dead ReadmeOptions family (neutral and 20 copies, in the copy wave), or
  rebuild it from main.kit.optspec, the one home for client options.
- **Check.** off relation; the text guard's exact check that no sentence
  refers to a section the document lacks (or a pin); grep that target.options
  is read nowhere after the deletion.

### X3. REFERENCE lists `test` among hook-only features whose order does not matter, then says it installs the BASE transport

- **Fate.** WP08.
- **Class.** contradiction; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeRefFeatures.ts:34-35,54`; :119-131
- **At head.** Present. hooked = features.filter(f => !f.wraps) puts the base
  transport (test, transport: 'base' in
  `ts/project/.sdk/model/feature/test.aontu:10`) among the hooked features.
  Its own section writes both 'Attaches to pipeline hooks' (else branch) and
  'Installs the BASE transport'.
- **Fix.** Classify by feature.transport into three groups: 'wrap' (wrapping),
  'base' (its own sentence: installs the transport the wrappers wrap and must
  be activated first) and 'none' (hooked). In the per-feature section, write
  the hooks sentence only for 'none', or for a feature that both wraps and
  hooks, such as cost, as the model declares.
- **Check.** New assertion in `ts/test/readme.test.ts` that `test` appears in
  neither the hooked list nor the 'Attaches to pipeline hooks' line.

### X4. Root README says "five-stage pipeline"; every target README says "six-stage pipeline"

- **Fate.** WP08.
- **Class.** contradiction; sdkgen; neutral-component; 2 source files; size s;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeTop.ts:576-582`;
  `ts/src/cmp/ReadmeExplanation.ts:269-286`
- **At head.** Present. Opened both. ReadmeTop lists Point..Result (5).
  ReadmeExplanation lists PrePoint..PreDone (6), and its PreRequest bullet
  names TestFeature (S14).
- **Fix.** Stage 2: one exported constant of pipeline stages (name, hook,
  one-line purpose), in a helper beside FeatureHook, read by both components.
  Both then write the same six stages. Correct the base schema's hook list
  (design 14.10) against the same constant.
- **Check.** An assertion in `ts/test/readme.test.ts` that both documents name
  the same stage count, derived from the constant; a test that the constant
  equals the hooks the pipeline templates fire.

### X5. Root `AGENTS.md` says `generate` merges and "Regeneration never DELETES"; generation overwrites and prunes

- **Fate.** WP17.
- **Class.** contradiction; sdkgen; neutral-component; 2 source files; size s;
  changes generated documents. Needs: modelCopyMode.
- **Where.** `ts/src/cmp/AgentGuideContent.ts:137-145,173-180`;
  `ts/src/cmp/ReadmeTop.ts:614-640`; `AGENTS.md:483`
- **At head.** Present. `sdkgen.ts:385` calls pruneGenerated, which unlinks
  recorded files the run did not emit (`helpers/generated.ts:354-441`), and
  ReadmeTop says 'Regeneration overwrites'. `ReadmeTop.ts:614` reads
  model.main?.kit?.copies directly, bypassing KIT. sdkgen's own
  `AGENTS.md:483` 'Merge gotcha' repeats the stale claim.
- **Fix.** Stage 2: delete the merge/placeholder paragraph and the 'never
  DELETES' paragraph and say instead that each run rewrites every generated
  file and removes files it wrote before and no longer emits. The add-time
  merge sentence reads modelCopyMode(model). In the same change, correct the
  'Merge gotcha' in sdkgen's own `AGENTS.md` (generator-docs).
- **Check.** An assertion in `ts/test/agentguide.test.ts` that the root guide
  contains neither 'merges\*\* into' nor 'never DELETES'; the
  copies:'overwrite' case in `ts/test/readme.test.ts`.

### X6. rust, zig and go README prose describe the `list` result when no entity has list

- **Fate.** Repeats S29 and is resolved with it in WP31.
- **Class.** stale-mention; sdkgen; per-language-copy; 4 source files; size s;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/rust/ReadmeModel_rust.ts:100-101`;
  `ts/project/.sdk/src/cmp/zig/ReadmeModel_zig.ts:99`;
  `ts/project/.sdk/src/cmp/zig/ReadmeEntity_zig.ts:109`;
  `ts/project/.sdk/src/cmp/go/ReadmeQuick_go.ts:188`
- **At head.** Present. Read each site. All write the list clause
  unconditionally. zig's ReadmeEntity writes it in every entity's section,
  whatever that entity's ops.
- **Fix.** As S29: condition the clause on opUnion.has('list'), or for zig
  ReadmeEntity on the entity's own entityOps.
- **Check.** off relation on ent-only-ambient; parity.

### X7. "All entities share the same interface." in 16 READMEs whose entities have different operations

- **Fate.** WP31.
- **Class.** wrong-baseline; sdkgen; per-language-copy; 17 source files; size
  m; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeModel_<lang>.ts` (ts:122,
  py:84, java:85), 16 files; `ts/src/cmp/ReadmeModel.ts:88`
- **At head.** Present. Grep finds the literal in 16 copies (all but c, go,
  elixir and ocaml; c and ocaml word theirs as a shared vtable/record, which
  is true) and in the neutral generic fallback. The fallback also lists all
  six operations unconditionally (`ReadmeModel.ts:90-99`). The pack's
  `dart/ReadmeModel_dart.ts:85` is the same.
- **Fix.** Write the sentence only when every active entity has the same
  entityOps. Otherwise write 'Each entity has only the operations its model
  declares; see its section below.' Apply it in the 16 copies (stage 3), and
  in the neutral generic fallback (stage 2), whose op rows also become gated
  on the union.
- **Check.** Add an exact check, or an off/parity finding, on the fixture's
  mixed entities (load-only, list-only, full CRUD); parity across the
  siblings.

## G. Found by follow-up measurements (G01 to G31)

Measured after the first survey: constructor needs, consumer targets, run-time
strings, source comments, the run override, and text copied from the API
definition.

### G01. ts README options table and ts quick starts call every server variable "Required", including ones the spec defaults

- **Fate.** WP29.
- **Class.** contradiction; sdkgen; per-language-copy; 3 source files; size s;
  changes generated documents. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/src/cmp/ts/ReadmeModel_ts.ts:65-71`;
  `ts/project/.sdk/src/cmp/ts/ReadmeTopQuick_ts.ts:24-27`;
  `ts/project/.sdk/src/cmp/ts/ReadmeQuick_ts.ts:35`
- **At head.** Present. Opened `ReadmeModel_ts.ts:68-71`: the row prints
  \*\*Required.\*\* and lists every serverVariables() entry.
  `ts/src/helpers/serverVars.ts:33-38` already computes `required: '' ===
  dflt`, and unreferenced declared variables are also returned. No caller in
  the ts copies reads `required`. go, py and java quick starts
  (`go/ReadmeQuick_go.ts:27-31`, `py/ReadmeTopQuick_py.ts:35-39`,
  `java/ReadmeQuick_java.ts:39-42`) also print every variable, with no
  'required' word.
- **Fix.** In the three ts copies, print the `server` row and the `server:`
  quick-start block from requiredOptions(model).server.vars: list a variable
  as required only when `required` is true, and give a defaulted one with its
  default ("`region` (default `eu`)"). Omit the row's \*\*Required.\*\* when
  no variable is required. Make the go, py and java quick starts filter on the
  same field in the same copy wave. This is the ts half of the S49 quick-start
  work, so do both together.
- **Check.** New assertion in `ts/test/readme.test.ts` (or `generate.test.ts`)
  on a fixture with one defaulted and one undefaulted variable: the defaulted
  name is not described as required. The guard's parity relation then keeps
  the 20 quick starts on the same fact.

### G02. go-cli and go-mcp document `<ENV>_BASE` as optional and offer no way to set server variables a templated URL needs

- **Fate.** WP36.
- **Class.** omission; sdkgen; consumer-main; 4 source files; size s; changes
  generated documents and code. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:68,176,274`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:156,326,371`;
  `ts/project/.sdk/src/cmp/go-cli/fragment/main.fragment.go:52-63`;
  `ts/project/.sdk/src/cmp/go-mcp/fragment/main.fragment.go:20-31`
- **At head.** Present. Opened both Main components and fragments. The README
  and howto print "Optional override of the API base URL" unconditionally, and
  the fragment builds opts from APIKEY and BASE only, with no `server` map.
  py-data, by contrast, already computes `needsBase = svars.some(v =>
  v.required)` (`Main_py-data.ts:48`).
- **Fix.** In both Main components, compute requiredOptions(model).server.
  When a variable is required, document `<ENV>_BASE` (or per-variable
  `<ENV>_SERVER_<VAR>`, using serverVarEnv from
  `ts/src/helpers/serverVars.ts:59`) as required in the env table and howto,
  and drop "optional". Pass the variable list to the fragment as a replace
  token so `main.go` reads each `<ENV>_SERVER_<VAR>` into `opts["server"]`.
  That way the binary can be constructed without a literal base. Derive the
  env prefix with envName/envToken, not the per-character replace (see V7).
- **Check.** Extend the go-cli and go-mcp case in `ts/test/generate.test.ts`
  with a templated-URL fixture: the README has no 'Optional override' line,
  and `main.go` reads the server variables. The generatedcompile go lane
  compiles the result.

### G03. c, elixir, ocaml, scala, swift and zig READMEs document `<ENV>_TEST_LIVE`=TRUE, which none of their tests read

- **Fate.** WP30.
- **Class.** stale-mention; sdkgen; per-language-copy; 6 source files; size s;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeHowto_<lang>.ts`
  (swift:163, c:204, zig:145, ocaml:135, scala:140, elixir:144)
- **At head.** Present. Grepped `src/cmp/<t>` and `tm/<t>` for the six
  targets. `_TEST_LIVE` appears only in `ReadmeHowto_<t>.ts`. Their
  TestEntity/TestDirect components have no live harness, unlike
  `cpp/TestEntity_cpp.ts:116,133`.
- **Fix.** In the six ReadmeHowto copies, drop the "Run live tests" block (env
  line and `.env.local`), and say instead that this target's generated tests
  run offline only. A better alternative is a derivation `liveTestEnv(model,
  target)` that returns the variables the target's test generators actually
  read, empty for these six. The section is then written only when the list is
  non-empty. Whichever is chosen, keep it identical across the six.
- **Check.** A new assertion in `ts/test/generate.test.ts`: for each target,
  every `<ENV>_...` name in its README appears in some generated non-markdown
  file of that target. That catches this and G07 in both directions.

### G04. info.auth false leaves PrepareAuth placing credentials: isAuthSuppressed ignores it while isAuthActive honours it

- **Fate.** WP28.
- **Class.** code-defect; sdkgen; helper; 21 source files; size m; changes
  generated code. Needs: requiredOptions.
- **Where.** `ts/src/utility.ts:22-30` (isAuthActive) against :47-51
  (isAuthSuppressed); `ts/project/.sdk/src/cmp/<lang>/PrepareAuth_<lang>.ts`
  (ts:19, go:312); `ts/project/.sdk/src/cmp/<lang>/TestClean_<lang>.ts`
- **At head.** Present. Read `utility.ts`. isAuthActive is false for
  `info.auth: false`, but isAuthSuppressed is true only for
  `config.auth.active === false`. `PrepareAuth_ts.ts:19` gates on
  isAuthSuppressed, so under `auth-off` the credential-placing code is
  generated as in the Bearer run, while the documents and Config drop auth.
- **Fix.** Define suppression once as "auth not active": either make
  isAuthSuppressed return !isAuthActive(model), or have every
  PrepareAuth/TestClean generator call isAuthActive. Remove the twelve local
  copies of the rule (design 14.3, V17) so the change lands once. The neutral
  change reaches projects at the next generate. The twelve copies that inline
  the rule are copy-wave changes.
- **Check.** New test in `ts/test/generate.test.ts`: generated PrepareAuth and
  TestClean under `info.auth:false` are byte-identical to those under
  `config.auth.active:false`, for all 20 targets.
  `ts/test/cleancoverage.test.ts` must stay green.

### G05. Operation-level active:false is ignored by entity code, Config and flow tests while introductions drop the operation

- **Fate.** WP21.
- **Class.** code-defect; sdkgen; neutral-component; 1 source file; size s;
  changes generated documents and code. Needs: DQ1; guardModel.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/Entity_<lang>.ts`
  (ts:41-46,57-64); `ts/src/utility.ts:290-310` (withPointParts);
  `ts/src/helpers/flowGuard.ts:18,78-79`; `ts/src/helpers/opShape.ts:404-431`
- **At head.** Present. `Entity_ts.ts` builds op fragments from
  Object.keys(entity.op) with no active check. entityOps and introOps filter
  `active !== false`. flowGuard reads `ent.op?.[step.o]` without the flag.
  This is unchanged since the map.
- **Fix.** Under DQ1 (recommended): a pre-pass in guardModel, run before Root
  (and carried to docgen through `sdk.json`), deletes every op with `active:
  false`. The schema declares `op: &: active: *true | boolean`, and flowGuard
  logs the dropped step at info level. No per-language copy changes: every
  generator then sees an absent op. If DQ1 is answered the other way (the
  switch is not supported), delete the `active !== false` op filters from
  entityOps/introOps/go-cli and report the slot as unknown in package check.
- **Check.** A new test (design note DQ1 prototype: output identical to a
  never-declared op in five states). The text guard's suspended op-level pin
  family is deleted when this lands.

### G06. go-cli, go-mcp and py-data ignore HTTP Basic: no secret is read or documented when the wrapped SDK needs one

- **Fate.** WP36.
- **Class.** omission; sdkgen; consumer-main; 5 source files; size s; changes
  generated documents and code. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:66-68`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:154-156`;
  `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:238-251,653-670`;
  `ts/project/.sdk/src/cmp/go-cli/fragment/main.fragment.go:52-63`;
  `ts/project/.sdk/src/cmp/go-mcp/fragment/main.fragment.go:20-31`
- **At head.** Present. Grepped all three consumers' components, fragments and
  tm/py-data for secret/basic: there are no hits beyond the word "secrets
  vault". The code builds opts from apikey (and base) only.
- **Fix.** Each consumer reads requiredOptions(model). When `secret` is
  present, the code reads `<ENV>_SECRET` into `opts["secret"]` (go fragments
  via a replace token; py-data's data() and auth.resolve), and the README,
  `AGENTS.md` and notebook document it beside the key.
- **Check.** Extend the consumer case in `ts/test/generate.test.ts` with an
  auth-basic fixture: each consumer's code and README name `<ENV>_SECRET`. The
  guard's parity relation keeps the three consumers on the same fact.

### G07. Generated live tests read `<ENV>_SERVER_<VAR>` and `<ENV>_TEST_<ENT>_ENTID`, which no document names

- **Fate.** WP30.
- **Class.** omission; sdkgen; per-language-copy; 13 source files; size m;
  changes generated documents. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeHowto_<lang>.ts` (ts:177,
  go:167); readers: `ts/project/.sdk/src/cmp/<lang>/TestEntity_<lang>.ts`
  (ts:106,188), `ts/src/helpers/serverVars.ts:59-61`
- **At head.** Present. By grep, `serverVarEnv/_SERVER_` is read by csharp,
  go, java, js, lua, perl, php, py, rb, rust and ts (11 targets). `_ENTID` is
  read by those plus cpp and kotlin (13). Every ReadmeHowto prints only
  `_TEST_LIVE` plus the apikey line.
- **Fix.** The "Run live tests" section in each ReadmeHowto copy lists the
  variables the target's tests read: `<ENV>_SERVER_<VAR>` for each required
  server variable (requiredOptions().server, via serverVarEnv), `<ENV>_SECRET`
  under Basic, and the optional `<ENV>_TEST_<ENT>_ENTID` per entity. A shared
  helper (for example `liveTestEnv(model, target)` beside serverVarEnv)
  returns this list so the test generators and the documents read one list.
- **Check.** The same new assertion as G03: every env name a target's
  generated tests read appears in its README, and the reverse. Changes to
  ReadmeHowto copies move ts/test/golden (npm run golden).

### G08. go-cli help, /help and `words.go` always offer list / load / update whatever operations the entities have

- **Fate.** WP36.
- **Class.** code-defect; sdkgen; fragment; 3 source files; size s; changes
  generated documents and code.
- **Where.**
  `ts/project/.sdk/src/cmp/go-cli/fragment/main.fragment.go:37,122`;
  `ts/project/.sdk/src/cmp/go-cli/fragment/words.fragment.go:13`;
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:70-86`
- **At head.** Present. `main.fragment.go:37` and :122 print the literal word
  list. `words.fragment.go:13` loops over the literal
  \[\]string{"list","load","update"}. `Main_go-cli.ts:75-86` already computes
  supportedOps for the README table but passes nothing to the fragments.
- **Fix.** Main\_go-cli passes the supported verbs (the supportedOps it
  already computes, in list/load/update order) to both fragments as a replace
  token or slot. The help and /help lines print that list, and `words.go`
  registers only those verbs. When no verb is supported, help prints no Words
  line. This is design note case 11: fixed once, from the values the README
  uses. S32's README sentences are the same fix.
- **Check.** A go-cli case in `ts/test/generate.test.ts` on the
  op-absent-readonly variation: `main.go` and `words.go` do not name `update`.
  The generatedcompile go-cli lane compiles it.

### G09. go-cli and go-mcp binaries print and read the API-key env var and say it carries the key when auth is off

- **Fate.** WP36.
- **Class.** stale-mention; sdkgen; fragment; 4 source files; size s; changes
  generated documents and code. Needs: requiredOptions; DQ6.
- **Where.**
  `ts/project/.sdk/src/cmp/go-cli/fragment/main.fragment.go:39,51-60`;
  `ts/project/.sdk/src/cmp/go-mcp/fragment/main.fragment.go:19-25`;
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:396-404`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:455-461`
- **At head.** Present. Both fragments carry the Env help line, the
  APIKEYENVVAR comment and the opts\["apikey"\] read as literals. Their Main
  components substitute the names without asking isAuthActive, so the auth-off
  `main.go` is byte-identical.
- **Fix.** The Main components build the env help line, and the credential
  block, from requiredOptions(model) (apikey, secret, server vars). They pass
  these to the fragment as replace tokens, so the fragment holds no auth
  sentence of its own (design rule 5). With auth off, no APIKEY line or read
  is emitted. This is the binary half of S35/S36; do it with G02 and G06 in
  one change to the two fragments.
- **Check.** A go-cli/go-mcp auth-off case in `ts/test/generate.test.ts`:
  `main.go` contains no `_APIKEY`. The guard's off relation over non-markdown
  output, if DQ6 extends it, holds it.

### G10. go-cli package comment says "Command Demo-cli" (class name) for a binary named demo-cli

- **Fate.** WP36.
- **Class.** code-defect; sdkgen; fragment; 2 source files; size xs; changes
  generated code.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/fragment/main.fragment.go:1`;
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:396-404`
- **At head.** Present. Line 1 reads `// Command ProjectName-cli is a CLI +
  REPL`, and stdrep replaces ProjectName with the class form, while the binary
  is `${model.name}-cli` (`Main_go-cli.ts:61`).
- **Fix.** Change the fragment's first line to use a dedicated token (for
  example `// Command CLIBINNAME is a CLI + REPL for the ProjectName SDK`) and
  add `CLIBINNAME: bin` to Main\_go-cli's replace map, so the go doc names the
  command as built.
- **Check.** Assertion in the go-cli case of `ts/test/generate.test.ts`:
  `main.go` line 1 starts with `// Command <slug>-cli `.

### G11. MCP load and remove tool descriptions say {"id":1} and list says "first page" regardless of entity id or paging

- **Fate.** WP36.
- **Class.** stale-mention; sdkgen; consumer-main; 1 source file; size xs;
  changes generated code.
- **Where.** `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:57,63,87`
  (TOOL\_SPEC), emitted at :494
- **At head.** Present. TOOL\_SPEC holds literal help strings: `such as
  {"id":1}` for load (:63) and remove (:87), and `omit it for the first page`
  for list (:57). They are used for every entity a tool serves, including an
  id-less singleton and string ids.
- **Fix.** Build the help per tool from the entities the tool serves, using
  the match examples the README already uses (matchExampleItems /
  entityIdField). Show a concrete example only when every served entity agrees
  on the id field and type. Otherwise write "match map naming the record by
  its identifying fields". Replace "omit it for the first page" with "omit it
  to list without a filter", or say "first page" only when the paging feature
  is active (featureOnByDefault or the project's feature list).
- **Check.** A go-mcp case in `ts/test/generate.test.ts` with a singleton and
  a string-id entity: `tools.go` contains no `{"id":1}`.

### G12. py-data data() raises "No API credential found" and the notebook demands `<ENV>_APIKEY` for an API without auth

- **Fate.** WP36.
- **Class.** code-defect; sdkgen; consumer-main; 1 source file; size xs;
  changes generated documents and code. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:229-251`
  (data(), unconditional raise at :246-247), :653-670 (README Credentials),
  :769-770, :848-859 (notebook cell);
  `ts/project/.sdk/tm/py-data/pkg/auth.py:88-97`
- **At head.** Present. Read `Main_py-data.ts`. `if not token: raise
  ValueError(auth.missing_token_message(...))` and `opts = {"apikey": token}`
  are emitted without isAuthActive. The README's "\#\# Credentials" and the
  notebook's "\#\# 2. Credentials" cell are unconditional. The `auth.py`
  template only formats the message and is called from the component.
- **Fix.** Gate on requiredOptions(model).apikey in Main\_py-data: with auth
  off, data() takes no token, never raises, and passes no apikey. The README
  Credentials section, the `AGENTS.md` lines and the notebook cell are written
  only when a credential is required, and add `secret` under Basic (G06). The
  template `auth.py` needs no change because its function is only called on
  the gated path.
- **Check.** A py-data auth-off case in `ts/test/generate.test.ts`: the
  generated data module has no `missing_token_message` call, and the README
  has no Credentials heading. The py-data test suite in the generatedcompile
  lane, if one exists, runs it.

### G13. Manifest descriptions: "csharp SDK", "elixir SDK", "perl SDK", "Python Data SDK"; rust/java/ocaml diverge; eight targets have none

- **Fate.** WP15.
- **Class.** code-defect; sdkgen; helper; 4 source files; size m; changes
  generated code. Needs: targetSurface; DQ2.
- **Where.** `ts/src/helpers/packageMeta.ts:14-29` (LANG\_LABEL, langLabel),
  :311-315 (pkgDescription);
  `ts/project/.sdk/src/cmp/rust/Package_rust.ts:31`;
  `ts/project/.sdk/src/cmp/java/Package_java.ts:58`;
  `ts/project/.sdk/src/cmp/ocaml/Package_ocaml.ts:47`
- **At head.** Present. LANG\_LABEL covers ts, js, py, php, rb, lua, go and
  the three consumers, so csharp, elixir and perl fall back to the key. rust,
  java and ocaml write their own description with Name and no non-affiliation
  line. No description is emitted for c, clojure, cpp, go, kotlin, scala,
  swift or zig. Every target model already declares a display `title` (C\#,
  Elixir, Perl...).
- **Fix.** pkgDescription takes the display name from the target model's
  `title` (through originName for an alias), not from a table keyed by target
  name, and names the thing by its surface: "SDK" for surface sdk, "data
  package", "CLI" or "MCP server" otherwise (targetSurface). rust, java and
  ocaml call pkgDescription. Where the manifest format has a description slot
  (kotlin and scala build files, clojure pom, cpp/c none), add it. go gets a
  package doc comment from the same string. langLabel's other callers move to
  the title too, or are left with a note.
- **Check.** A new test (`ts/test/publisher.test.ts` or `packaging.test.ts`):
  for every SDK target, the generated manifest's description contains its
  title and the non-affiliation sentence.

### G14. Client source comments name five transport wrappers (retry/cache/netsim/proxy/ratelimit) and fixed feature lists; models declare eight wrappers

- **Fate.** WP38.
- **Class.** stale-mention; sdkgen; fragment; 30 source files; size l; changes
  generated code. Needs: DQ6.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/fragment/Main.fragment.*`
  (go:43-49, js:290-293; 13 fragments); `ts/project/.sdk/tm/<lang>/**`
  (`java/core/SdkClient.java`, `kotlin/core/SdkClient.kt`,
  `ocaml/sdk_features.ml`, `cpp/core/types.hpp`...);
  `ts/project/.sdk/tm/<lang>/**/make_error.*`
  (`py/pkg/utility/make_error.py:68`, `go/utility/make_error.go:75`)
- **At head.** Present. grep finds 'retry/cache/netsim/proxy/ratelimit' in 13
  Main fragments and 6 tm files. The feature models declare `transport:
  'wrap'` for cache, cost, netsim, proxy, ratelimit, retry, secrets and
  timeout (eight). 'observability features (metrics, telemetry, audit, ...'
  appears in about 9 make\_error templates.
- **Fix.** Under DQ6 (recommended): a comment pass, with no gate, rewords
  these comments so they name no feature: "the transport-wrapping features
  (those whose model declares transport: 'wrap') wrap whatever is current, so
  `test`, the base transport, is added first"; "no pipeline feature applies on
  this path"; "so features hooked on PreUnexpected observe it". Batch it into
  the single copy wave. If DQ6 is answered "include comments", extend the text
  guard's off relation to non-markdown files with pins.
- **Check.** A grep assertion in a new comment test (or
  `ts/test/commentmarker.test.ts`): no file under
  `ts/project/.sdk/src/cmp/*/fragment` or tm names the five-wrapper list.
  Under DQ6's recommendation there is no generated-output guard.

### G15. Comments presume test, streaming and paging features (testSDK, streaming output, pagination fields) in every SDK, present or not

- **Fate.** WP38.
- **Class.** stale-mention; sdkgen; fragment; 53 source files; size l; changes
  generated code. Needs: DQ6.
- **Where.** `ts/project/.sdk/src/cmp/cpp/fragment/Main.fragment.cpp:21`;
  `ts/project/.sdk/tm/java/core/SdkClient.java:385`;
  `ts/project/.sdk/src/cmp/js/fragment/EntityBase.fragment.js:97`;
  `ts/project/.sdk/tm/go/core/result.go:17` (53 source files mention the
  paging/streaming feature)
- **At head.** Present. Opened the four cited lines: they are unconditional
  comments in copied fragments and templates. Under design default 13 a
  project without `test` is already broken (generate should error), so the
  test-feature comments are true in every valid project. The streaming and
  paging ones describe fields and methods that exist whether or not the
  feature does.
- **Fix.** Under DQ6: leave the test-feature comments, since generate will
  refuse a project without test (default 13). Reword the streaming and paging
  comments conditionally ("populated by the paging feature when it is active")
  in the same comment pass as G14. No gate.
- **Check.** No generated-output guard under DQ6. The reviewer checks the
  comment-pass diff against this list of 53 files.

### G16. Entity comments about remove/create/update/CRUD stay on entities without those operations ("Deleted reports whether a successful Remove...")

- **Fate.** WP38.
- **Class.** stale-mention; sdkgen; fragment; 16 source files; size m; changes
  generated code. Needs: DQ6.
- **Where.** `ts/project/.sdk/src/cmp/go/fragment/Entity.fragment.go:84`;
  `ts/project/.sdk/src/cmp/java/fragment/EntityBase.fragment.java:38`;
  `ts/project/.sdk/src/cmp/c/fragment/Entity.fragment.c:17`
- **At head.** Present. Opened go `Entity.fragment.go:78-87`.
  MarkDeleted/Deleted are emitted on every entity whatever its op set, so the
  comment describes a method that, on a load-only entity, can only ever return
  false. The statement is conditionally true, not false: low severity.
- **Fix.** Under DQ6: in the comment pass, reword to say what the method
  reports without presuming the op ("Deleted reports whether this instance has
  been marked deleted by a remove."). Optionally gate the Deleted accessor on
  the entity having remove (code change, a decision per language; not
  recommended now).
- **Check.** None beyond review under DQ6. If DQ6 includes comments, the
  guard's off relation over non-markdown output on op-absent-readonly.

### G17. Generated source comments cite `AGENTS.md` section "Entity operations return ENTITIES", which no generated guide contains

- **Fate.** WP38.
- **Class.** dangling-link; sdkgen; fragment; 78 source files; size s; changes
  generated documents and code. Needs: DQ6.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/fragment/Entity*Op.fragment.*`
  (`c/EntityLoadOp.fragment.c:31`, `js/EntityLoadOp.fragment.js:98`);
  `ts/project/.sdk/src/cmp/go/EntityTypes_go.ts:204`; tm files; 78 source
  files mention `AGENTS.md`, 33 quote the section
- **At head.** Present. grep counts 33 source files (35 lines) quoting the
  section and 78 fragment/tm files referring to `AGENTS.md`. The section
  exists only in sdkgen's own `AGENTS.md`, and the generated AgentGuide
  components do not write it.
- **Fix.** Under DQ6's comment pass: replace 'See `AGENTS.md` "..."' with the
  one-line rule itself ("every operation resolves to the entity; the record is
  entity.data()"), or with a link to the published sdkgen docs page that
  explains it. Alternatively, have the generated per-target `AGENTS.md` carry
  an "Entity operations return entities" section (a neutral AgentGuideContent
  change, no copies) so the citation resolves. That is cheaper (1 file instead
  of 78) and is the recommendation.
- **Check.** A test in `ts/test/agentguide.test.ts`: every quoted `AGENTS.md`
  section title appearing in generated source exists as a heading in the
  generated target `AGENTS.md` (or the root one when phase.top is on).

### G18. py `__init__.py` keeps the unfired marker "\# \#BuildFeatures"; five other Main components carry dead \#BuildFeatures handlers

- **Fate.** WP37.
- **Class.** code-defect; sdkgen; fragment; 7 source files; size s; changes
  generated code.
- **Where.** `ts/project/.sdk/src/cmp/py/fragment/Main.fragment.py:94`;
  `ts/project/.sdk/src/cmp/py/Main_py.ts:100-106`; dead handlers:
  `ts/project/.sdk/src/cmp/<lang>/Main_<lang>.ts` (go:86, js:120, php:67,
  rb:69, ts:124)
- **At head.** Present. The stored spike output
  `proto/checkdocs/work/code-base/py/demo_sdk/__init__.py:94` keeps the line.
  lua's handler, keyed '-- \#BuildFeatures', does fire (it emits `-- feature:
  x` lines). py's key '\#BuildFeatures' does not match its '\#
  \#BuildFeatures' line. The go/js/php/rb/ts fragments contain no marker at
  all, so their handlers are dead.
- **Fix.** Delete the marker line from `py/fragment/Main.fragment.py` and the
  '\#BuildFeatures' handlers from Main\_py, go, js, php, rb and ts. Features
  are installed through the generated config, and the comment list adds
  nothing. If the comments are wanted, key py's handler as '\#
  \#BuildFeatures'. Fix lua's mis-indented first emitted line in the same
  change.
- **Check.** The design note's exact check "no fragment marker line survives
  into output" is added to `ts/test/generate.test.ts` over every generated
  non-markdown file (pattern `#[A-Z][A-Za-z-]+` at a comment start), with the
  lua/py fixtures. `ts/test/fragments.test.ts` may hold the marker inventory.

### G19. With auth off, 329 credential-placement comments remain in every target's source; the code they describe is also still generated

- **Fate.** Repeats G04 and is resolved with it in WP28; its comment half
  falls to WP38.
- **Class.** stale-mention; sdkgen; fragment; 20 source files; size m; changes
  generated code. Needs: DQ6.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/PrepareAuth_<lang>.ts` (ts:19);
  fragments and tm files of all 20 targets
- **At head.** Present. `PrepareAuth_ts.ts:19` computes `suppressed` from
  isAuthSuppressed alone, so under info.auth:false the generated auth code is
  the Bearer one (G04). The remaining comments sit in templates copied
  regardless of auth.
- **Fix.** The code half is fixed by G04: PrepareAuth emits the suppressed
  form when auth is not active. The comments in copied templates stay (they
  describe the runtime's credential handling, which exists when a caller
  passes one). Under DQ6 they are reviewed in the comment pass only where they
  assert that the SDK sends a key.
- **Check.** G04's test (byte-identical PrepareAuth across the two auth-off
  states). No comment guard under DQ6.

### G20. SDKGEN\_EXTERNAL changes the in-tree root README, `AGENTS.md`, Makefile, publish workflow, `PUBLISHING.md` and the js release tag

- **Fate.** WP23.
- **Class.** code-defect; sdkgen; neutral-component; 0 source files; size s;
  changes generated documents and code. Needs: DQ3; targetPlace.
- **Where.** `ts/src/sdkgen.ts:374-382` (Root given withoutExternal(model,
  external)); `ts/src/cmp/ReadmeTop.ts:136-145`;
  `ts/src/cmp/AgentGuideTop.ts:50-56`;
  `ts/src/cmp/PublishWorkflow.ts:20-30,79-90`; `ts/src/cmp/Deploy.ts:14-20`
- **At head.** Present. `sdkgen.ts:381-382` passes Root a model with the
  relocated targets removed, so every project-level component (README,
  `AGENTS.md`, PublishWorkflow's npmTargets and isPrimaryNpm/releaseTag,
  Deploy) sees a different target set under the override.
- **Fix.** Under DQ3 (recommended): project-level components read the declared
  model (ctx\$.model unchanged), and the set of targets this pass writes is
  carried on meta (an override-only set). Only per-target emission skips
  relocated targets. The 85-line prototype in four source files (design DQ3)
  is the starting point. `PUBLISHING.md` and the sibling notes follow. If DQ3
  is answered the other way (the documents describe this run), say so in the
  override's docs and leave the code.
- **Check.** A new `ts/test/external.test.ts` case: generate with and without
  SDKGEN\_EXTERNAL; root `README.md`, `AGENTS.md`, Makefile,
  `.github/workflows/publish-*.yml` and `.sdk/PUBLISHING.md` are
  byte-identical.

### G21. Relocated ts writes `../README.md` links, `cd ts`, `cd ../.sdk` and a test reading `../../README.md` into another repository

- **Fate.** WP32.
- **Class.** dangling-link; sdkgen; neutral-component; 2 source files; size s;
  changes generated documents and code. Needs: docLink; targetPlace; DQ3.
- **Where.** `ts/src/helpers/alongside.ts:36-37`;
  `ts/src/cmp/AgentGuide.ts:38-52`;
  `ts/project/.sdk/src/cmp/ts/ReadmeHowto_ts.ts:183`;
  `ts/project/.sdk/src/cmp/ts/ReadmeExampleTest_ts.ts:39`
- **At head.** Present. `alongside.ts:36-37` writes a literal `../README.md`,
  `AgentGuide.ts:41-52` writes `../AGENTS.md` and `cd ../.sdk`,
  ReadmeHowto\_ts:183 writes `cd ts && npm test`, and ReadmeExampleTest\_ts:39
  reads Path.join(\_\_dirname,'..','..','`README.md`'). None asks where the
  target is placed.
- **Fix.** Use docLink(ctx\$, target, '`README.md`'/'`AGENTS.md`') for the
  links and drop the sentence when it returns undefined. Take the `cd` lines
  from targetPlace (the `cd` to the target is omitted when the reader is
  already in it; `cd ../.sdk` uses output.sdkrel or the derived path back).
  ReadmeExampleTest\_ts tests the target's own README quick start, or the root
  README only when docLink resolves it. These are two ts copies and two
  neutral files; js's siblings follow if they carry the same lines.
- **Check.** The text guard's link relation on an out-of-tree run, plus the
  per-generate link check (design section 8) warning on any dangling link in a
  relocated tree. Add an `external.test.ts` case that the relocated ts tree
  has no `../README.md`.

### G22. Relocating py with SDKGEN\_EXTERNAL makes py-data abort the whole generation: "py-data requires the py target"

- **Fate.** WP36.
- **Class.** code-defect; sdkgen; consumer-main; 1 source file; size xs;
  changes generated code. Needs: targetSurface; targetPlace; DQ2; DQ3.
- **Where.** `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:23-31`;
  `ts/src/sdkgen.ts:381-382` (withoutExternal)
- **At head.** Present. `Main_py-data.ts:26-31` throws when
  `model.main[KIT].target.py` is null. `sdkgen.ts:382` removes the relocated
  py from the model Root sees, so a valid run fails.
- **Fix.** py-data finds its sibling with
  targetSurface(model,'py-data').consumed against the declared target set
  (DQ3's meta), not the pass's model. It refuses only when the consumed target
  is absent from the model. The import path and docs then use the sibling's
  place (targetPlace) rather than an implied in-tree layout.
- **Check.** An `external.test.ts` case: SDKGEN\_EXTERNAL relocating py with
  py-data active generates without error.

### G23. go-cli and go-mcp hard-code `../go` in README and go.mod replace, wrong when go is relocated, aliased or absent

- **Fate.** WP36.
- **Class.** code-defect; sdkgen; consumer-main; 2 source files; size s;
  changes generated documents and code. Needs: targetSurface; targetPlace;
  DQ2; DQ3.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:213,324,358`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:269,379,420`
- **At head.** Present. grep shows the literal `../go` in prose (213, 324;
  269, 379) and in `replace ${sdkModule} => ../go` (358, 420). Neither
  component checks that a `go` target exists (design 14.6).
- **Fix.** Resolve the wrapped target with targetSurface(model, t).consumed
  and refuse generation when it is empty, as py-data does. With two
  candidates, refuse and name both (design section 5). Compute the relative
  path from the consumer's place to the consumed target's place (targetPlace /
  output.path) for both the replace directive and the prose.
- **Check.** `generate.test.ts` NON\_SDK\_SIBLING case with go aliased to go2
  (go.mod replace names `../go2`), and with go absent (generation throws). The
  generatedcompile go-cli lane builds the aliased case.

### G24. docgen SUMMARY and site: "There are 1 SDK targets", "Build from source", fixed `ts/` directory whatever the placement

- **Fate.** WP26b.
- **Class.** code-defect; docgen; other; 1 source file; size s; changes
  generated documents. Needs: targetPlace; targetSurface; DQ3.
- **Where.** docgen `ts/src/content.ts:160-166` (surface table, installation),
  :189 (count sentence), :254 (target row with code(t.name + '/'))
- **At head.** Present. Read docgen 9ca5221 `content.ts`. The count sentence
  has no singular form, the directory cell is `t.name + '/'` regardless of
  `output.path/output.root`, and the install cell falls back to 'Build from
  source' / 'Not published. Build from the `<t>` directory.' even for a target
  written nowhere (V28).
- **Fix.** In docgen: give the count sentence a singular and a plural; take
  the directory from sdkgen's exported targetPlace (or omit the cell for an
  external target and link its repo); write nothing about a target the run did
  not generate (create:false). Replace the local surface() table with sdkgen's
  targetSurface once exported.
- **Check.** docgen's own suite: an edition test with one target (singular),
  an output.path target (no `ts/` directory), and output.create:false over a
  missing folder (target not listed).

### G25. With the only SDK relocated, root docs promise SDK READMEs and a direct example, and the run prunes Makefile and publish files

- **Fate.** WP23.
- **Class.** code-defect; sdkgen; neutral-component; 0 source files; size s;
  changes generated documents and code. Needs: DQ3; docLink; targetSurface.
- **Where.** `ts/src/cmp/ReadmeTop.ts:243-249,557-562`;
  `ts/src/cmp/AgentGuideTop.ts:33,39`; `ts/src/helpers/generated.ts:405-425`
  (prune); `ts/src/sdkgen.ts:381-387`
- **At head.** Present. `ReadmeTop.ts:245-247` writes "See the Features
  section of any SDK README below" whenever features exist, and :557-561
  writes the "use `direct`:" lead-in before a block that needs an in-tree SDK.
  `AgentGuideTop.ts:33,39` are fixed sentences. Root components emit nothing
  for the relocated target, so pruneGenerated deletes the committed Makefile,
  `PUBLISHING.md`, trust script and `publish-ts.yml`.
- **Fix.** Under DQ3, root components read the declared model (G20), so the
  release files stay and are not pruned. Independently, write each lead-in
  only when what it introduces follows: the "any SDK README below" clause only
  when an SDK README is generated in this tree (docLink), and the "use
  `direct`:" heading only when its example block is emitted. "multi-language"
  counts SDK targets (S06). generate warns that a relocated target's old
  in-tree folder is now stale, rather than leaving it silently.
- **Check.** An `external.test.ts` case relocating the only SDK target: no
  committed project file is pruned, the root README has no lead-in without
  content, and there is a warning naming the stale `ts/`. The design note's
  exact check "no table header or lead-in without rows" applies.

### G26. output.repo is documented and declared in the schema but read by nothing; manifests and install text name the SDK repository

- **Fate.** WP25.
- **Class.** unread-switch; sdkgen; helper; 2 source files; size m; changes
  generated documents and code.
- **Where.** `ts/model/sdkgen.aontu:145`; `docs/reference/model.md:312`;
  `ts/src/helpers/packageMeta.ts:42-50` (repoInfo ignores the target);
  `ts/project/.sdk/src/cmp/ts/ReadmeInstall_ts.ts:24`
- **At head.** Present. grep for output.repo / output?.repo over ts/src and
  `project/.sdk/src` returns no reader. repoInfo(model) takes no target
  argument and builds the path from main.kit.repo only.
- **Fix.** repoInfo(model, target?) returns `<host>/<output.repo>` when the
  target declares output.repo. Every caller that renders a target's
  repository, homepage, bugs or install text (`Package_<lang>` copies,
  ReadmeInstall\_ts, publish workflow) passes the target. Alternatively, if
  the maintainer will not support it, delete the slot from the schema and from
  `docs/reference/model.md` (and package check reports it as unknown).
- **Check.** An `external.test.ts` case with output.repo 'acme/demo-ts': the
  destination `package.json` repository/homepage/bugs and the README install
  text name acme/demo-ts. Or, if deleted, `ts/test/modeltext.test.ts` and
  model docs agree.

### G27. A field description containing '|' breaks README and REFERENCE table rows in all 20 targets (120 rows for two descriptions)

- **Fate.** WP33.
- **Class.** code-defect; sdkgen; per-language-copy; 60 source files; size l;
  changes generated documents. Needs: mdCell.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts`
  (py:100-102), `ReadmeRef_<lang>.ts` (py:204-207), `ReadmeModel_<lang>.ts`
  (py:135); 60 Readme copies read `field.sh`
- **At head.** Present. Opened the three py sites: `field.sh` is interpolated
  raw into a table cell. grep finds 60 per-language Readme components reading
  `field.sh`.
- **Fix.** Add `ts/src/helpers/markdown.ts` with mdCell/mdInline (pipe to \\|,
  newline to `<br>`, \$\$ to \$&amp;\#36; via a function replacer), exported
  from `ts/src/sdkgen.ts` in the neutral release before the wave. Every
  per-language cell site wraps vendor text in mdCell. That is one copy-wave
  edit per file, and the helper arrives as a new export, not inside an
  existing copied file. The per-generate table check (design section 8) warns
  on any broken row.
- **Check.** The new per-generate check `doc-table-broken` fails sdkgen's
  suite (`generate.test.ts`) on a fixture field description holding '|' and a
  newline. A unit test in `ts/test/helpers.test.ts` covers mdCell.

### G28. \$\$name\$\$ in vendor text is substituted by the Content template pass in docs, Config, entity tests and docgen output

- **Fate.** WP33.
- **Class.** code-defect; sdkgen; helper; 0 source files; size m; changes
  generated documents and code. Needs: mdCell; mdInline.
- **Where.** jostraca Content (no raw mode); `ts/src/utility.ts:343-360`
  (configDefinition copies `f.sh` into Config);
  `ts/project/.sdk/src/cmp/ts/TestEntity_ts.ts:261` (JSON.stringify into
  Content); docgen `ts/src/docgen.ts:293-298` (emit via Content(String(text)))
- **At head.** Present. Every emitter passes vendor strings to jostraca
  Content, which interpolates `$$path$$` against the model. configDefinition
  and TestEntity\_ts serialise field short text and live facts straight into
  Content, and docgen's emit does the same for every file.
- **Fix.** Documents: mdCell/mdInline escape `$$` as `$&#36;` (design section
  8). Source files: either add a raw/no-interpolation option to jostraca
  Content (repo: jostraca) and use it wherever serialised model data is
  emitted (Config, TestEntity, docgen emit), or escape `$` inside string
  literals per language (`$` in JSON/ts/js/java/go/...) through one helper.
  The first is the single fix and is recommended. docgen adopts the same in
  its emit().
- **Check.** A fixture in `ts/test/generate.test.ts` with `$$name$$` in a
  field description and in text.summary: the literal survives verbatim in
  every generated README, Config and test file. docgen's suite gets the same
  for `SUMMARY.md`.

### G29. A relative link inside a vendor field description becomes a dangling link in 60 generated documents

- **Fate.** WP18.
- **Class.** dangling-link; sdkgen; per-language-copy; 60 source files; size
  s; changes generated documents. Needs: mdCell; mdInline.
- **Where.** the same cell sites as G27:
  `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts` (py:101),
  `ReadmeRef_<lang>.ts` (py:206), `ReadmeModel_<lang>.ts` (py:135)
- **At head.** Present. Same raw `field.sh` interpolation as G27. A relative
  markdown link in the spec resolves against the spec's site, not the
  generated repository.
- **Fix.** mdCell and mdInline unwrap a relative markdown link (no scheme, not
  an anchor) to its label text and keep absolute URLs. This is one rule in the
  new helper, landing with G27's wave. The per-generate link check (design
  section 8) then warns on anything that still dangles. Design decision
  needed, because the design note's escapers do not yet strip links.
- **Check.** A `generate.test.ts` fixture with `[see](guide.md)` in a field
  description: no generated document contains `](guide.md)`, and the
  doc-link-dangling check is silent.

### G30. docgen throws "Documentation images must use local assets" on a remote image in vendor text, stopping the whole generate

- **Fate.** WP05a.
- **Class.** code-defect; docgen; other; 1 source file; size xs; changes
  generated documents.
- **Where.** docgen `ts/src/docgen.ts:114-128` (safeMarkdown, throw at :122)
- **At head.** Present. Read docgen 9ca5221 `docgen.ts:118-124`. Any image
  token with a scheme throws, whether the text is project-authored or quoted
  from the spec (info.description, field descriptions).
- **Fix.** In docgen, for quoted vendor text (the Quoted path), replace a
  remote image with its alt text as a plain link, and log a warning. Keep the
  throw for project-authored content under `.sdk/doc/content`, where the
  author can fix it. This follows the design default "vendor text never fails
  a build".
- **Check.** A docgen test: a model whose info.description holds a remote
  image generates, emits a warning, and its output has no remote `<img>`.

### G31. Entity short vs desc chosen differently by ReadmeTop, per-language READMEs and docgen; a newline breaks the root table

- **Fate.** WP33.
- **Class.** duplicated-rule; sdkgen; helper; 21 source files; size m; changes
  generated documents. Needs: mdCell; mdInline.
- **Where.** `ts/src/cmp/ReadmeTop.ts:504-505` (entity\_desc || short ||
  desc); `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts` (py:66, short
  only); docgen `ts/src/content.ts:197` (entity\_desc || desc || short)
- **At head.** Present. The three sites read the same slots in different
  orders, and the per-language copies ignore text.entity\_desc and desc.
  ReadmeTop writes the value raw into a table cell (:508).
- **Fix.** Add one exported derivation, entityDescription(model, ent), in
  `ts/src/helpers/text.ts` beside the entity\_desc handling, with one order
  (text.entity\_desc, then short, then desc). Call it from ReadmeTop, every
  `ReadmeEntity_<lang>` (copy wave) and docgen. Wrap table uses in mdCell and
  prose uses in mdInline.
- **Check.** A `generate.test.ts` fixture with entity short and desc both set
  plus a newline: the root README, every target README and docgen's SUMMARY
  show the same text, and the doc-table-broken check is silent.

## V. Verified in source (V1 to V32)

Read in the source and confirmed without generating.

### V1. Six READMEs (c, elixir, ocaml, scala, swift, zig) document `<ENV>_TEST_LIVE`=TRUE and .env.local that nothing in those SDKs reads

- **Fate.** Repeats G03 and is resolved with it in WP30.
- **Class.** stale-mention; sdkgen; per-language-copy; 6 source files; size s;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<t>/ReadmeHowto_<t>.ts` (c:201-204,
  elixir:141-144, ocaml:132-135, scala:137-140, swift:160-163, zig:142-145)
- **At head.** Present. Opened the six ReadmeHowto components at head (section
  'Run live tests', lines cited); grep of `tm/<t>` and `src/cmp/<t>` for
  TEST\_LIVE|env.local finds no reader outside ReadmeHowto, whereas go's
  `tm/go/test/testsupport_test.go:48` does read PROJECTENV\_TEST\_LIVE.
- **Fix.** Delete the 'Run live tests' subsection from the six
  `ReadmeHowto_<t>` copies in the copy wave (these targets ship no live
  harness), so the section exists exactly where the target's test tree reads
  the variable. If the maintainer wants live suites there instead, that is new
  harness work per target, not a doc fix.
- **Check.** parity relation of the text guard (section 7) plus a new exact
  check in `ts/test/textguard.test.ts`: every `<ENV>_`\* variable a generated
  document names occurs in that target's generated test or source tree.

### V2. rust README says put .env.local 'at the crate root'; the test harness reads the crate's parent directory

- **Fate.** WP30.
- **Class.** contradiction; sdkgen; per-language-copy; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/rust/ReadmeHowto_rust.ts:138`;
  `ts/project/.sdk/tm/rust/tests/common/mod.rs:119-123`
- **At head.** Present. `ReadmeHowto_rust.ts:138` reads 'Create a `.env.local`
  file at the crate root'; load\_env\_local() in `tm/rust/tests/common/mod.rs`
  pushes manifest\_dir(), '..', '.env.local'.
- **Fix.** Change the rust sentence to 'at the SDK repository root, beside the
  `rust/` crate (the harness reads `../.env.local`)', matching what the other
  targets' 'project root' means. Keep the harness as is.
- **Check.** New exact assertion in `ts/test/generate.test.ts` (or textguard):
  the rust README's .env.local location agrees with the path load\_env\_local
  builds; a relocated rust target is covered by V32's fix.

### V3. Six install sections print an empty code fence once their registry is active; root Packages table drops those rows

- **Fate.** WP10.
- **Class.** code-defect; sdkgen; helper; 2 source files; size s; changes
  generated documents.
- **Where.** `ts/src/helpers/packageMeta.ts:286-309`;
  `ts/src/cmp/ReadmeTop.ts:383-386`;
  `ts/project/.sdk/src/cmp/<t>/ReadmeInstall_<t>.ts` (c:30, csharp:11,
  ocaml:11, perl:17, rust:13, zig:11)
- **At head.** Present. installCommand's switch covers ts, js, py, py-data,
  php, rb, lua, go and returns '' otherwise; the six ReadmeInstall copies
  print \${installCommand(...)} inside a \`\`\`bash fence whenever
  isPublished; ReadmeTop's Packages loop does `if (!cmd) return`, dropping the
  row.
- **Fix.** In packageMeta.installCommand add the registry commands for the
  remaining published origins (rust `cargo add <pkg>`, csharp `dotnet add
  package <pkg>`, perl `cpanm <pkg>`, ocaml `opam install <pkg>`), and for an
  origin with no registry command (c, zig) fall back to vendorCommand rather
  than ''. In ReadmeTop, when the command is empty print the 'build from
  source' cell instead of returning, so a row is never dropped. Neutral only:
  the six copies then print a real command with no copy change.
- **Check.** New cases in `ts/test/helpers.test.ts`: installCommand is
  non-empty for every bundled origin with publish.registry.state active; a
  ts/test/readmetop test that the Packages table has one row per active
  target; the section-8 'no table header without rows'/empty-fence exact
  check.

### V4. js README prints `npm install ${target.module.name}` (the slug) in a js-tagged fence, not packageName

- **Fate.** WP35.
- **Class.** code-defect; sdkgen; per-language-copy; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/js/ReadmeInstall_js.ts:9-13`;
  `ts/project/.sdk/model/target/js.aontu:7`;
  `ts/project/.sdk/src/cmp/js/Package_js.ts:68`
- **At head.** Present. `ReadmeInstall_js.ts` emits '```js' then `npm install
  ${target.module.name}` (module.name is '$$name$$'); Package_js writes name:
  packageName(model, target.name); ts's ReadmeInstall_ts uses installCommand
  in a ```bash fence.
- **Fix.** Make ReadmeInstall\_js match ReadmeInstall\_ts: \`\`\`bash fence
  with \${installCommand(model, target.name)}.
- **Check.** Section-7 fence check (fence tag is the target's language or
  neutral) and a `generate.test.ts` assertion that the published-js README
  install line equals installCommand(model,'js').

### V5. py README layout tree shows a flat `<name>_sdk.py` and py/core/; Main\_py writes a package directory `<name>_sdk/`

- **Fate.** WP37.
- **Class.** code-defect; sdkgen; per-language-copy; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/py/ReadmeExplanation_py.ts:16-30`;
  `ts/project/.sdk/src/cmp/py/Main_py.ts:48,62-75,206-230`
- **At head.** Present. ReadmeExplanation\_py prints `py/ ├── <name>_sdk.py --
  Main SDK module ... ├── core/`; Main\_py sets pkgdir =
  Name.toLowerCase()+'\_sdk' and writes `__init__.py`, config, core/, entity/,
  feature/, utility/ inside Folder({name: pkgdir}). The same tree also carries
  'Built-in features (Base, Test, Log)'.
- **Fix.** Rewrite the tree to the generated layout:
  `py/<name>_sdk/__init__.py` (main module), with `config.py`, `schema.py`,
  `features.py`, core/, entity/, feature/, utility/ under it, and test/ beside
  it; drop the '(Base, Test, Log)' list (the S-row fix for that phrase). Say
  the main module is the package `<name>_sdk`.
- **Check.** `generate.test.ts` assertion that every path named in the py
  module-structure block exists in the generated py tree (a reusable 'layout
  block names written paths' check for every `ReadmeExplanation_<lang>`).

### V6. clojure README example namespace uses the SDK name where an entity name belongs: sdk.entity.&lt;sdk name>

- **Fate.** WP37.
- **Class.** code-defect; sdkgen; per-language-copy; 1 source file; size xs;
  changes generated documents.
- **Where.**
  `ts/project/.sdk/src/cmp/clojure/ReadmeExplanation_clojure.ts:34-35`;
  `ts/project/.sdk/src/cmp/clojure/Entity_clojure.ts:27-31`
- **At head.** Present. The example is
  `[sdk.entity.${model.const.Name.toLowerCase()} :as e-...]`; Entity\_clojure
  writes `src/sdk/entity/<entity.name>.clj`.
- **Fix.** Take the first active entity (getModelPath(model,
  `main.${KIT}.entity`)) and print `[sdk.entity.<entity ns> :as e-<entity>]`
  with the namespace form of entity.name; write no example sentence when there
  is no active entity.
- **Check.** `generate.test.ts`: the clojure README's example namespace names
  an entity file the run wrote (`src/sdk/entity/<name>.clj`).

### V7. go-cli and go-mcp derive the env prefix per character, diverging from envToken for doubled or edge separators

- **Fate.** WP36.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 2 source files; size
  s; changes generated documents and code.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:66,402-403`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:154,459-460`;
  `ts/src/helpers/packageMeta.ts:398-405`
- **At head.** Present. Both Main files compute
  String(model.name).toUpperCase().replace(/\[^A-Z0-9\]/g,'\_') for projUpper,
  APIKEYENVVAR and BASEENVVAR; envToken uses /\[^A-Z0-9\]+/g and trims
  leading/trailing underscores, so 'acme--x' gives ACME\_\_X vs ACME\_X. The
  token is what os.Getenv reads, so it is a behaviour difference, not only
  wording.
- **Fix.** Replace the five inline derivations with envName(model) (already
  exported from `@voxgig/sdkgen`), per the agent guide's 'derive an env-var
  name with envToken/envName' rule.
- **Check.** A test in `ts/test/generate.test.ts` with a slug containing a
  doubled and an edge hyphen: go-cli and go-mcp env names equal envName(model)
  and equal the go SDK's. Optionally a lint test that no component calls
  toUpperCase().replace(/\[^A-Z0-9\]/g on model.name.

### V8. docgen: go 'Not published' vs README go get; py import slug differs; MCP tools ignore tool.write; deck counts p.active

- **Fate.** WP26a.
- **Class.** duplicated-rule; docgen; other; 2 source files; size s; changes
  generated documents. Needs: targetSurface.
- **Where.** docgen `ts/src/content.ts:160-166` (surface table, installation),
  :626 (route count uses p.active); docgen `ts/src/sdk-reference.ts:9-11`
  (pyModule), :24-31 (toolContracts); sdkgen
  `ts/src/helpers/mcpTools.ts:22-29`;
  `ts/project/.sdk/src/cmp/py/Main_py.ts:48`
- **At head.** Present. docgen 9ca5221: installation() prints 'Not published.
  Build from the `<t>` directory.' whenever !isPublished (go is never
  published, while sdkgen's README prints the vendor go get); exampleValues
  builds pyModule as model.name.replace(/-/g,'\_')+'\_sdk' while Main\_py uses
  Name.toLowerCase()+'\_sdk'; toolContracts hard-codes \['list','load'\] while
  sdkgen's exported mcpTools adds write tools under tool.write; markedSlides
  filters points with `false !== p.active` while every other site uses `p.a
  !== false`.
- **Fix.** In docgen: installation() uses sdkgen's installCommand for every
  target (which already returns the vendor command when unpublished); pyModule
  calls the same rule Main\_py uses (export a pyPackageName helper from sdkgen
  beside packageName, or use model.const.Name.toLowerCase()+'\_sdk');
  toolContracts calls sdkgen's exported mcpTools(model, target.name); the
  deck's route count filters on `p.a !== false`; the surface table is replaced
  by sdkgen's targetSurface once exported.
- **Check.** docgen tests: a published/unpublished go target matches sdkgen's
  README install line; a hyphenated slug's py import equals the generated
  package dir; tool.write: true lists create/update/patch/remove tools; route
  count equals the summary's.

### V9. Pack lean intro lists six verbs as a literal; dart and haskell 'live alongside' literal now removed

- **Fate.** WP41.
- **Class.** stale-mention; sdkgen-langpack; per-language-copy; 1 source file;
  size xs; changes generated documents.
- **Where.** `.sdk/src/cmp/lean/ReadmeIntro_lean.ts:7-10`
- **At head.** Present, in a different form or place than first recorded. At
  c6069bb ('Write only each target's own introduction, in sdkgen 4.43.0's
  frame') the dart and haskell intros export only ReadmeIntroBody and no
  longer carry 'Other languages, the CLI, and MCP server live alongside this
  one' (the neutral frame's alongsideNote writes it). lean's body still
  hard-codes `list`, `load`, `create`, `update`, `patch`, `remove`.
- **Fix.** In the pack's lean ReadmeIntroBody, build the verb list from
  introOps(model) as dart's does, and write no verb sentence when it is empty.
  Pack release after sdkgen exports nothing new (introOps already exported at
  the pack's floor >=4.43.0).
- **Check.** The pack's own README suite: a fixture with a list-only entity
  yields only `list` in the lean intro; off relation when the pack runs the
  guard (DQ4).

### V10. Deploy emits `$(MAKE) -C <t> publish` for registry-active targets; clojure, elixir, ocaml, scala, zig Makefiles have no publish rule

- **Fate.** WP35.
- **Class.** code-defect; sdkgen; neutral-component; 1 source file; size s;
  changes generated code.
- **Where.** `ts/src/cmp/Deploy.ts:141-145`; `ts/project/.sdk/tm/<t>/Makefile`
  (clojure, elixir, ocaml, scala, zig)
- **At head.** Present. `Deploy.ts`'s final branch returns `deploy-<t>: boru
  vault exec ... -- $(MAKE) -C <t> publish`; grep of the five Makefiles finds
  no `publish:` target (rules are test/build/clean/lint etc.), though each
  target model declares a publish block.
- **Fix.** Neutral: Deploy emits the `-C <t> publish` recipe only for a target
  whose template declares one; otherwise it emits the tag-only recipe with an
  echo naming the missing registry publish. Declare it as a target capability
  (e.g. a `publish.recipe: true` slot, or the existing `publish.tag.via`), not
  a key list. Writing publish rules for the five is separate target work.
- **Check.** New ts/test/deploy test: for every bundled target with registry
  state active, the generated root Makefile's deploy recipe names only a rule
  present in `tm/<t>/Makefile`.

### V11. Operation-level active:false is ignored by every entity code generator; the op is still generated and callable

- **Fate.** Repeats G05 and is resolved with it in WP21.
- **Class.** code-defect; sdkgen; neutral-component; 1 source file; size s;
  changes generated documents and code. Needs: DQ1; guardModel.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/Entity_<lang>.ts` (ts:41-66,
  clojure:33-45); `ts/src/utility.ts:301`; `ts/src/helpers/flowGuard.ts`
- **At head.** Present. `Entity_ts.ts` builds opnames from
  Object.keys(entity.op || {}) without reading `op.<o>.active`, as do the
  siblings (clojure Entity reads the same keys); G05 measured it in all 20
  targets.
- **Fix.** Under DQ1's recommendation: a neutral pre-pass before Root (inside
  guardModel, `ts/src/sdkgen.ts`) removes any op with active:false, so every
  per-language Entity sees it absent; schema declares `op: &: active: *true |
  boolean` (no comment, density limit); flowGuard reports a dropped step as
  info. No per-language copy changes.
- **Check.** Prototype result: output identical to a never-declared op in five
  states; add a `generate.test.ts` case (op-off) asserting no remove
  method/type in any target, and the off relation over op removal. If DQ1 is
  answered the other way (the switch is documentation-only), the introductions
  must stop honouring it instead.

### V12. A target copy older than `provides` reads provides:{}, silently dropping features that need tags; only an info log

- **Fate.** WP11.
- **Class.** code-defect; sdkgen; neutral-component; 0 source files; size xs;
  changes nothing in generated output.
- **Where.** `ts/src/helpers/applicability.ts:18-28`;
  `ts/src/cmp/Feature.ts:18-28`
- **At head.** Present. featureApplies returns false when feature.needs is
  non-empty and target.provides lacks it; `Feature.ts` logs point
  'feature-not-applicable' at log.info and returns, and targetFeatures drops
  it from Config/Main, so an ACTIVE feature vanishes from SDK and docs with no
  warning.
- **Fix.** When an ACTIVE feature does not apply to an active target, log.warn
  (house form, point 'feature-not-applicable') naming the unmet tags, and when
  the target resolves to a bundled origin whose shipped file now provides
  them, name `voxgig-sdkgen package update` / `target add <t>` as the fix.
  Doctor already files the stale copy as outdated; the warning is the
  generate-time signal.
- **Check.** Unit test with an old ts target file (no provides) plus validate
  active: generate warns once with the remedy; a test in ts/test/feature-tags
  (applicability) that an active non-applicable feature produces a warn, not
  info.

### V13. isConsumer requires all five phase flags off, so a pre-agentguide consumer copy is listed as an SDK language

- **Fate.** WP13.
- **Class.** duplicated-rule; sdkgen; neutral-component; 0 source files; size
  s; changes generated documents. Needs: targetSurface; DQ2.
- **Where.** `ts/src/helpers/alongside.ts:4-10,20-24`;
  `ts/src/cmp/ReadmeTop.ts:146-172`
- **At head.** Present. PHASES =
  \['entity','feature','readme','agentguide','test'\] and isConsumer needs
  every one false; ReadmeTop and alongsideNote classify by isConsumer plus
  literal 'go-cli'/'go-mcp' keys. The v1.3.7 go-cli copy that would trigger it
  no longer parses (design note section 5), so the hazard is latent.
- **Fix.** Replace isConsumer and the quoted keys with targetSurface (slot,
  else LEGACY\_SURFACE by origin, else 'sdk' for an entity-generating target,
  else unknown); delete isConsumer. A four-flag copy is then classed by its
  origin, not its phase flags.
- **Check.** Unit tests of targetSurface over an old four-flag consumer file
  and an alias of go-cli; the off relation with surface words; design case 14.

### V14. A target with no `title` prints '\# `<Name>` undefined SDK' and joins undefined into the root tagline

- **Fate.** WP15.
- **Class.** code-defect; sdkgen; neutral-component; 0 source files; size s;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeIntro.ts:26`;
  `ts/src/cmp/ReadmeTop.ts:178,226,360,398`; `ts/model/sdkgen.aontu:85-100`
- **At head.** Present. ReadmeIntro writes `# ${model.Name} ${target.title}
  SDK`; ReadmeTop maps sdkTargets to t.title; the target schema block
  (`sdkgen.aontu:85-100`) declares no title slot, so a third-party or
  hand-written target can omit it.
- **Fix.** Add a targetTitle(model, name) derivation beside originName in
  packageMeta (target.title, else langLabel(origin), else the key) and use it
  at every title site in ReadmeIntro and ReadmeTop; package check
  (`modelcheck.ts`) warns on a target without title.
- **Check.** `ts/test/model-compile.test.ts` / modelcheck test for the
  warning; a generate test with a title-less target: no 'undefined' in any
  document (add 'undefined' to the section-7 exact checks).

### V15. Schema hook list omits PrePoint, PreDone, PreUnexpected, SetMatch and names unused PreTarget, PostOperation; misspellings unify

- **Fate.** WP08.
- **Class.** code-defect; sdkgen; model-schema; 1 source file; size s; changes
  generated documents.
- **Where.** `ts/model/sdkgen.aontu:233-246`;
  `ts/src/cmp/AgentGuideFeature.ts:26-29`; `docs/reference/hooks.md:23-45`
- **At head.** Present. The hook block lists PostConstruct,
  PostConstructEntity, SetData, GetData, GetMatch, PreTarget, PreSpec,
  PreRequest, PreResponse, PreResult, PostOperation; bundled feature models
  declare PreDone(6), PrePoint(6), PreUnexpected(5), SetMatch(2); `hook: &:`
  accepts any name, and AgentGuideFeature lists every active hook name as a
  stage.
- **Fix.** Make the schema list the hooks the pipeline fires (add SetMatch,
  PrePoint, PreDone, PreUnexpected; remove PreTarget, PostOperation) without
  adding comment lines; add a modelcheck rule (package check) that reports a
  feature hook name outside that list; correct `docs/reference/hooks.md` to
  the same list.
- **Check.** New test in `ts/test/featuremodel.test.ts`: the schema hook names
  equal the hook names fired in tm/ts runtime and every bundled feature's
  hooks are in it; `model-compile.test.ts` for the new modelcheck error.

### V16. Schema comment says a plugin's `needs` is refused at generation when unmet; no code refuses anything

- **Fate.** WP08.
- **Class.** stale-mention; sdkgen; model-schema; 1 source file; size xs;
  changes nothing in generated output.
- **Where.** `ts/model/sdkgen.aontu:212-215`;
  `ts/project/.sdk/src/cmp/ocaml/Config_ocaml.ts:81`
- **At head.** Present. The comment reads 'Declared so a target that cannot
  provide it is refused at generation rather than at the consumer's first
  lookup'; the only reader of plugin.needs is `Config_ocaml.ts:81` (TLS
  grouping).
- **Fix.** Reword the two comment lines in place (same line count, comment
  gate at its density limit) to say what is true: the runtime needs a plugin
  declares, read today only by ocaml to group TLS. Implementing refusal is a
  separate feature.
- **Check.** make comments comments-test stays green; no behaviour test
  needed.

### V17. Twelve PrepareAuth generators carry a local isAuthActive-named copy of the suppression test instead of isAuthSuppressed

- **Fate.** WP28.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 12 source files; size
  m; changes nothing in generated output. Needs: DQ11.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/PrepareAuth_<lang>.ts` (go:312,
  py:332, c:38 authSwitchedOn, js:246; also clojure, cpp, csharp, elixir,
  ocaml, php, rb, zig)
- **At head.** Present. 8 of 20 PrepareAuth components import
  isAuthSuppressed; the other 12 each define a local function
  (`isAuthActive_go/_py/_js/_zig`, authSwitchedOn in c, etc.) computing !(auth
  &amp;&amp; false === auth.active), which is suppression, not
  `ts/src/utility.ts` isAuthActive (which also reads info.auth).
- **Fix.** In the copy wave, replace each local function with
  `!isAuthSuppressed(model)` imported from `@voxgig/sdkgen` (already exported
  at every supported floor). If DQ11 is answered toward 'info.auth false means
  no auth code', the change is to the one exported predicate, not twelve
  copies.
- **Check.** A test in ts/test (e.g. cleancoverage-style scan) that no
  `PrepareAuth_<lang>.ts` defines a function reading config.auth.active;
  generated PrepareAuth output byte-identical before and after (characterize
  first).

### V18. Config generators derive auth and server blocks twice (configDefinition and inline); ts data form lacks auth `in`/`name`

- **Fate.** WP28.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 20 source files; size
  m; changes generated code.
- **Where.** `ts/project/.sdk/src/cmp/ts/Config_ts.ts:52-73`;
  `ts/src/utility.ts:387-389`;
  `ts/project/.sdk/src/cmp/perl/Config_perl.ts:67`
- **At head.** Present. Config\_ts builds authBlock (with in/name when
  non-default) and serverBlock inline, and also calls configDefinition, whose
  options.auth is {prefix, basic} only; with repr 'data' (or >256 KiB) the
  data form omits in/name. Runtime placement is baked into PrepareAuth from
  the model, so the omission is inert today, which is why every variation
  agreed.
- **Fix.** Make configDefinition's options.auth carry in/name exactly as the
  literal does, then have each `Config_<lang>` render its literal auth/server
  blocks from configDefinition's options instead of re-deriving them (one
  derivation). Neutral part first (`utility.ts`), per-language part in the
  copy wave.
- **Check.** Test that for every target and auth state the literal Config and
  the data Config carry the same auth/server values (parse both); golden
  unchanged for header/Authorization SDKs.

### V19. With info.auth:false and no config.auth the SDK still accepts and places an apikey; docs say no auth

- **Fate.** Repeats G04 and is resolved with it in WP28.
- **Class.** contradiction; sdkgen; helper; 1 source file; size m; changes
  generated code. Needs: DQ11; requiredOptions.
- **Where.** `ts/src/utility.ts:24-32` vs :48-52;
  `ts/project/.sdk/tm/ts/src/utility/MakeOptionsUtility.ts:18`;
  `ts/model/sdkgen.aontu:274-280`; 12 local copies (V17)
- **At head.** Present. isAuthActive is false under info.auth:false (documents
  and Config drop auth), but the PrepareAuth generators gate on suppression
  only (config.auth.active false), so the placing code is emitted; MakeOptions
  treats only an explicit options.auth === null as suppressed and the optspec
  default supplies an auth block. Runtime behaviour is a source reading (map
  DQ22), not executed.
- **Fix.** Decide which fact both sides follow (DQ11). Recommended: info.auth
  false with no config.auth means no auth code, so PrepareAuth's gate becomes
  !isAuthActive (one exported predicate) and documents keep following
  isAuthActive; requiredOptions then omits apikey consistently.
- **Check.** G04's two runs (auth-off vs auth-inactive) must produce identical
  PrepareAuth and TestClean files; add as a `generate.test.ts` case.

### V20. A generated, documented `patch` method is called by no generated flow test; test vocabulary has five ops

- **Fate.** WP39.
- **Class.** test-gap; sdkgen; helper; 21 source files; size l; changes
  generated code. Needs: DQ12.
- **Where.** `ts/src/helpers/flowGuard.ts:18`;
  `ts/project/.sdk/src/cmp/<lang>/TestEntity_<lang>.ts` (ts, go; none of 20
  mention patch)
- **At head.** Present. flowGuard GENERATED =
  \['create','list','load','update','remove'\] while BY\_ID and STORES include
  patch; grep finds 'patch' in none of the 20 TestEntity components.
- **Fix.** Answer DQ12 (one operation vocabulary with an owner). If patch is
  flow-tested: add patch to GENERATED and a patch step emitter in every
  `TestEntity_<lang>` (copy wave, all 20, packs after). If not, state it in
  the agent guide and warn once per run, as warnUngeneratedOps does.
- **Check.** `generatedcompile.test.ts` lane with a fixture entity that has
  patch: the flow test calls it in every lane; `generate.test.ts` fixture
  gains a patch op.

### V21. rust and perl Makefiles say 'tag-only for now (registry publish pending)' whatever the model's registry state

- **Fate.** WP35.
- **Class.** stale-mention; sdkgen; template; 2 source files; size xs; changes
  generated code.
- **Where.** `ts/project/.sdk/tm/rust/Makefile:12-15`;
  `ts/project/.sdk/tm/perl/Makefile:25-28`;
  `ts/project/.sdk/tm/c/Makefile:271-274`
- **At head.** Present, in a different form or place than first recorded.
  rust's header claims `cargo publish` starts when the registry state flips to
  active, but the recipe below only tags; perl says the CPAN entry is pending
  and publish is tag-only. c's Makefile says 'C has no central registry —
  publishing IS the git tag', which matches `c.aontu` (registry name 'none'),
  so c is not a defect.
- **Fix.** Templates must not state model state (design rule 5): replace the
  rust and perl comments with a model-independent sentence ('publish builds
  and tags; registry upload is not implemented in this template'), and let
  Deploy (V10) route a registry-active target without an upload recipe to
  tag-only with an echo. Drop c from this item.
- **Check.** off relation over registry state; the V10 deploy test covers
  rust/perl with registry active.

### V22. Feature model descriptions make model-dependent claims ('streaming of list results', 'for list operations') docgen prints as its own prose

- **Fate.** WP26b.
- **Class.** stale-mention; sdkgen; target-or-feature-model; 20 source files;
  size s; changes generated documents. Needs: DQ21; featureOnByDefault.
- **Where.** `ts/project/.sdk/model/feature/<name>.aontu:6` (streaming,
  idempotency, paging, secrets; 20 files); docgen
  `ts/src/content.ts:271,592-595`
- **At head.** Present. All 20 feature models carry a fixed description at
  line 6; docgen lists them via prose(f.description) in SUMMARY and the
  feature pages. The same docgen feature page (`content.ts:594`) also says
  'features are off by default', false for log.
- **Fix.** Answer DQ21. Recommended: treat a feature description as a
  definition of the feature, not a claim about this API, and have docgen list
  a feature only when it applies (targetFeatures) and, for streaming/paging,
  when a list op exists; replace docgen's 'features are off by default' with
  featureOnByDefault per feature. Rewording 20 model files is a copy change
  and is avoided.
- **Check.** docgen test: a model with no list op omits or qualifies
  streaming/paging; a log-on model's feature page does not say it is off.

### V23. apidef writes its own sentences into vendor slots ('The `<title>` API.', base-URL variable text); docgen quotes them as vendor words

- **Fate.** WP06.
- **Class.** vendor-text; apidef; other; 2 source files; size s; changes
  generated documents.
- **Where.** apidef `ts/src/transform/top.ts:129,169-176` (ensureDescription);
  docgen `ts/src/content.ts:186`
- **At head.** Present. apidef 3058271: ensureDescription synthesises 'The
  `<title>` API.' or 'Client SDK for this API.' into info.description, and the
  server variable gets 'The base URL of the API, which its definition does not
  name.'; docgen renders v.description through quote().
- **Fix.** apidef records that the text is its own (e.g. info.synth: {
  description: true }, mirrored in the Go port and both model mirrors), and
  docgen renders a synthesised description through prose() rather than
  quote(); sdkgen's ReadmeTop needs no change.
- **Check.** apidef tsv/unit test for the provenance flag in both ports;
  docgen QA test that a synthesised description counts as own text.

### V24. 'generated from the OpenAPI spec/specification' is written for a model apidef built from a GraphQL schema

- **Fate.** WP15.
- **Class.** stale-mention; sdkgen; neutral-component; 4 source files; size s;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeTop.ts:112,233,660,701,704,737`;
  `ts/src/cmp/Changelog.ts:24`; `ts/src/cmp/AgentGuideContent.ts:249`; docgen
  `ts/src/content.ts:535`
- **At head.** Present. Lines moved from the map (ReadmeTop 112, 687 -> 112,
  233, 660, 701, 704, 737); the model records the definition kind only per
  point (k: 'graphql', `helpers/graphqlPoint.ts:6`), and none of these sites
  reads it.
- **Fix.** Add a definitionKind(model) derivation beside pointIsGraphql
  ('openapi' | 'graphql' | '' from the points' k) and write 'API definition'
  (or the named kind when known) at each site; docgen calls the exported
  derivation.
- **Check.** Text-guard variation with a GraphQL point: off relation finds no
  'OpenAPI'; unit test of definitionKind.

### V25. docgen treats the vendor title as own prose and project `text.summary/entity_desc` as vendor quotes

- **Fate.** WP05b.
- **Class.** tooling-defect; docgen; other; 1 source file; size xs; changes
  generated documents.
- **Where.** docgen `ts/src/content.ts:157-158` (title, description), :186
  (prose(v.title), quote(v.description)), :197-198 (entity\_desc quoted)
- **At head.** Present. view() sets title from info.title (vendor) and
  description from kit.text.summary first; the summary renders prose(v.title)
  and quote(v.description), and an entity's text.entity\_desc goes through
  quote().
- **Fix.** Classify by source: vendor title through quote/quoteInline,
  project-authored main.kit.text values (summary, entity\_desc) through
  prose() so house style applies; vendor info.description stays quoted.
- **Check.** docgen qa test: a style violation in text.summary is reported;
  one in info.title is not.

### V26. docgen's QA strips every occurrence of a quoted phrase's words from own text ('OK', 'Created' vanish)

- **Fate.** WP05b.
- **Class.** tooling-defect; docgen; other; 1 source file; size s; changes
  nothing in generated output.
- **Where.** docgen `ts/src/qa.ts:33-47` (authored)
- **At head.** Present. authored() builds a regex from each quote's words and
  replaces with the global flag across the whole page text, so a quoted 'OK'
  removes every 'OK' in docgen's own sentences from the house-style input.
- **Fix.** Remove a quote only at the spans where it was emitted: carry the
  existing quote markers (the marked/unmark path `content.ts` already uses for
  slides) through to QA and strip marked spans, instead of matching words
  globally.
- **Check.** docgen qa test: a page quoting 'OK' still feeds an own sentence
  containing 'OK' to the house-style text.

### V27. A union-typed feature option without default prints 'number | map' raw into a two-column table

- **Fate.** WP18.
- **Class.** code-defect; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: mdCell.
- **Where.** `ts/src/cmp/ReadmeRefFeatures.ts:95-96`;
  `ts/src/cmp/FeatureDocs.ts:30-35`
- **At head.** Present. sentinelName joins union members with ' | ';
  ReadmeRefFeatures writes `| \`\${o.name}\\` | ${o.type} |` with no escaping.
  Latent: no bundled feature has a defaultless union option.
- **Fix.** Pass o.type (and every other cell) through mdCell from the new
  `helpers/markdown.ts`.
- **Check.** Section-8 table check (every row ends as its header) on every
  generate; a FeatureDocs unit test with a union optspec.

### V28. output.create:false over a missing folder: target silently not generated, absent from root README, listed by docgen; INFO only

- **Fate.** WP23.
- **Class.** code-defect; sdkgen; neutral-component; 1 source file; size s;
  changes generated documents. Needs: DQ3; targetPlace.
- **Where.** `ts/src/sdkgen.ts:390-409` (docgen call, skip loop), :793-802
  (externalSkipReason)
- **At head.** Present. externalSkipReason and the post-preflight check log
  the skip with log.info; docgen.generate receives the full model while the
  in-tree pass omits the target.
- **Fix.** Log the skip with log.warn (house form, point
  'generate-external-skip'), and make ReadmeTop and docgen read one target
  set: under DQ3's recommendation committed documents follow the declared
  layout, so both list the target (targetPlace 'external'); if DQ3 goes the
  other way, docgen receives the same filtered set.
- **Check.** A `sdkgen.ts` test with create:false over a missing folder: one
  warning, and the root README and docgen SUMMARY agree on the target list.

### V29. An unknown key in SDKGEN\_EXTERNAL is logged as 'overrides the output of' and changes nothing

- **Fate.** WP11.
- **Class.** code-defect; sdkgen; neutral-component; 1 source file; size xs;
  changes nothing in generated output.
- **Where.** `ts/src/sdkgen.ts:723-737`
- **At head.** Present. The parser merges every parsed key and logs
  'SDKGEN\_EXTERNAL overrides the output of: `<keys>`' without checking them
  against model targets; externalItems only visits model items, so a key like
  'tss' is dropped.
- **Fix.** After parsing, reject a key that names no target or item in the
  model with SdkGenError ('SDKGEN\_EXTERNAL names tss, which is not a target
  of this model'), as invalid JSON already is; log only the keys that matched.
- **Check.** Unit test in ts/test (external override tests) with an unknown
  key: generate throws naming it.

### V30. An aliased target's model file is written once and never revisited by add, update, doctor exit code or generate

- **Fate.** WP13.
- **Class.** code-defect; sdkgen; neutral-component; 1 source file; size s;
  changes generated documents. Needs: targetSurface; DQ2.
- **Where.** `ts/src/action/kind.ts:171-195`;
  `ts/src/action/doctor.ts:889,409,447`
- **At head.** Present. kindModel excludes the file when aliased and
  ownedWhenAliased (existing file kept, info log); doctor pushes differences
  to aliasedDiff, which does not count toward report.ok. This is a documented
  decision in `AGENTS.md`, but it means new slots (provides, surface) never
  reach an alias.
- **Fix.** Keep the ownership rule; make every derivation that a newer slot
  feeds read the alias's origin through origname (targetSurface's
  LEGACY\_SURFACE step; featureApplies falling back to the origin's provides
  when the alias file has none), and have doctor name an aliased file that
  lacks a slot its origin now declares as 'aliased-behind' with the slot
  names, still outside report.ok.
- **Check.** Doctor test with an alias of go-cli lacking surface/provides:
  reported as aliased-behind; generate classifies it by origin.

### V31. target add reads feature.trim from the source package file compiled alone, ignoring the project's own value

- **Fate.** WP11.
- **Class.** code-defect; sdkgen; neutral-component; 1 source file; size xs;
  changes generated code.
- **Where.** `ts/src/action/target.ts:510-595` (trimFeatures,
  readTargetFeature); `ts/src/helpers/featureSource.ts:161-165`
- **At head.** Present. readTargetFeature compiles
  definitionPathAny(tfolder,'target',torigname) alone with a fresh Aontu;
  inactiveFeatureExcludes at generate time reads target.feature.trim from the
  project's compiled model, so a project override is honoured at generate and
  ignored at add.
- **Fix.** In readTargetFeature prefer the project's compiled value
  (ctx\$.model `main.kit.target.<tname>.feature`.{trim,fullset}) when the
  project declares it, falling back to the source file; one function used by
  both add and generate.
- **Check.** Action test: a project declaring trim:false for ts gets the full
  feature source on target add.

### V32. Path from a target back to .sdk is a literal in 54 template files and 15 components; out-of-tree targets miss the corpus

- **Fate.** WP32.
- **Class.** code-defect; sdkgen; template; 69 source files; size l; changes
  generated code. Needs: targetPlace; DQ22.
- **Where.** `ts/project/.sdk/tm/ts/test/utility/index.ts:3`;
  `ts/project/.sdk/src/cmp/ts/TestEntity_ts.ts:162-164`; 54 files under
  `ts/project/.sdk/tm`, 15 under `ts/project/.sdk/src/cmp`
- **At head.** Present. grep at head: 54 tm files and 15 src/cmp files contain
  '`../.sdk`' style literals (map said 58 templates); TEST\_JSON\_FILE =
  '`../../.sdk/test/test.json`', TestEntity\_ts resolves
  '`../../../../.sdk/test/entity/`...'. ExternalTarget computes sdkrelpath for
  out-of-tree passes but nothing feeds it to these files. Run-time failure is
  a source reading (map DQ22).
- **Fix.** Add an SDKREL replace token to stdrep (computed per pass from
  targetPlace and externalSdkRel; '..' in tree) and a sdkRel(ctx\$, target)
  helper for components; replace the literals in the copy wave (helper arrives
  as a new file). Template change is copies-heavy and belongs to the one wave.
- **Check.** `generatedcompile.test.ts` lane with ts generated out of tree:
  the corpus runner prints '`feature.<name>`: ran N of M case(s)'; link
  relation on cd/paths.

## U. Suspected, and now checked (U01 to U108)

Recorded as suspicions during the survey and read against the code for the
plan. Five turned out not to be defects and one could not be settled by
reading.

### U01. alongsideNote finds 'the CLI' and 'the MCP server' only by the keys go-cli and go-mcp; aliases and packaged surfaces are missed

- **Fate.** WP13.
- **Class.** duplicated-rule; sdkgen; neutral-component; 1 source file; size
  s; changes generated documents. Needs: targetSurface; DQ2.
- **Where.** `ts/src/helpers/alongside.ts:20-31`
- **At head.** Present. Opened `alongside.ts` at head: `has('go-cli')`,
  `has('go-mcp')`, and the langs filter excludes only those two literal keys;
  an alias (go-cli\~cli2) or a packaged CLI counts as 'Other languages' or as
  nothing.
- **Fix.** Replace the literal keys with targetSurface(model, name).surface
  ('cli'/'mcp'/'sdk'); an unknown surface names the target by its title and
  never as 'the CLI'. Delete isConsumer here once targetSurface exists.
- **Check.** New alias case in `ts/test/alias.test.ts` or
  `readmeintro.test.ts`: with go-cli installed as an alias, the sibling note
  still says 'the CLI'; text guard `off` relation with surface words.

### U02. Root README skips the MCP section, Surfaces CLI/MCP rows and docs order for an aliased or packaged CLI/MCP target

- **Fate.** WP13.
- **Class.** duplicated-rule; sdkgen; neutral-component; 1 source file; size
  s; changes generated documents. Needs: targetSurface; DQ2.
- **Where.** `ts/src/cmp/ReadmeTop.ts:146-147`;
  `ts/src/cmp/ReadmeTop.ts:153-165`; `ts/src/cmp/ReadmeTop.ts:433-452`
- **At head.** Present. At head hasCli/hasMcp test `t.name ===
  'go-cli'/'go-mcp'`, isCliOrMcp and orderOf use the same literals, and
  mcpWrite reads `target['go-mcp'].tool.write` (line 452), so an alias of
  go-mcp gets no MCP section and is listed as a consumer package row.
- **Fix.** Derive hasCli/hasMcp/isCliOrMcp from targetSurface; read tool.write
  from the installed key that targetSurface returned; the Surfaces table paths
  use the installed key, not the literal `go-cli/`.
- **Check.** Alias variation in the text guard (`off`/`reaction`), plus a
  `readme.test.ts` assertion that an aliased go-mcp yields the 'Use it from an
  AI agent (MCP)' section.

### U03. Root `AGENTS.md` LANG\_CMD build/test commands and surface notes are keyed by target name, so aliases fall to the default

- **Fate.** WP13.
- **Class.** duplicated-rule; sdkgen; neutral-component; 1 source file; size
  xs; changes generated documents. Needs: targetSurface.
- **Where.** `ts/src/cmp/AgentGuideContent.ts:18-37`
- **At head.** Present. LANG\_CMD is a Record keyed by
  'ts','go-cli','py-data', and langCmd(name) returns `{ viaMake: true }` for
  any other key, so go-cli\~cli2 loses 'A CLI surface, not an SDK client
  library.' and its go build line.
- **Fix.** Look up LANG\_CMD by originName(model, name); take the note from
  targetSurface (cli/mcp/data) rather than from the row.
- **Check.** `agentguide.test.ts`: aliased go-cli row carries the CLI note and
  `go build ./...`.

### U04. Release-tag literals name the original language: go README says `go/vX.Y.Z` and 15 Makefile templates hard-code TAG := `<lang>/v`

- **Fate.** WP35.
- **Class.** stale-mention; sdkgen; template; 16 source files; size m; changes
  generated documents and code. Needs: D29 release-tag rule.
- **Where.** `ts/project/.sdk/src/cmp/go/ReadmeInstall_go.ts:19`;
  `ts/project/.sdk/tm/<lang>/Makefile` (ts:27, go:26);
  `ts/src/cmp/Deploy.ts:218`
- **At head.** Present. go ReadmeInstall prints the literal `go/vX.Y.Z`;
  `tm/<lang>/Makefile` `TAG := ts/v$(VERSION)` is not a placeholder, while the
  root Makefile's tagPushRecipe tags `${alias}/v<version>`, so an aliased
  target cuts two different tags.
- **Fix.** Write `${target.name}/vX.Y.Z` in ReadmeInstall\_go; give the
  Makefile templates a placeholder for the target key (filled by
  templateReplacements at add and by stdrep at generate) instead of the
  language literal, so Makefile and Deploy agree. Better still, derive the tag
  in one helper beside releaseTag (D29).
- **Check.** `deploy.test.ts` and `alias.test.ts`: for go\~go2 the go2
  Makefile TAG and the root Makefile tag-push recipe name the same tag; parity
  across the 15 templates.

### U05. Aliased language gets the TypeScript error-handling and entity-state rows: wording tables indexed by target.name with a default row

- **Fate.** WP07.
- **Class.** wrong-language; sdkgen; neutral-component; 2 source files; size
  xs; changes generated documents.
- **Where.** `ts/src/cmp/ReadmeErrors.ts:212`;
  `ts/src/cmp/ReadmeExplanation.ts:225`
- **At head.** Present. Both read `LANGS[target.name] || DEFAULT_LANG`; LANGS
  has only py, php, rb, lua, go, so go\~go2 renders the TypeScript try/await
  row. Same defect as design note section 14 item 5.
- **Fix.** Key LANGS by originName(model, target.name) and drop the default
  row: a language with no row writes no section (design case 5, 'rows keyed by
  origin, no default row'). The non-JS half of the same table is X1.
- **Check.** Fence-tag exact check of design section 7 (a target's document
  carries only its language's or a neutral fence) under an alias variation;
  `readme.test.ts` assertion for go\~go2.

### U06. Aliased language documents every field type as `any`: 30 components pass target.name to canonToType

- **Fate.** Repeats N04 and is resolved with it in WP28.
- **Class.** wrong-language; sdkgen; per-language-copy; 30 source files; size
  m; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts` and
  `ReadmeRef_<lang>.ts` (`go/ReadmeEntity_go.ts:92`, `go/ReadmeRef_go.ts:206`)
- **At head.** Present. grep at head: 54 call sites of `canonToType(...,
  target.name)` in 30 files over 15 languages; canonToType
  (`ts/src/helpers/canonType.ts:143-165`) returns CANON\_ANY\[l\] ?? 'any' for
  an unknown language key. The code side (`EntityTypes_go.ts`) passes the
  language. Design note section 14 item 4.
- **Fix.** Pass the origin language (originName or the component's own literal
  language, as `EntityTypes_<lang>` does) to canonToType in all 30 files, in
  the one copy wave.
- **Check.** `canontype.test.ts` or `alias.test.ts`: generate go\~go2 and
  assert the REFERENCE field table shows `string`, not `any`; `parity`
  relation over the 15 languages.

### U07. docgen classes a packaged consumer (seneca-provider) as an SDK because its surface table names only go-mcp, go-cli, py-data

- **Fate.** WP26a.
- **Class.** duplicated-rule; docgen; other; 1 source file; size s; changes
  generated documents. Needs: targetSurface; DQ2; a surface word for
  seneca-provider.
- **Where.** `ts/src/content.ts:160-163`
- **At head.** Present. docgen surface() returns `doc.target.<t>.kind`, else a
  literal map of three origins, else 'sdk'; the infrapack seneca-provider
  target switches every phase off and is counted among 'SDK targets' in
  `SUMMARY.md` unless each project sets kind.
- **Fix.** docgen calls sdkgen's exported targetSurface (kind still first,
  design section 13) and treats an unknown surface as a companion tool named
  by title; infrapack declares `surface` once the closed vocabulary has a word
  for it.
- **Check.** docgen test: a model with seneca-provider staged lists it under
  'Companion tools', not in the SDK count.

### U08. Root README names a packaged consumer as 'the `<title>` package'

- **Fate.** Not a defect: "the &lt;title> package" is true; the disagreement
  is docgen's, U07 in WP26a.
- **Class.** contradiction; sdkgen; neutral-component; 1 source file; size xs;
  changes nothing in generated output. Needs: targetSurface.
- **Where.** `ts/src/cmp/ReadmeTop.ts:229`; `ts/src/cmp/ReadmeTop.ts:442-444`
- **At head.** Not a defect. seneca-provider has every phase off (infrapack
  `.sdk/model/target/seneca-provider.aontu`) so isConsumer is true and
  ReadmeTop writes 'the Seneca Provider package' and a Surfaces row; it is an
  npm package, so the sentence is true. The defect is only that docgen
  disagrees (U07).
- **Fix.** No change of its own; the disagreement goes when both read
  targetSurface.
- **Check.** none beyond U07

### U09. lean options table is a fixed five rows naming Bearer and the authorization header whatever the API's auth

- **Fate.** WP41.
- **Class.** stale-mention; sdkgen-langpack; per-language-copy; 1 source file;
  size xs; changes generated documents.
- **Where.** `.sdk/src/cmp/lean/ReadmeOptions_lean.ts:5-17`
- **At head.** Present. Opened at c6069bb: a literal table, `apikey |
  Bearer/api key, sent via the authorization header`, with no isAuthActive or
  placement read.
- **Fix.** Write the apikey row only when isAuthActive, and describe placement
  from the model's auth (in/name/prefix, D54), as the bundled ReadmeOptions
  do; omit server rows (lean has none, design section 13).
- **Check.** Pack test (`langpack.test.js`) under auth-off and query-placement
  variations; the guard's `off` relation when the pack runs it (DQ4).

### U10. lean quick start reads the API key from the bare `<ENV>` variable instead of `<ENV>_APIKEY`

- **Fate.** WP41.
- **Class.** code-defect; sdkgen-langpack; per-language-copy; 1 source file;
  size xs; changes generated documents.
- **Where.** `.sdk/src/cmp/lean/ReadmeQuick_lean.ts:26`
- **At head.** Present. `IO.getEnv "${envName(model)}"` where every bundled
  quick start uses `${envName(model)}_APIKEY` (`ts/ReadmeQuick_ts.ts:38`).
- **Fix.** Use `${envName(model)}_APIKEY`, or
  requiredOptions(model).apikey.env once it exists.
- **Check.** Pack README example test, or a `langpack.test.js` string
  assertion against the env name the bundled targets use.

### U11. lean seed example path `../.sdk/test/entity/`... assumes the build phase ran and the in-tree layout

- **Fate.** WP41.
- **Class.** dangling-link; sdkgen-langpack; per-language-copy; 1 source file;
  size xs; changes generated documents. Needs: targetPlace; DQ3.
- **Where.** `.sdk/src/cmp/lean/ReadmeHowto_lean.ts:18`
- **At head.** Present. Literal `../.sdk/test/entity/<e>/<E>TestData.json`;
  that file exists only with main.kit.phase.build on and only when the target
  sits one folder below the project.
- **Fix.** Write the path from the target's sdkrel/targetPlace and only when
  phase.build is on; otherwise drop the seed sentence.
- **Check.** `link` relation (a path in a document that does not resolve) once
  the pack runs the guard; build-phase-off variation.

### U12. lean root-README test stanza names 'retry, cache, rbac, netsim' in the feature catalog

- **Fate.** Not a defect: lean declares trim: false, so its feature catalogue
  is always present.
- **Class.** stale-mention; sdkgen-langpack; per-language-copy; 1 source file;
  size xs; changes nothing in generated output.
- **Where.** `.sdk/src/cmp/lean/ReadmeTopTest_lean.ts:12`
- **At head.** Not a defect. lean declares `trim: false`
  (`.sdk/model/target/lean.aontu:51`), so the full feature catalog is always
  compiled into the lean target and `lake exe feature` exercises those
  features whatever the model activates.
- **Fix.** None; if lean ever becomes trimmable, derive the list from
  targetFeatures.
- **Check.** none

### U13. lean README compares its Value to 'the Go and Python SDKs', which the project may not have

- **Fate.** WP41.
- **Class.** stale-mention; sdkgen-langpack; per-language-copy; 1 source file;
  size xs; changes generated documents.
- **Where.** `.sdk/src/cmp/lean/ReadmeModel_lean.ts:7`
- **At head.** Present. Literal sentence 'the Lean equivalent of the
  map\[string\]any the Go and Python SDKs pass around'.
- **Fix.** Delete the comparison clause; describe Value on its own.
- **Check.** `off` relation with go and py removed, when the pack runs the
  guard.

### U14. lean (and dart, haskell) README get TypeScript error-handling prose from the neutral default rows

- **Fate.** WP07.
- **Class.** wrong-language; sdkgen; neutral-component; 2 source files; size
  xs; changes generated documents.
- **Where.** `ts/src/cmp/ReadmeErrors.ts:25,212`;
  `ts/src/cmp/ReadmeExplanation.ts:40,225`
- **At head.** Present. The neutral Readme calls ReadmeErrors and
  ReadmeExplanation for every target; LANGS has no lean row, so DEFAULT\_LANG
  (TypeScript try/await) is written for the pack languages.
- **Fix.** Same fix as X1: rows keyed by origin, no default row; a pack
  language with no row writes no section, or the pack supplies its own section
  override.
- **Check.** Fence-tag exact check (section 7) when the pack runs the guard.

### U15. lean README says 'Entity instances are stateful' though lean has no entity objects

- **Fate.** WP07.
- **Class.** contradiction; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeExplanation.ts:46`
- **At head.** Present. Neutral ReadmeExplanation writes the entityState
  paragraph whenever an example entity has an op; lean's
  ReadmeExplanation\_lean only adds text, and `AGENTS.md` states lean has no
  entity instance.
- **Fix.** Gate the entity-state paragraph on a target capability (no row for
  lean once rows are keyed by origin with no default), so lean writes none.
- **Check.** Pack guard run or `langpack.test.js` assertion that lean README
  lacks 'Entity instances are stateful'.

### U16. haskell install section prints an empty code fence once the registry is active

- **Fate.** WP41.
- **Class.** omission; sdkgen-langpack; per-language-copy; 1 source file; size
  xs; changes generated documents.
- **Where.** `.sdk/src/cmp/haskell/ReadmeInstall_haskell.ts:9-12`
- **At head.** Present. When isPublished, it writes installCommand(model,
  target.name), and sdkgen's installCommand
  (`ts/src/helpers/packageMeta.ts:287-308`) returns '' for haskell's origin.
  Same defect as V3 in six bundled targets.
- **Fix.** Write `cabal install <pkg>` from the pack's own package name, or
  have installCommand learn an ecosystem hook; never print an empty fence.
- **Check.** Section 8 table/fence check extended to 'no empty fence', or a
  pack test with registry state active.

### U17. haskell README layout names `<name>-sdk.cabal` while the package writes `<org>-<name>-sdk.cabal`

- **Fate.** WP41.
- **Class.** contradiction; sdkgen-langpack; per-language-copy; 1 source file;
  size xs; changes generated documents.
- **Where.** `.sdk/src/cmp/haskell/ReadmeExplanation_haskell.ts:34`;
  `.sdk/src/cmp/haskell/Package_haskell.ts:14-17`
- **At head.** Present. ReadmeExplanation uses
  `${model.const.Name.toLowerCase()}-sdk.cabal`; Package uses pkgName =
  `${org}-${model.name}-sdk`.
- **Fix.** Export pkgName from a shared utility\_haskell file and call it in
  both.
- **Check.** Pack test asserting the README tree names the file Package
  writes.

### U18. Root README and docgen print packageName's default for dart where the pack's pubspec uses `<name>_sdk`

- **Fate.** WP41.
- **Class.** duplicated-rule; sdkgen; helper; 2 source files; size s; changes
  generated documents.
- **Where.** `ts/src/helpers/packageMeta.ts:275-277`;
  `sdkgen-langpack/.sdk/src/cmp/dart/Package_dart.ts:21-27`
- **At head.** Present. packageName falls to `${origin}-${base}` for an
  unknown origin; dartPackageName returns `${model.name}_sdk` lower-cased;
  ReadmeTop's Packages table and docgen exampleValues call packageName.
- **Fix.** Let a target declare its package name (publish.registry.package,
  which packageName already reads first) in the dart model file, or let a pack
  register its naming rule; packageName then agrees with the manifest.
- **Check.** Pack test: root README package cell equals pubspec name.

### U19. dart REFERENCE feature tables list every active feature without the target applicability filter

- **Fate.** WP41.
- **Class.** omission; sdkgen-langpack; per-language-copy; 1 source file; size
  xs; changes generated documents.
- **Where.** `.sdk/src/cmp/dart/ReadmeRef_dart.ts:72,350`
- **At head.** Present. Reads getModelPath(main.kit.feature) and filters only
  `f.active`; Config\_dart and Main\_dart use targetFeatures.
- **Fix.** Use targetFeatures(model, target) as Config\_dart does.
- **Check.** `parity` relation (dart reads a different feature set from its
  Config sibling).

### U20. dart README examples and tables use the raw op keys, including inactive and action-only operations

- **Fate.** Repeats S23 and is resolved with it in WP21; the pre-pass reaches
  the pack; its port to entityOps is in WP41.
- **Class.** duplicated-rule; sdkgen-langpack; per-language-copy; 2 source
  files; size xs; changes generated documents. Needs: DQ1.
- **Where.** `.sdk/src/cmp/dart/ReadmeEntity_dart.ts:60`;
  `.sdk/src/cmp/dart/ReadmeRef_dart.ts:179`
- **At head.** Present. `Object.keys(entity.op || {})` with no active or
  opNeedsAction filter, the pack copy of the S24 pattern.
- **Fix.** Call entityOps(ent) (and follow DQ1 for op-level active).
- **Check.** S24's verification extended to the pack; op-off variation.

### U21. Literal `cd <lang>` in 12 how-tos and 5 install components, wrong under an alias, out of tree or at root

- **Fate.** WP32.
- **Class.** stale-mention; sdkgen; per-language-copy; 17 source files; size
  m; changes generated documents. Needs: targetPlace; docLink; DQ3.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeHowto_<lang>.ts` (ts:183,
  py:142); `ts/project/.sdk/src/cmp/<lang>/ReadmeInstall_<lang>.ts` (java:28,
  kotlin, scala, swift, csharp)
- **At head.** Present. grep at head: literal `cd ts`, `cd py`, `cd java`
  lines in ReadmeHowto of csharp, go, java, js, kotlin, lua, php, py, rb,
  scala, swift, ts and in five ReadmeInstall files (9 lines); c, elixir,
  ocaml, perl, rust already use `${target.name}`.
- **Fix.** Write the directory from docLink/targetPlace (the installed key in
  tree; no `cd` line for root or external placement), in the copy wave.
- **Check.** `link` relation's `cd` check in the guard (cd from the document
  directory or tree root must resolve); alias variation.

### U22. 'Create a .env.local file at the project root' is wrong for an out-of-tree target

- **Fate.** WP32.
- **Class.** stale-mention; sdkgen; per-language-copy; 10 source files; size
  m; changes generated documents. Needs: targetPlace; DQ3.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeHowto_<lang>.ts` (go:164,
  py:133)
- **At head.** Present. Ten how-tos say 'project root'; the harness reads it
  relative to the target (`tm/go/test/testsupport_test.go:26`
  `dir/../../.env.local`, `tm/py/test/runner.py:16` `../../.env.local`
  relative to the working directory), which is the project root only in tree.
- **Fix.** State the location from targetPlace/sdkrel (the folder above the
  target in tree; the sdkrel path out of tree), and align the runners on one
  path rule with V32.
- **Check.** `external.test.ts` out-of-tree case; `link`-style path check of
  the stated location.

### U23. go-cli and go-mcp point at `../go` (and py-data at `../py`) under an alias or out-of-tree layout

- **Fate.** Repeats G23 and is resolved with it in WP36.
- **Class.** code-defect; sdkgen; per-language-copy; 3 source files; size s;
  changes generated documents and code. Needs: targetSurface; targetPlace;
  DQ2.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:358`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts`
- **At head.** Present. Design note section 14 item 6 and G23: `replace ... =>
  ../go` is literal and does not follow consumes/alias/placement.
- **Fix.** Resolve the wrapped target with targetSurface(...).consumed and its
  targetPlace; write the replace path and README sibling paths from that;
  refuse with a message when consumes has no installed target.
- **Check.** G23's runplan variation and an alias variation in
  `generate.test.ts` NON\_SDK\_SIBLING case.

### U24. py-data's guard tests that a key named `py` exists, not that it is active or an alias of py

- **Fate.** WP36.
- **Class.** code-defect; sdkgen; per-language-copy; 1 source file; size xs;
  changes generated code. Needs: targetSurface.
- **Where.** `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:23-30`
- **At head.** Present. `if (null == targets.py)` throws; an inactive py
  passes the guard, and an aliased py (py\~py2) with no `py` key fails it.
- **Fix.** Use targetSurface(model,'py-data').consumed (active installed keys
  with origin py); refuse when empty, require a choice when two.
- **Check.** `generate.test.ts`: py inactive -> refusal; py\~py2 only ->
  generates against py2.

### U25. An out-of-tree target is absent from the root README yet listed by every docgen edition as `<name>/`

- **Fate.** Repeats G24 and is resolved with it in WP26b.
- **Class.** contradiction; sdkgen; neutral-component; 2 source files; size s;
  changes generated documents. Needs: targetPlace; DQ3.
- **Where.** `ts/src/sdkgen.ts:374-382,939-950`; docgen
  `ts/src/content.ts:244-246`
- **At head.** Present. withoutExternal removes externally placed targets from
  the model Root sees, so ReadmeTop omits them; docgen reads `sdk.json` and
  prints `code(t.name + '/')` as the repository directory.
- **Fix.** Under DQ3 the root README follows the declared layout and lists the
  target with its declared location; docgen takes the directory from
  targetPlace and writes the external repo instead of `<name>/`.
- **Check.** G24 runplan variation; `external.test.ts` asserting both
  documents name the same location.

### U26. A publish workflow, `PUBLISHING.md` and trust script are written for an npm target whose registry state is inactive

- **Fate.** WP10.
- **Class.** unread-switch; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/PublishWorkflow.ts:26-34`
- **At head.** Present. npmTargets collects every active target with registry
  name 'npm' and never reads registryState; 'inactive' (do not publish) still
  gets a workflow. For 'pending' the workflow is the documented path after the
  first hand release, so pending alone is not wrong.
- **Fix.** Skip targets whose registryState is 'inactive'; keep pending, and
  say in `PUBLISHING.md` that the first version goes out by hand.
- **Check.** `publishworkflow.test.ts`: registry state inactive -> no
  `publish-<t>.yml`.

### U27. Root Makefile says every port tags `<target>/vX.Y.Z` while the primary npm target's workflow tags `v<version>`

- **Fate.** WP25.
- **Class.** contradiction; sdkgen; neutral-component; 2 source files; size s;
  changes generated documents and code. Needs: D29 release-tag rule.
- **Where.** `ts/src/cmp/Deploy.ts:157,218`;
  `ts/src/cmp/PublishWorkflow.ts:87-90`
- **At head.** Present. Deploy's header and tagPushRecipe always use
  `${name}/v`; releaseTag returns 'v\$VERSION' for the primary npm target, so
  ts gets two tag forms depending on which mechanism ran.
- **Fix.** One release-tag helper (D29) used by Deploy, PublishWorkflow,
  `PUBLISHING.md` and ReadmeInstall\_ts; the header sentence names the primary
  npm exception from it.
- **Check.** `deploy.test.ts` + `publishworkflow.test.ts` asserting the same
  tag for the primary npm target.

### U28. `PUBLISHING.md` says 'It is a DISPATCH ... because the root Makefile also publishes' when the registry is pending and it only tags

- **Fate.** WP10.
- **Class.** contradiction; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/PublishWorkflow.ts:372-374`;
  `ts/src/cmp/Deploy.ts:129-139`
- **At head.** Present. Deploy publishes (`$(MAKE) -C <t> publish`) only when
  regIsActive; for pending it runs tag-push only, so the reason given is false
  in the pending state.
- **Fix.** Condition the sentence on registryState: active -> as now; pending
  -> 'the root Makefile only tags while the registry is pending; a
  tag-triggered workflow would ...' or drop the reason.
- **Check.** `publishworkflow.test.ts` under pending and active states.

### U29. Release branch is hard-coded `main` in the publish workflow, `PUBLISHING.md` and repo links

- **Fate.** WP25.
- **Class.** unread-switch; sdkgen; neutral-component; 2 source files; size s;
  changes generated documents and code. Needs: Q on where the branch slot
  lives.
- **Where.** `ts/src/cmp/PublishWorkflow.ts:176-188,364-369`;
  `ts/src/helpers/packageMeta.ts:80-97`
- **At head.** Present. Literal 'main' in the workflow guard and the guide;
  docgen reads main.kit.doc.ci.branch (D32), so the two disagree for a
  repository on another default branch.
- **Fix.** Add one model slot for the release branch (or reuse
  main.kit.doc.ci.branch via one helper) and read it in all three places.
- **Check.** `publishworkflow.test.ts` with a non-main branch declared.

### U30. `SECURITY.md` says 'Do not open public GitHub issues' for a repository on another host

- **Fate.** WP10.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/Security.ts:27`
- **At head.** Present. Literal 'GitHub' while repoInfo(model).hostName knows
  the host.
- **Fix.** Write 'public issues' or `${hostName} issues` from repoInfo.
- **Check.** `publisher.test.ts` or a security test with main.kit.repo.host
  set to gitlab.com.

### U31. Root Makefile reports c, cpp, zig as 'none (publish pending ...)' because registry name 'none' counts as a registry

- **Fate.** WP10.
- **Class.** code-defect; sdkgen; neutral-component; 4 source files; size s;
  changes generated documents and code.
- **Where.** `ts/src/cmp/Deploy.ts:39-42,100-105`;
  `ts/project/.sdk/model/target/c.aontu:36` (cpp:32, zig:37)
- **At head.** Present. registryOf treats any non-empty name as a registry;
  c/cpp/zig declare name 'none', so the summary and deploy rule say
  publication pending; registryState in packageMeta does the same.
- **Fix.** Treat 'none' as no registry in one place (registryState), and have
  Deploy call it instead of registryOf/regIsActive; or remove the 'none' value
  from the three model files (a copy change).
- **Check.** `deploy.test.ts`: c target -> 'tag-only'.

### U32. VERSION files and LICENSE years are frozen at target add, not updated by a version bump or a new year

- **Fate.** WP35.
- **Class.** code-defect; sdkgen; template; 15 source files; size m; changes
  generated code.
- **Where.** `ts/project/.sdk/tm/<lang>/VERSION` (go, rust; 14 templates);
  `ts/project/.sdk/tm/<lang>/LICENSE` (go:3); `ts/src/helpers/stdrep.ts:27`
- **At head.** Present. VERSION holds PROJECTVERSION and LICENSE
  `$$const.year$$`; templateReplacements substitutes both when target add
  copies the tm tree, so the project's `.sdk/tm` copy carries the literal
  value and generate copies it unchanged.
- **Fix.** Emit VERSION and the LICENSE year from a component at generate time
  (packageVersion, `License.ts`'s year), as `Gitignore_<lang>` already does
  for .gitignore, and remove them from tm.
- **Check.** `generate.test.ts`: bump publish.version without re-adding and
  assert the generated VERSION; doctor not reporting VERSION drift after a
  bump.

### U33. `CHANGELOG.md` is written once with a literal \[0.0.1\] entry and never follows the version

- **Fate.** WP10.
- **Class.** unread-switch; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/Changelog.ts:11,20`
- **At head.** Present. File({ name: '`CHANGELOG.md`', exclude: true }) with a
  hard-coded `## [0.0.1]` heading; S01 and S02 are its fixed language lists.
- **Fix.** Take the first entry's version from packageVersion and its contents
  from the model (or make the first entry say 'Initial release' with no
  number); keep exclude:true so later edits survive.
- **Check.** A test that a fresh project with publish.version 1.2.0 gets `##
  [1.2.0]`.

### U34. Documents name the entity class `${ent.Name}Entity` where a collision renames it (e.g. PlanetEntityClient)

- **Fate.** WP37.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 20 source files; size
  m; changes generated documents.
- **Where.** `ts/src/cmp/ReadmeModel.ts:70`;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeRef_<lang>.ts` (go:179, py:181)
- **At head.** Present. 49 files build `${Name}Entity` by hand (README,
  REFERENCE, model and test components); entityClassName
  (`ts/src/helpers/opShape.ts:567`) applies the collision rename the
  `Entity_<lang>` generators use.
- **Fix.** Call entityClassName(ent, entityCollection(model)) in every
  document component (neutral ReadmeModel first, then the per-language
  ReadmeRef/ReadmeModel in the copy wave); test components likewise.
- **Check.** `entityname.test.ts` or `ts-sdk-types.test.ts`: an entity whose
  data type collides yields the renamed class in README and REFERENCE.

### U35. Per-language 'API path:' is the first point of the alphabetically first op, which can be a custom action's route

- **Fate.** WP31.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 9 source files; size
  s; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeModel_<lang>.ts`
  (py:124-142, go:180)
- **At head.** Present. py/go/java/... ReadmeModel take `each(ops)` (sorted
  keys: create before list/load) and points\[0\] including \$action points;
  the root README uses entityPath (`opShape.ts:89`), which follows
  CANON\_OP\_ORDER and skips actions.
- **Fix.** Call entityPath(ent) in the nine per-language ReadmeModel files.
- **Check.** `opshape.test.ts` plus a readme assertion with an entity whose
  create has an \$action point.

### U36. Project entity\_desc overrides in main.kit.text are ignored by 40 per-language README/REFERENCE entity components

- **Fate.** WP33.
- **Class.** unread-switch; sdkgen; per-language-copy; 40 source files; size
  l; changes generated documents. Needs: entityDescription derivation (D16).
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts` and
  `ReadmeRef_<lang>.ts` (read ent.short); `ts/src/helpers/text.ts:8-23`
- **At head.** Present. Only `ts/src/helpers/text.ts` and ReadmeTop read
  entity\_desc; 60 per-language files read `.short`, including 20 ReadmeEntity
  and 20 ReadmeRef.
- **Fix.** Add one entityDescription(model, ent) beside readmeText
  (entity\_desc, then short, then desc, D16) and call it in the neutral frame
  and the 40 copies; docgen calls the same export.
- **Check.** `modeltext.test.ts`: a text.entity\_desc override appears in
  every target's entity section; `parity` relation.

### U37. The go target is 'Golang' (target.title) in some README lines and 'Go' (LANG\_LABEL) in others

- **Fate.** Repeats G13 and is resolved with it in WP15; the go title becomes
  "Go" in WP37.
- **Class.** duplicated-rule; sdkgen; target-or-feature-model; 2 source files;
  size xs; changes generated documents.
- **Where.** `ts/project/.sdk/model/target/go.aontu:4`;
  `ts/src/helpers/packageMeta.ts:14-29`
- **At head.** Present. `go.aontu` title 'Golang'; LANG\_LABEL go: 'Go';
  ReadmeTop's langList uses t.title while manifests and pkgDescription use
  langLabel.
- **Fix.** One label source: langLabel reads target.title (origin's), and
  `go.aontu`'s title becomes 'Go' (a copy change) — or the reverse; see U99.
- **Check.** A test that every bundled target's title equals its LANG\_LABEL
  entry (or LANG\_LABEL is deleted).

### U38. Package manifests say 'Unofficial generated csharp SDK' because langLabel falls back to the key

- **Fate.** Repeats G13 and is resolved with it in WP15.
- **Class.** non-markdown-text; sdkgen; helper; 1 source file; size xs;
  changes generated code.
- **Where.** `ts/src/helpers/packageMeta.ts:311-315`
- **At head.** Present. pkgDescription uses langLabel(originName), and
  LANG\_LABEL has no csharp/elixir/perl rows.
- **Fix.** See G13: label from target.title.
- **Check.** G13's test.

### U39. The API has three display names: info.title or '`<Name>` API', apiName() without 'API', and '`<Name>` API' from the slug

- **Fate.** WP15.
- **Class.** duplicated-rule; sdkgen; helper; 5 source files; size s; changes
  generated documents.
- **Where.** `ts/src/cmp/ReadmeTop.ts:108`;
  `ts/src/helpers/packageMeta.ts:225-230`;
  `ts/src/cmp/AgentGuideContent.ts:116-118`; docgen `ts/src/content.ts:157`
- **At head.** Present. Opened ReadmeTop:108 productName = info.title ||
  `${model.Name} API`; apiName strips 'API' and honours main.kit.text; intros
  and guides use `${model.Name} API`; docgen uses edition.title || info.title || model.name.
- **Fix.** One apiDisplayName(model) beside apiName (reading
  main.kit.text.title, then info.title), used by ReadmeTop, the guides, the
  intros and docgen.
- **Check.** `modeltext.test.ts`: a text.title override appears identically in
  root README, `AGENTS.md` and a target intro.

### U40. The elixir app name is derived three ways (raw slug, snake\_case, lower-case) across Main, Package and README

- **Fate.** WP35.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 3 source files; size
  xs; changes generated documents and code.
- **Where.** `ts/project/.sdk/src/cmp/elixir/Main_elixir.ts:81`;
  `ts/project/.sdk/src/cmp/elixir/Package_elixir.ts:28`;
  `ts/project/.sdk/src/cmp/elixir/ReadmeExplanation_elixir.ts:8`
- **At head.** Present. Main writes `model.const.name + '.ex'`, Package uses
  name.replace(/-/g,'\_'), the README name.toLowerCase(); a hyphenated slug
  gives three different names.
- **Fix.** One elixirApp(model) in a new utility file for the copy wave,
  called by all three.
- **Check.** `elixir-types.test.ts` or a new assertion with a hyphenated slug.

### U41. JVM package and Maven group id ignore publish.registry.package

- **Fate.** WP35.
- **Class.** unread-switch; sdkgen; per-language-copy; 3 source files; size s;
  changes generated documents and code.
- **Where.** `ts/project/.sdk/src/cmp/java/utility_java.ts:29-46` (kotlin:27,
  scala:24)
- **At head.** Present. javaPackage and mavenGroupId derive from model.origin
  and model.name only; java/kotlin/scala model files declare a registry block
  whose package slot packageName honours elsewhere.
- **Fix.** Read publish.registry.package (via packageName) for the
  coordinates, with the origin rule as the default; one shared function
  instead of three byte-identical copies.
- **Check.** A test with publish.registry.package set: pom and README
  coordinates match it.

### U42. Four install sections print the placeholder `<repo-url>` literally

- **Fate.** WP35.
- **Class.** omission; sdkgen; per-language-copy; 4 source files; size s;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/swift/ReadmeInstall_swift.ts:14,42`;
  `ts/project/.sdk/src/cmp/rust/ReadmeInstall_rust.ts:40`;
  `ts/project/.sdk/src/cmp/cpp/ReadmeInstall_cpp.ts:23`;
  `ts/project/.sdk/src/cmp/zig/ReadmeInstall_zig.ts:42`
- **At head.** Present. grep at head; present since 38265132;
  repoInfo(model).repoUrl is available to these components.
- **Fix.** Substitute repoInfo(model).repoUrl.
- **Check.** A `generate.test.ts` scan that no generated document contains
  `<repo-url>`.

### U43. 'The data must include the entity `id`' in update/patch reference text for an entity with no id field

- **Fate.** WP31.
- **Class.** stale-mention; sdkgen; per-language-copy; 20 source files; size
  m; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeRef_<lang>.ts` (go:32,
  ts:32)
- **At head.** Present. 40 occurrences in 20 ReadmeRef files, a fixed table of
  op descriptions with no read of entityIdField.
- **Fix.** Make the op-description table a function of the entity: name the id
  field from entityIdField(ent) or omit the sentence when the update match has
  none.
- **Check.** `ownidfield.test.ts` / `generate.test.ts` singleton entity: no
  'must include the entity `id`'.

### U44. 'The match is optional — call list() with no argument' for a nested entity whose list needs its parent

- **Fate.** WP31.
- **Class.** stale-mention; sdkgen; per-language-copy; 18 source files; size
  m; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeRef_<lang>.ts` (py:34,
  java:24); `ts/project/.sdk/src/cmp/<lang>/ReadmeModel_<lang>.ts` (rb:25,
  php:25)
- **At head.** Present. Fixed descriptions in 18 files; `AGENTS.md` notes a
  list on a nested entity needs its parent path params (matchArg).
- **Fix.** Condition the sentence on the entity having no required list params
  (the same test listMatchArg uses); otherwise name the parent param.
- **Check.** `generate.test.ts` nested-entity fixture: REFERENCE names the
  parent param.

### U45. Quick start heading '\#\#\# 4. Create, update, and remove' over a single operation

- **Fate.** WP31.
- **Class.** stale-mention; sdkgen; per-language-copy; 18 source files; size
  m; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeQuick_<lang>.ts` (py:179,
  java:195)
- **At head.** Present. py ReadmeQuick enters the block when any of
  create/update/patch/remove exists and writes the fixed heading; 18 files.
- **Fix.** Build the heading from the ops present (the same join the intro
  uses).
- **Check.** `off` relation with create and update removed.

### U46. go-cli README says 'any is valid as `<entity>`' for entities no CLI word can run

- **Fate.** WP36.
- **Class.** stale-mention; sdkgen; per-language-copy; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:306`
- **At head.** Present. Lists every entity while the words are
  list/load/update (G08); a create-only entity cannot be run.
- **Fix.** List only entities with an op a registered word runs (D56), or say
  which word applies to each.
- **Check.** Op-absent variation: create-only entity absent from the go-cli
  entity list.

### U47. go-cli README and help use literal {id:1} and {name:"x"} arguments whatever the entity's id and fields

- **Fate.** WP36.
- **Class.** stale-mention; sdkgen; per-language-copy; 1 source file; size xs;
  changes generated documents and code.
- **Where.**
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:105,124-127,154-159,266-267`
- **At head.** Present. Literal `{id:1}` and `update '{name:"x"}'` for the
  first entity; the MCP half is G11.
- **Fix.** Use the values the SDK README already derives (entityIdField,
  idLiteral, dataArg).
- **Check.** Id-less entity fixture: no `{id:1}` in go-cli README or help.

### U48. py-data README and code use SomeEntity and ad.things as example names

- **Fate.** Repeats S33 and is resolved with it in WP36.
- **Class.** stale-mention; sdkgen; per-language-copy; 1 source file; size xs;
  changes generated documents and code.
- **Where.**
  `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:205,727,783,799,899`
- **At head.** Present. Literal names in the README, docstring and notebook.
- **Fix.** See S33: use the first active entity's accessor.
- **Check.** S33's test.

### U49. direct()/prepare() examples use the fabricated path /api/resource/{id} in 42 files

- **Fate.** WP31.
- **Class.** stale-mention; sdkgen; per-language-copy; 42 source files; size
  l; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeHowto_<lang>.ts`
  (ts:108,123); `ts/project/.sdk/src/cmp/<lang>/ReadmeTopHowto_<lang>.ts`;
  `ts/src/cmp/ReadmeErrors.ts:44`
- **At head.** Present. 88 occurrences in 20 ReadmeHowto, 20 ReadmeTopHowto,
  ReadmeErrors and one ReadmeExamplesTest.
- **Fix.** Use entityPath of the example entity (a real route) or a route the
  model leaves unmodelled; keep the literal only when the model has no route.
- **Check.** README example test: the direct example's path exists in the
  model.

### U50. '\#\# Use with Station' is written for an inactive station feature, with an API-key sentence for an API with no auth

- **Fate.** WP11.
- **Class.** unread-switch; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeStation.ts:27-31,39-41,93-96`
- **At head.** Present. Reads features with only\_active:false and returns
  only when no station feature exists; never reads isAuthActive;
  `CONNECT_TARGETS/SELF_REGISTER_TARGETS` are keyed by target.name.
- **Fix.** Gate on featureApplies/targetFeatures (active), the secret-name
  paragraph on isAuthActive, and key the target lists by originName.
- **Check.** `off` relation on station inactive and auth off.

### U51. 'This SDK ships 1 optional features' — no singular

- **Fate.** WP16.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: featureOnByDefault.
- **Where.** `ts/src/cmp/ReadmeFeatures.ts:29`
- **At head.** Present. `${features.length} optional features` with no plural
  rule; the same lead-in carries S09's 'inactive until you switch it on'.
- **Fix.** Rewrite the lead-in in the S09 fix with a count noun helper ('1
  optional feature').
- **Check.** `readme.test.ts` lone-feature case.

### U52. REFERENCE ordering note says 'several features wrap' and '`x` wrap the transport' when one feature wraps

- **Fate.** WP08.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeRefFeatures.ts:28-30,37-44`
- **At head.** Present. 'several features wrap the transport' is unconditional
  and the Ordering paragraph uses a plural verb for any count.
- **Fix.** Count wrapping features: none -> no array-order sentence; one ->
  singular wording and no nesting claim.
- **Check.** Lone wrapping-feature variation in the guard.

### U53. When every feature wraps, the REFERENCE writes ' attach to pipeline hooks' with an empty subject

- **Fate.** WP08.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeRefFeatures.ts:54-55`
- **At head.** Present. `${hooked.map(...).join(', ')} attach to pipeline
  hooks` is written whenever wrapping is non-empty, even when hooked is empty.
- **Fix.** Write the sentence only when hooked.length > 0.
- **Check.** Exact check or `readme.test.ts` with only transport features.

### U54. 'Features are initialized in order ... later features can override earlier ones' in a fixed-order target (lean)

- **Fate.** WP08.
- **Class.** contradiction; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeExplanation.ts:312-313`;
  `ts/src/cmp/FeatureDocs.ts:94-97`
- **At head.** Present. ReadmeExplanation writes the sentence unconditionally;
  honoursActivationOrder is false for 'lean' (by name, so an alias of lean is
  misread too).
- **Fix.** Condition on honoursActivationOrder, keyed by originName.
- **Check.** Pack guard run; `readme.test.ts` with lean staged.

### U55. Agent guide feature file names and directories are wrong for 11 targets (`<name>_feature.<ext>` in `feature/`)

- **Fate.** WP09.
- **Class.** duplicated-rule; sdkgen; neutral-component; 2 source files; size
  s; changes generated documents.
- **Where.** `ts/src/cmp/AgentGuideContent.ts:68-85`;
  `ts/src/cmp/AgentGuide.ts:91-103`
- **At head.** Present. featureBase/featureRuntimeFile assume
  `feature/<name>_feature.<ext>` (php special-cased) while
  `helpers/featureSource.ts` discovers per-language layouts (py pkg/feature,
  swift `Sources/.../feature`, dart lib/feature).
- **Fix.** Derive the path from the same discovery `featureSource.ts` uses
  (the target's tm tree), not from srcfeature/ext.
- **Check.** `agentguide.test.ts`: each target's listed feature path exists in
  a generated tree (`link` relation).

### U56. Root `AGENTS.md` says 'Each feature is generated into every SDK target'

- **Fate.** WP09.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/AgentGuideTop.ts:66-68`
- **At head.** Present. Unconditional; featureApplies/provides excludes
  features from targets that cannot provide them (targetFeatures), and the
  sentence also fixes ts/js vs other layouts.
- **Fix.** Say 'into each SDK target that supports it' and take the layout
  from U55's derivation, or list per target from targetFeatures.
- **Check.** `off` relation with a feature not applicable to one target.

### U57. Root `AGENTS.md` promises a per-feature guide `<lang>/src/feature/<name>/AGENTS.md` for languages that have none

- **Fate.** WP09.
- **Class.** dangling-link; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/AgentGuideTop.ts:39-41`
- **At head.** Present. AgentGuideFeature writes
  `src/feature/<name>/AGENTS.md` only for dir-layout targets (ts, js), but the
  sentence is unconditional.
- **Fix.** Name the per-feature guides only when a dir-layout target with
  features is present, from the same predicate AgentGuideFeature uses.
- **Check.** `link` relation; lone-go project has no such sentence.

### U58. 'Entity operations reject on failure, so wrap them in try / catch' for result-returning targets

- **Fate.** Repeats S05 and is resolved with it in WP07.
- **Class.** wrong-language; sdkgen; neutral-component; 1 source file; size
  xs; changes generated documents.
- **Where.** `ts/src/cmp/ReadmeErrors.ts:25-26,212`
- **At head.** Present. The DEFAULT\_LANG row reaches 13 non-JS targets (S05).
- **Fix.** See S05/X1.
- **Check.** S05's fence check.

### U59. 'no code generation is needed' in eight targets that do emit typed models

- **Fate.** WP37.
- **Class.** contradiction; sdkgen; per-language-copy; 8 source files; size s;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeExplanation_<lang>.ts`
  (go:15, py:12)
- **At head.** Present. 12 explanations carry the sentence; py, lua, go, rb,
  php, rust, c and cpp also have `EntityTypes_<lang>` generators, so
  regenerating does change their typed models when the schema changes.
- **Fix.** Reword in those eight: the untyped path needs no regeneration; the
  typed models follow the schema on regeneration.
- **Check.** Text-only; `parity` relation reads EntityTypes presence.

### U60. Install sections call the SDK 'dependency-free' though a feature can declare deps for that target

- **Fate.** WP35.
- **Class.** stale-mention; sdkgen; per-language-copy; 4 source files; size s;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/ocaml/ReadmeInstall_ocaml.ts:14,31`;
  `ts/project/.sdk/src/cmp/swift/ReadmeInstall_swift.ts:34`;
  `ts/project/.sdk/src/cmp/c/ReadmeInstall_c.ts`;
  `ts/project/.sdk/src/cmp/scala/ReadmeInstall_scala.ts`
- **At head.** Present. The schema lets a feature add deps per target
  (main.kit.feature.&amp;`.target.<t>.deps`); no bundled feature does today
  for these targets, so the claim is latent and true for bundled content only
  (the pack's haskell says the same).
- **Fix.** Write the sentence only when collectDeps for the target is empty.
- **Check.** A test feature declaring a swift dep removes the sentence.

### U61. 'capitalised, semantic Entities' beside a lower-case accessor in c, cpp, clojure and ocaml

- **Fate.** WP37.
- **Class.** contradiction; sdkgen; per-language-copy; 4 source files; size s;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/c/ReadmeIntro_c.ts:34`;
  `ts/project/.sdk/src/cmp/cpp/ReadmeIntro_cpp.ts:34`;
  `ts/project/.sdk/src/cmp/clojure/ReadmeIntro_clojure.ts:33`;
  `ts/project/.sdk/src/cmp/ocaml/ReadmeIntro_ocaml.ts:35`
- **At head.** Present. The sentence is still in these per-language intros at
  head (b4cd6877 moved only the frame), next to `<ident>_<entity>(client,
  NULL)` and similar lower-case accessors.
- **Fix.** Drop 'capitalised' in these four (or move the sentence into the
  neutral ReadmeIntro conditioned on the language's accessor casing).
- **Check.** `readmeintro.test.ts` assertion per language.

### U62. 'Every other field is typed normally' while two-branch unions become `any` in 15 languages

- **Fate.** WP08.
- **Class.** contradiction; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeUnions.ts:10,68`;
  `ts/src/helpers/canonType.ts:75-81,147-157`
- **At head.** Present. Only unions of 3+ branches are listed; canonToType
  joins a union only for ts, js, py, lua, elixir and otherwise returns the
  language's any type.
- **Fix.** Say 'Every other field has a declared type in this language' only
  where CANON\_UNION\_JOIN has the target's language, or list two-branch
  unions too for the other languages.
- **Check.** `readmeunions.test.ts`: two-branch union in a go target.

### U63. Seven docgen sentences name the client libraries, companion tools, retry/timeout/logging and surfaces unconditionally

- **Fate.** WP26a.
- **Class.** stale-mention; docgen; other; 1 source file; size s; changes
  generated documents. Needs: targetSurface; featureOnByDefault.
- **Where.** `ts/src/content.ts:187`; `ts/src/content.ts:551`;
  `ts/src/content.ts:553`; `ts/src/content.ts:594`; `ts/src/content.ts:664`;
  `ts/src/content.ts:676`; `ts/src/content.ts:697`
- **At head.** Present. Opened each line at 9ca5221: e.g. 187 'the client
  libraries, and the companion tools', 594 'features are off by' (log is on),
  676 'Every other language in this repository follows'.
- **Fix.** Condition each on the view (sdks/tools counts, targetFeatures,
  featureOnByDefault) or delete it.
- **Check.** docgen test over a lone-SDK, no-feature model.

### U64. docgen setup snippets always pass apikey and never a secret or server variables

- **Fate.** WP26a.
- **Class.** omission; docgen; template; 3 source files; size s; changes
  generated documents. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/tm/edition/github-pages/sdk-setup.json`;
  `ts/project/.sdk/tm/edition/presentation/sdk-setup.json`;
  `ts/src/sdk-reference.ts:6-12`
- **At head.** Present. Static JSON templates with `apikey` for every
  language; exampleValues offers no slot for secret or server.
- **Fix.** Build the setup snippet from requiredOptions(model) (apikey only
  when auth active, secret for Basic header placement, server vars).
- **Check.** docgen test under auth-off and Basic.

### U65. docgen JVM setup imports hard-code `voxgig.` as the package root

- **Fate.** WP26a.
- **Class.** duplicated-rule; docgen; template; 2 source files; size s;
  changes generated documents.
- **Where.** `ts/project/.sdk/tm/edition/github-pages/sdk-setup.json:9,14,15`;
  `ts/project/.sdk/tm/edition/presentation/sdk-setup.json:9,14,15`
- **At head.** Present. `import voxgig.{{lower}}sdk.core...` while sdkgen's
  javaPackage derives the org from model.origin.
- **Fix.** sdkgen exports a jvmPackage(model) helper (from the U41 single
  function) and docgen fills a template slot from it.
- **Check.** docgen test with origin acme-sdk.

### U66. docgen MCP page says 'The API reference covers all entities' under an edition entity filter

- **Fate.** WP05a.
- **Class.** stale-mention; docgen; other; 1 source file; size xs; changes
  generated documents.
- **Where.** `ts/src/content.ts:568`
- **At head.** Present. v.entities is pick(rows(kit.entity),
  edition.filter.entities); the sentence is fixed.
- **Fix.** Say 'covers the selected entities' when edition.filter.entities is
  set.
- **Check.** docgen test with a filter.

### U67. `SUMMARY.md` tells readers to use 'the linked reference' and entity references that are not generated when the website edition is off

- **Fate.** WP26a.
- **Class.** dangling-link; docgen; other; 1 source file; size xs; changes
  generated documents. Needs: docLink.
- **Where.** `ts/src/content.ts:187`; `ts/src/content.ts:222-223`;
  `ts/src/content.ts:243`
- **At head.** Present. link() returns plain text without the github-pages
  edition (the scaffold default), but the prose still says 'use the linked
  reference', 'Consult the entity reference', 'Inspect the response using the
  X reference'.
- **Fix.** Condition those sentences on `website` being present, or point to
  the SDK `REFERENCE.md` files that exist.
- **Check.** docgen test with github-pages inactive: no sentence naming a
  reference that is not written.

### U68. 'unofficial', 'public API' and 'not affiliated' disclosure is written even for a publisher that owns the API

- **Fate.** WP25.
- **Class.** unread-switch; sdkgen; helper; 1 source file; size s; changes
  generated documents and code. Needs: a model slot for official/upstream
  publisher.
- **Where.** `ts/src/helpers/packageMeta.ts:311-315,326-330`
- **At head.** Present. pkgDescription and nonAffiliation are unconditional
  (15 call sites); main.kit.publisher changes the name but not the claim.
- **Fix.** Add a declared slot (for example main.kit.publisher.official or
  upstream) read by both helpers; omit the disclosure when the publisher is
  the API owner.
- **Check.** `publisher.test.ts`: owner publisher -> no 'Not affiliated'.

### U69. Root README tagline says the surfaces are 'all generated from one OpenAPI spec' whatever the model was built from

- **Fate.** Repeats V24 and is resolved with it in WP15.
- **Class.** stale-mention; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeTop.ts:233`
- **At head.** Present. Literal; apidef also builds models from GraphQL (V24's
  sibling phrases).
- **Fix.** See V24: name the definition kind from the model, or say 'from one
  API definition'.
- **Check.** V24's test.

### U70. Root README links `voxgig.com/sdk/custom` for any publisher

- **Fate.** Repeats S48, which is not a defect.
- **Class.** unread-switch; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeTop.ts:680`
- **At head.** Present. Line moved from 960 (output) to source 680; the
  sibling link at :201 is gated on isDefaultPublisher, this one is not.
- **Fix.** Gate on isDefaultPublisher (S48).
- **Check.** S48's test.

### U71. Suspicion that non-ts PrepareAuth generators send Basic under query or cookie placement

- **Fate.** Not a defect: all 160 generated PrepareAuth files were measured:
  Basic is sent only under header placement.
- **Class.** code-defect; sdkgen; per-language-copy; 0 source files; size xs;
  changes nothing in generated output.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/PrepareAuth_<lang>.ts` (go, py)
- **At head.** Not a defect. Design note section 6 measured 160 generated
  PrepareAuth files (20 targets x 8 auth states): the Basic branch is present
  exactly under Basic AND header placement AND not suppressed; 18 of 20
  generators test `'header'` explicitly, the rest reach it by dispatch.
- **Fix.** None; requiredOptions encodes the same rule for documents.
- **Check.** The generated-output hold for `secret` described in design
  section 6.

### U72. kotlin live test harness builds the live client with no server block, so a templated server URL cannot run live

- **Fate.** WP30.
- **Class.** code-defect; sdkgen; per-language-copy; 1 source file; size xs;
  changes generated code.
- **Where.** `ts/project/.sdk/src/cmp/kotlin/TestEntity_kotlin.ts:367-372`
- **At head.** Present. liveOpts gets only apikey; 11 other TestEntity
  generators call serverVariables/serverVarEnv, kotlin does not.
- **Fix.** Port the server block from TestEntity\_java (serverVariables +
  serverVarEnv).
- **Check.** `liveentity.test.ts` / `livegenerated.test.ts` lane with a
  templated server for kotlin.

### U73. cpp live test harness never builds a live client: no API key, no server, always testSDK

- **Fate.** WP30.
- **Class.** code-defect; sdkgen; per-language-copy; 1 source file; size xs;
  changes generated code.
- **Where.** `ts/project/.sdk/src/cmp/cpp/TestEntity_cpp.ts:100,114-136`
- **At head.** Present. Setup reads `<ENV>_TEST_LIVE` into s.live but s.client
  stays the testSDK client constructed at :100; no `<ENV>_APIKEY` or server
  read.
- **Fix.** When live, construct the client with apikey (isAuthActive) and
  server variables as the ts/java harness does.
- **Check.** `livegenerated.test.ts` cpp lane where a toolchain exists;
  `generate.test.ts` string check.

### U74. entityOps and introOps append operations outside the six, for which no method is generated

- **Fate.** WP21.
- **Class.** code-defect; sdkgen; helper; 1 source file; size xs; changes
  generated documents. Needs: DQ1.
- **Where.** `ts/src/helpers/opShape.ts:409-415`;
  `ts/src/helpers/opShape.ts:419-431`
- **At head.** Present. Both concat ops not in CANON\_OP\_ORDER;
  ungeneratedOps (:439) states the bundled targets emit methods only for
  CANON\_OP\_ORDER, so documents list e.g. `generate` as an operation the SDK
  lacks.
- **Fix.** Restrict both to CANON\_OP\_ORDER for bundled targets (or to the
  ops the target emits); warnUngeneratedOps already names the rest.
- **Check.** `opshape.test.ts`: a custom op is not in entityOps/introOps
  output; intros do not list it.

### U75. ts README lists a declared but unreferenced server variable under '\*\*Required.\*\*'

- **Fate.** Repeats G01 and is resolved with it in WP29.
- **Class.** wrong-baseline; sdkgen; per-language-copy; 1 source file; size
  xs; changes generated documents. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/src/cmp/ts/ReadmeModel_ts.ts:66-72`;
  `ts/src/helpers/serverVars.ts:43-53`
- **At head.** Present. serverVariables appends unreferenced declared
  variables with required:false, and ReadmeModel\_ts lists every entry as
  required; G01 is the defaulted-variable half of the same row.
- **Fix.** List only requiredOptions(model).server.vars with required true;
  mention defaulted ones as optional.
- **Check.** `helpers.test.ts` plus a ts README assertion; `parity` relation.

### U76. docgen 'Client defaults' block shows auth without its placement

- **Fate.** WP26a.
- **Class.** omission; docgen; other; 1 source file; size xs; changes
  generated documents. Needs: requiredOptions.
- **Where.** `ts/src/sdk-reference.ts:37-43`; `ts/src/content.ts:573`
- **At head.** Present. clientDefaults prints
  configDefinition(...).def.options; the ts data representation has no `in`
  (V18) and Config says basic:true under any placement (design 14.2).
- **Fix.** Print auth from requiredOptions/the model's auth (in, name,
  prefix), not from the Config options.
- **Check.** docgen test with query placement.

### U77. dart Config generator keeps an unused inline auth block, base URL and headers

- **Fate.** WP41.
- **Class.** code-defect; sdkgen-langpack; per-language-copy; 1 source file;
  size xs; changes nothing in generated output.
- **Where.** `.sdk/src/cmp/dart/Config_dart.ts:45-60`
- **At head.** Present. authBlock, baseUrl and headers are computed and never
  referenced (grep shows only their declarations).
- **Fix.** Delete the dead code in the pack.
- **Check.** Pack check-scaffold/tsc noUnusedLocals or a lint.

### U78. py-data docstring names `<ENV>_BASE` for a fixed-host API where its README omits it

- **Fate.** WP36.
- **Class.** non-markdown-text; sdkgen; per-language-copy; 1 source file; size
  xs; changes generated code.
- **Where.** `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:238-239`
- **At head.** Present. Docstring lines unconditional; README at :658 gates
  `_BASE` on needsBase.
- **Fix.** Gate the docstring on the same needsBase.
- **Check.** server-static variation on py-data.

### U79. py-data notebook and docstring say 'Every page is fetched' regardless of paging

- **Fate.** WP36.
- **Class.** non-markdown-text; sdkgen; per-language-copy; 1 source file; size
  xs; changes generated code.
- **Where.** `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:424`;
  `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:876`
- **At head.** Present. Unconditional; S21 shows the same component relies on
  the SDK's paging feature, which may be absent.
- **Fix.** Condition on the paging feature applying to py (targetFeatures).
- **Check.** feat-absent-paging variation on py-data.

### U80. py-data README and notebook install with a literal `#subdirectory=py`

- **Fate.** WP36.
- **Class.** non-markdown-text; sdkgen; per-language-copy; 1 source file; size
  xs; changes generated documents and code. Needs: targetSurface; targetPlace.
- **Where.** `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:586,642,825`
- **At head.** Present. Literal `py`; wrong for an aliased or relocated py.
- **Fix.** Use the consumed key's placement (targetSurface + targetPlace).
- **Check.** py\~py2 alias variation.

### U81. MCP list tool says 'first page of records' for an SDK without paging

- **Fate.** WP36.
- **Class.** non-markdown-text; sdkgen; per-language-copy; 1 source file; size
  xs; changes generated code. Needs: DQ6.
- **Where.** `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:57-59`
- **At head.** Present. TOOL\_SPEC.list help/summary/returns are literal.
- **Fix.** Choose the wording on whether paging applies to go
  (targetFeatures).
- **Check.** feat-absent-paging variation on go-mcp `tools.go`.

### U82. MCP list tool calls the query an 'optional filter' for a nested list that needs its parent

- **Fate.** WP36.
- **Class.** non-markdown-text; sdkgen; per-language-copy; 1 source file; size
  xs; changes generated code. Needs: DQ6.
- **Where.** `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:56-57`
- **At head.** Present. `optional: true` and the help text are fixed per op,
  not per entity.
- **Fix.** Per entity: required when the list needs parent params (the
  listMatchArg test).
- **Check.** Nested-entity fixture in `generate.test.ts` NON\_SDK case.

### U83. 'Generated by sdkgen go-cli target' and `rm -rf ... go-cli` stay literal for an aliased go-cli

- **Fate.** WP36.
- **Class.** non-markdown-text; sdkgen; fragment; 2 source files; size xs;
  changes generated code.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/fragment/words.fragment.go:1`;
  `ts/project/.sdk/src/cmp/go-cli/fragment/main.fragment.go:4`;
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:366,390`
- **At head.** Present. Literal 'go-cli' in fragment comments and in the
  generated Makefile's clean rule, which deletes the wrong path under an
  alias.
- **Fix.** Use target.name in Main\_go-cli's Makefile; in fragments use a
  replace token filled from target.name.
- **Check.** Alias variation of go-cli.

### U84. Generated source headers print the alias's capitalised key, e.g. `// Demo Ts2 SDK`

- **Fate.** WP37.
- **Class.** non-markdown-text; sdkgen; per-language-copy; 14 source files;
  size m; changes generated code.
- **Where.** `ts/project/.sdk/src/cmp/ts/Main_ts.ts:78`;
  `ts/project/.sdk/src/cmp/<lang>/Schema_<lang>.ts` (ts:25, go)
- **At head.** Present. `${target.Name}` (derived from the key) in 14 files.
- **Fix.** Use target.title (or langLabel of the origin) in the header
  comment.
- **Check.** Alias variation.

### U85. Javadoc/godoc 'full CRUD contract ... every generated entity implements every operation' for the six-op interface

- **Fate.** Not a defect: the six-operation interface comments describe the
  interface, which every generated entity implements.
- **Class.** non-markdown-text; sdkgen; template; 0 source files; size xs;
  changes nothing in generated output. Needs: DQ6.
- **Where.** `ts/project/.sdk/tm/go/core/types.go:36`;
  `ts/project/.sdk/tm/java/core/SdkEntity.java:7-8`;
  `ts/project/.sdk/tm/kotlin/core/Interfaces.kt:15-16`
- **At head.** Not a defect. The interfaces do declare all six ops plus
  stream, and the comment itself says unsupported operations throw; true by
  construction for every model.
- **Fix.** None (DQ6 leaves source comments to a separate pass).
- **Check.** none

### U86. go typed-model godoc names `<Name>.<Op>Typed` methods that do not exist for excluded entities

- **Fate.** WP38.
- **Class.** non-markdown-text; sdkgen; per-language-copy; 1 source file; size
  xs; changes generated code. Needs: DQ6.
- **Where.** `ts/project/.sdk/src/cmp/go/EntityTypes_go.ts:150,172`
- **At head.** Present. EntityTypes\_go emits for every entity
  (only\_active:false, deliberate), and each request struct's comment
  references `${Name}.${Op}Typed`, which Main/Entity emit only for active
  entities. Emitting the types is by design; the comment is the defect.
- **Fix.** For an inactive entity, write 'typed request payload for the `<op>`
  operation' without naming a method.
- **Check.** `entitytypes.test.ts`: inactive entity's comment names no Typed
  method.

### U87. perl, rb and clojure op docblocks describe the match as 'id/query fields' for an id-less entity

- **Fate.** WP38.
- **Class.** non-markdown-text; sdkgen; fragment; 6 source files; size s;
  changes generated code. Needs: DQ6.
- **Where.**
  `ts/project/.sdk/src/cmp/perl/fragment/EntityLoadOp.fragment.pm:5`;
  `ts/project/.sdk/src/cmp/rb/fragment/EntityLoadOp.fragment.rb:8`;
  `ts/project/.sdk/src/cmp/clojure/fragment/EntityLoadOp.fragment.clj:2`
- **At head.** Present. Fixed fragment comments in Load/Remove fragments of
  three languages.
- **Fix.** Reword to 'match fields' (no model fact), per DQ6's comment pass.
- **Check.** none beyond review; optional comment scan.

### U88. The language pack carries the same model claims in comments (`AGENTS.md` citations, transport-feature lists) in dart fragments and haskell templates

- **Fate.** WP41.
- **Class.** non-markdown-text; sdkgen-langpack; fragment; 8 source files;
  size s; changes generated code. Needs: DQ6.
- **Where.** `.sdk/src/cmp/dart/fragment/EntityLoadOp.fragment.dart:85`;
  `.sdk/tm/haskell/src/SdkTypes.hs:117`;
  `.sdk/tm/haskell/src/SdkFeatures.hs:1190`
- **At head.** Present. grep at c6069bb: 'See `AGENTS.md` "Entity ...' in six
  dart fragments and haskell SdkTypes; the bundled equivalent is G17.
- **Fix.** Follow whatever the bundled comment pass does (G17, DQ6) in a pack
  release.
- **Check.** Pack comment scan.

### U89. `check-drift.sh` reports a layout difference as drift when its shell and the last generate disagree about SDKGEN\_EXTERNAL

- **Fate.** WP44a.
- **Class.** tooling-defect; create-sdkgen; other; 1 source file; size s;
  changes nothing in generated output. Needs: DQ3.
- **Where.** `project/standard/.sdk/admin/check-drift.sh:56-100`
- **At head.** Present. The script deletes the in-tree target folders and runs
  `npm run generate` in whatever environment it inherits; G20 shows the
  override changes 26 lines of `README.md`, so a run with a different override
  reads as drift. It also lists targets from `sdk.json`, ignoring the
  override.
- **Fix.** Under DQ3 (in-tree documents follow the declared layout) the README
  no longer differs; until then the script unsets SDKGEN\_EXTERNAL or records
  and replays the override, and skips externally placed targets.
- **Check.** create-sdkgen test running check-drift with and without the env
  var.

### U90. admin/status shows a stale in-tree folder as present after an override run placed the target elsewhere

- **Fate.** WP20.
- **Class.** tooling-defect; sdkgen; other; 1 source file; size xs; changes
  nothing in generated output. Needs: targetPlace.
- **Where.** `ts/src/admin/status.ts:56-60`
- **At head.** Present. Resolves `target.output?.path || name` from the model
  only; the run override is not consulted.
- **Fix.** Resolve the folder through the same plan generate uses (targetPlace
  plus the override), and report an in-tree folder for an external target as
  stale.
- **Check.** `admin-status.test.ts` with SDKGEN\_EXTERNAL set.

### U91. `target remove` plans to delete only the in-tree folder for a target the run override sent elsewhere

- **Fate.** WP20.
- **Class.** tooling-defect; sdkgen; action; 1 source file; size xs; changes
  nothing in generated output. Needs: targetPlace.
- **Where.** `ts/src/action/remove.ts:285-300`
- **At head.** Present. planOutput reads only declared.output.path (and tests
  `null !=`, design 14.7); with an override it deletes `../<name>` and says
  nothing about the real output.
- **Fix.** Read the override as generate does (resolveExternalOverride) and
  note the external folder as untouched; fix the '' test (14.7) in the same
  change.
- **Check.** `remove.test.ts` with SDKGEN\_EXTERNAL.

### U92. A derived sdkrel commits this machine's directory names into generated files

- **Fate.** WP23.
- **Class.** code-defect; sdkgen; neutral-component; 1 source file; size xs;
  changes generated code. Needs: DQ3.
- **Where.** `ts/src/sdkgen.ts:909-936`
- **At head.** Present, in a different form or place than first recorded.
  externalSdkRel still derives and returns the relative path, but now logs
  `external-sdkrel-derived` naming the directories above the project and
  asking for `output: sdkrel`.
- **Fix.** Keep the warning and make it an error (or refuse to write) in
  sdkgen's own suite and when not enclosing; document `output: sdkrel` as
  required for out-of-tree targets.
- **Check.** `external.test.ts` asserts the warning; a guard that generated
  files carry no path segment above the project.

### U93. Scaffold `ci.yml` keys jobs on bundled directory names, so aliased, root-placed or out-of-tree targets are never tested

- **Fate.** WP44a.
- **Class.** tooling-defect; create-sdkgen; other; 1 source file; size m;
  changes generated code. Needs: targetPlace; targetSurface.
- **Where.** `project/standard/.github/workflows/ci.yml:44-80`
- **At head.** Present. Each job is gated by hashFiles('`<lang>/`...') with
  literal language directories (`go/go.mod`, `go-cli/go.mod`).
- **Fix.** Generate the CI matrix from the model at generate time (one job per
  installed key and origin toolchain, with its placement), or document the
  limitation.
- **Check.** create-sdkgen test generating ci for go\~go2.

### U94. Pack tests cannot pass the build-option run override through the testkit

- **Fate.** WP20.
- **Class.** test-gap; sdkgen; helper; 1 source file; size xs; changes nothing
  in generated output. Needs: DQ4.
- **Where.** `ts/src/testkit.ts:425-455`
- **At head.** Present. generateInto constructs SdkGen without `external`;
  only the SDKGEN\_EXTERNAL environment variable reaches
  resolveExternalOverride, which a parallel test runner cannot scope per test.
- **Fix.** Add `external?: Record<string, ExternalOverride>` to
  GenerateOptions and pass it to SdkGen.
- **Check.** `testkit.test.ts` case with an external option.

### U95. Edition text made plan-dependent would be regenerated differently by CI than from the committed model

- **Fate.** Not a defect: a constraint on DQ3 (edition text follows the
  declared layout), honoured by WP23 and WP26b.
- **Class.** tooling-defect; docgen; other; 0 source files; size xs; changes
  nothing in generated output. Needs: DQ3.
- **Where.** `ts/src/content.ts:157`
- **At head.** Not a defect. A hazard for a change not made: docgen today
  reads `sdk.json` (the declared model) only, so CI and local generation
  agree.
- **Fix.** Constraint for DQ3: edition text follows the declared layout, never
  the run override.
- **Check.** none until such a change is proposed

### U96. Adding a sixth name to PHASES would silently reclassify every existing consumer copy and pack target as an SDK

- **Fate.** Repeats V13 and is resolved with it in WP13.
- **Class.** duplicated-rule; sdkgen; helper; 1 source file; size xs; changes
  generated documents. Needs: targetSurface; DQ2.
- **Where.** `ts/src/helpers/alongside.ts:4-10`
- **At head.** Present. isConsumer requires every PHASES flag to be false; a
  copy lacking a new flag fails it, the same mechanism V13 records for copies
  older than `agentguide`.
- **Fix.** Delete isConsumer in favour of targetSurface (design section 5),
  whose legacy table covers older copies.
- **Check.** V13's test; a unit test that a consumer copy missing a phase flag
  is still a consumer.

### U97. A slot added to an origin's target file never reaches its alias

- **Fate.** Repeats V30 and is resolved with it in WP13.
- **Class.** code-defect; sdkgen; action; 1 source file; size s; changes
  generated documents and code. Needs: targetSurface.
- **Where.** `ts/src/action/kind.ts:168,191`;
  `ts/src/action/doctor.ts:888-891`
- **At head.** Present. Same as V30: an alias's model file is written once and
  is exempt from updates.
- **Fix.** See V30; derivations read through origname (LEGACY\_SURFACE) so a
  missing slot falls back.
- **Check.** V30's test.

### U98. A packaged consumer is rendered under 'SDKs' by docgen unless each project sets kind

- **Fate.** Repeats U07 and is resolved with it in WP26a.
- **Class.** duplicated-rule; docgen; other; 1 source file; size xs; changes
  generated documents. Needs: targetSurface.
- **Where.** `ts/src/content.ts:160-163`
- **At head.** Present. Same code as U07.
- **Fix.** See U07.
- **Check.** U07's test.

### U99. LANG\_LABEL lacks 13 bundled languages and disagrees with target.title ('rust' in manifests, 'Rust' in README)

- **Fate.** Repeats G13 and is resolved with it in WP15.
- **Class.** duplicated-rule; sdkgen; helper; 1 source file; size xs; changes
  generated documents and code.
- **Where.** `ts/src/helpers/packageMeta.ts:14-29`
- **At head.** Present. LANG\_LABEL has ts, js, py, php, rb, lua, go and the
  three consumers; the 23 target model files all carry a title. G13 is the
  manifest symptom.
- **Fix.** langLabel reads the origin's target.title from the model and
  LANG\_LABEL is deleted (or held equal to the titles by a test).
- **Check.** A test that langLabel equals target.title for every bundled
  target; G13's manifests.

### U100. A package manifest's `parity: CONSUMER` can disagree with the target's phase flags and nothing checks it

- **Fate.** WP20.
- **Class.** tooling-defect; sdkgen; action; 1 source file; size xs; changes
  nothing in generated output. Needs: targetSurface.
- **Where.** `ts/src/helpers/manifest.ts:33,240-275`; `ts/src/action/check.ts`
- **At head.** Present. `manifest.ts` validates the tier word and coverage of
  names only; no rule compares CONSUMER with the target's phases or surface.
- **Fix.** package check requires CONSUMER exactly when
  targetSurface(...).surface is not 'sdk' (design section 5).
- **Check.** `packagecheck.test.ts`: CONSUMER on an SDK target is an error.

### U101. A pack cannot declare a new tag or closed-set value without raising its sdkgen floor, because older releases reject it

- **Fate.** WP20.
- **Class.** tooling-defect; sdkgen; helper; 1 source file; size s; changes
  nothing in generated output. Needs: targetSurface.
- **Where.** `ts/src/helpers/applicability.ts:56-66`;
  `ts/src/action/check.ts:307`
- **At head.** Present. Unknown tags are reported as error 'model-tag-unknown'
  by package check; generate's reading of them differs by release.
- **Fix.** For new closed sets (surface first): generate reads an unknown word
  as unknown and never fails; package check names the sdkgen release that
  knows the word. Past releases cannot be changed, so packs keep their floors
  (design section 13).
- **Check.** `packagecheck.test.ts`: unknown surface word is reported with the
  release that introduces it; generate does not fail.

### U102. A backtick or pipe in a feature option default breaks the REFERENCE code span or table row

- **Fate.** WP18.
- **Class.** vendor-text; sdkgen; neutral-component; 2 source files; size xs;
  changes generated documents. Needs: mdCell.
- **Where.** `ts/src/cmp/FeatureDocs.ts:47-57`;
  `ts/src/cmp/ReadmeRefFeatures.ts:78,95`
- **At head.** Present. renderValue quotes strings raw and the row writes `|
  \`\${o.name}\\` | \`\${o.value}\\` |`; latent with bundled features,
  reachable by project or pack features. V27 is the type-column half.
- **Fix.** Pass cells through mdCell and code spans through a code-span
  escaper (longer fence of backticks).
- **Check.** Section 8 table check on every generate; a featuremodel/optspec
  test with a '|' default.

### U103. A `)` or space in a vendor URL breaks the generated markdown link

- **Fate.** WP18.
- **Class.** vendor-text; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: mdInline.
- **Where.** `ts/src/cmp/ReadmeTop.ts:130-133`
- **At head.** Present. meta\_source and similar vendor URLs are spliced into
  `[...](${url})` unescaped.
- **Fix.** Wrap link targets as `<url>` or percent-encode `)` and spaces in
  one helper beside mdCell.
- **Check.** Section 8 link check; a unit test with a URL containing ')'.

### U104. A code fence inside spliced vendor text could confuse the generated README-example extractors

- **Fate.** WP18.
- **Class.** vendor-text; sdkgen; per-language-copy; 0 source files; size s;
  changes generated documents. Needs: mdInline.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeExamplesTest_<lang>.ts`
  (py, go)
- **At head.** Not settled by reading the code. Not exercised by the readers
  and no real spec case was found; the extractors split on fence lines, so it
  is plausible but unmeasured.
- **Fix.** If confirmed, mdCell/mdInline neutralise fence lines in spliced
  text.
- **Check.** A generate test with a fenced block in an entity description,
  then each target's example test.

### U105. Scaffold's commented example tagline names three languages ('from TypeScript, Go and Python')

- **Fate.** WP44a.
- **Class.** stale-mention; create-sdkgen; other; 1 source file; size xs;
  changes nothing in generated output.
- **Where.** `src/project/standard/CreateRoot.ts:110`
- **At head.** Present. A commented example in the written `text.aontu`; a
  project that uncomments it states three languages whatever targets it has.
- **Fix.** Use a tagline that names no language.
- **Check.** create-sdkgen snapshot test.

### U106. docgen overview splices the full vendor info.description (headings, HTML, pipe tables) into `SUMMARY.md`

- **Fate.** WP05a.
- **Class.** vendor-text; docgen; other; 1 source file; size xs; changes
  generated documents. Needs: mdInline.
- **Where.** `ts/src/content.ts:158,186`
- **At head.** Present. description = text.summary || info.description ||
  info.summary, passed whole to quote(); 3 of 18 real specs carry 23-122 line
  descriptions (map). G30 is the image half.
- **Fix.** Use the first paragraph (info.summary or a firstParagraph helper)
  and pass it through mdInline; keep the full text for a page of its own.
- **Check.** docgen test with a multi-heading description: `SUMMARY.md` has
  one paragraph and no heading.

### U107. apidef cuts field short descriptions at 'e.g.' or 'i.e.' (twelve real sentences)

- **Fate.** WP06.
- **Class.** vendor-text; apidef; helper; 2 source files; size s; changes
  generated documents.
- **Where.** `ts/src/utility.ts:2484-2494`; `go/utility.go:2834`
- **At head.** Present. firstSentence matches `^(.+?[.!?])(\s|$)`, so 'Use a
  code, e.g. ISO' ends at 'e.g.'; called from `ts/src/transform/field.ts:723`.
- **Fix.** Skip a stop when the preceding token is a known abbreviation (e.g.,
  i.e., etc., vs.) in both ports, with a shared TSV fixture.
- **Check.** New rows in an apidef `ts/test/*.tsv` executed by both
  `tsv.test.ts` and `go/tsv_test.go`; apidef-validate goldens refresh.

### U108. A pack feature's description is treated as docgen's own prose and can fail a project's docgen style gate

- **Fate.** WP05a.
- **Class.** vendor-text; docgen; other; 1 source file; size xs; changes
  generated documents.
- **Where.** `ts/src/content.ts:272`
- **At head.** Present. Feature descriptions are passed through prose(), the
  own-text path the QA gate checks; a pack author's wording is outside the
  project's control. Not run.
- **Fix.** Classify feature descriptions from packages as quoted (like vendor
  text) or require packs to pass the house gate in package check.
- **Check.** docgen QA test with a pack feature description containing a
  banned word.

## N. Found while designing (N01 to N24)

N01 to N16 are the sixteen defects listed in section 14 of the design note;
N17 to N24 came from the three reviews of the design.

### N01. `sdk.json` is written before generate() renames entities, so standalone docgen names entities the SDK lacks (Planet, 3dsSession)

- **Fate.** WP26a.
- **Class.** code-defect; docgen; other; 2 source files; size s; changes
  generated documents. Needs: guardModel; DQ1.
- **Where.** `ts/src/sdkgen.ts:327` (guardModelNames runs only inside
  generate()); docgen ts/bin/voxgig-docgen:17 and `ts/src/docgen.ts:427,488`
  read `.sdk/model/sdk.json` raw; the writer of `sdk.json` is `@voxgig/model`
  (not checked out)
- **At head.** Present. Opened `sdkgen.ts:314-335`: guardModelNames(model,
  log) is called inside generate() on the in-memory model only. grep of docgen
  9ca5221 finds no guardModel/guardModelNames; bin/voxgig-docgen:17 requires
  `sdk.json` directly.
- **Fix.** sdkgen exports guardModel(model, log) from `ts/src/sdkgen.ts`
  (guardModelNames plus, under DQ1, the inactive-operation pre-pass),
  idempotent on an already guarded model; docgen applies it to the parsed
  `sdk.json` in bin/voxgig-docgen and the standalone path, feature-detected
  (typeof sdkgen.guardModel) with a logger passed so the fallback notice is
  printed. Alternative the maintainer may prefer: have `@voxgig/model` write
  `sdk.json` after the guard; the design takes the docgen route.
- **Check.** docgen test: a standalone run on an `sdk.json` whose entities are
  '3ds\_session' and a case-colliding pair yields N3dsSession and the suffixed
  name, matching generate(); sdkgen `ts/test/entityname.test.ts` (or a new
  guardmodel case) asserts guardModel twice is a no-op.

### N02. Generated Config says basic: true under query or cookie placement; no PrepareAuth reads it there

- **Fate.** WP11.
- **Class.** code-defect; sdkgen; helper; 1 source file; size xs; changes
  generated code.
- **Where.** `ts/src/utility.ts:388` (configDefinition: options.auth =
  authBasic ? { prefix, basic: true } : { prefix })
- **At head.** Present. Opened `utility.ts:375-395`; the basic flag depends
  only on isHttpBasicAuth. `ts/project/.sdk/src/cmp/ts/PrepareAuth_ts.ts:123`
  gates the Basic block on spec.basic &amp;&amp; 'header' === spec.where, as
  do the other generators.
- **Fix.** Set basic: true only when the Basic branch is generated:
  isHttpBasicAuth(model) &amp;&amp; 'header' === resolveAuthIn(model)
  &amp;&amp; !isAuthSuppressed(model). Once requiredOptions exists, read
  requiredOptions(model).secret instead so Config, PrepareAuth and the
  documents share one predicate.
- **Check.** `ts/test/utility.test.ts`: configDefinition under Basic+query and
  Basic+cookie has no basic flag; `ts/test/generatedcompile.test.ts` auth
  lanes (the Basic rows near :5287 and :6038) stay green; the requiredOptions
  equality test of design section 6 holds Config to PrepareAuth.

### N03. Twelve PrepareAuth generators carry a private copy of the auth-suppression test instead of importing isAuthSuppressed

- **Fate.** Repeats V17 and is resolved with it in WP28.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 12 source files; size
  m; changes nothing in generated output.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/PrepareAuth_<lang>.ts`
  (go:312-315, py:332-335; also c, clojure, cpp, csharp:45, elixir, js:249,
  ocaml, php, rb, zig)
- **At head.** Present. grep: 8 PrepareAuth files import isAuthSuppressed; the
  other 12 each define a local function returning !(null != auth &amp;&amp;
  false === auth.active) (csharp the positive form).
- **Fix.** Replace each local function with an import of isAuthSuppressed from
  `@voxgig/sdkgen` (exported at the pack floor) and delete it; generated
  output byte-identical. Ship in the stage-3 copy wave, not alone.
- **Check.** `ts/test/generate.test.ts` output byte-identical for all 20
  targets; a new assertion in `ts/test/cleancoverage.test.ts` (or
  `featuremodel.test.ts`) that no `PrepareAuth_<lang>.ts` contains 'false ===
  auth.active'.

### N04. Thirty README components type fields with canonToType(field.t, target.name), so an aliased language documents every field as any

- **Fate.** WP28.
- **Class.** code-defect; sdkgen; per-language-copy; 30 source files; size m;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts` and
  `ReadmeRef_<lang>.ts` (go: `ReadmeEntity_go.ts:92`, `ReadmeRef_go.ts:206`;
  py: `ReadmeEntity_py.ts:103,156`); sdkgen-langpack
  `.sdk/src/cmp/dart/ReadmeRef_dart.ts:214,298` and
  `ReadmeEntity_dart.ts:108,158`
- **At head.** Present. grep at head: 54 call sites in 30 files pass
  target.name; `ts/src/helpers/canonType.ts:143-145` falls back to 'any' for
  an unknown key; `EntityTypes_go.ts:63` passes the LANG constant.
- **Fix.** Pass the language, not the installed key: each file uses its own
  language literal (the LANG constant `EntityTypes_<lang>` already declares;
  an alias keeps the file's content), e.g. canonToType(field.t, 'go'). Same in
  the pack's four dart sites in its own release.
- **Check.** New case in `ts/test/alias.test.ts`: generate with go\~go2 and
  assert the go2 README and REFERENCE field-type cells equal the go ones; the
  guard's parity relation then holds siblings.

### N05. Wording tables and exampleVarName keyed by target.name give an aliased language the TypeScript default row

- **Fate.** WP07.
- **Class.** code-defect; sdkgen; neutral-component; 2 source files; size s;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeErrors.ts:212,229`;
  `ts/src/cmp/ReadmeExplanation.ts:225,240`
- **At head.** Present. Opened both: const lang = LANGS\[target.name\] ||
  DEFAULT\_LANG, with DEFAULT\_LANG the ts row (:25, :40);
  exampleVarName(eName, target.name) at :229 and :240 applies another key's
  reserved words under an alias (compat critic, read).
- **Fix.** Key the lookups by the target's origin (originName / recorded
  origname), including exampleVarName; under stage 2 add a row for every
  bundled language and drop the default row's fenced example only, keeping its
  neutral prose (compat critic Flaw K), so an unknown origin writes no
  borrowed code. Related to S05/X1, which is the same table seen from the 13
  languages with no row.
- **Check.** `ts/test/alias.test.ts`: go\~go2 README error-handling and
  entity-state sections equal go's; the stage-0 fence-tag exact check (a fence
  in a target's document is its language or neutral);
  `ts/test/readme.test.ts:149-152` still requires an Error handling section.

### N06. go-cli and go-mcp generate without go and hard-code `../go` in README text and go.mod replace; py-data refuses

- **Fate.** WP36.
- **Class.** code-defect; sdkgen; per-language-copy; 2 source files; size s;
  changes generated documents and code. Needs: targetSurface; targetPlace;
  DQ2; DQ3.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:213,324,358`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:269,379,420`; contrast
  `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:27-33`
- **At head.** Present. Opened the three Mains: py-data throws SdkGenError
  when `targets.py` is absent; go-cli and go-mcp have no such check and write
  the literal '`../go`' and 'replace `<module>` => `../go`'.
- **Fix.** In both Mains, refuse generation as py-data does when no active
  target has origin go (targetSurface(model, name).consumed empty), and stop
  when two candidates exist unless the consumer's file names one; derive the
  sibling path from the consumed installed key and targetPlace (a relative
  path from this target's folder) instead of '`../go`'. Relocation under
  SDKGEN\_EXTERNAL (G23) follows DQ3. Copy wave.
- **Check.** `ts/test/generate.test.ts` NON\_SDK\_SIBLING cases: go-cli
  without go throws naming 'target add go'; with go\~golang the go.mod replace
  and README name `../golang`; the generate-time link check sees no dangling
  `../go`.

### N07. remove tests null != output.path while the schema default is '', so every in-tree target reads as out of tree

- **Fate.** WP11.
- **Class.** code-defect; sdkgen; helper; 1 source file; size xs; changes
  nothing in generated output.
- **Where.** `ts/src/action/remove.ts:293`
- **At head.** Present. Opened `remove.ts:169,287-311` (declared comes from
  the compiled model) and `ts/model/sdkgen.aontu:135` (path: \*'' | string).
  By reading, a compiled model also returns before the --delete-output branch,
  so an in-tree output folder is never deleted;
  `ts/test/remove.test.ts:271-283` passes because its model carries no schema
  default (not run).
- **Fix.** Treat '' as undeclared: if ('' !== (declared?.output?.path ?? '')),
  or call targetPlace(model, name) === 'external' once it exists, matching
  `ts/src/sdkgen.ts:779-782`.
- **Check.** `ts/test/remove.test.ts`: a case on a model unified with the base
  schema (output.path '') asserts the 'generated output kept' note and that
  --delete-output sets plan.output.

### N08. Root `AGENTS.md` says generate merges into existing files and never deletes; generation overwrites and prunes

- **Fate.** Repeats X5 and is resolved with it in WP17.
- **Class.** contradiction; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: modelCopyMode.
- **Where.** `ts/src/cmp/AgentGuideContent.ts:137,173`
- **At head.** Present. Opened lines 137 ('`generate` \*\*merges\*\* into
  existing files') and 173 ('\*\*Regeneration never DELETES.\*\*'); the root
  README says regeneration overwrites.
- **Fix.** Replace both paragraphs with the overwrite rule (each run rewrites
  every generated file and removes those it no longer writes), and state the
  separate `.sdk` copy rule through modelCopyMode (merge, or overwrite under
  main.kit.copies 'overwrite').
- **Check.** `ts/test/generate.test.ts` (or agentguide test): root `AGENTS.md`
  contains no 'merges into existing files' and agrees with the README's
  overwrite sentence; off relation unaffected.

### N09. 'Built-in features are log and test' false in a default project; copied `test.aontu` comment says most features start on

- **Fate.** WP34 (the feature model's comment); the sentence itself is S16 in
  WP09.
- **Class.** stale-mention; sdkgen; neutral-component; 2 source files; size
  xs; changes generated documents.
- **Where.** `ts/src/cmp/AgentGuideContent.ts:189`;
  `ts/project/.sdk/model/feature/test.aontu:13`
- **At head.** Present. Opened both lines. Of the 20 feature models only log
  has options active: true; `test.aontu:13` says 'Test mode is not active by
  default, unlike most features'.
- **Fix.** Delete the AgentGuideContent sentence (the model-driven Features
  (N) list above it already states what the project has). Rewrite the comment
  in `test.aontu` to 'Test mode is off until a client activates it' (no
  comparison); it is a project copy, so it ships in the stage-3 wave. The
  first half is S16; the comment half is new.
- **Check.** Guard off relation (feature log removed) reports nothing in
  `AGENTS.md`; ts/test/comment gate passes; doctor outdated once for
  `test.aontu` in the wave.

### N10. Base schema hook list names PreTarget and PostOperation, unused, and omits SetMatch, PrePoint, PreDone, PreUnexpected

- **Fate.** Repeats V15 and is resolved with it in WP08.
- **Class.** code-defect; sdkgen; model-schema; 1 source file; size xs;
  changes nothing in generated output.
- **Where.** `ts/model/sdkgen.aontu:233-247` (PreTarget :241, PostOperation
  :246)
- **At head.** Present. Opened the block; grep of
  `ts/project/.sdk/model/feature/*.aontu` uses PreDone, PrePoint,
  PreUnexpected, SetMatch and never PreTarget or PostOperation; outside the
  schema only the vendored `tm/ts/src/feature/secrets/plugin/FeatureHost.ts`
  names them.
- **Fix.** Make the named list the 13 hooks the pipeline fires and features
  declare: drop PreTarget and PostOperation, add SetMatch, PrePoint, PreDone,
  PreUnexpected; no comments added (density limit); align
  `docs/reference/hooks.md`.
- **Check.** New assertion in `ts/test/featuremodel.test.ts`: the schema's
  named hook keys equal the union of hook names in bundled feature models and
  the hook names the ts pipeline fires; make check-model build test.

### N11. 33 code blocks in the js README and REFERENCE are fenced ts

- **Fate.** WP37.
- **Class.** wrong-language; sdkgen; per-language-copy; 4 source files; size
  s; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/js/ReadmeRef_js.ts` (8 fences,
  :70,100,219,305,312,326,348,421);
  `ts/project/.sdk/src/cmp/js/ReadmeEntity_js.ts` (3);
  `ts/src/cmp/ReadmeErrors.ts` and `ReadmeExplanation.ts` default rows
- **At head.** Present. grep at head: `ReadmeRef_js.ts` 8 and
  `ReadmeEntity_js.ts` 3 literal \`\`\`ts fences; the neutral default rows add
  the rest. js is the one SDK target with no ReadmeExamplesTest\_js, so
  nothing classifies its blocks.
- **Fix.** Fence the js components' blocks as js (copy wave) and give js its
  own row in the origin-keyed ReadmeErrors/ReadmeExplanation tables with a js
  fence (stage 2).
- **Check.** Stage-0 fence-tag exact check in `ts/test/textguard.test.ts`;
  consider a ReadmeExamplesTest\_js so js joins the 19 targets whose generated
  suite runs its README blocks.

### N12. Generated README tests match the constructor with a non-nesting \[^()\] pattern; a parenthesis in the printed constructor fails them

- **Fate.** WP28.
- **Class.** code-defect; sdkgen; per-language-copy; 5 source files; size s;
  changes generated code.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeExamplesTest_<lang>.ts`
  (rb:205, perl:233, php:310);
  `ts/project/.sdk/src/cmp/ts/ReadmeExamplesTest_ts.ts:315-316` and
  `ReadmeExampleTest_ts.ts:32` (\[^)\]\*, shallower still)
- **At head.** Present. Opened rb:195-213: ctor\_re
  /SDK.(?:new|test)(?:\\(\[^()\]\*\\))?/ and the comment says nested parens
  are deliberately unsupported; grep finds the same shape in perl, php and ts.
- **Fix.** Match a balanced argument list: Ruby
  (?`<p>`\\((?:\[^()\]|\\`g<p>`)\*\\)), PCRE in php and perl
  (\\((?:\[^()\]++|(?1))\*\\)), a small paren-depth scanner in the ts tests.
  Must land before or with the stage-3 constructor fields, in the same wave.
- **Check.** `ts/test/generatedcompile.test.ts` README\_LANES (rb) plus
  perl/php/ts README runs: a readmeLane variant whose quick start carries
  ENV.fetch(...) or a comment with parentheses passes.

### N13. After a downgrade, doctor calls newer copies outdated and prints a refresh command that installs older copies

- **Fate.** WP12.
- **Class.** tooling-defect; sdkgen; action; 2 source files; size s; changes
  nothing in generated output.
- **Where.** `ts/src/action/doctor.ts:424-431` (doctor-outdated note),
  :963-969 (refreshCommand), :978-992 (sinceCopied); create-sdkgen re-scaffold
  rewrites `.sdk/package.json` pins under --force (`src/create-sdkgen.ts`)
- **At head.** Present. Opened `doctor.ts`: an item whose copies differ from
  the installed source with a matching fingerprint is 'outdated' whatever the
  order of the recorded 'from' and installed 'to'; refreshCommand always
  proposes package update --no-fetch or a re-add. Path not run here.
- **Fix.** In doctor, compare the copy record's from with the installed
  version (helpers/semver); when from is newer, report the copies as AHEAD of
  the installed package and tell the user to move the pin up (`package update
  @voxgig/sdkgen`), never a re-add; generate's warnCopies follows. In
  create-sdkgen, a re-scaffold does not lower a `@voxgig/*` pin below the
  version the copy record shows without saying so.
- **Check.** `ts/test/doctor.test.ts`: record from 4.45.0, installed 4.44.0 ->
  no 'outdated', no refresh command, the ahead note; create-sdkgen test:
  re-scaffold over a newer pin keeps it or warns.

### N14. Language pack floor lane failed check-package: 4.34.2 CLI imports One from shape, which resolves to 12.1.0

- **Fate.** WP45.
- **Class.** tooling-defect; sdkgen-langpack; other; 2 source files; size xs;
  changes nothing in generated output.
- **Where.** sdkgen-langpack `package.json` peerDependencies `@voxgig/sdkgen`;
  `sdkgen-package.json:8`; `.github/workflows/build.yml:93-106` (floor lane)
- **At head.** Fixed on main, and not yet released. At pack head c6069bb the
  floor is >=4.43.0; sdkgen e5090fae ('Run the CLI on shape 12') is in v4.41.1
  and later, and ts/bin/voxgig-sdkgen:7 imports only Shape, Nof, Skip. c6069bb
  is unreleased (`package.json` still 0.0.15, tag v0.0.15 precedes it).
- **Fix.** Release the pack (0.0.16) so the published floor moves; nothing
  else. Published 0.0.15 still declares >=4.34.2, whose CLI cannot run under
  shape >=12.
- **Check.** The pack's floor lane on the release commit; npm view
  `@voxgig/sdkgen-langpack` peerDependencies shows >=4.43.0.

### N15. \$\$name\$\$ in vendor descriptions is substituted in 20 of 22 generated source files

- **Fate.** Repeats G28 and is resolved with it in WP33.
- **Class.** code-defect; sdkgen; per-language-copy; 20 source files; size m;
  changes generated code. Needs: mdCell.
- **Where.** `ts/src/utility.ts:348-353` (configDefinition copies `f.h` and
  `f.sh` into the entity defs printed by every `Config_<lang>`);
  `ts/project/.sdk/src/cmp/ts/TestEntity_ts.ts` and `js/TestEntity_js.ts`
- **At head.** Present. Opened configDefinition: title and short go verbatim
  into def.entity.\*.fields, which the Config generators print; map G28
  measured substitution in 17 Config files and the ts and js entity tests,
  verbatim in ts/js Config, escaped in kotlin.
- **Fix.** At each code sink, escape \$ in vendor strings with the language's
  own string escape (kotlin already does), through one neutral per-language
  escaper keyed by origin in a NEW helper file used by the `Config_<lang>` and
  `TestEntity_ts/js` copies in the stage-3 wave; markdown sinks use
  mdCell/mdInline. The design leaves the code-sink escaper unspecified.
- **Check.** `ts/test/generate.test.ts`: a fixture field description
  containing '\$\$name\$\$' appears verbatim (unsubstituted) in every
  generated Config and entity test, and the generated sources still compile in
  the CLEAN\_LANES of `generatedcompile.test.ts`.

### N16. Generator docs list ocaml among untrimmed targets; `ocaml.aontu` sets trim: true

- **Fate.** WP09.
- **Class.** generator-docs; sdkgen; generator-docs; 2 source files; size xs;
  changes nothing in generated output.
- **Where.** `AGENTS.md:937`; `docs/how-to/add-a-feature.md:246-251`
- **At head.** Present. `ts/project/.sdk/model/target/ocaml.aontu:44-46` is
  trim: true (since 6e01e0e8); trim: false is set in clojure, scala and zig
  bundled, haskell and lean in the pack. The how-to also lists haskell and
  lean as if bundled.
- **Fix.** `AGENTS.md`: 'currently clojure, scala and zig bundled, plus
  haskell and lean in the language pack'; the how-to the same, without naming
  ocaml.
- **Check.** New assertion in `ts/test/featuremodel.test.ts` that the bundled
  targets named in `docs/how-to/add-a-feature.md` equal those whose model sets
  feature.trim false; make scan-prose.

### N17. No declared copy floor: component copies before v4.23.0 fail strict compile and pre-v1.3.18 model files do not parse

- **Fate.** WP12.
- **Class.** tooling-defect; sdkgen; action; 3 source files; size s; changes
  nothing in generated output.
- **Where.** `ts/src/action/doctor.ts` (copy-record from/to wording only);
  `ts/src/sdkgen.ts` warnCopies; `docs/explanation/copies-merge.md`
- **At head.** Present. Compat critic RAN tsc on scaffold trees at each tag
  against 4.44.0: v1.3.7 424, v4.5.3 808, v4.20.0 and v4.22.0 698 errors
  (TS2339 on apidef model types), 0 from v4.23.0; v1.3.7 `go-cli.aontu` fails
  under aontu 0.76.3 on //. grep at head: no doc or check names a floor.
- **Fix.** State the floor (components v4.23.0, model syntax v1.3.18) in
  `docs/explanation/copies-merge.md` and `docs/reference/model.md`; doctor and
  generate report a copy record from below the floor (or an unrecorded tree
  that fails compile) with the recovery 'commit, then target add `<t>`
  --force'; add a lane that strict-compiles the scaffold tree of the pack
  floor tag and of the scaffold's pinned minor (from npm pack) against head.
- **Check.** New ts/test lane (historical-tree compile, about 0.6 s per tree)
  at 4.43.0 and the pinned minor; `doctor.test.ts` case with a record from
  4.22.0.

### N18. An unrecorded project told to use --keep freezes stale copies as customized, and doctor then reports ok

- **Fate.** WP12.
- **Class.** tooling-defect; sdkgen; helper; 1 source file; size s; changes
  nothing in generated output.
- **Where.** `ts/src/helpers/copymerge.ts:263-272` (no record counts as
  edited), :420-423 (--keep records incoming as base), :528-547 (failure
  message offers --keep first); `ts/src/action/copies.ts:185-192` (ignoredLog)
- **At head.** Present. Opened `copymerge.ts`: under --keep a 'nobase'
  conflict is pushed to outcome.kept and bases.set(rel, incoming), so doctor
  sees local != recorded base and classes it customized. Compat critic RAN
  M7k: add completes, doctor ok with 3 customized and the update absent; M7f
  (--force) arrives.
- **Fix.** For a 'nobase' conflict the stop message recommends 'commit, then
  --force' and does not offer --keep; --keep on a nobase file records it as
  unrecorded (no base), so doctor keeps reporting it.
  `docs/explanation/copies-merge.md` states the path.
- **Check.** `ts/test/copymerge.test.ts`: a nobase conflict re-run with --keep
  leaves doctor not ok; message text asserts --force advice for nobase.

### N19. --keep records the incoming copy as base without checking the fold, so doctor passes a tree tsc refuses (TS2305)

- **Fate.** WP12.
- **Class.** tooling-defect; sdkgen; helper; 1 source file; size s; changes
  nothing in generated output.
- **Where.** `ts/src/helpers/copymerge.ts:420-423,543-545`
- **At head.** Present. Opened `copymerge.ts`: the message says fold by hand
  then --keep; nothing checks the fold. Compat critic RAN M6k: a kept
  `utility_ts.ts` plus an incoming `ReadmeTopQuick_ts.ts` importing a new
  export -> doctor ok, strict compile TS2305.
- **Fix.** Ship new helpers as new files in a wave (design section 9 rule)
  and, in the tool, have generate/doctor flag a kept file whose content lacks
  the incoming copy's exported names, or run the project's strict
  check-scaffold after an add that kept files and report the compile error
  naming the kept file.
- **Check.** `ts/test/copymerge.test.ts`: the M6k scenario reports a finding
  naming the kept file instead of ok.

### N20. A project whose model lacks the test feature generates silently; its SDK fails at run time and its suites go red

- **Fate.** Repeats S11 and is resolved with it in WP22.
- **Class.** omission; sdkgen; action; 2 source files; size s; changes nothing
  in generated output.
- **Where.** `ts/src/sdkgen.ts:314-335` (generate pre-checks);
  `ts/src/action/doctor.ts:593-597` (test assumed in the expected feature
  set); `ts/project/.sdk/src/cmp/ts/fragment/Main.fragment.ts:325,344`
  (test()/tester() unconditional)
- **At head.** Present. grep: target add installs test (`target.ts:133`),
  remove refuses it (`remove.ts:179`), but neither generate nor doctor reports
  its absence; design note 13 measured ts failing at construction and go on
  every request. The maintainer critic notes the unconditional test() against
  ADR-002.
- **Fix.** generate and doctor report an error naming 'target add `<t>`' when
  an active SDK target's model has no active-declared test feature (design
  note 13 default); no document is gated on the feature; ADR-002's exception
  for test()/tester() is stated in the ADR rather than left implicit.
- **Check.** `ts/test/doctor.test.ts` and a `generate.test.ts` case: a model
  without feature.test fails with the named command.

### N21. Language pack splices vendor field descriptions raw into dart and haskell README table cells

- **Fate.** WP41.
- **Class.** code-defect; sdkgen-langpack; per-language-copy; 6 source files;
  size s; changes generated documents. Needs: mdCell.
- **Where.** `.sdk/src/cmp/dart/ReadmeRef_dart.ts:213-214`;
  `.sdk/src/cmp/dart/ReadmeEntity_dart.ts:107`;
  `.sdk/src/cmp/dart/ReadmeModel_dart.ts:136`;
  `.sdk/src/cmp/haskell/ReadmeEntity_haskell.ts:111`;
  `.sdk/src/cmp/haskell/ReadmeModel_haskell.ts:146`;
  `.sdk/src/cmp/haskell/ReadmeRef_haskell.ts:210`
- **At head.** Present. grep at c6069bb: `field.sh` || '' goes straight into a | cell in six places; mdCell does not exist in sdkgen 4.43.0, the pack
  floor.
- **Fix.** Pack half of G27: call mdCell, read through a namespace import with
  a fallback that leaves the text raw (or a local copy of the escaper) until
  the floor reaches the release exporting mdCell; the generate-time table
  check warns meanwhile.
- **Check.** Pack test with a description containing a pipe and a newline:
  every table row keeps its header's cell count; sdkgen's doc-table-broken
  warning silent.

### N22. No README lane renders constructor fields: no lane model has HTTP Basic or a templated server URL

- **Fate.** WP01.
- **Class.** test-gap; sdkgen; test; 2 source files; size s; changes nothing
  in generated output.
- **Where.** `ts/test/generatedcompile.test.ts:8798-8960` (README\_LANES and
  readmeLane variants); `ts/test/generateharness.ts` (fixture declares no
  servers)
- **At head.** Present. Read README\_LANES (rb, go, lua, py) and the
  readmeLane variants (patch, search, keys, selector-load, shadowed,
  action-list, parented-create, underscore-id, idless-update): none adds
  config.auth basic or info.servers; grep of `generateharness.ts` finds no
  servers.
- **Fix.** Add one README-lane model with Basic in the header and a templated
  URL (one variable defaulted, one not) to README\_LANES and the ts README
  run, and a templated URL to the generation fixture, before the stage-3
  constructor changes.
- **Check.** The new lane rows run green and their README shows apikey, secret
  and server; the stage-0 baseline digest shows the constructor note.

### N23. The root plan is stated six times and the statements disagree on root documents, target.active and output.root

- **Fate.** WP02.
- **Class.** duplicated-rule; sdkgen; helper; 6 source files; size m; changes
  nothing in generated output. Needs: DQ3.
- **Where.** `ts/src/testkit.ts:565-600` (defaultRoot: no phase.top,
  phase.build or root-with-top refusal); create-sdkgen
  `project/standard/.sdk/src/RootPlan.ts:20-54` and `Root.ts`; create-sdkgen
  `project/standard/.sdk/admin/check-drift.sh:57`; the suite's makeRoot; the
  pack's docs Root
- **At head.** Present. Opened `testkit.ts` defaultRoot (filters target.active
  and refuses two output.root, ignores `phase.top/build`) against
  `RootPlan.ts` rootPlan (honours `phase.top/build`, refuses output.root with
  top). create-sdkgen `test/rootplan.test.ts` pins the call in `Root.ts`
  (maintainer critic).
- **Fix.** sdkgen exports rootPlan (moved from create-sdkgen with its test);
  testkit.defaultRoot, the suite's Root, the text-guard harness and the pack's
  docs Root call it; create-sdkgen's `Root.ts` imports it in the release that
  moves its pin (stage 4), deleting `RootPlan.ts`.
- **Check.** `ts/test/testkit.test.ts`: defaultRoot with phase.top off writes
  no root README; create-sdkgen `rootplan.test.ts` follows the import.

### N24. No test pins the published export surface; b4cd6877 removed a published export and the suite passed

- **Fate.** WP01.
- **Class.** test-gap; sdkgen; test; 1 source file; size xs; changes nothing
  in generated output.
- **Where.** `ts/src/sdkgen.ts` (export block); ts/test (no export-surface
  test)
- **At head.** Present. git show 55cdc135 restores alongsideNote 'as 4.42.0
  publishes it' two minutes after b4cd6877 dropped it; grep of ts/test finds
  only targeted imports of alongsideNote, no list of exports.
- **Fix.** Add `ts/test/exports.test.ts` holding the runtime export names of
  the last release as a committed list; a removal fails, an addition requires
  adding the name (and its `docs/reference/api.md` entry). Every stage-1
  derivation joins the list.
- **Check.** The new test fails when any listed name is removed from
  `dist/sdkgen.js`.

## M. Found while prototyping (M01 to M49)

Found by the six prototypes run against the design. Many repeat an N entry
from the side of the measurement that exposed it.

### M01. Under a language alias, generated text still prints the origin key as a path: cd go, TAG := go/v, `../go`

- **Fate.** WP32.
- **Class.** code-defect; sdkgen; per-language-copy; 10 source files; size m;
  changes generated documents and code. Needs: targetSurface; targetPlace;
  docLink.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeHowto_<lang>.ts` literal
  `cd <key> &&` (go:173, ts:183; also js:176, lua:152, php:159, py:142,
  rb:160); `ts/project/.sdk/tm/go/Makefile:26`;
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:213,324,358`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:269,379,420`
- **At head.** Present. Opened each line at head: seven ReadmeHowto copies
  hard-code their own key in the cd line while the other 13 use
  \${target.name}; tm/go/Makefile:26 is `TAG := go/v$(VERSION)`; both Go
  consumers print `../go` in prose and in the go.mod replace. guard-stage's
  go\~fz run measured 49 such lines in 39 files that its `renamed` relation
  could not see.
- **Fix.** In the seven ReadmeHowto copies write `cd ${dir}` from
  targetPlace/docLink (dropping the line when the place is external), as the
  other 13 copies already do with target.name. Make the Go Makefile tag prefix
  a placeholder that Main\_go fills with the installed folder name (a Go
  submodule tag must be `<dir>/vX`). In `Main_go-cli/Main_go-mcp` take the
  sibling path from targetSurface(model, self).consumed\[0\] (installed key)
  instead of the literal `go`, for the go.mod replace and the three README
  sentences each.
- **Check.** link relation (cd from the document directory or tree root) on an
  alias variation; new assertion in `ts/test/alias.test.ts` that after `target
  add go~fz` no generated file names `go` as a path segment (cd go, go/v,
  `../go`) outside comments

### M02. Aliased go-cli/go-mcp missed by literal-key sites: alias listed as an SDK, MCP section vanishes, row notes lost

- **Fate.** WP13.
- **Class.** code-defect; sdkgen; neutral-component; 4 source files; size s;
  changes generated documents. Needs: targetSurface; DQ2.
- **Where.** `ts/src/cmp/ReadmeTop.ts:146-147,156-157,165,450-453`;
  `ts/src/helpers/alongside.ts:20-23`;
  `ts/src/cmp/AgentGuideContent.ts:26-28,37`; `ts/src/helpers/mcpTools.ts:23`
- **At head.** Present. Read the cited lines at head: hasCli/hasMcp, the sort
  slots, isCliOrMcp and alongsideNote all compare t.name with
  'go-cli'/'go-mcp'. guard-stage ran a real `target add go-cli~cli`: 22
  documents (47 lines) differ after mapping back; go-mcp\~go-mcq drops the
  whole '\#\# Use it from an AI agent (MCP)' section.
- **Fix.** Replace every name comparison with targetSurface(model,
  name).surface ('cli'/'mcp'); mcpTools takes the installed key of the mcp
  surface instead of defaulting to 'go-mcp'; LANG\_CMD and LANG\_LABEL stay
  origin-keyed tables read through originName (the facts prototype showed
  these two cannot take a surface read). Delete isConsumer.
- **Check.** new `ts/test/alias.test.ts` case: generate with go-cli\~go-clj
  and go-mcp\~go-mcq (same length, same sort slot) and require byte equality
  with the baseline after mapping the alias back; the off relation with
  surface words derived from the declared surface

### M03. Schema default docs\_order lists installed target keys, so an aliased language loses its documentation order

- **Fate.** WP13.
- **Class.** code-defect; sdkgen; model-schema; 2 source files; size xs;
  changes generated documents. Needs: targetSurface.
- **Where.** `ts/model/sdkgen.aontu:8`; `ts/src/cmp/ReadmeTop.ts:150-157`
- **At head.** Present. `sdkgen.aontu:8` is `docs_order:
  *['ts','py','php','go','rb','lua'] | [&: string]`; ReadmeTop orders targets
  by index in that list and puts go-cli/go-mcp after it by literal name.
  guard-stage flagged it as a key held in the schema.
- **Fix.** In ReadmeTop sort by docsOrder.indexOf(originName(model, name)) so
  an alias takes its origin's slot, and place consumers by targetSurface
  instead of by literal key. Keep the schema default as origin names (no new
  comment line in `sdkgen.aontu`: the file is at the comment-gate limit).
- **Check.** assertion in `ts/test/alias.test.ts` that go\~go2 sorts where go
  sorts in the root README install table

### M04. Thirty per-language README components pass target.name to canonToType; an aliased language documents every field as any

- **Fate.** Repeats N04 and is resolved with it in WP28.
- **Class.** code-defect; sdkgen; per-language-copy; 30 source files; size m;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts` and
  `ReadmeRef_<lang>.ts` (go:92, go:206; ts:92, ts:236); same class:
  `ts/project/.sdk/src/cmp/<lang>/Schema_<lang>.ts` header comment
  `${target.Name} SDK` (go:36, py:25)
- **At head.** Present. grep at head: 30 files call canonToType(field.t,
  target.name); `EntityTypes_go.ts` passes the constant LANG. guard-stage
  measured 15+15 rows of `any` for go installed as fz.
- **Fix.** Each copy passes its own language constant (as `EntityTypes_<lang>`
  does) instead of target.name; the Schema header comment names the language
  title, not the installed Name. Lands in the stage-3 copy wave.
- **Check.** source lint (design note 8.2 extension): no `target.name`
  argument to canonToType/LANGS/EXAMPLE tables under
  `ts/project/.sdk/src/cmp`; `ts/test/alias.test.ts` field-type assertion for
  go\~fz

### M05. Neutral wording tables keyed by target.name give an aliased Go README the TypeScript try/catch row

- **Fate.** Repeats N05 and is resolved with it in WP07.
- **Class.** code-defect; sdkgen; neutral-component; 2 source files; size s;
  changes generated documents.
- **Where.** `ts/src/cmp/ReadmeErrors.ts:212`;
  `ts/src/cmp/ReadmeExplanation.ts:225`
- **At head.** Present. Both read `LANGS[target.name] || DEFAULT_LANG` at
  head; guard-stage saw an aliased Go README get a ts-fenced try/catch
  section.
- **Fix.** Key by originName(model, target.name), give every bundled language
  its own row and delete the default row (stage 2 'wording tables keyed by
  origin, no default row'); a target with no row writes no section.
- **Check.** fence check (a fence tag is the target's language or neutral) in
  `ts/test/textguard.test.ts`; alias case in `ts/test/alias.test.ts`

### M06. go-cli and go-mcp generate without go (or with go aliased/relocated) and still point at `../go`

- **Fate.** Repeats N06 and is resolved with it in WP36.
- **Class.** code-defect; sdkgen; per-language-copy; 2 source files; size s;
  changes generated code. Needs: targetSurface.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:213,324,358`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:269,379,420`; compare
  `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:30`
- **At head.** Present. py-data throws 'py-data requires the `py` target' at
  `Main_py-data.ts:30`; neither Go consumer has such a check (grep 'requires
  the' at head). guard-core found 5 such lines in the go-absent state.
- **Fix.** Both Go consumer Mains throw the same error as py-data when
  targetSurface(model, self).consumed is empty, and take the sibling directory
  from consumed\[0\] (with M01).
- **Check.** `ts/test/featuremodel.test.ts` or a new consumer case: generating
  go-cli without go fails with the named error

### M07. target remove prints 'generates out of tree ()' for every in-tree target

- **Fate.** Repeats N07 and is resolved with it in WP11.
- **Class.** code-defect; sdkgen; action; 1 source file; size xs; changes
  nothing in generated output. Needs: targetPlace.
- **Where.** `ts/src/action/remove.ts:293`
- **At head.** Present. Line 293 at head is `if (null !=
  declared?.output?.path)`; the schema default is ''.
- **Fix.** Test `'' !== (declared?.output?.path ?? '')`, or better
  targetPlace(model, name) === 'external'.
- **Check.** `ts/test/remove.test.ts`: an in-tree target remove carries no
  out-of-tree note

### M08. With no active entity, 17 READMEs and go-cli print table headers with no rows; ts/js lead-in has nothing after it

- **Fate.** WP31.
- **Class.** code-defect; sdkgen; per-language-copy; 22 source files; size m;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeModel_<lang>.ts` 'Entity
  interface' table (go:129-135, ts:125-127);
  `ts/project/.sdk/src/cmp/ts/ReadmeModel_ts.ts:137-140` and
  `js/ReadmeModel_js.ts:116` ('an entity's `data()` reads its record:');
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:257-262` (Words table)
- **At head.** Present. guard-core classed these as true and outside the map's
  confirmed list (6 distinct lines, 23 raw; 1 line, 2 raw). Opened the go/ts
  ReadmeModel tables and the go-cli Words table: header written
  unconditionally, rows from a loop.
- **Fix.** Write the header and lead-in only when the row list is non-empty
  (opRows, returnBullets, verbRows); otherwise write nothing for that section.
  Stage 3 copy wave for the per-language part; go-cli in the same wave.
- **Check.** exact check 'no table header stands without rows' (design note 7
  and 8) on the empty-entity variation in `ts/test/textguard.test.ts`

### M09. targetOrigins classes a project-owned target as bundled, so the ungenerated-ops warning speaks for it

- **Fate.** WP13.
- **Class.** code-defect; sdkgen; action; 2 source files; size s; changes
  nothing in generated output.
- **Where.** `ts/src/action/resolve.ts:357-389`;
  `ts/src/helpers/opShape.ts:479-505`
- **At head.** Present. resolvesBundled returns true for a bare ref, and a
  project-owned target has empty base, so it lands in origins.bundled; the
  facts prototype measured {bundled:\[bash,go\]} for a project-owned bash.
- **Fix.** Give targetOrigins a third answer, owned, decided where
  Source.owned is decided in `resolve.ts`; warnUngeneratedOps names owned
  targets as not judged, like external ones (design note section 6,
  'targetOrigins gains a third answer').
- **Check.** unit test in `ts/test/resolve.test.ts` (or `opshape.test.ts`): a
  model with a project-owned target returns it under owned and the warning
  does not list it as bundled

### M10. The secrets feature model alone declares no active: true, so feature add secrets installs it inactive

- **Fate.** WP34.
- **Class.** omission; sdkgen; target-or-feature-model; 1 source file; size
  xs; changes generated code. Needs: maintainer intent.
- **Where.** `ts/project/.sdk/model/feature/secrets.aontu:2-8`;
  `ts/model/sdkgen.aontu:187`; `ts/src/action/target.ts:131-134`
- **At head.** Present. `grep -L '^ active: true'` over the feature models
  returns only `secrets.aontu` (and the index); the schema default is \*false,
  and target add copies only features with active !== false, so its source is
  never copied. guard-stage observed a real feature add secrets leaving it
  inactive.
- **Fix.** Add `active: true` to `secrets.aontu` like every other feature, or,
  if inactive-on-add is intended, say so in `docs/reference/features.md` and
  make feature add print it. Confirm intent with the maintainer.
- **Check.** `ts/test/featuremodel.test.ts`: every bundled feature model
  declares active (or the exception is listed with a reason)

### M11. A project without the test feature generates without error and its SDK fails at run time ('fc is not a constructor')

- **Fate.** Repeats S11 and is resolved with it in WP22; its run-time half is
  covered by the generate-time error of WP22, for every language at once.
- **Class.** code-defect; sdkgen; neutral-component; 3 source files; size s;
  changes generated code.
- **Where.** `ts/src/sdkgen.ts` (generate: no check);
  `ts/src/action/doctor.ts` (no check);
  `ts/project/.sdk/src/cmp/ts/fragment/Config.fragment.ts:19-20` and
  `Config.data.fragment.ts:22-23`
- **At head.** Present. `target.ts:131-134` installs test on every add and
  `remove.ts:179-183` refuses removing it, so the state needs a hand edit;
  ops-claims ran it: ts throws TypeError 'fc is not a constructor', go blocks
  every request, generated suites fail (ts 49, go 29).
- **Fix.** generate() and doctor report an error when an active target with a
  test phase lacks the test feature, naming `voxgig-sdkgen target add <t>`;
  the ts Config fragment throws a named error for an unknown feature class. No
  document is gated on the feature (design note section 13).
- **Check.** new case in `ts/test/generate.test.ts` (generate fails with the
  named error) and in `ts/test/doctor.test.ts`

### M12. ts/js READMEs print secret under Basic in query/cookie placement, and two live constructors omit the required server

- **Fate.** WP29.
- **Class.** code-defect; sdkgen; per-language-copy; 8 source files; size s;
  changes generated documents. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/src/cmp/ts/ReadmeHowto_ts.ts:90-99` (tester and
  extend constructors); `ts/ReadmeModel_ts.ts:52,66`; `ts/ReadmeRef_ts.ts:81`;
  `ts/ReadmeTopQuick_ts.ts:28`; `ts/ReadmeQuick_ts.ts`;
  `js/ReadmeHowto_js.ts:144`
- **At head.** Present. `ReadmeHowto_ts.ts:91` is `authActive &&
  isHttpBasicAuth(model)` with no placement term; auth-ctor measured secret
  printed under query placement where no PrepareAuth has the branch, and 'Add
  custom middleware' printing new DemoSDK({apikey, secret, extend}) which
  throws for a templated URL.
- **Fix.** Every ts/js component that prints a constructor reads
  requiredOptions(model): secret only when it is present (Basic, header
  placement, not suppressed); a server block with the required variables in
  the tester and extend constructors too. Port all five ts sites in one commit
  so the README never disagrees with itself.
- **Check.** parity relation plus a README-lane model with Basic in the query
  and a templated URL (see M43) in `ts/test/generatedcompile.test.ts`

### M13. go, java and py quick starts print a defaulted server variable as if it were required (as ts does)

- **Fate.** Repeats G01 and is resolved with it in WP29.
- **Class.** code-defect; sdkgen; per-language-copy; 6 source files; size s;
  changes generated documents. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeQuick_<lang>.ts` and
  `ReadmeTopQuick_<lang>.ts` (go:27-31, go Top:27-31; java, py)
- **At head.** Present. `ReadmeQuick_go.ts:27` maps every serverVariables
  entry into the block; auth-ctor table 4.4 shows go, java and py print the
  defaulted region; the map's G01 names ts only.
- **Fix.** Print only requiredOptions(model).server.vars where required is
  true (referenced, no default), in all four languages, and drop the block
  when none is required.
- **Check.** parity relation on the templated-URL variation; README-lane model
  of M43

### M14. go quick start indents the "server" line four spaces short of "apikey"

- **Fate.** WP29.
- **Class.** code-defect; sdkgen; per-language-copy; 2 source files; size xs;
  changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/go/ReadmeQuick_go.ts:29-31`;
  `ts/project/.sdk/src/cmp/go/ReadmeTopQuick_go.ts:29-31`
- **At head.** Present. Line 29 writes `\n "server"` (4 spaces) while line 34
  writes `\n "apikey"` (8 spaces).
- **Fix.** Indent goServerField by eight spaces to match the apikey line
  (gofmt form); do it in the stage-3 wave with M13.
- **Check.** go README lane runs gofmt -l on extracted blocks, or a string
  assertion in `ts/test/generate.test.ts`

### M15. A missing server variable panics (go, rust, zig) or abort()s (c) instead of a catchable error

- **Fate.** WP40.
- **Class.** code-defect; sdkgen; template; 4 source files; size s; changes
  generated code. Needs: maintainer decision on the constructor error contract
  in go, rust, zig and c.
- **Where.** `ts/project/.sdk/tm/go/utility/make_options.go:171-173`;
  `tm/rust/utility/make_options.rs:144-149`;
  `tm/zig/core/utility.zig:835-840`; `tm/c/utility/make_options.c:124-128`
- **At head.** Present. Opened the four sites: panic, panic!, std.debug.panic
  and fprintf+abort(). The other 16 bundled runtimes throw a named
  server\_var\_required error (auth-ctor table 4.3).
- **Fix.** Either return the error through the constructor in these four (an
  API change: go's `New<Name>SDK` and rust's constructor return no error
  today) or document the panic as the contract in each README's constructor
  section. Maintainer decision; if changed, it is a template change in the
  copy wave.
- **Check.** SERVER\_LANES in `ts/test/generatedcompile.test.ts` (already
  covers c, cpp) extended to go, rust and zig

### M16. Language pack dart acts on auth.basic whatever the placement, always in the authorization header

- **Fate.** WP41.
- **Class.** code-defect; sdkgen-langpack; template; 1 source file; size xs;
  changes generated code. Needs: N02.
- **Where.** `.sdk/tm/dart/lib/utility/PrepareAuthUtility.dart:5,39-60`
- **At head.** Present. Opened at c6069bb: HEADER\_auth is 'authorization' and
  the Basic branch runs on `true == auth.basic` with no placement test; with
  N02 (Config basic: true under query placement) dart sends a header the API
  does not read, while the 20 bundled targets emit no Basic branch there.
- **Fix.** Gate the dart Basic branch on the header placement (and the
  configured header name), as the 12 explicit bundled generators do; better,
  fix N02 so Config carries basic only under header placement, and dart
  follows.
- **Check.** pack test in `test/langpack.test.js`: Basic under query placement
  does not set the authorization header

### M17. Language pack haskell has no HTTP Basic branch and no secret option

- **Fate.** WP42.
- **Class.** omission; sdkgen-langpack; template; 2 source files; size s;
  changes generated code. Needs: requiredOptions.
- **Where.** `.sdk/tm/haskell/src/SdkRuntime.hs` (prepareAuth; no secret
  option); `.sdk/src/cmp/haskell/Config_haskell.ts`
- **At head.** Present. grep 'secret' in `SdkRuntime.hs` at c6069bb finds only
  redaction keys (lines 228, 242, 502); auth-ctor read no Basic branch. A
  Basic API generates a haskell SDK that sends the apikey alone.
- **Fix.** Port the Basic branch (base64 of apikey:secret, header placement
  only) and the secret option into the haskell runtime and its option spec,
  per parity; until then the pack README must not print a secret.
- **Check.** pack parity test against the bundled PrepareAuth corpus case;
  haskell lane (ghc) in the pack CI

### M18. Language pack lean has no server option and leaves an unfilled {variable} in the request URL silently; no Basic

- **Fate.** WP42.
- **Class.** omission; sdkgen-langpack; template; 2 source files; size m;
  changes generated code. Needs: requiredOptions.
- **Where.** `.sdk/src/cmp/lean/Config_lean.ts:40-62`;
  `.sdk/tm/lean/src/SdkUtility.lean:415-448,1207-1241`
- **At head.** Present. Config\_lean writes options {base, headers, entity}
  and auth {prefix} only; auth-ctor read that makeOptions resolves no server
  variable and the placeholder check excludes the base. The 22 other runtimes
  fail on an unresolved variable.
- **Fix.** Add the server option and the shared run-time rule (referenced, no
  default -> error; test mode -> `test-<name>`) and the Basic branch to the
  lean runtime; until then lean's README prints no server or secret sentence.
- **Check.** pack test: a templated URL with no value fails at construction in
  lean

### M19. Language pack lean root quick start constructs the client with no apikey when auth is active

- **Fate.** WP41.
- **Class.** code-defect; sdkgen-langpack; per-language-copy; 1 source file;
  size xs; changes generated documents. Needs: requiredOptions.
- **Where.** `.sdk/src/cmp/lean/ReadmeTopQuick_lean.ts:13`; compare
  `.sdk/src/cmp/lean/ReadmeQuick_lean.ts:26`
- **At head.** Present. `ReadmeTopQuick_lean.ts:13` always writes `Sdk.newSdk
  (← emptyMap)` with no isAuthActive test, while `ReadmeQuick_lean.ts:26`
  pushes the apikey option; auth-ctor saw 'tutorial yes, root no'.
- **Fix.** Share the option-building lines between the two lean quick starts,
  reading isAuthActive (and requiredOptions once exported at the pack floor
  via namespace read).
- **Check.** parity relation over the pack's own output, or a pack test that
  the root quick start carries the apikey line when auth is on

### M20. Infrastructure pack floor lane fails check-package: sdkgen 4.33.0 CLI imports One, shape resolves to 12

- **Fate.** WP04.
- **Class.** tooling-defect; sdkgen-infrapack; other; 2 source files; size xs;
  changes nothing in generated output.
- **Where.** `package.json:113,117` (peer and dev floor >=4.33.0);
  `.github/workflows/build.yml:92-131`
- **At head.** Present. Read v4.33.0:ts/bin/voxgig-sdkgen: `const { Shape,
  One, Skip } = require('shape')` and its peer `shape >=11.4.1`; the infra
  floor lane pins only sdkgen and apidef then runs check-package. Same
  mechanism floor measured in the language pack; not run here.
- **Fix.** Raise the infrastructure pack's floor to >=4.41.1 (the first sdkgen
  off One) in `package.json` peer/dev and `sdkgen-package.json` engines, or
  pin `shape@11.4.1` and `jostraca@0.41.0` in the floor lane.
- **Check.** the pack's floor lane green on a fresh install (no lockfile)

### M21. Language pack floor lane failed check-package at 4.34.2 (shape 12)

- **Fate.** Repeats N14 and is resolved with it in WP45.
- **Class.** tooling-defect; sdkgen-langpack; other; 2 source files; size xs;
  changes nothing in generated output.
- **Where.** `package.json:84,90`; `sdkgen-package.json` engines
- **At head.** Fixed on main, and not yet released. At c6069bb the pack peers
  and dev-depends on `@voxgig/sdkgen` >=4.43.0 and engines.sdkgen >=4.43.0,
  above 4.41.1, so the floor lane no longer installs a CLI that imports One.
- **Fix.** None needed; carry the same fix to the infrastructure pack (M20).
- **Check.** pack floor lane

### M22. Published sdkgen below 4.41.1 resolves shape 12 and fails 'One is not a function' on a fresh install

- **Fate.** WP12.
- **Class.** tooling-defect; sdkgen; other; 0 source files; size xs; changes
  nothing in generated output. Needs: maintainer: npm deprecate.
- **Where.** registry releases &lt;=4.41.0 (`ts/package.json` peer `shape >=11.4.1` at those tags, e.g. v4.33.0); head `ts/package.json:99` is `shape >=12`
- **At head.** Present. floor measured: a project pinned \~4.40.1 with no
  lockfile installs 4.40.1 with shape 12.1.0 and both doctor and package
  update exit 1; \~4.41.0 resolves 4.41.1 and works. Published versions cannot
  change.
- **Fix.** npm deprecate the affected range with a message naming the fix
  (move the pin to \~4.41.1 or later by hand; package update cannot run
  there), and add the case to docs/how-to on upgrading. Release dispatch and
  deprecation need the maintainer.
- **Check.** npm view `@voxgig/sdkgen@4.40.1` deprecated shows the message

### M23. Reverse skew: copies newer than the installed package fail TS2305 and doctor calls them outdated

- **Fate.** Repeats N13 and is resolved with it in WP12; its scaffold half (no
  lowering of a pin on re-scaffold) is in WP44a.
- **Class.** tooling-defect; sdkgen; action; 2 source files; size s; changes
  nothing in generated output.
- **Where.** `ts/src/action/doctor.ts:975-995` (sinceCopied); create-sdkgen
  `project/standard/.sdk/package.json` pin
- **At head.** Present. sinceCopied at head prints 'from `<pkg>` `<from>`, but
  `<pkg>` `<to>` is installed' with no version comparison; floor reproduced
  state G: package update, re-scaffold with an older create-sdkgen --force,
  then generate fails TS2305 on introOps.
- **Fix.** Doctor compares the recorded copy version with the installed one;
  when the copy is newer it says the pin must move forward and prints `package
  update @voxgig/sdkgen`, never a refresh to older copies. The scaffold
  refuses (or warns) on a re-scaffold whose pin is below the copies' recorded
  version. Bundled copies read new exports through a namespace import in the
  wave that first uses them.
- **Check.** `ts/test/doctor.test.ts` case with a copy record newer than the
  package; create-sdkgen test for the re-scaffold guard

### M24. Re-scaffold after package update conflicts on `.sdk/package.json` because the scaffold's devDependencies are unsorted

- **Fate.** WP44a.
- **Class.** tooling-defect; create-sdkgen; template; 1 source file; size xs;
  changes nothing in generated output. Needs: create-sdkgen release owner.
- **Where.** `project/standard/.sdk/package.json` (devDependencies order)
- **At head.** Present. At 6fe1759 devDependencies are `@types/node`,
  typescript, `@voxgig/apidef`, ..., jostraca, aontu, `@voxgig/docgen` (not
  sorted); floor measured npm rewriting the file sorted, after which a
  re-scaffold exits 1 on that file which nobody edited.
- **Fix.** Sort dependencies and devDependencies in the scaffold's
  `package.json` and make `build/toolchain.js` keep them sorted; add a
  create-sdkgen test that the scaffold file's keys are sorted. The other
  session owns the next create-sdkgen release.
- **Check.** test in create-sdkgen test/ asserting sorted keys; re-scaffold
  after package update exits 0

### M25. Scaffold Root installs ctx\$.util.makeFlow, which nothing reads

- **Fate.** WP44a.
- **Class.** code-defect; create-sdkgen; template; 1 source file; size xs;
  changes nothing in generated output. Needs: create-sdkgen release owner.
- **Where.** `project/standard/.sdk/src/Root.ts:49,148-260`
- **At head.** Present. grep makeFlow over sdkgen ts/src and the scaffold
  components, both packs and docgen: no reader; only `Root.ts` defines and
  installs it.
- **Fix.** Delete makeFlow, makeFlowStep and the util assignment from the
  scaffold Root in the release that moves Root to sdkgen's rootPlan.
- **Check.** create-sdkgen build and its Root test; sdkgen suite unaffected

### M26. Six executable statements of the root plan disagree on top documents, target.active and output.root

- **Fate.** WP02.
- **Class.** duplicated-rule; sdkgen; helper; 6 source files; size m; changes
  nothing in generated output. Needs: targetPlace; create-sdkgen release
  owner.
- **Where.** create-sdkgen `project/standard/.sdk/src/RootPlan.ts:20-54` with
  `Root.ts` and `Top.ts`; `ts/src/testkit.ts:565`;
  `ts/test/generateharness.ts:2166`; `ts/test/generated.test.ts:424-442`;
  create-sdkgen `project/standard/.sdk/admin/check-drift.sh:57-65`;
  sdkgen-langpack `test/langpack.test.js:124`
- **At head.** Present. Opened the function heads at head; floor's table 4.4:
  defaultRoot writes no top documents, makeRoot writes six always and ignores
  target.active and output.root, the pack's docsRoot writes ReadmeTop only. A
  link guard over the pack lane reports 8 dangling links for that reason.
- **Fix.** Export rootPlan from sdkgen; the scaffold Root (in the release that
  moves create-sdkgen's pin), testkit.defaultRoot (opt-in top documents, so
  pack suites are not changed silently), makeRoot, `check-drift.sh` and the
  pack's docsRoot call it; create-sdkgen's rootplan tests move to sdkgen.
- **Check.** one test in ts/test (`rootplan.test.ts`) run against every
  caller's output for the same model; link relation on the harness

### M27. sdkgen's own `AGENTS.md` says generate merges into existing files; generation overwrites

- **Fate.** WP17.
- **Class.** generator-docs; sdkgen; generator-docs; 1 source file; size xs;
  changes nothing in generated output.
- **Where.** `AGENTS.md:479-486`
- **At head.** Present. `AGENTS.md:483` '\*\*Merge gotcha:\*\* `generate`
  merges into existing files' while the same file links regeneration-overwrite
  and `docs/how-to/customize-and-propagate-templates.md:90` says 'Regeneration
  is overwrite, not merge'. ops-claims noted it beside the generated root
  `AGENTS.md` defect.
- **Fix.** Rewrite the paragraph: generate overwrites; an add merges or
  overwrites by main.kit.copies; the ProjectName leak advice moves to the add
  step. Same commit as the generated `AGENTS.md` correction (N08).
- **Check.** read; `tools/check_prose.py` does not cover `AGENTS.md`, so
  review only

### M28. sdkgen `AGENTS.md` lists ocaml and lean as bundled untrimmed targets

- **Fate.** Repeats N16 and is resolved with it in WP09.
- **Class.** stale-mention; sdkgen; generator-docs; 1 source file; size xs;
  changes nothing in generated output.
- **Where.** `AGENTS.md:937-938`
- **At head.** Present. `AGENTS.md` says '(currently clojure, lean, ocaml,
  scala, zig bundled, plus lean in the language pack)'; at head only clojure,
  scala and zig declare trim: false (`ocaml.aontu:45` is trim: true) and lean
  is packaged.
- **Fix.** Name clojure, scala and zig as bundled, and haskell and lean in the
  language pack (ops-claims), or say 'see the target files' without a list.
- **Check.** read

### M29. `sdk.json` is written before generate() renames entities; standalone docgen names entities the SDK lacks

- **Fate.** Repeats N01 and is resolved with it in WP26a; fixed through
  guardModel and docgen; no change to @voxgig/model.
- **Class.** code-defect; voxgig-model; other; 2 source files; size s; changes
  generated documents. Needs: guardModel; DQ1.
- **Where.** `@voxgig/model` `src/model.ts:124-137` (producer order) and
  `src/producer/model.ts:66-100`; docgen ts/bin/voxgig-docgen (reads
  `.sdk/model/sdk.json`); `ts/src/sdkgen.ts:327-332` (guards)
- **At head.** Present. guard-stage ran voxgig-model at 4.44.0: write-model
  precedes post-actions sdkgen and the guard renames; `SUMMARY.md` differs in
  16 lines between build and standalone (Planet2 vs Planet). Producer order
  read in `@voxgig/model` 12.0.2.
- **Fix.** Export guardModel(model, log) from sdkgen (guardModelNames,
  guardFlowSteps and, under DQ1, dropping inactive ops); docgen's standalone
  generate applies it to `sdk.json` when the resolved sdkgen exports it.
- **Check.** docgen test: standalone and in-build `SUMMARY.md` identical for a
  model the guard renames

### M30. Config says basic: true under query or cookie placement while no PrepareAuth reads it

- **Fate.** Repeats N02 and is resolved with it in WP11.
- **Class.** code-defect; sdkgen; helper; 1 source file; size xs; changes
  generated code. Needs: requiredOptions.
- **Where.** `ts/src/utility.ts:388`
- **At head.** Present. `utility.ts:388` sets basic: true from authBasic with
  no placement term; auth-ctor generated 160 PrepareAuth files: the branch
  exists only under header placement.
- **Fix.** Set basic only when credentialPlacement is header and auth is not
  suppressed (the requiredOptions secret rule), so Config, PrepareAuth and
  documents agree; dart (M16) then follows.
- **Check.** generated-output check: Config carries basic exactly when
  PrepareAuth reads secret (design note section 6)

### M31. Twelve PrepareAuth generators re-derive the auth-suppression test instead of importing isAuthSuppressed

- **Fate.** Repeats V17 and is resolved with it in WP28.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 12 source files; size
  m; changes nothing in generated output.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/PrepareAuth_<lang>.ts` local
  function (go:312, py:332; c:38, js:246)
- **At head.** Present. auth-ctor: 12 of 20 carry a local copy, 8 import
  isAuthSuppressed; generated output agrees today by inspection.
- **Fix.** Import isAuthSuppressed in the 12 copies in the copy wave (new
  helper rule does not apply: the export exists).
- **Check.** source lint: no local isAuthActive-named function in
  `PrepareAuth_<lang>.ts`

### M32. Root `AGENTS.md` says generate merges into existing files; generation overwrites

- **Fate.** Repeats X5 and is resolved with it in WP17.
- **Class.** contradiction; sdkgen; neutral-component; 1 source file; size xs;
  changes generated documents. Needs: modelCopyMode.
- **Where.** `ts/src/cmp/AgentGuideContent.ts:137`
- **At head.** Present. Line 137 at head: '`generate` \*\*merges\*\* into
  existing files'.
- **Fix.** Three sentences from modelCopyMode: generate overwrites and prunes;
  an add merges or replaces by main.kit.copies; a re-scaffold follows the same
  value.
- **Check.** agree on the phrase pair bound to 'generate'

### M33. 'Built-in features are log and test' false in a default project; `test.aontu` comment says most features start on

- **Fate.** Repeats N09 and is resolved with it in WP34; the sentence half is
  S16 in WP09.
- **Class.** stale-mention; sdkgen; neutral-component; 2 source files; size
  xs; changes generated documents.
- **Where.** `ts/src/cmp/AgentGuideContent.ts:189`;
  `ts/project/.sdk/model/feature/test.aontu:13`
- **At head.** Present. Both lines at head; ops-claims staged a
  target-add-only project: feature dir holds base and test only; 19 of 20
  features start off.
- **Fix.** AgentGuideContent: name no feature, or list targetFeatures(model)
  actually installed; `test.aontu` comment: 'Test mode is not active by
  default, like most features' (copy wave).
- **Check.** off relation in a real-add staged case (fixture copies every
  template)

### M34. Base schema hook list names PreTarget and PostOperation and omits PrePoint, PreDone, PreUnexpected, SetMatch

- **Fate.** Repeats V15 and is resolved with it in WP08.
- **Class.** code-defect; sdkgen; model-schema; 1 source file; size xs;
  changes nothing in generated output.
- **Where.** `ts/model/sdkgen.aontu:234-247`
- **At head.** Present. Opened at head: the hook block lists PreTarget and
  PostOperation; `docs/reference/hooks.md` and the feature models use
  PrePoint, PreDone, PreUnexpected (debug, metrics, telemetry, cost, audit).
- **Fix.** List the hooks the pipeline fires (the six stages plus
  PreUnexpected, SetMatch and the Post/Get/Set hooks) without comment lines
  (comment-gate limit).
- **Check.** test comparing the schema hook list with the hook markers and
  `docs/reference/hooks.md`

### M35. 33 code blocks in js README and REFERENCE are fenced ts

- **Fate.** Repeats N11 and is resolved with it in WP37.
- **Class.** wrong-language; sdkgen; per-language-copy; 4 source files; size
  s; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/js/ReadmeRef_js.ts` (70, 100, 219, 305,
  312, 326, 348, 421); `js/ReadmeEntity_js.ts:114,124,141`;
  `ts/src/cmp/ReadmeErrors.ts:212` and `ReadmeExplanation.ts:225` default row
- **At head.** Present. grep at head: 8 \`\`\`ts fences in `ReadmeRef_js.ts`
  and 3 in `ReadmeEntity_js.ts`; js has no row in the neutral tables so it
  takes the TypeScript default. guard-core counted 12 of 27 README and 21 of
  21 REFERENCE blocks.
- **Fix.** Fence js blocks \`\`\`js in the two js copies (copy wave) and add a
  js row to the origin-keyed neutral tables (M05).
- **Check.** fence check in the text guard

### M36. Generated README tests match the constructor with \[^()\]\* or \[^)\]\*: a parenthesis inside it fails the suite

- **Fate.** Repeats N12 and is resolved with it in WP28.
- **Class.** code-defect; sdkgen; per-language-copy; 4 source files; size s;
  changes generated code.
- **Where.** `ts/project/.sdk/src/cmp/rb/ReadmeExamplesTest_rb.ts:205`;
  `perl/ReadmeExamplesTest_perl.ts:233`; `php/ReadmeExamplesTest_php.ts:310`;
  `ts/ReadmeExamplesTest_ts.ts:315-316`
- **At head.** Present, in a different form or place than first recorded. N12
  names rb only; at head perl and php use the same `[^()]*` and ts uses
  `\([^)]*\)`; lua already uses balanced %b().
- **Fix.** Match the constructor call with balanced parentheses (a small
  scanner, as lua's %b() and go/py do) in all four copies; until then no
  printed constructor text contains a parenthesis.
- **Check.** README-lane model whose constructor comment holds a parenthesis
  (M43) in ts, rb; perl and php have no sdkgen lane

### M37. \$\$ in vendor text is substituted in table cells and in 20 of 22 generated source files

- **Fate.** Repeats G28 and is resolved with it in WP33.
- **Class.** code-defect; sdkgen; per-language-copy; 60 source files; size l;
  changes generated documents and code. Needs: mdCell; mdInline.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts`,
  `ReadmeRef_<lang>.ts`, `ReadmeModel_<lang>.ts` cell sinks (ts
  `ReadmeModel_ts.ts:193`); source sinks in `Config_<lang>`
  (`c/core/config.c`, `kotlin/core/Config.kt` renders \\\$\\\$)
- **At head.** Present. guard-stage prose run: 'Flow rate of \$\$name\$\$'
  becomes 'demo' in 60 cells and 20 of 22 source files; `cpp/core/config.hpp`
  chunks the literal.
- **Fix.** mdCell/mdInline at document sinks (function replacer writing
  \$&amp;\#36;); at source sinks escape \$\$ before Content, or emit via a
  fixed-placeholder-free path, in the copy wave.
- **Check.** generate-time table check plus a prose token fixture with
  \$\$name\$\$ in `ts/test/textguard.test.ts`

### M38. A pipe or line break in a field description breaks 120 rows and cuts 60 more; the third ts sink is ReadmeModel

- **Fate.** Repeats G27 and is resolved with it in WP33.
- **Class.** code-defect; sdkgen; per-language-copy; 60 source files; size l;
  changes generated documents. Needs: mdCell.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts`,
  `ReadmeRef_<lang>.ts` and `ReadmeModel_<lang>.ts` (ts:92, ts:236, ts
  ReadmeModel:193)
- **At head.** Present. guard-stage: 120 rows in 40 files from two piped
  descriptions; after patching two ts sinks the five remaining findings named
  `ReadmeModel_ts.ts:193`.
- **Fix.** Pass every description at a table sink through mdCell (pipe to \\|,
  newline to `<br>`), three sinks per language.
- **Check.** generate-time 'doc-table-broken' check (row ends as its header,
  belongs to a table with a header)

### M39. Operation-level active: false is undeclared in any schema and ignored by code; two comments claim otherwise

- **Fate.** Repeats G05 and is resolved with it in WP21.
- **Class.** code-defect; sdkgen; model-schema; 3 source files; size s;
  changes generated documents and code. Needs: DQ1; guardModel.
- **Where.** `ts/model/sdkgen.aontu:177-182` (no op active slot);
  `ts/project/.sdk/src/cmp/ts/Entity_ts.ts:41-63`;
  `ts/src/helpers/opShape.ts:402-406`; `ts/src/helpers/definitionPlan.ts:76`
- **At head.** Present. ops-claims: a flagged remove still resolves in the
  generated ts SDK; `opShape.ts:404` says 'an `active: false` op generates no
  method' and `definitionPlan.ts:76` 'gets no method', both false today.
- **Fix.** Under DQ1 (recommended): a pre-pass in guardModel drops inactive
  ops before Root; declare `op: &: active: *true | boolean`; the flow guard
  logs the dropped step as info. If DQ1 goes the other way, delete the two
  false comments and stop introductions honouring the flag.
- **Check.** `ts/test/inactiveops.test.ts` (prototype): flagged op output
  equals a never-declared op

### M40. Relocating py by the run override fails the whole generation (py-data refuses)

- **Fate.** Repeats G22 and is resolved with it in WP36.
- **Class.** code-defect; sdkgen; per-language-copy; 1 source file; size s;
  changes generated code. Needs: targetSurface; targetPlace; DQ3.
- **Where.** `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:30`;
  `ts/src/sdkgen.ts` (external pass filtering)
- **At head.** Present. guard-stage plan run: SDKGEN\_EXTERNAL={py:...} fails
  with 'py-data requires the `py` target', with or without the DQ4 prototype.
- **Fix.** py-data reads its sibling through targetSurface(...).consumed over
  the declared model and targetPlace for the path; decide with DQ3.
- **Check.** `ts/test/external.test.ts` case relocating py

### M41. A four-flag go-cli copy (pre-agentguide) is classed as an SDK by isConsumer

- **Fate.** Repeats V13 and is resolved with it in WP13.
- **Class.** code-defect; sdkgen; neutral-component; 2 source files; size xs;
  changes generated documents. Needs: targetSurface; DQ2.
- **Where.** `ts/src/helpers/alongside.ts:8-10`;
  `ts/src/cmp/ReadmeTop.ts:165-167`
- **At head.** Present. guard-stage and facts: with the v1.3.7 go-cli file
  (comments converted) the root README says '... Go CLI SDKs' and an
  optional-component-missing warning appears.
- **Fix.** targetSurface's legacy step answers from the origin table for
  bundled consumers of any age; isConsumer is deleted.
- **Check.** unit test of targetSurface on stored old copies (comments
  migrated)

### M42. Copies older than v4.23.0 (and v1.3.7 model files with // comments) cannot generate, and nothing says so

- **Fate.** Repeats N17 and is resolved with it in WP12.
- **Class.** tooling-defect; sdkgen; action; 2 source files; size s; changes
  nothing in generated output.
- **Where.** `ts/src/action/doctor.ts`; `ts/src/sdkgen.ts` (generate entry);
  docs/how-to (upgrade)
- **At head.** Present. Measured by the prototypes (design note section 5):
  v1.3.7 `go-cli.aontu` fails aontu 0.76.3 with 'unexpected character(s): //';
  trees before v4.23.0 fail the strict compile with 424 to 808 errors; v4.20.0
  rb copies crash on entity.fields. Not re-run here.
- **Fix.** Doctor and generate read the recorded copy version (or detect a
  missing copy record) and report copies below the oldest supported release,
  naming `target add <t>` (commit, then --force) as the fix, instead of a raw
  aontu or tsc error.
- **Check.** `ts/test/doctor.test.ts` with a stored old copy

### M43. No README lane model has auth on or a templated server URL, so no lane renders a constructor field

- **Fate.** WP01.
- **Class.** test-gap; sdkgen; test; 1 source file; size s; changes nothing in
  generated output.
- **Where.** `ts/test/generatedcompile.test.ts:8798-8990` (README\_LANES),
  :9203 (DOC\_LANES), :1089-1146 (ts loop)
- **At head.** Present. auth-ctor read every lane model; README\_LANES at 8798
  iterate fixed models (crud, search, keyword, selector). One 14-line model
  (Basic in header, one undefaulted and one defaulted variable) covered ts, rb
  and go in 10 s. perl and php execute README blocks with no sdkgen lane;
  executing suites rewrite the constructor, so fields are only type-checked.
- **Fix.** Add the Basic+templated-URL model (and a Basic-in-query one) to the
  ts loop, README\_LANES and DOC\_MODELS before any constructor printer
  change; add perl and php README lanes.
- **Check.** the new lane cases themselves

### M44. Nothing pins sdkgen's export list; a removed export passes the suite

- **Fate.** Repeats N24 and is resolved with it in WP01.
- **Class.** test-gap; sdkgen; test; 1 source file; size xs; changes nothing
  in generated output.
- **Where.** `ts/src/sdkgen.ts` (export block); no test in ts/test
- **At head.** Present. grep in ts/test for an export snapshot finds none;
  facts added 16 exports with no failure; the map's K4 records one export
  removed with a green build.
- **Fix.** Add `ts/test/exports.test.ts` comparing the sorted export names
  (value and type) with a committed list; a removal fails, an addition
  requires updating the list.
- **Check.** the new test

### M45. The generation fixture reads target files unsubstituted, so every target carries base 'BASE'

- **Fate.** WP01.
- **Class.** test-gap; sdkgen; test; 1 source file; size s; changes nothing in
  generated output.
- **Where.** `ts/project/.sdk/model/target/go.aontu:8` (base: 'BASE');
  `ts/test/generateharness.ts`
- **At head.** Present. `go.aontu:8` is `base: 'BASE'`; facts found every
  fixture target with that base, so no provenance or owner rule can fail in
  the fixture.
- **Fix.** Add one fixture built through the real provenance stamp
  (provenanceReplace, as a target add writes), and one project-owned target
  with empty base.
- **Check.** targetOrigins and targetSurface tests run on that fixture

### M46. docgen peers sdkgen >=4.25.0 but needs modelText (4.34.1); below it drops main.kit.text silently; no floor lane

- **Fate.** WP26a.
- **Class.** tooling-defect; docgen; other; 3 source files; size s; changes
  nothing in generated output.
- **Where.** `ts/package.json:65`; `ts/src/content.ts:5,143-146`;
  `.github/workflows/build.yml`
- **At head.** Present. At 9ca5221 the peer is >=4.25.0, `content.ts:145`
  falls back to main.kit.info when modelText is absent, and `build.yml` has no
  floor matrix; floor ran docgen 0.30.9 beside sdkgen 4.25.0: project wording
  ignored, no output.
- **Fix.** Raise docgen's sdkgen floor to the release that exports what it
  imports (>=4.34.1, or the first exporting targetSurface/guardModel when
  adopted) and add a floor lane like the packs'; if the fallback stays, report
  it.
- **Check.** docgen floor lane

### M47. docgen's standalone command passes no logger, so its report and any fallback notice are never printed

- **Fate.** WP05a.
- **Class.** tooling-defect; docgen; other; 1 source file; size xs; changes
  nothing in generated output.
- **Where.** ts/bin/voxgig-docgen:14-18; `ts/src/docgen.ts:403-410`
- **At head.** Present. The bin calls generate({folder, model, control}) with
  no log; docgen's only log call is log?.info?.() in report().
- **Fix.** Pass a console-backed log from the bin (info to stdout, warn to
  stderr).
- **Check.** docgen test running the bin and reading its output

### M48. docgen counts any target outside its three-name table as an SDK: a Seneca provider is listed as one

- **Fate.** WP26a.
- **Class.** code-defect; docgen; other; 1 source file; size s; changes
  generated documents. Needs: targetSurface; surface vocabulary word for
  seneca-provider.
- **Where.** `ts/src/content.ts:160-163,171-172`
- **At head.** Present. surface() returns kind, else the origname table
  {go-mcp, go-cli, py-data}, else 'sdk'; floor's case table: seneca-provider
  (all phases off) and a project-owned wrapper read 'sdk' and go into sdks/
  with client defaults.
- **Fix.** docgen reads kind first, then targetSurface when the resolved
  sdkgen exports it, then its present table; the infrastructure pack declares
  seneca-provider's surface once the closed vocabulary has a word for it.
- **Check.** docgen test: a target with all phases off and no kind is not
  counted as an SDK target

### M49. target add slows with each installed target (0.42 s first, 1.6 to 1.9 s for the 23rd)

- **Fate.** WP12.
- **Class.** tooling-defect; sdkgen; action; 1 source file; size s; changes
  nothing in generated output.
- **Where.** `ts/src/action/target.ts` (cause not located)
- **At head.** Not settled by reading the code. guard-stage measured three
  23-target stages at 28.3 to 28.8 s with per-add cost growing; the cause was
  not profiled.
- **Fix.** Profile a 23-target staging; likely a per-add recompile or re-walk
  of every installed tree (doctor/scan). Fix only if a cause is found.
- **Check.** timing assertion is unsuitable; a profile before and after

## D. Rules derived in more than one place (the 23 rated high)

Each is one fact about the model that several places work out for themselves.
The 50 rated medium or low follow in a table.

### D01. Which targets are active/generated is decided by nine private filters on four different inputs (raw map, filtered model, disk, run override)

- **Fate.** WP14.
- **Class.** duplicated-rule; sdkgen; neutral-component; 10 source files; size
  m; changes generated documents. Needs: targetPlace; docLink; DQ3.
- **Where.** `ts/src/helpers/alongside.ts:16-17`;
  `ts/src/cmp/ReadmeTop.ts:144`; `ts/src/cmp/AgentGuideContent.ts:98`;
  `ts/src/cmp/Deploy.ts:19`; `ts/src/cmp/PublishWorkflow.ts:28`;
  `ts/src/action/resolve.ts:335`; `ts/src/admin/status.ts:57`;
  `ts/src/sdkgen.ts:382` (withoutExternal) and :793-804;
  create-sdkgen:`project/standard/.sdk/src/RootPlan.ts:31-35`;
  docgen:`ts/src/content.ts:111-115`
- **At head.** Present. Opened `alongside.ts:16-17` (raw map, null guard,
  `false !== t.active`), `ReadmeTop.ts:144` (`t.active !== false` after
  getModelPath on a model withoutExternal has stripped) and create-sdkgen
  `RootPlan.ts:31-35` (the only one that also yields root/folder placement);
  `status.ts:57` adds disk presence.
- **Fix.** Add one exported active-target view beside targetPlace in a new
  `ts/src/helpers/place.ts` (design section 6): the sorted keys of
  main.kit.target that are non-null and not `active: false`, with
  targetPlace(model,name) giving folder|root|external and docLink answering
  whether this pass wrote the target. alongsideNote, ReadmeTop,
  AgentGuideContent, Deploy, PublishWorkflow, `resolve.ts` and
  `admin/status.ts` call it (status keeps its disk check on top).
  create-sdkgen's RootPlan delegates to the exported function once its sdkgen
  pin carries it; docgen's rows() for targets calls it when docgen adopts the
  derivations. The in-tree pass keeps receiving withoutExternal's model, but
  documents ask docLink rather than infer absence from the model.
- **Check.** `link` relation of the text guard over the target-removed and
  phase-off variations; a new test in ts/test (beside `helpers.test.ts`)
  holding targetPlace over every guard variation equal to the plan the guard
  harness Root follows (the same plan create-sdkgen's RootPlan computes).

### D02. Target surface (SDK/CLI/MCP/data) decided four ways: literal key, origname, five phase flags, docgen kind; aliases misclassed

- **Fate.** WP13.
- **Class.** duplicated-rule; sdkgen; neutral-component; 8 source files; size
  m; changes generated documents. Needs: targetSurface; DQ2.
- **Where.** `ts/src/helpers/alongside.ts:8-10` (isConsumer) and :20-23
  (literal 'go-cli'/'go-mcp'); `ts/src/cmp/ReadmeTop.ts:146-147`, :156-157,
  :165-170, :451-453; `ts/src/cmp/AgentGuideContent.ts:26-32` (LANG\_CMD);
  `ts/src/helpers/packageMeta.ts:22-24`, :175, :215-217;
  `ts/src/helpers/mcpTools.ts:23` (default 'go-mcp');
  `ts/test/generate.test.ts:120-126` (NON\_SDK\_SIBLING);
  docgen:`ts/src/content.ts:160-162` (surface())
- **At head.** Present, in a different form or place than first recorded.
  Opened `alongside.ts` and `ReadmeTop.ts` at head: both still match the
  installed key literally, while docgen `content.ts:160` matches origname with
  a `kind` override. The language pack's literal sibling sentence (map V9) is
  gone at sdkgen-langpack c6069bb, whose intros now export only
  ReadmeIntroBody inside sdkgen's frame.
- **Fix.** Add targetSurface(model,name) in `ts/src/helpers/packageMeta.ts`
  beside originName (design section 5-6), with the absence rule slot ->
  LEGACY\_SURFACE by origin -> 'sdk' if it generates entities -> unknown.
  Delete isConsumer (`'sdk' !== surface`); alongsideNote and ReadmeTop's
  hasCli/hasMcp/isCliOrMcp/ordering and the MCP section read surface; mcpTools
  takes the installed key from targetSurface instead of defaulting to
  'go-mcp'; LANG\_CMD notes keyed by surface; NON\_SDK\_SIBLING,
  NON\_SDK\_TARGETS and CONSUMER\_TARGETS read the scaffold's target files;
  package check requires parity CONSUMER to agree with surface != sdk;
  docgen's surface() calls the export. Under DQ2 recommended,
  go-cli/go-mcp/py-data model files declare `surface` and `consumes` in the
  copy wave; under the alternative, LEGACY\_SURFACE alone answers and no copy
  changes.
- **Check.** Test holding LEGACY\_SURFACE equal to the three bundled consumer
  files; `ts/test/generate.test.ts:1838` (alongsideNote cases) rewritten to
  cover an aliased go-mcp and an unknown surface; `off` relation with surface
  words ('CLI','MCP') once declared; package check test for parity/surface
  disagreement.

### D04. Which features a target has: six predicates plus literal lists '(Base, Test, Log)' and 'Built-in features are log and test'

- **Fate.** WP34.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 42 source files; size
  l; changes generated documents.
- **Where.** `ts/src/cmp/ReadmeTop.ts:595` (each(feature), truthy, no
  applicability); `ts/src/cmp/ReadmeExplanation.ts:224` and :303-304;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeRef_<lang>.ts` (ts:52, py:372; 20
  files); `ts/src/cmp/ReadmeStation.ts:28-32`;
  `ts/src/cmp/AgentGuideContent.ts:104-109` and :189;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeExplanation_<lang>.ts` tree comment
  (ts, rust:29; 18 files); `ts/src/cmp/FeatureDocs.ts:60-65`
- **At head.** Present. Opened `ReadmeTop.ts:593-600` (`if (!feat.active)
  return` over the raw map), `AgentGuideContent.ts:189` ('Built-in features
  are `log` and `test`'); grep finds the tree comment naming base/test/log in
  18 `ReadmeExplanation_<lang>` files (13 'Base, Test, Log', 5 lowercase),
  elixir and clojure excepted.
- **Fix.** Keep targetFeatures (`ts/src/helpers/applicability.ts:32`) as the
  home of 'which features this target has' and featureDocs (`FeatureDocs.ts`)
  as its only documentation view (drops base, sorted). ReadmeTop's Advanced
  table calls featureDocs(model) per SDK target union; ReadmeExplanation,
  AgentGuideContent's activeFeatures and the 20 `ReadmeRef_<lang>` call
  featureDocs(model,target) instead of re-filtering on truthy active;
  ReadmeStation looks its feature up through targetFeatures. Delete the
  sentence at `AgentGuideContent.ts:189` (neutral). In the copy wave, the 18
  tree comments read '\# Feature implementations' with no feature named.
- **Check.** Design section 6 equality test (targetFeatures keys == keys of
  configDefinition(m,t).def.feature over the five fixtures) plus a new
  assertion that featureDocs(model,t) == targetFeatures minus base; `off`
  relation for the log/test variations (S15, S16); the tree comment is caught
  by `off` only in a real-add case.

### D05. 'Inactive until you switch it on' is a constant in six writers; only AgentGuideFeature reads config.options.active, and log starts on

- **Fate.** Repeats S09 and is resolved with it in WP16.
- **Class.** duplicated-rule; sdkgen; neutral-component; 8 source files; size
  s; changes generated documents. Needs: featureOnByDefault.
- **Where.** `ts/src/cmp/ReadmeFeatures.ts:29`;
  `ts/src/cmp/ReadmeRefFeatures.ts:24` and :133;
  `ts/src/cmp/ReadmeTop.ts:245-246`; `ts/src/cmp/ReadmeStation.ts:50`;
  `ts/src/cmp/AgentGuideTop.ts:88`; `ts/src/cmp/AgentGuideFeature.ts:31` (the
  one correct reader); docgen:`ts/src/content.ts:594`, :664
- **At head.** Present. Opened `AgentGuideFeature.ts:31` (`true ===
  feature?.config?.options?.active`) and the constant sentences at
  `ReadmeFeatures.ts:29`, `ReadmeRefFeatures.ts:24`, `ReadmeTop.ts:246`;
  docgen `content.ts:594` and :664 assert features are switched off.
- **Fix.** Add featureOnByDefault(model,name) in
  `ts/src/helpers/applicability.ts` beside targetFeatures, exported from
  `ts/src/sdkgen.ts`; `AgentGuideFeature.ts:31` moves to it. Each of the six
  sdkgen writers prints one sentence derived from it: 'off until you switch it
  on' only when every feature the sentence covers is off, otherwise names the
  ones on by default (e.g. 'All but `log` start off'). docgen's two sentences
  call the export when docgen adopts it.
- **Check.** Design section 6 test: featureOnByDefault equals
  configDefinition(m,t).def.feature\[f\].options.active for every target and
  feature over the five fixtures; the exact check 'a sentence says features
  start off only when every feature it covers does' joins the guard in the
  same commit.

### D10. Which operations exist: key presence, active, and active-and-callable in circulation; inactive ops kept by code, dropped by intros

- **Fate.** WP31.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 64 source files; size
  l; changes generated documents and code. Needs: DQ1; guardModel.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts` (ts:41
  Object.keys; go:45 entityOps; 19 raw);
  `ts/project/.sdk/src/cmp/<lang>/ReadmeRef_<lang>.ts` (ts:199; 19 raw);
  `ts/project/.sdk/src/cmp/<lang>/ReadmeModel_<lang>.ts` (ts:20-22 inline
  opUnion; 20 files); `ts/src/cmp/ReadmeTop.ts:315` and :514 (two inline
  copies); `ts/src/helpers/opShape.ts:407-431` (CANON\_OP\_ORDER, entityOps,
  introOps); `ts/src/helpers/flowGuard.ts:18` (five ops);
  `ts/src/cmp/AgentGuideFeature.ts:41`;
  `ts/project/.sdk/src/cmp/<lang>/Entity_<lang>.ts` (ts:41-65);
  sdkgen-langpack:`.sdk/src/cmp/lean/ReadmeIntro_lean.ts:8-9` (literal six)
- **At head.** Present, in a different form or place than first recorded.
  Opened `ReadmeEntity_ts.ts:41` (Object.keys(entity.op)),
  `ReadmeEntity_go.ts:44` (entityOps), `ReadmeTop.ts`:315/:514 (inline active
  filters). The pack's dart intro now calls introOps (c6069bb); lean's intro
  still lists six verbs literally.
- **Fix.** Take DQ1's recommendation: a pre-pass before Root (carried to
  docgen by guardModel) removes every `op.<x>.active: false`, so key presence,
  active and introOps agree by construction for code and documents alike. Then
  the remaining distinction is 'plainly callable' (opNeedsAction): the 19
  ReadmeEntity/ReadmeRef and 20 ReadmeModel copies call entityOps (per entity)
  and introOps (union) in the copy wave; `ReadmeTop.ts:315` and :514 call
  introOps; `AgentGuideFeature.ts:41` and lean's intro derive the verbs from
  introOps. flowGuard's five-op vocabulary gains patch or states why not
  (V20). If DQ1 is answered the other way (switch kept meaningful but
  ignored), every code generator (20 `Entity_<lang>`, 16 EntityTypes, Config
  op map, flow tests) must also filter on active, a far larger copy change.
- **Check.** DQ1 prototype assertion: output with an inactive op is
  byte-identical to the never-declared op in five states; `parity` relation
  across ReadmeEntity siblings; `reaction` on the op-removed variations;
  X7/S23-S25 lines disappear from the guard's findings.

### D22. Auth on/off: isAuthActive, isAuthSuppressed, 12 private copies, docgen's info-only read; consumers always require an API key

- **Fate.** WP28.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 18 source files; size
  l; changes generated documents and code. Needs: requiredOptions; DQ6.
- **Where.** `ts/src/utility.ts:24` (isAuthActive), :48 (isAuthSuppressed),
  :101 (isHttpBasicAuth);
  `ts/project/.sdk/src/cmp/<lang>/PrepareAuth_<lang>.ts` private copies
  (go:312 isAuthActive\_go, py:332; 12 files);
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:66-68`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:152-155`;
  `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:246`;
  `ts/src/helpers/definitionPlan.ts:56-57`;
  docgen:`ts/src/content.ts:230-232`, :658
- **At head.** Present. Opened `utility.ts:24-52` (two deliberate predicates)
  and `PrepareAuth_go.ts`:31/:312 (a local `isAuthActive_go` that computes
  suppression); go-cli Main:66-68 builds `<ENV>_APIKEY` with no auth test.
- **Fix.** Keep the two exported predicates as the only homes, each with its
  stated meaning (isAuthActive: documents and Config; isAuthSuppressed:
  credential code). The 12 `PrepareAuth_<lang>` import isAuthSuppressed
  (design section 14.3) in the copy wave. Documents and the three consumers
  derive what to print from requiredOptions (apikey present iff auth active):
  go-cli/go-mcp help, README env table and py-data's credential section are
  gated on it (DQ6 covers their run-time strings). docgen calls isAuthActive
  instead of reading info.security alone.
- **Check.** `off` relation on auth-off and auth-inactive variations (S35-S37,
  G06, G09, G12); the existing `ts/test/cleancoverage.test.ts` plus a grep
  guard that no `PrepareAuth_<lang>` defines its own auth predicate; design
  section 6 assertion that the generated PrepareAuth reads `secret` exactly
  when requiredOptions.secret holds.

### D23. What the constructor needs: apikey in 20 quick starts, server variables in 4, Basic secret in ts only; docgen hard-codes apikey

- **Fate.** WP29.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 60 source files; size
  l; changes generated documents. Needs: requiredOptions.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeTopQuick_<lang>.ts`
  (ts:25-37, go:27); `ts/project/.sdk/src/cmp/<lang>/ReadmeQuick_<lang>.ts`;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeModel_<lang>.ts` (ts:52-72, js:54);
  `ts/src/cmp/ReadmeTop.ts:80-96`;
  `ts/project/.sdk/src/cmp/ts/TestEntity_ts.ts:93-110` (tests per target);
  docgen:`ts/project/.sdk/tm/edition/github-pages/sdk-setup.json:2-24` and
  `presentation/sdk-setup.json`
- **At head.** Present. Opened `ReadmeTopQuick_ts.ts:22-42`: secret is printed
  on isHttpBasicAuth alone (no header-placement or suppression test), every
  server variable is labelled 'Required'; both docgen `sdk-setup.json` files
  exist and are static.
- **Fix.** Add requiredOptions(model) in `ts/src/utility.ts` beside
  isHttpBasicAuth (design section 6): apikey when auth active, secret when
  Basic AND header placement AND not suppressed, server.vars with required =
  referenced and no default. All 40 quick-start components and the
  ReadmeModel/ReadmeRef option rows print from it in the copy wave, each in
  its own language's syntax; the test generators (TestEntity/TestDirect) take
  the same input. docgen generates sdk-setup snippets from the export instead
  of the two static JSON files. No neutral sentence lists constructor options
  (design section 13: haskell/lean lack secret/server).
- **Check.** `parity` relation across the 20 ReadmeTopQuick siblings (it found
  the server and Basic omissions on today's code); generated-output assertion
  that the PrepareAuth reads `secret` exactly when requiredOptions.secret;
  `ts/test/generatedcompile.test.ts` README compile lanes for c/cpp/rust/zig
  with Basic and a templated server.

### D25. Environment-variable names: envToken vs go-cli/go-mcp per-character rule vs docgen; suffixes literal; tests read names docs never mention

- **Fate.** WP30.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 25 source files; size
  m; changes generated documents and code.
- **Where.** `ts/src/helpers/packageMeta.ts:398-405` (envToken, envName);
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:66-68` and :402-403;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:152-155` and :459-460;
  `ts/src/helpers/serverVars.ts:60` (serverVarEnv);
  `ts/project/.sdk/src/cmp/ts/TestEntity_ts.ts:91-96` and :188;
  `ts/src/helpers/stdrep.ts:9` (PROJECTENV);
  docgen:`ts/src/sdk-reference.ts:9`;
  sdkgen-langpack:`.sdk/src/cmp/lean/ReadmeQuick_lean.ts:26`
- **At head.** Present. Opened envToken (collapses runs, trims edges) and
  go-cli Main:66 / go-mcp Main:154 (`toUpperCase().replace(/[^A-Z0-9]/g,'_')`,
  no collapse, no trim): a slug with a doubled or edge hyphen gives the SDK
  and the CLI/MCP binary different variable names (V7).
- **Fix.** envName stays the only prefix rule; go-cli and go-mcp call
  envName(model). Add whole-name helpers beside it in `packageMeta.ts` (an
  envVar(model, suffix) and an entity-id name beside serverVarEnv) so
  `_APIKEY`, `_SECRET`, `_BASE`, `_TEST_LIVE`, `_SERVER_<VAR>` and
  `_TEST_<ENT>_ENTID` are spelled once; test generators and the how-to 'Run
  tests' sections in each language name the variables their tests read (G07).
  docgen calls envName. lean's bare token and unprefixed SDK\_TEST\_BASE are a
  pack fix in its own release.
- **Check.** Unit test in `ts/test/helpers.test.ts`: go-cli/go-mcp generated
  `main.go` reads the same names as envName for slugs 'a--b' and '-a-';
  `parity` relation over the live-test how-to siblings; a guard that every
  `<ENV>_…` read by a generated test appears in that target's README.

### D26. Client options: optspec is the validated schema no document reads; three hand-written row sets; ReadmeOptions never renders

- **Fate.** WP29.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 62 source files; size
  l; changes generated documents. Needs: decision: options table neutral from
  optspec or kept per language (not one of DQ1-DQ6).
- **Where.** `ts/model/sdkgen.aontu:262-329` (main.kit.optspec) via
  `ts/src/helpers/optspec.ts:50`;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeModel_<lang>.ts` (ts:88, py:50; 20
  files); `ts/project/.sdk/src/cmp/<lang>/ReadmeRef_<lang>.ts` (ts:80; 20
  files); `ts/project/.sdk/src/cmp/<lang>/ReadmeOptions_<lang>.ts` (ts:9; 20
  files, reads undeclared target.options); `ts/src/cmp/ReadmeModel.ts:54-60`;
  `ts/src/cmp/ReadmeFeatures.ts:33`;
  sdkgen-langpack:`.sdk/src/cmp/lean/ReadmeOptions_lean.ts:6`
- **At head.** Present. Opened `ReadmeOptions_ts.ts:8-12`
  (each(target.options) filtered on option.publish; target.options is not a
  schema slot, so the section is empty in every project);
  `ReadmeFeatures.ts:33` still says 'alongside the options shown above' (X2).
- **Fix.** Delete the 20 `ReadmeOptions_<lang>` components (and the pack's) in
  the copy wave, or make them render from optionSpec; recommended: delete, and
  have the option tables in ReadmeModel/ReadmeRef take their rows (name, type,
  default) from optspec through one neutral helper, with each language's own
  spelling of the call kept in the copy. `ReadmeFeatures.ts:33` loses 'shown
  above' (neutral: 'alongside your other client options'). The generic
  `ReadmeModel.ts:54-60` rows come from the same helper.
- **Check.** New test: every option row printed in a README is a key of
  main.kit.optspec and vice versa for the published ones; `parity` relation
  across ReadmeModel siblings; the exact check 'no table header stands without
  rows'.

### D27. Package name, install command and publish state derived separately by registryState, Deploy, PublishWorkflow, 20 ReadmeInstall, local name helpers, docgen

- **Fate.** WP35.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 35 source files; size
  l; changes generated documents and code.
- **Where.** `ts/src/helpers/packageMeta.ts:173-223`, :232-280, :287-309;
  `ts/src/cmp/Deploy.ts:33`, :39-53 (registryOf, regIsActive);
  `ts/src/cmp/PublishWorkflow.ts:31`; `ts/src/cmp/ReadmeTop.ts:381-397`;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeInstall_<lang>.ts` (ts:9, js:12, go:16
  ungated; 20 files); `ts/project/.sdk/src/cmp/rust/utility_rust.ts:47-50`;
  `ts/project/.sdk/src/cmp/java/utility_java.ts:41-47`;
  `ts/src/admin/status.ts:61`; docgen:`ts/src/content.ts:164-166`
- **At head.** Present. Opened `Deploy.ts:33` (own registryOf/regIsActive)
  beside `packageMeta.ts:173` registryState; `ReadmeInstall_ts.ts:22-26`; the
  map's V3, V4 (js prints target.module.name) and V8 (docgen 'Not published.
  Build from the go directory.') rest on these.
- **Fix.** `packageMeta.ts` stays the home: registryState for the tri-state,
  packageName/installCommand for names. Deploy's registryOf/regIsActive and
  PublishWorkflow's registry-name test call registryState; `admin/status.ts`
  reports registryState rather than raw state; the 20 `ReadmeInstall_<lang>`
  use registryState (three-way, like ReadmeTop) and installCommand, so go and
  cpp are gated and js prints packageName; rust, java, kotlin, scala, ocaml,
  zig, c, elixir name derivations move into packageName so
  publish.registry.package is honoured everywhere (pack: dart, haskell
  follow). docgen's installation() calls the exports.
- **Check.** New equality test: for every target and registry state, the
  install line in `<t>/README.md` equals the root Packages row and the name in
  the generated manifest; existing `ts/test/deploy.test.ts` and
  `publishworkflow.test.ts` extended to registry pending/active; `parity`
  across ReadmeInstall siblings.

### D29. Release tag: '`<target>/v<version>`' in Deploy, Makefiles and READMEs vs bare '`v<version>`' in PublishWorkflow; publish.tag.\* read by nothing

- **Fate.** WP35.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 38 source files; size
  l; changes generated documents and code. Needs: decision: honour or remove
  `publish.tag.active/prefix`.
- **Where.** `ts/src/cmp/PublishWorkflow.ts:79-90` (releaseTag, private);
  `ts/src/cmp/Deploy.ts:157` and :218; `ts/project/.sdk/tm/<lang>/Makefile`
  `TAG :=` (ts:27; 15 files);
  `ts/project/.sdk/src/cmp/<lang>/ReadmeInstall_<lang>.ts` (ts:24, c:48; 20
  files); `ts/model/sdkgen.aontu:151-153` (publish.tag.active, prefix)
- **At head.** Present. Opened `PublishWorkflow.ts:86-90` (primary npm target
  gets 'v\$VERSION') against `ReadmeInstall_ts.ts:24`
  ('`${target.name}/vX.Y.Z`' always) and `Deploy.ts:218`; grep finds no reader
  of publish.tag.active or publish.tag.prefix.
- **Fix.** Move releaseTag into `ts/src/helpers/packageMeta.ts` as an export
  taking (model, target) and computing the npm-target set itself; Deploy
  (prose and recipe), PublishWorkflow, the `PUBLISHING.md` tag table and the
  20 ReadmeInstall components call it; the 15 Makefile templates receive the
  tag as a replace token from their component (rule 5) in the copy wave.
  `publish.tag.active/prefix` are either read by releaseTag (prefix replaces
  '`<target>/`') or removed from the schema; the base schema is at the comment
  density limit, so removal must not add a comment line.
- **Check.** Equality test over npm-target variations (one npm target, ts+js,
  js only): README tag == workflow tag == Makefile TAG for each target;
  existing `ts/test/publishworkflow.test.ts` and `deploy.test.ts` updated;
  `off` relation for publish.tag.active false.

### D33. Target directories and paths between surfaces written as literals ('cd py', '`../go`', 'go-cli/') or target.name; `output.path/root` ignored

- **Fate.** WP14.
- **Class.** duplicated-rule; sdkgen; neutral-component; 30 source files; size
  l; changes generated documents. Needs: targetPlace; docLink; DQ3.
- **Where.** `ts/src/cmp/ReadmeTop.ts:392`, :430-443, :475, :675;
  `ts/src/helpers/alongside.ts:37`; `ts/src/cmp/AgentGuide.ts:43-52`, :120;
  `ts/src/cmp/AgentGuideFeature.ts:73-90`;
  `ts/src/cmp/PublishWorkflow.ts:106`, :194, :417; `ts/src/cmp/Deploy.ts:143`;
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:213`, :358;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:269`, :420;
  `ts/project/.sdk/src/cmp/<lang>/ReadmeInstall_<lang>.ts` (c:36, java:28);
  `ts/src/action/remove.ts:293`; `ts/src/admin/status.ts:56`;
  `ts/src/testkit.ts:628`; docgen:`ts/src/content.ts:254`, :262;
  create-sdkgen:`project/standard/.sdk/src/RootPlan.ts:33`
- **At head.** Present. Opened `ReadmeTop.ts:435-439` (literal `go-cli/`,
  `go-mcp/`), :475 (`cd go-mcp`), `alongside.ts:37` (`../README.md`),
  `AgentGuide.ts:46-52` ('one level up', `cd ../.sdk`), `remove.ts:293` (`null
  != output?.path` against a schema default of '' — design 14.7).
- **Fix.** targetPlace(model,name) and docLink(ctx\$,target,doc) in a new
  `ts/src/helpers/place.ts` (design section 6) become the only source of a
  directory or relative link: ReadmeTop, alongsideNote, AgentGuide,
  AgentGuideFeature, PublishWorkflow and Deploy build `cd` lines and links
  from them, and docLink returning undefined drops the sentence (rule 3).
  `remove.ts:293` and `status.ts` read output.path through targetPlace so ''
  means undeclared. Per-language ReadmeInstall/ReadmeHowto `cd` literals take
  the directory as a token from targetPlace in the copy wave. Under DQ3
  recommended, in-tree documents follow the declared layout and the run
  override changes none of them.
- **Check.** `link` relation (85 distinct dangling lines today, 100 with
  phase.top off) and the every-generate link check (`doc-link-dangling`) of
  design section 8; a `remove.ts` unit test that an in-tree target with
  output.path '' gets no out-of-tree note.

### D34. 'Does this phase run' written four times; no document asks it before linking a target's `AGENTS.md` (go-cli, go-mcp)

- **Fate.** WP14.
- **Class.** duplicated-rule; sdkgen; neutral-component; 6 source files; size
  s; changes generated documents. Needs: docLink; targetSurface.
- **Where.** `ts/src/helpers/alongside.ts:5-10` (PHASES, isConsumer);
  `ts/src/cmp/ExternalTarget.ts:48-50`; `ts/src/testkit.ts:599-600`;
  `ts/src/cmp/AgentGuideContent.ts:65`; `ts/src/types.ts:68-72`;
  create-sdkgen:`project/standard/.sdk/src/Root.ts:110-144`;
  create-sdkgen:`project/standard/.sdk/src/RootPlan.ts:20-22`
- **At head.** Present. Opened `ExternalTarget.ts:48-50`, `testkit.ts:599-600`
  and `RootPlan.ts:20-22`: the same `false !== (phase[n] && phase[n].active)`
  written three times; `alongside.ts` holds the only phase-name list; the base
  schema declares no target.phase.
- **Fix.** Export one phaseActive(target, name) and the PHASES list from the
  place helpers (`ts/src/helpers/place.ts`) and have ExternalTarget, testkit's
  defaultRoot, AgentGuideContent and (via its sdkgen pin) create-sdkgen's
  Root/RootPlan call it. docLink consults it, so root `AGENTS.md` links a
  target's `AGENTS.md` only when that target's agentguide phase ran (fixes
  S43). isConsumer is deleted under D02, which removes the four-flag
  misclassification of old copies (V13). Declaring target.phase in the schema
  is optional and must carry no comment (density gate).
- **Check.** `link` relation (`go-cli/AGENTS.md` and `go-mcp/AGENTS.md`
  dangling in every default project today); a unit test that the guard harness
  Root, testkit's Root and RootPlan agree on which phases run for each
  consumer.

### D35. Three hand-written Roots: create-sdkgen's honours `active/root/phase.top`; testkit's and the test harness's honour less, so sdkgen's suite never runs the real plan

- **Fate.** WP02.
- **Class.** duplicated-rule; sdkgen; test; 4 source files; size m; changes
  nothing in generated output. Needs: targetPlace; DQ4.
- **Where.** `ts/src/testkit.ts:565-637` (defaultRoot);
  `ts/test/generateharness.ts:2166` (makeRoot);
  `ts/src/cmp/ExternalTarget.ts:48-83`;
  create-sdkgen:`project/standard/.sdk/src/Root.ts:75-145`;
  create-sdkgen:`project/standard/.sdk/src/RootPlan.ts:20-54`
- **At head.** Present. Opened `testkit.ts:565-632` (honours active and
  output.root, no phase.top or phase.build) and `RootPlan.ts` at create-sdkgen
  6fe1759 (the only plan that refuses root placement with phase.top on);
  `generateharness.ts:2166` makeRoot writes every target.
- **Fix.** Move the run plan (top, build, place per target, the one-at-root
  refusal) into an sdkgen export beside targetPlace
  (`ts/src/helpers/place.ts`) that imports nothing heavy; testkit's
  defaultRoot, the test harness's makeRoot and the text guard's harness Root
  (design section 7) all build from it; create-sdkgen's `RootPlan.ts` becomes
  a re-export when its pin reaches the release carrying it (a create-sdkgen
  release owned by another session: the plan needs that pin bump).
- **Check.** Design section 7 measurement as a test: docs-only harness output
  byte-identical to the full Root's for the baseline; a test that the exported
  plan equals create-sdkgen RootPlan's on the guard's phase and placement
  variations (run in create-sdkgen's own suite once it imports the export).

### D44. MCP surface: ReadmeTop hard-codes 'go-mcp' and re-reads tool.write; docgen lists two tools; tool help says {"id":1}

- **Fate.** WP36.
- **Class.** duplicated-rule; sdkgen; neutral-component; 4 source files; size
  s; changes generated documents and code. Needs: targetSurface; DQ6.
- **Where.** `ts/src/helpers/mcpTools.ts:23-36`;
  `ts/src/cmp/ReadmeTop.ts:451-453` and :475;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:63`, :87, :139-140;
  `ts/project/.sdk/src/cmp/go-mcp/fragment/tools.fragment.go:42-57`;
  docgen:`ts/src/sdk-reference.ts:24-35` (toolContracts)
- **At head.** Present. Opened `ReadmeTop.ts:451-452` (mcpTools(model) with
  the default 'go-mcp' and `target?.['go-mcp']?.tool?.write` inline) against
  `Main_go-mcp.ts:139` (mcpTools(model, target.name)); `Main_go-mcp.ts:63` and
  :87 still print 'such as {"id":1}'; docgen toolContracts emits list and load
  only.
- **Fix.** mcpTools stays the home and also returns `write`; ReadmeTop passes
  the installed key found by targetSurface ('mcp') and reads write from the
  result; one build command (from the go-mcp README's) is used in both
  READMEs. Under DQ6 recommended, `Main_go-mcp.ts` builds the load/remove help
  from idLiteral/toolExample of the tool's entities instead of '{"id":1}'
  (copy wave, go-mcp only). docgen's toolContracts calls mcpTools.
- **Check.** Test in `ts/test/generate.test.ts`: an aliased MCP target and
  `tool.write: true` give the same tool list in the root README,
  `go-mcp/README.md` and `tools.go`; `off` relation with the surface word
  'MCP'; a go-mcp lane assertion that no tool description contains a literal
  `{"id":1}` when no entity has a numeric id.

### D47. Six targets (c, elixir, ocaml, scala, swift, zig) document 'Run live tests' and `<ENV>_TEST_LIVE` that nothing in them reads

- **Fate.** Repeats G03 and is resolved with it in WP30.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 6 source files; size
  s; changes generated documents. Needs: decision: delete the six sections or
  implement the six harnesses.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeHowto_<lang>.ts` 'Run live
  tests' (c:199, swift:158; 19 files); templates reading
  PROJECTENV\_TEST\_LIVE in 13 targets (e.g. `ts/project/.sdk/tm/ts/`...);
  `ts/src/helpers/testPolicy.ts:10` (liveStrict);
  `ts/src/helpers/resolved.ts:21` (hasLiveScenarios)
- **At head.** Present. grep at head: 19 `ReadmeHowto_<lang>` carry 'Run live
  tests'; templates reading TEST\_LIVE exist for 13 targets (cpp csharp go
  java js kotlin lua perl php py rb rust ts), so c, elixir, ocaml, scala,
  swift, zig document a switch nothing reads; clojure does neither.
- **Fix.** Whether a target has a live harness is a constant of its language
  implementation, so its home is the per-language copy: delete the 'Run live
  tests' section from the six `ReadmeHowto_<lang>` copies in the copy wave (or
  implement the harness, a larger decision). Optionally declare it in each
  target model as `test: live: harness` read by both the how-to and the test
  generators.
- **Check.** A structural test in ts/test: a `ReadmeHowto_<lang>` mentions
  `_TEST_LIVE` iff `tm/<lang>` or `src/cmp/<lang>` test code reads it; G03
  lines leave the guard's findings.

### D48. Root `AGENTS.md` says generate 'merges' and 'never DELETES'; the root README says it overwrites; ReadmeTop reads copies bypassing KIT

- **Fate.** Repeats X5 and is resolved with it in WP17.
- **Class.** duplicated-rule; sdkgen; neutral-component; 4 source files; size
  s; changes generated documents. Needs: modelCopyMode.
- **Where.** `ts/src/cmp/AgentGuideContent.ts:137-140` and :173-178;
  `ts/src/cmp/AgentGuide.ts:51-55`, :69-71;
  `ts/src/cmp/AgentGuideFeature.ts:84-86`; `ts/src/cmp/ReadmeTop.ts:614-629`;
  `ts/src/sdkgen.ts:298` (existing.merge false) and :385 (pruneGenerated);
  `ts/model/sdkgen.aontu:73` (main.kit.copies)
- **At head.** Present. Opened `AgentGuideContent.ts:137` ('`generate`
  \*\*merges\*\* into existing files') and :173 ('Regeneration never DELETES')
  against `sdkgen.ts:298` (`merge: false`) and :385 (pruneGenerated);
  `ReadmeTop.ts:614` reads `model.main?.kit?.copies` directly.
- **Fix.** Put the regeneration statement in one neutral constant in
  ts/src/cmp (with the stage count, case 10): 'Regeneration overwrites every
  generated file and removes files the generator no longer writes';
  AgentGuideContent, AgentGuide and AgentGuideFeature use it and drop the
  merge/placeholder gotcha. Add modelCopyMode(model) beside copyMode in
  `ts/src/helpers/copymerge.ts` (design section 6), reading through KIT;
  `ReadmeTop.ts:614` and the agent-guide copy wording call it.
- **Check.** `reaction` relation between root README and root `AGENTS.md`; a
  test that root `AGENTS.md` and README state the same regeneration behaviour
  under copies merge and overwrite; X5 leaves the guard's findings.

### D55. 'Required' server variable read five ways; ts README calls a defaulted variable required; go-cli/go-mcp have no rule

- **Fate.** Repeats G01 and is resolved with it in WP29.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 30 source files; size
  m; changes generated documents. Needs: requiredOptions.
- **Where.** `ts/src/helpers/serverVars.ts:18-40` (required = no default) and
  :66 (hasServerVariables, no caller); `ts/src/utility.ts:383-386` (defaults
  into Config); `ts/project/.sdk/src/cmp/ts/ReadmeTopQuick_ts.ts:25-28`;
  `ts/project/.sdk/src/cmp/ts/ReadmeModel_ts.ts:66-72`;
  `ts/project/.sdk/tm/ts/src/utility/MakeOptionsUtility.ts:77-96` (run time,
  20 targets); `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:47-48`;
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:274`;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:371`
- **At head.** Present. Opened `ReadmeTopQuick_ts.ts:25-28` (every variable
  printed under '// Required') while `utility.ts:385` puts each default into
  Config; `serverVariables.ts:19` also falls back to `model.main.KIT.info`, a
  literal key 'KIT', not the constant.
- **Fix.** requiredOptions(model).server.vars (design section 6) is the home:
  required = referenced by the URL and no default, test mode and a literal
  `base` excepted, the rule the runtimes apply. Quick starts print required
  variables as required and defaulted ones as optional with their default;
  ReadmeModel/ReadmeRef rows, py-data's base\_url rule and go-cli/go-mcp env
  tables (`<ENV>_SERVER_<VAR>` via serverVarEnv) read it. hasServerVariables
  is deleted or used. serverVariables drops the literal `KIT` fallback.
- **Check.** `parity` relation across quick-start siblings; a test with a
  templated URL and one defaulted variable: README says optional exactly for
  the variables MakeOptions accepts without a value; existing exact-shape
  tests in `ts/test/helpers.test.ts:566-599` keep passing because
  serverVariables' return does not change.

### D56. go-cli registers and advertises list/load/update literally while its README derives words from the model

- **Fate.** Repeats G08 and is resolved with it in WP36.
- **Class.** duplicated-rule; sdkgen; fragment; 3 source files; size s;
  changes generated code. Needs: DQ6; DQ1.
- **Where.** `ts/project/.sdk/src/cmp/go-cli/fragment/words.fragment.go:13`;
  `ts/project/.sdk/src/cmp/go-cli/fragment/main.fragment.go:37` and :122;
  `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:75-86`, :96
- **At head.** Present. Opened `words.fragment.go:13` (`for _, op := range
  []string{"list", "load", "update"}`); the README table in
  `Main_go-cli.ts:75-86` filters by the model, so for a read-only API
  `main.go` is byte-identical (G08).
- **Fix.** Main\_go-cli computes the word set once (entityOps union over
  active entities, intersected with the words the CLI supports) and hands it
  to the fragments as a replace token for the registration loop, the
  --help/`/help` line and the package comment (rule 5: the fragment holds no
  model-dependent text); the README uses the same list. Copy wave, go-cli
  only; DQ6 recommended includes these run-time strings.
- **Check.** go-cli lane in `ts/test/generatedcompile.test.ts`: generate a
  read-only API and assert `main.go` registers and advertises only list and
  load; `off` relation over op-removed variations now sees `main.go` once DQ6
  brings run-time strings in.

### D60. Path from a target back to .sdk hard-coded ('one level up', '`../../.sdk`', 'four levels up') in 58 templates and 15 components

- **Fate.** Repeats V32 and is resolved with it in WP32.
- **Class.** duplicated-rule; sdkgen; template; 75 source files; size l;
  changes generated documents and code. Needs: targetPlace; DQ3.
- **Where.** `ts/src/sdkgen.ts:416-428` (sdkrelpath computed for the external
  pass only); `ts/src/cmp/AgentGuide.ts:46-52`;
  `ts/src/cmp/AgentGuideFeature.ts:73-90`;
  `ts/project/.sdk/tm/ts/test/utility/index.ts:4` (and 57 other template
  files); `ts/project/.sdk/src/cmp/ts/TestEntity_ts.ts:163` (and 14 other
  components); `ts/project/.sdk/src/cmp/ts/ReadmeExamplesTest_ts.ts:87`
- **At head.** Present. Opened `sdkgen.ts:416` (externalSdkRel gives
  sdkrelpath to the out-of-tree pass) and `AgentGuide.ts:46-52` /
  `AgentGuideFeature.ts:73-90` (literal depths); the template and component
  counts are the map's (V32), not re-counted.
- **Fix.** Compute the relative path to .sdk for every pass (in-tree included)
  from targetPlace in the core and expose it as ctx\$.sdkrelpath and as a
  replace token (`SDKREL`) in stdrep; documents (AgentGuide,
  AgentGuideFeature) use docLink/that value; the 58 templates and 15
  components replace the literal `../../.sdk` with the token in the copy wave
  (templates receive it through their Main's Copy replace map, rule 5).
- **Check.** `link` relation for `cd` lines in the agent guides; an
  out-of-tree lane in `ts/test/generatedcompile.test.ts` that runs a relocated
  ts target's tests and finds the corpus.

### D61. Whether the wrapped target exists: py-data throws, go-cli/go-mcp never check and write literal `../go` into README and go.mod

- **Fate.** WP36.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 3 source files; size
  s; changes generated code. Needs: targetSurface; targetPlace; DQ2.
- **Where.** `ts/project/.sdk/src/cmp/py-data/Main_py-data.ts:27-30`, :620,
  :760; `ts/project/.sdk/src/cmp/go-cli/Main_go-cli.ts:213`, :358;
  `ts/project/.sdk/src/cmp/go-mcp/Main_go-mcp.ts:269`, :420;
  `ts/src/helpers/alongside.ts:17`
- **At head.** Present. Opened `Main_py-data.ts:27-30` (throws SdkGenError
  when `targets.py` is absent) and `Main_go-cli.ts:358` / `Main_go-mcp.ts:420`
  (`replace ${sdkModule} => ../go`, no presence check); with go aliased or
  relocated the path is wrong (design 14.6, G22, G23).
- **Fix.** targetSurface(model,name).consumed (design section 5) answers which
  installed target each consumer wraps; all three consumers refuse generation
  with the same error when it is empty (go-cli and go-mcp gain py-data's
  check), stop with both names when two match, and build the README path and
  go.mod replace from targetPlace of the consumed key instead of
  '`../go`'/'`../py`'. Under DQ2 recommended the three model files declare
  `consumes`; otherwise LEGACY\_SURFACE supplies it.
- **Check.** Tests in `ts/test/generate.test.ts`: go-cli and go-mcp without go
  throw like py-data; with go aliased as go2, go.mod says `=> ../go2`; the
  NON\_SDK\_SIBLING case reads `consumes` from the scaffold's files.

### D69. Vendor text in markdown table cells is never escaped in sdkgen (66 cell sites, root README); docgen escapes its own way

- **Fate.** Repeats G27 and is resolved with it in WP33.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 45 source files; size
  l; changes generated documents. Needs: mdCell; mdInline.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts`
  (py:100-102; 66 cell sites across ReadmeEntity/ReadmeRef/ReadmeModel);
  `ts/src/cmp/ReadmeTop.ts:505-507`; `ts/src/cmp/ReadmeFeatures.ts:78-79`;
  docgen:`ts/src/content.ts:60` (cell)
- **At head.** Present. Opened `ReadmeEntity_py.ts:101-102` (`${desc}` raw in
  a cell) and `ReadmeTop.ts:505-507` (entity description raw); no escaper
  exists in ts/src/helpers (listed); docgen `content.ts:60` escapes the pipe
  and strips relative links.
- **Fix.** Add mdCell and mdInline in a new `ts/src/helpers/markdown.ts`
  (design section 8): pipe to `\|`, line break to `<br>` or space, `$$` to
  `$&#36;`, with a function replacer. Every neutral cell site (ReadmeTop,
  ReadmeFeatures, ReadmeRefFeatures) calls mdCell now; the per-language cell
  sites call it in the copy wave, the helper arriving first as a new file.
  docgen's cell() keeps link stripping and calls mdCell for the rest when it
  adopts.
- **Check.** The every-generate table check (`doc-table-broken`, design
  section 8), which sdkgen's suite fails on; a guard fixture with two
  pipe-carrying descriptions and one line break producing 0 broken rows (120
  and 60 today).

### D70. '\$\$path\$\$' inside vendor text is substituted in all docs and 20 of 22 generated source files, kept in ts/js Config

- **Fate.** Repeats G28 and is resolved with it in WP33.
- **Class.** duplicated-rule; sdkgen; per-language-copy; 25 source files; size
  l; changes generated documents and code. Needs: mdCell; mdInline; decision:
  code-side escaper home (design 14.15).
- **Where.** `ts/node_modules/jostraca/dist/cmp/Content.js:35` (substitution);
  `ts/project/.sdk/src/cmp/go/Config_go.ts:204-206`;
  `ts/project/.sdk/src/cmp/ts/Config_ts.ts:88-91` (Fragment, kept);
  `ts/project/.sdk/src/cmp/ts/TestEntity_ts.ts:263`;
  docgen:`ts/src/docgen.ts:298`
- **At head.** Present. Opened `Config_go.ts:204-206` (feature config written
  through Content) and `Config_ts.ts:88-91` (Fragment path, not substituted);
  the 20-of-22 count is the map's G28 measurement, not re-run.
- **Fix.** Documents: mdCell/mdInline turn `$$` into `$&#36;` (design section
  8), covering every markdown site that calls them. Code: a separate escaper
  for string literals in generated source (design 14.15, not solved by the
  markdown escapers): each `Config_<lang>` and `TestEntity_<lang>` passes
  vendor strings through a helper that breaks `$$` so Content leaves it (or
  emits them through a Fragment replace as ts/js do); placed in
  `ts/src/helpers/markdown.ts`' sibling or with formatGoMap-style per-language
  formatters, in the copy wave. docgen applies the same before its own Content
  pass.
- **Check.** Fixture with `$$name$$` in a field description and
  `$$main.kit.publisher.name$$` in the summary: no generated file (document or
  source) contains the substituted value; the 17 runtime Config files
  byte-compare to the ts/js Fragment output for the literal.

### The 50 rated medium or low

None of these is an issue of its own: where one produced wrong output, that
output is an entry above. A package that touches one of its sites uses the
single home the plan names.

| Rule | Fact | Rating | Fate |
| --- | --- | --- | --- |
| D03 | The wording that lists the project's other surfaces, and the list joiner | medium | Its sites take the single home in WP13. |
| D06 | A feature's option list and defaults | medium | Its sites take the single home in WP08. |
| D07 | Transport wrapping and activation order | medium | Its sites take the single home in WP08. |
| D08 | Whether a feature plugin group is on | low | Deferred: consistent today, and folded in when its site is next changed. |
| D09 | Where a target keeps feature source and what the file is called | medium | Its sites take the single home in WP09. |
| D11 | Which entity (and operation) an example shows | medium | Deferred: consistent today, and folded in when its site is next changed. |
| D12 | Which language represents the SDK (lead target) | low | Deferred: consistent today, and folded in when its site is next changed. |
| D13 | How an example call and its literals are written | medium | Deferred: consistent today, and folded in when its site is next changed. |
| D14 | The nested entity and its parent | low | Its sites take the single home in WP31. |
| D15 | The entity's id field | low | Its sites take the single home in WP31. |
| D16 | An entity's description | medium | Its sites take the single home in WP19 and WP33. |
| D17 | An entity's display and class name in documentation | medium | Its sites take the single home in WP37. |
| D18 | An entity's API path | low | Its sites take the single home in WP31. |
| D19 | A field's type name in a language | low | Its sites take the single home in WP28. |
| D20 | Which entities are active | medium | Its sites take the single home in WP21. |
| D21 | Which points of an operation count as routes | low | Its sites take the single home in WP26a. |
| D24 | Whether the server URL is templated | low | Its sites take the single home in WP19. |
| D28 | A registry's display name | low | Its sites take the single home in WP15. |
| D30 | Where a target's version comes from | medium | Its sites take the single home in WP35. |
| D31 | Repository URL, host name, clone directory and where releases are found | medium | Its sites take the single home in WP25. |
| D32 | The default / release branch | low | Its sites take the single home in WP25. |
| D36 | Which generated files are documentation pages | medium | Deferred: consistent today, and folded in when its site is next changed. |
| D37 | A language's display name, and what language/idiom a target is | medium | Its sites take the single home in WP15. |
| D38 | The project / SDK name and its class name | medium | Deferred: consistent today, and folded in when its site is next changed. |
| D39 | The API's display name | medium | Its sites take the single home in WP15. |
| D40 | Per-language package / module / import identity | medium | Its sites take the single home in WP26a. |
| D41 | The README title and tagline lines | low | Deferred: consistent today, and folded in when its site is next changed. |
| D42 | The unofficial / non-affiliation disclosure | medium | Its sites take the single home in WP25. |
| D43 | Copyright holder and licence | low | Its sites take the single home in WP35. |
| D45 | How to build and test a target | medium | Its sites take the single home in WP13. |
| D46 | Where .env.local is read from | low | Its sites take the single home in WP32. |
| D49 | Where the project's own decisions and files live | medium | Deferred: consistent today, and folded in when its site is next changed. |
| D50 | How many pipeline stages there are | low | Its sites take the single home in WP08. |
| D51 | Whether documentation is on, and whether an edition is active / served | low | Deferred: consistent today, and folded in when its site is next changed. |
| D52 | Stamping provenance when an edition is installed | low | Deferred: consistent today, and folded in when its site is next changed. |
| D53 | The API model the documentation tests generate from | low | Deferred: consistent today, and folded in when its site is next changed. |
| D54 | Where the credential goes (`in`, `name`), and the header-name case rule | medium | Its sites take the single home in WP28 and WP41. |
| D57 | The registry description of a package | medium | Its sites take the single home in WP15. |
| D58 | How a conditional marker is spelled in a fragment | medium | Its sites take the single home in WP37. |
| D59 | How an empty list is rendered | low | Its sites take the single home in WP31. |
| D62 | Whether a target's feature source may be trimmed | medium | Its sites take the single home in WP11. |
| D63 | The hook vocabulary | medium | Its sites take the single home in WP08. |
| D64 | The capability vocabulary | medium | Its sites take the single home in WP13. |
| D65 | The shape of a target model | medium | Deferred: consistent today, and folded in when its site is next changed. |
| D66 | The one line that says what a feature is | medium | Its sites take the single home in WP26b. |
| D67 | Whether a set of copies is too old for the generator reading them | medium | Its sites take the single home in WP12. |
| D68 | Which text describes a field | medium | Its sites take the single home in WP19 and WP33. |
| D71 | The API's one-paragraph description | medium | Its sites take the single home in WP05a and WP05b. |
| D72 | Whether a piece of text counts as the document's own or as quoted | medium | Its sites take the single home in WP05a and WP05b. |
| D73 | What happens to a relative link written inside vendor text | medium | Its sites take the single home in WP18. |

## A. Added in review of the plan (A01 to A05)

A01 to A03 came from the review of the plan's completeness; A04 and A05 were
in the readers' notes without an entry of their own.

### A01. docgen's tutorial says the credential is read from the environment, and promises "Turn on a feature", whatever the model

- **Fate.** WP26a.
- **Class.** stale-mention; docgen; helper; 1 source file; size xs; changes
  generated documents. Needs: requiredOptions; targetFeatures.
- **Where.** docgen `ts/src/content.ts:677,684`
- **At head.** Present. Read at docgen 9ca5221: the tutorial's step list ends
  "5. Turn on a feature." (`:677`) and step 2 says "The credential is read
  from the environment, so nothing secret reaches your source tree." (`:684`).
  Neither reads the model, so an API with no auth is told about a credential
  and a project with no features is promised one.
- **Fix.** Write the credential sentence only when `requiredOptions` names a
  credential, and the feature step only when the documented target has a
  feature; renumber the steps from what is written.
- **Check.** docgen `ts/test/docgen.test.ts`: an auth-off model's tutorial
  names no credential; a model with no features has four steps.

### A02. The language pack's suite read nothing in the introductions, so a doubled title passed every test

- **Fate.** WP45; fixed on the language pack's main, and published by that
  release.
- **Class.** test-gap; sdkgen-langpack; test; 1 source file; size xs; changes
  nothing in generated output.
- **Where.** sdkgen-langpack `test/langpack.test.js:812-826`
- **At head.** Fixed on main, and not yet released. Seen at pack 0.0.15, where
  exporting one function under both intro names wrote the title twice and the
  suite passed. At c6069bb the pack has the test "each README opens with one
  title and names its siblings once" (`test/langpack.test.js:812-826`), which
  fails on a second title. That commit is on the pack's main and unreleased.
- **Fix.** Nothing to change: the release that publishes c6069bb carries the
  test.
- **Check.** The pack's head lane on the release commit.

### A03. The language pack's runtimes keep their own option specs in templates, outside main.kit.optspec

- **Fate.** WP42.
- **Class.** duplicated-rule; sdkgen-langpack; template; 3 source files; size
  s; changes generated code.
- **Where.** sdkgen-langpack
  `.sdk/tm/dart/lib/utility/MakeOptionsUtility.dart:46-92`, and the haskell
  and lean runtimes
- **At head.** Present. Read at c6069bb: the dart template declares `final
  optspec = { 'apikey': '', ... }` inline (`:46`), and its own comment says it
  mirrors go's make\_options. The bundled targets take the spec from the
  generated Schema module, so an option added to `main.kit.optspec` reaches
  twenty languages and not these three.
- **Fix.** Generate the three runtimes' specs from `main.kit.optspec` through
  the Schema module as the bundled targets do; or keep them and state the
  divergence in each file.
- **Check.** A pack test that an option added to `main.kit.optspec` is
  accepted by the generated dart, haskell and lean constructors.

### A04. An aliased ts or js target writes its entity files with the alias as the file extension

- **Fate.** WP28.
- **Class.** code-defect; sdkgen; per-language-copy; 2 source files; size xs;
  changes generated code.
- **Where.** `ts/project/.sdk/src/cmp/ts/Entity_ts.ts:55`;
  `ts/project/.sdk/src/cmp/js/Entity_js.ts:38`
- **At head.** Present. Read at 9aebaf9e: both name the file `cls + '.' +
  target.name`. After `target add ts~ts2` the key is `ts2`, so the entity is
  written as `src/entity/<Class>.ts2`, which nothing compiles or imports. The
  target model declares the extension
  (`ts/project/.sdk/model/target/ts.aontu:5`, `ext: ts`). No other language
  builds a file name from the key.
- **Fix.** Name the file with `target.ext`. It is the same defect as N04: the
  installed key used where the language is meant.
- **Check.** `ts/test/alias.test.ts`: after `target add ts~ts2`, the generated
  tree holds `src/entity/<Class>.ts` and no `.ts2` file; the same for
  `js~js2`.

### A05. Fifteen READMEs capitalise operation names on the "Operations:" line and five print them lower-case, with no comment saying why

- **Fate.** WP31.
- **Class.** contradiction; sdkgen; per-language-copy; 20 source files; size
  m; changes generated documents.
- **Where.** `ts/project/.sdk/src/cmp/<lang>/ReadmeModel_<lang>.ts` (py:140,
  go:178, ts:198, java:140)
- **At head.** Present. Grep at 9aebaf9e: java, js, kotlin, scala and ts write
  `opnames.join(', ')`; the other fifteen map each name through
  `charAt(0).toUpperCase()`. Most of the fifteen have lower-case methods (py
  `load`, rb `load`), so the line names something the reader cannot type.
- **Fix.** Spell each operation the way that language's generated method is
  spelled, from one helper beside `entityOps`; where a language keeps a
  different form on purpose, a comment at the line says so.
- **Check.** A generated-output test that every name on a README's Operations
  line appears as a method in that target's generated entity source.

## Seen, and not listed

- The marker for the `PreUnexpected` hook sits in three different places
  across ten of the nineteen operation fragments, and cpp has no hook markers.
  Every runtime fires the hook, so this is placement, not behaviour.
- js is the one SDK target with no generated README examples test, which is
  how its `ts`-tagged blocks (N11) went unseen. The text guard's fence-tag
  check covers that failure; a js examples test is not planned.
- Two `op` `active` statements on one entity once failed to unify in a test
  fixture. It was not reduced or reproduced on a real project model; WP21
  reproduces it before release.
