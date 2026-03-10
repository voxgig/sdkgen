class EntityOperation { // REMOVED

async list(match) {
  let entity = this
  let client = this.#client
  const utility = this.#utility
    const { operator, makeSpec, makeRequest, makeResponse, makeResult, error, struct, done } = utility
  
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

  
  // #PreTarget-Hook    

  await operator(ctx)

  
  // #PreSpec-Hook

  this.#match = ctx.op.match
  
  await makeSpec(ctx)

  
  // #PreRequest-Hook

  await makeRequest(ctx)

  
  // #PreResponse-Hook

  await makeResponse(ctx)

  
  // #PreResult-Hook

  await makeResult(ctx)


  // #PostOperation-Hook

  return done(ctx)
}

} // REMOVED
