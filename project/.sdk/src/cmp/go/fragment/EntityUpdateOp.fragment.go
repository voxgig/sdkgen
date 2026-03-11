package ProjectNamePkg

import (
	"ProjectNameModule/sdk"
)

type entityUpdateOp struct{}

// EJECT-START

// Update updates an existing entity.
func (e *EntityNameEntity) Update(reqdata map[string]any, ctrl ...map[string]any) (any, error) {
	var ctrlMap map[string]any
	if len(ctrl) > 0 {
		ctrlMap = ctrl[0]
	}

	ctx := sdk.MakeContext(map[string]any{
		"opname":  "update",
		"ctrl":    ctrlMap,
		"match":   e.match,
		"data":    e.data,
		"reqdata": reqdata,
	}, e.entctx)

	// #PreSelection-Hook

	target, err := sdk.MakeTarget(ctx)
	if err != nil {
		return sdk.MakeError(ctx, err)
	}
	ctx["out"].(map[string]any)["target"] = target

	// #PreSpec-Hook

	spec, err := sdk.MakeSpec(ctx)
	if err != nil {
		return sdk.MakeError(ctx, err)
	}
	ctx["out"].(map[string]any)["spec"] = spec

	// #PreRequest-Hook

	request, err := sdk.MakeRequest(ctx)
	if err != nil {
		return sdk.MakeError(ctx, err)
	}
	ctx["out"].(map[string]any)["request"] = request

	// #PreResponse-Hook

	response, err := sdk.MakeResponse(ctx)
	if err != nil {
		return sdk.MakeError(ctx, err)
	}
	ctx["out"].(map[string]any)["response"] = response

	// #PreResult-Hook

	result, err := sdk.MakeResult(ctx)
	if err != nil {
		return sdk.MakeError(ctx, err)
	}
	ctx["out"].(map[string]any)["result"] = result

	// #PreDone-Hook

	resultMap, _ := sdk.GetProp(ctx, "result").(map[string]any)
	if resultMap != nil {
		if resmatch := sdk.GetProp(resultMap, "resmatch"); resmatch != nil {
			if rm, ok := resmatch.(map[string]any); ok {
				e.match = rm
			}
		}
		if resdata := sdk.GetProp(resultMap, "resdata"); resdata != nil {
			if rd, ok := resdata.(map[string]any); ok {
				e.data = rd
			}
		}
	}

	return sdk.Done(ctx)
}

// EJECT-END
