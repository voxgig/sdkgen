# How to customize templates and propagate the change

When a generated SDK is wrong, **fix it in the generator, never in the
generated output** — generated files are overwritten on the next
`generate`. This guide shows where to make the fix and how to get it into
a generated SDK reliably.

## Step 1 — locate the source of the bug

A build/compile error in the generated SDK points at one of two places:

| Symptom | Fix in |
| --- | --- |
| The wrong *literal* source (transport, base class, utility) | a **template**: `ts/project/.sdk/tm/<lang>/…` |
| The wrong *generated* source (an entity class, the constructor, README, tests) | a **component**: `ts/project/.sdk/src/cmp/<lang>/…` |

Rule of thumb: if the broken file looks the same for every API, it's a
template; if its shape depends on the entities/operations, it's a
component. See
[Components vs templates](../explanation/components-and-templates.md).

For project-side customization (as opposed to fixing sdkgen itself),
everything goes in the project's own `.sdk`, in this order:

1. **Edit a template or component.** Change the project's copy under
   `.sdk/tm/<lang>/` or `.sdk/src/cmp/<lang>/`, in every target that needs
   it. An add merges later toolchain updates into the edited copy, as
   [The copies in `.sdk` merge](../explanation/copies-merge.md) explains.
2. **Write a feature of the project's own,** when a template cannot express
   the change. Define it in `.sdk/model/feature/<name>.aontu`, put its
   sources in each target's feature folder under `.sdk/tm/<lang>/`, and run
   `voxgig-sdkgen feature add <name>`. No package provides the name, so the
   add registers the feature and copies nothing: the files in `.sdk` are its
   source.
3. **Write a target of the project's own** the same way, for a language
   sdkgen does not ship: `.sdk/model/target/<name>.aontu`,
   `.sdk/src/cmp/<name>/` and `.sdk/tm/<name>/`, then
   `voxgig-sdkgen target add <name>`.

Never put a package folder inside the project, such as an `ext/` beside
`.sdk`: sdkgen refuses one, and names the `.sdk` paths to use instead. An
sdkgen package is for sharing targets and features between projects (see
[Use an sdkgen package](./use-an-sdkgen-package.md)). The worked example of
all three steps is
[voxgig-elementdemo-sdk](https://github.com/voxgig-sdk/voxgig-elementdemo-sdk),
whose `.sdk` holds a custom `bash` target and a custom `elementcard`
feature.

## Step 2 — make the fix in this repo

Edit the template or component under `ts/project/.sdk/`. Then confirm sdkgen
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
        └─▶ npm run generate                        # substitute, overwrite the target dir
```

A scaffolded project runs the published `@voxgig/sdkgen` from
`.sdk/node_modules`, so `add-target` copies from that, not from your
checkout. Link the checkout's package root there first, and build it:

```bash
cd <project>/.sdk
rm -rf node_modules/@voxgig/sdkgen
ln -s /path/to/sdkgen/ts node_modules/@voxgig/sdkgen
(cd /path/to/sdkgen/ts && npm run build)
```

The link lives in `node_modules`, which git ignores, so nothing about it
is committed. Then, from the consumer project's `.sdk/`:

```bash
npm run add-target <lang>     # re-copies templates/components from the linked sdkgen
npm run generate              # substitutes placeholders and overwrites each file
```

`generate` overwrites every file it writes, so a regenerated file always
has its placeholders replaced; see
[Regeneration is overwrite, not merge](../explanation/regeneration-overwrite.md).

## Step 4 — keep languages consistent

When you fix one language, check whether the same pattern exists in the
others. **The JS/TS targets are the reference implementation** — compare
against them. Test-runner logic (e.g. regex matching in Go's
`omniresolver_test.go`) should match the JS resolver in `js/test/omni.js` — both drive the vendored @voxgig/omni runner.

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
