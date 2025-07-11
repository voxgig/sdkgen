
import {
  SdkNameSDK,
  SdkNameEntity,
} from '../SdkNameSDK'


import type {
  Operation,
  Context,
  Control,
} from '../types'


class EntityNameEntity {
  #client: SdkNameSDK
  #entopts: any
  #utility: any
  #data: any
  #match: any

  constructor(client: SdkNameSDK, entopts: any) {
    // super()
    entopts = entopts || {}
    entopts.active = false !== entopts.active

    this.#client = client
    this.#entopts = entopts
    this.#utility = client.utility()
    this.#data = {}
    this.#match = {}

    const contextify = this.#utility.contextify
    const ctx = contextify({ client, entity: this })

    const featurehook = this.#utility.featurehook
    featurehook(ctx, 'PostConstructEntity')
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
    const featurehook = this.#utility.featurehook
    const contextify = this.#utility.contextify

    const ctx = contextify({ entity: this })

    if (null != data) {
      featurehook(ctx, 'SetData')
      this.#data = { ...data }
    }

    let out = { ...this.#data }

    featurehook(ctx, 'GetData')
    return out
  }


  match(match?: any) {
    const featurehook = this.#utility.featurehook
    const contextify = this.#utility.contextify

    const ctx = contextify({ entity: this })

    if (null != match) {
      featurehook(ctx, 'SetMatch')
      this.#match = { ...match }
    }

    let out = { ...this.#match }

    featurehook(ctx, 'GetMatch')
    return out
  }


  // #LoadOp

  // #ListOp

  // #CreateOp

  // #UpdateOp

  // #RemoveOp


  #unexpected(this: any, ctx: Context, err: any) {
    const ctrl = ctx.ctrl

    ctrl.err = err

    if (ctrl.explain) {
      const { clean, struct } = this.#utility
      const { delprop, clone } = struct

      ctx.ctrl.explain = clean(ctx, ctx.ctrl.explain)
      delprop(ctx.ctrl.explain.result, 'err')

      if (null != ctx.result && null != ctx.result.err) {
        ctrl.explain.err = clean(ctx, {
          ...clone({ err: ctx.result.err }).err,
          message: ctx.result.err.message,
          stack: ctx.result.err.stack,
        })
      }

      const cleanerr = clean(ctx, {
        ...clone({ err }).err,
        message: err.message,
        stack: err.stack,
      })

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
