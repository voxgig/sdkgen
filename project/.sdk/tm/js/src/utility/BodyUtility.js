

function body(ctx) {
  const { op, result, utility } = ctx
  const { struct, error } = utility
  const { isfunc, transform } = struct
  
  let body = undefined

  if('req' === op.kind) {
    try {
      const reqform = op.reqform
      body = isfunc(reqform) ? reqform(ctx) : transform(op, op.reqform)

      if(op.check.nobody && null == body) {
        return error(ctx, new Error('Request body is empty.'))
      }
    }
    catch (err) {
      return error(ctx, err)
    }
  }

  return body
}

module.exports = {
  body
}
