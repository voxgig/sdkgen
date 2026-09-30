package utility

import "GOMODULE/core"

func makeErrorUtil(ctx *core.Context, err error) (any, error) {
	if ctx == nil {
		ctx = &core.Context{
			Ctrl: &core.Control{},
			Op:   core.NewOperation(map[string]any{}),
		}
	}

	op := ctx.Op
	if op == nil {
		op = core.NewOperation(map[string]any{})
	}
	opname := op.Name
	if opname == "" || opname == "_" {
		opname = "unknown operation"
	}

	result := ctx.Result
	if result == nil {
		result = core.NewResult(map[string]any{})
	}
	result.Ok = false

	if err == nil {
		err = result.Err
	}
	if err == nil {
		err = ctx.MakeError("unknown", "unknown error")
	}

	errmsg := err.Error()
	msg := "ProjectNameSDK: " + opname + ": " + errmsg
	msg = cleanUtil(ctx, msg).(string)

	result.Err = nil

	spec := ctx.Spec

	// The context stays reachable on the error for a debugger; its result and
	// spec are masked copies, so masking them never masks the pipeline's own.
	sdkErr := &core.ProjectNameError{
		IsProjectNameError: true,
		Sdk:                "ProjectName",
		Code:               "",
		Msg:                msg,
		Ctx:                ctx,
		Result:             cleanUtil(ctx, result),
		Spec:               cleanUtil(ctx, spec),
	}
	if se, ok := err.(*core.ProjectNameError); ok {
		sdkErr.Code = cleanUtil(ctx, se.Code).(string)
	}

	if ctx.Ctrl.Explain != nil {
		ctx.Ctrl.Explain["err"] = map[string]any{
			"message": msg,
			"code":    sdkErr.Code,
		}
		// A failure before done() (makeSpec after prepareAuth, say) leaves the
		// explain record raw otherwise; ts reaches done() on every such path.
		cleanExplain(ctx)
	}

	ctx.Ctrl.Err = sdkErr

	// Fire PreUnexpected so observability features (metrics, telemetry, audit,
	// debug) close/record error paths that never reach PreDone (e.g. a PrePoint
	// rbac short-circuit). Fires after ctx.Ctrl.Err is set so hooks can read the
	// error; features guard against double-recording when PreDone already fired.
	if ctx.Utility != nil && ctx.Utility.FeatureHook != nil {
		ctx.Utility.FeatureHook(ctx, "PreUnexpected")
	}

	if ctx.Ctrl.Throw != nil && *ctx.Ctrl.Throw == false {
		return result.Resdata, nil
	}

	return nil, sdkErr
}
