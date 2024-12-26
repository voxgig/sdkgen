
const { Config } = require('./Config')
const { Utility } = require('./utility/Utility')


class NameSDK {
  #options
  #features
  #utility = Utility
  
  constructor(options) {

    // # CustomUtility

    this.#options = this.#utility.options({
      self:this,
      utility: this.#utility,
      options,
      config:Config
    })

    // #FeatureOptions
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


  static test(opts) {
    return new NameSDK({
      // #TestOptions
      ...(opts || {})
    })
  }

  // <[SLOT]>
}


module.exports = {
  NameSDK
}
