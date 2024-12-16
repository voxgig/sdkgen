class EntityOperation { // REMOVED
async create(data) {
  let entity = this
  let client = this.#client
  
  let op = {
    entity: 'Name',
    name:'create',
    path: 'PATH',
    params: ['PARAM'],
    query: this.#query,
    data,
    state: {},
    extract: (ctx)=>'EXTRACT',
  }
  
  let ctx = {client, entity, op}

  
  // #PreOperation-Hook    

  ctx.op = await this.#utility.operator(ctx)

  
  // #ModifyOp-Hook

  this.#data = ctx.op.data
  
  ctx.spec = await this.#utility.spec(ctx)

  
  // #PreFetch-Hook

  ctx.response = await this.#utility.fetch(ctx)

  
  // #PostFetch-Hook

  ctx.result = await this.#utility.response(ctx)

  // #ModifyResult-Hook


  if(ctx.result.ok) {
    ctx.exdata = this.#utility.extract(ctx)

    // #ModifyData-Hook

    if(null != ctx.exdata) {
      this.#data = ctx.exdata
    }
    
    this.#postCreateHook(ctx)  

    return this
  }
  else {
    this.#postCreateHook(ctx)

    return this.#utility.error(ctx)
  }
}

#postCreateHook(ctx) {
  // #PostOperation-Hook
}
} // REMOVED
