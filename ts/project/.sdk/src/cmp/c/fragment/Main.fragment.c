// ProjectNameSDK client (generated — mirrors the rust Main fragment).

#include "api.h"

#include <stdlib.h>
#include <string.h>

ProjectNameSDK* projectname_sdk_new(voxgig_value* options) {
  ProjectNameSDK* sdk = (ProjectNameSDK*)calloc(1, sizeof(ProjectNameSDK));
  sdk->mode = strdup("live");
  sdk->options = voxgig_new_undef();
  sdk->utility = utility_new();
  sdk->features = NULL;
  sdk->features_len = 0;
  sdk->features_cap = 0;
  sdk->rootctx = NULL;

  voxgig_value* config = make_config();

  CtxSpec cs;
  memset(&cs, 0, sizeof(cs));
  cs.client = sdk;
  cs.utility = sdk->utility;
  cs.config = config;
  cs.options = options ? options : voxgig_new_undef();
  cs.shared = voxgig_new_map();
  Context* rootctx = make_context_util(cs, NULL);

  voxgig_value* opts = make_options_util(rootctx);
  sdk->options = v_share(opts);

  voxgig_value* testactive;
  {
    const char* keys[4] = {"feature", "test", "active", NULL};
    testactive = getpath_c(opts, keys);
  }
  if (voxgig_is_bool(testactive) && voxgig_as_bool(testactive)) {
    free(sdk->mode);
    sdk->mode = strdup("test");
  }

  rootctx->options = v_share(opts);
  sdk->rootctx = rootctx;

  // Add features in the resolved order (make_options puts an explicit list
  // order first, else defaults to test-first). Ordering matters: the `test`
  // feature installs the base mock transport and the transport features
  // (retry/cache/netsim/proxy/ratelimit) wrap whatever is current, so `test`
  // must be added before them to sit at the base of the transport chain.
  voxgig_value* feature_opts = to_map(getp(opts, "feature"));
  voxgig_value* feature_order = getpath2(opts, "__derived__", "featureorder");
  if (voxgig_is_map(feature_opts) && v_is_list(feature_order)) {
    voxgig_list* order = voxgig_as_list(feature_order);
    for (size_t i = 0; i < order->len; i++) {
      voxgig_value* fname_v = order->items[i];
      if (!v_is_str(fname_v)) continue;
      const char* fname = voxgig_as_string(fname_v);
      voxgig_value* fopts = getp(feature_opts, fname);
      if (voxgig_is_map(fopts)) {
        bool active = false;
        if (get_bool(fopts, "active", &active) && active) {
          feature_add_util(rootctx, make_feature(fname));
        }
      }
    }
  }

  // Initialize features.
  size_t n = sdk->features_len;
  for (size_t i = 0; i < n; i++) {
    feature_init_util(rootctx, sdk->features[i]);
  }

  feature_hook_util(rootctx, "PostConstruct");

  return sdk;
}

voxgig_value* sdk_prepare(ProjectNameSDK* sdk, voxgig_value* fetchargs, PNError** err) {
  *err = NULL;
  Utility* utility = sdk->utility;
  (void)utility;

  fetchargs = voxgig_is_map(fetchargs) ? fetchargs : voxgig_new_map();

  voxgig_value* ctrl = to_map(getp(fetchargs, "ctrl"));
  if (!voxgig_is_map(ctrl)) ctrl = voxgig_new_map();

  CtxSpec cs;
  memset(&cs, 0, sizeof(cs));
  cs.opname = "prepare";
  cs.ctrl = ctrl;
  Context* ctx = make_context_util(cs, sdk_get_root_ctx(sdk));

  voxgig_value* options = v_share(sdk->options);

  const char* path = get_str(fetchargs, "path");
  path = path ? path : "";
  const char* method = get_str(fetchargs, "method");
  if (!method || method[0] == '\0') method = "GET";

  voxgig_value* params = to_map(getp(fetchargs, "params"));
  if (!voxgig_is_map(params)) params = voxgig_new_map();
  voxgig_value* query = to_map(getp(fetchargs, "query"));
  if (!voxgig_is_map(query)) query = voxgig_new_map();

  voxgig_value* headers = prepare_headers_util(ctx);

  voxgig_value* specmap = cmap(10,
    "base", getp(options, "base"),
    "prefix", getp(options, "prefix"),
    "suffix", getp(options, "suffix"),
    "path", v_str(path),
    "method", v_str(method),
    "params", params,
    "query", query,
    "headers", headers,
    "body", getp(fetchargs, "body"),
    "step", v_str("start"));
  Spec* spec = spec_new(specmap);
  ctx->spec = spec;

  // Merge user-provided headers.
  voxgig_value* uh = getp(fetchargs, "headers");
  if (voxgig_is_map(uh)) {
    voxgig_map* m = voxgig_as_map(uh);
    for (size_t i = 0; i < m->len; i++) {
      setp(spec->headers, m->entries[i].key, voxgig_retain(m->entries[i].value));
    }
  }

  prepare_auth_util(ctx, err);
  if (*err) return NULL;

  return make_fetch_def_util(ctx, err);
}

static voxgig_value* err_map(const char* msg) {
  return cmap(2, "ok", v_bool(false), "err", v_str(msg));
}

voxgig_value* sdk_direct(ProjectNameSDK* sdk, voxgig_value* fetchargs, PNError** err) {
  *err = NULL;
  Utility* utility = sdk->utility;

  PNError* perr = NULL;
  voxgig_value* fetchdef = sdk_prepare(sdk, fetchargs, &perr);
  if (perr) {
    return err_map(perr->msg);
  }

  voxgig_value* ctrl = to_map(getp(fetchargs, "ctrl"));
  if (!voxgig_is_map(ctrl)) ctrl = voxgig_new_map();

  CtxSpec cs;
  memset(&cs, 0, sizeof(cs));
  cs.opname = "direct";
  cs.ctrl = ctrl;
  Context* ctx = make_context_util(cs, sdk_get_root_ctx(sdk));

  const char* url = get_str(fetchdef, "url");
  url = url ? url : "";
  PNError* ferr = NULL;
  voxgig_value* fetched = utility_fetch(utility, ctx, url, fetchdef, &ferr);
  if (ferr) {
    return err_map(ferr->msg);
  }

  if (v_is_noval(fetched) || v_is_null(fetched)) {
    return err_map("response: undefined");
  }

  if (voxgig_is_map(fetched)) {
    int64_t status = to_int(getp(fetched, "status"));
    voxgig_value* headers = getp(fetched, "headers");

    voxgig_value* cl = getp(headers, "content-length");
    char clbuf[32];
    clbuf[0] = '\0';
    if (voxgig_is_string(cl)) {
      snprintf(clbuf, sizeof(clbuf), "%s", voxgig_as_string(cl));
    } else if (voxgig_is_number(cl)) {
      snprintf(clbuf, sizeof(clbuf), "%lld", (long long)to_int(cl));
    }
    bool no_body = (status == 204 || status == 304 || strcmp(clbuf, "0") == 0);

    voxgig_value* json_data;
    if (no_body) {
      json_data = voxgig_new_undef();
    } else {
      voxgig_value* jf = getp(fetched, "json");
      json_data = voxgig_is_func(jf) ? call_json(jf) : voxgig_new_undef();
    }

    return cmap(4,
      "ok", v_bool(status >= 200 && status < 300),
      "status", v_num((double)status),
      "headers", v_share(headers),
      "data", json_data);
  }

  return err_map("invalid response type");
}

// <[SLOT]>

ProjectNameSDK* test_sdk(voxgig_value* testopts, voxgig_value* sdkopts) {
  sdkopts = voxgig_is_map(sdkopts) ? voxgig_clone(sdkopts) : voxgig_new_map();
  testopts = voxgig_is_map(testopts) ? voxgig_clone(testopts) : voxgig_new_map();
  setp(testopts, "active", v_bool(true));

  // set_path mutates sdkopts in place; discard the return (keep the ROOT).
  voxgig_value* path = clist(2, v_str("feature"), v_str("test"));
  voxgig_setpath(sdkopts, path, testopts, NULL);

  ProjectNameSDK* sdk = projectname_sdk_new(sdkopts);
  free(sdk->mode);
  sdk->mode = strdup("test");
  return sdk;
}
