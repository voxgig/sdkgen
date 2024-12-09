
const { empty } = require('./EmptyUtility')

function escre(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escurl(s) {
  return encodeURIComponent(s)
}


function joinurl(...s) {
  return s
    .filter(s=>null!=s&&''!==s)
    .map(s=>s.replace(/^\/+/,'').replace(/\/+$/,''))
    .filter(s=>null!=s&&''!==s)
    .join('/')
}


function fullurl(ctx) {
  const { spec } = ctx

  let url = joinurl(spec.base, spec.prefix, spec.path, spec.suffix)

  for(let key in spec.params) {
    const val = spec.params[key]
    if(null != val) { 
      url = url.replace(RegExp('{'+escre(key)+'}'), escurl(val))
    }
  }

  let qsep = '?'
  for(let key in spec.query) {
    const val = spec.query[key]
    if(null != val) { 
      url += qsep + escurl(key) + '=' + escurl(val)
      qsep = '&'
    }
  }
  
  return url
}


function options(ctx) {
  let config = ctx.config || {}
  let copts = config.options || {}
  
  let options = { ...(ctx.options||{}) }

  options.base = empty(options.base) ?
    empty(copts.base) ? 'http://localhost:8000' :
    copts.base : options.base

  options.prefix = empty(options.prefix) ? '' : options.prefix
  options.suffix = empty(options.suffix) ? '' : options.suffix
  
  return options
}


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


function params(ctx) {
  const { op } = ctx

  const { params, query } = op

  const out = {}
  for(let key of params) {
    let val = query[key]
    if(null!=val) {
      out[key] = val
    }
  }

  return out
}



function query(ctx) {
  const { op } = ctx
  const { params, query } = op

  const out = {}
  for(let key of Object.keys(query)) {
    let val = query[key]
    if(null!=val && !params.includes(key)) {
      out[key] = val
    }
  }

  return out
}


function headers(ctx) {
  const out = {}

  out['content-type'] =  'application/json'
  
  return out
}


function auth(ctx, spec) {
  const { client } = ctx
  const { headers } = spec
  
  let options = client.options()

  headers['authorization'] = 'Bearer '+options.apikey
  
  return spec
}


// Create request specificaton.
function spec(ctx) {
  const {client, op} = ctx
  
  let options = client.options()

  const reqMethod = method(ctx)
  const reqParams = params(ctx)
  const reqQuery = query(ctx)
  const reqHeaders = headers(ctx)

  let spec = {
    base: options.base, // string, URL endpoint base prefix,
    prefix: options.prefix,
    path: op.path,
    suffix: options.suffix,
    method: reqMethod,
    params: reqParams,
    query: reqQuery,
    headers: reqHeaders,
  }

  spec = auth(ctx, spec)
  
  return spec
}


function handleResBasic(response, fetchResponse) {
  response.ok = fetchResponse.ok
  response.status = fetchResponse.status
  response.statusText = fetchResponse.statusText || ''
  return response
}


function handleResHeaders(response, fetchResponse) {
  out = {}
  fetchResponse.headers.forEach((v,k)=>out[k]=v)
  response.headers = out
  return response
}


async function handleResBody(response, fetchResponse) {
  const json = await fetchResponse.json()
  response.body = json
  return response
}


// Make HTTP request.
async function fetch(ctx) {
  const {op, spec} = ctx
  let response = {}
  
  try {
    const url = fullurl(ctx)
    
    const fetchReq = {
      method: spec.method,
      headers: spec.headers,
    }

    if(null != spec.body) {
      fetchReq.body =
        'object' === typeof spec.body ? JSON.stringify(spec.body) : spec.body
    }

    console.log('FR', url, fetchReq)
    
    response = global.fetch(url, fetchReq)
  }
  catch(err) {
    response.err = err
  }
  
  return response
}


async function response(ctx) {
  let { response } = ctx
  
  let result = {
    ok: false,
    status: -1,
    statusText: '',
    headers: {},
    body: undefined,
    err: response.err,
  }

  try {
    result = handleResBasic(result, response)
    
    if(null == result.err) {
      result = handleResHeaders(result, response)
      result = await handleResBody(result, response)
      result.ok = true
    }
  }
  catch(err) {
    result.err = err
  }
  
  return result
}


const Utility = {
  empty,
  joinurl,
  fullurl,
  escre,
  escurl,
  options,
  operator,
  spec,
  method,
  params,
  query,
  headers,
  auth,
  fetch,
  handleResBasic,
  handleResHeaders,
  handleResBody,
  response,
}


module.exports = {
  Utility
}

