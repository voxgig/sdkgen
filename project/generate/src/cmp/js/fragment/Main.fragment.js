
const { Config } = require('./Config')
const { Utility } = require('./utility/Utility')


class NameSDK {
  #options
  #features
  #utility = Utility
  
  constructor(options) {

    this.#options = this.#utility.options({
      client: this,
      utility: this.#utility,
      config: Config,
      options,
    })

    const customUtils = this.#options.utility || {}
    for(let key of Object.keys(customUtils)) {
      this.#utility[key] = customUtils[key]
    }
    
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
