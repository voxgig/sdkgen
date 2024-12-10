
const { Config } = require('./Config')
const { Utility } = require('./utility/Utility')


class NameSDK {
  #options
  #features
  #utility = Utility
  
  constructor(options) {

    // # CustomUtility

    this.#options = this.#utility.options({self:this, options, config:Config})

    this.#features = {
      // #BuildFeature
    }

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
