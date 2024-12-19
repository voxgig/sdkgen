

// NOTE: duplicated in @voxgig/apidef - dedup to @voxgig/util?
const OPKIND = {
  create: 'req',
  update: 'req',
  remove: 'req',
  load: 'res',
  list: 'res',
}


// Ensure standard operation definition.
function operator(ctx) {
  const { op } = ctx
  
  let out = {
    name: op.name,
    kind: OPKIND[op.name],
    entity: op.entity,
    path: op.path,
    params: op.params || [],
    query: {...op.query} || {},
    data: {...op.data} || {},
    state: op.state,
    inward: op.inward,
    outward: op.outward,
  }

  return out
}


module.exports = {
  operator
}
