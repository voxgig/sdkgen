

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

  PostConstructEntity(ctx) {
    this.#loghook('PostConstructEntity', ctx)
  }

  SetData(ctx) {
    this.#loghook('SetData', ctx)
  }
  
  GetData(ctx) {
    this.#loghook('GetData', ctx)
  }
  
  GetMatch(ctx) {
    this.#loghook('GetMatch', ctx)
  }


  PreOperation(ctx) {
    this.#loghook('PreOperation', ctx)
  }

  PreSpec(ctx) {
    this.#loghook('PreSpec', ctx)
  }

  PreRequest(ctx) {
    this.#loghook('PreRequest', ctx)
  }

  PreResponse(ctx) {
    this.#loghook('PreResponse', ctx)
  }

  PreResult(ctx) {
    this.#loghook('PreResult', ctx)
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
