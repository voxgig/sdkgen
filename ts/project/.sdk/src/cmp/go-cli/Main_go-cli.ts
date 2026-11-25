
import * as Path from 'node:path'

import {
  cmp, each, deriveEntityNames, entityOps, consumedTarget, fact,
  entityIdField, matchArg, listMatchArg, dataArg, idLiteral,
  File, Content, Fragment, Slot, goModule, goVersion
} from '@voxgig/sdkgen'

import type {
  ModelEntity,
} from '@voxgig/apidef'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const BORU_ENG_VERSION = 'v0.0.2-0.20260804163932-0d66b55c5110'

// go.sum entries for BORU_ENG_VERSION and its transitive deps. The Go SDK
// dep needs no entry (path replace). Deterministic because the version
// is pinned above — regenerate with `go mod tidy` and update BOTH constants
// together when bumping BORU_ENG_VERSION.
const BORU_ENG_GOSUM = `github.com/boru-lang/boru/eng/go v0.0.2-0.20260804163932-0d66b55c5110 h1:iwMbEPhByhVhJgt6xhyhT+jXMiARvbG4wHIrc4OPcvU=
github.com/boru-lang/boru/eng/go v0.0.2-0.20260804163932-0d66b55c5110/go.mod h1:KQLjjCq4QVAfdSuhmQ58ZFA9JK7LV2+A/aLRb3m4s5k=
github.com/cockroachdb/apd/v3 v3.2.3 h1:4Zx+I3R35bFXMnltzmjP79i2cravE4jTRL6ps9Aux80=
github.com/cockroachdb/apd/v3 v3.2.3/go.mod h1:klXJcjp+FffLTHlhIG69tezTDvdP065naDsHzKhYSqc=
github.com/lib/pq v1.10.7 h1:p7ZhMD+KsSRozJr34udlUrhboJwWAgCg34+/ZZNvZZw=
github.com/lib/pq v1.10.7/go.mod h1:AlVN5x4E4T544tWzH6hKfbfQvm3HdbOxrmggDNAPY9o=
github.com/tabnas/debug/go v0.2.3 h1:cptiwHcHKw+lqtZuKp6gX7yY1NunJLS5PHD7ykVcIvM=
github.com/tabnas/debug/go v0.2.3/go.mod h1:EXSNFdN6Ct9pcAUk8ZGozNbIltb3Hw0wcne+5vWQyns=
github.com/tabnas/json/go v0.4.0 h1:1BxLHyCullkKXkvui/SuZ4s6OMrFVDuEB13IX/5S1eM=
github.com/tabnas/json/go v0.4.0/go.mod h1:MJzyziKcvZk3OZCaSDxhMdf/Wkq2UJ0uLGWFtp9zsJs=
github.com/tabnas/jsonic/go v0.4.0 h1:y5k/P21C3q3jWaA+VxEhXxzZ8xJgpgAehMBEseDN31g=
github.com/tabnas/jsonic/go v0.4.0/go.mod h1:eDpkddhkuTFuIXMkSqTZl7cU7M23swbMpkXR1W5bApQ=
github.com/tabnas/parser/go v0.4.0 h1:M8+qRT4KaCtr4OCpg9NDNUXJIdbbweqeqbpEpVGNEqU=
github.com/tabnas/parser/go v0.4.0/go.mod h1:WrlfEVyZ1QjEIowWiyEu3K1iHj7wxuPut5zoH9Trehk=
`


// A boru map of what an example sends, from the JSON the SDK documents'
// examples are built from; '' when it sends nothing.
function boruMap(json: string): string {
  const members = Object.entries(JSON.parse(json))
  return 0 === members.length ? '' : '{' + members.map(([key, val]) =>
    (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : JSON.stringify(key)) + ':' +
    JSON.stringify(val)).join(',') + '}'
}


function queryOf(ent: any, op: string): string {
  const idF = entityIdField(ent)
  return boruMap('list' === op ? listMatchArg('json', ent) :
    'update' === op ? dataArg('json', ent, 'update', idF) :
    matchArg('json', ent, op, idF, idLiteral(ent, op, idF)))
}


// One command for an operation of an entity, as the shell passes it and as
// the REPL reads it, and the scalar that stands for its query, if one does.
function commandOf(ent: any, op: string):
  { query: string, shell: string, repl: string, scalar: string } {
  const query = queryOf(ent, op)
  const name = String(ent.name).toLowerCase()
  const scalar = /^\{id:-?\d+(\.\d+)?\}$/.test(query) ? query.slice(4, -1) : ''
  return {
    query,
    shell: [op, ...('' === query ? [] : ["'" + query.replace(/'/g, "'\\''") + "'"]), name].join(' '),
    repl: [op, ...('' === query ? [] : [query]), name].join(' '),
    scalar,
  }
}


function phrase(items: string[]): string {
  return items.length < 2 ? items.join('') :
    items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]
}


type Need = { kind: string, name: string, value: string, note: string, row: string }

// What a run reads from the environment beyond the base URL: the credential
// and each server variable the API requires, with an example value each.
function environment(model: any): Need[] {
  const kit = model.main[KIT]
  const auth = fact(kit, 'auth')
  const env = fact(kit, 'env')
  return [
    ...(auth.apikey ? [{ kind: 'apikey', name: env.apikey, value: 'apikey_xxx', note: 'API key',
      row: 'API key sent with every request.' }] : []),
    ...(auth.secret ? [{ kind: 'secret', name: env.secret, value: 'secret_xxx', note: 'API secret',
      row: 'Secret sent with the API key, as HTTP Basic credentials.' }] : []),
    ...(fact(kit, 'server') as any[]).filter((v: any) => v.required).map((v: any) => ({
      kind: 'server', name: env.server[v.name],
      value: 'your-' + v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      note: `the ${v.name} of the API URL`,
      row: `The \`${v.name}\` variable of the API's server URL, which has no default.`,
    })),
  ]
}


// Go that reads the secret and the server variables into the SDK options.
function readOptions(model: any): string {
  const kit = model.main[KIT]
  const env = fact(kit, 'env')
  const set = (key: string, val: string) => `		if opts == nil {
			opts = map[string]any{}
		}
		opts[${JSON.stringify(key)}] = ${val}
`
  const servers = (fact(kit, 'server') as any[]).filter((v: any) => v.required)
  return (fact(kit, 'auth').secret ? `	if secret := os.Getenv(${JSON.stringify(env.secret)}); secret != "" {
${set('secret', 'secret')}	}
` : '') + (0 === servers.length ? '' : `	server := map[string]any{}
	for name, key := range map[string]string{${servers.map((v: any) =>
    JSON.stringify(v.name) + ': ' + JSON.stringify(env.server[v.name])).join(', ')}} {
		if val := os.Getenv(key); val != "" {
			server[name] = val
		}
	}
	if 0 < len(server) {
${set('server', 'server')}	}
`)
}


const Main = cmp(function Main(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const sdk = consumedTarget(model, target, props.ctx$.stdrep.SDKREL)
  const sdkModule = goModule(model, sdk.name)
  const cliModule = goModule(model, target.name)
  // What `go build` names the binary when no -o is given.
  const built = Path.posix.basename(cliModule)

  const entityMap: any = getModelPath(model, `main.${KIT}.entity`)
  deriveEntityNames(entityMap)
  const entityNames = Object.keys(entityMap).map(n => n.toLowerCase())

  const FRAGMENT = Path.normalize(__dirname + '/../../../src/cmp/go-cli/fragment')

  File({ name: '.gitignore' }, () => Content(`/dist/
/${model.name}-cli
/${built}
.jostraca/
`))

  const bin = `${model.name}-cli`
  const entityCount = entityNames.length

  const env = fact(model.main[KIT], 'env')
  const baseEnv = env.base
  const needs = environment(model)
  const keyed = needs.some((need) => 'apikey' === need.kind)
  const servered = needs.some((need) => 'server' === need.kind)

  const CLI_VERB_ROWS: Record<string, string> = {
    list:   '| `list`   | `list <entity>` · `list <query> <entity>`     | First page of records          |',
    load:   '| `load`   | `load <entity>` · `load <query> <entity>`     | A single record                |',
    update: '| `update` | `update <query> <entity>`                     | Update a record, return it     |',
  }
  const supportedOps = new Set<string>()
  each(entityMap, (entity: any) => {
    if (entity && entity.active === false) return
    const ops = (entity && entity.op) || {}
    for (const opname of Object.keys(ops)) {
      if (ops[opname] && ops[opname].active !== false) supportedOps.add(opname)
    }
  })
  const verbRows = ['list', 'load', 'update']
    .filter(op => supportedOps.has(op))
    .map(op => CLI_VERB_ROWS[op])
    .join('\n')

  // Concrete examples, each gated on the ops the entity it names can run
  // without an action, so no example is refused.
  const activeEntityObjs: any[] =
    Object.values(entityMap).filter((e: any) => e && e.active !== false)
  const firstEntityObj: any = activeEntityObjs[0]
  const firstEntity = firstEntityObj
    ? String(firstEntityObj.name).toLowerCase()
    : (entityNames[0] || 'entity')
  const hasOp = (entity: any, op: string) => entityOps(entity).includes(op)
  const firstHas = (op: string) => hasOp(firstEntityObj, op)
  const wordsOf = (entity: any) => ['list', 'load', 'update'].filter((op) => hasOp(entity, op))
  const wordless = activeEntityObjs.filter((ent: any) => 0 === wordsOf(ent).length)
  const otherLister = activeEntityObjs.slice(1).find((e: any) => hasOp(e, 'list'))
  const entityNoun = entityCount === 1 ? 'entity' : 'entities'
  // The best single example expression this SDK can actually run, for the
  // tutorial/REPL walkthroughs (never demonstrates an unsupported op).
  const exampleWord = ['list', 'load', 'update'].find((op) => firstHas(op))
  const example = null == exampleWord ? null : commandOf(firstEntityObj, exampleWord)
  const exampleOp = null == example ? '' : example.repl
  // Fallback differs by context: a COMMAND-LINE arg uses the `--help` flag;
  // the `/`-prefixed meta-command is only valid INSIDE the REPL.
  const cliExampleExpr = null == example ? '--help' : example.shell
  const replExampleExpr = exampleOp || '/help'

  const list = firstHas('list') ? commandOf(firstEntityObj, 'list') : null
  const load = firstHas('load') ? commandOf(firstEntityObj, 'load') : null
  const update = firstHas('update') ? commandOf(firstEntityObj, 'update') : null
  // A query a scalar stands for, shown both ways, with the comments aligned.
  const loads: [string, string][] = null == load ? [] : '' === load.scalar ? [[load.shell, '']] : [
    [`load ${load.scalar} ${firstEntity}`, `{id:${load.scalar}} shorthand`],
    [load.shell, 'explicit match map'],
  ]
  const loadWidth = Math.max(0, ...loads.map(([cmd]) => cmd.length))
  const loadLines = (pad: number) => loads.map(([cmd, note]) =>
    `./${bin} ` + ('' === note ? cmd : cmd.padEnd(loadWidth + pad) + ' # ' + note))

  const ex: string[] = []
  let step = 0
  ex.push(`# ${++step}. Build a native binary (-> dist/<os>-<arch>/${bin})`)
  ex.push('make build')
  ex.push('')
  ex.push(`# ${++step}. See usage (words, entities, env vars)`)
  ex.push(`./${bin} --help`)
  ex.push('')
  if (0 < needs.length) {
    ex.push(`# ${++step}. ${keyed ? 'Provide credentials' : 'Configure it'} once, via the environment`)
    needs.forEach((need) => ex.push(`export ${need.name}=${need.value}`))
    ex.push('')
  }
  ex.push(`# ${++step}. Each command line is ONE boru expression, run against the API:`)
  if (null != list) ex.push(`./${bin} ${list.shell}`)
  ex.push(...loadLines(11))
  if (null != update) ex.push(`./${bin} ${update.shell}`)
  if (null != otherLister) {
    ex.push(`./${bin} ${commandOf(otherLister, 'list').shell}`)
  }
  ex.push('')
  ex.push(`# ${++step}. Override the API base URL for a single call`)
  ex.push(`${baseEnv}=https://api.example.com ./${bin} ${cliExampleExpr}`)
  ex.push('')
  ex.push(`# ${++step}. No arguments -> interactive REPL`)
  ex.push(`./${bin}`)
  ex.push(`${model.name}> ${replExampleExpr}`)
  ex.push(`${model.name}> /quit`)
  const exampleBlock = ex.join('\n')

  const howtos: string[] = []
  if (null != list) howtos.push(`### List the records of an entity

\`\`\`sh
./${bin} ${list.shell}
\`\`\`

${'' === list.query ? '\`list <entity>\` returns the first page of records.' :
    '\`list <query> <entity>\` returns the first page of records under the parent the query names.'} \`<entity>\` is a bareword —
it is auto-quoted as an boru atom, so no quotes are needed.`)

  if (null != load) howtos.push(`### Load a single record

\`\`\`sh
${loadLines(5).map((line) => line.replace(/ # \{id:(.*)\} shorthand$/, ' # scalar shorthand for {id:$1}')).join('\n')}
\`\`\`

${'' === load.query ?
    `\`load <entity>\` needs no query for \`${firstEntity}\`, which has one record.` :
    `The query is a **match map** naming the record (\`${load.query}\`)${'' === load.scalar ? '' :
      ', or a **scalar**, treated as \`{id:<scalar>}\`'}. Quote the map so your shell passes it through intact.`}`)

  if (null != update) howtos.push(`### Update a record

\`\`\`sh
./${bin} ${update.shell}
\`\`\`

The match map carries both the selector and the new field values; the updated
record is printed back.`)

  const exports = [...needs.map((need) => [`export ${need.name}=${need.value}`, need.note]),
    [`export ${baseEnv}=https://api.example.com`,
      servered ? 'or: the whole API base URL' : 'optional: override the API base URL']]
  const width = Math.max(...exports.map(([line]) => line.length)) + 1
  howtos.push(`### ${keyed ? 'Authenticate and choose' : 'Choose'} an environment

Configuration is read from the environment — nothing is written to disk:

\`\`\`sh
${exports.map(([line, note]) => line.padEnd(width) + ' # ' + note).join('\n')}
./${bin} ${cliExampleExpr}
\`\`\`

${1 === exports.length ? 'It is' : 2 === exports.length ? 'Both are' : 'Each is'} injectable by a secrets vault${keyed ?
    ', so the key never has to be typed inline' : ''}.`)

  howtos.push(`### Explore interactively with the REPL

Run with no arguments to open a REPL (prompt \`${model.name}>\`). Each line is
evaluated as its own boru expression:

\`\`\`text
$ ./${bin}
${exampleOp ? `${model.name}> ${exampleOp}\n` : ''}${model.name}> /help
${model.name}> /quit
\`\`\``)

  howtos.push(`### Cross-compile release binaries

\`\`\`sh
make build       # native binary for this machine
make build-all   # linux/darwin/windows x amd64/arm64, under dist/<os>-<arch>/
\`\`\``)

  howtos.push(`### Discover the available entities

\`/help\` in the REPL prints the full entity list, or see [Entities](#entities)
below — this SDK exposes ${entityCount} ${entityNoun}.`)

  const howtoBlock = howtos.join('\n\n')

  const tutorialEnv = 0 === needs.length ? '' : `2. **Set ${phrase([
    ...(keyed ? ['your API key'] : []),
    ...(needs.some((need) => 'secret' === need.kind) ? ['secret'] : []),
    ...(servered ? ['the server variables'] : []),
  ])}** (read from the environment):

   \`\`\`sh
${needs.map((need) => `   export ${need.name}=${need.value}`).join('\n')}
   \`\`\`

`
  const tutorialStep = 0 === needs.length ? 1 : 2

  const goSdk = '' !== sdk.dir ? `the sibling Go SDK at \`${sdk.path}\`` :
    sdk.away ? 'the Go SDK in ' + ('' === sdk.url ? 'its own repository' :
      `[its own repository](${sdk.url})`) : `the Go SDK at \`${sdk.path}\``
  const here = 'folder' === fact(target, 'place') ? `this \`${target.name}/\` directory` :
    'the repository root'
  const source = 'external' === fact(target, 'place') ? 'the SDK project' : 'this repo'

  File({ name: 'README.md' }, () => Content(`# ${model.name}-cli

boru-driven command-line client **and** interactive REPL for the ${model.Name}
SDK. Each command line is parsed as a single [boru](https://github.com/boru-lang/boru)
expression and evaluated against the live API; run it with no arguments to drop
into a REPL. Built on \`github.com/boru-lang/boru/eng/go\` and
${goSdk}.

## Examples

\`\`\`sh
${exampleBlock}
\`\`\`

> The rest of this guide follows the [Diátaxis](https://diataxis.fr) framework:
> a hands-on **Tutorial**, task-focused **How-to guides**, a factual
> **Reference**, and background **Explanation**.

## Tutorial: your first query in under a minute

1. **Build the binary.** From ${here}:

   \`\`\`sh
   make build          # -> dist/<os>-<arch>/${bin}
   \`\`\`

${tutorialEnv}${tutorialStep + 1}. **Run a query.** Evaluate an boru expression against the API (or run with no
   arguments to open the REPL):

   \`\`\`sh
   ./dist/*/${bin} ${cliExampleExpr}
   \`\`\`

${tutorialStep + 2}. **Go interactive.** Run the binary with no arguments to open the REPL, then
   type \`/help\` for the word and entity lists and \`/quit\` to leave.

That is the whole loop: *build → ${keyed ? 'set key → ' : 0 < needs.length ? 'configure → ' : ''}evaluate boru expressions*.

## How-to guides

${howtoBlock}

## Reference

### Words

The CLI registers these boru words, each bound to the SDK:

| Word     | Signatures                                    | Returns                        |
|----------|-----------------------------------------------|--------------------------------|
${verbRows}

- \`<entity>\` is a bareword, auto-quoted as an boru atom (e.g. \`${firstEntity}\`).
- \`<query>\` is either a **Map** naming the record, or a **Scalar**, which is
  always wrapped as \`{id:<value>}\`.

### Environment variables

| Variable | Purpose |
|----------|---------|
${needs.map((need) => `| \`${need.name}\` | ${need.row} |\n`).join('')}| \`${baseEnv}\` | ${servered ?
    'The whole API base URL, in place of the server variables.' :
    'Optional override of the API base URL.'} |

Unset variables fall back to the SDK's built-in defaults${servered ? ', and a server variable has none' : ''}.

### CLI flags

- \`--help\` / \`-h\` — print usage (words, entities, env vars) and exit.

### REPL commands

Meta-commands use the \`/\` prefix (everything else on a line is evaluated as boru):

- \`/quit\` / \`/q\` / \`/exit\` — exit the REPL
- \`/help\` / \`/h\` / \`/?\`     — show the word list, entity list and meta commands

### Exit codes

| Code | Meaning |
|------|---------|
| \`0\` | Success (also the normal REPL exit). |
| \`1\` | Parse error, word-registration error, or an API/evaluation error. |

### Build targets

| Target | Result |
|--------|--------|
| \`make build\` | Native binary at \`dist/<os>-<arch>/${bin}\`. |
| \`make build-all\` | linux/darwin/windows x amd64/arm64, each under its own \`dist/<os>-<arch>/\`. |
| \`make clean\` | Remove \`dist/\` and any stray binaries. |

### Entities

${wordless.length === activeEntityObjs.length ? 'No word runs on any entity of this SDK.' :
    `The entities a word runs on, each with its words:

| Entity | Words |
|--------|-------|
${activeEntityObjs.filter((ent: any) => !wordless.includes(ent)).map((ent: any) =>
      `| \`${String(ent.name).toLowerCase()}\` | ${wordsOf(ent).map((op) => '\`' + op + '\`').join(', ')} |`).join('\n')}`}
${0 === wordless.length ? '' : `
The SDK's other ${1 === wordless.length ? 'entity' : 'entities'}, ${phrase(wordless.map((ent: any) =>
    '\`' + String(ent.name).toLowerCase() + '\`'))}, ${1 === wordless.length ? 'has' : 'have'} no list, load or update.
`}
## Explanation

### Why boru?

The whole command line is one [boru](https://github.com/boru-lang/boru) expression,
not a fixed \`verb --flag\` grammar. That means the same binary works one-shot
(\`./${bin} <expr>\`) and interactively (the REPL), and expressions compose the
same way in both. \`list\` / \`load\` / \`update\` are ordinary boru *words* bound to
the SDK — adding SDK operations is adding words, not re-parsing flags.

### How it is wired

\`main.go\` builds the SDK client (configured from the environment), creates an
boru registry, and \`words.go\` registers \`list\` / \`load\` / \`update\` as native
words that dispatch on the entity atom and call ${goSdk}.
Results are unwrapped from their \`Entity\` wrappers to plain data before being
printed.

### Output format

Each result value is printed as its boru string form (a JSON-like rendering of
the record or list of records). One-shot mode prints to stdout; errors go to
stderr with a non-zero exit code.

## Generated by

sdkgen \`${target.name}\` target. See the target source under \`.sdk/src/cmp/${target.name}/\` in
${source}, or upstream at
\`github.com/voxgig/sdkgen/project/.sdk/src/cmp/${fact(target, 'origin')}/\`.
`))

  // go.mod — the Go SDK via relative replace; boru/eng/go from the
  // public Go module proxy. The go directive must be >= boru/eng/go's own
  // (go 1.24.7) — keep in step with BORU_ENG_VERSION.
  File({ name: 'go.mod' }, () => Content(`module ${cliModule}

go ${goVersion(model, target.name, '1.24.7')}

require ${sdkModule} v0.0.0
require github.com/boru-lang/boru/eng/go ${BORU_ENG_VERSION}

require (
	github.com/cockroachdb/apd/v3 v3.2.3 // indirect
	github.com/tabnas/json/go v0.4.0 // indirect
	github.com/tabnas/jsonic/go v0.4.0 // indirect
	github.com/tabnas/parser/go v0.4.0 // indirect
)

replace ${sdkModule} => ${sdk.path}
`))

  // go.sum — required for `go build` to accept the boru/eng/go dependency
  // (the path-replaced Go SDK needs no entry). Pinned alongside
  // BORU_ENG_VERSION above.
  File({ name: 'go.sum' }, () => Content(BORU_ENG_GOSUM))

  File({ name: 'Makefile' }, () => Content(`# ${model.name}-cli build. GENERATED by @voxgig/sdkgen ${target.name} target.
BINARY := ${model.name}-cli
DIST := dist
GOOS := $(shell go env GOOS)
GOARCH := $(shell go env GOARCH)
EXT := $(if $(filter windows,$(GOOS)),.exe,)

.PHONY: build build-all clean

# Native build for the current machine -> dist/<os>-<arch>/${model.name}-cli.
build:
\tgo build -o $(DIST)/$(GOOS)-$(GOARCH)/$(BINARY)$(EXT) .

# Cross-compiled release binaries: three desktop OSes x amd64/arm64, each named
# ${model.name}-cli (+ .exe on windows) inside its own dist/<os>-<arch>/ folder.
build-all: clean
\tGOOS=linux   GOARCH=amd64 go build -o $(DIST)/linux-amd64/$(BINARY) .
\tGOOS=linux   GOARCH=arm64 go build -o $(DIST)/linux-arm64/$(BINARY) .
\tGOOS=darwin  GOARCH=amd64 go build -o $(DIST)/darwin-amd64/$(BINARY) .
\tGOOS=darwin  GOARCH=arm64 go build -o $(DIST)/darwin-arm64/$(BINARY) .
\tGOOS=windows GOARCH=amd64 go build -o $(DIST)/windows-amd64/$(BINARY).exe .
\tGOOS=windows GOARCH=arm64 go build -o $(DIST)/windows-arm64/$(BINARY).exe .

clean:
\trm -rf $(DIST) $(BINARY) ${built}
`))

  File({ name: 'main.go' }, () => {
    Fragment(
      {
        from: Path.join(FRAGMENT, 'main.fragment.go'),
        replace: {
          ...props.ctx$.stdrep,
          GOMODULE: sdkModule,
          APIKEYENVVAR: env.apikey,
          BASEENVVAR: env.base,
          '/[ \\t]*\\/\\/ #Options\\n/': () => Content(readOptions(model)),
        },
      },
      () => {
        Slot({ name: 'promptName' }, () => Content(model.name))
        Slot({ name: 'entityNamesSpaced' }, () => Content(entityNames.join(' ')))
      },
    )
  })

  File({ name: 'words.go' }, () => {
    Fragment(
      {
        from: Path.join(FRAGMENT, 'words.fragment.go'),
        replace: {
          ...props.ctx$.stdrep,
          GOMODULE: sdkModule,
        },
      },
      () => {
        Slot({ name: 'entityCases' }, () => {
          each(entityMap, (entity: ModelEntity) => {
            const lower = entity.name.toLowerCase()
            const pascal = (entity as any).Name
            Content(`\tcase "${lower}":
\t\treturn client.${pascal}(nil), nil
`)
          })
        })
      },
    )
  })
})


export {
  Main
}
