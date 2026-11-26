// prepare_body utility (mirrors utility/prepare_body.rs).

#include "sdk.h"

#include <string.h>

static const char* ROUTED_KINDS[] = { "header", "cookie", "query" };

static bool names_contain(voxgig_value* names, const char* key) {
  if (voxgig_is_list(names)) {
    voxgig_list* nl = voxgig_as_list(names);
    for (size_t i = 0; i < nl->len; i++) {
      if (v_str_eq(nl->items[i], key)) return true;
    }
  }
  return false;
}

static bool args_contain(voxgig_value* defs, const char* key, bool unless_field) {
  bool found = false;
  if (voxgig_is_list(defs)) {
    voxgig_list* dl = voxgig_as_list(defs);
    for (size_t i = 0; i < dl->len && !found; i++) {
      voxgig_value* n = getp(dl->items[i], "name");
      voxgig_value* f = getp(dl->items[i], "field");
      found = v_str_eq(n, key) && !(unless_field && voxgig_is_bool(f) && voxgig_as_bool(f));
      voxgig_release(n);
      voxgig_release(f);
    }
  }
  return found;
}

static bool routed(voxgig_value* point, const char* key) {
  voxgig_value* params = getp(point, "params");
  voxgig_value* aparams = getpath2(point, "args", "params");
  bool found = names_contain(params, key) || args_contain(aparams, key, false);
  voxgig_release(params);
  voxgig_release(aparams);
  for (size_t k = 0; k < 3 && !found; k++) {
    voxgig_value* defs = getpath2(point, "args", ROUTED_KINDS[k]);
    found = args_contain(defs, key, true);
    voxgig_release(defs);
  }
  return found;
}

// A list, load or remove routed to a method with a body sends the match
// fields that body declares, never a path parameter, and never a header,
// cookie or query argument the body does not also declare as a field.
static voxgig_value* match_body(Context* ctx, voxgig_value* fields) {
  voxgig_value* body = voxgig_new_map();
  voxgig_list* fl = voxgig_as_list(fields);
  for (size_t i = 0; i < fl->len; i++) {
    if (!voxgig_is_string(fl->items[i])) continue;
    const char* name = voxgig_as_string(fl->items[i]);
    if (strcmp(name, "$action") == 0 || routed(ctx->point, name)) continue;
    voxgig_value* val = getp(ctx->reqmatch, name);
    if (!v_is_noval(val) && !v_is_null(val)) setp(body, name, val);
    voxgig_release(val);
  }
  return body;
}

voxgig_value* prepare_body_util(Context* ctx) {
  if (strcmp(ctx->op->input, "data") == 0) {
    if (media_is_raw_request(ctx->point)) return media_raw_body(ctx->reqdata);
    return transform_request_util(ctx);
  }
  voxgig_value* fields = getp(ctx->point, "fields");
  voxgig_value* body = voxgig_is_list(fields) && 0 < voxgig_as_list(fields)->len
                           ? match_body(ctx, fields)
                           : voxgig_new_undef();
  voxgig_release(fields);
  return body;
}
