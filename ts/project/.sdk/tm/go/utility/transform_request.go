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

	// Transform gained an error return in struct go 0.1.3. The TS reference
	// wraps this call in try/catch and returns makeError(ctx, err), so route
	// it the same way rather than discarding: this seam returns a single
	// value, and an error is a value here exactly as it is for graphql and
	// direct.
	reqdata, terr := vs.Transform(map[string]any{
		"reqdata": ctx.Reqdata,
	}, reqform)

	if terr != nil {
		out, eerr := makeErrorUtil(ctx, terr)
		if eerr != nil {
			return eerr
		}
		return out
	}

	return reqdata
}
