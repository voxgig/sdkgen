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
	// wraps this call in try/catch and returns makeError(ctx, err) — but ts's
	// makeError THROWS unless ctrl.throw is false, so that `return` is only
	// ever reached on the non-throwing path. go's makeError cannot throw; it
	// returns the error instead. Handing that back as the `any` this seam
	// returns would make it the request BODY, so makeSpec re-raises it (see
	// the abort there). On the ctrl.throw-false path makeError yields
	// result.Resdata and this returns a real value, as ts does.
	reqdata, terr := vs.Transform(map[string]any{
		"reqdata": ctx.Reqdata,
	}, reqform)

	if terr != nil {
		out, eerr := makeErrorUtil(ctx, terr)
		if eerr != nil {
			// makeError has already recorded the error on ctx.Ctrl.Err and
			// fired PreUnexpected. Hand back the CAUSE rather than its
			// wrapped form: the operation prefixes whatever makeSpec
			// re-raises, and returning the wrapped error doubles the
			// "SDK: op:" prefix.
			return terr
		}
		return out
	}

	return reqdata
}
