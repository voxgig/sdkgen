
import { inspect } from 'node:util'

import {
  SdkNameSDK,
  SdkNameEntity,
} from '../SdkNameSDK'

import {
  Utility
} from '../utility/Utility'

import type {
  Operation,
  Context,
  Control,
} from '../types'


// TODO: needs Entity superclass
class EntityNameEntity {
  name = 'entityname'

  #client: SdkNameSDK
  #utility: Utility
  #entopts: any
  #data: any
  #match: any

  _entctx: Context

  constructor(client: SdkNameSDK, entopts: any) {
    // super()
    entopts = entopts || {}
    entopts.active = false !== entopts.active

    this.#client = client
    this.#entopts = entopts
    this.#utility = client.utility()
    this.#data = {}
    this.#match = {}

    const makeContext = this.#utility.makeContext

    this._entctx = makeContext({
      entity: this,
      entopts,
    }, client._rootctx)

    const featureHook = this.#utility.featureHook
    featureHook(this._entctx, 'PostConstructEntity')
  }

  entopts() {
    return { ...this.#entopts }
  }

  client() {
    return this.#client
  }

  make() {
    return new EntityNameEntity(this.#client, this.entopts())
  }


  data(this: any, data?: any) {
    const struct = this.#utility.struct
    const featureHook = this.#utility.featureHook

    if (null != data) {
      this.#data = struct.clone(data)
      featureHook(this._entctx, 'SetData')
    }

    featureHook(this._entctx, 'GetData')
    let out = struct.clone(this.#data)

    return out
  }


  match(match?: any) {
    const struct = this.#utility.struct
    const featureHook = this.#utility.featureHook

    if (null != match) {
      this.#match = struct.clone(match)
      featureHook(this._entctx, 'SetMatch')
    }

    featureHook(this._entctx, 'GetMatch')
    let out = struct.clone(this.#match)

    return out
  }


  toJSON() {
    const struct = this.#utility.struct
    return struct.merge([{}, struct.getdef(this.#data, {}), { $entity: 'EntityName' }])
  }

  toString() {
    return 'EntityName ' + this.#utility.struct.jsonify(this.#data)
  }

  [inspect.custom]() {
    return this.toString()
  }


  // #LoadOp

  // #ListOp

  // #CreateOp

  // #UpdateOp

  // #RemoveOp


  #unexpected(this: any, ctx: Context, err: any) {
    const clean = this.#utility.clean
    const struct = this.#utility.struct

    const delprop = struct.delprop
    const clone = struct.clone
    const merge = struct.merge

    const ctrl = ctx.ctrl

    ctrl.err = err

    if (ctrl.explain) {
      ctx.ctrl.explain = clean(ctx, ctx.ctrl.explain)
      delprop(ctx.ctrl.explain.result, 'err')

      if (null != ctx.result && null != ctx.result.err) {
        ctrl.explain.err = clean(ctx, merge([
          clone({ err: ctx.result.err }).err,
          {
            message: ctx.result.err.message,
            stack: ctx.result.err.stack,
          }]))
      }

      const cleanerr = clean(ctx, merge([
        clone({ err }).err,
        {
          message: err.message,
          stack: err.stack,
        }]))

      if (null == ctrl.explain.err) {
        ctrl.explain.err = cleanerr
      }
      else if (ctrl.explain.err.message != cleanerr.message) {
        ctrl.explain.unexpected = cleanerr
      }
    }

    if (false === ctrl.throw) {
      return undefined
    }

    return err
  }

}


export {
  EntityNameEntity
}
