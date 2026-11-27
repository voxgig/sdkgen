package utility

import (
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func prepareBodyUtil(ctx *core.Context) any {
	op := ctx.Op

	if op.Input == "data" {
		if err := liftSources(ctx); err != nil {
			return err
		}
		if isRawRequest(ctx.Point) {
			return rawBody(ctx.Sources)
		}
		body := ctx.Utility.TransformRequest(ctx)
		if _, failed := body.(error); failed {
			return body
		}
		kind, _ := vs.GetPath(ctx.Point, []any{"body", "kind"}).(string)
		if "form" == kind || "multipart" == kind {
			return encodeBody(ctx, kind, body)
		}
		return body
	}

	if fields, ok := vs.GetProp(ctx.Point, "fields").([]any); ok && 0 < len(fields) {
		return matchBody(ctx, fields)
	}

	return nil
}

// The encoded body, with its content type replacing any the headers carry:
// a multipart boundary is the encoder's alone to choose.
func encodeBody(ctx *core.Context, kind string, data any) any {
	encode := ctx.Utility.Codec.Form
	if "multipart" == kind {
		encode = ctx.Utility.Codec.Multipart
	}
	if nil == encode {
		return ctx.MakeError("body_codec_missing",
			"This SDK was generated without a "+kind+" encoder.")
	}

	sources := ctx.Sources
	if nil == sources {
		sources = map[string]any{}
	}
	encoded, err := encode(ctx, data, sources)
	if err != nil {
		return err
	}

	if ctx.Spec != nil {
		if nil == ctx.Spec.Headers {
			ctx.Spec.Headers = map[string]any{}
		}
		for key := range ctx.Spec.Headers {
			if "content-type" == strings.ToLower(key) {
				delete(ctx.Spec.Headers, key)
			}
		}
		ctx.Spec.Headers["content-type"] = encoded.Type
	}

	return encoded.Body
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
