
function featureHook(ctx, name) {
  const client = ctx.client

  let resp = []
  const features = client._features || []

  for (let f of features) {
    const fh = f[name]
    if (null != fh) {
      const fres = fh(ctx)
      if (fres instanceof Promise) {
        resp.push(fres)
      }
    }
  }

  if (0 < resp.length) {
    return Promise.all(resp)
  }
}

module.exports = {
  featureHook
}
