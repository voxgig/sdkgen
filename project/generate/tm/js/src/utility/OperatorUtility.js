
const { string }  = require('./ValidateUtility')


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

  const whence = 'operator definition: field: '
  
  let out = {
    name: string(op.name, whence+'name'),
    kind: string(OPKIND[op.name], whence+'kind'),
    path: string(op.path, whence+'path'),
    entity: string(op.entity, whence+'entity'),
    params: (op.params || []).map((p,i)=>string(p,'param '+i)),
    alias: op.alias || {},
    query: {...op.query} || {},
    data: {...op.data} || {},
    state: op.state,
    inward: op.inward,
    outward: op.outward,
  }

  console.log('operator', out)
  
  return out
}


module.exports = {
  operator
}
