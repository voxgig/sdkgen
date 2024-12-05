
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
    print('PostConstruct', ctx, this.#options)
  }

  PreOperation(ctx) {
    print('PreOperation', ctx)
  }

  ModifyOp(ctx) {
    print('ModifyOp', ctx)
  }

  PreFetch(ctx) {
    print('PreFetch', ctx)
  }

  PostFetch(ctx) {
    print('PostFetch', ctx)
  }

  PostOperation(ctx) {
    print('PostOperation', ctx)
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
