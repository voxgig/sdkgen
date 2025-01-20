

// Transform data using spec.
// Only operates on static JSONifiable data.
// Array are treated as if they are objects with indices as keys.
function transform(
  data, // Source data to transform into new data (original not mutated)
  spec, // Transform specification; output follows this shape
  extra, // Additional store of data
  modify // Optionally modify individual values.
) {
  const dataClone = merge([clone(extra || {}), clone(data || {})])

  // Define a top level store that provides transform operations.
  const fullstore = {

    // Source data.
    $DATA: dataClone,

    // Escape backtick,
    $BT: '`',

    // Insert current date and time as an ISO string.
    $WHEN: () => new Date().toISOString(),

    // Delete a key-value pair.
    $DELETE: ((_mode, key, _val, parent) => {
      if (null != key) {
        delete parent[key]
      }
      return undefined
    }),


    // Merge a list of objects into the current object. 
    // Must be a key in an object. The value is merged over the current object.
    // If the value is an array, the elements are first merged using `merge`. 
    // If the value is the empty string, merge the top level store.
    $MERGE: ((mode, key, val, parent) => {
      if ('key:pre' === mode) { return key }

      // Operate after child values have been transformed.
      if ('key:post' === mode) {

        // Remove self from parent.
        if (null != key) {
          delete parent[key]
        }

        if ('' === val) {
          val = dataClone
        }

        merge([parent, ...(Array.isArray(val) ? val : [val])])

        return key
      }

      return undefined
    }),

    $COPY: ((mode, key, val, parent, path, nodes, current, store) => {
      if (mode.startsWith('key')) { return key }
      // console.log('COPY', key, current == store ? 'STORE' : current)
      return null != current && null != key ? current[key] : undefined
    }),


    $EACH: ((mode, _key, _val, parent, path, nodes, _current, store, keyI, keys, _mpath, modify) => {
      // Remove arguments to avoid spurious processing.
      if (keys) {
        keys.length = 1
      }

      // Defensive context checks.
      if ('val' !== mode || null == path || null == nodes) {
        return undefined
      }

      // console.log('EACH', keys, parent)

      // EACH Arguments: [EACH, sercpath, child]
      const srcpath = parent[1] // Path to source data
      const child = clone(parent[2]) // Child spec

      const src = null != store ?
        null != store.$DATA ? getpath(srcpath, store.$DATA) :
          getpath(srcpath, store) :
        undefined

      // console.log('SRC', src, 'PATH', path.join('.'))
      // console.log('NODES', nodes)

      let tcurrent = []
      let tval = []

      const tkey = path[path.length - 2]
      const pkey = path[path.length - 3]
      const target = nodes[path.length - 2] || nodes[path.length - 1]

      if ('object' === typeof src) {
        // if (null != path && null != nodes) {

        // console.log('TARGET', pkey, tkey, target)

        // if ('object' === typeof src) {

        if (Array.isArray(src)) {
          tval = src.map(() => clone(child))
        }
        else {
          tval = Object.entries(src).map(n => ({
            ...clone(child),
            '`$META`': { KEY: n[0] }
          }))
        }

        tcurrent = Object.values(src)
      }

      // console.log('TVAL', tval, tcurrent)

      if (null != tkey) {
        tcurrent = { [tkey]: tcurrent }
        target[tkey] = tval
      }

      if (null != pkey) {
        tcurrent = { [pkey]: tcurrent }
      }

      // console.log('EACH inject before',
      // keyI,
      //   keys,
      //   pkey,
      //   tkey,
      //   tval,
      //   path.slice(0, path.length - 1).join('.'),
      //   // nodes[path.length - 3],
      //   tcurrent)

      // console.log('TCUR', tcurrent)

      tval = inject(
        tval,
        store,
        modify,
        -1, // keyI,
        undefined, // keys,
        tkey,
        nodes[path.length - 3],
        path.slice(0, path.length - 1),
        nodes.slice(0, path.length - 1),
        tcurrent,
      )

      // console.log('TVAL-B', tkey, tval)

      if (null != tkey) {
        target[tkey] = tval
      }
      else {
        // console.log('TARGET-A', target)
        tval.map((n, i) => target[i] = n)
        // console.log('TARGET-B', target)

        target.length = tval.length
        // console.log('TARGET-C', target)
      }

      // console.log('DONE', mode, tkey, target, nodes)


      return undefined
    }),


    $PACK: ((mode, key, val, parent, path, nodes, _current, store, keyI, keys, _mpath, modify) => {

      if ('key:pre' !== mode || 'string' !== typeof key || null == path || null == nodes) {
        return undefined
      }

      const args = parent[key]
      const srcpath = args[0]
      const child = clone(args[1])

      const keyprop = child['`$KEY`']
      const tkey = path[path.length - 2]

      // const pkey = 4 < path.length ? path[path.length - 3] : undefined
      const pkey = path[path.length - 3]
      // console.log('****** PACK', tkey, pkey, 'p=', path.join('.'))

      const target = nodes[path.length - 2] || nodes[path.length - 1]
      // console.log('NODES', nodes)
      // const target = nodes[path.length - 1]

      let src = null != store ?
        null != store.$DATA ? getpath(srcpath, store.$DATA) :
          getpath(srcpath, store) :
        undefined

      // console.log('PACK ARGS', key, path, target)
      // console.log('PACK', path.join('.'), srcpath, 's=', src)

      // TODO: also accept objects
      src = Array.isArray(src) ? src :
        'object' === typeof src ? Object.entries(src)
          .reduce((a, n) =>
            (n[1]['`$META`'] = { KEY: n[0] }, a.push(n[1]), a), []) :
          undefined

      if (null == src) {
        return undefined
      }

      // if (Array.isArray(src)) {

      // console.log('SRC', src)

      let tval = src.reduce((a, n) => {
        let kn = null == child['`$KEY`'] ? n[keyprop] : n[child['`$KEY`']]
        a[kn] = {
          ...clone(child),
        }

        if (null != n['`$META`']) {
          a[kn]['`$META`'] = n['`$META`']
        }

        return a
      }, {})

      let tcurrent = src.reduce((a, n) => {
        let kn = null == child['`$KEY`'] ? n[keyprop] : n[child['`$KEY`']]
        a[kn] = n
        return a
      }, {})

      // console.log('T', tval, tcurrent)

      if (null != tkey) {
        tcurrent = { [tkey]: tcurrent }
      }

      if (null != pkey) {
        tcurrent = { [pkey]: tcurrent }
      }


      // console.log('PACK TARGET', tkey, tval, path, tcurrent)

      // console.log('PACK INJECT', path.join('.'), tval, tcurrent)
      tval = inject(
        tval,
        store,
        modify,
        -1, // keyI,
        undefined, // keys,
        tkey,
        nodes[path.length - 3],
        path.slice(0, path.length - 1),
        nodes.slice(0, path.length - 1),
        tcurrent,
      )

      // console.log('PACK TARGET', tkey, target, tval)
      if (null != tkey) {
        target[tkey] = tval
      }
      else {
        delete target[key]
        Object.assign(target, tval)
      }

      return undefined
    }),


    $KEY: ((mode, _key, _val, parent, path) => {
      if ('key:pre' === mode) {
        delete parent['`$KEY`']
        return undefined
      }
      else if ('key:post' === mode) {
        return undefined
      }

      const meta = parent['`$META`']
      return null != meta ? meta.KEY : null != path ? path[path.length - 2] : undefined
    }),

    $META: ((_mode, _key, _val, parent) => {
      // console.log('META',mode,key,val,parent,path)
      delete parent['`$META`']
      return undefined
    }),
  }

  const out = inject(spec, fullstore, modify)
  return out
}


function inject(
  //  These arguments are the public interface.
  val,
  store,
  modify,

  // These arguments are for recursive calls.
  keyI,
  keys,
  key,
  parent,
  path,
  nodes,
  current,
) {
  // const mark = ('' + Math.random()).substring(2, 8)
  // console.log('INJECT-START', mark, path?.join('.'), keyI, val, nodes)

  const valtype = typeof val
  path = null == path ? [] : path

  if (null == keyI) {
    key = '$TOP'
    path = []
    current = (null != store.$DATA ? store.$DATA : store)
    nodes = []
    parent = { [key]: val }
  }
  else {

    // const parentkey = 2 < path.length ? path[path.length - 2] : undefined
    const parentkey = path[path.length - 2]

    // console.log('INJECT', path.join('.'), parentkey, key, 'c=', store === current ? 'STORE' : current)
    current = null == current ? (null != store.$DATA ? store.$DATA : store) : current
    current = null == parentkey ? current : current[parentkey]

  }

  // console.log('INJECT-NODES', mark, path?.join('.'), nodes)

  // const origkey = key

  if (null != val && 'object' === valtype) {
    // console.log('INJECT-KEYS-A', mark, path?.join('.'), val, nodes)

    const origkeys = [
      ...Object.keys(val).filter(k => !k.includes('$')),
      ...Object.keys(val).filter(k => k.includes('$')).sort(),
    ]

    // for (let origkey of origkeys) {
    for (let okI = 0; okI < origkeys.length; okI++) {
      const origkey = origkeys[okI]
      // console.log('ORIGKEY', origkey, typeof origkey)

      let prekey = injection(
        'key:pre',
        origkey,
        val[origkey],
        val,
        [...(path || []), origkey],
        [...(nodes || []), val],
        current,
        store,
        okI,
        origkeys,
        modify
      )

      // console.log('PREKEY', prekey, typeof prekey, 'ok=', origkey)

      // console.log('INJECT-KEYS-B', mark, path?.join('.'), val, nodes)

      if ('string' === typeof prekey) {
        let child = val[prekey]
        let childpath = [...(path || []), prekey]
        let childnodes = [...(nodes || []), val]
        // console.log('CHILD', path?.join('.'), child, prekey, current, childpath.join('.'), childnodes)
        inject(
          child,
          store,
          modify,
          okI,
          origkeys,
          prekey,
          val,
          childpath,
          childnodes,
          current
        )

        // console.log('INJECT-KEYS-C', mark, path?.join('.'), val, nodes)
      }



      injection(
        'key:post',
        undefined == prekey ? origkey : prekey,
        val[prekey],
        val,
        path,
        nodes,
        current,
        store,
        okI,
        origkeys,
        modify
      )
    }

    // console.log('INJECT-KEYS-D', mark, path?.join('.'), val, nodes)
  }

  else if ('string' === valtype) {
    // console.log('VAL-INJECTION', key, val, path.join('.'), 'c=', current == store ? 'STORE' : current)

    // console.log('INJECT-VAL-A', mark, val, nodes)
    const newval = injection(
      'val',
      key,
      val,
      parent,
      path,
      nodes,
      current,
      store,
      keyI,
      keys,
      modify
    )
    // console.log('INJECT-VAL-B', mark, val, newval, nodes)

    val = newval

    if (modify) {
      val = modify(key, val, newval, parent, path, nodes, current, store, keyI, keys)
    }
  }

  // console.log('INJECT-END', mark, path?.join('.'), val, nodes)

  return val
}




function injection(
  mode,
  key,
  // key,
  val,
  parent,
  path,
  nodes,
  current,
  store,
  keyI,
  keys,
  modify
) {
  if ('val' === mode) {
    // console.log('INJECTION', mode, key, val, path?.join('.'), 'C=', current == store ? 'STORE' : current)
  }

  const find = (_full, mpath) => {
    mpath = mpath.replace(/^\$[\d]+/, '$')

    let found = 'string' === typeof mpath ?
      mpath.startsWith('.') ?
        getpath(mpath.substring(1), current) :
        (getpath(mpath, store)) :
      undefined

    found =
      (undefined === found && null != store.$DATA) ? getpath(mpath, store.$DATA) : found

    // console.log('FINDER', mpath, found)

    if ('function' === typeof found) {
      found = found(
        mode,
        key,
        val,
        parent,
        path,
        nodes,
        current,
        store,
        keyI,
        keys,
        mpath,
        modify
      )
    }

    return found
  }

  const iskeymode = mode.startsWith('key')
  const orig = iskeymode ? key : val
  let res


  // console.log('ORIG', orig)


  const m = orig.match(/^`([^`]+)`$/)
  // console.log('M', mode, key, m)

  if (m) {
    res = find(m[0], m[1])
  }
  else {
    res = orig.replace(/`([^`]+)`/g, find)
  }

  // console.log('FIND', mode, key, val, 'f=', orig, res, 'p=', parent)

  // console.log('RES-SET', mode, orig, key, typeof key, res, parent)

  if (null != parent) {
    if (iskeymode) {
      //res = null == res ? orig : res

      if (key !== res && 'string' === typeof res) {
        if ('string' === typeof key) {
          parent[res] = parent[key]
          delete parent[key]
        }

        key = res
      }
    }

    if ('val' === mode && 'string' === typeof key) {
      if (undefined === res) {
        if (orig !== '`$EACH`') {
          delete parent[key]
        }
      }
      else {
        parent[key] = res
      }
    }
  }

  // console.log('RES-END', mode, orig, key, typeof key, res, parent)
  return res
}


function clone(val) {
  return undefined === val ? undefined : JSON.parse(JSON.stringify(val))
}


function merge(objs) {
  let out = undefined
  if (null == objs || !Array.isArray(objs)) {
    return objs
  }
  else if (1 === objs.length) {
    return objs[0]
  }
  else if (1 < objs.length) {
    out = objs[0] || {}
    for (let oI = 1; oI < objs.length; oI++) {
      let obj = objs[oI]
      if (null != obj && 'object' === typeof obj) {
        let cur = [out]
        let cI = 0
        walk(obj, (key, val, parent, path) => {
          if (null != key) {
            cI = path.length - 1
            cur[cI] = cur[cI] || getpath(path.slice(0, path.length - 1), out)

            if (null == cur[cI] || 'object' !== typeof cur[cI]) {
              cur[cI] = (Array.isArray(parent) ? [] : {})
            }

            if (null != val && 'object' === typeof val) {
              cur[cI][key] = cur[cI + 1]
              cur[cI + 1] = undefined
            }
            else {
              cur[cI][key] = val
            }
          }

          return val
        })
      }
    }
  }
  return out
}


function getpath(path, store) {
  if (null == path || null == store || '' === path) {
    return store
  }

  const parts = Array.isArray(path) ? path : path.split('.')
  let val = undefined

  if (0 < parts.length) {
    val = store
    for (let pI = 0; pI < parts.length; pI++) {
      const part = parts[pI]
      val = val[part]
      if (null == val) {
        break
      }
    }
  }

  return val
}


// Walk a data strcture depth first.
function walk(val, apply, key, parent, path) {
  const valtype = typeof val

  if (null != val && 'object' === valtype) {
    for (let k in val) {
      val[k] = walk(val[k], apply, k, val, [...(path || []), k])
    }
  }

  return apply(key, val, parent, path || [])
}



function stringify(val, maxlen) {
  let json = JSON.stringify(val)
  json = 'string' !== typeof json ? '' : json
  json = json.replace(/"/g,'')

  if(null != maxlen) {
    let js = json.substring(0, maxlen)
    json = maxlen < json.length ? (js.substring(0,maxlen-3)+'...') : json
  }

  return json
}



module.exports = {
  clone,
  getpath,
  inject,
  merge,
  transform,
  walk,

  stringify
}
