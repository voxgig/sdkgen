# How to customize templates and propagate the change

When a generated SDK is wrong, **fix it in the generator, never in the
generated output** — generated files are overwritten on the next
`generate`. This guide shows where to make the fix and how to get it into
a generated SDK reliably.

## Step 1 — locate the source of the bug

A build/compile error in the generated SDK points at one of two places:

| Symptom | Fix in |
| --- | --- |
| The wrong *literal* source (transport, base class, utility) | a **template**: `project/.sdk/tm/<lang>/…` |
| The wrong *generated* source (an entity class, the constructor, README, tests) | a **component**: `project/.sdk/src/cmp/<lang>/…` |

Rule of thumb: if the broken file looks the same for every API, it's a
template; if its shape depends on the entities/operations, it's a
component. See
[Components vs templates](../explanation/components-and-templates.md).

## Step 2 — make the fix in this repo

Edit the template or component under `project/.sdk/`. Then confirm sdkgen
itself still builds and tests:

```bash
cd sdkgen
npm run build && npm test
```

## Step 3 — propagate into the generated SDK

The pipeline is:

```
edit sdkgen template/component
   └─▶ (consumer .sdk) npm run add-target <lang>   # copy updated files in
        └─▶ npm run generate                        # substitute + merge into target dir
```

From the consumer project's `.sdk/`:

```bash
npm run add-target <lang>     # re-copies templates/components from sdkgen
npm run generate              # applies placeholder replacement + merges
```

## The merge gotcha (read this)

`generate` uses a **merge** strategy. If a target file already exists,
changed lines may merge in, **but placeholder replacements
(`ProjectName`, `GOMODULE`, …) are *not* re-applied to merged content.**
The result is a file with literal `ProjectName` left in it.

To force a clean copy with full substitution, delete the specific
generated file first, then regenerate:

```bash
rm <project>/go/feature/log_feature.go
npm run generate              # recreates it fresh, with all replacements
```

## Step 4 — keep languages consistent

When you fix one language, check whether the same pattern exists in the
others. **The JS/TS targets are the reference implementation** — compare
against them. Test-runner logic (e.g. regex matching in Go's
`runner_test.go`) should match the JS runner in `js/test/runner.js`.

## Step 5 — validate

```bash
# in sdkgen
npm run build && npm test

# in the consumer .sdk
npm run add-target <lang>
npm run generate

# in the generated target
cd ../<lang> && <lang-test-command>
```

Re-run the TS and JS target tests too, to confirm no regression in the
reference implementation.

## See also

- [Debug a failing generated target](./debug-generation.md)
- [Project layout](../reference/project-layout.md)
- The repository's [`AGENTS.md`](../../AGENTS.md) for the same pipeline as an agent checklist.
