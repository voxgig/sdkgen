class EntityOperation { // REMOVED

async load(match) {
  const entity = this
  const client = this.#client
  const utility = this.#utility
  const { operator, makeSpec, makeRequest, makeResponse, makeResult, error, struct, done } = utility
  
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
  
  await makeSpec(ctx)

  
  // #PreRequest-Hook

  await makeRequest(ctx)

  
  // #PreResponse-Hook

  await makeResponse(ctx)

  
  // #PreResult-Hook
  
  await makeResult(ctx)

  
  // #PostOperation-Hook

  if(null != ctx.result.resdata) {
    this.#data = ctx.result.resdata
  }

  return done(ctx)
}

} // REMOVED
