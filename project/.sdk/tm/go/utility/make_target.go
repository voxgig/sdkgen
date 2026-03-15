package utility

import (
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func makeTargetUtil(ctx *core.Context) (map[string]any, error) {
	if ctx.Out["target"] != nil {
		if tm, ok := ctx.Out["target"].(map[string]any); ok {
			ctx.Target = tm
			return tm, nil
		}
	}

	op := ctx.Op
	options := ctx.Options

	allowOp, _ := vs.GetPath([]any{"allow", "op"}, options).(string)
	if !strings.Contains(allowOp, op.Name) {
		return nil, ctx.MakeError("target_op_allow",
			"Operation \""+op.Name+
				"\" not allowed by SDK option allow.op value: \""+allowOp+"\"")
	}

	if len(op.Targets) == 1 {
		ctx.Target = op.Targets[0]
	} else {
		var reqselector map[string]any
		var selector map[string]any

		if op.Input == "data" {
			reqselector = ctx.Reqdata
			selector = ctx.Data
		} else {
			reqselector = ctx.Reqmatch
			selector = ctx.Match
		}

		var target map[string]any
		for i := 0; i < len(op.Targets); i++ {
			target = op.Targets[i]
			selectDef := core.ToMapAny(vs.GetProp(target, "select"))
			found := true

			if selector != nil && selectDef != nil {
				if exist := vs.GetProp(selectDef, "exist"); exist != nil {
					if existList, ok := exist.([]any); ok {
						for _, ek := range existList {
							existkey, _ := ek.(string)
							rv := vs.GetProp(reqselector, existkey)
							sv := vs.GetProp(selector, existkey)
							if rv == nil && sv == nil {
								found = false
								break
							}
						}
					}
				}
			}

			if found {
				reqAction := vs.GetProp(reqselector, "$action")
				selectAction := vs.GetProp(selectDef, "$action")
				if reqAction != selectAction {
					found = false
				}
			}

			if found {
				break
			}
		}

		if reqselector != nil {
			reqAction := vs.GetProp(reqselector, "$action")
			if reqAction != nil && target != nil {
				targetSelect := core.ToMapAny(vs.GetProp(target, "select"))
				targetAction := vs.GetProp(targetSelect, "$action")
				if reqAction != targetAction {
					return nil, ctx.MakeError("target_action_invalid",
						"Operation \""+op.Name+
							"\" action \""+vs.Stringify(reqAction)+"\" is not valid.")
				}
			}
		}

		ctx.Target = target
	}

	return ctx.Target, nil
}
