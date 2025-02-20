

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
  const { validate } = utility.struct

  const opspec = {

    // Required.
    name: '`$STRING`',
    kind: ['`$ONE`','req','res'],
    path: '`$STRING`',
    entity: '`$STRING`',
    reqform: ['`$ONE`','`$STRING`','`$OBJECT`','`$FUNCTION`'],
    resform: ['`$ONE`','`$STRING`','`$OBJECT`','`$FUNCTION`'],

    // Optional.
    params: ['`$CHILD`', '`$STRING`'],
    alias: {'`$CHILD`': '`$STRING`' },
    match: {},
    data: ['`$ONE`',{}, []],
    state: {},
    check: {},
  }

  ctx.op.kind = OPKIND[op.name]
  
  ctx.op = validate(ctx.op, opspec)
}


module.exports = {
  operator
}
