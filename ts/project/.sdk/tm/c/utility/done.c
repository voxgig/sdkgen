// done utility (mirrors utility/done.rs).

#include "sdk.h"

voxgig_value* done_util(Context* ctx, PNError** err) {
  Control* c = ctx->ctrl;
  if (control_has_explain(c)) {
    voxgig_value* explain = clean_util(ctx, c->explain);
    voxgig_value* res = getp(explain, "result");
    if (voxgig_is_map(res)) {
      voxgig_value* rm = to_map(res);
      voxgig_value* k = voxgig_new_string("err");
      voxgig_delprop(rm, k);
      voxgig_release(k);
    }
    // The explain map is the CALLER's own (Control keeps the pointer, not
    // the ctrl object ts reassigns a field on), so the cleaned copy is
    // written back into it entry by entry rather than swapped in.
    if (explain != c->explain && voxgig_is_map(explain) && voxgig_is_map(c->explain)) {
      voxgig_map* cm = voxgig_as_map(explain);
      for (size_t i = 0; i < cm->len; i++) {
        setp(c->explain, cm->entries[i].key, voxgig_retain(cm->entries[i].value));
      }
    } else {
      c->explain = explain;
    }
  }

  SdkResult* result = ctx->result;
  if (result && result->ok) {
    if (err) *err = NULL;
    return v_share(result->resdata);
  }

  return make_error_util(ctx, NULL, err);
}
