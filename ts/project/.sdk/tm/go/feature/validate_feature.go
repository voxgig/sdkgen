package feature

import (
	"sort"
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

// Payload validation against the model's own field types. The go port of
// tm/ts/src/feature/validate/ValidateFeature.ts.
//
// The specs are NOT written here and not written in the model either: every
// entity field already carries a canonical type sentinel (`$STRING`,
// `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
// vocabulary struct.Validate speaks. The generator maps them once
// (helpers/canonSpec) and emits `core.ENTITYSPEC`, so a field whose type
// changes in the API spec changes what this feature enforces with no edit
// anywhere.
//
// WHAT IS CHECKED
//
//	outbound (PreSpec)  the payload the caller asked to send, against
//	                    `spec.op[<opname>]` - the operation's request shape.
//	inbound  (PreDone)  each record the operation returned, against
//	                    `spec.data` - the entity's own field types.
//
// WHAT IS NOT. The model carries no array element types, no nested object
// schemas, no enums, formats or bounds, so this checks the shape the model
// knows and nothing more.
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

	// FAIL CLOSED. Only the exact string "report" selects report mode, so a
	// typo (`mode: "thow"`) still rejects rather than silently turning
	// enforcement off. The option spec rejects the typo outright; this is
	// what happens if it ever does not.
	f.mode = "throw"
	if "report" == foptStr(options, "mode", "throw") {
		f.mode = "report"
	}

	// `strict` is applied ONCE, here, by rebuilding the spec tree without the
	// `$OPEN` markers - rather than per call, which would clone a spec for
	// every request an SDK ever makes.
	f.spec = core.ENTITYSPEC
	if foptBool(options, "strict", false) {
		if closed, ok := validateClose(core.ENTITYSPEC).(map[string]any); ok {
			f.spec = closed
		}
	}
}

// Outbound. MakeSpec short-circuits on a `ctx.Out["spec"]` that is already
// set, so assigning the error here rejects the operation before the request
// is built - the same seam rbac uses one stage earlier.
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

// Inbound. PreDone rather than PreResult: the records are extracted from the
// response body by MakeResult, which runs between the two, so at PreResult
// there is nothing to check but the envelope.
//
// HOOK ORDER MATTERS HERE, and the default order is not the one you want.
// PreDone hooks fire in feature ADD order, which defaults to `test` first and
// then names sorted - and `validate` sorts last, after audit, cost, debug,
// metrics and telemetry. Those observers therefore record the operation as a
// success before this hook has looked at it. Activating features as an
// ORDERED LIST fixes it.
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

	// BOTH, and `Ok` is the load-bearing half: Done returns Resdata whenever
	// Result.Ok is true and never looks at Err, so setting the error alone
	// would hand the caller the very records that failed the spec.
	ctx.Result.Ok = false
	ctx.Result.Err = err

	// AND THE DATA GOES. The load/update paths copy Result.Resdata into the
	// entity's own state on any non-nil value, BEFORE Done raises - so
	// rejecting the operation while leaving the records in place would leave
	// the caller holding an entity populated from a payload this feature had
	// just declared invalid.
	ctx.Result.Resdata = nil
}

// The payload an operation is about to send.
//
// TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
// caller's argument in Reqdata over the entity's Data; a match op
// (load/list/remove) carries it in Reqmatch over Match. That is what the
// entity operations pass to NewContext and what MakePoint reads - so reading
// Reqdata for every op would check a `Load({id})` against the entity's STALE
// stored match and reject it for the id the caller had just supplied.
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

// One Validate call. Errors are COLLECTED, never returned as one: struct
// stops at the first failure unless given an errs collector, and a caller
// fixing a payload wants every problem with it, not the first one.
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

// A RESULT RECORD AS DATA.
//
// MakeResult turns every record of a LIST into an entity instance, so what
// reaches PreDone for a list is wrappers, not records - and a wrapper checked
// against a field spec fails on every required field while its actual data
// goes unchecked. A load returns the record itself, so this handles both.
func validateUnwrap(record any) any {
	if ent, ok := record.(core.Entity); ok && ent != nil {
		if data := ent.Data(); data != nil {
			return data
		}
	}
	return record
}

// The spec tree with every `$OPEN` marker removed, so an undeclared key is an
// error rather than a pass. Rebuilt rather than mutated: core.ENTITYSPEC is a
// package constant shared by every client in the process.
func validateClose(node any) any {
	switch n := node.(type) {
	case []any:
		out := make([]any, 0, len(n))
		for _, item := range n {
			out = append(out, validateClose(item))
		}
		return out

	case map[string]any:
		// Sorted, so a rebuilt spec is byte-stable when it is printed in an
		// error - go map order is randomised per run.
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
