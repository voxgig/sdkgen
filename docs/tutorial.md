# Tutorial: generate your first SDK

By the end of this tutorial you will have generated a working TypeScript
SDK from an OpenAPI specification, run its tests, and made a change to the
generator and seen it flow through. Follow the steps in order — no
decisions are required.

> This walkthrough uses the `solardemo` example API. Substitute your own
> name and OpenAPI file anywhere you see `solardemo`.

## What you'll need

- Node.js (a recent LTS).
- An OpenAPI 3 spec file (`.yaml` or `.json`). A top-level `servers` entry
  names the base URL of your API. A spec without one still builds (apidef
  8.20.0 or later): the SDK then takes the base URL as its `base` server
  variable, passed at construction as `server: { base: 'https://api.example.com' }`,
  or the project fixes one with the `server` build option in
  `.sdk/build/apidef.js`. A spec written by a framework such as FastAPI omits
  the entry unless the app declares it. To fix the URL in the spec instead,
  add one before you start:

  ```yaml
  servers:
    - url: https://api.example.com
  ```

- Network access to install npm packages.

## Scaffold project

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

## Add language target

Add the TypeScript target. This copies the `ts` model, components, and
templates into your project (and ensures the `test` feature is present):

```bash
npm run add-target ts
# equivalently: voxgig-sdkgen target add ts
```

## Generate SDK

Generate the SDK:

```bash
npm run generate    # compile, then emit the SDK into ../ts
```

`generate` compiles the generator components and walks the unified model,
writing the SDK source into the `ts/` directory next to `.sdk/`. Open
`solardemo-sdk/ts/` and look around: you'll find one class per entity, a
generated `README.md` and `REFERENCE.md`, the feature runtime, and a test
suite.

## Build and test

```bash
cd ../ts
npm install
npm run build
npm test
```

The tests run against the in-memory mock, so they pass with no server
running. You now have a working SDK.

## Change and regenerate

Let's prove the generator is the source of truth. Suppose you want to
tweak wording in the generated README's explanation section.

1. Edit the language-specific README prose in
   `.sdk/src/cmp/ts/ReadmeExplanation_ts.ts`.

   Never edit the generated `ts/README.md`. it is overwritten
   on the next generate.

   The language-neutral component (`ReadmeExplanation.ts`) lives inside the
   installed `@voxgig/sdkgen` package, not in your project, so it isn't
   editable from here.

2. Regenerate:

   ```bash
   cd solardemo-sdk/.sdk
   npm run generate          # regenerate
   ```
3. Open `solardemo-sdk/ts/README.md` and you'll see your wording in the
generated output. The generated files are disposable; the component you
edited is the source of truth.

> To change sdkgen itself rather than your project's copy, note that a
> scaffolded project consumes the published `@voxgig/sdkgen` package.
> Editing the sdkgen repo doesn't reach the project until the package is
> rebuilt and republished (or linked into the project).

If a generated file shows a literal placeholder (like `ProjectName`) after
you merge changes, delete that file and regenerate it fresh — see
[Customize templates and propagate the change](./how-to/customize-and-propagate-templates.md)
for why.

## What you learned

- A project is scaffolded by `create-sdkgen` and built from its `.sdk/`.
- `target add` / `feature add` bring a language and features into the
  project; `generate` turns the model into SDK source.
- The generated output is disposable — the **generator** (the templates and
  components under `.sdk/`) is the source of truth.

## Where to go next

- Add another language: [Add a language target](./how-to/add-a-target.md).
- Understand what you generated: [The operation pipeline](./explanation/operation-pipeline.md).
- Look things up: [CLI](./reference/cli.md) · [Model schema](./reference/model.md) · [Hooks](./reference/hooks.md).
