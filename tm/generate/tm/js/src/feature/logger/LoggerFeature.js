
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
    print('PreOperation', ctx, this.#options)
  }

  ModifyOp(ctx) {
    print('ModifyOp', ctx, this.#options)
  }

  PreFetch(ctx) {
    print('PreFetch', ctx, this.#options)
  }

  PostFetch(ctx) {
    print('PostFetch', ctx, this.#options)
  }

  PostOperation(ctx) {
    print('PostOperation', ctx, this.#options)
  }
}



function print(hook,ctx,options) {
  if(options.active) {
    console.log('LOGGER', hook, ctx)
  }
}



module.exports = {
  LoggerFeature
}
