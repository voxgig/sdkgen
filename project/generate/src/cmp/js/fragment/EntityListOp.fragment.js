class EntityOperation { // REMOVED
async list(match) {
  let entity = this
  let client = this.#client
  const utility = this.#utility
  const { operator, spec, request, response, inward, error, struct } = utility
  
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
    ctx.inward = inward(ctx)

    ctx.out = []

    if(null != ctx.inward) {
      for(let entry of ctx.inward) {
        const entity = new NameEntity(this.#client, this.options())
        entity.data(entry)
        ctx.out.push(entity)
      }
    }
    
    this.#postListHook(ctx)
    
    return ctx.out
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
