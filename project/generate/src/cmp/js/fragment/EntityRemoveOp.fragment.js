class EntityOperation { // REMOVED
async remove(query) {
  let entity = this
  let client = this.#client
  
  let op = {
    entity: 'Name',
    name:'remove',
    path: 'PATH',
    params: ['PARAM-LIST'],
    alias: {'ALIAS':'MAP'},
    query,
    data: this.#data,
    state: {},
    inward: (ctx)=>'INWARD',
    outward: (ctx)=>'OUTWARD',
  }
  
  let ctx = {client, entity, op}


  // #PreOperation-Hook    

  ctx.op = await this.#utility.operator(ctx)

  
  // #ModifyOp-Hook

  this.#query = op.query
  
  ctx.spec = await this.#utility.spec(ctx)

  
  // #PreFetch-Hook

  ctx.response = await this.#utility.fetch(ctx)

  
  // #PostFetch-Hook

  ctx.result = await this.#utility.response(ctx)

  // #ModifyResult-Hook


  if(ctx.result.ok) {
    ctx.indata = this.#utility.inward(ctx)

    if(null != ctx.indata) {
      this.#data = ctx.indata
    }
    
    this.#postRemoveHook(ctx)  

    return this
  }
  else {
    this.#postRemoveHook(ctx)

    return this.#utility.error(ctx)
  }
}

#postRemoveHook(ctx) {
  // #PostOperation-Hook
}
} // REMOVED
