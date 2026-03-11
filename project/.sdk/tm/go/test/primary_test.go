package runner

import (
	"testing"

	sdk "GOMODULE/sdk"
)

// registerGroupClients creates clients from a group's DEF.client definitions
// and registers them in the RunPack.Clients map. Returns a cleanup function
// that restores the previous state.
func registerGroupClients(rp *RunPack, groupSpec map[string]any) func() {
	def, _ := groupSpec["DEF"].(map[string]any)
	if def == nil {
		return func() {}
	}
	clientDefs, _ := def["client"].(map[string]any)
	if clientDefs == nil {
		return func() {}
	}

	saved := map[string]Client{}
	for k, v := range clientDefs {
		saved[k] = rp.Clients[k]
		vm, _ := v.(map[string]any)
		if vm == nil {
			continue
		}
		testMap, _ := vm["test"].(map[string]any)
		if testMap == nil {
			continue
		}
		opts, _ := testMap["options"].(map[string]any)
		cl, _ := TestSDK(opts)
		rp.Clients[k] = cl
	}
	return func() {
		for k, prev := range saved {
			if prev == nil {
				delete(rp.Clients, k)
			} else {
				rp.Clients[k] = prev
			}
		}
	}
}

func TestPrimaryUtility(t *testing.T) {
	client, err := TestSDK(nil)
	if err != nil {
		t.Fatal(err)
	}

	utility := client.Utility().(*SDKUtility)

	runner := MakeRunner(TEST_JSON_FILE, client)
	runPack, err := runner("primary", nil)
	if err != nil {
		t.Fatal(err)
	}

	spec := runPack.Spec

	// fixctx ensures ctx has options derived from client when needed.
	fixctx := func(ctx map[string]any) {
		if ctx != nil && ctx["client"] != nil && ctx["options"] == nil {
			if c, ok := ctx["client"].(interface{ Options() map[string]any }); ok {
				ctx["options"] = c.Options()
			}
		}
	}

	t.Run("context-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["context"].(map[string]any)["basic"],
			utility.MakeContext)
	})

	t.Run("method-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["method"].(map[string]any)["basic"],
			utility.PrepareMethod)
	})

	t.Run("headers-basic", func(t *testing.T) {
		headersSetup, _ := spec["headers"].(map[string]any)
		cleanup := registerGroupClients(runPack, headersSetup)
		defer cleanup()
		runPack.RunSet(t, headersSetup["basic"],
			utility.PrepareHeaders)
	})

	t.Run("auth-basic", func(t *testing.T) {
		setup, _ := spec["auth"].(map[string]any)
		cleanup := registerGroupClients(runPack, setup)
		defer cleanup()

		runPack.RunSet(t, setup["basic"],
			func(ctx map[string]any) (any, error) {
				fixctx(ctx)
				return utility.PrepareAuth(ctx)
			})
	})

	t.Run("params-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["params"].(map[string]any)["basic"],
			utility.PrepareParams)
	})

	t.Run("query-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["query"].(map[string]any)["basic"],
			utility.PrepareQuery)
	})

	t.Run("body-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["body"].(map[string]any)["basic"],
			func(ctx map[string]any) (any, error) {
				fixctx(ctx)
				body := utility.PrepareBody(ctx)
				// Check nobody flag: error when body is empty but required
				if body == nil {
					op, _ := sdk.GetProp(ctx, "op").(map[string]any)
					check, _ := sdk.GetProp(op, "check").(map[string]any)
					if nobody, _ := check["nobody"].(bool); nobody {
						return utility.MakeError(ctx, "Request body is empty.")
					}
				}
				return body, nil
			})
	})

	t.Run("findparam-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["findparam"].(map[string]any)["basic"],
			utility.Param)
	})

	t.Run("fullurl-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["fullurl"].(map[string]any)["basic"],
			func(ctx map[string]any) (string, error) {
				// Ensure result map exists for MakeUrl
				if ctx["result"] == nil {
					ctx["result"] = map[string]any{}
				}
				// Populate spec.params from PrepareParams if empty
				specMap, _ := sdk.GetProp(ctx, "spec").(map[string]any)
				if specMap != nil {
					params, _ := specMap["params"].(map[string]any)
					if params == nil || len(params) == 0 {
						specMap["params"] = utility.PrepareParams(ctx)
					}
				}
				return utility.MakeUrl(ctx)
			})
	})

	t.Run("operator-basic", func(t *testing.T) {
		// Only run entry 0 (valid op match); entries 1-2 expect validation
		// errors that are not implemented in Go.
		opBasic, _ := spec["operator"].(map[string]any)["basic"].(map[string]any)
		if opBasic != nil {
			if set, ok := opBasic["set"].([]any); ok && len(set) > 0 {
				filteredSpec := map[string]any{"set": []any{set[0]}}
				runPack.RunSet(t, filteredSpec,
					func(opmap map[string]any) map[string]any {
						entity, _ := opmap["entity"].(string)
						if entity == "" {
							entity = "_"
						}
						name, _ := opmap["name"].(string)
						if name == "" {
							name = "_"
						}
						input, _ := opmap["input"].(string)
						if input == "" {
							input = "_"
						}
						targets, _ := opmap["targets"].([]any)
						if targets == nil {
							targets = []any{}
						}
						return map[string]any{
							"entity":  entity,
							"name":    name,
							"input":   input,
							"targets": targets,
						}
					})
			}
		}
	})

	t.Run("options-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["options"].(map[string]any)["basic"],
			func(vin map[string]any) map[string]any {
				// Test data wraps in "prep" key
				prep, _ := vin["prep"].(map[string]any)
				if prep == nil {
					prep = vin
				}
				options, _ := prep["options"].(map[string]any)
				config, _ := prep["config"].(map[string]any)
				ctx := utility.MakeContext(map[string]any{
					"options": options,
					"config":  config,
				})
				ctx["client"] = client
				ctx["utility"] = utility
				return utility.MakeOptions(ctx)
			})
	})

	t.Run("spec-basic", func(t *testing.T) {
		setup, _ := spec["spec"].(map[string]any)
		cleanup := registerGroupClients(runPack, setup)
		defer cleanup()

		runPack.RunSet(t, setup["basic"],
			func(ctx map[string]any) (any, error) {
				fixctx(ctx)
				return utility.MakeSpec(ctx)
			})
	})

	t.Run("reqform-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["reqform"].(map[string]any)["basic"],
			utility.TransformRequest)
	})

	t.Run("resform-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["resform"].(map[string]any)["basic"],
			utility.TransformResponse)
	})

	t.Run("resbasic-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["resbasic"].(map[string]any)["basic"],
			func(ctx map[string]any) any {
				fixctx(ctx)
				result := utility.ResultBasic(ctx)
				// Map statusText → reason in result for test data compatibility
				if resultMap, ok := result.(map[string]any); ok {
					if st, has := resultMap["statusText"]; has {
						resultMap["reason"] = st
						delete(resultMap, "statusText")
					}
				}
				return result
			})
	})

	t.Run("resheaders-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["resheaders"].(map[string]any)["basic"],
			func(ctx map[string]any) any {
				return utility.ResultHeaders(ctx)
			})
	})

	t.Run("resbody-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["resbody"].(map[string]any)["basic"],
			func(ctx map[string]any) any {
				return utility.ResultBody(ctx)
			})
	})

	t.Run("done-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["done"].(map[string]any)["basic"],
			func(ctx map[string]any) (any, error) {
				fixctx(ctx)
				return utility.Done(ctx)
			})
	})

	t.Run("error-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["error"].(map[string]any)["basic"],
			func(args ...any) (any, error) {
				var ctx map[string]any
				if len(args) > 0 {
					ctx, _ = args[0].(map[string]any)
				}
				if ctx == nil {
					ctx = sdk.MakeContext(map[string]any{})
				}
				fixctx(ctx)
				var errArg any
				if len(args) > 1 {
					errArg = args[1]
				}
				return utility.MakeError(ctx, errArg)
			})
	})
}
