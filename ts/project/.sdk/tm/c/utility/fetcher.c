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

#define REDIRECT_MAX 5

static int same_text(const char* a, const char* b) {
  for (; '\0' != *a && tolower((unsigned char)*a) == tolower((unsigned char)*b); a++, b++) {}
  return tolower((unsigned char)*a) == tolower((unsigned char)*b);
}

// The Location resolved against the URL that answered with it (RFC 3986
// 5.2), or NULL when the base has no scheme. The caller frees it.
static char* resolve_location(const char* base, const char* raw) {
  size_t n = 0, rlen = strlen(raw);
  char* loc = (char*)malloc(rlen + 1);
  for (size_t i = 0; i < rlen && '#' != raw[i]; i++) {
    if (!isspace((unsigned char)raw[i])) loc[n++] = raw[i];
  }
  loc[n] = '\0';
  size_t s = 0;
  while (isalnum((unsigned char)loc[s]) || (0 < s && '\0' != loc[s] && NULL != strchr("+-.", loc[s]))) {
    s++;
  }
  if (0 < s && isalpha((unsigned char)loc[0]) && ':' == loc[s]) return loc;

  const char* sep = strstr(base, "://");
  if (NULL == sep) {
    free(loc);
    return NULL;
  }
  const char* auth = sep + 3;
  const char* path = auth + strcspn(auth, "/?#");
  size_t plen = strcspn(path, "?#");
  const char* query = '?' == path[plen] ? path + plen : "";
  size_t qlen = strcspn(query, "#");
  size_t cap = strlen(base) + n + 4;
  char* out = (char*)malloc(cap);
  if ('/' == loc[0] && '/' == loc[1]) {
    snprintf(out, cap, "%.*s:%s", (int)(sep - base), base, loc);
    free(loc);
    return out;
  }

  const char* lq = strchr(loc, '?');
  size_t lplen = NULL == lq ? n : (size_t)(lq - loc);
  char* merged = (char*)malloc(cap);
  if (0 == lplen) {
    snprintf(merged, cap, "%.*s", 0 == plen ? 1 : (int)plen, 0 == plen ? "/" : path);
    if (NULL == lq) lq = query;
  } else if ('/' == loc[0]) {
    snprintf(merged, cap, "%.*s", (int)lplen, loc);
  } else {
    size_t dir = plen;
    while (0 < dir && '/' != path[dir - 1]) dir--;
    snprintf(merged, cap, "%.*s%.*s", 0 == dir ? 1 : (int)dir, 0 == dir ? "/" : path,
      (int)lplen, loc);
  }
  if (NULL == lq) lq = "";

  size_t mlen = strlen(merged), count = 0;
  const char** segs = (const char**)malloc(sizeof(char*) * (mlen + 2));
  size_t* lens = (size_t*)malloc(sizeof(size_t) * (mlen + 2));
  for (const char* p = merged;; ) {
    size_t len = strcspn(p, "/");
    if (2 == len && 0 == strncmp(p, "..", 2)) {
      if (1 < count) count--;
    } else if (!(1 == len && '.' == p[0])) {
      segs[count] = p;
      lens[count++] = len;
    }
    if ('\0' == p[len]) {
      if ((1 == len && '.' == p[0]) || (2 == len && 0 == strncmp(p, "..", 2))) {
        segs[count] = p + len;
        lens[count++] = 0;
      }
      break;
    }
    p += len + 1;
  }
  size_t o = (size_t)snprintf(out, cap, "%.*s", (int)(path - base), base);
  for (size_t i = 0; i < count; i++) {
    o += (size_t)snprintf(out + o, cap - o, "%s%.*s", 0 == i ? "" : "/", (int)lens[i], segs[i]);
  }
  snprintf(out + o, cap - o, "%.*s", (int)(lq == query ? qlen : strlen(lq)), lq);
  free(segs);
  free(lens);
  free(merged);
  free(loc);
  return out;
}

static int same_origin(const char* a, const char* b) {
  const char* as = strstr(a, "://");
  const char* bs = strstr(b, "://");
  if (NULL == as || NULL == bs) return 0;
  size_t alen = (size_t)(as - a) + 3 + strcspn(as + 3, "/?#");
  size_t blen = (size_t)(bs - b) + 3 + strcspn(bs + 3, "/?#");
  if (alen != blen) return 0;
  for (size_t i = 0; i < alen; i++) {
    if (tolower((unsigned char)a[i]) != tolower((unsigned char)b[i])) return 0;
  }
  return 1;
}

// The request as another origin may see it: without its credentials.
static voxgig_value* without_credentials(voxgig_value* fetchdef) {
  voxgig_value* copy = voxgig_clone(fetchdef);
  voxgig_value* headers = getp(copy, "headers");
  if (voxgig_is_map(headers)) {
    voxgig_map* hm = voxgig_as_map(headers);
    voxgig_value* kept = cmap(0);
    for (size_t i = 0; i < hm->len; i++) {
      const char* name = hm->entries[i].key;
      if (!same_text(name, "authorization") && !same_text(name, "cookie") &&
          !same_text(name, "proxy-authorization")) {
        setp(kept, name, hm->entries[i].value);
      }
    }
    setp(copy, "headers", kept);
  }
  return copy;
}

// The default transport follows no redirect. A GET or HEAD follows one here,
// unless the fetch definition says "manual", each hop passing the GET-only
// guard first; past REDIRECT_MAX hops the last 3xx is the answer. Another
// origin is not sent the request's credentials.
static voxgig_value* follow_redirects(Context* ctx, const char* fullurl,
                                      voxgig_value* fetchdef, PNError** err) {
  const char* method = get_str(fetchdef, "method");
  const char* redirect = get_str(fetchdef, "redirect");
  int follow = (NULL == method || '\0' == method[0] || same_text(method, "GET") ||
    same_text(method, "HEAD")) && !(NULL != redirect && 0 == strcmp(redirect, "manual"));
  char* url = (char*)malloc(strlen(fullurl) + 1);
  strcpy(url, fullurl);
  for (int hops = 0;; hops++) {
    *err = getonly_refusal(ctx, url, fetchdef);
    voxgig_value* res = NULL != *err ? NULL : http_fetch(ctx, url, fetchdef, err);
    const char* location = NULL == res ? NULL : get_str(getp(res, "headers"), "location");
    int64_t status = NULL == res ? -1 : to_int(getp(res, "status"));
    int moved = 301 == status || 302 == status || 303 == status || 307 == status || 308 == status;
    char* next = follow && moved && NULL != location && hops < REDIRECT_MAX
      ? resolve_location(url, location) : NULL;
    if (NULL == next) {
      free(url);
      return res;
    }
    if (!same_origin(url, next)) fetchdef = without_credentials(fetchdef);
    free(url);
    url = next;
  }
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
    return follow_redirects(ctx, fullurl, fetchdef, err);
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
