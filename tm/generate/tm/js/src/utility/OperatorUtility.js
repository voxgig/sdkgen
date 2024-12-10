
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
  }

  return out
}


module.exports = {
  operator
}
