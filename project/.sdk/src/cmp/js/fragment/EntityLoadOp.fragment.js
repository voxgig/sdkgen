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

  
  // #ModifyOp-Hook

  this.#match = op.match
  
  await spec(ctx)

  
  // #PreFetch-Hook

  await request(ctx)

  
  // #PostFetch-Hook

  await response(ctx)

  
  // #ModifyResult-Hook
  
  await result(ctx)

  
  // #PostOperation-Hook

  if(null != ctx.result.resdata) {
    this.#data = ctx.result.resdata
  }

  return done(ctx)
}

} // REMOVED
