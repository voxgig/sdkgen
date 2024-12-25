
const { string, array, object, func }  = require('./ValidateUtility')


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
    params: array(op.params, true, 'params').map((p, i)=>string(p, 'param '+i)),
    alias: object(op.alias, true, 'alias'),
    query: {...object(op.query, true, 'query')},
    data: {...object(op.data, true, 'data')},
    state: object(op.state, true, 'state'),
    inward: func(op.inward, false, 'inward'),
    outward: func(op.outward, false, 'outward'),
  }

  return out
}


module.exports = {
  operator
}
