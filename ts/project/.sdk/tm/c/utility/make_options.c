// make_options utility (mirrors utility/make_options.rs).

#include "sdk.h"

#include <stdlib.h>
#include <string.h>

voxgig_value* make_options_util(Context* ctx) {
  voxgig_value* options = voxgig_is_map(ctx->options) ? ctx->options : voxgig_new_map();

  // Merge custom utility overrides onto the utility object.
  voxgig_value* custom_utils = to_map(getp(options, "utility"));
  if (voxgig_is_map(custom_utils) && ctx->utility) {
    voxgig_value* custom = ctx->utility->custom;
    voxgig_map* cm = voxgig_as_map(custom_utils);
    for (size_t i = 0; i < cm->len; i++) {
      setp(custom, cm->entries[i].key, voxgig_retain(cm->entries[i].value));
    }
  }

  voxgig_value* opts = voxgig_clone(options);

  voxgig_value* config = ctx->config;
  voxgig_value* cfgopts = to_map(getp(config, "options"));
  if (!voxgig_is_map(cfgopts)) cfgopts = voxgig_new_map();

  // Build the option spec (validation shape). Marker keys use backticks.
  voxgig_value* optspec = cmap(13,
    "apikey", v_str(""),
    "base", v_str("http://localhost:8000"),
    "prefix", v_str(""),
    "suffix", v_str(""),
    "auth", cmap(1, "prefix", v_str("")),
    "headers", cmap(1, "`$CHILD`", v_str("`$STRING`")),
    "allow", cmap(2,
      "method", v_str("GET,PUT,POST,PATCH,DELETE,OPTIONS"),
      "op", v_str("create,update,load,list,remove,command,direct")),
    "entity", cmap(1, "`$CHILD`", cmap(3,
      "`$OPEN`", v_bool(true),
      "active", v_bool(false),
      "alias", v_map())),
    "feature", cmap(1, "`$CHILD`", cmap(2,
      "`$OPEN`", v_bool(true),
      "active", v_bool(false))),
    "utility", v_map(),
    "system", v_map(),
    "test", cmap(2,
      "active", v_bool(false),
      "entity", cmap(1, "`$OPEN`", v_bool(true))),
    "clean", cmap(1, "keys", v_str("key,token,id")));

  // Preserve system.fetch before merge/validate (validation strips it).
  voxgig_value* sys_fetch = getpath2(opts, "system", "fetch");

  voxgig_value* mergelist = clist(3, v_map(), v_share(cfgopts), v_share(opts));
  voxgig_value* merged = voxgig_merge(mergelist, VOXGIG_MAXDEPTH);
  voxgig_value* validated = voxgig_validate(merged, optspec, NULL);
  if (voxgig_is_map(validated)) {
    opts = validated;
  }

  // Restore system.fetch.
  if (!v_is_noval(sys_fetch)) {
    voxgig_value* sys = getp(opts, "system");
    if (voxgig_is_map(sys)) {
      setp(sys, "fetch", v_share(sys_fetch));
    } else {
      setp(opts, "system", cmap(1, "fetch", v_share(sys_fetch)));
    }
  }

  // Derived clean config.
  voxgig_value* clean_keys_v = getpath2(opts, "clean", "keys");
  const char* clean_keys = voxgig_is_string(clean_keys_v) ? voxgig_as_string(clean_keys_v)
                                                          : "key,token,id";

  // Split on ',', trim, filter empty, esc_re each, join with '|'.
  char* keyre = (char*)malloc(1);
  keyre[0] = '\0';
  size_t keyre_len = 0;
  bool first = true;
  const char* p = clean_keys;
  while (1) {
    const char* comma = strchr(p, ',');
    size_t seglen = comma ? (size_t)(comma - p) : strlen(p);
    // trim
    const char* start = p;
    const char* end = p + seglen;
    while (start < end && (*start == ' ' || *start == '\t')) start++;
    while (end > start && (end[-1] == ' ' || end[-1] == '\t')) end--;
    if (end > start) {
      char* seg = (char*)malloc((size_t)(end - start) + 1);
      memcpy(seg, start, (size_t)(end - start));
      seg[end - start] = '\0';
      char* esc = voxgig_escre(v_str(seg));
      free(seg);
      const char* e = esc ? esc : "";
      size_t elen = strlen(e);
      size_t extra = elen + (first ? 0 : 1);
      keyre = (char*)realloc(keyre, keyre_len + extra + 1);
      if (!first) keyre[keyre_len++] = '|';
      memcpy(keyre + keyre_len, e, elen);
      keyre_len += elen;
      keyre[keyre_len] = '\0';
      free(esc);
      first = false;
    }
    if (!comma) break;
    p = comma + 1;
  }

  voxgig_value* derived_clean = (keyre_len == 0) ? v_map()
                                                 : cmap(1, "keyre", v_str(keyre));
  free(keyre);
  setp(opts, "__derived__", cmap(1, "clean", derived_clean));

  return opts;
}
