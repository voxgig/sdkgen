

const OPKIND = {
  create: 'req',
  update: 'req',
  remove: 'req',
  load: 'res',
  list: 'res',
}


// Ensure standard operation definition.
function operator(ctx) {
  const { op, utility } = ctx

  const { string, array, object, func } = utility.validate
  
  const whence = 'operator definition: field: '
  
  let out = {
    // Required.
    name: string(op.name, false, whence+'name'),
    kind: string(OPKIND[op.name], false, whence+'kind'),
    path: string(op.path, false, whence+'path'),
    entity: string(op.entity, false, whence+'entity'),
    inward: func(op.inward, false, whence+'inward'),
    outward: func(op.outward, false, whence+'outward'),

    // Optional.
    params: array(op.params, true, whence+'params').map((p, i)=>string(p, whence+'param '+i)),
    alias: object(op.alias, true, whence+'alias'),
    match: {...object(op.match, true, whence+'match')},
    data: {...object(op.data, true, whence+'data')},
    state: object(op.state, true, whence+'state'),
  }

  return out
}


module.exports = {
  operator
}
