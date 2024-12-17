
function body(ctx) {
  const { op } = ctx

  let body = 'data' == op.kind ? 
      ('object' === typeof op.data ? JSON.stringify(op.data) : ''+op.data) :
      undefined

  return body
}

module.exports = {
  body
}
