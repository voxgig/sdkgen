class EntityOperation { // REMOVED
async load(query) {
  let entity = this
  let client = this.#client
  
  let op = {
    entity:'Name',
    name:'load',
    path: 'PATH',
    params: ['PARAM'],
    query,
    data: this.#data,
    state: {},
    extract: (ctx)=>'EXTRACT',
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
    ctx.exdata = this.#utility.extract(ctx)

    // #ModifyData-Hook

    if(null != ctx.exdata) {
      this.#data = ctx.exdata
    }
    
    this.#postLoadHook(ctx)  

    return this
  }
  else {
    this.#postLoadHook(ctx)

    return this.#utility.error(ctx)
  }
}

#postLoadHook(ctx) {
  // #PostOperation-Hook
}
} // REMOVED
