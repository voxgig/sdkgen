# How to debug a failing generated target

When a generated SDK won't build or its tests fail, follow this process.
It keeps you fixing the *generator* rather than the disposable output.

## 1. Decide where the error actually lives

A compile/build error in the generated SDK (e.g. `go build ./...` fails)
points to one of two sources:

- a **template** — `ts/project/.sdk/tm/<lang>/…` — for literal,
  API-independent source (transport, base classes, utilities); or
- a **component** — `ts/project/.sdk/src/cmp/<lang>/…` — for generated,
  API-dependent source (entity classes, the constructor, README, tests).

Open the broken generated file. If it looks the same for every API, the
bug is in a template. If its shape tracks the entities/operations, the
bug is in a component.

## 2. Reproduce with more signal

Turn up logging and use a dry run to see the plan without writing:

```bash
voxgig-sdkgen -g debug -y target add <lang>
```

During generation (in the consumer `.sdk/`), a higher debug level surfaces
per-file merge results and warnings. Watch for `require-missing` warnings:
they mean an *optional* per-language component wasn't found. A genuine
load error (syntax error, bad import) in such a component now propagates
rather than being swallowed, so a stack trace pointing into
`cmp/<lang>/Readme*_<lang>` is a real bug to fix, not a missing file.

## 3. Fix in the generator, never in the output

Generated files in `go/`, `ts/`, `js/`, … are overwritten by
`generate` / `reset`. Edit the template or component in
`ts/project/.sdk/`, then propagate. **Never** edit the generated file as the
fix.

## 4. Propagate and force a clean copy when needed

```bash
# consumer .sdk/
npm run add-target <lang>
npm run generate
```

Remember the merge gotcha: placeholder replacement is not re-applied to
merged content. If you see a literal `ProjectName` / `GOMODULE` in the
output, delete that generated file and regenerate it fresh:

```bash
rm <project>/<lang>/<path>/<file>
npm run generate
```

(Full explanation in
[Customize templates and propagate the change](./customize-and-propagate-templates.md).)

## 5. Check cross-language parity

Fixing one language often reveals the same latent bug in others. The
**JS/TS targets are the reference** — compare the broken language's
template/component against the `ts` equivalent. Test-runner matching logic
in particular should mirror `js/test/runner.js`.

## 6. Validate end to end

```bash
# sdkgen still healthy
cd sdkgen && make build test          # npm package lives in ts/; make wraps it

# regenerate the affected target
cd <project>/.sdk
npm run add-target <lang> && npm run generate

# the target builds and tests
cd ../<lang> && <lang-test-command>
```

Re-run the TS and JS target tests to confirm you didn't regress the
reference implementation.

## Common failure signatures

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| Literal `ProjectName`/`GOMODULE` in output | merge skipped substitution | delete file, regenerate |
| A README section silently missing | optional component returned `undefined` | confirm the `cmp/<lang>/Readme*_<lang>` exists/compiles |
| A README section throws during generate | bug in an optional component (no longer swallowed) | the stack trace names the file |
| Entity method missing | component didn't emit it for that op | `cmp/<lang>/Entity*_<lang>` |
| Feature hook not firing | hook not `active` in the model, or not implemented | feature `.aontu` + `tm/<lang>/src/feature/<name>` |

## See also

- [Customize templates and propagate the change](./customize-and-propagate-templates.md)
- [Components vs templates](../explanation/components-and-templates.md)
- The repository [`AGENTS.md`](../../AGENTS.md) for the same loop as an agent checklist.
