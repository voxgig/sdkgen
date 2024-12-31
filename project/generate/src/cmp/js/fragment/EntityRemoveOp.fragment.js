class EntityOperation { // REMOVED
async remove(match) {
  let entity = this
  let client = this.#client
  const utility = this.#utility
  const { operator, spec, fetch, response, inward, error } = utility
  
  let op = {
    entity: 'Name',
    name:'remove',
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

  ctx.response = await fetch(ctx)

  
  // #PostFetch-Hook

  ctx.result = await response(ctx)

  // #ModifyResult-Hook


  if(ctx.result.ok) {
    ctx.indata = inward(ctx)

    if(null != ctx.indata) {
      this.#data = ctx.indata
    }
    
    this.#postRemoveHook(ctx)  

    return this
  }
  else {
    this.#postRemoveHook(ctx)

    return error(ctx)
  }
}

#postRemoveHook(ctx) {
  // #PostOperation-Hook
}
} // REMOVED
