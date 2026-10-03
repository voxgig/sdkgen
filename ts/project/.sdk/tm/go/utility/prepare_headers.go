package utility

import (
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func prepareHeadersUtil(ctx *core.Context) map[string]any {
	options := ctx.Client.OptionsMap()

	out := map[string]any{}
	if headers := vs.GetProp(options, "headers"); headers != nil {
		if om, ok := vs.Clone(headers).(map[string]any); ok {
			out = om
		}
	}
	out = mediaHeaders(ctx.Point, out)

	// A header argument replaces a default of the same name, whatever its case.
	for _, arg := range callArgs(ctx, "header") {
		if arg.val != nil {
			wire := strings.ToLower(arg.wire)
			for key := range out {
				if strings.ToLower(key) == wire {
					delete(out, key)
				}
			}
			out[wire] = vs.Stringify(arg.val)
		}
	}

	// A cookie argument travels in the cookie header as name=value, after any
	// cookies the caller's headers already send.
	cookies := []string{}
	for _, arg := range callArgs(ctx, "cookie") {
		if arg.val != nil {
			cookies = append(cookies, arg.wire+"="+vs.Stringify(arg.val))
		}
	}
	if 0 < len(cookies) {
		sent := []string{}
		for key, val := range out {
			if strings.ToLower(key) == "cookie" {
				if s, ok := val.(string); ok && "" != s {
					sent = append(sent, s)
				}
				delete(out, key)
			}
		}
		out["cookie"] = strings.Join(append(sent, cookies...), "; ")
	}

	return out
}
