
const { Utility } = require('./Utility')


class NameSDK {
  #options
  #features
  #utility = Utility
  
  constructor(options) {
    // #PreConstruct-Hook

    this.features = {
      // #BuildFeature
    }

    // #CustomUtility

    Object.entries( options?.cmp?.utility||{} )
      .map(n=>this.utility[n[0]] = n[1])

    this.#options = this.#utility.validateOptions({self:this, options})

    // #PostConstruct-Hook
  }


  options() {
    return { ...this.#options }
  }

  features() {
    return { ...this.#features }
  }

  utility() {
    return { ...this.#utility }
  }


  // <[SLOT]>
}


module.exports = {
  NameSDK
}
