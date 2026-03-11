package runner

import (
	"fmt"
	"strings"
	"testing"

	sdk "GOMODULE/sdk"
)

const TEST_JSON_FILE = "../../.sdk/test/test.json"

func TestStruct(t *testing.T) {
	client, err := TestSDK(nil)
	if err != nil {
		t.Fatal(err)
	}

	runner := MakeRunner(TEST_JSON_FILE, client)
	runPack, err := runner("struct", nil)
	if err != nil {
		t.Fatal(err)
	}

	spec := runPack.Spec
	minor, _ := spec["minor"].(map[string]any)

	// minor tests
	// ===========

	t.Run("minor-isnode", func(t *testing.T) {
		runPack.RunSet(t, minor["isnode"], sdk.IsNode)
	})

	t.Run("minor-ismap", func(t *testing.T) {
		runPack.RunSet(t, minor["ismap"], sdk.IsMap)
	})

	t.Run("minor-islist", func(t *testing.T) {
		runPack.RunSet(t, minor["islist"], sdk.IsList)
	})

	t.Run("minor-iskey", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["iskey"], map[string]bool{"null": false}, sdk.IsKey)
	})

	t.Run("minor-strkey", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["strkey"], map[string]bool{"null": false}, sdk.StrKey)
	})

	t.Run("minor-isempty", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["isempty"], map[string]bool{"null": false}, sdk.IsEmpty)
	})

	t.Run("minor-clone", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["clone"], map[string]bool{"null": false}, sdk.Clone)
	})

	t.Run("minor-items", func(t *testing.T) {
		runPack.RunSet(t, minor["items"], sdk.Items)
	})

	t.Run("minor-keysof", func(t *testing.T) {
		runPack.RunSet(t, minor["keysof"], sdk.KeysOf)
	})

	t.Run("minor-stringify", func(t *testing.T) {
		runPack.RunSet(t, minor["stringify"], func(v any) any {
			m := v.(map[string]any)
			val := m["val"]

			if NULLMARK == val {
				val = "null"
			}

			max, hasMax := m["max"]
			if !hasMax || nil == max {
				return sdk.Stringify(val)
			} else {
				return sdk.Stringify(val, int(max.(int)))
			}
		})
	})

	t.Run("minor-getprop", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["getprop"], map[string]bool{"null": false},
			func(vin map[string]any) any {
				val := sdk.GetProp(vin, "val")
				key := sdk.GetProp(vin, "key")
				alt := sdk.GetProp(vin, "alt")
				if alt != nil {
					return sdk.GetProp(val, key, alt)
				}
				return sdk.GetProp(val, key)
			})
	})

	t.Run("minor-setprop", func(t *testing.T) {
		runPack.RunSet(t, minor["setprop"], func(vin map[string]any) any {
			parent := sdk.GetProp(vin, "parent")
			key := sdk.GetProp(vin, "key")
			val := sdk.GetProp(vin, "val")
			return sdk.SetProp(parent, key, val)
		})
	})

	t.Run("minor-delprop", func(t *testing.T) {
		runPack.RunSet(t, minor["delprop"], func(vin map[string]any) any {
			parent := sdk.GetProp(vin, "parent")
			key := sdk.GetProp(vin, "key")
			return sdk.DelProp(parent, key)
		})
	})

	t.Run("minor-haskey", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["haskey"], map[string]bool{"null": false},
			func(vin map[string]any) bool {
				src := sdk.GetProp(vin, "src")
				key := sdk.GetProp(vin, "key")
				return sdk.HasKey(src, key)
			})
	})

	t.Run("minor-join", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["join"], map[string]bool{"null": false}, func(v any) any {
			m := v.(map[string]any)
			val := m["val"]
			sep := m["sep"]
			urlMode := m["url"]
			arr, ok := val.([]any)
			if !ok {
				arr = []any{}
			}
			return sdk.Join(arr, sep, urlMode)
		})
	})

	t.Run("minor-flatten", func(t *testing.T) {
		runPack.RunSet(t, minor["flatten"], func(v any) any {
			m := v.(map[string]any)
			val := m["val"]
			depth := m["depth"]
			if depth == nil {
				return sdk.Flatten(val)
			}
			return sdk.Flatten(val, int(depth.(int)))
		})
	})

	t.Run("minor-escre", func(t *testing.T) {
		runPack.RunSet(t, minor["escre"], sdk.EscRe)
	})

	t.Run("minor-escurl", func(t *testing.T) {
		runPack.RunSet(t, minor["escurl"], func(in string) string {
			return strings.ReplaceAll(sdk.EscUrl(fmt.Sprint(in)), "+", "%20")
		})
	})

	t.Run("minor-typename", func(t *testing.T) {
		runPack.RunSet(t, minor["typename"], sdk.Typename)
	})

	t.Run("minor-typify", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["typify"], map[string]bool{"null": false}, sdk.Typify)
	})

	t.Run("minor-size", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["size"], map[string]bool{"null": false}, sdk.Size)
	})

	t.Run("minor-slice", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["slice"], map[string]bool{"null": false},
			func(vin map[string]any) any {
				val := sdk.GetProp(vin, "val")
				start := sdk.GetProp(vin, "start")
				end := sdk.GetProp(vin, "end")
				return sdk.Slice(val, start, end)
			})
	})

	t.Run("minor-pad", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["pad"], map[string]bool{"null": false},
			func(vin map[string]any) string {
				val := sdk.GetProp(vin, "val")
				pad := sdk.GetProp(vin, "pad")
				char := sdk.GetProp(vin, "char")
				return sdk.Pad(val, pad, char)
			})
	})

	t.Run("minor-setpath", func(t *testing.T) {
		runPack.RunSetFlags(t, minor["setpath"], map[string]bool{"null": false},
			func(vin map[string]any) any {
				store := sdk.GetProp(vin, "store")
				path := sdk.GetProp(vin, "path")
				val := sdk.GetProp(vin, "val")
				return sdk.SetPath(store, path, val)
			})
	})

	// walk tests
	// ==========

	t.Run("walk-basic", func(t *testing.T) {
		walkpath := func(k *string, val any, parent any, path []string) any {
			if str, ok := val.(string); ok {
				return str + "~" + strings.Join(path, ".")
			}
			return val
		}

		runPack.RunSet(t, spec["walk"].(map[string]any)["basic"], func(v any) any {
			if NULLMARK == v {
				v = nil
			}
			return sdk.Walk(v, walkpath)
		})
	})

	// merge tests
	// ===========

	t.Run("merge-cases", func(t *testing.T) {
		runPack.RunSet(t, spec["merge"].(map[string]any)["cases"],
			func(vin any) any {
				return sdk.Merge(vin)
			})
	})

	t.Run("merge-array", func(t *testing.T) {
		runPack.RunSet(t, spec["merge"].(map[string]any)["array"],
			func(vin any) any {
				return sdk.Merge(vin)
			})
	})

	t.Run("merge-integrity", func(t *testing.T) {
		runPack.RunSet(t, spec["merge"].(map[string]any)["integrity"],
			func(vin any) any {
				return sdk.Merge(vin)
			})
	})

	t.Run("merge-depth", func(t *testing.T) {
		runPack.RunSet(t, spec["merge"].(map[string]any)["depth"], func(v any) any {
			m := v.(map[string]any)
			val := m["val"]
			depth := m["depth"]
			if depth == nil {
				return sdk.Merge(val)
			}
			return sdk.Merge(val, int(depth.(int)))
		})
	})

	// getpath tests
	// =============

	t.Run("getpath-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["getpath"].(map[string]any)["basic"],
			func(vin map[string]any) any {
				store := sdk.GetProp(vin, "store")
				path := sdk.GetProp(vin, "path")
				return sdk.GetPath(path, store)
			})
	})

	// inject tests
	// ============

	t.Run("inject-string", func(t *testing.T) {
		runPack.RunSet(t, spec["inject"].(map[string]any)["string"], func(v any) any {
			m := v.(map[string]any)
			val := m["val"]
			store := m["store"]
			current := m["current"]

			return sdk.InjectDescend(val, store, NullModifier, current, nil)
		})
	})

	t.Run("inject-deep", func(t *testing.T) {
		runPack.RunSet(t, spec["inject"].(map[string]any)["deep"],
			func(vin map[string]any) any {
				val := sdk.GetProp(vin, "val")
				store := sdk.GetProp(vin, "store")
				return sdk.Inject(val, store)
			})
	})

	// transform tests
	// ===============

	t.Run("transform-paths", func(t *testing.T) {
		runPack.RunSet(t, spec["transform"].(map[string]any)["paths"],
			func(vin map[string]any) any {
				data := sdk.GetProp(vin, "data")
				tspec := sdk.GetProp(vin, "spec")
				return sdk.Transform(data, tspec)
			})
	})

	t.Run("transform-cmds", func(t *testing.T) {
		runPack.RunSet(t, spec["transform"].(map[string]any)["cmds"],
			func(vin map[string]any) any {
				data := sdk.GetProp(vin, "data")
				tspec := sdk.GetProp(vin, "spec")
				return sdk.Transform(data, tspec)
			})
	})

	t.Run("transform-each", func(t *testing.T) {
		runPack.RunSet(t, spec["transform"].(map[string]any)["each"],
			func(vin map[string]any) any {
				data := sdk.GetProp(vin, "data")
				tspec := sdk.GetProp(vin, "spec")
				return sdk.Transform(data, tspec)
			})
	})

	t.Run("transform-pack", func(t *testing.T) {
		runPack.RunSet(t, spec["transform"].(map[string]any)["pack"],
			func(vin map[string]any) any {
				data := sdk.GetProp(vin, "data")
				tspec := sdk.GetProp(vin, "spec")
				return sdk.Transform(data, tspec)
			})
	})

	t.Run("transform-ref", func(t *testing.T) {
		runPack.RunSet(t, spec["transform"].(map[string]any)["ref"],
			func(vin map[string]any) any {
				data := sdk.GetProp(vin, "data")
				tspec := sdk.GetProp(vin, "spec")
				return sdk.Transform(data, tspec)
			})
	})

	t.Run("transform-format", func(t *testing.T) {
		runPack.RunSetFlags(t, spec["transform"].(map[string]any)["format"],
			map[string]bool{"null": false},
			func(vin map[string]any) any {
				data := sdk.GetProp(vin, "data")
				tspec := sdk.GetProp(vin, "spec")
				return sdk.Transform(data, tspec)
			})
	})

	t.Run("transform-apply", func(t *testing.T) {
		runPack.RunSet(t, spec["transform"].(map[string]any)["apply"],
			func(vin map[string]any) (any, error) {
				data := sdk.GetProp(vin, "data")
				tspec := sdk.GetProp(vin, "spec")
				result, errs := sdk.TransformCollect(data, tspec)
				if len(errs) > 0 {
					return result, fmt.Errorf("%s", errs[0])
				}
				return result, nil
			})
	})

	// validate tests
	// ==============

	t.Run("validate-basic", func(t *testing.T) {
		runPack.RunSetFlags(t, spec["validate"].(map[string]any)["basic"],
			map[string]bool{"null": false},
			func(vin map[string]any) (any, error) {
				data := sdk.GetProp(vin, "data")
				vspec := sdk.GetProp(vin, "spec")
				return sdk.Validate(data, vspec)
			})
	})

	t.Run("validate-child", func(t *testing.T) {
		runPack.RunSet(t, spec["validate"].(map[string]any)["child"],
			func(vin map[string]any) (any, error) {
				data := sdk.GetProp(vin, "data")
				vspec := sdk.GetProp(vin, "spec")
				return sdk.Validate(data, vspec)
			})
	})

	t.Run("validate-one", func(t *testing.T) {
		runPack.RunSet(t, spec["validate"].(map[string]any)["one"],
			func(vin map[string]any) (any, error) {
				data := sdk.GetProp(vin, "data")
				vspec := sdk.GetProp(vin, "spec")
				return sdk.Validate(data, vspec)
			})
	})

	t.Run("validate-exact", func(t *testing.T) {
		runPack.RunSet(t, spec["validate"].(map[string]any)["exact"],
			func(vin map[string]any) (any, error) {
				data := sdk.GetProp(vin, "data")
				vspec := sdk.GetProp(vin, "spec")
				return sdk.Validate(data, vspec)
			})
	})

	t.Run("validate-invalid", func(t *testing.T) {
		runPack.RunSetFlags(t, spec["validate"].(map[string]any)["invalid"],
			map[string]bool{"null": false},
			func(vin map[string]any) (any, error) {
				data := sdk.GetProp(vin, "data")
				vspec := sdk.GetProp(vin, "spec")
				return sdk.Validate(data, vspec)
			})
	})

	// select tests
	// ============

	t.Run("select-basic", func(t *testing.T) {
		runPack.RunSet(t, spec["select"].(map[string]any)["basic"],
			func(vin map[string]any) any {
				obj := sdk.GetProp(vin, "obj")
				query := sdk.GetProp(vin, "query")
				return sdk.Select(obj, query)
			})
	})

	t.Run("select-operators", func(t *testing.T) {
		runPack.RunSet(t, spec["select"].(map[string]any)["operators"],
			func(vin map[string]any) any {
				obj := sdk.GetProp(vin, "obj")
				query := sdk.GetProp(vin, "query")
				return sdk.Select(obj, query)
			})
	})

	t.Run("select-edge", func(t *testing.T) {
		runPack.RunSet(t, spec["select"].(map[string]any)["edge"],
			func(vin map[string]any) any {
				obj := sdk.GetProp(vin, "obj")
				query := sdk.GetProp(vin, "query")
				return sdk.Select(obj, query)
			})
	})

	t.Run("select-alts", func(t *testing.T) {
		runPack.RunSet(t, spec["select"].(map[string]any)["alts"],
			func(vin map[string]any) any {
				obj := sdk.GetProp(vin, "obj")
				query := sdk.GetProp(vin, "query")
				return sdk.Select(obj, query)
			})
	})
}
