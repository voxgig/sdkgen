
function method(ctx) {
  const { op } = ctx
  const opname = op.name
  
  let key = opname

  const mmap = {
    create: 'POST',
    save: 'PUT',
    load: 'GET',
    list: 'GET',
    remove: 'DELETE',
  }

  return mmap[key]
}

module.exports = {
  method
}
