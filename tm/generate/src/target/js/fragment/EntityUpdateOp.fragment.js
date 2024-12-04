
async function update(data) {
  // #PreOperation-Hook    

  let op = await this.#utility.op({name:'Name', op:'update', query: this.#query, data})
  this.#data = op.data
  
  // #CustomOp
  // #ModifyOp-Hook
  
  let spec = await this.#utility.spec(op)
  // #CustomSpec
  // #ModifySpec-Hook

  // #PreFetch-Hook

  let response = await this.#utility.fetch(op, spec)
  
  // #PostFetch-Hook

  let result = await this.#utility.response(op, spec, response)
  // #CustomResult
  // #ModifyResult-Hook
  
  // #PostOperation-Hook

  return result
}
