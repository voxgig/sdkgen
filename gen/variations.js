// The model variations that exercise the README quick start. Each is a spec
// for lib2.generate. The baseline matches the spike's B (Bearer auth, a
// templated server URL with one required variable `tenant` and one defaulted
// `region`, all features); doc-* reuse the README-lane models (DOC_MODELS).
const SDK20 = ['ts', 'js', 'go', 'py', 'php', 'rb', 'lua', 'csharp', 'java', 'kotlin',
  'scala', 'swift', 'rust', 'c', 'cpp', 'zig', 'perl', 'clojure', 'elixir', 'ocaml']

const EXTRA = {
  secrets: 'main: kit: feature: secrets: active: true',
  auth: "main: kit: config: auth: { active: true, prefix: 'Bearer' }",
  servers: "main: kit: info: servers: [ { url: 'https://{tenant}.example.com/{region}'," +
    " variables: { tenant: { default: '' }, region: { default: 'eu' } } } ]",
}

function variations(H, allFeatures) {
  const D = Object.fromEntries(H.DOC_MODELS)
  const entOff = (n) => `main: kit: entity: ${n}: active: false`
  const V = []
  const add = (id, how, over = {}) => {
    const extra = { ...EXTRA, ...(over.set || {}) }
    for (const k of over.drop || []) delete extra[k]
    V.push({ id, how, alias: over.alias, spec: {
      targets: over.targets || SDK20, features: over.features || allFeatures,
      extra: [...Object.values(extra), over.extra || ''].join('\n'), api: over.api,
    } })
  }
  add('B', 'baseline: Bearer, templated server (tenant required, region defaulted), example entity ambient (load-only singleton)')
  add('auth-basic', 'HTTP Basic in the Authorization header', { set: { auth: "main: kit: config: auth: { active: true, prefix: 'Basic', basic: true }" } })
  add('auth-basic-query', 'HTTP Basic declared with the key in the query string (no runtime reads a secret)', { set: { auth: "main: kit: config: auth: { active: true, prefix: 'Basic', basic: true, in: 'query', name: 'api_key' }" } })
  add('auth-query', 'API key in the query string', { set: { auth: "main: kit: config: auth: { active: true, prefix: '', in: 'query', name: 'api_key' }" } })
  add('auth-off', 'no auth', { drop: ['auth'] })
  add('server-mixed', 'templated URL: {account} referenced and undeclared (required), {region} defaulted', { set: { servers: "main: kit: info: servers: [ { url: 'https://{account}.example.com/{region}', variables: { region: { default: 'eu' } } } ]" } })
  add('server-static', 'a fixed server URL', { set: { servers: "main: kit: info: servers: [ { url: 'https://api.example.com' } ]" } })
  add('server-none', 'no servers entry', { drop: ['servers'] })
  // The example entity itself is read-only: planet (first active) keeps list
  // and load. Replaces op-absent-readonly, whose example entity stayed ambient.
  add('ex-readonly', 'example entity planet with list and load only (no write step)', {
    extra: H.DOC_MODELS[2][1].split('main: kit: entity: planet: op: patch')[0],
    api: (api) => api.replace(/    create: \{\n      name: "create"[\s\S]*?\n    remove: \{[\s\S]*?\n    \}\n  \}\n\}\n\n\n# Singleton/,
      '  }\n}\n\n\n# Singleton').replace(/\{ o: "create", i: \{ ref: "planet_ref01" \} \}\n/, '')
      .replace(/\{ o: "update", i: \{\n[^\n]*\n[^\n]*\} \}\n/, '').replace(/\{ o: "remove", i: \{ ref: "planet_ref01", suffix: "_rm0" \} \}\n/, '') })
  add('ent-only-ambient', 'only the load-only singleton active', { extra: ['planet', 'history', 'utility', 'graph_ql', 'console', 'record'].map(entOff).join('\n') })
  add('ent-none', 'every entity off', { extra: ['planet', 'ambient', 'history', 'utility', 'graph_ql', 'console', 'record'].map(entOff).join('\n') })
  add('doc-list', 'README lane model "list": example entity console (list only)', { extra: D.list })
  add('doc-crud', 'README lane model "crud": example entity planet, every op incl. patch', { extra: D.crud })
  add('doc-nested', 'README lane model "nested": planet first, satellite nested under it', { extra: D.nested })
  add('crud-basic', 'crud with HTTP Basic in the header', { extra: D.crud, set: { auth: "main: kit: config: auth: { active: true, prefix: 'Basic', basic: true }" } })
  add('crud-bare', 'crud, no auth, no server', { extra: D.crud, drop: ['auth', 'servers'] })
  add('crud-noupdate', 'planet first, its update never declared: list, load, create and remove', { extra: H.DOC_MODELS[2][1].split('main: kit: entity: planet: op: patch')[0],
    api: (api) => api.replace(/    update: \{\n      name: "update"[\s\S]*?\n    \}\n(?=    remove: \{)/, '').replace(/\{ o: "update", i: \{\n[^\n]*\n[^\n]*\} \}\n/, '') })
  // Reference-page issues in one model: an inactive remove (S25/D10), a
  // project entity_desc with a pipe (U36), an entity with no id that updates
  // (U43), a field description with a pipe, a line break and a relative link
  // (G27/G29/M38/D69), field usage by operation, and an entity whose data
  // type takes the planet class name (U34).
  add('ref-issues', 'crud planet with remove off, entity_desc override, id-less update, vendor text with | and a link, class-name collision', {
    extra: D.crud + `
main: kit: text: entity_desc: planet: 'Words the project chose | not the spec'
main: kit: entity: gauge: {
  alias: field: {}
  name: "gauge"
  short: "A gauge."
  field: { level: { name: "level", kind: "field", type: "\`$STRING\`" } }
  fields: {
    "level": { h: 'Level', n: "level", r: false, t: "\`$STRING\`", sh: "Level | percent\\nsee [the guide](guide.md) or [site](https://example.com/x)", op: { update: {} } }
  }
  op: {
    update: { name: "update", points: [ {
      g: {}, m: "PUT", o: "/gauge", s: [{ lit: "gauge" }]
      t: { req: "\`reqdata\`", res: "\`body\`" } } ] }
  }
}
main: kit: entity: planet_entity: {
  alias: field: {}
  name: "planet_entity"
  field: { id: { name: "id", kind: "field", type: "\`$STRING\`", required: true } }
  fields: { "id": { h: 'Id', n: "id", r: true, t: "\`$STRING\`" } }
  op: {
    list: { name: "list", points: [ {
      g: {}, m: "GET", o: "/planet_entity", s: [{ lit: "planet_entity" }]
      t: { req: "\`reqdata\`", res: "\`body\`" } } ] }
  }
}
`, api: (api) => api.replace(/(    remove: \{\n      name: "remove")/, '$1\n      active: false') })
  add('no-test', 'every feature but test (the test constructor does not ship)', { features: allFeatures.filter((f) => 'test' !== f) })
  add('lone-go', 'go as the only target', { targets: ['go'] })
  add('alias-go2', 'go and go~go2 (an aliased copy of the go target)', { targets: ['go'], alias: { from: 'go', to: 'go2' } })
  return V
}
module.exports = { SDK20, EXTRA, variations }
