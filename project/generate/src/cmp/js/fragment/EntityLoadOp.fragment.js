class EntityOperation { // REMOVED

async load(match) {
  const entity = this
  const client = this.#client
  const utility = this.#utility
  const { operator, spec, request, response, inward, error, struct } = utility
  
  const op = {
    entity:'Name',
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

  this.#match = op.match
  
  ctx.spec = await spec(ctx)

  
  // #PreFetch-Hook

  ctx.response = await request(ctx)

  
  // #PostFetch-Hook

  ctx.result = await response(ctx)

  // #ModifyResult-Hook
  

  if(ctx.result.ok) {
    ctx.inward = inward(ctx)

    if(null != ctx.inward) {
      this.#data = ctx.inward
    }

    ctx.out = this.data()
    
    this.#postLoadHook(ctx)  

    return ctx.out
  }
  else {
    this.#postLoadHook(ctx)

    return error(ctx)
  }
}

#postLoadHook(ctx) {
  // #PostOperation-Hook
}
} // REMOVED
