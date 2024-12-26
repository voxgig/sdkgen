class EntityOperation { // REMOVED

  // TODO: rename query to match to avoif conflict with url query params  
async load(query) {
  const entity = this
  const client = this.#client
  const utility = this.#utility
  const { operator, spec, fetch, response, inward, error } = utility
  
  const op = {
    entity:'Name',
    name:'load',
    path: 'PATH',
    params: ['PARAM-LIST'],
    alias: {'ALIAS':'MAP'},
    query,
    data: this.#data,
    state: {},
    inward: (ctx)=>'INWARD',
    outward: (ctx)=>'OUTWARD',
  }

  let ctx = {client, entity, op, utility}

  
  // #PreOperation-Hook    

  ctx.op = await operator(ctx)

  
  // #ModifyOp-Hook

  this.#query = op.query
  
  ctx.spec = await spec(ctx)

  
  // #PreFetch-Hook

  ctx.response = await fetch(ctx)

  
  // #PostFetch-Hook

  ctx.result = await response(ctx)

  // #ModifyResult-Hook
  

  if(ctx.result.ok) {
    ctx.indata = inward(ctx)

    if(null != ctx.indata) {
      this.#data = ctx.indata
    }
    
    this.#postLoadHook(ctx)  

    return this
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
