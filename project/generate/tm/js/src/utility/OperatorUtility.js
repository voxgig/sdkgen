
// Ensure standard operation definition.
function operator(ctx) {
  const { op } = ctx
  
  let out = {
    name: op.name,
    entity: op.entity,
    path: op.path,
    params: op.params || [],
    query: {...op.query} || {},
    data: {...op.data} || {},
    state: op.state,
    extract: op.extract,
  }

  return out
}


module.exports = {
  operator
}
