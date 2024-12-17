

const Pino = require('pino')
const PinoPretty = require('pino-pretty')


class LogFeature {
  version = 'FEATURE_VERSION'
  
  #client // SDK client instance
  #options // SDK client feature options
  #config // Feature config from model
  #logger // Pino-style interface
  
  constructor(client, options, config) {
    // TOOD: make this a default for all features
    options = options || {}
    options.active = false !== options.active

    this.#client = client
    this.#options = options
    this.#config = config

    if(options.active) {
      let logger = options.logger

      if(null ==logger) {
        let pretty = PinoPretty({
          sync: true,
          ignore: 'ctx',
        })

        let name = options.name || 'FEATURE_Name'
        let level = options.level || 'info'
        
        logger = Pino({ name, level }, pretty)
      }
      this.#logger = logger
    }
  }

  options() {
    return { ...this.#options }
  }

  client() {
    return this.#client
  }

  
  PostConstruct(ctx) {
    this.#loghook('PostConstruct', ctx)
  }

  SetData(ctx) {
    this.#loghook('SetData', ctx)
  }
  
  GetData(ctx) {
    this.#loghook('GetData', ctx)
  }
  
  GetQuery(ctx) {
    this.#loghook('GetQuery', ctx)
  }


  PreOperation(ctx) {
    this.#loghook('PreOperation', ctx)
  }

  ModifyOp(ctx) {
    this.#loghook('ModifyOp', ctx)
  }

  PreFetch(ctx) {
    this.#loghook('PreFetch', ctx)
  }

  PostFetch(ctx) {
    this.#loghook('PostFetch', ctx)
  }

  ModifyResult(ctx) {
    this.#loghook('ModifyResult', ctx)
  }
 
  ModifyData(ctx) {
    this.#loghook('ModifyData', ctx)
  }

  ModifyList(ctx) {
    this.#loghook('ModifyList', ctx)
  }

  PostOperation(ctx) {
    this.#loghook('PostOperation', ctx)
  }

  
  #loghook(hook, ctx, level) {
    level = level || 'info'
    if(this.#logger) {
      this.#logger[level]({hook,op:ctx.op,spec:ctx.spec,ctx})
    }
  }
}


module.exports = {
  LogFeature
}
