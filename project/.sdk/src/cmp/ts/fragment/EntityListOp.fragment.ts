type Context = any
type Operation = any
type Control = any

class EntityOperation {

  #match: any
  #data: any
  #utility: any


  // EJECT-START

  async list(this: any, reqmatch?: any, ctrl?: Control) {

    const utility = this.#utility

    const {
      makeContext,
      makeOperation,
      done,
      error,
      featureHook,
      selection,
      request,
      response,
      result,
      spec,
    } = utility

    let fres: Promise<any> | undefined = undefined

    let op: Operation = makeOperation({
      entity: 'entityname',
      name: 'list',
      select: 'match',
      alts: ['ALTS'],
    })

    let ctx: Context = makeContext({
      current: new WeakMap(),
      ctrl,
      op,
      match: this.#match,
      data: this.#data,
      reqmatch
    }, this._entctx)


    try {
      // #PreSelection-Hook    

      ctx.out.selected = selection(ctx)
      if (ctx.out.selected instanceof Error) {
        return error(ctx, ctx.out.selected)
      }


      // #PreSpec-Hook

      ctx.out.spec = spec(ctx)
      if (ctx.out.spec instanceof Error) {
        return error(ctx, ctx.out.spec)
      }


      // #PreRequest-Hook

      ctx.out.request = await request(ctx)
      if (ctx.out.request instanceof Error) {
        return error(ctx, ctx.out.request)
      }


      // #PreResponse-Hook

      ctx.out.response = await response(ctx)
      if (ctx.out.response instanceof Error) {
        return error(ctx, ctx.out.response)
      }


      // #PreResult-Hook

      ctx.out.result = await result(ctx)
      if (ctx.out.result instanceof Error) {
        return error(ctx, ctx.out.result)
      }


      // #PreDone-Hook

      if (null != ctx.result) {
        if (null != ctx.result.resmatch) {
          this.#match = ctx.result.resmatch
        }
      }

      return done(ctx)
    }
    catch (err: any) {
      // #PreUnexpected-Hook

      err = this.#unexpected(ctx, err)

      if (err) {
        throw err
      }
      else {
        return undefined
      }
    }
  }

  // EJECT-END


  #unexpected(this: any, _ctx: Context, _ctrl: any, err: any): any { return err }

}

