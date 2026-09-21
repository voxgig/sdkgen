
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
    for (let i = 1; i <= COUNT; i++) push(`${entityRelationName(anc)}0${i}`)
  }

  const steps = Array.isArray(flow?.step)
    ? flow.step
    : Object.values(flow?.step || {})
  for (const step of steps.filter((s: any) => false !== s.a)) {
    if (step?.m) {
      for (const v of Object.values(step.m)) {
        if (typeof v === 'string' && v && !v.endsWith('$')) push(v)
      }
    }
    // step.d values can also be aliased via setup (e.g. update step.d
    // = {data_type_id: 'data_type01'} → setup adds idmap[data_type_id] =
    // idmap[data_type01]). The right-hand side `data_type01` must be in the
    // idmap or the alias resolves to undefined.
    if (step?.d) {
      for (const v of Object.values(step.d)) {
        if (typeof v === 'string' && v && !v.endsWith('$')) push(v)
      }
    }
  }

  return idnames
}


function entityRelationName(ref: string): string {
  return ref.startsWith('$.main.kit.entity.') ? ref.slice('$.main.kit.entity.'.length) : ref
}

function flowSteps(flow: FlowLike): any[] {
  return Object.values(flow?.step || {}).filter((step: any) => false !== step.a)
}

export {
  buildIdNames,
  entityRelationName,
  flowSteps,
}
