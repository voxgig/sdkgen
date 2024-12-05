
async function remove(query) {

  // #PreOperation-Hook    

  let op = await this.#utility.op({name:'Name', op:'remove', query, data: this.#data})
  
  // #ModifyOp-Hook
  
  this.#query = op.query

  let spec = await this.#utility.spec(op)

  // #PreFetch-Hook

  let response = await this.#utility.fetch(op, spec)
  
  // #PostFetch-Hook

  let result = await this.#utility.response(op, spec, response)
  
  // #PostOperation-Hook

  return result
}
