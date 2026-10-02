import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fs from 'node:fs'
import Path from 'node:path'
import { transform } from 'sucrase'
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

// A resolved operation is a shared graph. Stringifying it writes a tree, and a
// HubSpot flows POST exceeded the maximum string length V8 allocates, killing
// generation inside the generated test rather than near the cause.
test('embedded live facts are bounded, and keep the request schema', () => {
  const { boundedFacts } = require('../dist/sdkgen.js')

  // One leaf shared from many places at each of several levels: the graph is
  // small, its tree form is not.
  const share = (child: any, width: number) => {
    const node: any = { type: 'object', properties: {} }
    for (let i = 0; i < width; i++) node.properties['p' + i] = child
    return node
  }
  let schema: any = { type: 'string' }
  for (let d = 0; d < 6; d++) schema = share(schema, 6)

  const facts = {
    protocol: 'http',
    operationId: 'createFlow',
    responses: { '200': { content: { 'application/json': { schema } } } },
    requestBody: { required: true, content: { 'application/json': { schema } } },
    parameters: [{ name: 'body', in: 'body', schema }],
  }

  const bounded = boundedFacts(facts)

  // Only what the runner reads survives.
  assert.deepEqual(Object.keys(bounded).sort(), ['parameters', 'protocol', 'requestBody'])
  assert.equal(bounded.protocol, 'http')
  assert.ok(bounded.requestBody.content['application/json'].schema, 'request schema dropped')
  assert.equal(bounded.requestBody.required, true)

  // The bound has to BITE: the tree form is far larger than the graph.
  const full = JSON.stringify(facts).length
  const cut = JSON.stringify(bounded).length
  assert.ok(cut * 10 < full, `bound did not reduce the embed: ${full} -> ${cut}`)

  // And it must terminate on a true cycle, which sharing alone does not cover.
  const cyclic: any = { type: 'object', properties: {} }
  cyclic.properties.self = cyclic
  const bc = boundedFacts({ requestBody: { content: { 'application/json': { schema: cyclic } } } })
  assert.ok(JSON.stringify(bc).length < 4096, 'cyclic schema was not bounded')
})


// The ts twin runs from its own source, with its own runner, so each row pins both.
function tsTemplate(name: string, deps: Record<string, any> = {}): any {
  const file = Path.resolve(__dirname, '../project/.sdk/tm/ts/test', name + '.ts')
  const code = transform(Fs.readFileSync(file, 'utf8'),
    { transforms: ['typescript', 'imports'], filePath: file }).code
  const mod: any = { exports: {} }
  new Function('exports', 'require', 'module', code)(mod.exports, (p: string) => deps[p] ?? require(p), mod)
  return mod.exports
}

const tsRunner = tsTemplate('live-runner')
const TWINS: [string, any, any][] = [
  ['ts', tsTemplate('live-contract', { './live-runner': tsRunner }).synthesizeInput, tsRunner.LiveBlocked],
  ['js', synthesizeInput, require('../project/.sdk/tm/js/test/live-runner').LiveBlocked],
]

// SMSAPI's sender: a string $ref, given a description by an allOf around it, as
// the siblings of a $ref are ignored in OpenAPI 3.0.
const ID = { type: 'string', format: 'oid', pattern: '^[0-9a-f]{24}$', example: '5f0c0c0c0c0c0c0c0c0c0c0c' }
const DESCRIBED_ID = { allOf: [ID, { description: "The sender's id." }] }
const body = (sender: any) => ({ type: 'object', required: ['sender'], properties: { sender } })

for (const [lang, synthesize, LiveBlocked] of TWINS) {
  const blocked = (schema: any) => assert.throws(() => synthesize(schema),
    (error: any) => error instanceof LiveBlocked && /guide recipe/.test(error.message))

  for (const [what, sender, value] of [
    ['an allOf that describes a $ref to a string is that string', DESCRIBED_ID, ID.example],
    ['an allOf that also makes it nullable is that string',
      { allOf: [{ nullable: true }, ID, { description: "The sender's id, if any." }] }, ID.example],
    ['a described scalar with no example of its own is synthesized',
      { allOf: [{ type: 'integer' }, { description: 'The sender number.' }] }, 1],
    ['an allOf whose one value is an annotating example is that example',
      { allOf: [{ description: "The sender's id.", example: ID.example }] }, ID.example],
  ] as [string, any, any][]) {
    test(lang + ': ' + what, () => {
      assert.deepEqual(synthesize(sender), value)
      assert.deepEqual(synthesize(body(sender)), { sender: value })
    })
  }

  test(lang + ': an allOf that only annotates gives nothing, as a bare description does', () => {
    blocked({ description: "The sender's id." })
    blocked({ allOf: [{ description: "The sender's id." }] })
    blocked(body({ allOf: [{ nullable: true }, { title: 'Sender', deprecated: true }] }))
  })

  // The facts bound cuts a deep allOf down to no parts at all.
  test(lang + ': an allOf of no parts gives nothing, as an empty schema does', () => {
    blocked({})
    blocked({ allOf: [] })
  })

  test(lang + ': an allOf of objects still merges them', () => {
    const a = { type: 'object', required: ['a'], properties: { a: { type: 'string', example: 'x' } } }
    const b = { type: 'object', required: ['b'], properties: { b: { type: 'integer' } } }
    assert.deepEqual(synthesize({ allOf: [a, b] }), { a: 'x', b: 1 })
    assert.deepEqual(synthesize({ allOf: [a, b, { description: 'A message.' }] }), { a: 'x', b: 1 })
    // A part that cannot be built leaves the merge blocked, not a contract mismatch.
    blocked({ allOf: [{ type: 'object', required: ['c'], properties: { c: { type: 'string' } } }, b] })
  })

  // definitionPlan's synthesize holds the same rule, which definition.test.ts pins with
  // rows like these. A string type alone gives no value here and an integer type a
  // placeholder; both lose to what another part declares.
  for (const [what, allOf, value] of [
    ['an enum after the type', [{ type: 'string' }, { enum: ['active', 'closed'] }], 'active'],
    ['an enum before the type', [{ enum: ['active', 'closed'] }, { type: 'string' }], 'active'],
    ['an example after the type', [{ type: 'string' }, { example: 'declared-id' }], 'declared-id'],
    ['an example before the type', [{ example: 'declared-id' }, { type: 'string' }], 'declared-id'],
    ['examples after the type', [{ type: 'string' }, { examples: ['listed-id', 'other'] }], 'listed-id'],
    ['examples before the type', [{ examples: ['listed-id', 'other'] }, { type: 'string' }], 'listed-id'],
    ['a default after the type', [{ type: 'string' }, { default: 'fallback' }], 'fallback'],
    ['a default before the type', [{ default: 'fallback' }, { type: 'string' }], 'fallback'],
    ['an example over an enum and a default', [{ default: 'fallback' },
      { type: 'string', enum: ['active', 'closed'] }, { example: 'closed' }], 'closed'],
    ['an example over an enum and a default, reversed', [{ example: 'closed' },
      { type: 'string', enum: ['active', 'closed'] }, { default: 'fallback' }], 'closed'],
    ['an enum over a default', [{ default: 'fallback' }, { type: 'string', enum: ['active'] }], 'active'],
    ['an enum over a default, reversed', [{ type: 'string', enum: ['active'] }, { default: 'fallback' }],
      'active'],
    ['an enum after an integer type', [{ type: 'integer' }, { enum: [3, 5] }], 3],
    ['a default before an integer type', [{ default: 7 }, { type: 'integer' }], 7],
  ] as [string, any[], any][]) {
    test(lang + ': an allOf takes the value a part declares: ' + what, () => {
      assert.deepEqual(synthesize(body({ allOf })), { sender: value })
    })
  }

  // A failed part is dropped only when validating the whole schema still enforces
  // what it asked for. One with a constraint the validator does not check blocks.
  test(lang + ': a part the validator cannot check blocks rather than being dropped', () => {
    const unchecked = (schema: any) => assert.throws(() => synthesize(schema),
      (error: any) => error instanceof LiveBlocked &&
        /Unsupported contract constraint: minProperties/.test(error.message))
    unchecked({ allOf: [{ type: 'object' }, { minProperties: 1 }] })
    unchecked(body({ allOf: [{ type: 'object' }, { minProperties: 1 }] }))
    blocked({ allOf: [{ type: 'object' }, { required: ['a'] }] })
    assert.deepEqual(synthesize({ allOf: [{ type: 'object' }, { required: [] }] }), {})
  })

  // Each candidate is validated against the whole schema, so neither the order of
  // the parts nor a declared value another part rules out decides the result.
  for (const [what, allOf, value] of [
    ['a tighter minimum after a looser one',
      [{ type: 'integer', minimum: 1 }, { type: 'integer', minimum: 3 }], 3],
    ['a tighter minimum before a looser one',
      [{ type: 'integer', minimum: 3 }, { type: 'integer', minimum: 1 }], 3],
    ['a longer minItems after a shorter one', [{ type: 'array', items: { type: 'integer' }, minItems: 1 },
      { type: 'array', items: { type: 'integer' }, minItems: 2 }], [1, 1]],
    ['an example another part rules out', [{ type: 'integer', example: 0 }, { type: 'integer', minimum: 1 }], 1],
    ['the first of several examples another part rules out',
      [{ type: 'string', examples: ['ab', 'abc'] }, { minLength: 3 }], 'abc'],
  ] as [string, any[], any][]) {
    test(lang + ': an allOf takes the first candidate the whole schema accepts: ' + what, () => {
      assert.deepEqual(synthesize({ allOf }), value)
      assert.deepEqual(synthesize(body({ allOf })), { sender: value })
    })
  }
}
