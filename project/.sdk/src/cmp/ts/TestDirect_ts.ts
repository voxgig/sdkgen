
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

  return { client, calls }
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
  const loadTarget = loadOp.targets[0]

  if (null == loadTarget) {
    return
  }

  const loadPath = (loadTarget.parts || []).join('/')
  const loadParams = loadTarget.args?.params || []

  const paramStr = loadParams.length > 0
    ? '{ ' + loadParams.map((p: any, i: number) =>
      p.name + ': \'direct0' + (i + 1) + '\'').join(', ') + ' }'
    : '{}'

  const paramAsserts = loadParams.map((p: any, i: number) =>
    '    assert(calls[0].url.includes(\'direct0' + (i + 1) + '\'))\n').join('')

  Content(`
  test('direct-load-${entity.name}', async () => {
    const setup = directSetup({ id: 'direct01' })
    const { client, calls } = setup

    const result: any = await client.direct({
      path: '${loadPath}',
      method: 'GET',
      params: ${paramStr},
    })

    assert(result.ok === true)
    assert(result.status === 200)
    assert(null != result.data)
    assert(result.data.id === 'direct01')

    assert(calls.length === 1)
    assert(calls[0].init.method === 'GET')
${paramAsserts}  })
`)
}


function generateDirectList(model: any, entity: any) {
  const listOp = entity.op.list
  const listTarget = listOp.targets[0]

  if (null == listTarget) {
    return
  }

  const listPath = (listTarget.parts || []).join('/')
  const listParams = listTarget.args?.params || []

  const paramStr = listParams.length > 0
    ? '{ ' + listParams.map((p: any, i: number) =>
      p.name + ': \'direct0' + (i + 1) + '\'').join(', ') + ' }'
    : '{}'

  const paramAsserts = listParams.map((p: any, i: number) =>
    '    assert(calls[0].url.includes(\'direct0' + (i + 1) + '\'))\n').join('')

  Content(`
  test('direct-list-${entity.name}', async () => {
    const setup = directSetup([{ id: 'direct01' }, { id: 'direct02' }])
    const { client, calls } = setup

    const result: any = await client.direct({
      path: '${listPath}',
      method: 'GET',
      params: ${paramStr},
    })

    assert(result.ok === true)
    assert(result.status === 200)
    assert(Array.isArray(result.data))
    assert(result.data.length === 2)

    assert(calls.length === 1)
    assert(calls[0].init.method === 'GET')
${paramAsserts}  })
`)
}


export {
  TestDirect
}
