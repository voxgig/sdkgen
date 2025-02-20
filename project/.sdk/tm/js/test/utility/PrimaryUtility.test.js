
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { runner } = require('../runner')


describe('PrimaryUtility', async ()=>{

  async function MockFetch(url, fetchdef) {
    return {
      status: 200,
    }
  }

  const runners = {
    auth: await runner('auth'),
    body: await runner('body'),
    error: await runner('error'),
    findparam: await runner('findparam'),
    fullurl: await runner('fullurl'),
    headers: await runner('headers'),
    method: await runner('method'),
    operator: await runner('operator'),
    options: await runner('options'),
    params: await runner('params'),
    query: await runner('query'),
    reqform: await runner('reqform'),
    request: await runner('request', { fetch: MockFetch }),
    resbasic: await runner('resbasic'),
    resbody: await runner('resbody'),
    resform: await runner('resform'),
    resheaders: await runner('resheaders'),
    response: await runner('response'),
    spec: await runner('spec'),
  }
  
  
  test('exists', async ()=>{
    equal('function', typeof runners.auth.subject)
    equal('function', typeof runners.body.subject)
    equal('function', typeof runners.error.subject)
    equal('function', typeof runners.findparam.subject)
    equal('function', typeof runners.fullurl.subject)
    equal('function', typeof runners.method.subject)
    equal('function', typeof runners.operator.subject)
    equal('function', typeof runners.options.subject)
    equal('function', typeof runners.params.subject)
    equal('function', typeof runners.query.subject)
    equal('function', typeof runners.reqform.subject)
    equal('function', typeof runners.request.subject)
    equal('function', typeof runners.resbasic.subject)
    equal('function', typeof runners.resbody.subject)
    equal('function', typeof runners.resform.subject)
    equal('function', typeof runners.resheaders.subject)
    equal('function', typeof runners.response.subject)
    equal('function', typeof runners.spec.subject)
  })


  test('auth-basic', async () => {
    const { runset, spec, subject } = runners.auth
    await runset(spec.basic, undefined, (subject)=>(vin)=>{
      return subject(vin, vin.spec)
    })
  })


  test('body-basic', async () => {
    const { runset, spec, subject } = runners.body
    await runset(spec.basic, subject)
  })


  test('error-basic', async () => {
    const { runset, spec, subject } = runners.error
    await runset(spec.basic, subject)
  })


  test('findparam-basic', async () => {
    const { runset, spec, subject } = runners.findparam
    await runset(spec.basic, subject)
  })


  test('fullurl-basic', async () => {
    const { runset, spec, subject } = runners.fullurl
    await runset(spec.basic, subject)
  })


  test('headers-basic', async () => {
    const { runset, spec, subject } = runners.headers
    await runset(spec.basic, subject)
  })


  test('method-basic', async () => {
    const { runset, spec, subject } = runners.method
    await runset(spec.basic, subject)
  })


  test('operator-basic', async () => {
    const { runset, spec, subject } = runners.operator
    await runset(spec.basic, subject)
  })
  

  test('options-basic', async () => {
    const { runset, spec, subject } = runners.options
    await runset(spec.basic, subject)
  })
  

  test('params-basic', async () => {
    const { runset, spec, subject } = runners.params
    await runset(spec.basic, subject)
  })


  test('query-basic', async () => {
    const { runset, spec, subject } = runners.query
    await runset(spec.basic, subject)
  })


  test('reqform-basic', async () => {
    const { runset, spec, subject } = runners.reqform
    await runset(spec.basic, subject)
  })


  test('request-basic', async () => {
    const { runset, spec, subject } = runners.request
    await runset(spec.basic, subject)
  })


  test('resbasic-basic', async () => {
    const { runset, spec, subject } = runners.resbasic
    await runset(spec.basic, subject)
  })

  
  test('resbody-basic', async () => {
    const { runset, spec, subject } = runners.resbody
    await runset(spec.basic, (ctx, result)=>{
      let resdata = ctx.utility.struct.clone(ctx.response)
      ctx.response.json = async ()=>resdata
      return subject(ctx, result)
    })
  })


  test('resform-basic', async () => {
    const { runset, spec, subject } = runners.resform
    await runset(spec.basic, subject)
  })


  test('resheaders-basic', async () => {
    const { runset, spec, subject } = runners.resheaders
    await runset(spec.basic, (ctx, result)=>{
      ctx.response.headers.forEach = function (callback) {
        Object.keys(this).forEach((key) => {
          callback(this[key], key, this)
        })
      }
      return subject(ctx, result)
    })
  })

  
  test('response-basic', async () => {
    const { runset, spec, subject } = runners.response
    await runset(spec.basic, subject)
  })


  test('spec-basic', async () => {
    const { runset, spec, subject } = runners.spec
    await runset(spec.basic, subject)
  })
  
})
