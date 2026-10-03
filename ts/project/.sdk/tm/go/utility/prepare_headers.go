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

	// A cookie argument travels in the cookie header, form serialized and
	// percent-encoded, replacing a cookie of the same name among those the
	// caller's headers already send.
	sent := []callArg{}
	for _, arg := range callArgs(ctx, "cookie") {
		if arg.val != nil {
			sent = append(sent, arg)
		}
	}
	if 0 < len(sent) {
		names := map[string]bool{}
		for _, arg := range sent {
			names[arg.wire] = true
		}
		kept := []string{}
		for key, val := range out {
			if strings.ToLower(key) != "cookie" {
				continue
			}
			if given, ok := val.(string); ok {
				for _, piece := range strings.Split(given, ";") {
					cookie := strings.TrimSpace(piece)
					if "" != cookie && !names[strings.TrimSpace(strings.SplitN(cookie, "=", 2)[0])] {
						kept = append(kept, cookie)
					}
				}
			}
			delete(out, key)
		}
		for _, arg := range sent {
			if pair := cookiePair(arg.wire, arg.val); "" != pair {
				kept = append(kept, pair)
			}
		}
		if 0 < len(kept) {
			out["cookie"] = strings.Join(kept, "; ")
		}
	}

	return out
}

// The form style of a cookie parameter: a list repeats the name, a map sends
// its own keys, and every value is percent-encoded.
func cookiePair(wire string, val any) string {
	esc := func(v any) string { return vs.EscUrl(vs.Stringify(v)) }
	pairs := []string{}
	switch {
	case vs.IsList(val):
		for _, item := range vs.Items(val) {
			pairs = append(pairs, wire+"="+esc(item[1]))
		}
	case vs.IsMap(val):
		for _, key := range vs.KeysOf(val) {
			pairs = append(pairs, vs.EscUrl(key)+"="+esc(vs.GetProp(val, key)))
		}
	default:
		pairs = append(pairs, wire+"="+esc(val))
	}
	return strings.Join(pairs, "&")
}
