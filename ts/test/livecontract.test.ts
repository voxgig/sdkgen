import { test } from 'node:test'
import assert from 'node:assert/strict'
const { synthesizeInput, validateContract, requestContract } = require('../project/.sdk/tm/js/test/live-contract')
const { resolveRecipe } = require('../project/.sdk/tm/js/test/live-scenarios')
test('request generation separates readonly records and validates nested candidates', () => {
  const schema={type:'object',additionalProperties:false,required:['id','count','nested'],properties:{id:{type:'string',readOnly:true},count:{type:'integer',minimum:2},nested:{type:'array',items:{type:'object',required:['choice'],properties:{choice:{type:'string',enum:['a','b']}}}}}}
  assert.deepEqual(synthesizeInput(schema),{count:2,nested:[{choice:'a'}]})
  assert.throws(()=>synthesizeInput(schema,{id:'response-only',count:2,nested:[]}))
  assert.throws(()=>validateContract(schema,{count:'2',nested:[]}))
  assert.throws(()=>synthesizeInput({type:'string'}),/recipe/)
  assert.throws(()=>synthesizeInput({type:'array',minItems:100,items:{type:'integer'}}),/limit/)
  assert.deepEqual(synthesizeInput({type:'object',additionalProperties:false},{}),{})
})
test('schema composition, bounds, nullable and Swagger request candidates', () => {
  validateContract({oneOf:[{type:'integer'},{type:'string',enum:['a']}]},2)
  assert.throws(()=>validateContract({oneOf:[{type:'number'},{type:'integer'}]},2))
  validateContract({type:'string',nullable:true},null)
  assert.throws(()=>validateContract({type:'integer',minimum:2},1))
  assert.throws(()=>validateContract({type:'array',uniqueItems:true},[1,1]))
  assert.throws(()=>validateContract({type:'string',pattern:'^a+$'},'b'))
  assert.throws(()=>validateContract({type:'object',dependentRequired:{a:['b']}},{a:1}),/Unsupported/)
  assert.deepEqual(requestContract({parameters:[{in:'body',schema:{type:'integer'},required:true}]}),{schema:{type:'integer'},required:true,example:undefined})
})
test('recipes bind compatible discovered capabilities without inventing missing values', () => {
  const values=new Map([['models',[{kind:'convert',source:'unavailable'},{kind:'convert',source:'usable'},{kind:'embed',name:'usable'}]]])
  assert.equal(resolveRecipe({from:'models',where:{kind:'convert'},related:{from:'models',local:'source',foreign:'name',where:{kind:'embed'}},path:'source'},values),'usable')
  assert.throws(()=>resolveRecipe({from:'missing'},values),/Missing/)
  assert.throws(()=>resolveRecipe({from:'models',where:{kind:'none'}},values),/compatible/)
})

test('GraphQL HTTP 200 errors fail while independent operations continue', async () => {
  const { runLiveScenarios } = require('../project/.sdk/tm/js/test/live-scenarios')
  const savedFetch=globalThis.fetch
  const calls: string[]=[]
  globalThis.fetch=async (_url: any, init: any) => {
    const query=JSON.parse(init.body).query; calls.push(query)
    return new Response(JSON.stringify(query==='bad' ? {errors:[{message:'SECRET_SENTINEL'}],data:{}} : {data:{ok:true}}),{status:200,headers:{'content-type':'application/json'}})
  }
  class Client {
    options: any
    constructor(options: any){this.options=options}
    Item(){return {load:async(input: any)=>{
      const res=await this.options.system.fetch('http://localhost/graphql',{method:'POST',body:JSON.stringify({query:input.$action})})
      const body=await res.json();return {data:()=>body.data}
    }}}
  }
  try {
    const plan=['bad','good'].map(name=>({entity:'item',accessor:'Item',op:'load',id:name,path:'/graphql',method:'POST',kind:'graphql',graphql:{doc:name},action:name,reachable:true,facts:{live:{id:name,auth:'public',input:{}}}}))
    await assert.rejects(()=>runLiveScenarios(Client,plan,'DEMO'),(error: any)=>{
      assert(!error.message.includes('SECRET_SENTINEL'));assert(error.message.includes('"passed":1'));assert(error.message.includes('"failed":1'));return true
    })
    assert.deepEqual(calls,['bad','good'])
  } finally {globalThis.fetch=savedFetch}
})
