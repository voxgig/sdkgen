# Agent guides — remaining work (create-sdkgen Root wiring)

Generated agent guides (`AGENTS.md` + thin `CLAUDE.md`) are now emitted at
three levels of a generated SDK project — **top level**, **per target
language**, and **per feature** (co-located). The generator components live in
`@voxgig/sdkgen`; the one remaining step is wiring them into the generation
**Root**, which lives in **`voxgig/create-sdkgen`** (not in this repo).

---

## Done — `voxgig/sdkgen`

Branch `claude/docs-template-refinement-jivyxr` (pushed). New neutral
components in `ts/src/cmp/`, exported from `ts/src/sdkgen.ts`:

| Component | Emits | Scope |
| --- | --- | --- |
| `AgentGuideTop` | `AGENTS.md` + `CLAUDE.md` at project root | once, top level (no folder) |
| `AgentGuide` | `<lang>/AGENTS.md` + `CLAUDE.md`; also drives the per-feature guides | once per target (inside `<lang>/`) |
| `AgentGuideFeature` | `<lang>/src/feature/<name>/AGENTS.md` + `CLAUDE.md` | per feature (invoked by `AgentGuide`) |
| `AgentGuideContent` | shared prose + model readers (no output of its own) | — |

Each guide teaches: basic generation & updating, adding features, customising
the model/templates (two-layer model), and the aontu `.jsonic` model language.
Covered by `ts/test/agentguide.test.ts` (render tests, 78 passing).

---

## To do — `voxgig/create-sdkgen`

The generation Root is the module loaded via `config.root`
(`@voxgig/sdkgen` `ts/src/sdkgen.ts:151-175`). It already calls `ReadmeTop`
/ `Deploy` at the top level and `Main` / `Readme` inside a per-target
`Folder({ name: target.name })`. Add two calls in the same places.

### 1. Bump the dependency

Ensure `create-sdkgen` resolves a `@voxgig/sdkgen` that includes the new
exports (the branch above, or the release that lands it).

### 2. Wire the Root

In the Root component (shape shown; match the actual file):

```ts
import {
  ReadmeTop, Deploy, Readme, Main,
  AgentGuideTop, AgentGuide,   // <-- add
} from '@voxgig/sdkgen'

const Root = cmp(function Root(props: any) {
  const { model } = props
  Project({ model, folder: model.name }, () => {

    // --- top level ---
    ReadmeTop({})
    Deploy({})
    AgentGuideTop({})                 // <-- add: root AGENTS.md + CLAUDE.md

    // --- per active target ---
    eachActiveTarget(model, (target) => {
      Folder({ name: target.name }, () => {
        Main({ target })
        Readme({ target })
        AgentGuide({ target })        // <-- add: <lang>/AGENTS.md + CLAUDE.md
                                      //     (also emits per-feature guides)
        // ...Entity / Test / Feature as today
      })
    })
  })
})
```

Notes:
- `AgentGuideTop` must be called **outside** any `Folder` so it lands at the
  project root (same rule as `ReadmeTop`/`Deploy`).
- `AgentGuide` must be called **inside** `Folder({ name: target.name })`
  (same rule as `Readme`), and it invokes `AgentGuideFeature` internally for
  each active feature — **no separate per-feature call is needed**.
- Optional per-language enrichment is supported via
  `.sdk/src/cmp/<lang>/AgentGuide_<lang>.ts` (loaded with `{ ignore: true }`);
  the neutral content stands alone without it.

### 3. Update fixtures / snapshots

If create-sdkgen has generated-output snapshots or Root tests, refresh them to
include the new `AGENTS.md` / `CLAUDE.md` files.

---

## Verify end-to-end

create-sdkgen owns the solardemo test data, so generate a real SDK and check
placement:

```bash
# in create-sdkgen, after wiring
<its generate/test harness>
```

Confirm these exist and read correctly:

- `AGENTS.md` and `CLAUDE.md` at the project root — with the **real** target,
  feature, and entity lists (not placeholders).
- `<lang>/AGENTS.md` + `CLAUDE.md` for each target.
- `<lang>/src/feature/<name>/AGENTS.md` + `CLAUDE.md` for each feature, with
  that feature's **active hooks** listed.
- The aontu primer shows the literal token **`$$path$$`** (proves jostraca's
  `$$..$$` templating didn't clobber it).

Also re-run the existing checks: `cd sdkgen && npm run build && npm test`, and
confirm no regression to the generated `README.md` / `Makefile`.

---

## Open items

- **Branch name for `create-sdkgen`** — none was designated; pick one before
  pushing (e.g. mirror `claude/docs-template-refinement-jivyxr`).
- **Repo access** — `add_repo voxgig/create-sdkgen` was blocked by an approval
  error this session; retry once the approval channel is healthy, then apply
  the wiring above.
