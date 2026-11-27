package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func resultBodyUtil(ctx *core.Context) *core.Result {
	response := ctx.Response
	result := ctx.Result

	if result != nil {
		raw := ctx.Utility.Codec.Raw
		if response != nil && "raw" == vs.GetPath(ctx.Point, []any{"response", "kind"}) &&
			raw != nil && result.Err == nil && response.Err == nil && result.Status < 400 {
			if err := raw(ctx); err != nil {
				result.Err = err
			}
			return result
		}
		if response != nil && response.JsonFunc != nil && response.Body != nil {
			json := response.JsonFunc()
			result.Body = json
		}
		if response != nil && response.Unreadable {
			var sent any
			if ctx.Spec != nil {
				sent = ctx.Spec.Headers
			}
			result.Err = core.UnreadableBody(ctx, result.Status, result.Headers, response.Body,
				sent, result.Err)
		}
	}

	return result
}
