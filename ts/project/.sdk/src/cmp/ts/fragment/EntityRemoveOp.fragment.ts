type Context = any
type Control = any

class EntityOperation {

  #match: any
  #data: any
  #utility: any


  // EJECT-START

  // `EntityName | undefined`, not `EntityName`. A DELETE that answers 204 No
  // Content resolves to nothing — which was the truth all along, while the
  // declared type promised a record and let TypeScript consumers dereference
  // it in good faith. APIs that DO return the removed record on DELETE are
  // covered by the same union.
  async remove(
    this: any, reqmatch?: EntityNameRemoveMatch, ctrl?: Control,
  ): Promise<EntityName | undefined> {

    const utility = this._utility

    const {
      makeContext,
      done,
      error,
      featureHook,
      makePoint,
      makeRequest,
      makeResponse,
      makeResult,
      makeSpec,
    } = utility

    let fres: Promise<any> | undefined = undefined

    let ctx: Context = makeContext({
      opname: 'remove',
      ctrl,
      match: this._match,
      data: this._data,
      reqmatch
    }, this._entctx)

    try {

      // #PrePoint-Hook

      ctx.out.point = makePoint(ctx)
      if (ctx.out.point instanceof Error) {
        return error(ctx, ctx.out.point)
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
          this._match = ctx.result.resmatch
        }

        if (null != ctx.result.resdata) {
          this._data = ctx.result.resdata
        }
      }

      return done(ctx)
    }
    catch (err: any) {
      // #PreUnexpected-Hook

      err = this._unexpected(ctx, err)

      if (err) {
        throw err
      }
      else {
        // Off-happy-path (throw disabled): `undefined` is now within the
        // declared return type, so no cast is needed.
        return undefined
      }
    }
  }

  // EJECT-END


  _unexpected(this: any, ctx: Context, ctrl: any, err: any): any { return err }

}

