class EntityOperation { // REMOVED

async list(match) {
  let entity = this
  let client = this.#client
  const utility = this.#utility
    const { operator, spec, request, response, result, error, struct, done } = utility
  
  let op = {
    entity: 'Name',
    name: 'list',
    path: 'PATH',
    params: ['PARAM-LIST'],
    alias: {'ALIAS':'MAP'},
    match,
    data: this.#data,
    state: {},
    reqform: 'REQFORM',
    resform: 'RESFORM',
  }

  let ctx = { client, entity, op, utility}

  
  // #PreOperation-Hook    

  await operator(ctx)

  
  // #PreSpec-Hook

  this.#match = ctx.op.match
  
  await spec(ctx)

  
  // #PreRequest-Hook

  await request(ctx)

  
  // #PreResponse-Hook

  await response(ctx)

  
  // #PreResult-Hook

  await result(ctx)


  // #PostOperation-Hook

  return done(ctx)
}

} // REMOVED
