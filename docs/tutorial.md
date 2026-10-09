# Tutorial: generate your first SDK

By the end of this tutorial you will have generated a working TypeScript
SDK from an OpenAPI specification, run its tests, and changed the SDK
through its model and seen the change flow through. Follow the steps in
order — no decisions are required.

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

Add the TypeScript target, which copies the `ts` model, components and
templates into your project:

```bash
npm run add-target ts
# equivalently: voxgig-sdkgen target add ts
```

It also adds the `test` feature, which swaps the HTTP transport for an
in-memory mock so the generated SDK's unit tests run offline.

## Step 3 — generate the SDK

Compile the generator components and run generation, in one command:

```bash
npm run generate    # emit the SDK into ../ts
```

`generate` walks the unified model and writes the SDK source into the
`ts/` directory next to `.sdk/`. Open `solardemo-sdk/ts/` and look around:
you'll find one class per entity, a generated `README.md` and
`REFERENCE.md`, the feature runtime, and a test suite.

## Step 4 — build and test the generated SDK

```bash
cd ../ts
npm install
npm run build
npm test
```

The tests run against the in-memory mock, so they pass with no server
running. You now have a working SDK.

## Step 5 — make a change and regenerate

The model is the only input to generation, so a change to the SDK starts
there. Go back to the build folder:

```bash
cd ../.sdk
```

Give the README a tagline by adding this line to the end of
`model/project.aontu`, the project's own model file:

```jsonic
main: kit: text: tagline: 'Planets and moons, from TypeScript.'
```

Regenerate:

```bash
npm run generate
```

The tagline now sits under the title of `../ts/README.md`:

```markdown
# Solardemo TypeScript SDK

Planets and moons, from TypeScript.
```

The other wording slots, such as the summary and an entity's description,
are listed under [`main.kit.text`](./reference/model.md#mainkittext).

Leave the generated files alone: the next `generate` overwrites
`ts/README.md`. The copies under `.sdk/src/cmp/ts/` and `.sdk/tm/ts/`
belong to `target add` and `feature add`, which overwrite them, and
`voxgig-sdkgen doctor` reports an edit there as drift. The slots a project
sets about itself are listed in
[What a project declares about itself](./reference/model.md#what-a-project-declares-about-itself).

To change the generator itself, edit an sdkgen checkout instead. A
scaffolded project runs the published `@voxgig/sdkgen` from
`.sdk/node_modules`, so the edit reaches the project only once that
checkout is linked there and built; the steps are in
[Customize templates and propagate the change](./how-to/customize-and-propagate-templates.md).

## What you learned

- A project is scaffolded by `create-sdkgen` and built from its `.sdk/`.
- `target add` brings a language into the project, with the `test`
  feature; `feature add` brings in others. `generate` turns the model into
  SDK source.
- The generated output is disposable — the **model** is its only input, so
  a change to the SDK is a change to the project's own model file,
  `.sdk/model/project.aontu`.

## Where to go next

- Add another language: [Add a language target](./how-to/add-a-target.md).
- Understand what you generated: [The operation pipeline](./explanation/operation-pipeline.md).
- Look things up: [CLI](./reference/cli.md) · [Model schema](./reference/model.md) · [Hooks](./reference/hooks.md).
