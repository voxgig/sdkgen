
class NameEntity {  
  #client
  #options
  #features
  #utility
  #data
  #match
  
  constructor(client, options) {
    options = options || {}
    options.active = false !== options.active

    this.#client = client
    this.#options = options
    this.#features = client.features()
    this.#utility = client.utility()
    this.#data = {}
    this.#match = {}

    // #PostConstructEntity-Hook
  }

  options() {
    return { ...this.#options }
  }

  client() {
    return this.#client
  }

  make() {
    return new NameEntity(this.#client, this.options())
  }

  
  data(data) {
    // NOTE: data can be mutated.
    if(null != data) {

      // #SetData-Hook
      
      this.#data = { ...data }
    }

    let out = { ...this.#data }

    // #GetData-Hook

    return out
  }

  
  match() {
    // NOTE: match cannot be mutated.
    let out = { ...this.#match }

    // #GetMatch-Hook

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
