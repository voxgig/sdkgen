package feature

import (
	"context"
	"fmt"
	"time"

	"GOMODULE/core"
)

// Per-request timeout. Wraps the active transport and races each attempt
// against a context.WithTimeout deadline; if the deadline wins, the request
// resolves to a `timeout` error instead of hanging. The inner transport is
// left to finish in its own goroutine (its result is discarded), matching
// how the ts feature lets the losing racer resolve unobserved.
type TimeoutFeature struct {
	BaseFeature
	client  *core.ProjectNameSDK
	options map[string]any

	// Activity tracking (mirrors the ts client._timeout record).
	Count int
	Ms    int
}

func NewTimeoutFeature() *TimeoutFeature {
	return &TimeoutFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "timeout",
			Active:  true,
		},
	}
}

func (f *TimeoutFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	if !f.Active {
		return
	}

	inner := ctx.Utility.Fetcher

	ctx.Utility.Fetcher = func(ctx2 *core.Context, url string, fetchdef map[string]any) (any, error) {
		return f.withTimeout(ctx2, url, fetchdef, inner)
	}
}

func (f *TimeoutFeature) withTimeout(ctx *core.Context, url string, fetchdef map[string]any,
	inner core.FetcherFunc) (any, error) {

	ms := foptInt(f.options, "ms", 30000)
	if ms <= 0 {
		return inner(ctx, url, fetchdef)
	}

	// A response after the deadline is a timeout, even when the select finds both ready.
	now := foptNow(f.options)
	start := now()
	tctx, cancel := context.WithTimeout(context.Background(), time.Duration(ms)*time.Millisecond)
	defer cancel()

	type fetched struct {
		res     any
		err     error
		arrived int64
	}

	// Buffered so the inner transport never blocks after a timeout loss.
	out := make(chan fetched, 1)
	go func() {
		res, err := inner(ctx, url, fetchdef)
		out <- fetched{res: res, err: err, arrived: now()}
	}()

	select {
	case got := <-out:
		if int64(ms) < got.arrived-start {
			return nil, f.timeout(ctx, ms)
		}
		return got.res, got.err
	case <-tctx.Done():
		return nil, f.timeout(ctx, ms)
	}
}

func (f *TimeoutFeature) timeout(ctx *core.Context, ms int) error {
	f.track(ms)
	return ctx.MakeError("timeout", fmt.Sprintf("Request exceeded timeout of %dms", ms))
}

func (f *TimeoutFeature) track(ms int) {
	f.Count++
	f.Ms = ms
}
