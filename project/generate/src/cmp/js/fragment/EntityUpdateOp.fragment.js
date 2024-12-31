class EntityOperation { // REMOVED
async update(data) {
  let entity = this
  let client = this.#client
  const utility = this.#utility
  const { operator, spec, fetch, response, inward, error } = utility
  
  let op = {
    entity: 'Name',
    name:'update',
    path: 'PATH',
    params: ['PARAM-LIST'],
    alias: {'ALIAS':'MAP'},
    match: this.#match,
    data: null == data ? this.#data : data,
    state: {},
    inward: (ctx)=>'INWARD',
    outward: (ctx)=>'OUTWARD',
  }
  
  let ctx = {client, entity, op, utility}


  // #PreOperation-Hook    

  ctx.op = await operator(ctx)

  
  // #ModifyOp-Hook

  this.#data = op.data
  
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
    
    this.#postUpdateHook(ctx)  

    return this
  }
  else {
    this.#postUpdateHook(ctx)

    return error(ctx)
  }
}

#postUpdateHook(ctx) {
  // #PostOperation-Hook
}
} // REMOVED
