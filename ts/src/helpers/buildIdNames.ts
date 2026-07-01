// Build the list of placeholder ID names that the test setup populates into
// `setup.idmap`. The set is the union of:
//   - the entity's own ids (`<entity>01..03`)
//   - every ancestor entity's ids (`<anc>01..03`)
//   - every literal string value referenced by `step.match` across the flow
//     (e.g. path-parameter aliases like `year01` for `/{year}/domain` — apidef
//     doesn't always populate `relations.ancestors` when the parent in the
//     path is a bare parameter rather than an entity, so we have to mine the
//     flow steps directly to avoid KeyError-ing the idmap from generated test
//     code)
//
// Identical helper was previously inlined in TestEntity_{go,py,lua,rb,php}.ts.

const COUNT = 3 // 3 ids per name: <name>01, <name>02, <name>03

type FlowLike = {
  step?: Record<string, any> | any[]
}

type EntityLike = {
  name: string
  relations?: {
    ancestors?: any
  }
}

function buildIdNames(entity: EntityLike, flow: FlowLike): string[] {
  const idnames: string[] = []
  const seen = new Set<string>()
  const push = (n: string) => {
    if (!seen.has(n)) {
      seen.add(n)
      idnames.push(n)
    }
  }

  for (let i = 1; i <= COUNT; i++) push(`${entity.name}0${i}`)

  const ancestors: string[] = (entity.relations?.ancestors || []).flat()
  for (const anc of ancestors) {
    for (let i = 1; i <= COUNT; i++) push(`${anc}0${i}`)
  }

  const steps = Array.isArray(flow?.step)
    ? flow.step
    : Object.values(flow?.step || {})
  for (const step of steps) {
    if (step?.match) {
      for (const v of Object.values(step.match)) {
        if (typeof v === 'string' && v && !v.endsWith('$')) push(v)
      }
    }
    // step.data values can also be aliased via setup (e.g. update step.data
    // = {data_type_id: 'data_type01'} → setup adds idmap[data_type_id] =
    // idmap[data_type01]). The right-hand side `data_type01` must be in the
    // idmap or the alias resolves to undefined.
    if (step?.data) {
      for (const v of Object.values(step.data)) {
        if (typeof v === 'string' && v && !v.endsWith('$')) push(v)
      }
    }
  }

  return idnames
}


export {
  buildIdNames,
}
