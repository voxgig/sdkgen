package utility

import (
	"reflect"

	"GOMODULE/core"
)

func doneUtil(ctx *core.Context) (any, error) {
	if ctx.Ctrl.Explain != nil {
		cleanExplain(ctx)
		if explainResult, ok := ctx.Ctrl.Explain["result"]; ok {
			if rm, ok := explainResult.(map[string]any); ok {
				delete(rm, "err")
			}
		}
	}

	if ctx.Result != nil && ctx.Result.Ok {
		return ctx.Result.Resdata, nil
	}

	return makeErrorUtil(ctx, nil)
}

// The explain map IS the caller's (`ctrl["explain"]`), so the cleaned copy
// is written back into it rather than swapped in. With clean off it is the
// same map, which the copy-back would empty.
func cleanExplain(ctx *core.Context) {
	explain := ctx.Ctrl.Explain
	cleaned, ok := cleanUtil(ctx, explain).(map[string]any)
	if !ok || reflect.ValueOf(cleaned).Pointer() == reflect.ValueOf(explain).Pointer() {
		return
	}
	for k := range explain {
		delete(explain, k)
	}
	for k, v := range cleaned {
		explain[k] = v
	}
}
