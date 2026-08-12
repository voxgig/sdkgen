package utility

import "GOMODULE/core"

func doneUtil(ctx *core.Context) (any, error) {
	if ctx.Ctrl.Explain != nil {
		ctx.Ctrl.Explain = cleanUtil(ctx, ctx.Ctrl.Explain).(map[string]any)
		if explainResult, ok := ctx.Ctrl.Explain["result"]; ok {
			if rm, ok := explainResult.(map[string]any); ok {
				delete(rm, "err")
			}
		}
	}

	// An operation resolves to the ENTITY, not the raw data. Entities are
	// stateful: the op fragment has just absorbed resdata/resmatch into this
	// instance, and the caller reaches the record through .data(). Two
	// structural exceptions: `list` resolves to the ARRAY of entity
	// instances makeResult built, and a context with no entity
	// (direct/prepare, streaming) has nothing to return but the data. A
	// removed entity keeps its data but is no longer live. See AGENTS.md.
	if ctx.Result != nil && ctx.Result.Ok {
		entity := ctx.Entity
		opname := ""
		if ctx.Op != nil {
			opname = ctx.Op.Name
		}

		if entity != nil && opname != "list" {
			if opname == "remove" {
				entity.MarkDeleted()
			}
			return entity, nil
		}

		return ctx.Result.Resdata, nil
	}

	return makeErrorUtil(ctx, nil)
}
