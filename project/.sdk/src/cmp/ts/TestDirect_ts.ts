
import {
  nom,
} from '@voxgig/apidef'


import {
  Content,
  File,
  Folder,
  Fragment,
  Slot,
  cmp,
} from '@voxgig/sdkgen'


import {
  projectPath
} from './utility_ts'


const TestDirect = cmp(function TestDirect(props: any) {
  const ctx$ = props.ctx$
  const model = ctx$.model
  const stdrep = ctx$.stdrep

  const target = props.target
  const entity = props.entity

  const ff = projectPath('src/cmp/ts/fragment/')

  const PROJECTNAME = model.Name.toUpperCase().replace(/[^A-Z_]/g, '_')
  const entidEnvVar = `${PROJECTNAME}_TEST_${entity.Name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID`

  const opnames = Object.keys(entity.op)
  const hasLoad = opnames.includes('load')
  const hasList = opnames.includes('list')

  if (!hasLoad && !hasList) {
    return
  }

  Folder({ name: entity.name }, () => {

    File({ name: nom(entity, 'Name') + 'Direct.test.' + target.name }, () => {

      Fragment({
        from: ff + 'Direct.test.fragment.ts',
        replace: {
          SdkName: nom(model.const, 'Name'),
          EntityName: nom(entity, 'Name'),
          entityname: entity.name,
          ...stdrep,
        }
      }, () => {


        Slot({ name: 'directSetup' }, () => {
          Content(`
function directSetup(mockres?: any) {
  const calls: any[] = []

  const env = envOverride({
    '${entidEnvVar}': {},
    '${PROJECTNAME}_TEST_LIVE': 'FALSE',
    '${PROJECTNAME}_APIKEY': 'NONE',
  })

  const live = 'TRUE' === env.${PROJECTNAME}_TEST_LIVE

  if (live) {
    const client = new ${nom(model.const, 'Name')}SDK({
      apikey: env.${PROJECTNAME}_APIKEY,
    })

    let idmap: any = env['${entidEnvVar}']
    if ('string' === typeof idmap && idmap.startsWith('{')) {
      idmap = JSON.parse(idmap)
    }

    return { client, calls, live, idmap }
  }

  const mockFetch = async (url: string, init: any) => {
    calls.push({ url, init })
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      json: async () => (null != mockres ? mockres : { id: 'direct01' }),
    }
  }

  const client = new ${nom(model.const, 'Name')}SDK({
    base: 'http://localhost:8080',
    system: { fetch: mockFetch },
  })

  return { client, calls, live, idmap: {} as any }
}
  `)
        })


        Slot({ name: 'direct' }, () => {

          if (hasLoad) {
            generateDirectLoad(model, entity)
          }

          if (hasList) {
            generateDirectList(model, entity)
          }
        })

      })
    })
  })
})


function generateDirectLoad(model: any, entity: any) {
  const loadOp = entity.op.load
  const loadPoint = loadOp.points[0]

  if (null == loadPoint) {
    return
  }

  const loadPath = (loadPoint.parts || []).join('/')
  const loadParams = loadPoint.args?.params || []

  // Get list info for live mode bootstrapping
  const listOp = entity.op.list
  const listPoint = listOp?.points?.[0]
  const listPath = listPoint ? (listPoint.parts || []).join('/') : ''
  const listParams = listPoint?.args?.params || []
  const hasList = null != listPoint

  // Ancestor params (not 'id') for live mode
  const ancestorParams = loadParams.filter((p: any) => p.name !== 'id')

  const paramAsserts = loadParams.map((p: any, i: number) =>
    '      assert(calls[0].url.includes(\'direct0' + (i + 1) + '\'))\n').join('')

  // Build live list params
  const liveListParams = listParams.map((p: any) => {
    const key = p.name === 'id'
      ? entity.name + '01'
      : p.name.replace(/_id$/, '') + '01'
    return { name: p.name, key }
  })

  // Build live ancestor params for load
  const liveAncestorParams = ancestorParams.map((p: any) => {
    const key = p.name.replace(/_id$/, '') + '01'
    return { name: p.name, key }
  })

  let liveParamsBlock = ''
  if (hasList) {
    const listParamLines = liveListParams.map((lp: any) =>
      `        ${lp.name}: setup.idmap['${lp.key}'],`).join('\n')
    const ancestorParamLines = liveAncestorParams.map((lp: any) =>
      `      params.${lp.name} = setup.idmap['${lp.key}']`).join('\n')

    liveParamsBlock = `    if (setup.live) {
      const listResult: any = await client.direct({
        path: '${listPath}',
        method: 'GET',
        params: {
${listParamLines}
        },
      })
      assert(listResult.ok === true)
      const listData = listResult.data
      if (!Array.isArray(listData) || listData.length === 0) {
        return // skip: no entities to load in live mode
      }
      params.id = listData[0].id
${ancestorParamLines}
    } else {
${loadParams.map((p: any, i: number) => `      params.${p.name} = 'direct0${i + 1}'`).join('\n')}
    }`
  } else {
    liveParamsBlock = `    if (!setup.live) {
${loadParams.map((p: any, i: number) => `      params.${p.name} = 'direct0${i + 1}'`).join('\n')}
    }`
  }

  Content(`
  test('direct-load-${entity.name}', async () => {
    const setup = directSetup({ id: 'direct01' })
    const { client, calls } = setup

    const params: any = {}
${liveParamsBlock}

    const result: any = await client.direct({
      path: '${loadPath}',
      method: 'GET',
      params,
    })

    assert(result.ok === true)
    assert(result.status === 200)
    assert(null != result.data)

    if (!setup.live) {
      assert(result.data.id === 'direct01')
      assert(calls.length === 1)
      assert(calls[0].init.method === 'GET')
${paramAsserts}    }
  })
`)
}


function generateDirectList(model: any, entity: any) {
  const listOp = entity.op.list
  const listPoint = listOp.points[0]

  if (null == listPoint) {
    return
  }

  const listPath = (listPoint.parts || []).join('/')
  const listParams = listPoint.args?.params || []

  // Build live params
  const liveParams = listParams.map((p: any) => {
    const key = p.name === 'id'
      ? entity.name + '01'
      : p.name.replace(/_id$/, '') + '01'
    return { name: p.name, key }
  })

  const paramAsserts = listParams.map((p: any, i: number) =>
    '      assert(calls[0].url.includes(\'direct0' + (i + 1) + '\'))\n').join('')

  let paramsBlock = ''
  if (listParams.length > 0) {
    const liveLines = liveParams.map((lp: any) =>
      `      params.${lp.name} = setup.idmap['${lp.key}']`).join('\n')
    const mockLines = listParams.map((p: any, i: number) =>
      `      params.${p.name} = 'direct0${i + 1}'`).join('\n')

    paramsBlock = `    const params: any = {}
    if (setup.live) {
${liveLines}
    } else {
${mockLines}
    }
`
  } else {
    paramsBlock = `    const params: any = {}
`
  }

  Content(`
  test('direct-list-${entity.name}', async () => {
    const setup = directSetup([{ id: 'direct01' }, { id: 'direct02' }])
    const { client, calls } = setup

${paramsBlock}
    const result: any = await client.direct({
      path: '${listPath}',
      method: 'GET',
      params,
    })

    assert(result.ok === true)
    assert(result.status === 200)
    assert(Array.isArray(result.data))

    if (!setup.live) {
      assert(result.data.length === 2)
      assert(calls.length === 1)
      assert(calls[0].init.method === 'GET')
${paramAsserts}    }
  })
`)
}


export {
  TestDirect
}
