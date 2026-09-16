package JAVAPACKAGE.feature;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Entity;
import JAVAPACKAGE.core.Schema;
import JAVAPACKAGE.core.SdkClient;
import JAVAPACKAGE.utility.struct.Struct;

// Payload validation against the model's own field types. The java port of
// tm/ts/src/feature/validate/ValidateFeature.ts.
//
// The specs are NOT written here and not written in the model either: every
// entity field already carries a canonical type sentinel (`$STRING`,
// `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
// vocabulary Struct.validate speaks. The generator maps them once
// (helpers/canonSpec) and emits Schema.entityspec(), so a field whose type
// changes in the API spec changes what this feature enforces with no edit
// anywhere.
//
// WHAT IS CHECKED
//   outbound (preSpec)  the payload the caller asked to send, against
//                       spec.op[opname] - the operation's request shape.
//   inbound  (preDone)  each record the operation returned, against
//                       spec.data - the entity's own field types.
//
// WHAT IS NOT. The model carries no array element types, no nested object
// schemas, no enums, formats or bounds, so this checks the shape the model
// knows and nothing more.
@SuppressWarnings({"unchecked"})
public class ValidateFeature extends BaseFeature {

  // Built rather than written, so the backticks cannot be lost in an edit.
  private static final String OPEN = ((char) 96) + "$OPEN" + ((char) 96);

  private SdkClient client;
  private Map<String, Object> options = new LinkedHashMap<>();
  private Map<String, Object> spec = new LinkedHashMap<>();

  private boolean request = true;
  private boolean response = false;
  private String mode = "throw";

  public ValidateFeature() {
    super("validate", "0.0.1", true);
  }

  @Override
  public void init(Context ctx, Map<String, Object> options) {
    this.client = ctx.client;
    this.options = options == null ? new LinkedHashMap<>() : options;
    this.active = FeatureOptions.foptBool(this.options, "active", false);

    // DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
    // `config.options` documents them and types them; it does not inject
    // them, because each feature entry in the spec is optional and struct
    // fills in nothing through an optional union.
    this.request = FeatureOptions.foptBool(this.options, "request", true);
    this.response = FeatureOptions.foptBool(this.options, "response", false);

    // FAIL CLOSED. Only the exact string "report" selects report mode, so a
    // typo (`mode: "thow"`) still rejects rather than silently turning
    // enforcement off. The option spec rejects the typo outright; this is
    // what happens if it ever does not.
    this.mode = "report".equals(FeatureOptions.foptStr(this.options, "mode", "throw"))
        ? "report" : "throw";

    // `strict` is applied ONCE, here, by rebuilding the spec tree without the
    // `$OPEN` markers - rather than per call, which would clone a spec for
    // every request an SDK ever makes.
    Map<String, Object> entityspec = Schema.entityspec();
    this.spec = FeatureOptions.foptBool(this.options, "strict", false)
        ? (Map<String, Object>) close(entityspec) : entityspec;
  }

  // Outbound. makeSpec short-circuits on a `ctx.out["spec"]` that is already
  // set, so assigning the error here rejects the operation before the request
  // is built - the same seam rbac uses one stage earlier.
  @Override
  public void preSpec(Context ctx) {
    if (!this.active || !this.request) {
      return;
    }

    String opname = opname(ctx);
    Object opspec = opSpec(entitySpec(ctx), opname);
    if (opspec == null) {
      return;
    }

    List<String> errs = check(ctx, payload(ctx, opname), opspec, "request");
    if (errs.isEmpty() || "report".equals(this.mode)) {
      return;
    }

    ctx.out.put("spec", ctx.makeError("validate_failed",
        "Invalid " + opname + " request for entity \"" + entname(ctx) + "\": "
            + String.join("; ", errs)));
  }

  // Inbound. preDone rather than preResult: the records are extracted from
  // the response body by makeResult, which runs between the two, so at
  // preResult there is nothing to check but the envelope.
  //
  // HOOK ORDER MATTERS HERE, and the default order is not the one you want.
  // preDone hooks fire in feature ADD order, which defaults to `test` first
  // and then names sorted - and `validate` sorts last, after audit, cost,
  // debug, metrics and telemetry. Those observers therefore record the
  // operation as a success before this hook has looked at it. Activating
  // features as an ORDERED LIST fixes it.
  @Override
  public void preDone(Context ctx) {
    if (!this.active || !this.response) {
      return;
    }

    Map<String, Object> espec = entitySpec(ctx);
    if (espec == null) {
      return;
    }

    Object dataspec = espec.get("data");
    if (dataspec == null) {
      return;
    }

    if (ctx.result == null || ctx.result.resdata == null) {
      return;
    }

    // A list op returns many records and a load returns one; both are checked
    // against the same record spec, because they are the same entity.
    List<Object> records = new ArrayList<>();
    if (ctx.result.resdata instanceof List) {
      records.addAll((List<Object>) ctx.result.resdata);
    } else {
      records.add(ctx.result.resdata);
    }

    List<String> errs = new ArrayList<>();
    for (Object record : records) {
      if (record == null) {
        continue;
      }

      // A NON-OBJECT IS A FAILURE, not something to skip. A load that
      // answered 42 where the entity's spec wants a record must not pass this
      // feature silently - struct rejects it with the field it could not find.
      errs.addAll(check(ctx, unwrap(record), dataspec, "response"));
    }

    if (errs.isEmpty() || "report".equals(this.mode)) {
      return;
    }

    RuntimeException err = ctx.makeError("validate_failed",
        "Invalid response for entity \"" + entname(ctx) + "\": "
            + String.join("; ", errs));

    // BOTH, and `ok` is the load-bearing half: done returns resdata whenever
    // result.ok is true and never looks at err, so setting the error alone
    // would hand the caller the very records that failed the spec.
    ctx.result.ok = false;
    ctx.result.err = err;

    // AND THE DATA GOES. The load/update paths copy result.resdata into the
    // entity's own state on any non-null value, BEFORE done raises - so
    // rejecting the operation while leaving the records in place would leave
    // the caller holding an entity populated from a payload this feature had
    // just declared invalid.
    ctx.result.resdata = null;
  }

  // The payload an operation is about to send.
  //
  // TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
  // caller's argument in reqdata over the entity's data; a match op
  // (load/list/remove) carries it in reqmatch over match. That is what the
  // entity operations pass to makeContext and what makePoint reads - so
  // reading reqdata for every op would check a `load({id})` against the
  // entity's STALE stored match and reject it for the id the caller had just
  // supplied.
  private Map<String, Object> payload(Context ctx, String opname) {
    boolean body = "create".equals(opname) || "update".equals(opname)
        || "patch".equals(opname);

    Map<String, Object> base = body ? ctx.data : ctx.match;
    Map<String, Object> req = body ? ctx.reqdata : ctx.reqmatch;

    Map<String, Object> out = new LinkedHashMap<>();
    if (base != null) {
      out.putAll(base);
    }
    if (req != null) {
      out.putAll(req);
    }

    // `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
    // makePoint reads it off this same argument and the request transformer
    // drops it before the body is built, so a spec built from the API's own
    // fields will never name it - and under `strict` every custom-action call
    // would be rejected for the one key that made it reachable.
    out.remove("$action");

    return out;
  }

  private Map<String, Object> entitySpec(Context ctx) {
    if (this.spec == null) {
      return null;
    }
    Object espec = this.spec.get(entname(ctx));
    return espec instanceof Map ? (Map<String, Object>) espec : null;
  }

  private static Object opSpec(Map<String, Object> espec, String opname) {
    if (espec == null) {
      return null;
    }
    Object ops = espec.get("op");
    return ops instanceof Map ? ((Map<String, Object>) ops).get(opname) : null;
  }

  private static String opname(Context ctx) {
    return ctx.op == null || ctx.op.name == null ? "" : ctx.op.name;
  }

  private static String entname(Context ctx) {
    if (ctx.entity != null) {
      String name = ctx.entity.getName();
      if (name != null && !name.isEmpty()) {
        return name;
      }
    }
    if (ctx.op != null && ctx.op.entity != null) {
      return ctx.op.entity;
    }
    return "";
  }

  // One validate call. Errors are COLLECTED, never thrown: struct throws on
  // the first failure unless given an `errs` list, and a caller fixing a
  // payload wants every problem with it, not the first one.
  private List<String> check(Context ctx, Object data, Object spec, String direction) {
    List<Object> collected = new ArrayList<>();
    Map<String, Object> opts = new LinkedHashMap<>();
    opts.put("errs", collected);

    try {
      Struct.validate(data, spec, opts);
    } catch (RuntimeException e) {
      // A spec this port cannot run at all (rather than a payload that fails
      // it) must not take the operation down with it: report it like any
      // other failure and let `mode` decide.
      if (collected.isEmpty()) {
        collected.add(e.getMessage() == null ? e.toString() : e.getMessage());
      }
    }

    List<String> errs = new ArrayList<>();
    for (Object e : collected) {
      errs.add(String.valueOf(e));
    }

    if (!errs.isEmpty()) {
      Object onInvalid = this.options.get("onInvalid");
      if (onInvalid instanceof java.util.function.Consumer) {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("entity", entname(ctx));
        report.put("op", opname(ctx));
        report.put("direction", direction);
        report.put("errs", errs);
        report.put("data", data);
        try {
          ((java.util.function.Consumer<Map<String, Object>>) onInvalid).accept(report);
        } catch (RuntimeException e) {
          // A reporting callback must not fail the operation.
        }
      }
    }

    return errs;
  }

  // A RESULT RECORD AS DATA.
  //
  // makeResult turns every record of a LIST into an entity instance, so what
  // reaches preDone for a list is wrappers, not records - and a wrapper
  // checked against a field spec fails on every required field while its
  // actual data goes unchecked. A load returns the record itself, so this
  // handles both.
  private static Object unwrap(Object record) {
    if (record instanceof Entity) {
      Object data = ((Entity) record).data();
      if (data != null) {
        return data;
      }
    }
    return record;
  }

  // The spec tree with every `$OPEN` marker removed, so an undeclared key is
  // an error rather than a pass. Rebuilt rather than mutated: Schema's entity
  // spec is shared by every client in the process.
  private static Object close(Object node) {
    if (node instanceof List) {
      List<Object> out = new ArrayList<>();
      for (Object item : (List<Object>) node) {
        out.add(close(item));
      }
      return out;
    }

    if (node instanceof Map) {
      Map<String, Object> out = new LinkedHashMap<>();
      for (Map.Entry<String, Object> entry : ((Map<String, Object>) node).entrySet()) {
        if (!OPEN.equals(entry.getKey())) {
          out.put(entry.getKey(), close(entry.getValue()));
        }
      }
      return out;
    }

    return node;
  }
}
