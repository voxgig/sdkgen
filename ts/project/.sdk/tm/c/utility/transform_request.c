// transform_request utility (mirrors utility/transform_request.rs).

#include "sdk.h"

#include <string.h>

/* A header argument travels as a header, which prepare_headers_util sends,
   so the body is built from the request data without it. */
static bool header_arg(voxgig_value* point, const char* key) {
  voxgig_value* aheader = getpath2(point, "args", "header");
  if (!voxgig_is_list(aheader)) return false;
  voxgig_list* hl = voxgig_as_list(aheader);
  for (size_t i = 0; i < hl->len; i++) {
    voxgig_value* name = getp(hl->items[i], "name");
    if (voxgig_is_string(name) && strcmp(voxgig_as_string(name), key) == 0) return true;
  }
  return false;
}

/* `$action` selects the point (see make_point_util); it is never an API
   field, so the body is a copy without it, or, given a point, without its
   header arguments. The caller's map is left untouched. */
static bool dropped(const char* key, voxgig_value* point) {
  return NULL == point ? strcmp(key, "$action") == 0 : header_arg(point, key);
}

static voxgig_value* omit_keys(voxgig_value* reqdata, voxgig_value* point) {
  if (!voxgig_is_map(reqdata)) return reqdata;
  voxgig_map* rm = voxgig_as_map(reqdata);
  bool has = false;
  for (size_t i = 0; i < rm->len; i++) {
    if (dropped(rm->entries[i].key, point)) { has = true; break; }
  }
  if (!has) return reqdata;
  voxgig_value* body = voxgig_new_map();
  for (size_t i = 0; i < rm->len; i++) {
    if (!dropped(rm->entries[i].key, point)) {
      setp(body, rm->entries[i].key, v_share(rm->entries[i].value));
    }
  }
  return body;
}

static voxgig_value* strip_action(voxgig_value* reqdata) {
  return omit_keys(reqdata, NULL);
}

voxgig_value* transform_request_util(Context* ctx) {
  Spec* spec = ctx->spec;
  voxgig_value* point = ctx->point;

  if (spec) spec_set_step(spec, "reqform");

  voxgig_value* data = NULL == point ? ctx->reqdata : omit_keys(ctx->reqdata, point);

  voxgig_value* transform = to_map(getp(point, "transform"));
  if (v_is_noval(transform)) return strip_action(data);

  voxgig_value* reqform = getp(transform, "req");
  if (v_is_noval(reqform) || v_is_null(reqform)) return strip_action(data);

  voxgig_value* store = cmap(1, "reqdata", v_share(data));
  /* Return the transform result verbatim, as the ts reference does. Falling
     back to ctx->reqdata meant a reqform naming a path that does not resolve
     sent the WHOLE request data instead of nothing. */
  return strip_action(voxgig_transform(store, reqform, NULL));
}
