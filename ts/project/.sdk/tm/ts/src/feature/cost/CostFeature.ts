
import type { Context, FeatureOptions } from '../../types'
import type { ProjectNameSDK } from '../../ProjectNameSDK'

import { BaseFeature } from '../base/BaseFeature'


// Cost tracking and spend budget. Uses BOTH seams, which is the point of
// the feature: money is spent per HTTP ATTEMPT (a retried call is charged
// again, because the upstream API charges it again), but it is owed by an
// OPERATION. So the transport wrap prices each attempt, and PreDone
// attributes the running total to `<entity>.<op>` and to the caller
// (`ctrl.actor`, the same actor the audit feature records).
//
// The price of an attempt comes from the first source that answers:
// a response header (`header` x `perUnit`), the rate table (`rates`, keyed
// '<entity>.<op>' / '<op>' / '*'), then the flat `unit`. A body figure
// (`path` x `perUnit`, e.g. 'usage.total_tokens') is read at PreDone
// instead, from the already-parsed result: the response body is a one-shot
// stream, and consuming it at the transport seam would leave the pipeline
// with nothing. A body figure describes the whole call, so it REPLACES the
// per-attempt estimate rather than adding to it.
//
// `budget` caps total spend. With `onBudget: 'deny'` a further operation is
// refused at PrePoint, before an endpoint is resolved and before anything
// reaches the network.
//
// ORDER MATTERS. Cost must sit INSIDE the cache, or a response served from
// cache is charged for money that was never spent. The default (map) order
// puts cache innermost and cost outside it, so activate them in array form
// with cost first: [{ name: 'cost' }, { name: 'cache' }].
class CostFeature extends BaseFeature {
  version = '0.0.1'
  name = 'cost'
  active = true

  _client?: ProjectNameSDK
  _options: any = {}
  _pending: WeakMap<object, any> = new WeakMap()
  _seq = 0


  init(ctx: Context, options: FeatureOptions): void | Promise<any> {
    this._client = ctx.client
    this._options = options || {}
    this.active = (options as any).active
    this._pending = new WeakMap()
    this._seq = 0

    const limit = this._limit()
    const client: any = this._client
    if (null == client._cost) {
      client._cost = {
        currency: this._options.currency || 'USD',
        total: { calls: 0, attempts: 0, amount: 0, reported: 0, estimated: 0 },
        ops: {},
        actors: {},
        budget: { limit, spent: 0, remaining: limit, exceeded: false },
        last: undefined,
      }
    }

    if (!this.active) {
      return
    }

    const self = this
    const utility = ctx.utility
    const inner = utility.fetcher

    utility.fetcher = async function (ctx2: any, url: string, fetchdef: any) {
      return self._charge(ctx2, url, fetchdef, inner)
    }
  }


  // Budget gate. Runs before endpoint resolution, so a refused call costs
  // nothing at all.
  PrePoint(this: any, ctx: any) {
    if (!this.active) {
      return
    }
    const limit = this._limit()
    if (0 >= limit) {
      return
    }

    const client: any = this._client
    const cost = client._cost
    if (cost.total.amount < limit) {
      return
    }

    cost.budget.exceeded = true

    if ('deny' !== this._options.onBudget) {
      return
    }

    const err = ctx.error('cost_budget',
      'Cost budget of ' + limit + ' ' + cost.currency + ' is spent (' +
      cost.total.amount + ' ' + cost.currency + ' used)')
    // Short-circuit endpoint resolution; the pipeline surfaces this error.
    ctx.out.point = err
    return err
  }


  async _charge(this: any, ctx: any, url: string, fetchdef: any, inner: any): Promise<any> {
    const res = await inner(ctx, url, fetchdef)

    const priced = this._price(ctx, res)
    const client: any = this._client
    const cost = client._cost

    let pending = this._pending.get(ctx)
    if (null == pending) {
      pending = { attempts: 0, amount: 0, source: 'none' }
      this._pending.set(ctx, pending)
    }

    pending.attempts++

    // Accumulated here, committed once at PreDone. Adding each attempt to
    // the running total and then subtracting it again when a body figure
    // supersedes it loses precision to catastrophic cancellation
    // (5 + (0.01 - 5) is not 0.01 in binary floating point).
    pending.amount += priced.amount
    pending.source = priced.source

    cost.total.attempts++

    return res
  }


  // Attribute the operation's spend once the call is finished.
  PreDone(this: any, ctx: any) {
    if (!this.active) {
      return
    }
    const pending = this._pending.get(ctx)
    if (null == pending) {
      return
    }
    this._pending.delete(ctx)

    const client: any = this._client
    const cost = client._cost

    // A body figure prices the whole call, so it replaces the per-attempt
    // estimate rather than adding to it.
    const body = this._body(ctx)
    let amount = pending.amount
    let source = pending.source

    if (null != body) {
      amount = body
      source = 'body'
    }

    this._spend(cost, amount, source)

    const entity = (ctx.op && ctx.op.entity) || '_'
    const opname = (ctx.op && ctx.op.name) || '_'
    const actor = (ctx.ctrl && ctx.ctrl.actor) || this._options.actor || 'anonymous'

    cost.total.calls++
    this._bump(cost.ops, entity + '.' + opname, amount)
    this._bump(cost.actors, actor, amount)

    this._seq++
    const record = {
      seq: this._seq,
      entity,
      op: opname,
      actor,
      amount,
      currency: cost.currency,
      source,
      attempts: pending.attempts,
    }
    cost.last = record

    const sink = this._options.sink
    if ('function' === typeof sink) {
      try { sink(record) } catch (_e) { }
    }
  }


  // Price one attempt: a reported header figure, else the rate table, else
  // the flat unit.
  _price(this: any, ctx: any, res: any): any {
    const header = this._options.header
    if ('string' === typeof header && '' !== header) {
      const v = this._header(res, header)
      if (null != v) {
        return { amount: v * this._perUnit(), source: 'header' }
      }
    }

    const rate = this._rate(ctx)
    if (null != rate) {
      return { amount: rate, source: 'table' }
    }

    const unit = this._options.unit
    if ('number' === typeof unit && 0 !== unit) {
      return { amount: unit, source: 'unit' }
    }

    return { amount: 0, source: 'none' }
  }


  // The rate table uses the same lookup grammar as rbac's rules:
  // '<entity>.<op>', then '<op>', then '*'.
  _rate(this: any, ctx: any): number | null {
    const rates = this._options.rates || {}
    const entity = (ctx.entity && ctx.entity.name) || (ctx.op && ctx.op.entity) || ''
    const opname = (ctx.op && ctx.op.name) || ''

    if ('number' === typeof rates[entity + '.' + opname]) {
      return rates[entity + '.' + opname]
    }
    if ('number' === typeof rates[opname]) {
      return rates[opname]
    }
    if ('number' === typeof rates['*']) {
      return rates['*']
    }
    return null
  }


  // A usage figure from the parsed result body, priced by perUnit. Read
  // here, not at the transport seam, because the body is one-shot.
  _body(this: any, ctx: any): number | null {
    const path = this._options.path
    if ('string' !== typeof path || '' === path) {
      return null
    }
    const result = ctx.result
    if (null == result || null == result.body || 'object' !== typeof result.body) {
      return null
    }
    const v = ctx.utility.struct.getpath(result.body, path)
    const n = Number(v)
    if (null == v || isNaN(n)) {
      return null
    }
    return n * this._perUnit()
  }


  _spend(this: any, cost: any, amount: number, source: string) {
    cost.total.amount += amount
    cost.total[('header' === source || 'body' === source) ? 'reported' : 'estimated'] += amount

    const limit = cost.budget.limit
    cost.budget.spent = cost.total.amount
    cost.budget.remaining = 0 < limit ? Math.max(0, limit - cost.total.amount) : 0
    if (0 < limit && cost.total.amount >= limit) {
      cost.budget.exceeded = true
    }
  }


  _bump(this: any, bucket: any, key: string, amount: number) {
    let b = bucket[key]
    if (null == b) {
      b = bucket[key] = { calls: 0, amount: 0 }
    }
    b.calls++
    b.amount += amount
  }


  _header(this: any, res: any, name: string): number | null {
    if (null == res || null == res.headers) {
      return null
    }
    let v: any
    if ('function' === typeof res.headers.get) {
      v = res.headers.get(name.toLowerCase())
    }
    else {
      v = res.headers[name.toLowerCase()]
    }
    if (null == v) {
      return null
    }
    const n = Number(v)
    return isNaN(n) ? null : n
  }


  _perUnit(this: any): number {
    const p = this._options.perUnit
    return 'number' === typeof p ? p : 0
  }


  _limit(this: any): number {
    const b = this._options.budget
    return 'number' === typeof b ? b : 0
  }
}


export {
  CostFeature
}
