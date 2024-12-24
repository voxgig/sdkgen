class EntityOperation { // REMOVED
async list(query) {
  let entity = this
  let client = this.#client
  
  let op = {
    entity: 'Name',
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

  let ctx = {client, entity, op}

  
  // #PreOperation-Hook    

  ctx.op = await this.#utility.operator(ctx)

  
  // #ModifyOp-Hook

  this.#query = ctx.op.query
  
  ctx.spec = await this.#utility.spec(ctx)

  
  // #PreFetch-Hook

  ctx.response = await this.#utility.fetch(ctx)

  
  // #PostFetch-Hook

  ctx.result = await this.#utility.response(ctx)

  // #ModifyResult-Hook


  if(ctx.result.ok) {
    ctx.inlist = this.#utility.inward(ctx)

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

    return this.#utility.error(ctx)
  }
}

#postListHook(ctx) {
  // #PostOperation-Hook
}
} // REMOVED
