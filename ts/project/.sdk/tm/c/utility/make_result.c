// make_result utility (mirrors utility/make_result.rs).

#include "sdk.h"

#include <string.h>

SdkResult* make_result_util(Context* ctx, PNError** err) {
  *err = NULL;

  if (ctx->out_result) {
    return ctx->out_result;
  }

  Operation* op = ctx->op;
  Entity* entity = ctx->entity;
  Spec* spec = ctx->spec;
  if (!spec) {
    *err = context_make_error(ctx, "result_no_spec", "Expected context spec property to be defined.");
    return NULL;
  }
  SdkResult* result = ctx->result;
  if (!result) {
    *err = context_make_error(ctx, "result_no_result", "Expected context result property to be defined.");
    return NULL;
  }

  spec_set_step(spec, "result");

  transform_response_util(ctx);

  // Every operation resolves to PLAIN records — load, create, update and
  // list alike. `list` used to be the outlier: it wrapped each record in
  // an entity instance, so the same record came back with a different
  // type, a different key order and an extra marker depending on which
  // call produced it. Any consumer touching both paths had to normalise
  // defensively, and feeding a wrapped record into a host framework's own
  // metadata silently produced wrong entities with no error at all. A
  // missing or empty list still normalises to an empty list.
  if (strcmp(op->name, "list") == 0) {
    voxgig_value* resdata = result->resdata;
    if (!voxgig_is_list(resdata)) {
      result->resdata = voxgig_new_list();
    }
  }

  Control* c = ctx->ctrl;
  if (control_has_explain(c)) {
    setp(c->explain, "result", result_to_value(result));
  }

  return result;
}
