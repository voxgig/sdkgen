package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func transformRequestUtil(ctx *core.Context) any {
	spec := ctx.Spec
	point := ctx.Point

	if spec != nil {
		spec.Step = "reqform"
	}

	transform := core.ToMapAny(vs.GetProp(point, "transform"))
	if transform == nil {
		return ctx.Reqdata
	}

	reqform := vs.GetProp(transform, "req")
	if reqform == nil {
		return ctx.Reqdata
	}

	reqdata, terr := vs.Transform(map[string]any{
		"reqdata": ctx.Reqdata,
	}, reqform)

	if terr != nil {
		if ctx.Ctrl != nil && ctx.Ctrl.Throw != nil && !*ctx.Ctrl.Throw {
			out, _ := makeErrorUtil(ctx, terr)
			return out
		}
		return terr
	}

	return reqdata
}
