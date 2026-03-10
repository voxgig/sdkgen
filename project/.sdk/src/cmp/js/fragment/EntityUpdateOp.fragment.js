class EntityOperation { // REMOVED

async update(data) {
  let entity = this
  let client = this.#client
  const utility = this.#utility
  const { operator, makeSpec, makeRequest, makeResponse, makeResult, error, struct, done } = utility
  
  let op = {
    entity: 'Name',
    name: 'update',
    path: 'PATH',
    params: ['PARAM-LIST'],
    alias: {'ALIAS':'MAP'},
    match: this.#match,
    data: null == data ? this.#data : data,
    state: {},
    reqform: 'REQFORM',
    resform: 'RESFORM',
  }
  
  let ctx = {client, entity, op, utility}


  // #PreTarget-Hook    

  await operator(ctx)

  
  // #PreSpec-Hook

  this.#data = op.data
  
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
