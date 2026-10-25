// The transport the pipeline calls (mirrors utility/fetcher.rs): a
// caller-supplied system.fetch when there is one, else the SDK's own
// (utility/http.c).

#include "sdk.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define GETONLY_ENV "VOXGIG_GETONLY_GUARD"

// A GET-only live run refuses any other method before it is sent. The error
// names the path alone: the query can carry a credential.
static PNError* getonly_refusal(Context* ctx, const char* fullurl, voxgig_value* fetchdef) {
  const char* flag = getenv(GETONLY_ENV);
  const char* raw = get_str(fetchdef, "method");
  char method[16] = "GET";
  if (NULL != raw && '\0' != raw[0]) {
    size_t n = 0;
    for (; '\0' != raw[n] && n < sizeof(method) - 1; n++) {
      method[n] = (char)toupper((unsigned char)raw[n]);
    }
    method[n] = '\0';
  }
  if (NULL == flag || 0 != strcmp(flag, "TRUE") || 0 == strcmp(method, "GET")) {
    return NULL;
  }
  const char* scheme = strstr(fullurl, "://");
  const char* path = NULL == scheme ? fullurl : scheme + 3 + strcspn(scheme + 3, "/?#");
  int plen = (int)strcspn(path, "?#");
  char buf[512];
  snprintf(buf, sizeof(buf), "[GET-ONLY GUARD] blocked %s %.*s", method,
           0 == plen ? 1 : plen, 0 == plen ? "/" : path);
  return context_make_error(ctx, "fetch_getonly_block", buf);
}

voxgig_value* fetcher_util(Fetcher* self, Context* ctx, const char* fullurl,
                           voxgig_value* fetchdef, PNError** err) {
  (void)self;
  *err = NULL;

  ProjectNameSDK* client = ctx->client;
  if (!client) {
    *err = context_make_error(ctx, "fetch_no_client", "Expected context client.");
    return NULL;
  }

  const char* mode = client->mode;
  if (strcmp(mode, "live") != 0) {
    char buf[512];
    snprintf(buf, sizeof(buf), "Request blocked by mode: \"%s\" (URL was: \"%s\")",
             mode, fullurl);
    *err = context_make_error(ctx, "fetch_mode_block", buf);
    return NULL;
  }

  voxgig_value* options = sdk_options_map(client);
  voxgig_value* testactive;
  {
    const char* keys[4] = {"feature", "test", "active", NULL};
    testactive = getpath_c(options, keys);
  }
  if (voxgig_is_bool(testactive) && voxgig_as_bool(testactive)) {
    char buf[512];
    snprintf(buf, sizeof(buf),
             "Request blocked as test feature is active (URL was: \"%s\")", fullurl);
    *err = context_make_error(ctx, "fetch_test_block", buf);
    return NULL;
  }

  voxgig_value* sys_fetch = getpath2(options, "system", "fetch");

  if (v_is_noval(sys_fetch) || v_is_null(sys_fetch)) {
    *err = getonly_refusal(ctx, fullurl, fetchdef);
    return NULL != *err ? NULL : http_fetch(ctx, fullurl, fetchdef, err);
  }

  if (voxgig_is_func(sys_fetch)) {
    // Caller-supplied transport: called with [url, fetchdef]; returns a
    // transport-shaped response map (an "__err__" entry signals failure).
    voxgig_value* args = clist(2, v_str(fullurl), v_share(fetchdef));
    voxgig_value* out = call_vfn(sys_fetch, args);
    const char* emsg = get_str(out, "__err__");
    if (emsg) {
      *err = context_make_error(ctx, "fetch_system", emsg);
      return NULL;
    }
    return out;
  }

  *err = context_make_error(ctx, "fetch_invalid", "system.fetch is not a valid function");
  return NULL;
}
