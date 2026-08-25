# ProjectName SDK cost feature

from __future__ import annotations

from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs

from projectname_sdk.feature.base_feature import ProjectNameBaseFeature


# Cost tracking and spend budget. Uses BOTH seams, which is the point of the
# feature: money is spent per HTTP ATTEMPT (a retried call is charged again,
# because the upstream API charges it again), but it is owed by an
# OPERATION. So the transport wrap prices each attempt, and PreDone
# attributes the running total to `<entity>.<op>` and to the caller
# (`ctrl.actor`, the same actor the audit feature records).
#
# The price of an attempt comes from the first source that answers: a
# response header (`header` x `perUnit`), the rate table (`rates`, keyed
# `<entity>.<op>` / `<op>` / `*`), then the flat `unit`. A body figure
# (`path` x `perUnit`, e.g. "usage.total_tokens") is read at PreDone
# instead, from the already-parsed result, and describes the whole call, so
# it REPLACES the per-attempt estimate rather than adding to it.
#
# `budget` caps total spend. With `onBudget: "deny"` a further operation is
# refused at PrePoint, before an endpoint is resolved and before anything
# reaches the network.
#
# ORDER MATTERS. Cost must sit INSIDE the cache, or a response served from
# cache is charged for money that was never spent. The default (map) order
# puts cache innermost and cost outside it, so activate them in list form
# with cost first.
class ProjectNameCostFeature(ProjectNameBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "cost"
        self.active = True
        self.client = None
        self.options = {}
        self.seq = 0

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}

        if self.options.get("active") is True:
            self.active = True
        else:
            self.active = False

        self.seq = 0
        limit = self._limit()

        client = self.client
        if getattr(client, "_cost", None) is None:
            client._cost = {
                "currency": self.options.get("currency") or "USD",
                "total": {
                    "calls": 0,
                    "attempts": 0,
                    "amount": 0,
                    "reported": 0,
                    "estimated": 0,
                },
                "ops": {},
                "actors": {},
                "budget": {
                    "limit": limit,
                    "spent": 0,
                    "remaining": limit,
                    "exceeded": False,
                },
                "last": None,
            }

        if not self.active:
            return

        utility = ctx.utility
        inner = utility.fetcher

        def cost_fetcher(fctx, fullurl, fetchdef):
            return self._charge(fctx, fullurl, fetchdef, inner)

        utility.fetcher = cost_fetcher

    # The budget gate. Runs before endpoint resolution, so a refused call
    # costs nothing at all.
    def PrePoint(self, ctx):
        if not self.active:
            return
        limit = self._limit()
        if limit <= 0:
            return

        cost = self.client._cost
        if cost["total"]["amount"] < limit:
            return

        cost["budget"]["exceeded"] = True

        if self.options.get("onBudget") != "deny":
            return

        err = ctx.make_error("cost_budget",
            "Cost budget of " + str(limit) + " " + cost["currency"] +
            " is spent (" + str(cost["total"]["amount"]) + " " +
            cost["currency"] + " used)")
        # Short-circuit endpoint resolution; the pipeline surfaces this error.
        ctx.out["point"] = err
        return err

    def _charge(self, ctx, url, fetchdef, inner):
        res, err = inner(ctx, url, fetchdef)

        amount, source = self._price(ctx, res)

        pending = getattr(ctx, "_cost_pending", None)
        if pending is None:
            pending = {"attempts": 0, "amount": 0, "source": "none"}
            ctx._cost_pending = pending

        pending["attempts"] += 1

        # Accumulated here, committed once at PreDone. Adding each attempt to
        # the running total and then subtracting it again when a body figure
        # supersedes it loses precision to catastrophic cancellation.
        pending["amount"] += amount
        pending["source"] = source

        self.client._cost["total"]["attempts"] += 1

        return res, err

    # Attribute the operation's spend once the call is finished.
    def PreDone(self, ctx):
        if not self.active:
            return
        pending = getattr(ctx, "_cost_pending", None)
        if pending is None:
            return
        del ctx._cost_pending

        cost = self.client._cost

        amount = pending["amount"]
        source = pending["source"]

        # A body figure prices the whole call, so it replaces the per-attempt
        # estimate rather than adding to it.
        body = self._body(ctx)
        if body is not None:
            amount = body
            source = "body"

        self._spend(cost, amount, source)

        entity = "_"
        opname = "_"
        if ctx.op is not None:
            entity = ctx.op.entity or "_"
            opname = ctx.op.name or "_"

        actor = getattr(ctx.ctrl, "actor", None) if ctx.ctrl is not None else None
        if actor is None:
            actor = self.options.get("actor")
        if actor is None:
            actor = "anonymous"

        cost["total"]["calls"] += 1
        self._bump(cost["ops"], entity + "." + opname, amount)
        self._bump(cost["actors"], actor, amount)

        self.seq += 1
        record = {
            "seq": self.seq,
            "entity": entity,
            "op": opname,
            "actor": actor,
            "amount": amount,
            "currency": cost["currency"],
            "source": source,
            "attempts": pending["attempts"],
        }
        cost["last"] = record

        sink = self.options.get("sink")
        if callable(sink):
            try:
                sink(record)
            except Exception:
                pass

    # Price one attempt: a reported header figure, else the rate table, else
    # the flat unit.
    def _price(self, ctx, res):
        header = self.options.get("header")
        if isinstance(header, str) and header != "":
            val = self._header(res, header)
            if val is not None:
                return val * self._per_unit(), "header"

        rate = self._rate(ctx)
        if rate is not None:
            return rate, "table"

        unit = self.options.get("unit")
        if isinstance(unit, (int, float)) and not isinstance(unit, bool) and unit != 0:
            return unit, "unit"

        return 0, "none"

    # The rate table uses the same lookup grammar as rbac's rules:
    # `<entity>.<op>`, then `<op>`, then `*`.
    def _rate(self, ctx):
        rates = self.options.get("rates")
        if not isinstance(rates, dict):
            return None

        entity = ""
        if ctx.entity is not None and getattr(ctx.entity, "name", None):
            entity = ctx.entity.name
        elif ctx.op is not None and ctx.op.entity:
            entity = ctx.op.entity
        opname = ctx.op.name if ctx.op is not None and ctx.op.name else ""

        for key in (entity + "." + opname, opname, "*"):
            val = rates.get(key)
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                return val
        return None

    # A usage figure from the parsed result body, priced by perUnit. Read
    # here, not at the transport seam, because the body is one-shot.
    def _body(self, ctx):
        path = self.options.get("path")
        if not isinstance(path, str) or path == "":
            return None
        result = ctx.result
        if result is None or result.body is None:
            return None
        val = vs.getpath(result.body, path)
        num = self._num(val)
        if num is None:
            return None
        return num * self._per_unit()

    def _spend(self, cost, amount, source):
        cost["total"]["amount"] += amount
        if source in ("header", "body"):
            cost["total"]["reported"] += amount
        else:
            cost["total"]["estimated"] += amount

        limit = cost["budget"]["limit"]
        cost["budget"]["spent"] = cost["total"]["amount"]
        if limit > 0:
            cost["budget"]["remaining"] = max(0, limit - cost["total"]["amount"])
            if cost["total"]["amount"] >= limit:
                cost["budget"]["exceeded"] = True
        else:
            cost["budget"]["remaining"] = 0

    def _bump(self, bucket, key, amount):
        entry = bucket.get(key)
        if entry is None:
            entry = {"calls": 0, "amount": 0}
            bucket[key] = entry
        entry["calls"] += 1
        entry["amount"] += amount

    def _header(self, res, name):
        if not isinstance(res, dict):
            return None
        headers = res.get("headers")
        if not isinstance(headers, dict):
            return None
        lower = name.lower()
        for key in headers:
            if str(key).lower() == lower:
                return self._num(headers[key])
        return None

    def _num(self, val):
        if val is None or isinstance(val, bool):
            return None
        if isinstance(val, (int, float)):
            return val
        if isinstance(val, str):
            try:
                return float(val.strip())
            except ValueError:
                return None
        return None

    def _per_unit(self):
        per = self.options.get("perUnit")
        if isinstance(per, (int, float)) and not isinstance(per, bool):
            return per
        return 0

    def _limit(self):
        budget = self.options.get("budget")
        if isinstance(budget, (int, float)) and not isinstance(budget, bool):
            return budget
        return 0
