class EntityOperation { // REMOVED

async load(match) {
  const entity = this
  const client = this.#client
  const utility = this.#utility
  const { operator, spec, request, response, result, error, struct, done } = utility
  
  const op = {
    entity: 'Name',
    name: 'load',
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

  this.#match = op.match
  
  await spec(ctx)

  
  // #PreRequest-Hook

  await request(ctx)

  
  // #PreResponse-Hook

  await response(ctx)

  
  // #PreResult-Hook
  
  await result(ctx)

  
  // #PostOperation-Hook

  if(null != ctx.result.resdata) {
    this.#data = ctx.result.resdata
  }

  return done(ctx)
}

} // REMOVED
