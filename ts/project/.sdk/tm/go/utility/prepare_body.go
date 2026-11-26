package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func prepareBodyUtil(ctx *core.Context) any {
	op := ctx.Op

	if op.Input == "data" {
		if isRawRequest(ctx.Point) {
			return rawBody(ctx.Reqdata)
		}
		body := ctx.Utility.TransformRequest(ctx)
		return body
	}

	if fields, ok := vs.GetProp(ctx.Point, "fields").([]any); ok && 0 < len(fields) {
		return matchBody(ctx, fields)
	}

	return nil
}

// A list, load or remove routed to a method with a body sends the match
// fields that body declares, never a path parameter, and never a header,
// cookie or query argument the body does not also declare as a field.
func matchBody(ctx *core.Context, fields []any) map[string]any {
	routed := []any{}
	if pl, ok := vs.GetProp(ctx.Point, "params").([]any); ok {
		routed = append(routed, pl...)
	}
	for _, kind := range []string{"params", "header", "cookie", "query"} {
		al, _ := vs.GetPath(ctx.Point, []any{"args", kind}).([]any)
		for _, ad := range al {
			if "params" == kind || true != vs.GetProp(ad, "field") {
				routed = append(routed, vs.GetProp(ad, "name"))
			}
		}
	}

	body := map[string]any{}
	for _, field := range fields {
		name, _ := field.(string)
		val := vs.GetProp(ctx.Reqmatch, name)
		if val != nil && "" != name && "$action" != name && !containsStr(routed, name) {
			body[name] = val
		}
	}
	return body
}
