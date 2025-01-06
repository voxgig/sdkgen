class EntityOperation { // REMOVED
async list(match) {
  let entity = this
  let client = this.#client
  const utility = this.#utility
  const { operator, spec, request, response, inward, error } = utility
  
  let op = {
    entity: 'Name',
    name:'load',
    path: 'PATH',
    params: ['PARAM-LIST'],
    alias: {'ALIAS':'MAP'},
    match,
    data: this.#data,
    state: {},
    inward: (ctx)=>'INWARD',
    outward: (ctx)=>'OUTWARD',
  }

  let ctx = {client, entity, op, utility}

  
  // #PreOperation-Hook    

  ctx.op = await operator(ctx)

  
  // #ModifyOp-Hook

  this.#match = ctx.op.match
  
  ctx.spec = await spec(ctx)

  
  // #PreFetch-Hook

  ctx.response = await request(ctx)

  
  // #PostFetch-Hook

  ctx.result = await response(ctx)

  // #ModifyResult-Hook


  if(ctx.result.ok) {
    ctx.inlist = inward(ctx)

    const entities = []

    if(null != ctx.inlist) {
      for(let entry of ctx.inlist) {
        const entity = new NameEntity(this.#client, this.options())
        entity.data(entry)
        entities.push(entity)
      }
    }
    
    this.#postListHook(ctx)
    
    return entities
  }
  else {
    this.#postListHook(ctx)

    return error(ctx)
  }
}

#postListHook(ctx) {
  // #PostOperation-Hook
}
} // REMOVED
