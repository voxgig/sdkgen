
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test({
  apikey: 'APIKEY01',
  utility: {
    auth: ()=> ({util:'AUTH'}),
    body: () => ({util:'BODY'}),
    empty: () => ({util:'EMPTY'}),
    error: () => ({util:'ERROR'}),
    escre: () => ({util:'ESCRE'}),
    escurl: () => ({util:'ESCURL'}),
    fetch: () => ({util:'FETCH'}),
    findparam: () => ({util:'FINDPARAM'}),
    fullurl: () => ({util:'FULLURL'}),
    headers: () => ({util:'HEADERS'}),
    inward: () => ({util:'INWARD'}),
    joinurl: () => ({util:'JOINURL'}),
    method: () => ({util:'METHOD'}),
    operator: () => ({util:'OPERATOR'}),
    options: () => ({util:'OPTIONS'}),
    outward: () => ({util:'OUTWARD'}),
    params: () => ({util:'PARAMS'}),
    query: () => ({util:'QUERY'}),
    resbasic: () => ({util:'RESBASIC'}),
    resbody: () => ({util:'RESBODY'}),
    resheaders: () => ({util:'RESHEADERS'}),
    response: () => ({util:'RESPONSE'}),
    spec: () => ({util:'SPEC'}),

    string: {
      stringify: () => ({util:'STRING-STRINGIFY'}),
    },

    validate: {
      string: () => ({util:'VALIDATE-STRING'}),
      array: () => ({util:'VALIDATE-ARRAY'}),
      object: () => ({util:'VALIDATE-OBJECT'}),
      func: () => ({util:'VALIDATE-FUNC'}),
    }

  }
})


describe('Custom', ()=>{
  test('basic', async ()=>{
    const u = client.utility()

    equal(u.auth().util, 'AUTH')
    equal(u.body().util, 'BODY')
    equal(u.empty().util, 'EMPTY')
    equal(u.error().util, 'ERROR')
    equal(u.escre().util, 'ESCRE')
    equal(u.escurl().util, 'ESCURL')
    equal(u.fetch().util, 'FETCH')
    equal(u.findparam().util, 'FINDPARAM')
    equal(u.fullurl().util, 'FULLURL')
    equal(u.headers().util, 'HEADERS')
    equal(u.inward().util, 'INWARD')
    equal(u.joinurl().util, 'JOINURL')
    equal(u.method().util, 'METHOD')
    equal(u.operator().util, 'OPERATOR')
    equal(u.options().util, 'OPTIONS')
    equal(u.outward().util, 'OUTWARD')
    equal(u.params().util, 'PARAMS')
    equal(u.query().util, 'QUERY')
    equal(u.resbasic().util, 'RESBASIC')
    equal(u.resbody().util, 'RESBODY')
    equal(u.resheaders().util, 'RESHEADERS')
    equal(u.response().util, 'RESPONSE')
    equal(u.spec().util, 'SPEC')

    equal(u.string.stringify().util, 'STRING-STRINGIFY')

    equal(u.validate.string().util, 'VALIDATE-STRING')
    equal(u.validate.array().util, 'VALIDATE-ARRAY')
    equal(u.validate.object().util, 'VALIDATE-OBJECT')
    equal(u.validate.func().util, 'VALIDATE-FUNC')
    
  })
})
