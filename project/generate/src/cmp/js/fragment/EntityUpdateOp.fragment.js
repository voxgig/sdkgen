class EntityOperation { // REMOVED
async update(data) {
  let entity = this
  let client = this.#client
  
  let op = {
    entity: 'Name',
    name:'update',
    path: 'PATH',
    params: ['PARAM-LIST'],
    alias: {'ALIAS':'MAP'},
    query: this.#query,
    data: null == data ? this.#data : data,
    state: {},
    inward: (ctx)=>'INWARD',
    outward: (ctx)=>'OUTWARD',
  }
  
  let ctx = {client, entity, op}


  // #PreOperation-Hook    

  ctx.op = await this.#utility.operator(ctx)

  
  // #ModifyOp-Hook

  this.#data = op.data
  
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
    
    this.#postUpdateHook(ctx)  

    return this
  }
  else {
    this.#postUpdateHook(ctx)

    return this.#utility.error(ctx)
  }
}

#postUpdateHook(ctx) {
  // #PostOperation-Hook
}
} // REMOVED
