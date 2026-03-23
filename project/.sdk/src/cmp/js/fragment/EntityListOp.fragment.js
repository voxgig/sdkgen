
class EntityOperation {

  #match
  #data
  #utility


  // EJECT-START

  async list(reqmatch, ctrl) {

    const utility = this.#utility

    const {
      makeContext,
      done,
      error,
      featureHook,
      makeTarget,
      makeRequest,
      makeResponse,
      makeResult,
      makeSpec,
    } = utility

    let fres = undefined

    let ctx = makeContext({
      opname: 'list',
      ctrl,
      match: this.#match,
      data: this.#data,
      reqmatch
    }, this._entctx)

    try {
      // #PreSelection-Hook

      ctx.out.target = makeTarget(ctx)
      if (ctx.out.target instanceof Error) {
        return error(ctx, ctx.out.target)
      }


      // #PreSpec-Hook

      ctx.out.spec = makeSpec(ctx)
      if (ctx.out.spec instanceof Error) {
        return error(ctx, ctx.out.spec)
      }


      // #PreRequest-Hook

      ctx.out.request = await makeRequest(ctx)
      if (ctx.out.request instanceof Error) {
        return error(ctx, ctx.out.request)
      }


      // #PreResponse-Hook

      ctx.out.response = await makeResponse(ctx)
      if (ctx.out.response instanceof Error) {
        return error(ctx, ctx.out.response)
      }


      // #PreResult-Hook

      ctx.out.result = await makeResult(ctx)
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
    catch (err) {
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


  #unexpected(_ctx, err) { return err }

}

