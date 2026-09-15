import type { Context, FeatureOptions } from '../../types'
import type { ProjectNameSDK } from '../../ProjectNameSDK'

import { ENTITYSPEC } from '../../Schema'

import { BaseFeature } from '../base/BaseFeature'


// Payload validation against the model's own field types.
//
// The specs are NOT written here and not written in the model either: every
// entity field already carries a canonical type sentinel (`$STRING`,
// `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
// vocabulary struct.validate speaks. The generator maps them once
// (helpers/canonSpec) and emits `ENTITYSPEC` beside this file, so a field
// whose type changes in the API spec changes what this feature enforces with
// no edit anywhere.
//
// WHAT IS CHECKED
//   outbound (PreSpec)  the payload the caller asked to send, against
//                       `spec.op[<opname>]` — the operation's request shape,
//                       which is the SAME partiality policy that decides what
//                       the generated `<Name>CreateData` type requires.
//   inbound  (PreDone)  each record the operation returned, against
//                       `spec.data` — the entity's own field types.
//
// WHAT IS NOT. The model carries no array element types, no nested object
// schemas, no enums, formats or bounds (see canonSpec's note), so this checks
// the shape the model knows and nothing more. It is a guard against the
// mistakes the model CAN see — a number where a string belongs, a required
// field left out, a misspelled key under `strict` — not a substitute for the
// server's own validation.
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

    // DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
    // `config.options` documents them and types them; it does not inject
    // them, because each feature entry in the spec is optional and struct
    // fills in nothing through an optional union. So every feature resolves
    // its own — and a `mode` left undefined here once meant `'throw' !==
    // undefined`, which silently turned every rejection into a no-op.
    this._request = false !== this._options.request
    this._response = true === this._options.response
    this._mode = this._options.mode || 'throw'

    // `strict` is applied ONCE, here, by rebuilding the spec tree without the
    // `$OPEN` markers — rather than per call, which would clone a spec for
    // every request an SDK ever makes.
    this._spec = true === this._options.strict ? close(ENTITYSPEC) : ENTITYSPEC
  }


  // Outbound. `makeSpec` short-circuits on an `ctx.out.spec` that is already
  // set, so assigning the error here rejects the operation before the request
  // is built — the same seam rbac uses one stage earlier.
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
    if (0 === errs.length || 'throw' !== this._mode) {
      return
    }

    const err = ctx.error('validate_failed',
      'Invalid ' + opname + ' request for entity "' + entname(ctx) + '": ' +
      errs.join('; '))
    ctx.out.spec = err
    return err
  }


  // Inbound. PreDone rather than PreResult: the records are extracted from
  // the response body by `makeResult`, which runs between the two, so at
  // PreResult there is nothing to check but the envelope.
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
      if (null != record && 'object' === typeof record) {
        for (const e of this._check(ctx, record, spec.data, 'response')) {
          errs.push(e)
        }
      }
    }

    if (0 === errs.length || 'throw' !== this._mode) {
      return
    }

    const err = ctx.error('validate_failed',
      'Invalid response for entity "' + entname(ctx) + '": ' + errs.join('; '))

    // BOTH, and `ok` is the load-bearing half: `done` returns `resdata`
    // whenever `result.ok` is true and never looks at `err`, so setting the
    // error alone handed the caller the very records that failed the spec.
    ctx.result.ok = false
    ctx.result.err = err

    return err
  }


  // The payload an operation is about to send.
  //
  // `data` for the ops that carry a body and `match` for the ops that address
  // a record, with `reqdata` (the values passed to THIS call) over the top —
  // which is the order the request builder itself resolves them in.
  _payload(this: any, ctx: any, opname: string): Record<string, any> {
    const body = 'create' === opname || 'update' === opname || 'patch' === opname
    const base = body ? ctx.data : ctx.match
    return { ...(base || {}), ...(ctx.reqdata || {}) }
  }


  _entitySpec(this: any, ctx: any): any {
    return this._spec[entname(ctx)]
  }


  // One validate call. Errors are COLLECTED, never thrown: struct throws on
  // the first failure unless given an `errs` array, and a caller fixing a
  // payload wants every problem with it, not the first one.
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


function entname(ctx: any): string {
  return (ctx.entity && ctx.entity.name) || (ctx.op && ctx.op.entity) || ''
}


// The spec tree with every `$OPEN` marker removed, so an undeclared key is an
// error rather than a pass. Rebuilt rather than mutated: ENTITYSPEC is a
// module constant shared by every client in the process.
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
