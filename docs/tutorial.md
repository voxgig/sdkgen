# Tutorial: generate your first SDK

By the end of this tutorial you will have generated a working TypeScript
SDK from an OpenAPI specification, run its tests, and made a change to the
generator and seen it flow through. Follow the steps in order — no
decisions are required.

> This walkthrough uses the `solardemo` example API. Substitute your own
> name and OpenAPI file anywhere you see `solardemo`.

## What you'll need

- Node.js (a recent LTS).
- An OpenAPI 3 spec file (`.yaml` or `.json`).
- Network access to install npm packages.

## Step 1 — scaffold a project

A new SDK project is created with `create-sdkgen`. It produces a project
directory containing a `.sdk/` build folder wired up to `@voxgig/sdkgen`:

```bash
npm create @voxgig/sdkgen@latest -- solardemo \
  -o solardemo-sdk \
  -d ./solardemo-openapi.yaml
```

- `solardemo` — the SDK name.
- `-o solardemo-sdk` — the output directory.
- `-d …` — the OpenAPI definition. `@voxgig/apidef` parses it into the
  model (entities, operations, API info).

Change into the build folder:

```bash
cd solardemo-sdk/.sdk
```

Everything below runs from this `.sdk/` directory unless stated
otherwise.

## Step 2 — add a language target

Add the TypeScript target. This copies the `ts` model, components, and
templates into your project (and ensures the `test` feature is present):

```bash
npm run add-target ts
# equivalently: voxgig-sdkgen target add ts
```

## Step 3 — add the test feature

```bash
npm run add-feature test
```

The `test` feature swaps the HTTP transport for an in-memory mock so the
generated SDK's unit tests run offline.

## Step 4 — generate the SDK

Compile the generator components, then run generation:

```bash
npm run build       # compile .sdk/src/cmp → .sdk/dist
npm run generate    # emit the SDK into ../ts
```

`generate` walks the unified model and writes the SDK source into the
`ts/` directory next to `.sdk/`. Open `solardemo-sdk/ts/` and look around:
you'll find one class per entity, a generated `README.md` and
`REFERENCE.md`, the feature runtime, and a test suite.

## Step 5 — build and test the generated SDK

```bash
cd ../ts
npm install
npm run build
npm test
```

The tests run against the in-memory mock, so they pass with no server
running. You now have a working SDK.

## Step 6 — make a change and regenerate

Let's prove the generator is the source of truth. Suppose you want to
tweak wording in the generated README's explanation section.

1. In the **sdkgen** repo, the explanation prose lives in
   `ts/src/cmp/ReadmeExplanation.ts` (language-neutral) and
   `project/.sdk/src/cmp/<lang>/ReadmeExplanation_<lang>.ts`
   (language-specific). Edit there — **never** edit the generated
   `ts/README.md`, which is overwritten on the next generate.

2. Propagate the change into your project:

   ```bash
   cd solardemo-sdk/.sdk
   npm run add-target ts     # copy the updated components in
   npm run generate          # regenerate
   ```

3. If a generated file shows a literal placeholder (like `ProjectName`)
   after a merge, delete that file and regenerate it fresh — see
   [Customize templates and propagate the change](./how-to/customize-and-propagate-templates.md)
   for why.

## What you learned

- A project is scaffolded by `create-sdkgen` and built from its `.sdk/`.
- `target add` / `feature add` bring a language and features into the
  project; `generate` turns the model into SDK source.
- The generated output is disposable — the **generator** (`project/.sdk/`
  templates and components) is the source of truth.

## Where to go next

- Add another language: [Add a language target](./how-to/add-a-target.md).
- Understand what you generated: [The operation pipeline](./explanation/operation-pipeline.md).
- Look things up: [CLI](./reference/cli.md) · [Model schema](./reference/model.md) · [Hooks](./reference/hooks.md).
