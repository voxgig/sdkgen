package utility

import (
	"GOMODULE/core"
)

// OpAction is the custom action a call names: `$action` in its own request
// argument, never in a response. "" when there is none.
func OpAction(ctx *core.Context) string {
	if ctx == nil {
		return ""
	}
	req := ctx.Reqmatch
	if ctx.Op != nil && "data" == ctx.Op.Input {
		req = ctx.Reqdata
	}
	action, _ := req["$action"].(string)
	return action
}

// OpKeys are the keys an operation is looked up and filed by, most specific
// first: `<entity>.<op>:<action>`, `<entity>.<op>`, `<op>`, `*`.
func OpKeys(ctx *core.Context) []string {
	entity := ""
	name := ""
	if ctx != nil && ctx.Op != nil {
		entity = ctx.Op.Entity
		name = ctx.Op.Name
	}
	if "" == name {
		name = "_"
	}
	if "" == entity && ctx != nil && ctx.Entity != nil {
		entity = ctx.Entity.GetName()
	}
	if "" == entity {
		entity = "_"
	}
	base := entity + "." + name
	if action := OpAction(ctx); "" != action {
		return []string{base + ":" + action, base, name, "*"}
	}
	return []string{base, name, "*"}
}

// OpFileKey is the name a call is filed under where a consumer reads it: the
// first key, with the action cleaned.
func OpFileKey(ctx *core.Context) string {
	keys := OpKeys(ctx)
	action := OpAction(ctx)
	if "" == action {
		return keys[0]
	}
	if ctx.Utility != nil && ctx.Utility.Clean != nil {
		if out, ok := ctx.Utility.Clean(ctx, map[string]any{"action": action}).(map[string]any); ok {
			if cleaned, ok := out["action"].(string); ok {
				action = cleaned
			}
		}
	}
	return keys[1] + ":" + action
}
