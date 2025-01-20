
function method(ctx) {
  const { op } = ctx
  const opname = op.name
  
  let key = opname

  // TODO: options
  const mmap = {
    create: 'POST',
    update: 'PUT',
    load: 'GET',
    list: 'GET',
    remove: 'DELETE',
  }

  return mmap[key]
}

module.exports = {
  method
}
