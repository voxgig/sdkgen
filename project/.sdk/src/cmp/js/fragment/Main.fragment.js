
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

  test(opts) {
    return new NameSDK({
      // #TestOptions
      ...(opts || this.#options || {})
    })
  }

  
  // <[SLOT]>
}


const SDK = NameSDK

module.exports = {
  NameSDK,
  SDK,
}
