
const Utility = {}


Utility.validateOptions = function(ctx) {
  let options = { ...ctx.options }
  return options
}


Utility.op = function(spec) {
  const op = {
    name: spec.name,
    op: spec.op,
    query: {...spec.query} || {},
    data: {...spec.data} || {},
  }
  return op
}



/*
Utility.endpoint = function(ctx) {
  const { opdef, entity } = ctx
  
  let fullpath = this.#options.endpoint + opdef.path

  for(let queryKey in entity.query) {
    const param = opdef.param[queryKey]
    if(param) { 
      const paramVal = entity.query[param.name]
      fullpath = fullpath.replace(RegExp('{'+paramKey+'}'), paramVal)
    }
  }

  return fullpath
}


Utility.method = function(ctx) {
  const { opdef, entity } = ctx
  const opname = opdef.name
  
  let key = (null == ent || null === ent.id) && 'save' === opname ? 'create' : opname

  const mmap = {
    create: 'POST',
    save: 'PUT',
    load: 'GET',
    list: 'GET',
    remove: 'DELETE',
  }

  return mmap[key]
}


Utility.body = function(ctx) {
  const { entity } = ctx
  const msg = { ...entity.data }  
  return JSON.stringify(msg)
}


Utility.fetchSpec = function(ctx) {
  const { opdef, entity } = ctx

  const url = this.method(ctx)
  const method = this.method(ctx)

  const spec = {
    url: this.endpoint(ctx),
    method,
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer '+this.#options.apikey
    },
    body: 'GET' === method || 'DELETE' === method ? undefined : this.body(op, ctx.entity),
  }
  return spec
}
*/

module.exports = {
  Utility
}
