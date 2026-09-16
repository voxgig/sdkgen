// ProjectName SDK — validate feature (the C++ port of
// tm/ts/src/feature/validate/ValidateFeature.ts).
//
// Payload validation against the model's own field types. The specs are NOT
// written here and not written in the model either: every entity field
// already carries a canonical type sentinel (`$STRING`, `$INTEGER`, the
// `$ONE` union for an OpenAPI multi-type), which is the same vocabulary
// Struct::validate speaks. The generator maps them once (helpers/canonSpec)
// and emits `sharedEntityspec()`, so a field whose type changes in the API
// spec changes what this feature enforces with no edit anywhere.
//
// WHAT IS CHECKED
//   outbound (preSpec)  the payload the caller asked to send, against
//                       spec.op[opname] — the operation's request shape.
//   inbound  (preDone)  each record the operation returned, against
//                       spec.data — the entity's own field types.
//
// WHAT IS NOT. The model carries no array element types, no nested object
// schemas, no enums, formats or bounds, so this checks the shape the model
// knows and nothing more.

#ifndef SDK_FEATURE_VALIDATE_HPP
#define SDK_FEATURE_VALIDATE_HPP

#include <string>
#include <vector>

#include "../core/schema.hpp"
#include "../core/types.hpp"
#include "base.hpp"
#include "options.hpp"

namespace sdk {

class ValidateFeature : public BaseFeature {
public:
  SdkClient* client = nullptr;
  Value options = Value::undef();
  Value spec = Value::undef();

  bool request = true;
  bool response = false;
  std::string mode = "throw";

  ValidateFeature() : BaseFeature("validate", "0.0.1", true) {}

  void init(CtxPtr ctx, const Value& options_) override {
    client = ctx->client;
    options = options_;
    active = fopt::foptBool(options, "active", false);

    // DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
    // `config.options` documents them and types them; it does not inject
    // them, because each feature entry in the spec is optional and struct
    // fills in nothing through an optional union. So every feature resolves
    // its own.
    request = fopt::foptBool(options, "request", true);
    response = fopt::foptBool(options, "response", false);

    // FAIL CLOSED. Only the exact string "report" selects report mode, so a
    // typo (`mode: "thow"`) still rejects rather than silently turning
    // enforcement off — the failure nobody would notice. The option spec
    // rejects the typo outright; this is what happens if it ever does not.
    mode = "report" == fopt::foptStr(options, "mode", "throw") ? "report" : "throw";

    // `strict` is applied ONCE, here, by rebuilding the spec tree without the
    // `$OPEN` markers — rather than per call, which would clone a spec for
    // every request an SDK ever makes. REBUILT, not mutated: `Value` is
    // shared_ptr-backed and sharedEntityspec() hands out a function-local
    // static every client in the process reads.
    const Value& entityspec = sharedEntityspec();
    spec = fopt::foptBool(options, "strict", false) ? closeSpec(entityspec) : entityspec;
  }

  // Outbound. makeSpec surfaces an out.specError before the request is built,
  // the same seam rbac uses one stage earlier through out.pointError.
  void preSpec(CtxPtr ctx) override {
    if (!active || !request) return;

    std::string opname = opName(ctx);
    Value opspec = getp(getp(entitySpec(ctx), "op"), opname);
    if (is_nullish(opspec)) return;

    std::vector<std::string> errs = check(ctx, payload(ctx, opname), opspec, "request");
    if (errs.empty() || "report" == mode) return;

    ctx->out.specError = ctx->makeError("validate_failed",
        "Invalid " + opname + " request for entity \"" + entName(ctx) + "\": " +
        joined(errs));
  }

  // Inbound. preDone rather than preResult: the records are extracted from
  // the response body by makeResult, which runs between the two, so at
  // preResult there is nothing to check but the envelope.
  //
  // HOOK ORDER MATTERS HERE, and the default order is not the one you want.
  // preDone hooks fire in feature ADD order, which defaults to `test` first
  // and then names sorted — and `validate` sorts last, after audit, cost,
  // debug, metrics and telemetry. Those observers therefore record the
  // operation as a success before this hook has looked at it. Activating
  // features as an ORDERED LIST fixes it.
  void preDone(CtxPtr ctx) override {
    if (!active || !response) return;

    Value dataspec = getp(entitySpec(ctx), "data");
    if (is_nullish(dataspec)) return;

    if (!ctx->result) return;
    Value resdata = ctx->result->resdata;
    if (is_nullish(resdata)) return;

    // A list op returns many records and a load returns one; both are checked
    // against the same record spec, because they are the same entity.
    //
    // NO UNWRAP STEP, unlike the ts and go ports: makeResult already stores a
    // list entry as the item's own data map rather than as the entity object
    // (a C++ Value cannot hold one), so what arrives here is records either
    // way.
    std::vector<Value> records;
    if (resdata.is_list()) {
      for (const auto& entry : *resdata.as_list()) records.push_back(entry);
    } else {
      records.push_back(resdata);
    }

    std::vector<std::string> errs;
    for (const auto& record : records) {
      if (is_nullish(record)) continue;

      // A NON-OBJECT IS A FAILURE, not something to skip. A load that
      // answered 42 where the entity's spec wants a record must not pass this
      // feature silently — struct rejects it with the field it could not find.
      for (const auto& e : check(ctx, record, dataspec, "response")) {
        errs.push_back(e);
      }
    }

    if (errs.empty() || "report" == mode) return;

    auto err = ctx->makeError("validate_failed",
        "Invalid response for entity \"" + entName(ctx) + "\": " + joined(errs));

    // BOTH, and `ok` is the load-bearing half: done returns resdata whenever
    // result->ok is true and never looks at err, so setting the error alone
    // would hand the caller the very records that failed the spec.
    ctx->result->ok = false;
    ctx->result->err = err;

    // AND THE DATA GOES. The load/update paths copy result->resdata into the
    // entity's own state on any non-null value, BEFORE done raises — so
    // rejecting the operation while leaving the records in place would leave
    // the caller holding an entity populated from a payload this feature had
    // just declared invalid.
    ctx->result->resdata = Value::undef();
  }

private:
  // The payload an operation is about to send.
  //
  // TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
  // caller's argument in `reqdata` over the entity's `data`; a match op
  // (load/list/remove) carries it in `reqmatch` over `match`. That is what
  // the entity operations pass to the context and what makePoint reads — so
  // reading `reqdata` for every op would check a `load({id})` against the
  // entity's STALE stored match and reject it for the id the caller had just
  // supplied.
  Value payload(CtxPtr ctx, const std::string& opname) {
    bool body = "create" == opname || "update" == opname || "patch" == opname;

    Value base = body ? ctx->data : ctx->match;
    Value req = body ? ctx->reqdata : ctx->reqmatch;

    Value out = vmap();
    for (const Value* src : {&base, &req}) {
      if (src->is_map()) {
        for (const auto& [k, v] : *src->as_map()) map_put(out, k, v);
      }
    }

    // `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
    // makePoint reads it off this same argument and the request transformer
    // drops it before the body is built, so a spec built from the API's own
    // fields will never name it — and under `strict` every custom-action call
    // would be rejected for the one key that made it reachable.
    map_remove(out, "$action");

    return out;
  }

  Value entitySpec(CtxPtr ctx) { return getp(spec, entName(ctx)); }

  std::string opName(CtxPtr ctx) { return ctx->op ? ctx->op->name : std::string(); }

  std::string entName(CtxPtr ctx) {
    if (ctx->entity != nullptr) {
      std::string name = ctx->entity->getName();
      if (!name.empty()) return name;
    }
    return ctx->op ? ctx->op->entity : std::string();
  }

  static std::string joined(const std::vector<std::string>& errs) {
    std::string out;
    for (size_t i = 0; i < errs.size(); i++) {
      if (0 < i) out += "; ";
      out += errs[i];
    }
    return out;
  }

  // One validate call. Errors are COLLECTED, never thrown: Struct::validate
  // throws on the first failure unless given an `errs` list, and a caller
  // fixing a payload wants every problem with it, not the first one.
  std::vector<std::string> check(CtxPtr ctx, const Value& data, const Value& sp,
                                 const std::string& direction) {
    Value collector = vlist();
    Value vopts = vmap();
    map_put(vopts, "errs", collector);

    try {
      Struct::validate(data, sp, vopts);
    } catch (const std::exception& e) {
      // A spec this port cannot run at all (rather than a payload that fails
      // it) must not take the operation down with it: report it like any
      // other failure and let `mode` decide.
      if (collector.is_list() && collector.as_list()->empty()) {
        collector.as_list()->push_back(Value(std::string(e.what())));
      }
    }

    std::vector<std::string> errs;
    if (collector.is_list()) {
      for (const auto& e : *collector.as_list()) {
        errs.push_back(e.is_string() ? e.as_string() : vs::stringify(e));
      }
    }

    if (!errs.empty()) {
      // A callback receiving every failure, whatever `mode` does with it, so
      // a client can log or count invalid payloads without changing what the
      // SDK returns. Held in feature state rather than read off the options
      // map: a C++ Value carries no std::function of this shape.
      if (onInvalid) {
        Value report = vmap();
        map_put(report, "entity", Value(entName(ctx)));
        map_put(report, "op", Value(opName(ctx)));
        map_put(report, "direction", Value(direction));
        Value errlist = vlist();
        for (const auto& e : errs) errlist.as_list()->push_back(Value(e));
        map_put(report, "errs", errlist);
        map_put(report, "data", data);
        try {
          onInvalid(report);
        } catch (...) {
          // A reporting callback must not fail the operation.
        }
      }
    }

    return errs;
  }

public:
  // Set after construction, the way the retry port takes its injectable
  // sleep: `onInvalid` in the model's optspec is a `$FUNCTION`, which a C++
  // option Value cannot hold.
  std::function<void(const Value&)> onInvalid;

private:
  // Built rather than written, so the backticks cannot be lost in an edit.
  static const std::string& openKey() {
    static const std::string k = std::string(1, static_cast<char>(96)) + "$OPEN" +
                                 std::string(1, static_cast<char>(96));
    return k;
  }

  // The spec tree with every `$OPEN` marker removed, so an undeclared key is
  // an error rather than a pass. Rebuilt rather than mutated: the shared
  // entity spec is a process-wide constant.
  static Value closeSpec(const Value& node) {
    if (node.is_list()) {
      Value out = vlist();
      for (const auto& item : *node.as_list()) out.as_list()->push_back(closeSpec(item));
      return out;
    }

    if (node.is_map()) {
      Value out = vmap();
      for (const auto& [k, v] : *node.as_map()) {
        if (k != openKey()) map_put(out, k, closeSpec(v));
      }
      return out;
    }

    return node;
  }
};

}  // namespace sdk

#endif  // SDK_FEATURE_VALIDATE_HPP
