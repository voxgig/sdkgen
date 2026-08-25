package JAVAPACKAGE.feature;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.SdkClient;
import JAVAPACKAGE.core.Utility;
import JAVAPACKAGE.utility.struct.Struct;

// Cost tracking and spend budget. Uses BOTH seams, which is the point of
// the feature: money is spent per HTTP ATTEMPT (a retried call is charged
// again, because the upstream API charges it again), but it is owed by an
// OPERATION. So the transport wrap prices each attempt, and preDone
// attributes the running total to `<entity>.<op>` and to the caller (the
// per-call ctrl actor, the same actor the audit feature records).
//
// The price of an attempt comes from the first source that answers: a
// response header (`header` x `perUnit`), the rate table (`rates`, keyed
// `<entity>.<op>` / `<op>` / `*`), then the flat `unit`. A body figure
// (`path` x `perUnit`, e.g. "usage.total_tokens") is read at preDone
// instead, from the already-parsed result, and describes the whole call, so
// it REPLACES the per-attempt estimate rather than adding to it.
//
// `budget` caps total spend. With `onBudget: "deny"` a further operation is
// refused at prePoint (via ctx.out["point"], which makePoint surfaces),
// before an endpoint is resolved and before anything reaches the network.
//
// ORDER MATTERS. Cost must sit INSIDE the cache, or a response served from
// cache is charged for money that was never spent. The default (map) order
// puts cache innermost and cost outside it, so activate them in list form
// with cost first.
public class CostFeature extends BaseFeature {

  private SdkClient client;
  private Map<String, Object> options;
  private int seq = 0;

  // Aggregates (mirrors the ts client._cost record).
  public String currency = "USD";
  public CostTotal total = new CostTotal();
  public Map<String, CostBucket> ops = new LinkedHashMap<>();
  public Map<String, CostBucket> actors = new LinkedHashMap<>();
  public CostBudget budget = new CostBudget();
  public Map<String, Object> last = null;

  public static class CostTotal {
    public int calls = 0;
    public int attempts = 0;
    public double amount = 0.0;
    public double reported = 0.0;
    public double estimated = 0.0;
  }

  public static class CostBucket {
    public int calls = 0;
    public double amount = 0.0;
  }

  public static class CostBudget {
    public double limit = 0.0;
    public double spent = 0.0;
    public double remaining = 0.0;
    public boolean exceeded = false;
  }

  // Per-operation accumulator, carried on ctx.out between the transport wrap
  // and preDone.
  private static class CostPending {
    int attempts = 0;
    double amount = 0.0;
    String source = "none";
  }

  private static final String COST_PENDING_KEY = "cost_pending";

  public CostFeature() {
    super("cost", "0.0.1", true);
  }

  @Override
  public void init(Context ctx, Map<String, Object> options) {
    this.client = ctx.client;
    this.options = options;
    this.active = FeatureOptions.foptBool(options, "active", false);
    this.seq = 0;

    double limit = FeatureOptions.foptNum(options, "budget", 0.0);

    this.currency = FeatureOptions.foptStr(options, "currency", "USD");
    this.total = new CostTotal();
    this.ops = new LinkedHashMap<>();
    this.actors = new LinkedHashMap<>();
    this.budget = new CostBudget();
    this.budget.limit = limit;
    this.budget.remaining = limit;
    this.last = null;

    if (!this.active) {
      return;
    }

    final Utility.FetcherFn inner = ctx.utility.fetcher;

    ctx.utility.fetcher = (ctx2, url, fetchdef) -> charge(ctx2, url, fetchdef, inner);
  }

  // The budget gate. Runs before endpoint resolution, so a refused call
  // costs nothing at all.
  @Override
  public void prePoint(Context ctx) {
    if (!this.active) {
      return;
    }
    double limit = this.budget.limit;
    if (limit <= 0.0 || this.total.amount < limit) {
      return;
    }

    this.budget.exceeded = true;

    if (!"deny".equals(FeatureOptions.foptStr(this.options, "onBudget", "warn"))) {
      return;
    }

    RuntimeException err = ctx.makeError("cost_budget",
        "Cost budget of " + numstr(limit) + " " + this.currency + " is spent ("
            + numstr(this.total.amount) + " " + this.currency + " used)");

    // Short-circuit endpoint resolution; makePoint surfaces this error
    // before any network activity.
    ctx.out.put("point", err);
  }

  private Object charge(Context ctx, String url, Map<String, Object> fetchdef,
      Utility.FetcherFn inner) {

    Object res = inner.fetch(ctx, url, fetchdef);

    double[] priced = new double[1];
    String source = price(ctx, res, priced);

    Object raw = ctx.out.get(COST_PENDING_KEY);
    CostPending pending = (raw instanceof CostPending) ? (CostPending) raw : new CostPending();
    ctx.out.put(COST_PENDING_KEY, pending);

    pending.attempts++;

    // Accumulated here, committed once at preDone. Adding each attempt to
    // the running total and then subtracting it again when a body figure
    // supersedes it loses precision to catastrophic cancellation.
    pending.amount += priced[0];
    pending.source = source;

    this.total.attempts++;

    return res;
  }

  // Attribute the operation's spend once the call is finished.
  @Override
  @SuppressWarnings("unchecked")
  public void preDone(Context ctx) {
    if (!this.active) {
      return;
    }
    Object raw = ctx.out.get(COST_PENDING_KEY);
    if (!(raw instanceof CostPending)) {
      return;
    }
    ctx.out.remove(COST_PENDING_KEY);
    CostPending pending = (CostPending) raw;

    double amount = pending.amount;
    String source = pending.source;

    // A body figure prices the whole call, so it replaces the per-attempt
    // estimate rather than adding to it.
    Double body = bodyAmount(ctx);
    if (body != null) {
      amount = body;
      source = "body";
    }

    spend(amount, source);

    String entity = (ctx.op != null && ctx.op.entity != null && !"".equals(ctx.op.entity))
        ? ctx.op.entity : "_";
    String opname = (ctx.op != null && ctx.op.name != null && !"".equals(ctx.op.name))
        ? ctx.op.name : "_";

    String actor = "anonymous";
    String optActor = FeatureOptions.foptStr(this.options, "actor", "");
    if (!"".equals(optActor)) {
      actor = optActor;
    }
    if (ctx.ctrl != null && ctx.ctrl.actor != null && !"".equals(ctx.ctrl.actor)) {
      actor = ctx.ctrl.actor;
    }

    this.total.calls++;
    bump(this.ops, entity + "." + opname, amount);
    bump(this.actors, actor, amount);

    this.seq++;
    Map<String, Object> record = new LinkedHashMap<>();
    record.put("seq", this.seq);
    record.put("entity", entity);
    record.put("op", opname);
    record.put("actor", actor);
    record.put("amount", amount);
    record.put("currency", this.currency);
    record.put("source", source);
    record.put("attempts", pending.attempts);
    this.last = record;

    if (this.options.get("sink") instanceof Consumer) {
      ((Consumer<Map<String, Object>>) this.options.get("sink")).accept(record);
    }
  }

  // Price one attempt: a reported header figure, else the rate table, else
  // the flat unit. The amount is returned through `out[0]`, the source by
  // return value.
  private String price(Context ctx, Object res, double[] out) {
    String header = FeatureOptions.foptStr(this.options, "header", "");
    if (!"".equals(header)) {
      String raw = FeatureOptions.fresHeader(res, header);
      Double n = num(raw);
      if (n != null) {
        out[0] = n * perUnit();
        return "header";
      }
    }

    Double rate = rate(ctx);
    if (rate != null) {
      out[0] = rate;
      return "table";
    }

    double unit = FeatureOptions.foptNum(this.options, "unit", 0.0);
    if (0.0 != unit) {
      out[0] = unit;
      return "unit";
    }

    out[0] = 0.0;
    return "none";
  }

  // The rate table uses the same lookup grammar as rbac's rules:
  // `<entity>.<op>`, then `<op>`, then `*`.
  private Double rate(Context ctx) {
    Map<String, Object> rates = FeatureOptions.foptMap(this.options, "rates");
    if (rates == null || rates.isEmpty()) {
      return null;
    }

    String entity = "";
    if (ctx.entity != null) {
      entity = ctx.entity.getName();
    } else if (ctx.op != null && ctx.op.entity != null) {
      entity = ctx.op.entity;
    }
    String opname = (ctx.op != null && ctx.op.name != null) ? ctx.op.name : "";

    for (String key : new String[] { entity + "." + opname, opname, "*" }) {
      Object val = rates.get(key);
      if (val instanceof Number) {
        return ((Number) val).doubleValue();
      }
    }
    return null;
  }

  // A usage figure from the parsed result body, priced by perUnit. Read
  // here, not at the transport seam, because the body is one-shot.
  private Double bodyAmount(Context ctx) {
    String path = FeatureOptions.foptStr(this.options, "path", "");
    if ("".equals(path) || ctx.result == null || ctx.result.body == null) {
      return null;
    }
    List<Object> segs = Arrays.asList((Object[]) path.split("\\."));
    Object val = Struct.getpath(ctx.result.body, segs);
    Double n = (val instanceof Number) ? ((Number) val).doubleValue() : num(val);
    if (n == null) {
      return null;
    }
    return n * perUnit();
  }

  private void spend(double amount, String source) {
    this.total.amount += amount;
    if ("header".equals(source) || "body".equals(source)) {
      this.total.reported += amount;
    } else {
      this.total.estimated += amount;
    }

    double limit = this.budget.limit;
    this.budget.spent = this.total.amount;
    if (limit > 0.0) {
      this.budget.remaining = Math.max(0.0, limit - this.total.amount);
      if (this.total.amount >= limit) {
        this.budget.exceeded = true;
      }
    } else {
      this.budget.remaining = 0.0;
    }
  }

  private void bump(Map<String, CostBucket> bucket, String key, double amount) {
    CostBucket entry = bucket.get(key);
    if (entry == null) {
      entry = new CostBucket();
      bucket.put(key, entry);
    }
    entry.calls++;
    entry.amount += amount;
  }

  private Double num(Object val) {
    if (val instanceof Number) {
      return ((Number) val).doubleValue();
    }
    if (val instanceof String) {
      try {
        return Double.parseDouble(((String) val).trim());
      } catch (NumberFormatException e) {
        return null;
      }
    }
    return null;
  }

  private double perUnit() {
    return FeatureOptions.foptNum(this.options, "perUnit", 0.0);
  }

  // Render a money amount without an exponent or trailing zeros.
  private String numstr(double n) {
    String s = String.format("%.10f", n);
    s = s.replaceAll("0+$", "").replaceAll("\\.$", "");
    return "".equals(s) ? "0" : s;
  }
}
