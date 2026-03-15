
import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'


const TestDirect = cmp(function TestDirect(props: any) {
  const ctx$ = props.ctx$
  const model = ctx$.model

  const target = props.target
  const entity = props.entity
  const gomodule = props.gomodule

  const PROJECTNAME = model.Name.toUpperCase()

  const opnames = Object.keys(entity.op)
  const hasLoad = opnames.includes('load')
  const hasList = opnames.includes('list')

  if (!hasLoad && !hasList) {
    return
  }

  const loadOp = entity.op.load
  const listOp = entity.op.list

  // Get load target info
  const loadTarget = loadOp?.targets?.[0]
  const loadPath = loadTarget ? (loadTarget.parts || []).join('/') : ''
  const loadParams = loadTarget?.args?.params || []

  // Get list target info
  const listTarget = listOp?.targets?.[0]
  const listPath = listTarget ? (listTarget.parts || []).join('/') : ''
  const listParams = listTarget?.args?.params || []

  // Build the ENTID env var name for this entity
  const entidEnvVar = `${PROJECTNAME}_TEST_${entity.Name.toUpperCase()}_ENTID`

  File({ name: entity.name + '_direct_test.' + target.ext }, () => {

    Content(`package sdktest

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	sdk "${gomodule}"
	"${gomodule}/core"
)

func Test${entity.Name}Direct(t *testing.T) {
`)

    // Generate list test first (load needs list results in live mode)
    if (hasList && listTarget) {
      const listParamStr = listParams.length > 0
        ? listParams.map((p: any, i: number) =>
          `"${p.name}": "direct0${i + 1}"`).join(', ')
        : ''

      // Build live params for list
      const listLiveParams = listParams.map((p: any) => {
        const key = p.name === 'id'
          ? entity.name + '01'
          : p.name.replace(/_id$/, '') + '01'
        return { name: p.name, key }
      })

      Content(`	t.Run("direct-list-${entity.name}", func(t *testing.T) {
		setup := ${entity.name}DirectSetup([]any{
			map[string]any{"id": "direct01"},
			map[string]any{"id": "direct02"},
		})
		client := setup.client

`)

      if (listParams.length > 0) {
        Content(`		params := map[string]any{}
`)
        for (const lp of listLiveParams) {
          Content(`		if setup.live {
			params["${lp.name}"] = setup.idmap["${lp.key}"]
		} else {
			params["${lp.name}"] = "direct01"
		}
`)
        }
        Content(`
		result, err := client.Direct(map[string]any{
			"path":   "${listPath}",
			"method": "GET",
			"params": params,
		})
`)
      } else {
        Content(`
		result, err := client.Direct(map[string]any{
			"path":   "${listPath}",
			"method": "GET",
			"params": map[string]any{${listParamStr}},
		})
`)
      }

      Content(`		if err != nil {
			t.Fatalf("direct failed: %v", err)
		}

		if result["ok"] != true {
			t.Fatalf("expected ok to be true, got %v", result["ok"])
		}
		if core.ToInt(result["status"]) != 200 {
			t.Fatalf("expected status 200, got %v", result["status"])
		}

		if !setup.live {
			if dataList, ok := result["data"].([]any); ok {
				if len(dataList) != 2 {
					t.Fatalf("expected 2 items, got %d", len(dataList))
				}
			} else {
				t.Fatalf("expected data to be an array, got %T", result["data"])
			}

			if len(*setup.calls) != 1 {
				t.Fatalf("expected 1 call, got %d", len(*setup.calls))
			}
`)

      if (listParams.length > 0) {
        Content(`			call := (*setup.calls)[0]
			if initMap, ok := call["init"].(map[string]any); ok {
				if initMap["method"] != "GET" {
					t.Fatalf("expected method GET, got %v", initMap["method"])
				}
			}
			if url, ok := call["url"].(string); ok {
`)
        for (let i = 0; i < listParams.length; i++) {
          Content(`				if !strings.Contains(url, "direct0${i + 1}") {
					t.Fatalf("expected url to contain direct0${i + 1}, got %v", url)
				}
`)
        }
        Content(`			}
`)
      }

      Content(`		}
	})

`)
    }

    // Generate load test - in live mode, first list to get a real entity ID
    if (hasLoad && loadTarget) {
      const loadParamStr = loadParams.length > 0
        ? loadParams.map((p: any, i: number) =>
          `"${p.name}": "direct0${i + 1}"`).join(', ')
        : ''

      // Identify ancestor params (not 'id') for live mode
      const ancestorParams = loadParams.filter((p: any) => p.name !== 'id')

      Content(`	t.Run("direct-load-${entity.name}", func(t *testing.T) {
		setup := ${entity.name}DirectSetup(map[string]any{"id": "direct01"})
		client := setup.client

`)

      if (loadParams.length > 0) {
        Content(`		params := map[string]any{}
`)

        Content(`		if setup.live {
`)

        // In live mode: first list to get a real entity, then use its ID
        if (hasList) {
          // Build list params from idmap
          Content(`			listParams := map[string]any{}
`)
          for (const p of listParams) {
            const key = p.name === 'id'
              ? entity.name + '01'
              : p.name.replace(/_id$/, '') + '01'
            Content(`			listParams["${p.name}"] = setup.idmap["${key}"]
`)
          }

          Content(`			listResult, listErr := client.Direct(map[string]any{
				"path":   "${listPath}",
				"method": "GET",
				"params": listParams,
			})
			if listErr != nil {
				t.Fatalf("list for load setup failed: %v", listErr)
			}
			if listResult["ok"] != true {
				t.Fatalf("list for load setup not ok: %v", listResult)
			}

			// Get first entity ID from list
			listData, _ := listResult["data"].([]any)
			if len(listData) == 0 {
				t.Skip("no entities to load in live mode")
			}
			firstEnt := core.ToMapAny(listData[0])
			params["id"] = firstEnt["id"]
`)
          // Set ancestor params from idmap
          for (const p of ancestorParams) {
            const key = p.name.replace(/_id$/, '') + '01'
            Content(`			params["${p.name}"] = setup.idmap["${key}"]
`)
          }
        }

        Content(`		} else {
`)
        for (let i = 0; i < loadParams.length; i++) {
          Content(`			params["${loadParams[i].name}"] = "direct0${i + 1}"
`)
        }
        Content(`		}
`)
      }

      Content(`
		result, err := client.Direct(map[string]any{
			"path":   "${loadPath}",
			"method": "GET",
`)
      if (loadParams.length > 0) {
        Content(`			"params": params,
`)
      } else {
        Content(`			"params": map[string]any{},
`)
      }
      Content(`		})
		if err != nil {
			t.Fatalf("direct failed: %v", err)
		}

		if result["ok"] != true {
			t.Fatalf("expected ok to be true, got %v", result["ok"])
		}
		if core.ToInt(result["status"]) != 200 {
			t.Fatalf("expected status 200, got %v", result["status"])
		}
		if result["data"] == nil {
			t.Fatal("expected data to be non-nil")
		}

		if !setup.live {
			if dataMap, ok := result["data"].(map[string]any); ok {
				if dataMap["id"] != "direct01" {
					t.Fatalf("expected data.id to be direct01, got %v", dataMap["id"])
				}
			}

			if len(*setup.calls) != 1 {
				t.Fatalf("expected 1 call, got %d", len(*setup.calls))
			}
			call := (*setup.calls)[0]
			if initMap, ok := call["init"].(map[string]any); ok {
				if initMap["method"] != "GET" {
					t.Fatalf("expected method GET, got %v", initMap["method"])
				}
			}
			if url, ok := call["url"].(string); ok {
`)

      for (let i = 0; i < loadParams.length; i++) {
        Content(`				if !strings.Contains(url, "direct0${i + 1}") {
					t.Fatalf("expected url to contain direct0${i + 1}, got %v", url)
				}
`)
      }

      Content(`			}
		}
	})

`)
    }

    Content(`}

type ${entity.name}DirectSetupResult struct {
	client *sdk.${model.const.Name}SDK
	calls  *[]map[string]any
	live   bool
	idmap  map[string]any
}

func ${entity.name}DirectSetup(mockres any) *${entity.name}DirectSetupResult {
	loadEnvLocal()

	calls := &[]map[string]any{}

	env := envOverride(map[string]any{
		"${entidEnvVar}": map[string]any{},
		"${PROJECTNAME}_TEST_LIVE":    "FALSE",
		"${PROJECTNAME}_APIKEY":       "NONE",
	})

	live := env["${PROJECTNAME}_TEST_LIVE"] == "TRUE"

	if live {
		mergedOpts := map[string]any{
			"apikey": env["${PROJECTNAME}_APIKEY"],
		}
		client := sdk.New${model.const.Name}SDK(mergedOpts)

		idmap := map[string]any{}
		if entidRaw, ok := env["${entidEnvVar}"]; ok {
			if entidStr, ok := entidRaw.(string); ok && strings.HasPrefix(entidStr, "{") {
				json.Unmarshal([]byte(entidStr), &idmap)
			} else if entidMap, ok := entidRaw.(map[string]any); ok {
				idmap = entidMap
			}
		}

		return &${entity.name}DirectSetupResult{client: client, calls: calls, live: true, idmap: idmap}
	}

	mockFetch := func(url string, init map[string]any) (map[string]any, error) {
		*calls = append(*calls, map[string]any{"url": url, "init": init})
		return map[string]any{
			"status":     200,
			"statusText": "OK",
			"headers":    map[string]any{},
			"json": (func() any)(func() any {
				if mockres != nil {
					return mockres
				}
				return map[string]any{"id": "direct01"}
			}),
		}, nil
	}

	client := sdk.New${model.const.Name}SDK(map[string]any{
		"base": "http://localhost:8080",
		"system": map[string]any{
			"fetch": (func(string, map[string]any) (map[string]any, error))(mockFetch),
		},
	})

	return &${entity.name}DirectSetupResult{client: client, calls: calls, live: false, idmap: map[string]any{}}
}
`)

    // Suppress unused import warnings
    Content(`
var _ = os.Getenv
var _ = json.Unmarshal
`)
  })
})


export {
  TestDirect
}
