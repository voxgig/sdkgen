
class NameEntity {  
  #client
  #options
  #utility
  #data
  #query
  
  constructor(client, options) {
    options = options || {}
    options.active = false !== options.active

    this.#client = client
    this.#options = options
    this.#utility = client.utility()
    this.#data = {}
    this.#query = {}
  }

  options() {
    return { ...this.#options }
  }

  client() {
    return this.#client
  }

  data(data) {
    if(null != data) {
      // #ModifyData-Hook
      this.#data = { ...data }
    }
    return { ...this.#data }
  }

  query() {
    return { ...this.#query }
  }


  // #LoadOp

  // #ListOp

  // #CreateOp

  // #UpdateOp

  // #RemoveOp

}


module.exports = {
  NameEntity
}
