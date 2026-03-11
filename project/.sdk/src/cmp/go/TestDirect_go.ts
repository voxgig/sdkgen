
import {
  nom,
} from '@voxgig/apidef'


import {
  Content,
  File,
  Folder,
  cmp,
} from '@voxgig/sdkgen'


const TestDirect = cmp(function TestDirect(props: any) {
  const ctx$ = props.ctx$
  const model = ctx$.model
  const stdrep = ctx$.stdrep

  const target = props.target
  const entity = props.entity

  const origin = null == model.origin ? '' : `${model.origin}/`
  const gomodule = `${origin}${model.name}`

  const opnames = Object.keys(entity.op)
  const hasLoad = opnames.includes('load')
  const hasList = opnames.includes('list')

  if (!hasLoad && !hasList) {
    return
  }

  Folder({ name: entity.name }, () => {

    File({ name: entity.name + '_direct_test.' + target.ext }, () => {

      Content(`package ${model.name}_test

import (
	"testing"
	"github.com/stretchr/testify/assert"

	sdk "${gomodule}"
)

`)

      Content(`func directSetup() (*sdk.${model.const.Name}SDK, *[]map[string]any) {
	calls := &[]map[string]any{}

	mockFetch := func(url string, fetchdef map[string]any) (any, error) {
		*calls = append(*calls, map[string]any{"url": url, "fetchdef": fetchdef})
		return map[string]any{
			"status": float64(200),
			"headers": map[string]any{},
			"body": map[string]any{"id": "direct01"},
		}, nil
	}

	client := sdk.New(map[string]any{
		"base": "http://localhost:8080",
		"system": map[string]any{"fetch": mockFetch},
	})

	return client, calls
}

`)

      if (hasLoad) {
        generateDirectLoad(model, entity)
      }

      if (hasList) {
        generateDirectList(model, entity)
      }
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
    ? loadParams.map((p: any, i: number) =>
      `"${p.name}": "direct0${i + 1}"`).join(', ')
    : ''

  Content(`func TestDirect${nom(entity, 'Name')}Load(t *testing.T) {
	client, calls := directSetup()

	result, err := client.Direct(map[string]any{
		"path":   "${loadPath}",
		"method": "GET",
		"params": map[string]any{${paramStr}},
	})

	assert.NoError(t, err)
	assert.NotNil(t, result)

	ok, _ := result["ok"].(bool)
	assert.True(t, ok)

	status, _ := result["status"].(float64)
	assert.Equal(t, float64(200), status)

	data, _ := result["data"].(map[string]any)
	assert.NotNil(t, data)
	assert.Equal(t, "direct01", data["id"])

	assert.Equal(t, 1, len(*calls))
}

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
    ? listParams.map((p: any, i: number) =>
      `"${p.name}": "direct0${i + 1}"`).join(', ')
    : ''

  Content(`func TestDirect${nom(entity, 'Name')}List(t *testing.T) {
	client, calls := directSetup()

	result, err := client.Direct(map[string]any{
		"path":   "${listPath}",
		"method": "GET",
		"params": map[string]any{${paramStr}},
	})

	assert.NoError(t, err)
	assert.NotNil(t, result)

	ok, _ := result["ok"].(bool)
	assert.True(t, ok)

	assert.Equal(t, 1, len(*calls))
}

`)
}


export {
  TestDirect
}
