package utility

import "GOMODULE/core"

func makeResultUtil(ctx *core.Context) (*core.Result, error) {
	if ctx.Out["result"] != nil {
		if res, ok := ctx.Out["result"].(*core.Result); ok {
			return res, nil
		}
	}

	utility := ctx.Utility
	op := ctx.Op
	spec := ctx.Spec
	result := ctx.Result

	if spec == nil {
		return nil, ctx.MakeError("result_no_spec",
			"Expected context spec property to be defined.")
	}
	if result == nil {
		return nil, ctx.MakeError("result_no_result",
			"Expected context result property to be defined.")
	}

	spec.Step = "result"

	utility.TransformResponse(ctx)

	// Every operation resolves to PLAIN records — load, create, update and
	// list alike. `list` used to be the outlier: it wrapped each record in
	// an entity instance, so the same record came back with a different
	// type, a different key order and an extra marker depending on which
	// call produced it. Any consumer touching both paths had to normalise
	// defensively, and feeding a wrapped record into a host framework's own
	// metadata silently produced wrong entities with no error at all. A
	// missing or empty list still normalises to an empty list.
	if op.Name == "list" {
		resdata := result.Resdata
		result.Resdata = []any{}

		if list, ok := resdata.([]any); ok && len(list) > 0 {
			result.Resdata = list
		}
	}

	if ctx.Ctrl.Explain != nil {
		ctx.Ctrl.Explain["result"] = result
	}

	return result, nil
}
