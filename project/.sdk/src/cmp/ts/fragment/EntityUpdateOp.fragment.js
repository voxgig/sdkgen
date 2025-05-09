class EntityOperation { // REMOVED

async update(data) {
  let entity = this
  let client = this.#client
  const utility = this.#utility
  const { operator, spec, request, response, result, error, struct, done } = utility
  
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


  // #PreOperation-Hook    

  await operator(ctx)

  
  // #PreSpec-Hook

  this.#data = op.data
  
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
