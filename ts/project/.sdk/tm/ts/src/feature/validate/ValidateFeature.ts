import type { Context, FeatureOptions } from '../../types'
import type { ProjectNameSDK } from '../../ProjectNameSDK'

import { ENTITYSPEC } from '../../Schema'

import { BaseFeature } from '../base/BaseFeature'


class ValidateFeature extends BaseFeature {
  version = '0.0.1'
  name = 'validate'
  active = true

  _client?: ProjectNameSDK
  _options: any = {}
  _spec: Record<string, any> = {}

  _request = true
  _response = false
  _mode = 'throw'


  init(ctx: Context, options: FeatureOptions): void | Promise<any> {
    this._client = ctx.client
    this._options = options || {}
    this.active = (options as any).active

    this._request = false !== this._options.request
    this._response = true === this._options.response

    // FAIL CLOSED. Only the exact string 'report' selects report mode, so a
    // typo (`mode: 'thow'`) still rejects rather than silently turning
    // enforcement off — the failure nobody would notice. The option spec
    // rejects the typo outright; this is what happens if it ever does not.
    this._mode = 'report' === this._options.mode ? 'report' : 'throw'

    this._spec = true === this._options.strict ? close(ENTITYSPEC) : ENTITYSPEC
  }


  PreSpec(this: any, ctx: any) {
    if (!this.active || !this._request) {
      return
    }

    const opname = (ctx.op && ctx.op.name) || ''
    const spec = this._entitySpec(ctx)
    const opspec = spec && spec.op ? spec.op[opname] : null

    if (null == opspec) {
      return
    }

    const errs = this._check(ctx, this._payload(ctx, opname), opspec, 'request')
    if (0 === errs.length || 'report' === this._mode) {
      return
    }

    const err = ctx.error('validate_failed',
      'Invalid ' + opname + ' request for entity "' + entname(ctx) + '": ' +
      errs.join('; '))
    ctx.out.spec = err
    return err
  }


  PreDone(this: any, ctx: any) {
    if (!this.active || !this._response) {
      return
    }

    const spec = this._entitySpec(ctx)
    if (null == spec || null == spec.data) {
      return
    }

    const resdata = ctx.result && ctx.result.resdata
    if (null == resdata) {
      return
    }

    // A list op returns many records and a load returns one; both are checked
    // against the same record spec, because they are the same entity.
    const records = Array.isArray(resdata) ? resdata : [resdata]
    const errs: string[] = []
    for (const record of records) {
      if (null == record) {
        continue
      }

      for (const e of this._check(ctx, unwrap(record), spec.data, 'response')) {
        errs.push(e)
      }
    }

    if (0 === errs.length || 'report' === this._mode) {
      return
    }

    const err = ctx.error('validate_failed',
      'Invalid response for entity "' + entname(ctx) + '": ' + errs.join('; '))

    ctx.result.ok = false
    ctx.result.err = err

    ctx.result.resdata = undefined

    return err
  }


  _payload(this: any, ctx: any, opname: string): Record<string, any> {
    const body = 'create' === opname || 'update' === opname || 'patch' === opname

    const base = body ? ctx.data : ctx.match
    const req = body ? ctx.reqdata : ctx.reqmatch

    const out: Record<string, any> = { ...(base || {}), ...(req || {}) }

    // `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
    // makePoint reads it off this same argument and the request transformer
    // drops it before the body is built, so a spec built from the API's own
    // fields will never name it — and under `strict` every custom-action
    // call would be rejected for the one key that made it reachable.
    delete out.$action

    return out
  }


  _entitySpec(this: any, ctx: any): any {
    return this._spec[entname(ctx)]
  }


  _check(this: any, ctx: any, data: any, spec: any, direction: string): string[] {
    const struct = ctx.utility.struct
    const errs: string[] = []

    try {
      struct.validate(data, spec, { errs })
    }
    catch (e: any) {
      // A spec this port cannot run at all (rather than a payload that fails
      // it) must not take the operation down with it: report it like any
      // other failure and let `mode` decide.
      errs.push(e && e.message ? e.message : String(e))
    }

    if (0 < errs.length && 'function' === typeof this._options.onInvalid) {
      try {
        this._options.onInvalid({
          entity: entname(ctx),
          op: (ctx.op && ctx.op.name) || '',
          direction,
          errs,
          data,
        })
      }
      catch (_e) { }
    }

    return errs
  }
}


function unwrap(record: any): any {
  if (null != record && 'function' === typeof record.data) {
    const data = record.data()
    if (null != data) {
      return data
    }
  }
  return record
}


function entname(ctx: any): string {
  return (ctx.entity && ctx.entity.name) || (ctx.op && ctx.op.entity) || ''
}


function close(node: any): any {
  if (Array.isArray(node)) {
    return node.map((n: any) => close(n))
  }

  if (null == node || 'object' !== typeof node) {
    return node
  }

  const out: Record<string, any> = {}
  for (const key of Object.keys(node)) {
    if (OPEN === key) {
      continue
    }
    out[key] = close(node[key])
  }

  return out
}


// Built rather than written, so the backticks cannot be lost in an edit.
const OPEN = String.fromCharCode(96) + '$OPEN' + String.fromCharCode(96)


export {
  ValidateFeature
}
