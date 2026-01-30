
import * as Path from 'node:path'


import { jsonify } from '@voxgig/struct'

import {
  nom,
  KIT,
  getModelPath,
  Model,
  ModelEntity,
  ModelEntityFlow,
  ModelEntityFlowStep,
} from '@voxgig/apidef'


import {
  cmp, camelify, Content, Folder, Fragment, File, Slot, each,
} from '@voxgig/sdkgen'


type OpGen = (model: any, entity: any, flow: any, step: any, index: any) => void


const TestEntity = cmp(function TestEntity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // TODO: should a utility function
  const ff = Path.normalize(__dirname + '/../../../src/cmp/ts/fragment/')

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

        let indent = 2

        Slot({ name: 'basicSetup' }, () => {
          Content(`
function basicSetup(extra?: any) {
  extra = extra || {}

  const options: any = {} // ${jsonify(basicflow.test, { offset: indent - 2 })}

  const entityDataFile =
    Path.resolve(__dirname, 
      '../../../../.sdk/test/entity/planet/${nom(entity, 'Name')}TestData.json')

  const entityDataSource =
    Fs.readFileSync(entityDataFile).toString('utf8')

  // TODO: need a xlang JSON parse utility in voxgig/struct with better error msgs
  const entityData = JSON.parse(entityDataSource)

  options.entity = entityData.existing

  const setup: any = {
    dm: {
      // p: envOverride($ {jsonify(basicflow.param, { offset: 2 + indent })}),
      p: {},
      s: {},
    },
    options,
  }

  const { merge } = utility.struct

  let client = ${model.Name}SDK.test(options, extra)
  // if ('TRUE' === setup.dm.p.${model.NAME}_TEST_LIVE) {
  //   client = new ${model.Name}SDK(merge([
  //     {
  //       apikey: process.env.${model.NAME}_APIKEY,
  //     },
  //     extra])
  //   )
  // }

  setup.data = entityData  
  setup.client = client    
  setup.struct = client.utility().struct
  setup.explain = 'TRUE' === setup.dm.p.${model.NAME}_TEST_EXPLAIN
  setup.now = Date.now()

  return setup
}
`)
        })


        Slot({ name: 'basic' }, () => {
          Content(`
    const setup = basicSetup()
    const client = setup.client

`)

          const opmap = entity.op
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
    const ${matchvar} = {}
    const ${listvar} = await ${entvar}.list(${matchvar})
`)
  for (let vI = 0; vI < step.valid.length; vI++) {
    const validator = step.valid[vI]
    if ('ItemExists' === validator.apply) {
      Content(`
    assert(null != ${listvar}.find((entdata: any) =>
      entdata.data().id == ${validator.def.ref}_data.id))
`)
    }
    else if ('ItemNotExists' === validator.apply) {
      Content(`
    assert(null == ${listvar}.find((entdata: any) =>
      entdata.data().id == ${validator.def.ref}_data.id))
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

  for (let sI = 0; sI < step.spec.length; sI++) {
    const spec = step.spec[sI]
    if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
      const fieldname = step.input.textfield
      const fieldvalue = spec.def.mark
      Content(`
    const ${markdefvar} = { name: '${fieldname}', value: '${fieldvalue}_'+setup.now }
    ${datavar}[${markdefvar}.name] = ${markdefvar}.value
`)
    }
  }

  Content(`
    const ${resdatavar} = await ${entvar}.update(${datavar})
    assert.equal(${resdatavar}.id, ${datavar}.id)
`)

  for (let sI = 0; sI < step.spec.length; sI++) {
    const spec = step.spec[sI]
    if ('TextFieldMark' === spec.apply) {
      Content(`
    assert.equal(${resdatavar}[${markdefvar}.name], ${markdefvar}.value)
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
