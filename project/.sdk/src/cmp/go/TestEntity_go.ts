
import {
  flatten,
  items,
  join,
} from '@voxgig/struct'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


import {
  Content,
  File,
  cmp,
  each,
} from '@voxgig/sdkgen'


// Convert snake_case to camelCase for Go variable names.
function goVar(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_: any, c: string) => c.toUpperCase())
}


type OpGen = (ctx: GenCtx, step: any, index: any) => void

type GenCtx = {
  model: any
  entity: any
  gomodule: string
  flow: any
  PROJUPPER: string
}


const TestEntity = cmp(function TestEntity(props: any) {
  const ctx$ = props.ctx$
  const model = ctx$.model

  const target = props.target
  const entity = props.entity
  const gomodule = props.gomodule

  const basicflow = getModelPath(model, `main.${KIT}.flow.Basic${entity.Name}Flow`)
  const dobasic = basicflow && true === basicflow.active

  if (!dobasic) {
    return
  }

  const PROJUPPER = model.const.Name.toUpperCase().replace(/[^A-Z_]/g, '_')

  const ancestors = (entity.relations?.ancestors || []).flat()

  // Build idmap names: entity's own + ancestor ids
  const idnames: string[] = []
  for (let i = 1; i <= 3; i++) idnames.push(`${entity.name}0${i}`)
  for (const anc of ancestors) {
    for (let i = 1; i <= 3; i++) idnames.push(`${anc}0${i}`)
  }

  const idnamesStr = idnames.map(n => `"${n}"`).join(', ')

  // Get all update data entries for alias generation
  const allSteps = Object.values(basicflow.step) as any[]
  const updateStep = allSteps.find((s: any) => s.op === 'update')
  const updateData = updateStep?.data
    ? Object.entries(updateStep.data).filter(([k]: any) => k !== 'id' && !k.endsWith('$'))
    : []
  const aliases = updateData.map(([k, v]: any) => [k, v])

  const genCtx: GenCtx = { model, entity, gomodule, flow: basicflow, PROJUPPER }

  File({ name: entity.name + '_entity_test.' + target.ext }, () => {

    Content(`package sdktest

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	sdk "${gomodule}"
	"${gomodule}/core"

	vs "github.com/voxgig/struct"
)

func Test${entity.Name}Entity(t *testing.T) {
	t.Run("instance", func(t *testing.T) {
		testsdk := sdk.TestSDK(nil, nil)
		ent := testsdk.${entity.Name}(nil)
		if ent == nil {
			t.Fatal("expected non-nil ${entity.Name}Entity")
		}
	})

	t.Run("basic", func(t *testing.T) {
		setup := ${entity.name}BasicSetup(nil)
		client := setup.client

`)

    // Check if the flow has a create step; if not, bootstrap entity data
    const flowHasCreate = allSteps.some((s: any) => s.op === 'create')
    if (!flowHasCreate) {
      const preambleRef = entity.name + '_ref01'
      Content(`		// Bootstrap entity data from existing test data (no create step in flow).
		${goVar(preambleRef)}DataRaw := vs.Items(core.ToMapAny(vs.GetProp(setup.data, "existing.${entity.name}")))
		var ${goVar(preambleRef)}Data map[string]any
		if len(${goVar(preambleRef)}DataRaw) > 0 {
			${goVar(preambleRef)}Data = core.ToMapAny(${goVar(preambleRef)}DataRaw[0][1])
		}

`)
    }

    // Model-driven step iteration
    each(basicflow.step, (step: any, index: any) => {
      const opgen: OpGen = GENERATE_OP[step.op]
      if (opgen) {
        opgen(genCtx, step, index)
        Content('\n')
      }
    })

    Content(`	})
}

`)

    // Generate setup function
    Content(`func ${entity.name}BasicSetup(extra map[string]any) *entityTestSetup {
	loadEnvLocal()

	_, filename, _, _ := runtime.Caller(0)
	dir := filepath.Dir(filename)

	entityDataFile := filepath.Join(dir, "..", "..", ".sdk", "test", "entity", "${entity.name}", "${entity.Name}TestData.json")

	entityDataSource, err := os.ReadFile(entityDataFile)
	if err != nil {
		panic("failed to read ${entity.name} test data: " + err.Error())
	}

	var entityData map[string]any
	if err := json.Unmarshal(entityDataSource, &entityData); err != nil {
		panic("failed to parse ${entity.name} test data: " + err.Error())
	}

	options := map[string]any{}
	options["entity"] = entityData["existing"]

	client := sdk.TestSDK(options, extra)

`)

    // Generate idmap via vs.Transform
    Content('\t// Generate idmap via transform, matching TS pattern.\n')
    Content('\tidmap := vs.Transform(\n')
    Content('\t\t[]any{' + idnamesStr + '},\n')
    Content('\t\tmap[string]any{\n')
    Content('\t\t\t"`$PACK`": []any{"", map[string]any{\n')
    Content('\t\t\t\t"`$KEY`": "`$COPY`",\n')
    Content('\t\t\t\t"`$VAL`": []any{"`$FORMAT`", "upper", "`$COPY`"},\n')
    Content('\t\t\t}},\n')
    Content('\t\t},\n')
    Content('\t)\n')

    Content(`
	env := envOverride(map[string]any{
		"${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID": idmap,
		"${PROJUPPER}_TEST_LIVE":      "FALSE",
		"${PROJUPPER}_TEST_EXPLAIN":   "FALSE",
		"${PROJUPPER}_APIKEY":         "NONE",
	})

	idmapResolved := core.ToMapAny(env["${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID"])
	if idmapResolved == nil {
		idmapResolved = core.ToMapAny(idmap)
	}
`)

    // Add aliases for ancestor field names
    for (const [key, val] of aliases) {
      Content(`	// Add ${key} alias for update test.
	if idmapResolved["${key}"] == nil {
		idmapResolved["${key}"] = idmapResolved["${val}"]
	}
`)
    }

    Content(`
	if env["${PROJUPPER}_TEST_LIVE"] == "TRUE" {
		mergedOpts := vs.Merge([]any{
			map[string]any{
				"apikey": env["${PROJUPPER}_APIKEY"],
			},
			extra,
		})
		client = sdk.New${model.const.Name}SDK(core.ToMapAny(mergedOpts))
	}

	return &entityTestSetup{
		client:  client,
		data:    entityData,
		idmap:   idmapResolved,
		env:     env,
		explain: env["${PROJUPPER}_TEST_EXPLAIN"] == "TRUE",
		now:     time.Now().UnixMilli(),
	}
}
`)
  })
})


// Get match entries from a step, filtering out $ keys.
function getMatchEntries(step: any): [string, any][] {
  if (!step?.match) return []
  return Object.entries(step.match).filter(([k]: any) => !k.endsWith('$'))
}


const generateCreate: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input?.ref ?? entity.name + '_ref01'
  const entvar = goVar(step.input?.entvar ?? ref + '_ent')
  const datavar = goVar(step.input?.datavar ?? (ref + '_data' + (step.input?.suffix ?? '')))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  const hasDatvar = priorSteps.some((s: any) => {
    if ('create' === s.op) {
      const priorRef = s.input?.ref ?? entity.name + '_ref01'
      const priorDatvar = goVar(s.input?.datavar ?? (priorRef + '_data' + (s.input?.suffix ?? '')))
      return priorDatvar === datavar
    }
    return false
  })

  Content(`		// CREATE
`)
  if (needsEnt) {
    Content(`		${entvar} := client.${entity.Name}(nil)
`)
  }

  // Load data from test data file
  if (hasDatvar) {
    Content(`		${datavar} = core.ToMapAny(vs.GetProp(
			vs.GetPath([]any{"new", "${entity.name}"}, setup.data), "${ref}"))
`)
  } else {
    Content(`		${datavar} := core.ToMapAny(vs.GetProp(
			vs.GetPath([]any{"new", "${entity.name}"}, setup.data), "${ref}"))
`)
  }

  // Add match entries
  const matchEntries = getMatchEntries(step)
  for (const [key, val] of matchEntries) {
    Content(`		${datavar}["${key}"] = setup.idmap["${val}"]
`)
  }

  Content(`
		${datavar}Result, err := ${entvar}.Create(${datavar}, nil)
		if err != nil {
			t.Fatalf("create failed: %v", err)
		}
		${datavar} = core.ToMapAny(${datavar}Result)
		if ${datavar} == nil {
			t.Fatal("expected create result to be a map")
		}
		if ${datavar}["id"] == nil {
			t.Fatal("expected created entity to have an id")
		}
`)
}


const generateList: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input?.ref ?? entity.name + '_ref01'
  const entvar = goVar(step.input?.entvar ?? ref + '_ent')
  const matchvar = goVar(step.input?.matchvar ?? (ref + '_match' + (step.input?.suffix ?? '')))
  const listvar = goVar(step.input?.listvar ?? (ref + '_list' + (step.input?.suffix ?? '')))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  Content(`		// LIST
`)
  if (needsEnt) {
    Content(`		${entvar} := client.${entity.Name}(nil)
`)
  }

  // Generate match map
  const matchEntries = getMatchEntries(step)
  if (matchEntries.length === 0) {
    Content(`		${matchvar} := map[string]any{}
`)
  } else {
    Content(`		${matchvar} := map[string]any{
`)
    for (const [key, val] of matchEntries) {
      Content(`			"${key}": setup.idmap["${val}"],
`)
    }
    Content(`		}
`)
  }

  Content(`
		${listvar}Result, err := ${entvar}.List(${matchvar}, nil)
		if err != nil {
			t.Fatalf("list failed: %v", err)
		}
		${listvar}, ok := ${listvar}Result.([]any)
		if !ok {
			t.Fatalf("expected list result to be an array, got %T", ${listvar}Result)
		}
`)

  // Handle validators from step.valid
  const allSteps = Object.values(flow.step) as any[]
  if (step.valid) {
    for (const validator of step.valid) {
      const validRef = validator.def?.ref
      const hasRefData = validRef && allSteps.some((s: any) => 'create' === s.op &&
        ((s.input?.ref ?? entity.name + '_ref01') === validRef))

      if ('ItemExists' === validator.apply && hasRefData) {
        const refDataVar = goVar(validRef + '_data')
        Content(`
		foundItem := vs.Select(entityListToData(${listvar}), map[string]any{"id": ${refDataVar}["id"]})
		if vs.IsEmpty(foundItem) {
			t.Fatal("expected to find created entity in list")
		}
`)
      } else if ('ItemNotExists' === validator.apply && hasRefData) {
        const refDataVar = goVar(validRef + '_data')
        Content(`
		notFoundItem := vs.Select(entityListToData(${listvar}), map[string]any{"id": ${refDataVar}["id"]})
		if !vs.IsEmpty(notFoundItem) {
			t.Fatal("expected removed entity to not be in list")
		}
`)
      }
    }
  }
}


const generateUpdate: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input?.ref ?? entity.name + '_ref01'
  const entvar = goVar(step.input?.entvar ?? ref + '_ent')
  const datavar = goVar(step.input?.datavar ?? (ref + '_data' + (step.input?.suffix ?? '')))
  const resdatavar = goVar(step.input?.resdatavar ?? (ref + '_resdata' + (step.input?.suffix ?? '')))
  const markdefvar = goVar(step.input?.markdefvar ?? (ref + '_markdef' + (step.input?.suffix ?? '')))
  const srcdatavar = goVar(step.input?.srcdatavar ?? (ref + '_data' + (step.input?.suffix ?? '')))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  Content(`		// UPDATE
`)
  if (needsEnt) {
    Content(`		${entvar} := client.${entity.Name}(nil)
`)
  }
  Content(`		${datavar}Up := map[string]any{
			"id": ${srcdatavar}["id"],
`)

  // Add data entries from step.data
  if (step.data) {
    const dataEntries = Object.entries(step.data).filter(([k]: any) => k !== 'id' && !k.endsWith('$'))
    for (const [key] of dataEntries) {
      Content(`			"${key}": setup.idmap["${key}"],
`)
    }
  }

  Content(`		}
`)

  // Handle TextFieldMark spec
  if (step.spec) {
    for (const spec of step.spec) {
      if ('TextFieldMark' === spec.apply && null != step.input?.textfield) {
        const fieldname = step.input.textfield
        const fieldvalue = spec.def?.mark ?? `Mark01-${ref}`
        Content(`
		${markdefvar}Name := "${fieldname}"
		${markdefvar}Value := fmt.Sprintf("${fieldvalue}_%d", setup.now)
		${datavar}Up[${markdefvar}Name] = ${markdefvar}Value
`)
      }
    }
  }

  Content(`
		${resdatavar}Result, err := ${entvar}.Update(${datavar}Up, nil)
		if err != nil {
			t.Fatalf("update failed: %v", err)
		}
		${resdatavar} := core.ToMapAny(${resdatavar}Result)
		if ${resdatavar} == nil {
			t.Fatal("expected update result to be a map")
		}
		if ${resdatavar}["id"] != ${datavar}Up["id"] {
			t.Fatal("expected update result id to match")
		}
`)

  // Assert TextFieldMark
  if (step.spec) {
    for (const spec of step.spec) {
      if ('TextFieldMark' === spec.apply && null != step.input?.textfield) {
        Content(`		if ${resdatavar}[${markdefvar}Name] != ${markdefvar}Value {
			t.Fatalf("expected %s to be updated, got %v", ${markdefvar}Name, ${resdatavar}[${markdefvar}Name])
		}
`)
      }
    }
  }
}


const generateLoad: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input?.ref ?? entity.name + '_ref01'
  const entvar = goVar(step.input?.entvar ?? ref + '_ent')
  const matchvar = goVar(step.input?.matchvar ?? (ref + '_match' + (step.input?.suffix ?? '')))
  const datavar = goVar(step.input?.datavar ?? (ref + '_data' + (step.input?.suffix ?? '')))
  const srcdatavar = goVar(step.input?.srcdatavar ?? (ref + '_data' + (step.input?.suffix ?? '')))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const hasEntVar = priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  // Check if srcdatavar was declared by a prior create step or preamble
  const flowHasCreate = Object.values(flow.step).some((s: any) => (s as any).op === 'create')
  const preambleRef = entity.name + '_ref01'
  const hasSrcData = (!flowHasCreate && srcdatavar === goVar(preambleRef + '_data')) ||
    priorSteps.some((s: any) => {
      if ('create' === s.op) {
        const priorRef = s.input?.ref ?? entity.name + '_ref01'
        const priorDatvar = goVar(s.input?.datavar ?? (priorRef + '_data' + (s.input?.suffix ?? '')))
        return priorDatvar === srcdatavar
      }
      return false
    })

  Content(`		// LOAD
`)
  if (!hasEntVar) {
    Content(`		${entvar} := client.${entity.Name}(nil)
`)
  }
  if (!hasSrcData) {
    Content(`		${srcdatavar}Raw := vs.Items(core.ToMapAny(vs.GetProp(setup.data, "existing.${entity.name}")))
		var ${srcdatavar} map[string]any
		if len(${srcdatavar}Raw) > 0 {
			${srcdatavar} = core.ToMapAny(${srcdatavar}Raw[0][1])
		}
`)
  }
  Content(`		${matchvar} := map[string]any{
			"id": ${srcdatavar}["id"],
		}
		${datavar}Loaded, err := ${entvar}.Load(${matchvar}, nil)
		if err != nil {
			t.Fatalf("load failed: %v", err)
		}
		${datavar}LoadResult := core.ToMapAny(${datavar}Loaded)
		if ${datavar}LoadResult == nil {
			t.Fatal("expected load result to be a map")
		}
		if ${datavar}LoadResult["id"] != ${srcdatavar}["id"] {
			t.Fatal("expected load result id to match")
		}
`)
}


const generateRemove: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input?.ref ?? entity.name + '_ref01'
  const entvar = goVar(step.input?.entvar ?? ref + '_ent')
  const matchvar = goVar(step.input?.matchvar ?? (ref + '_match' + (step.input?.suffix ?? '')))
  const srcdatavar = goVar(step.input?.srcdatavar ?? (ref + '_data'))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  Content(`		// REMOVE
`)
  if (needsEnt) {
    Content(`		${entvar} := client.${entity.Name}(nil)
`)
  }
  Content(`		${matchvar} := map[string]any{
			"id": ${srcdatavar}["id"],
		}
		_, err = ${entvar}.Remove(${matchvar}, nil)
		if err != nil {
			t.Fatalf("remove failed: %v", err)
		}
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
