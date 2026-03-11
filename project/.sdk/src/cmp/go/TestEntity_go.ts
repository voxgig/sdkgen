
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
} from './utility_go'


import {
  flatten,
  items,
  join,
  jsonify,
  slice,
} from '@voxgig/struct'


type OpGen = (model: any, entity: any, flow: any, step: any, index: any) => void


const TestEntity = cmp(function TestEntity(props: any) {
  const ctx$ = props.ctx$
  const model = ctx$.model
  const stdrep = ctx$.stdrep

  const target = props.target
  const entity = props.entity

  const origin = null == model.origin ? '' : `${model.origin}/`
  const gomodule = `${origin}${model.name}`

  const basicflow = getModelPath(model, `main.${KIT}.flow.Basic${entity.Name}Flow`)
  const dobasic = basicflow && true === basicflow.active

  if (!dobasic) {
    return
  }

  Folder({ name: entity.name }, () => {

    File({ name: entity.name + '_entity_test.' + target.ext }, () => {

      Content(`package ${model.name}_test

import (
	"testing"
	"github.com/stretchr/testify/assert"

	sdk "${gomodule}"
)

func Test${entity.Name}Entity(t *testing.T) {
	testsdk := sdk.Test(nil, nil)
	assert.NotNil(t, testsdk)

`)

      Content(`	t.Run("instance", func(t *testing.T) {
		ent := testsdk.${entity.Name}(nil)
		assert.NotNil(t, ent)
	})

`)

      if (dobasic) {
        Content(`	t.Run("basic", func(t *testing.T) {
`)

        const idlist = flatten([
          `${entity.name}01`,
          `${entity.name}02`,
          `${entity.name}03`,
          flatten(items(entity.relations.ancestors, (ap: any) =>
            items(ap[1], (a: any) =>
              items(['01', '02', '03'], (n: any) =>
                a[1] + n[1]))), 2)
        ])

        each(basicflow.step, (step: any, index: any) => {
          const opgen: OpGen = GENERATE_OP[step.op]
          if (opgen) {
            opgen(model, entity, basicflow, step, index)
          }
        })

        Content(`	})
`)
      }

      Content(`}
`)
    })
  })
})


const generateCreate: OpGen = (
  model: any,
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
		${entvar} := testsdk.${nom(entity, 'Name')}(nil)
		${datavar} := setup.Data.New["${entity.name}"]["${ref}"]
`)

  each(step.match, (mi: any) => {
    Content(`		${datavar}["${mi.key$}"] = setup.IDMap["${mi.val$}"]
`)
  })

  Content(`
		${datavar}Result, err := ${entvar}.Create(${datavar})
		assert.NoError(t, err)
		assert.NotNil(t, ${datavar}Result)
`)
}


const generateList: OpGen = (
  model: any,
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
		${matchvar} := map[string]any{}
`)

  each(step.match, (mi: any) => {
    Content(`		${matchvar}["${mi.key$}"] = setup.IDMap["${mi.val$}"]
`)
  })

  Content(`
		${listvar}, err := ${entvar}.List(${matchvar})
		assert.NoError(t, err)
		assert.NotNil(t, ${listvar})
`)
}


const generateUpdate: OpGen = (
  model: any,
  entity: ModelEntity,
  flow: ModelEntityFlow,
  step: ModelEntityFlowStep,
  index: number
) => {
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const datavar = step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? ''))
  const resdatavar = step.input.resdatavar ?? (ref + '_resdata' + (step.input.suffix ?? ''))

  Content(`
		// UPDATE
		${datavar}Update := map[string]any{}
		${datavar}Update["id"] = ${datavar}Result.(map[string]any)["id"]
`)

  each(step.data, (mi: any) => {
    if ('id' !== mi.key$) {
      Content(`		${datavar}Update["${mi.key$}"] = setup.IDMap["${mi.key$}"]
`)
    }
  })

  Content(`
		${resdatavar}, err := ${entvar}.Update(${datavar}Update)
		assert.NoError(t, err)
		assert.NotNil(t, ${resdatavar})
`)
}


const generateLoad: OpGen = (
  model: any,
  entity: ModelEntity,
  flow: ModelEntityFlow,
  step: ModelEntityFlowStep,
  index: number
) => {
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const datavar = step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? ''))

  Content(`
		// LOAD
		${matchvar} := map[string]any{}
		${matchvar}["id"] = ${datavar}Result.(map[string]any)["id"]
		${datavar}Loaded, err := ${entvar}.Load(${matchvar})
		assert.NoError(t, err)
		assert.NotNil(t, ${datavar}Loaded)
`)
}


const generateRemove: OpGen = (
  model: any,
  entity: ModelEntity,
  flow: ModelEntityFlow,
  step: ModelEntityFlowStep,
  index: number
) => {
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const datavar = step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? ''))

  Content(`
		// REMOVE
		${matchvar}Rm := map[string]any{}
		${matchvar}Rm["id"] = ${datavar}Result.(map[string]any)["id"]
		_, err = ${entvar}.Remove(${matchvar}Rm)
		assert.NoError(t, err)
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
