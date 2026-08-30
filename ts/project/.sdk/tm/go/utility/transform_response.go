package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func transformResponseUtil(ctx *core.Context) any {
	spec := ctx.Spec
	result := ctx.Result
	point := ctx.Point

	if spec != nil {
		spec.Step = "resform"
	}

	if result == nil || !result.Ok {
		return nil
	}

	transform := core.ToMapAny(vs.GetProp(point, "transform"))
	if transform == nil {
		return nil
	}

	resform := vs.GetProp(transform, "res")
	if resform == nil {
		return nil
	}

	// See transform_request.go: Transform gained an error return in struct
	// go 0.1.3, and the TS reference routes it through makeError.
	resdata, terr := vs.Transform(map[string]any{
		"ok":         result.Ok,
		"status":     result.Status,
		"statusText": result.StatusText,
		"headers":    result.Headers,
		"body":       result.Body,
		"err":        result.Err,
		"resdata":    result.Resdata,
		"resmatch":   result.Resmatch,
	}, resform)

	if terr != nil {
		out, eerr := makeErrorUtil(ctx, terr)
		if eerr != nil {
			return eerr
		}
		return out
	}

	result.Resdata = resdata
	return resdata
}
