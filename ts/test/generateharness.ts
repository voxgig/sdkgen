
import Fs, { writeFileSync } from 'node:fs'
import Path from 'node:path'

import { strictEqual } from 'node:assert'

import { Aontu } from 'aontu'
import { cmp, each, names, Project, Folder } from 'jostraca'

import {
  Main, Entity, Feature, Readme, Test as TestCmp, AgentGuide,
  ReadmeTop, AgentGuideTop, License, Security, Changelog, Deploy,
  registerComponent,
} from '../dist/sdkgen.js'


const KIT = 'kit'

const STAGE = Path.resolve(__dirname, '..', 'dist-test-scaffold')

// Components copy their template tree with a CWD-RELATIVE path
// (`Copy({ from: 'tm/<lang>' })`, as a consumer runs generation from its
// `.sdk/`), so generation runs with the shipped scaffold as the working
// directory. Nothing is written there — writes go to memfs.
const SCAFFOLD = Path.resolve(__dirname, '..', 'project', '.sdk')


// Keep generator chatter out of the test output. SdkGen builds its logger with
// prettyPino, which hands back `opts.pino` when one is supplied — so a silent
// stub here replaces the whole log tree (sdkgen's own child and jostraca's).
const noop = () => { }
const makeLog = (sink?: any[]): any => {
  const record = (entry: any) => { if (sink) sink.push(entry) }
  const log: any = {
    info: record, debug: record, warn: record, error: record,
    trace: noop, fatal: noop,
  }
  log.child = () => log
  return log
}


function layeredFs(mem: any): any {
  const readThrough = (name: string) => (path: any, ...rest: any[]) => {
    const target = mem.existsSync(path) ? mem : Fs
    return (target as any)[name](path, ...rest)
  }

  return {
    ...mem,
    existsSync: (path: any) => mem.existsSync(path) || Fs.existsSync(path),
    readFileSync: readThrough('readFileSync'),
    readdirSync: readThrough('readdirSync'),
    statSync: readThrough('statSync'),
    realpathSync: readThrough('realpathSync'),
  }
}


const API_MODEL = `
name: 'demo'

main: kit: info: { title: 'Demo', version: '1.0.0', auth: false }
main: kit: config: headers: { 'content-type': 'application/json' }


main: kit: entity: planet: {
  alias: field: {}
  name: "planet"

  # The entity-level id BINDING (distinct from the id field). TestEntity_<lang>
  # keys its generated assertions off this: without it the flow tests never
  # dereference \`.id\` on an op result, which is exactly the code that broke
  # when operations began resolving to entities. The fixture carried the field
  # but not the binding, so the suite generated a WEAKER test than any real
  # SDK, and missed the regression.
  id: { field: "id", name: "id" }
  field: {
    id:     { name: "id",     kind: "field", type: "\`$STRING\`", required: true }
    title:  { name: "title",  kind: "field", type: "\`$STRING\`", required: true }
    radius: { name: "radius", kind: "field", type: "\`$NUMBER\`" }
  }
  # The ORDERED field list the typed-model emitters read. Without it every
  # generated interface is empty, and a test asserting on a typed field
  # compiles against an empty object type instead of the real shape.
  fields: {
    "id": { h: 'Id', n: "id",     r: true,  t: "\`$STRING\`" }
    "radius": { h: 'Radius', n: "radius", r: false, t: "\`$NUMBER\`" }
    "title": { h: 'Title', n: "title",  r: true,  t: "\`$STRING\`" }
  }
  op: {
    list: {
      name: "list"
      points: [ {
        g: {}, m: "GET", o: "/planet", s: [{ lit: "planet" }]
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
    load: {
      name: "load"
      points: [ {
        g: { params: [
          { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "p01" }
        ] }
        m: "GET", o: "/planet/{id}", s: [{ lit: "planet" }, { var: "id" }]
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
    create: {
      name: "create"
      points: [
        {
          g: {}, m: "POST", o: "/planet", s: [{ lit: "planet" }]
          t: { req: "\`reqdata\`", res: "\`body\`" }
        }
        # A CUSTOM ACTION folded into create, selected by \`$action\` at call
        # time. apidef produces these for POST routes that are not the
        # entity's own create (e.g. /planet/{id}/terraform), and they sort
        # FIRST — which is how the root README came to advertise an action
        # route as the entity's API path.
        {
          g: { params: [
            { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "p01" }
          ] }
          m: "POST", o: "/planet/{id}/terraform", s: [{ lit: "planet" }, { var: "id" }, { lit: "terraform" }]
          q: { "$action": "terraform", exist: ["id"] }
          t: { req: "\`reqdata\`", res: "\`body\`" }
        }
      ]
    }
    update: {
      name: "update"
      points: [ {
        g: { params: [
          { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "p01" }
        ] }
        m: "PUT", o: "/planet/{id}", s: [{ lit: "planet" }, { var: "id" }]
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
    remove: {
      name: "remove"
      points: [ {
        g: { params: [
          { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "p01" }
        ] }
        m: "DELETE", o: "/planet/{id}", s: [{ lit: "planet" }, { var: "id" }]
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}


# Singleton: a load with no path params at all. There is nothing to pass it.
main: kit: entity: ambient: {
  alias: field: {}
  name: "ambient"
  field: {
    temperature: { name: "temperature", kind: "field", type: "\`$NUMBER\`" }
    flow:        { name: "flow",        kind: "field", type: "\`$NUMBER\`" }
  }
  fields: {
    "flow": { h: 'Flow', n: "flow",        r: false, t: "\`$NUMBER\`" }
    "temperature": { h: 'Temperature', n: "temperature", r: false, t: "\`$NUMBER\`" }
  }
  op: {
    load: {
      name: "load"
      points: [ {
        g: {}, m: "GET", o: "/ambient", s: [{ lit: "ambient" }]
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}


# List-only: nothing can be fetched, created or removed by id.
main: kit: entity: history: {
  alias: field: {}
  name: "history"
  field: {
    id:   { name: "id",   kind: "field", type: "\`$STRING\`", required: true }
    year: { name: "year", kind: "field", type: "\`$INTEGER\`" }
  }
  fields: {
    "id": { h: 'Id', n: "id",   r: true,  t: "\`$STRING\`" }
    "year": { h: 'Year', n: "year", r: false, t: "\`$INTEGER\`" }
  }
  op: {
    list: {
      name: "list"
      points: [ {
        g: {}, m: "GET", o: "/history", s: [{ lit: "history" }]
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}


# RESERVED NAMES. These four entity names collide with something that
# already exists in the generated code, and each one shipped a broken SDK:
#
#   utility  -> php private $_utility on the SDK class (fatal redeclare)
#   graph_ql -> php graphql(), added by the 2.x GraphQL rollout. PHP method
#               names are CASE-INSENSITIVE, so GraphQl() collides (fatal)
#   console  -> the JS/TS global. A generated for (const console of ...)
#               shadows it, and the example's own console.log then resolves
#               to the entity: "console.log is not a function"
#   record   -> the TS builtin generic Record<K,V>. export interface
#               Record {...} shadows it for the rest of the file, so
#               canonToType's own Record<string, any> (a generic-object
#               field) breaks: "Type 'Record' is not generic" — found
#               converting Airtable, whose record entity has exactly
#               this shape.
#
# The generator owns helpers for exactly this (safeVarName, isReservedName,
# exampleVarName, entityClassName); these entities prove they are actually
# applied, in the emitted source AND in the emitted documentation examples.
main: kit: entity: utility: {
  alias: field: {}
  name: "utility"
  field: {
    id:   { name: "id",   kind: "field", type: "\`$STRING\`", required: true }
    tool: { name: "tool", kind: "field", type: "\`$STRING\`" }
  }
  fields: {
    "id": { h: 'Id', n: "id",   r: true,  t: "\`$STRING\`" }
    "tool": { h: 'Tool', n: "tool", r: false, t: "\`$STRING\`" }
  }
  op: {
    list: {
      name: "list"
      points: [ {
        g: {}, m: "GET", o: "/utility", s: [{ lit: "utility" }]
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}

main: kit: entity: graph_ql: {
  alias: field: {}
  name: "graph_ql"
  field: {
    id:    { name: "id",    kind: "field", type: "\`$STRING\`", required: true }
    query: { name: "query", kind: "field", type: "\`$STRING\`" }
  }
  fields: {
    "id": { h: 'Id', n: "id",    r: true,  t: "\`$STRING\`" }
    "query": { h: 'Query', n: "query", r: false, t: "\`$STRING\`" }
  }
  op: {
    list: {
      name: "list"
      points: [ {
        g: {}, m: "GET", o: "/graphql", s: [{ lit: "graphql" }]
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}

main: kit: entity: console: {
  alias: field: {}
  name: "console"
  field: {
    id:    { name: "id",    kind: "field", type: "\`$STRING\`", required: true }
    maker: { name: "maker", kind: "field", type: "\`$STRING\`" }
  }
  fields: {
    "id": { h: 'Id', n: "id",    r: true,  t: "\`$STRING\`" }
    "maker": { h: 'Maker', n: "maker", r: false, t: "\`$STRING\`" }
  }
  op: {
    list: {
      name: "list"
      points: [ {
        g: {}, m: "GET", o: "/console", s: [{ lit: "console" }]
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}

# fields carries an OBJECT-typed field, canonToType's own "Record<string,
# any>" — the self-shadowing half of the collision, not just the name.
main: kit: entity: record: {
  alias: field: {}
  name: "record"
  field: {
    id:     { name: "id",     kind: "field", type: "\`$STRING\`", required: true }
    fields: { name: "fields", kind: "field", type: "\`$OBJECT\`" }
  }
  fields: {
    "id": { h: 'Id', n: "id",     r: true,  t: "\`$STRING\`" }
    "fields": { h: 'Fields', n: "fields", r: false, t: "\`$OBJECT\`" }
  }
  op: {
    list: {
      name: "list"
      points: [ {
        g: {}, m: "GET", o: "/record", s: [{ lit: "record" }]
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}


main: kit: flow: BasicUtilityFlow: {
  entity: "utility", kind: "basic", name: "BasicUtilityFlow"
  step: [
    { o: "list", i: { ref: "utility_ref01", srcdatavar: "utility_ref01_data", suffix: "_dt0" } }
  ]
}

main: kit: flow: BasicGraphQlFlow: {
  entity: "graph_ql", kind: "basic", name: "BasicGraphQlFlow"
  step: [
    { o: "list", i: { ref: "graph_ql_ref01", srcdatavar: "graph_ql_ref01_data", suffix: "_dt0" } }
  ]
}

main: kit: flow: BasicConsoleFlow: {
  entity: "console", kind: "basic", name: "BasicConsoleFlow"
  step: [
    { o: "list", i: { ref: "console_ref01", srcdatavar: "console_ref01_data", suffix: "_dt0" } }
  ]
}

main: kit: flow: BasicRecordFlow: {
  entity: "record", kind: "basic", name: "BasicRecordFlow"
  step: [
    { o: "list", i: { ref: "record_ref01", srcdatavar: "record_ref01_data", suffix: "_dt0" } }
  ]
}


main: kit: flow: BasicPlanetFlow: {
  entity: "planet", kind: "basic", name: "BasicPlanetFlow"
  step: [
    # Shaped like a REAL apidef-derived flow (voxgig-solardemo-sdk's
    # BasicPlanetFlow), not a hand-simplified one: create, list, update,
    # load, remove, with the srcdatavar/suffix bindings apidef actually
    # emits. A weaker fixture generated a weaker test, and missed a
    # regression that broke every consumer's flow suite.
    { o: "create", i: { ref: "planet_ref01" } }
    { o: "list" }
    { o: "update", i: {
        ref: "planet_ref01", srcdatavar: "planet_ref01_data",
        suffix: "_up0", textfield: "kind" } }
    { o: "load", i: {
        ref: "planet_ref01", srcdatavar: "planet_ref01_data", suffix: "_dt0" } }
    { o: "remove", i: { ref: "planet_ref01", suffix: "_rm0" } }
  ]
}

main: kit: flow: BasicAmbientFlow: {
  entity: "ambient", kind: "basic", name: "BasicAmbientFlow"
  step: [
    { o: "load", i: { ref: "ambient_ref01", srcdatavar: "ambient_ref01_data", suffix: "_dt0" } }
  ]
}

main: kit: flow: BasicHistoryFlow: {
  entity: "history", kind: "basic", name: "BasicHistoryFlow"
  step: [
    { o: "list", i: { ref: "history_ref01", srcdatavar: "history_ref01_data", suffix: "_dt0" } }
  ]
}
`


function makeModel(
  targetNames: string[], name?: string, extra?: string, features?: string[],
): any {
  const src = [
    '@"@voxgig/apidef/model/apidef.aontu"',
    '@"../../../model/sdkgen.aontu"',
    ...targetNames.map((t) => `@"target/${t}.aontu"`),
    ...(features || ['test', 'log']).map((f) => `@"feature/${f}.aontu"`),
    null == name ? API_MODEL : API_MODEL.replace(/^name: '[^']*'/m, `name: '${name}'`),
    extra || '',
  ].join('\n')

  const path = Path.join(STAGE, '.sdk', 'model', 'generate-test.aontu')
  writeFileSync(path, src)

  const errs: any[] = []
  const model = new Aontu().generate(src, { path, errs })

  strictEqual(errs.length, 0,
    'fixture model did not compile: ' +
    errs.map((e: any) => `[${e.why}] ${e.msg}`).join(' | '))

  return model
}


// Stand-ins for a project's own components. `ReadmeTopQuick` is implemented
// by every target, so it proves dispatch; nothing implements `NoSuchThing`,
// so it proves a target that opts out is skipped rather than fatal.
const RegisteredQuick = registerComponent('ReadmeTopQuick')
const RegisteredAbsent = registerComponent('NoSuchThing')


function makeRoot(): any {
  return cmp(function Root(props: any) {
    const { model, ctx$ } = props

    model.const = { name: model.name }
    names(model.const, model.name)
    model.const.year = 2026
    names(model, model.name)

    ctx$.model = model
    ctx$.stdrep = {}
    names(ctx$.stdrep, model.Name, 'ProjectName')

    const target = model.main[KIT].target || {}
    const feature = model.main[KIT].feature || {}
    const entity = model.main[KIT].entity || {}

    Project({}, () => {

      // The repo-root phase, which the real Root reaches through Top(). It is
      // not optional coverage: ReadmeTop is the ONLY route to the
      // ReadmeTopQuick_<lang> components, where the elixir defect lived.
      ReadmeTop({})
      AgentGuideTop({})
      License({})
      Security({})
      Changelog({})
      Deploy({})

      each(target, (target: any) => {
        names(target, target.name)

        Folder({ name: target.name }, () => {
          const phase = target.phase || {}
          const on = (name: string) => false !== (phase[name] && phase[name].active)

          if (on('entity')) {
            each(entity).filter((entity: any) => entity.active).map((entity: any) => {
              names(entity, entity.name)
              Entity({ target, entity })
            })
          }

          if (on('feature')) {
            each(feature)
              .filter((f: any) => f.active)
              .map((f: any) => {
                names(f, f.name)
                Feature({ target, feature: f })
              })
          }

          Main({ target })

          RegisteredQuick({ target })
          RegisteredAbsent({ target })

          if (on('readme')) Readme({ target })
          if (on('agentguide')) AgentGuide({ target })
          if (on('test')) TestCmp({ target })
        })
      })
    })
  })
}



export {
  KIT,
  STAGE,
  SCAFFOLD,
  API_MODEL,
  makeLog,
  layeredFs,
  makeModel,
  makeRoot,
}
