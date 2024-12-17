
class NameEntity {  
  #client
  #options
  #features
  #utility
  #data
  #query
  
  constructor(client, options) {
    options = options || {}
    options.active = false !== options.active

    this.#client = client
    this.#options = options
    this.#features = client.features()
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
    // NOTE: query cannot be mutated.
    if(null != data) {

      // #SetData-Hook
      
      this.#data = { ...data }
    }

    let out = { ...this.#data }

    // #GetData-Hook

    return out
  }

  query() {
    // NOTE: query cannot be mutated.
    let out = { ...this.#query }

    // #GetQuery-Hook

    return out
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
