
class LoggerFeature {
  #client // SDK client instance
  #options // SDK client feature options
  #config // Feature config from model
  
  constructor(client, options, config) {
    // TOOD: make this a default for all features
    options = options || {}
    options.active = false !== options.active

    this.#client = client
    this.#options = options
    this.#config = config
  }

  options() {
    return { ...this.#options }
  }

  client() {
    return this.#client
  }

  PostConstruct(ctx) {
    print('PostConstruct', this.#options)
  }

  PreFetch(ctx) {
    print('PreFetch', this.#options)
  }

  PostFetch(ctx) {
    print('PostFetch', this.#options)
  }

}



function print(hook,options) {
  if(options.active) {
    console.log('LOGGER', hook)
  }
}



module.exports = {
  LoggerFeature
}
