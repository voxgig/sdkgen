
import { Context } from '../types'
import { OPTSPEC } from '../Schema'

import { clean, cleanAdd, cleanKey, makeCleanConfig, splitvalues } from './CleanUtility'


function makeOptions(ctx: Context) {
  const utility = ctx.utility
  const options = ctx.options
  const struct = utility.struct
  const items = struct.items
  const setprop = struct.setprop
  const merge = struct.merge
  const validate = struct.validate
  const walk = struct.walk

  let opts = { ...(options || {}) }

  const authSuppressed = null === (options || {}).auth

  // The secret registry exists BEFORE validation, fed from the raw input, so
  // the constructor's own rejection of a mistyped credential is clean too.
  const cleancfg = makeCleanConfig(merge([{}, (OPTSPEC as any).clean, opts.clean]))
  const cleanctx: any = { options: { __derived__: { clean: cleancfg } } }
  for (const raw of [opts.apikey, opts.secret].concat(splitvalues(opts.clean?.values))) {
    cleanAdd(cleanctx, raw)
  }

  let featureorder: string[] = []
  if (Array.isArray(opts.feature)) {
    const fmap: any = {}
    for (const entry of opts.feature) {
      if (null != entry && null != entry.name) {
        const { name, ...fopts } = entry
        fmap[name] = fopts
        featureorder.push(name)
      }
    }
    opts = { ...opts, feature: fmap }
  }

  const customUtils = opts.utility || {}
  for (let [key, val] of items(customUtils)) {
    setprop(utility, key, val)
  }

  let config = ctx.config || {}
  let cfgopts = config.options || {}

  const optspec = OPTSPEC

  // Clone the config side before merging: `config` is a module-level
  // singleton in ts/js, and merge would otherwise use its nested maps as
  // merge TARGETS — one instance's options (server, headers, ...) would
  // contaminate every instance constructed after it.
  opts = merge([{}, struct.clone(cfgopts), opts])

  try {
    opts = validate(opts, optspec)
  }
  catch (err: any) {
    throw clean(cleanctx, err)
  }

  opts.system = opts.system || {}
  if (null == opts.system.fetch) {
    opts.system.fetch = global.fetch
  }

  // Restore the suppression the optspec default would otherwise erase.
  if (authSuppressed) {
    opts.auth = null
  }

  if ('string' === typeof opts.base && opts.base.includes('{')) {
    const testmode = true === opts.test.active ||
      true === (opts.feature && opts.feature.test && opts.feature.test.active)
    const server = opts.server || {}
    opts.base = opts.base.replace(/\{([A-Za-z0-9_]+)\}/g,
      (_m: string, name: string) => {
        let val = server[name]
        val = 'string' === typeof val ? val : ''
        if ('' === val) {
          if (testmode) {
            return 'test-' + name
          }
          throw new Error(
            `${config?.main?.name || 'SDK'}: the server variable '${name}' is required: ` +
            `the API base URL is '${opts.base}' — pass { server: { ${name}: '...' } } ` +
            `in the SDK options`)
        }
        return val
      })
  }

  // Resolve the feature add-order: an explicit array order (above) wins;
  // otherwise order the map test-first, then the remaining names sorted, so
  // the outcome is deterministic and `test` is always the base transport.
  if (0 === featureorder.length) {
    let names = Object.keys(opts.feature || {}).sort()
    names = names.indexOf('test') < 0
      ? names
      : ['test'].concat(names.filter((n: string) => 'test' !== n))
    const si = names.indexOf('station')
    if (0 <= si) {
      names.splice(si, 1)
      names.splice(names.indexOf('test') + 1, 0, 'station')
    }
    featureorder = names
  }

  opts.__derived__ = {
    clean: cleancfg,
    featureorder,
  }

  // Every string under a sensitive name anywhere in the options - a custom
  // auth header, a feature credential - is a secret the SDK now handles.
  const optctx: any = { options: opts }
  walk(struct.clone({ ...opts, __derived__: undefined }), (key: any, val: any) => {
    if ('string' === typeof val && cleanKey(optctx, key)) {
      cleanAdd(optctx, val)
    }
    return val
  })

  return opts
}


export {
  makeOptions
}
