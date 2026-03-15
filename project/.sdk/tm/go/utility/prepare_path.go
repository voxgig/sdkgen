package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func preparePathUtil(ctx *core.Context) string {
	target := ctx.Target

	var parts []any
	if p := vs.GetProp(target, "parts"); p != nil {
		if pl, ok := p.([]any); ok {
			parts = pl
		}
	}

	path := vs.Join(parts, "/", true)
	return path
}
