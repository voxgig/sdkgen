// Payload validation against the model's own field types (mirrors
// feature/validate.rs and tm/ts/src/feature/validate/ValidateFeature.ts).
//
// The specs are NOT written here and not written in the model either: every
// entity field already carries a canonical type sentinel (`$STRING`,
// `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
// vocabulary voxgig_validate speaks. The generator maps them once
// (helpers/canonSpec) and emits `shared_entityspec()` into core/schema.c, so
// a field whose type changes in the API spec changes what this feature
// enforces with no edit anywhere.
//
// WHAT IS CHECKED
//   outbound (PreSpec)  the payload the caller asked to send, against
//                       spec.op[opname] - the operation's request shape.
//   inbound  (PreDone)  each record the operation returned, against
//                       spec.data - the entity's own field types.
//
// WHAT IS NOT. The model carries no array element types, no nested object
// schemas, no enums, formats or bounds, so this checks the shape the model
// knows and nothing more.

#include "validate.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  Feature base;
  char* name;
  bool active;
  voxgig_value* add_opts;
  voxgig_value* options;
  voxgig_value* spec;

  bool request;
  bool response;
  char* mode;

  ValidateReportFn on_invalid;
  void* on_invalid_ud;
} ValidateFeature;

// Built rather than written, so the backticks cannot be lost in an edit.
static const char* validate_open_key(void) {
  static char key[8];
  if ('\0' == key[0]) {
    snprintf(key, sizeof(key), "%c$OPEN%c", (char)96, (char)96);
  }
  return key;
}

// The entity name for the current op: the resolved entity when present, else
// the operation's declared entity.
static const char* validate_entity_name(Context* ctx) {
  if (ctx->entity) {
    const char* name = ctx->entity->vt->get_name(ctx->entity);
    if (name && '\0' != name[0]) return name;
  }
  return ctx->op ? ctx->op->entity : "";
}

static const char* validate_op_name(Context* ctx) {
  return ctx->op && ctx->op->name ? ctx->op->name : "";
}

static voxgig_value* validate_entity_spec(ValidateFeature* vf, Context* ctx) {
  return getp(vf->spec, validate_entity_name(ctx));
}

// The spec tree with every `$OPEN` marker removed, so an undeclared key is an
// error rather than a pass. Rebuilt rather than mutated: shared_entityspec()
// hands out a process-lifetime singleton every client reads.
static voxgig_value* validate_close(voxgig_value* node) {
  if (voxgig_is_list(node)) {
    voxgig_list* l = voxgig_as_list(node);
    voxgig_value* out = v_list();
    for (size_t i = 0; i < l->len; i++) {
      voxgig_list_push(voxgig_as_list(out), validate_close(l->items[i]));
    }
    return out;
  }

  if (voxgig_is_map(node)) {
    voxgig_map* m = voxgig_as_map(node);
    const char* open = validate_open_key();
    voxgig_value* out = v_map();
    for (size_t i = 0; i < voxgig_map_len(m); i++) {
      const char* k = voxgig_map_key_at(m, i);
      if (0 == strcmp(k, open)) continue;
      setp(out, k, validate_close(voxgig_map_val_at(m, i)));
    }
    return out;
  }

  return voxgig_retain(node);
}

// The payload an operation is about to send.
//
// TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
// caller's argument in `reqdata` over the entity's `data`; a match op
// (load/list/remove) carries it in `reqmatch` over `mtch`. That is what the
// entity operations pass to context_new and what make_point reads - so
// reading `reqdata` for every op would check a `load({id})` against the
// entity's STALE stored match and reject it for the id the caller had just
// supplied.
static voxgig_value* validate_payload(Context* ctx, const char* opname) {
  bool body = 0 == strcmp(opname, "create") || 0 == strcmp(opname, "update") ||
              0 == strcmp(opname, "patch");

  voxgig_value* srcs[2];
  srcs[0] = body ? ctx->data : ctx->mtch;
  srcs[1] = body ? ctx->reqdata : ctx->reqmatch;

  voxgig_value* out = v_map();
  for (int s = 0; s < 2; s++) {
    if (!voxgig_is_map(srcs[s])) continue;
    voxgig_map* m = voxgig_as_map(srcs[s]);
    for (size_t i = 0; i < voxgig_map_len(m); i++) {
      setp(out, voxgig_map_key_at(m, i), voxgig_retain(voxgig_map_val_at(m, i)));
    }
  }

  // `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
  // make_point reads it off this same argument and the request transformer
  // drops it before the body is built, so a spec built from the API's own
  // fields will never name it - and under `strict` every custom-action call
  // would be rejected for the one key that made it reachable.
  voxgig_map_erase(voxgig_as_map(out), "$action");

  return out;
}

// Join the collected failures into one message. Returns a malloc'd string the
// caller frees.
static char* validate_join(voxgig_value* errs) {
  size_t total = 1;
  voxgig_list* l = voxgig_as_list(errs);
  for (size_t i = 0; i < l->len; i++) {
    const char* s = voxgig_is_string(l->items[i]) ? voxgig_as_string(l->items[i]) : "?";
    total += strlen(s) + 2;
  }

  char* out = (char*)calloc(1, total);
  for (size_t i = 0; i < l->len; i++) {
    const char* s = voxgig_is_string(l->items[i]) ? voxgig_as_string(l->items[i]) : "?";
    if (0 < i) strcat(out, "; ");
    strcat(out, s);
  }
  return out;
}

// One validate call. Errors are COLLECTED, never returned one at a time:
// voxgig_validate stops at the first failure unless given an `errs` list, and
// a caller fixing a payload wants every problem with it, not the first one.
// Failures are APPENDED to `errs`, which the caller owns.
static void validate_check(ValidateFeature* vf, Context* ctx, voxgig_value* data,
                           voxgig_value* spec, const char* direction,
                           voxgig_value* errs) {
  voxgig_injection* sub = voxgig_inj_new(NULL, NULL);
  sub->mode = 0;
  voxgig_release(sub->errs);
  sub->errs = voxgig_new_list();

  voxgig_validate(data, spec, sub);

  voxgig_list* collected = voxgig_as_list(sub->errs);
  size_t before = voxgig_list_len(voxgig_as_list(errs));
  for (size_t i = 0; i < collected->len; i++) {
    voxgig_list_push(voxgig_as_list(errs), voxgig_retain(collected->items[i]));
  }
  size_t added = voxgig_list_len(voxgig_as_list(errs)) - before;

  voxgig_inj_free(sub);

  if (0 == added || NULL == vf->on_invalid) return;

  // A callback receiving every failure, whatever `mode` does with it, so a
  // client can log or count invalid payloads without changing what the SDK
  // returns.
  voxgig_value* reported = v_list();
  voxgig_list* all = voxgig_as_list(errs);
  for (size_t i = before; i < all->len; i++) {
    voxgig_list_push(voxgig_as_list(reported), voxgig_retain(all->items[i]));
  }

  voxgig_value* report = cmap(5,
      "entity", v_str(validate_entity_name(ctx)),
      "op", v_str(validate_op_name(ctx)),
      "direction", v_str(direction),
      "errs", reported,
      "data", voxgig_retain(data));
  vf->on_invalid(report, vf->on_invalid_ud);
}

// Outbound. make_spec surfaces an out_spec_err before the request is built,
// the same seam rbac uses one stage earlier through out_point_err.
static void validate_pre_spec(ValidateFeature* vf, Context* ctx) {
  if (!vf->active || !vf->request) return;

  const char* opname = validate_op_name(ctx);
  voxgig_value* opspec = getp(getp(validate_entity_spec(vf, ctx), "op"), opname);
  if (v_is_noval(opspec) || v_is_null(opspec)) return;

  voxgig_value* errs = v_list();
  validate_check(vf, ctx, validate_payload(ctx, opname), opspec, "request", errs);

  if (0 == voxgig_list_len(voxgig_as_list(errs))) return;
  if (0 == strcmp(vf->mode, "report")) return;

  char* joined = validate_join(errs);
  size_t msgsz = strlen(joined) + strlen(opname) + 128;
  char* msg = (char*)malloc(msgsz);
  snprintf(msg, msgsz, "Invalid %s request for entity \"%s\": %s", opname,
           validate_entity_name(ctx), joined);
  free(joined);

  ctx_out_set_spec_err(ctx, context_make_error(ctx, "validate_failed", msg));
  free(msg);
}

// Inbound. PreDone rather than PreResult: the records are extracted from the
// response body by make_result, which runs between the two, so at PreResult
// there is nothing to check but the envelope.
//
// HOOK ORDER MATTERS HERE, and the default order is not the one you want.
// PreDone hooks fire in feature ADD order, which defaults to `test` first and
// then names sorted - and `validate` sorts last, after audit, cost, debug,
// metrics and telemetry. Those observers therefore record the operation as a
// success before this hook has looked at it. Activating features as an
// ORDERED LIST fixes it.
static void validate_pre_done(ValidateFeature* vf, Context* ctx) {
  if (!vf->active || !vf->response) return;

  voxgig_value* dataspec = getp(validate_entity_spec(vf, ctx), "data");
  if (v_is_noval(dataspec) || v_is_null(dataspec)) return;

  SdkResult* result = ctx->result;
  if (NULL == result) return;

  voxgig_value* resdata = result->resdata;
  if (v_is_noval(resdata) || v_is_null(resdata)) return;

  // A list op returns many records and a load returns one; both are checked
  // against the same record spec, because they are the same entity.
  //
  // NO UNWRAP STEP, unlike the ts and go ports: make_result already stores a
  // list entry as the item's own data (a voxgig_value cannot hold an Entity),
  // so what arrives here is records either way.
  voxgig_value* errs = v_list();
  if (voxgig_is_list(resdata)) {
    voxgig_list* l = voxgig_as_list(resdata);
    for (size_t i = 0; i < l->len; i++) {
      voxgig_value* record = l->items[i];
      if (v_is_noval(record) || v_is_null(record)) continue;

      // A NON-OBJECT IS A FAILURE, not something to skip. A load that
      // answered 42 where the entity's spec wants a record must not pass this
      // feature silently - struct rejects it with the field it could not find.
      validate_check(vf, ctx, record, dataspec, "response", errs);
    }
  } else {
    validate_check(vf, ctx, resdata, dataspec, "response", errs);
  }

  if (0 == voxgig_list_len(voxgig_as_list(errs))) return;
  if (0 == strcmp(vf->mode, "report")) return;

  char* joined = validate_join(errs);
  size_t msgsz = strlen(joined) + 128;
  char* msg = (char*)malloc(msgsz);
  snprintf(msg, msgsz, "Invalid response for entity \"%s\": %s",
           validate_entity_name(ctx), joined);
  free(joined);

  PNError* err = context_make_error(ctx, "validate_failed", msg);
  free(msg);

  // BOTH, and `ok` is the load-bearing half: done returns resdata whenever
  // result->ok is true and never looks at err, so setting the error alone
  // would hand the caller the very records that failed the spec.
  result->ok = false;
  result->err = err;

  // AND THE DATA GOES. The load/update paths copy result->resdata into the
  // entity's own state on any non-null value, BEFORE done raises - so
  // rejecting the operation while leaving the records in place would leave
  // the caller holding an entity populated from a payload this feature had
  // just declared invalid.
  result->resdata = v_undef();
}

static const char* validate_name(Feature* f) { return ((ValidateFeature*)f)->name; }
static bool validate_active(Feature* f) { return ((ValidateFeature*)f)->active; }
static voxgig_value* validate_add_options(Feature* f) {
  return ((ValidateFeature*)f)->add_opts;
}

static void validate_init(Feature* f, Context* ctx, voxgig_value* options) {
  (void)ctx;
  ValidateFeature* vf = (ValidateFeature*)f;
  vf->options = options;
  vf->active = fopt_bool(options, "active", false);

  // DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
  // `config.options` documents them and types them; it does not inject them,
  // because each feature entry in the spec is optional and struct fills in
  // nothing through an optional union. So every feature resolves its own.
  vf->request = fopt_bool(options, "request", true);
  vf->response = fopt_bool(options, "response", false);

  // FAIL CLOSED. Only the exact string "report" selects report mode, so a
  // typo (`mode: "thow"`) still rejects rather than silently turning
  // enforcement off - the failure nobody would notice. The option spec
  // rejects the typo outright; this is what happens if it ever does not.
  free(vf->mode);
  vf->mode = strdup(0 == strcmp(fopt_str(options, "mode", "throw"), "report")
                        ? "report" : "throw");

  // `strict` is applied ONCE, here, by rebuilding the spec tree without the
  // `$OPEN` markers - rather than per call, which would clone a spec for
  // every request an SDK ever makes.
  voxgig_value* entityspec = shared_entityspec();
  vf->spec = fopt_bool(options, "strict", false) ? validate_close(entityspec)
                                                 : entityspec;
}

static void validate_hook(Feature* f, const char* name, Context* ctx) {
  ValidateFeature* vf = (ValidateFeature*)f;
  if (0 == strcmp(name, "PreSpec")) {
    validate_pre_spec(vf, ctx);
  } else if (0 == strcmp(name, "PreDone")) {
    validate_pre_done(vf, ctx);
  }
}

static const FeatureVT VALIDATE_VT = {
  validate_name, validate_active, validate_add_options, validate_init,
  validate_hook, NULL,
};

Feature* feature_validate_new(void) {
  ValidateFeature* vf = (ValidateFeature*)calloc(1, sizeof(ValidateFeature));
  vf->base.vt = &VALIDATE_VT;
  vf->name = strdup("validate");
  vf->active = true; // matches rust new() (overridden by init from options)
  vf->add_opts = NULL;
  vf->options = voxgig_new_undef();
  vf->spec = voxgig_new_map();
  vf->request = true;
  vf->response = false;
  vf->mode = strdup("throw");
  vf->on_invalid = NULL;
  vf->on_invalid_ud = NULL;
  return (Feature*)vf;
}

// The `onInvalid` callback, set after construction (feature/validate.h).
void feature_validate_on_invalid(Feature* f, ValidateReportFn fn, void* ud) {
  ValidateFeature* vf = (ValidateFeature*)f;
  vf->on_invalid = fn;
  vf->on_invalid_ud = ud;
}
