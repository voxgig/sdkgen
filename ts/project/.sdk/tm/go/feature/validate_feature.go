package feature

import (
	"sort"
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

type ValidateFeature struct {
	BaseFeature
	client  *core.ProjectNameSDK
	options map[string]any
	spec    map[string]any

	request  bool
	response bool
	mode     string
}

func NewValidateFeature() *ValidateFeature {
	return &ValidateFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "validate",
			Active:  true,
		},
	}
}

func (f *ValidateFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	// DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
	// `config.options` documents them and types them; it does not inject
	// them, because each feature entry in the spec is optional and struct
	// fills in nothing through an optional union.
	f.request = foptBool(options, "request", true)
	f.response = foptBool(options, "response", false)

	f.mode = "throw"
	if "report" == foptStr(options, "mode", "throw") {
		f.mode = "report"
	}

	f.spec = core.ENTITYSPEC
	if foptBool(options, "strict", false) {
		if closed, ok := validateClose(core.ENTITYSPEC).(map[string]any); ok {
			f.spec = closed
		}
	}
}

func (f *ValidateFeature) PreSpec(ctx *core.Context) {
	if !f.Active || !f.request {
		return
	}

	opname := ""
	if ctx.Op != nil {
		opname = ctx.Op.Name
	}

	opspec := validateOpSpec(f.entitySpec(ctx), opname)
	if opspec == nil {
		return
	}

	errs := f.check(ctx, f.payload(ctx, opname), opspec, "request")
	if 0 == len(errs) || "report" == f.mode {
		return
	}

	ctx.Out["spec"] = ctx.MakeError("validate_failed",
		"Invalid "+opname+" request for entity \""+validateEntName(ctx)+"\": "+
			strings.Join(errs, "; "))
}

func (f *ValidateFeature) PreDone(ctx *core.Context) {
	if !f.Active || !f.response {
		return
	}

	espec := f.entitySpec(ctx)
	if espec == nil {
		return
	}

	dataspec, has := espec["data"]
	if !has || dataspec == nil {
		return
	}

	if ctx.Result == nil || ctx.Result.Resdata == nil {
		return
	}

	// A list op returns many records and a load returns one; both are checked
	// against the same record spec, because they are the same entity.
	records, isList := ctx.Result.Resdata.([]any)
	if !isList {
		records = []any{ctx.Result.Resdata}
	}

	errs := []string{}
	for _, record := range records {
		if record == nil {
			continue
		}

		// A NON-OBJECT IS A FAILURE, not something to skip. A load that
		// answered `42` where the entity's spec wants a record must not pass
		// this feature silently - struct rejects it with the field it could
		// not find.
		errs = append(errs, f.check(ctx, validateUnwrap(record), dataspec, "response")...)
	}

	if 0 == len(errs) || "report" == f.mode {
		return
	}

	err := ctx.MakeError("validate_failed",
		"Invalid response for entity \""+validateEntName(ctx)+"\": "+
			strings.Join(errs, "; "))

	ctx.Result.Ok = false
	ctx.Result.Err = err

	// AND THE DATA GOES. The load/update paths copy Result.Resdata into the
	// entity's own state on any non-nil value, BEFORE Done raises - so
	// rejecting the operation while leaving the records in place would leave
	// the caller holding an entity populated from a payload this feature had
	// just declared invalid.
	ctx.Result.Resdata = nil
}

func (f *ValidateFeature) payload(ctx *core.Context, opname string) map[string]any {
	body := "create" == opname || "update" == opname || "patch" == opname

	base := ctx.Match
	req := ctx.Reqmatch
	if body {
		base = ctx.Data
		req = ctx.Reqdata
	}

	out := map[string]any{}
	for k, v := range base {
		out[k] = v
	}
	for k, v := range req {
		out[k] = v
	}

	// `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
	// MakePoint reads it off this same argument and the request transformer
	// drops it before the body is built, so a spec built from the API's own
	// fields will never name it - and under `strict` every custom-action call
	// would be rejected for the one key that made it reachable.
	delete(out, "$action")

	return out
}

func (f *ValidateFeature) entitySpec(ctx *core.Context) map[string]any {
	if f.spec == nil {
		return nil
	}
	espec, _ := f.spec[validateEntName(ctx)].(map[string]any)
	return espec
}

func (f *ValidateFeature) check(
	ctx *core.Context, data any, spec any, direction string,
) []string {
	collect := vs.ListRefCreate[any]()

	// A spec this port cannot run at all (rather than a payload that fails
	// it) must not take the operation down with it: report it like any other
	// failure and let `mode` decide.
	if _, err := vs.Validate(data, spec, &vs.Injection{Errs: collect}); err != nil &&
		0 == len(collect.List) {
		collect.Append(err.Error())
	}

	errs := []string{}
	for _, e := range collect.List {
		if s, ok := e.(string); ok {
			errs = append(errs, s)
		}
	}

	if 0 < len(errs) {
		if cb, ok := f.options["onInvalid"].(func(map[string]any)); ok {
			cb(map[string]any{
				"entity":    validateEntName(ctx),
				"op":        validateOpName(ctx),
				"direction": direction,
				"errs":      errs,
				"data":      data,
			})
		}
	}

	return errs
}

func validateOpSpec(espec map[string]any, opname string) any {
	if espec == nil {
		return nil
	}
	ops, _ := espec["op"].(map[string]any)
	if ops == nil {
		return nil
	}
	return ops[opname]
}

func validateOpName(ctx *core.Context) string {
	if ctx.Op != nil {
		return ctx.Op.Name
	}
	return ""
}

func validateEntName(ctx *core.Context) string {
	if ctx.Entity != nil {
		if n := ctx.Entity.GetName(); "" != n {
			return n
		}
	}
	if ctx.Op != nil {
		return ctx.Op.Entity
	}
	return ""
}

func validateUnwrap(record any) any {
	if ent, ok := record.(core.Entity); ok && ent != nil {
		if data := ent.Data(); data != nil {
			return data
		}
	}
	return record
}

func validateClose(node any) any {
	switch n := node.(type) {
	case []any:
		out := make([]any, 0, len(n))
		for _, item := range n {
			out = append(out, validateClose(item))
		}
		return out

	case map[string]any:
		keys := make([]string, 0, len(n))
		for k := range n {
			if validateOpenKey != k {
				keys = append(keys, k)
			}
		}
		sort.Strings(keys)

		out := make(map[string]any, len(keys))
		for _, k := range keys {
			out[k] = validateClose(n[k])
		}
		return out
	}

	return node
}

// Built rather than written, so the backticks cannot be lost in an edit.
var validateOpenKey = string(rune(96)) + "$OPEN" + string(rune(96))
