
import * as Path from 'node:path'


import {
  flatten,
  items,
  join,
  jsonify,
  slice,
} from '@voxgig/struct'

import {
  KIT,
  Model,
  ModelEntity,
  ModelEntityFlow,
  ModelEntityFlowStep,
  getModelPath,
  nom,
} from '@voxgig/apidef'


import {
  Content,
  File,
  Folder,
  Fragment,
  Slot,
  cmp,
  each,
} from '@voxgig/sdkgen'


import {
  projectPath
} from './utility_ts'


type OpGen = (model: any, entity: any, flow: any, step: any, index: any) => void


const TestEntity = cmp(function TestEntity(props: any) {
  const ctx$ = props.ctx$
  const model = ctx$.model
  const stdrep = ctx$.stdrep

  const target = props.target
  const entity = props.entity

  // TODO: should be a utility function
  const ff = projectPath('src/cmp/ts/fragment/')

  Folder({ name: entity.name }, () => {

    File({ name: nom(entity, 'Name') + 'Entity.test.' + target.name }, () => {

      Fragment({
        from: ff + 'Entity.test.fragment.ts',
        replace: {
          SdkName: nom(model.const, 'Name'),
          EntityName: nom(entity, 'Name'),
          ...stdrep,
        }
      }, () => {

        const basicflow = getModelPath(model, `main.${KIT}.flow.Basic${entity.Name}Flow`)

        const dobasic = basicflow && true === basicflow.active

        if (!dobasic) {
          return;
        }

        const indent = 2

        const idlist = flatten([
          '${entity.name}01',
          '${entity.name}02',
          '${entity.name}03',
          flatten(items(entity.relations.ancestors, (ap: any) =>
            items(ap[1], (a: any) =>
              items(['01', '02', '03'], (n: any) =>
                a[1] + n[1]))), 2)
        ])

        Slot({ name: 'basicSetup' }, () => {
          Content(`
function basicSetup(extra?: any) {
  // TODO: fix test def options
  const options: any = {} // ${jsonify(basicflow.test, { offset: indent - 2 })}

  // TODO: needs test utility to resolve path
  const entityDataFile =
    Path.resolve(__dirname, 
      '../../../../.sdk/test/entity/${entity.name}/${nom(entity, 'Name')}TestData.json')

  // TODO: file ready util needed?
  const entityDataSource = Fs.readFileSync(entityDataFile).toString('utf8')

  // TODO: need a xlang JSON parse utility in voxgig/struct with better error msgs
  const entityData = JSON.parse(entityDataSource)

  options.entity = entityData.existing

  let client = ${model.Name}SDK.test(options, extra)
  const struct = client.utility().struct
  const merge = struct.merge
  const transform = struct.transform

  let idmap = transform(
    ['${join(idlist, '\',\'')}'],
    {
      '\`$PACK\`': ['', {
        '\`$KEY\`': '\`$COPY\`',
        '\`$VAL\`': ['\`$FORMAT\`', 'upper', '\`$COPY\`']
      }]
    })

  const env = envOverride({
    '${nom(model.const, 'NAME')}_TEST_${nom(entity, 'NAME')}_ENTID': idmap,
    '${nom(model.const, 'NAME')}_TEST_LIVE': 'FALSE',
    '${nom(model.const, 'NAME')}_TEST_EXPLAIN': 'FALSE',
    '${nom(model.const, 'NAME')}_APIKEY': 'NONE',
  })

  idmap = env['${nom(model.const, 'NAME')}_TEST_${nom(entity, 'NAME')}_ENTID']

  if ('TRUE' === env.${model.NAME}_TEST_LIVE) {
    client = new ${model.Name}SDK(merge([
      {
        apikey: env.${nom(model.const, 'NAME')}_APIKEY,
      },
      extra
    ]))
  }

  const setup = {
    idmap,
    env,
    options,
    client,
    struct,
    data: entityData,
    explain: 'TRUE' === env.${nom(model.const, 'NAME')}_TEST_EXPLAIN,
    now: Date.now(),
  }

  return setup
}
  `)
        })


        Slot({ name: 'basic' }, () => {
          Content(`
    const setup = basicSetup()
    const client = setup.client
    const struct = setup.struct

    const isempty = struct.isempty
    const select = struct.select

`)

          each(basicflow.step, (step: any, index: any) => {
            const opgen: OpGen = GENERATE_OP[step.op]
            opgen(model, entity, basicflow, step, index)
            Content('\n')
          })
        })
      })
    })
  })
})


const generateCreate: OpGen = (
  model: Model,
  entity: ModelEntity,
  flow: ModelEntityFlow,
  step: ModelEntityFlowStep,
  index: number
) => {
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const datavar = step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? ''))

  Content(`
    // CREATE
    const ${entvar} = client.${nom(entity, 'Name')}()
    const ${datavar} =
      await ${entvar}.create(setup.data.new.${entity.name}['${ref}'])
    assert(null != ${datavar}.id)
  `)
}


const generateList: OpGen = (
  model: Model,
  entity: ModelEntity,
  flow: ModelEntityFlow,
  step: ModelEntityFlowStep,
  index: number
) => {
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const listvar = step.input.listvar ?? (ref + '_list' + (step.input.suffix ?? ''))

  Content(`
    // LIST
    const ${matchvar}: any = {}
  `)

  each(step.match, (mi: any) => {
    Content(`    ${matchvar}['${mi.key$}'] = setup.idmap['${mi.key$}']
  `)
  })

  Content(`
    const ${listvar} = await ${entvar}.list(${matchvar})
`)
  for (let vI = 0; vI < step.valid.length; vI++) {
    const validator = step.valid[vI]
    if ('ItemExists' === validator.apply) {
      Content(`
    assert(!isempty(select(${listvar}, { id: ${validator.def.ref}_data.id })))
`)
    }
    else if ('ItemNotExists' === validator.apply) {
      Content(`
    assert(isempty(select(${listvar}, { id: ${validator.def.ref}_data.id })))
`)
    }
  }
}


const generateUpdate: OpGen = (
  model: Model,
  entity: ModelEntity,
  flow: ModelEntityFlow,
  step: ModelEntityFlowStep,
  index: number
) => {
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const datavar = step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? ''))
  const resdatavar = step.input.resdatavar ?? (ref + '_resdata' + (step.input.suffix ?? ''))
  const markdefvar = step.input.markdefvar ?? (ref + '_markdef' + (step.input.suffix ?? ''))
  const srcdatavar = step.input.srcdatavar ?? (ref + '_data' + (step.input.suffix ?? ''))

  Content(`
    // UPDATE
    const ${datavar}: any = {}
    ${datavar}.id = ${srcdatavar}.id
`)

  each(step.data, (mi: any) => {
    if ('id' !== mi.key$) {
      Content(`    ${datavar} ['${mi.key$}'] = setup.idmap['${mi.key$}']
`)
    }
  })


  for (let sI = 0; sI < step.spec.length; sI++) {
    const spec = step.spec[sI]
    if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
      const fieldname = step.input.textfield
      const fieldvalue = spec.def.mark
      Content(`
    const ${markdefvar} = { name: '${fieldname}', value: '${fieldvalue}_' + setup.now }
    ${datavar} [${markdefvar}.name] = ${markdefvar}.value
`)
    }
  }

  Content(`
    const ${resdatavar} = await ${entvar}.update(${datavar})
    assert(${resdatavar}.id === ${datavar}.id)
`)

  for (let sI = 0; sI < step.spec.length; sI++) {
    const spec = step.spec[sI]
    if ('TextFieldMark' === spec.apply) {
      Content(`
    assert(${resdatavar}[${markdefvar}.name] === ${markdefvar}.value)
`)
    }
  }

}


const generateLoad: OpGen = (
  model: Model,
  entity: ModelEntity,
  flow: ModelEntityFlow,
  step: ModelEntityFlowStep,
  index: number
) => {
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const datavar = step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? ''))
  const srcdatavar = step.input.srcdatavar ?? (ref + '_data' + (step.input.suffix ?? ''))

  Content(`
    // LOAD
    const ${matchvar}: any = {}
    ${matchvar}.id = ${srcdatavar}.id
    const ${datavar} = await ${entvar}.load(${matchvar})
    assert(${datavar}.id === ${srcdatavar}.id)
`)
}


const generateRemove: OpGen = (
  model: Model,
  entity: ModelEntity,
  flow: ModelEntityFlow,
  step: ModelEntityFlowStep,
  index: number
) => {
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const srcdatavar = step.input.srcdatavar ?? (ref + '_data')

  Content(`
    // REMOVE
    const ${matchvar}: any = {}
    ${matchvar}.id = ${srcdatavar}.id
    await ${entvar}.remove(${matchvar})
  `)
}


const GENERATE_OP: Record<string, OpGen> = {
  create: generateCreate,
  list: generateList,
  update: generateUpdate,
  load: generateLoad,
  remove: generateRemove,
}


export {
  TestEntity
}
