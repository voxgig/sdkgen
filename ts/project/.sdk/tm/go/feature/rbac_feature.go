package feature

import (
	"GOMODULE/core"
	"GOMODULE/utility"
)

type RbacFeature struct {
	BaseFeature
	client  *core.ProjectNameSDK
	options map[string]any
	granted map[string]bool

	// Activity tracking (mirrors the ts client._rbac record).
	Allowed int
	Denied  int
	Last    map[string]any
}

func NewRbacFeature() *RbacFeature {
	return &RbacFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "rbac",
			Active:  true,
		},
	}
}

func (f *RbacFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	f.granted = map[string]bool{}
	for _, p := range foptStrList(f.options, "permissions") {
		f.granted[p] = true
	}
}

func (f *RbacFeature) PrePoint(ctx *core.Context) {
	if !f.Active {
		return
	}

	required, has := f.required(ctx)
	if !has {
		if foptBool(f.options, "deny", false) {
			f.reject(ctx, "<default-deny>")
		}
		return
	}

	if f.granted["*"] || f.granted[required] {
		f.track(ctx, required, true)
		return
	}

	f.reject(ctx, required)
}

func (f *RbacFeature) required(ctx *core.Context) (string, bool) {
	rules := foptMap(f.options, "rules")
	if rules == nil {
		return "", false
	}

	for _, key := range utility.OpKeys(ctx) {
		if r, ok := rules[key].(string); ok {
			return r, true
		}
	}
	return "", false
}

func (f *RbacFeature) reject(ctx *core.Context, required string) {
	f.track(ctx, required, false)

	err := ctx.MakeError("rbac_denied",
		"Permission \""+required+"\" required for operation \""+f.opname(ctx)+"\"")

	// Short-circuit endpoint resolution; MakePoint surfaces this error
	// before any network activity.
	ctx.Out["point"] = err
}

func (f *RbacFeature) track(ctx *core.Context, required string, allowed bool) {
	if allowed {
		f.Allowed++
	} else {
		f.Denied++
	}
	opname := ""
	if ctx.Op != nil {
		opname = ctx.Op.Name
	}
	last := map[string]any{
		"required": required,
		"allowed":  allowed,
		"op":       opname,
	}
	if action := utility.OpAction(ctx); "" != action {
		last["action"] = action
	}
	f.Last = fclean(ctx, last)
}

func (f *RbacFeature) opname(ctx *core.Context) string {
	name := "?"
	if ctx.Op != nil {
		name = ctx.Op.Name
	}
	if action := utility.OpAction(ctx); "" != action {
		return name + ":" + action
	}
	return name
}
