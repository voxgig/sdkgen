// Response caching for safe (read) requests, per client (mirrors
// feature/cache.rs): see the features reference for the key, the write
// invalidation and the Cache-Control rules.

// C has no HMAC: SipHash-2-4 under a random per-client key separates header
// sets within one store without holding a header value. It is not a
// cryptographic commitment.

#include "sdk.h"

#include <ctype.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

typedef struct {
  // string-keyed store (voxgig_map, insertion-ordered) mapping
  // "METHOD url" -> { expiry: num, snap: <snapshot map> }.
  voxgig_value* store;
  // FIFO insertion order of keys (may contain duplicates, mirrors rust Vec).
  voxgig_value* order;
  uint8_t secret[16];

  // Activity tracking (mirrors the ts client._cache record).
  int64_t hit;
  int64_t miss;
  int64_t bypass;
} CacheTrack;

typedef struct {
  Feature base;
  char* name;
  bool active;
  voxgig_value* add_opts;
  voxgig_value* options;
  CacheTrack* track;
} CacheFeature;

typedef struct {
  Fetcher* inner;
  voxgig_value* options;
  CacheTrack* track;
} CacheState;

// ---- local string helpers -------------------------------------------------

static char* str_upper(const char* s) {
  size_t n = strlen(s);
  char* r = (char*)malloc(n + 1);
  for (size_t i = 0; i < n; i++) r[i] = (char)toupper((unsigned char)s[i]);
  r[n] = '\0';
  return r;
}

static char* str_lower(const char* s) {
  size_t n = strlen(s);
  char* r = (char*)malloc(n + 1);
  for (size_t i = 0; i < n; i++) r[i] = (char)tolower((unsigned char)s[i]);
  r[n] = '\0';
  return r;
}

// Mirrors fopt_str_list(options,key).unwrap_or_else(defaults) followed by an
// `any(...)` membership test: when the option is a list, only its string
// elements are considered (defaults ignored); otherwise the defaults apply.
// Comparison is case-insensitive when `ci`.
static bool option_list_match(voxgig_value* options, const char* key,
                              const char* needle, const char** defaults,
                              size_t ndefaults, bool ci) {
  voxgig_value* lst = getp(options, key);
  if (voxgig_is_list(lst)) {
    voxgig_list* l = voxgig_as_list(lst);
    for (size_t i = 0; i < l->len; i++) {
      voxgig_value* item = l->items[i];
      if (voxgig_is_string(item)) {
        const char* s = voxgig_as_string(item);
        if (ci ? (strcasecmp(s, needle) == 0) : (strcmp(s, needle) == 0)) return true;
      }
    }
    return false;
  }
  for (size_t i = 0; i < ndefaults; i++) {
    if (ci ? (strcasecmp(defaults[i], needle) == 0) : (strcmp(defaults[i], needle) == 0))
      return true;
  }
  return false;
}

#define SIP_ROTL(x, b) (uint64_t)(((x) << (b)) | ((x) >> (64 - (b))))
#define SIP_ROUND(v0, v1, v2, v3) do { \
    v0 += v1; v1 = SIP_ROTL(v1, 13); v1 ^= v0; v0 = SIP_ROTL(v0, 32); \
    v2 += v3; v3 = SIP_ROTL(v3, 16); v3 ^= v2; \
    v0 += v3; v3 = SIP_ROTL(v3, 21); v3 ^= v0; \
    v2 += v1; v1 = SIP_ROTL(v1, 17); v1 ^= v2; v2 = SIP_ROTL(v2, 32); } while (0)

static uint64_t sip_le64(const uint8_t* p) {
  uint64_t v = 0;
  for (int i = 7; i >= 0; i--) v = (v << 8) | p[i];
  return v;
}

uint64_t feature_cache_siphash24(const uint8_t key[16], const uint8_t* in, size_t len) {
  uint64_t k0 = sip_le64(key), k1 = sip_le64(key + 8);
  uint64_t v0 = 0x736f6d6570736575ULL ^ k0, v1 = 0x646f72616e646f6dULL ^ k1;
  uint64_t v2 = 0x6c7967656e657261ULL ^ k0, v3 = 0x7465646279746573ULL ^ k1;
  size_t full = len - (len % 8);
  for (size_t i = 0; i < full; i += 8) {
    uint64_t m = sip_le64(in + i);
    v3 ^= m;
    SIP_ROUND(v0, v1, v2, v3);
    SIP_ROUND(v0, v1, v2, v3);
    v0 ^= m;
  }
  uint64_t b = ((uint64_t)len) << 56;
  for (size_t i = 0; i < len % 8; i++) b |= ((uint64_t)in[full + i]) << (8 * i);
  v3 ^= b;
  SIP_ROUND(v0, v1, v2, v3);
  SIP_ROUND(v0, v1, v2, v3);
  v0 ^= b;
  v2 ^= 0xff;
  for (int i = 0; i < 4; i++) SIP_ROUND(v0, v1, v2, v3);
  return v0 ^ v1 ^ v2 ^ v3;
}

// The system's random source where it has one; otherwise rand(), which is
// not a cryptographic generator.
static void cache_secret(uint8_t out[16]) {
  size_t got = 0;
  FILE* f = fopen("/dev/urandom", "rb");
  if (f) {
    got = fread(out, 1, 16, f);
    fclose(f);
  }
  uint64_t mix = (uint64_t)time(NULL) ^ (uint64_t)(uintptr_t)out;
  for (size_t i = got; i < 16; i++) out[i] = (uint8_t)((rand() ^ (int)(mix >> (i % 8 * 8))) & 0xff);
}

static char* header_text(voxgig_value* v) {
  char b[64];
  if (voxgig_is_string(v)) return strdup(voxgig_as_string(v));
  if (voxgig_is_int(v)) {
    snprintf(b, sizeof(b), "%lld", (long long)voxgig_as_int(v));
    return strdup(b);
  }
  if (voxgig_is_double(v)) {
    double d = voxgig_as_double(v);
    if (d == (double)(long long)d) snprintf(b, sizeof(b), "%lld", (long long)d);
    else snprintf(b, sizeof(b), "%g", d);
    return strdup(b);
  }
  if (voxgig_is_bool(v)) return strdup(voxgig_as_bool(v) ? "true" : "false");
  return NULL;
}

typedef struct {
  char* name;
  char* value;
} HeaderPair;

static int pair_cmp(const void* a, const void* b) {
  const HeaderPair* x = (const HeaderPair*)a;
  const HeaderPair* y = (const HeaderPair*)b;
  int c = strcmp(x->name, y->name);
  return c != 0 ? c : strcmp(x->value, y->value);
}

static char* digest(const uint8_t secret[16], voxgig_value* headers) {
  size_t n = 0, total = 0;
  HeaderPair* pairs = NULL;
  if (voxgig_is_map(headers)) {
    voxgig_map* hm = voxgig_as_map(headers);
    pairs = (HeaderPair*)calloc(hm->len + 1, sizeof(HeaderPair));
    for (size_t i = 0; i < hm->len; i++) {
      char* value = header_text(hm->entries[i].value);
      if (!value) continue;
      pairs[n].name = str_lower(hm->entries[i].key);
      pairs[n].value = value;
      total += strlen(pairs[n].name) + strlen(value) + 2;
      n++;
    }
    qsort(pairs, n, sizeof(HeaderPair), pair_cmp);
  }
  char* text = (char*)calloc(total + 1, 1);
  size_t at = 0;
  for (size_t i = 0; i < n; i++) {
    at += (size_t)sprintf(text + at, "%s:%s\n", pairs[i].name, pairs[i].value);
    free(pairs[i].name);
    free(pairs[i].value);
  }
  free(pairs);
  char* hex = (char*)malloc(17);
  snprintf(hex, 17, "%016llx", (unsigned long long)feature_cache_siphash24(secret, (const uint8_t*)text, at));
  free(text);
  return hex;
}

static char* url_scope(const char* url) {
  size_t n = strcspn(url, "?#");
  while (n > 0 && url[n - 1] == '/') n--;
  char* r = (char*)malloc(n + 1);
  memcpy(r, url, n);
  r[n] = '\0';
  return r;
}

static char* url_parent(const char* scope) {
  const char* scheme = strstr(scope, "://");
  size_t root = 0;
  if (scheme) {
    const char* slash = strchr(scheme + 3, '/');
    if (!slash) return strdup(scope);
    root = (size_t)(slash - scope);
  }
  const char* last = strrchr(scope, '/');
  size_t cut = last ? (size_t)(last - scope) : 0;
  if (cut < root) cut = root;
  char* r = (char*)malloc(cut + 1);
  memcpy(r, scope, cut);
  r[cut] = '\0';
  return r;
}

static bool scope_under(const char* scope, const char* prefix) {
  size_t n = strlen(prefix);
  return strncmp(scope, prefix, n) == 0 && (scope[n] == '\0' || scope[n] == '/');
}

static void drop_entry(CacheTrack* t, const char* key) {
  voxgig_list* order = voxgig_as_list(t->order);
  for (size_t i = order->len; i > 0; i--) {
    if (strcmp(voxgig_as_string(order->items[i - 1]), key) == 0) voxgig_list_erase(order, i - 1);
  }
  voxgig_map_erase(voxgig_as_map(t->store), key);
}

static void invalidate(CacheTrack* t, const char* url) {
  char* path = url_scope(url);
  char* collection = url_parent(path);
  voxgig_map* store = voxgig_as_map(t->store);
  for (size_t i = store->len; i > 0; i--) {
    const char* scope = get_str(store->entries[i - 1].value, "scope");
    if (scope && (scope_under(scope, path) || strcmp(scope, collection) == 0)) {
      char* key = strdup(store->entries[i - 1].key);
      drop_entry(t, key);
      free(key);
    }
  }
  free(collection);
  free(path);
}

// The configured ttl capped by the response's Cache-Control; zero when the
// response may not be stored.
static int64_t lifetime(voxgig_value* headers, int64_t ttl) {
  char* control = NULL;
  if (voxgig_is_map(headers)) {
    voxgig_map* hm = voxgig_as_map(headers);
    for (size_t i = 0; i < hm->len; i++) {
      if (strcasecmp(hm->entries[i].key, "cache-control") == 0) {
        free(control);
        char* raw = header_text(hm->entries[i].value);
        control = raw ? str_lower(raw) : NULL;
        free(raw);
      }
    }
  }
  int64_t life = ttl;
  if (!control) return life;
  for (char* part = control; part; ) {
    char* comma = strchr(part, ',');
    if (comma) *comma = '\0';
    char* next = comma ? comma + 1 : NULL;
    while (isspace((unsigned char)*part)) part++;
    size_t n = strlen(part);
    while (n > 0 && isspace((unsigned char)part[n - 1])) part[--n] = '\0';
    if (strcmp(part, "no-store") == 0 || strcmp(part, "private") == 0 ||
        strcmp(part, "no-cache") == 0) {
      free(control);
      return 0;
    }
    if (strncmp(part, "max-age", 7) == 0) {
      char* v = part + 7;
      while (isspace((unsigned char)*v)) v++;
      if (*v != '=') { part = next; continue; }
      v++;
      while (isspace((unsigned char)*v)) v++;
      if (*v == '"') v++;
      char* end = v;
      while (isdigit((unsigned char)*end)) end++;
      if (end != v && end - v < 16 && (*end == '\0' || (*end == '"' && end[1] == '\0'))) {
        int64_t secs = (int64_t)strtoll(v, NULL, 10);
        if (secs * 1000 < life) life = secs * 1000;
      }
    }
    part = next;
  }
  free(control);
  return life;
}

// A body the transport could not read as JSON passes through, for the operation to report.
static bool storable(voxgig_value* res) {
  int64_t status;
  bool unreadable = false;
  get_bool(res, "unreadable", &unreadable);
  return fres_status(res, &status) && status >= 200 && status < 300 && !unreadable;
}

// A body that declares another type than JSON passes by, unread.
static bool json(voxgig_value* res) {
  voxgig_value* rh = getp(res, "headers");
  if (!voxgig_is_map(rh)) return true;
  voxgig_map* hm = voxgig_as_map(rh);
  for (size_t i = 0; i < hm->len; i++) {
    voxgig_value* v = hm->entries[i].value;
    if (0 == strcasecmp(hm->entries[i].key, "content-type") && voxgig_is_string(v)) {
      const char* t = voxgig_as_string(v);
      return '\0' == t[strspn(t, " \t")] || media_is_json(t);
    }
  }
  return true;
}

// snapshot captures the response as a re-readable map:
// { status: num, statusText: str, data: <json>, headers: <lowercased map> }.
static voxgig_value* snapshot(voxgig_value* res) {
  voxgig_value* headers = voxgig_new_map();
  voxgig_value* rh = getp(res, "headers");
  if (voxgig_is_map(rh)) {
    voxgig_map* hm = voxgig_as_map(rh);
    for (size_t i = 0; i < hm->len; i++) {
      char* lower = str_lower(hm->entries[i].key);
      setp(headers, lower, hm->entries[i].value);
      free(lower);
    }
  }

  int64_t status = 0;
  fres_status(res, &status); // unwrap_or(0)
  const char* stext = get_str(res, "statusText");

  return cmap(4,
    "status", v_num((double)status),
    "statusText", v_str(stext ? stext : ""),
    "data", call_json(getp(res, "json")),
    "headers", headers);
}

// replay builds a fresh transport-shaped response so the body stays
// re-readable for every consumer.
static voxgig_value* replay(voxgig_value* snap) {
  voxgig_value* headers = voxgig_new_map();
  voxgig_value* sh = getp(snap, "headers");
  if (voxgig_is_map(sh)) {
    voxgig_map* hm = voxgig_as_map(sh);
    for (size_t i = 0; i < hm->len; i++) {
      setp(headers, hm->entries[i].key, hm->entries[i].value);
    }
  }

  int64_t status = to_int(getp(snap, "status"));
  const char* stext = get_str(snap, "statusText");

  return cmap(5,
    "status", v_num((double)status),
    "statusText", v_str(stext ? stext : ""),
    "body", v_str("not-used"),
    "json", json_thunk(getp(snap, "data")),
    "headers", headers);
}

// evict drops oldest entries (FIFO) until the store is under `max`.
static void evict(CacheTrack* t, voxgig_value* options) {
  int64_t max = fopt_int(options, "max", 256);
  voxgig_map* store = voxgig_as_map(t->store);
  voxgig_list* order = voxgig_as_list(t->order);
  while ((int64_t)store->len >= max && order->len > 0) {
    char* oldest = strdup(voxgig_as_string(order->items[0]));
    voxgig_list_erase(order, 0);
    voxgig_map_erase(store, oldest);
    free(oldest);
  }
}

static voxgig_value* through(Fetcher* self, Context* ctx, const char* url,
                             voxgig_value* fetchdef, PNError** err) {
  CacheState* st = (CacheState*)self->state;
  voxgig_value* options = st->options;
  CacheTrack* track = st->track;

  const char* mraw = get_str(fetchdef, "method");
  char* method = (mraw && mraw[0] != '\0') ? str_upper(mraw) : strdup("GET");

  static const char* MDEF[] = {"GET"};
  bool cacheable = option_list_match(options, "methods", method, MDEF, 1, true);
  if (!cacheable) {
    bool safe = strcmp(method, "GET") == 0 || strcmp(method, "HEAD") == 0;
    free(method);
    voxgig_value* passed = st->inner->fn(st->inner, ctx, url, fetchdef, err);
    if (!safe) invalidate(track, url);
    return passed;
  }

  char* hdigest = digest(track->secret, getp(fetchdef, "headers"));
  size_t klen = strlen(method) + 1 + strlen(url) + 1 + strlen(hdigest) + 1;
  char* key = (char*)malloc(klen);
  snprintf(key, klen, "%s %s %s", method, url, hdigest);
  free(hdigest);
  free(method);

  int64_t now = fopt_now_call(options);

  voxgig_value* entry = voxgig_map_get(voxgig_as_map(track->store), key);
  if (entry) {
    int64_t expiry = to_int(getp(entry, "expiry"));
    if (expiry > now) {
      voxgig_value* snap = getp(entry, "snap");
      track->hit += 1;
      free(key);
      *err = NULL;
      return replay(snap);
    }
  }

  PNError* e = NULL;
  voxgig_value* out = st->inner->fn(st->inner, ctx, url, fetchdef, &e);

  if (!e && storable(out) && json(out)) {
    voxgig_value* snap = snapshot(out);
    int64_t ttl = lifetime(getp(snap, "headers"), fopt_int(options, "ttl", 5000));
    if (ttl <= 0) {
      track->bypass += 1;
      free(key);
      *err = NULL;
      return replay(snap);
    }
    drop_entry(track, key);
    evict(track, options);
    char* scope = url_scope(url);
    voxgig_value* newentry = cmap(3,
      "expiry", v_num((double)(now + ttl)),
      "scope", v_str(scope),
      "snap", snap);
    free(scope);
    voxgig_map_set(voxgig_as_map(track->store), key, newentry);
    voxgig_list_push(voxgig_as_list(track->order), v_str(key));
    track->miss += 1;
    free(key);
    *err = NULL;
    return replay(snap);
  }

  track->bypass += 1;
  free(key);
  *err = e;
  return out;
}

static const char* cache_name(Feature* f) { return ((CacheFeature*)f)->name; }
static bool cache_active(Feature* f) { return ((CacheFeature*)f)->active; }
static voxgig_value* cache_add_options(Feature* f) { return ((CacheFeature*)f)->add_opts; }

static void cache_init(Feature* f, Context* ctx, voxgig_value* options) {
  CacheFeature* cf = (CacheFeature*)f;
  cf->options = options;
  cf->active = fopt_bool(options, "active", false);
  if (!cf->active) return;

  Utility* util = context_util(ctx);
  CacheState* st = (CacheState*)calloc(1, sizeof(CacheState));
  st->inner = util->fetcher;
  st->options = options;
  st->track = cf->track;
  cache_secret(cf->track->secret);

  Fetcher* wrapped = (Fetcher*)calloc(1, sizeof(Fetcher));
  wrapped->fn = through;
  wrapped->state = st;
  util->fetcher = wrapped;
}

static void cache_hook(Feature* f, const char* name, Context* ctx) {
  (void)f; (void)name; (void)ctx;
}

static voxgig_value* cache_track(Feature* f) {
  CacheTrack* t = ((CacheFeature*)f)->track;
  return cmap(3, "hit", v_num((double)t->hit), "miss", v_num((double)t->miss),
              "bypass", v_num((double)t->bypass));
}

static const FeatureVT CACHE_VT = {
  cache_name, cache_active, cache_add_options, cache_init, cache_hook,
  cache_track,
};

Feature* feature_cache_new(void) {
  CacheFeature* cf = (CacheFeature*)calloc(1, sizeof(CacheFeature));
  cf->base.vt = &CACHE_VT;
  cf->name = strdup("cache");
  cf->active = true; // matches rust default (overridden by init from options)
  cf->add_opts = NULL;
  cf->options = voxgig_new_undef();
  cf->track = (CacheTrack*)calloc(1, sizeof(CacheTrack));
  cf->track->store = voxgig_new_map();
  cf->track->order = voxgig_new_list();
  return (Feature*)cf;
}
