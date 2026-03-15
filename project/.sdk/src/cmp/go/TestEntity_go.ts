
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

  const steps = basicflow.step || []
  const createStep = steps.find((s: any) => s.op === 'create')
  const updateStep = steps.find((s: any) => s.op === 'update')
  const listSteps = steps.filter((s: any) => s.op === 'list')
  const firstListStep = listSteps[0]
  const lastListStep = listSteps[listSteps.length - 1]

  const ref = createStep?.input?.ref || entity.name + '_ref01'
  // Convert snake_case ref to camelCase for Go variable names
  const refVar = ref.replace(/_([a-z0-9])/g, (_: any, c: string) => c.toUpperCase())
  const ancestors = (entity.relations?.ancestors || []).flat()
  const PROJUPPER = model.const.Name.toUpperCase()
  const textfield = updateStep?.input?.textfield || 'kind'
  const mark = updateStep?.spec?.[0]?.def?.mark || `Mark01-${ref}`

  // Build idmap names: entity's own + ancestor ids
  const idnames: string[] = []
  for (let i = 1; i <= 3; i++) idnames.push(`${entity.name}0${i}`)
  for (const anc of ancestors) {
    for (let i = 1; i <= 3; i++) idnames.push(`${anc}0${i}`)
  }

  // Get match entries from flow steps (filter out $ keys)
  const getMatch = (step: any) => {
    if (!step?.match) return []
    return Object.entries(step.match).filter(([k]: any) => !k.endsWith('$'))
  }

  const createMatch = getMatch(createStep)
  const firstListMatch = getMatch(firstListStep)
  const lastListMatch = getMatch(lastListStep)

  // Get update data entries (non-id, non-$ keys)
  const updateData = updateStep?.data
    ? Object.entries(updateStep.data).filter(([k]: any) => k !== 'id' && !k.endsWith('$'))
    : []

  // Aliases needed from update data entries
  const aliases = updateData.map(([k, v]: any) => [k, v])

  const idnamesStr = idnames.map(n => `"${n}"`).join(', ')

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

		// CREATE
		${entity.name}Ent := client.${entity.Name}(nil)
		${refVar}Data := core.ToMapAny(vs.GetProp(
			vs.GetPath([]any{"new", "${entity.name}"}, setup.data), "${ref}"))
`)

    // Add create match entries
    for (const [key, val] of createMatch) {
      Content(`		${refVar}Data["${key}"] = setup.idmap["${val}"]
`)
    }

    Content(`
		createResult, err := ${entity.name}Ent.Create(${refVar}Data, nil)
		if err != nil {
			t.Fatalf("create failed: %v", err)
		}
		createData := core.ToMapAny(createResult)
		if createData == nil {
			t.Fatal("expected create result to be a map")
		}
		if createData["id"] == nil {
			t.Fatal("expected created entity to have an id")
		}

		// LIST
`)

    // Generate list match map
    if (firstListMatch.length === 0) {
      Content(`		${refVar}Match := map[string]any{}
`)
    } else {
      Content(`		${refVar}Match := map[string]any{
`)
      for (const [key, val] of firstListMatch) {
        Content(`			"${key}": setup.idmap["${val}"],
`)
      }
      Content(`		}
`)
    }

    Content(`		listResult, err := ${entity.name}Ent.List(${refVar}Match, nil)
		if err != nil {
			t.Fatalf("list failed: %v", err)
		}
		listData, ok := listResult.([]any)
		if !ok {
			t.Fatalf("expected list result to be an array, got %T", listResult)
		}

		found := vs.Select(entityListToData(listData), map[string]any{"id": createData["id"]})
		if vs.IsEmpty(found) {
			t.Fatal("expected to find created entity in list")
		}

		// UPDATE
		markValue := fmt.Sprintf("${mark}_%d", setup.now)
		${refVar}DataUp := map[string]any{
			"id":   createData["id"],
`)

    // Add update data entries
    for (const [key] of updateData) {
      Content(`			"${key}": setup.idmap["${key}"],
`)
    }

    Content(`			"${textfield}": markValue,
		}

		updateResult, err := ${entity.name}Ent.Update(${refVar}DataUp, nil)
		if err != nil {
			t.Fatalf("update failed: %v", err)
		}
		updateData := core.ToMapAny(updateResult)
		if updateData == nil {
			t.Fatal("expected update result to be a map")
		}
		if updateData["id"] != createData["id"] {
			t.Fatal("expected update result id to match")
		}
		if updateData["${textfield}"] != markValue {
			t.Fatalf("expected ${textfield} to be updated, got %v", updateData["${textfield}"])
		}

		// LOAD
		${refVar}MatchDt := map[string]any{
			"id": createData["id"],
		}
		loadResult, err := ${entity.name}Ent.Load(${refVar}MatchDt, nil)
		if err != nil {
			t.Fatalf("load failed: %v", err)
		}
		loadData := core.ToMapAny(loadResult)
		if loadData == nil {
			t.Fatal("expected load result to be a map")
		}
		if loadData["id"] != createData["id"] {
			t.Fatal("expected load result id to match")
		}

		// REMOVE
		${refVar}MatchRm := map[string]any{
			"id": createData["id"],
		}
		_, err = ${entity.name}Ent.Remove(${refVar}MatchRm, nil)
		if err != nil {
			t.Fatalf("remove failed: %v", err)
		}

		// LIST (verify removed)
`)

    // Generate verify list match map
    if (lastListMatch.length === 0) {
      Content(`		${refVar}MatchRt := map[string]any{}
`)
    } else {
      Content(`		${refVar}MatchRt := map[string]any{
`)
      for (const [key, val] of lastListMatch) {
        Content(`			"${key}": setup.idmap["${val}"],
`)
      }
      Content(`		}
`)
    }

    Content(`		listResult2, err := ${entity.name}Ent.List(${refVar}MatchRt, nil)
		if err != nil {
			t.Fatalf("list after remove failed: %v", err)
		}
		listData2, ok := listResult2.([]any)
		if !ok {
			t.Fatalf("expected list result to be an array, got %T", listResult2)
		}

		found2 := vs.Select(entityListToData(listData2), map[string]any{"id": createData["id"]})
		if !vs.IsEmpty(found2) {
			t.Fatal("expected removed entity to not be in list")
		}
	})
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
		"${PROJUPPER}_TEST_${entity.name.toUpperCase()}_ENTID": idmap,
		"${PROJUPPER}_TEST_LIVE":      "FALSE",
		"${PROJUPPER}_TEST_EXPLAIN":   "FALSE",
		"${PROJUPPER}_APIKEY":         "NONE",
	})

	idmapResolved := core.ToMapAny(env["${PROJUPPER}_TEST_${entity.name.toUpperCase()}_ENTID"])
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


export {
  TestEntity
}
