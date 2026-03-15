package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func transformRequestUtil(ctx *core.Context) any {
	spec := ctx.Spec
	target := ctx.Target

	if spec != nil {
		spec.Step = "reqform"
	}

	transform := core.ToMapAny(vs.GetProp(target, "transform"))
	if transform == nil {
		return ctx.Reqdata
	}

	reqform := vs.GetProp(transform, "req")
	if reqform == nil {
		return ctx.Reqdata
	}

	reqdata := vs.Transform(map[string]any{
		"reqdata": ctx.Reqdata,
	}, reqform)

	return reqdata
}
