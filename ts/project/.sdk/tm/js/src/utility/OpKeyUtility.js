
// The custom action a call names: `$action` in its own request argument,
// never in a response.
function opAction(ctx) {
  const op = ctx?.op || {}
  const req = 'data' === op.input ? ctx.reqdata : ctx.reqmatch
  const action = null == req ? undefined : req.$action
  return 'string' === typeof action && '' !== action ? action : undefined
}


// The keys an operation is looked up and filed by, most specific first:
// `<entity>.<op>:<action>`, `<entity>.<op>`, `<op>`, `*`.
function opKeys(ctx) {
  const op = ctx?.op || {}
  const name = op.name || '_'
  const base = (op.entity || ctx?.entity?.name || '_') + '.' + name
  const action = opAction(ctx)
  return null == action ? [base, name, '*'] : [base + ':' + action, base, name, '*']
}


module.exports = {
  opAction,
  opKeys,
}
