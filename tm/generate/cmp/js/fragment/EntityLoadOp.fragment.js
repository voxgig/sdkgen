
async function load(query) {
  let entity = this
  let client = this.#client
  
  let op = {
    entity:'Name',
    name:'load',
    path: 'PATH',
    params: ['PARAM'],
    query,
    data: this.#data
  }
  
  // #PreOperation-Hook    

  op = await this.#utility.operator({client, entity, op})

  
  // #ModifyOp-Hook

  this.#query = op.query
  
  let spec = await this.#utility.spec({client, entity, op})

  
  // #PreFetch-Hook

  let response = await this.#utility.fetch({client, entity, op, spec})

  
  // #PostFetch-Hook

  let result = await this.#utility.response({client, entity, op, spec, response})

  
  // #PostOperation-Hook

  return result
}
