
async function create(data) {

  // #PreOperation-Hook    

  let op = await this.#utility.op({name:'Name', op:'create', query: this.#query, data})
  
  // #ModifyOp-Hook
  
  this.#data = op.data

  let spec = await this.#utility.spec(op)

  // #PreFetch-Hook

  let response = await this.#utility.fetch(op, spec)
  
  // #PostFetch-Hook

  let result = await this.#utility.response(op, spec, response)

  // #PostOperation-Hook

  return result
}
