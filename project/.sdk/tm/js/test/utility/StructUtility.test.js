
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test, describe } = require('node:test')
const { equal, deepEqual, fail } = require('node:assert')


const {
  clone,
  escre,
  escurl,
  getpath,
  getprop,
  inject,
  isempty,
  iskey,
  islist,
  ismap,
  isnode,
  items,
  haskey,
  keysof,
  merge,
  setprop,
  stringify,
  transform,
  walk,
  validate,
  joinurl,
} = require('../../src/utility/StructUtility')


const { runner } = require('../runner')


function walkpath(_key, val, _parent, path) {
  return 'string' === typeof val ? val + '~' + path.join('.') : val
}


function nullModifier(
  key,
  val,
  parent
) {
  if ("__NULL__" === val) {
    setprop(parent, key, null)
  }
  else if ('string' === typeof val) {
    setprop(parent, key, val.replaceAll('__NULL__', 'null'))
  }
}


describe('struct', async () => {

  const { spec, runset, subject } = await runner('struct')

  
  // minor tests
  // ===========

  test('minor-exists', () => {
    equal('function', typeof clone)
    equal('function', typeof escre)
    equal('function', typeof escurl)
    equal('function', typeof getprop)
    equal('function', typeof isempty)
    equal('function', typeof iskey)
    equal('function', typeof islist)
    equal('function', typeof ismap)
    equal('function', typeof isnode)
    equal('function', typeof items)
    equal('function', typeof setprop)
    equal('function', typeof stringify)
    equal('function', typeof haskey)
    equal('function', typeof keysof)
    equal('function', typeof joinurl)
  })

  test('minor-clone', async () => {
    await runset(spec.minor.clone, clone)
  })

  test('minor-isnode', async () => {
    await runset(spec.minor.isnode, isnode)
  })

  test('minor-ismap', async () => {
    await runset(spec.minor.ismap, ismap)
  })

  test('minor-islist', async () => {
    await runset(spec.minor.islist, islist)
  })

  test('minor-iskey', async () => {
    await runset(spec.minor.iskey, iskey)
  })

  test('minor-isempty', async () => {
    await runset(spec.minor.isempty, isempty)
  })

  test('minor-escre', async () => {
    await runset(spec.minor.escre, escre)
  })

  test('minor-escurl', async () => {
    await runset(spec.minor.escurl, escurl)
  })

  test('minor-stringify', async () => {
    await runset(spec.minor.stringify, (vin) =>
      null == vin.max ? stringify(vin.val) : stringify(vin.val, vin.max))
  })

  test('minor-items', async () => {
    await runset(spec.minor.items, items)
  })

  test('minor-getprop', async () => {
    await runset(spec.minor.getprop, (vin) =>
      null == vin.alt ? getprop(vin.val, vin.key) : getprop(vin.val, vin.key, vin.alt))
  })

  test('minor-setprop', async () => {
    await runset(spec.minor.setprop, (vin) =>
      setprop(vin.parent, vin.key, vin.val))
  })

  test('minor-haskey', async () => {
    await runset(spec.minor.haskey, haskey)
  })

  test('minor-keysof', async () => {
    await runset(spec.minor.keysof, keysof)
  })

  test('minor-joinurl', async () => {
    await runset(spec.minor.joinurl, joinurl)
  })


  // walk tests
  // ==========

  test('walk-exists', async () => {
    equal('function', typeof merge)
  })

  test('walk-basic', async () => {
    await runset(spec.walk.basic, (vin) => walk(vin, walkpath))
  })


  // merge tests
  // ===========

  test('merge-exists', async () => {
    equal('function', typeof merge)
  })

  test('merge-basic', async () => {
    const test = clone(spec.merge.basic)
    deepEqual(merge(test.in), test.out)
  })

  test('merge-cases', async () => {
    await runset(spec.merge.cases, merge)
  })

  test('merge-array', async () => {
    await runset(spec.merge.array, merge)
  })

  test('merge-special', async () => {
    const f0 = ()=>null
    deepEqual(merge([f0]), f0)
    deepEqual(merge([null,f0]), f0)
    deepEqual(merge([{a:f0}]), {a:f0})
    deepEqual(merge([{a:{b:f0}}]), {a:{b:f0}})

    deepEqual(merge([{a:global.fetch}]), {a:global.fetch})
    deepEqual(merge([{a:{b:global.fetch}}]), {a:{b:global.fetch}})
  })
  

  // getpath tests
  // =============

  test('getpath-exists', async () => {
    equal('function', typeof getpath)
  })

  test('getpath-basic', async () => {
    await runset(spec.getpath.basic, (vin) => getpath(vin.path, vin.store))
  })

  test('getpath-current', async () => {
    await runset(spec.getpath.current, (vin) =>
      getpath(vin.path, vin.store, vin.current))
  })

  test('getpath-state', async () => {
    const state = {
      handler: (state, val, _current, _store) => {
        let out = state.step + ':' + val
        state.step++
        return out
      },
      step: 0,
      mode: 'val',
      full: false,
      keyI: 0,
      keys: ['$TOP'],
      key: '$TOP',
      val: '',
      parent: {},
      path: ['$TOP'],
      nodes: [{}],
      base: '$TOP'
    }
    await runset(spec.getpath.state, (vin) =>
      getpath(vin.path, vin.store, vin.current, state))
  })


  // inject tests
  // ============

  test('inject-exists', async () => {
    equal('function', typeof inject)
  })

  test('inject-basic', async () => {
    const test = clone(spec.inject.basic)
    deepEqual(inject(test.in.val, test.in.store), test.out)
  })

  test('inject-string', async () => {
    await runset(spec.inject.string, (vin) =>
      inject(vin.val, vin.store, nullModifier, vin.current))
  })

  test('inject-deep', async () => {
    await runset(spec.inject.deep, (vin) => inject(vin.val, vin.store))
  })


  // transform tests
  // ===============

  test('transform-exists', async () => {
    equal('function', typeof transform)
  })

  test('transform-basic', async () => {
    const test = clone(spec.transform.basic)
    deepEqual(transform(test.in.data, test.in.spec, test.in.store), test.out)
  })

  test('transform-paths', async () => {
    await runset(spec.transform.paths, (vin) =>
      transform(vin.data, vin.spec, vin.store))
  })

  test('transform-cmds', async () => {
    await runset(spec.transform.cmds, (vin) =>
      transform(vin.data, vin.spec, vin.store))
  })

  test('transform-each', async () => {
    await runset(spec.transform.each, (vin) =>
      transform(vin.data, vin.spec, vin.store))
  })

  test('transform-pack', async () => {
    await runset(spec.transform.pack, (vin) =>
      transform(vin.data, vin.spec, vin.store))
  })


  test('transform-modify', async () => {
    await runset(spec.transform.modify, (vin) =>
      transform(vin.data, vin.spec, vin.store,
        (key, val, parent) => {
          if (null != key && null != parent && 'string' === typeof val) {
            val = parent[key] = '@' + val
          }
        }
      ))
  })

  test('transform-extra', async () => {
    deepEqual(transform(
      { a: 1 },
      { x: '`a`', b: '`$COPY`', c: '`$UPPER`' },
      {
        b: 2, $UPPER: (state) => {
          const { path } = state
          return ('' + getprop(path, path.length - 1)).toUpperCase()
        }
      }
    ), {
      x: 1,
      b: 2,
      c: 'C'
    })
  })


  test('transform-funcval', async () => {
    const f0 = ()=>99
    deepEqual(transform({},{x:1}), {x:1})
    deepEqual(transform({},{x:f0}), {x:f0})
    deepEqual(transform({a:1},{x:'`a`'}), {x:1})
    deepEqual(transform({f0},{x:'`f0`'}), {x:f0})
  })

  
  // validate tests
  // ===============

  test('validate-exists', async () => {
    equal('function', typeof validate)
  })

  
  test('validate-basic', async () => {
    await runset(spec.validate.basic, (vin)=>validate(vin.data,vin.spec))
  })


  test('validate-node', async () => {
    await runset(spec.validate.node, (vin)=>validate(vin.data,vin.spec))
  })


  test('validate-custom', async () => {
    const errs = []
    const extra = {
      $INTEGER: (state, val, current)=>{
        const { mode, key, parent } = state
        let out = getprop(current, key)

        let t = typeof out
        if('number' !== t && !Number.isInteger(out)) {
          state.errs.push('Not an integer at '+state.path.slice(1).join('.')+': '+out)
          return
        }

        return out
      },
    }

    validate({a:1},{a:'`$INTEGER`'},extra,errs)
    equal(errs.length, 0)

    validate({a:'A'},{a:'`$INTEGER`'},extra,errs)
    deepEqual(errs, [ 'Not an integer at a: A' ])
  })


})


