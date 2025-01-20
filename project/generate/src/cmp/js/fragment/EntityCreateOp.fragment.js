class EntityOperation { // REMOVED
async create(data) {
  let entity = this
  let client = this.#client
  const utility = this.#utility
  const { operator, spec, request, response, inward, error, struct } = utility
  
  let op = {
    entity: 'Name',
    name:'create',
    path: 'PATH',
    params: ['PARAM-LIST'],
    alias: {'ALIAS':'MAP'},
    match: this.#match,
    data: null == data ? this.#data : data,
    state: {},
    inward: (ctx)=>'INWARD',
    outward: (ctx)=>'OUTWARD',
  }
  
  let ctx = { client, op, utility, entity }

  
  // #PreOperation-Hook    

  ctx.op = await operator(ctx)

  
  // #ModifyOp-Hook

  this.#data = ctx.op.data
  
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
    
    this.#postCreateHook(ctx)  

    return ctx.out
  }
  else {
    this.#postCreateHook(ctx)

    return error(ctx)
  }
}

#postCreateHook(ctx) {
  // #PostOperation-Hook
}
} // REMOVED
