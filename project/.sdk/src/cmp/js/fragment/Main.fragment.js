
const { Config } = require('./Config')
const { Utility } = require('./utility/Utility')


class NameSDK {
  #options
  #features
  #utility = Utility
  
  constructor(options) {

    this.#options = this.#utility.makeOptions({
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

  
  async prepare(fetchargs) {
    const utility = this.#utility
    const { headers, auth, fullurl } = utility

    fetchargs = fetchargs || {}

    const options = this.options()

    const spec = {
      base: options.base,
      prefix: options.prefix,
      suffix: options.suffix,
      path: fetchargs.path || '',
      method: fetchargs.method || 'GET',
      params: fetchargs.params || {},
      query: fetchargs.query || {},
      headers: headers({ client: this, utility }),
      body: fetchargs.body,
      step: 'start',
      alias: {},
    }

    // Merge user-provided headers over SDK defaults.
    if (fetchargs.headers) {
      const uheaders = fetchargs.headers
      for (let key in uheaders) {
        spec.headers[key] = uheaders[key]
      }
    }

    // Apply SDK auth.
    const ctx = { client: this, op: { params: [] }, spec, utility }
    auth(ctx)

    // Build URL.
    const url = fullurl(ctx)

    const fetchdef = {
      url,
      method: spec.method,
      headers: { ...spec.headers },
    }

    if (null != spec.body) {
      fetchdef.body =
        'object' === typeof spec.body ? JSON.stringify(spec.body) : spec.body
    }

    return fetchdef
  }


  async direct(fetchargs) {
    const fetchdef = await this.prepare(fetchargs)
    if (fetchdef instanceof Error) {
      return fetchdef
    }

    const options = this.options()
    const fetch = options.system.fetch

    try {
      const response = await fetch(fetchdef.url, fetchdef)

      if (null == response) {
        return { ok: false, err: new Error('response: undefined') }
      }

      const status = response.status
      const json = 'function' === typeof response.json ? await response.json() : response.json

      return {
        ok: status >= 200 && status < 300,
        status,
        headers: response.headers,
        data: json,
      }
    }
    catch (err) {
      return { ok: false, err }
    }
  }


  // <[SLOT]>
}


const SDK = NameSDK

module.exports = {
  NameSDK,
  SDK,
}
