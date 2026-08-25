package feature

import (
	"strconv"
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

// Cost tracking and spend budget. Uses BOTH seams, which is the point of
// the feature: money is spent per HTTP ATTEMPT (a retried call is charged
// again, because the upstream API charges it again), but it is owed by an
// OPERATION. So the transport wrap prices each attempt, and PreDone
// attributes the running total to `<entity>.<op>` and to the caller
// (`ctrl.actor`, the same actor the audit feature records).
//
// The price of an attempt comes from the first source that answers: a
// response header (`header` x `perUnit`), the rate table (`rates`, keyed
// `<entity>.<op>` / `<op>` / `*`), then the flat `unit`. A body figure
// (`path` x `perUnit`, e.g. "usage.total_tokens") is read at PreDone
// instead, from the already-parsed result, and describes the whole call, so
// it REPLACES the per-attempt estimate rather than adding to it.
//
// `budget` caps total spend. With `onBudget: "deny"` a further operation is
// refused at PrePoint (via ctx.Out["point"], which MakePoint surfaces),
// before an endpoint is resolved and before anything reaches the network.
//
// ORDER MATTERS. Cost must sit INSIDE the cache, or a response served from
// cache is charged for money that was never spent. The default (map) order
// puts cache innermost and cost outside it, so activate them in array form
// with cost first.
type CostFeature struct {
	BaseFeature
	client  *core.ProjectNameSDK
	options map[string]any

	// Aggregates (mirrors the ts client._cost record).
	Currency string
	Total    *CostTotal
	Ops      map[string]*CostBucket
	Actors   map[string]*CostBucket
	Budget   *CostBudget
	Last     map[string]any

	seq int
}

type CostTotal struct {
	Calls     int
	Attempts  int
	Amount    float64
	Reported  float64
	Estimated float64
}

type CostBucket struct {
	Calls  int
	Amount float64
}

type CostBudget struct {
	Limit     float64
	Spent     float64
	Remaining float64
	Exceeded  bool
}

// Per-operation accumulator, carried on ctx.Out between the transport wrap
// and PreDone.
type costPending struct {
	attempts int
	amount   float64
	source   string
}

const costPendingKey = "cost_pending"

func NewCostFeature() *CostFeature {
	return &CostFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "cost",
			Active:  true,
		},
	}
}

func (f *CostFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	limit := foptNum(options, "budget", 0)

	f.Currency = foptStr(options, "currency", "USD")
	f.Total = &CostTotal{}
	f.Ops = map[string]*CostBucket{}
	f.Actors = map[string]*CostBucket{}
	f.Budget = &CostBudget{Limit: limit, Remaining: limit}
	f.seq = 0

	if !f.Active {
		return
	}

	inner := ctx.Utility.Fetcher

	ctx.Utility.Fetcher = func(ctx2 *core.Context, url string, fetchdef map[string]any) (any, error) {
		return f.charge(ctx2, url, fetchdef, inner)
	}
}

// PrePoint is the budget gate. It runs before endpoint resolution, so a
// refused call costs nothing at all.
func (f *CostFeature) PrePoint(ctx *core.Context) {
	if !f.Active {
		return
	}
	limit := f.Budget.Limit
	if limit <= 0 {
		return
	}
	if f.Total.Amount < limit {
		return
	}

	f.Budget.Exceeded = true

	if foptStr(f.options, "onBudget", "warn") != "deny" {
		return
	}

	err := ctx.MakeError("cost_budget",
		"Cost budget of "+fcostNumStr(limit)+" "+f.Currency+" is spent ("+
			fcostNumStr(f.Total.Amount)+" "+f.Currency+" used)")

	// Short-circuit endpoint resolution; MakePoint surfaces this error
	// before any network activity.
	ctx.Out["point"] = err
}

func (f *CostFeature) charge(ctx *core.Context, url string, fetchdef map[string]any,
	inner core.FetcherFunc) (any, error) {

	res, err := inner(ctx, url, fetchdef)

	amount, source := f.price(ctx, res)

	pending, ok := ctx.Out[costPendingKey].(*costPending)
	if !ok || pending == nil {
		pending = &costPending{source: "none"}
		ctx.Out[costPendingKey] = pending
	}

	pending.attempts++

	// Accumulated here, committed once at PreDone. Adding each attempt to
	// the running total and then subtracting it again when a body figure
	// supersedes it loses precision to catastrophic cancellation.
	pending.amount += amount
	pending.source = source

	f.Total.Attempts++

	return res, err
}

// PreDone attributes the operation's spend once the call is finished.
func (f *CostFeature) PreDone(ctx *core.Context) {
	if !f.Active {
		return
	}
	pending, ok := ctx.Out[costPendingKey].(*costPending)
	if !ok || pending == nil {
		return
	}
	delete(ctx.Out, costPendingKey)

	amount := pending.amount
	source := pending.source

	// A body figure prices the whole call, so it replaces the per-attempt
	// estimate rather than adding to it.
	if body, has := f.body(ctx); has {
		amount = body
		source = "body"
	}

	f.spend(amount, source)

	entity := "_"
	opname := "_"
	if ctx.Op != nil {
		entity = ctx.Op.Entity
		opname = ctx.Op.Name
	}

	actor := "anonymous"
	if a := foptStr(f.options, "actor", ""); a != "" {
		actor = a
	}
	if ctx.Ctrl != nil && ctx.Ctrl.Actor != "" {
		actor = ctx.Ctrl.Actor
	}

	f.Total.Calls++
	f.bump(f.Ops, entity+"."+opname, amount)
	f.bump(f.Actors, actor, amount)

	f.seq++
	record := map[string]any{
		"seq":      f.seq,
		"entity":   entity,
		"op":       opname,
		"actor":    actor,
		"amount":   amount,
		"currency": f.Currency,
		"source":   source,
		"attempts": pending.attempts,
	}
	f.Last = record

	if sink, ok := f.options["sink"].(func(map[string]any)); ok {
		sink(record)
	}
}

// price returns the cost of one attempt: a reported header figure, else the
// rate table, else the flat unit.
func (f *CostFeature) price(ctx *core.Context, res any) (float64, string) {
	if header := foptStr(f.options, "header", ""); header != "" {
		if s, ok := fresHeader(res, header); ok {
			if n, err := strconv.ParseFloat(strings.TrimSpace(s), 64); err == nil {
				return n * f.perUnit(), "header"
			}
		}
	}

	if rate, ok := f.rate(ctx); ok {
		return rate, "table"
	}

	if unit := foptNum(f.options, "unit", 0); unit != 0 {
		return unit, "unit"
	}

	return 0, "none"
}

// rate uses the same lookup grammar as rbac's rules: `<entity>.<op>`, then
// `<op>`, then `*`.
func (f *CostFeature) rate(ctx *core.Context) (float64, bool) {
	rates := foptMap(f.options, "rates")
	if rates == nil {
		return 0, false
	}

	entity := ""
	if ctx.Entity != nil {
		entity = ctx.Entity.GetName()
	} else if ctx.Op != nil {
		entity = ctx.Op.Entity
	}
	opname := ""
	if ctx.Op != nil {
		opname = ctx.Op.Name
	}

	for _, key := range []string{entity + "." + opname, opname, "*"} {
		if v, has := rates[key]; has {
			switch n := v.(type) {
			case int:
				return float64(n), true
			case int64:
				return float64(n), true
			case float64:
				return n, true
			case float32:
				return float64(n), true
			}
		}
	}
	return 0, false
}

// body reads a usage figure from the parsed result body, priced by perUnit.
// Read here, not at the transport seam, because the body is one-shot.
func (f *CostFeature) body(ctx *core.Context) (float64, bool) {
	path := foptStr(f.options, "path", "")
	if path == "" || ctx.Result == nil || ctx.Result.Body == nil {
		return 0, false
	}

	switch n := vs.GetPath(path, ctx.Result.Body).(type) {
	case int:
		return float64(n) * f.perUnit(), true
	case int64:
		return float64(n) * f.perUnit(), true
	case float64:
		return n * f.perUnit(), true
	case float32:
		return float64(n) * f.perUnit(), true
	case string:
		if v, err := strconv.ParseFloat(strings.TrimSpace(n), 64); err == nil {
			return v * f.perUnit(), true
		}
	}
	return 0, false
}

func (f *CostFeature) spend(amount float64, source string) {
	f.Total.Amount += amount
	if source == "header" || source == "body" {
		f.Total.Reported += amount
	} else {
		f.Total.Estimated += amount
	}

	limit := f.Budget.Limit
	f.Budget.Spent = f.Total.Amount
	if limit > 0 {
		f.Budget.Remaining = limit - f.Total.Amount
		if f.Budget.Remaining < 0 {
			f.Budget.Remaining = 0
		}
		if f.Total.Amount >= limit {
			f.Budget.Exceeded = true
		}
	} else {
		f.Budget.Remaining = 0
	}
}

func (f *CostFeature) bump(bucket map[string]*CostBucket, key string, amount float64) {
	b := bucket[key]
	if b == nil {
		b = &CostBucket{}
		bucket[key] = b
	}
	b.Calls++
	b.Amount += amount
}

func (f *CostFeature) perUnit() float64 {
	return foptNum(f.options, "perUnit", 0)
}

// fcostNumStr renders a money amount without an exponent or trailing zeros.
func fcostNumStr(n float64) string {
	return strconv.FormatFloat(n, 'f', -1, 64)
}
