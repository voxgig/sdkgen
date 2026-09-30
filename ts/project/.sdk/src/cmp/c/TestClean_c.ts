import type {
  ModelEntity
} from '@voxgig/apidef'

import {
  cmp,
  each,
  File,
  Content,
  entityCollection,
  targetFeatures,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


import { cIdent, cVarName } from './utility_c'


// A custom action is not a vtable slot the sweep can call by name.
const CRUD = ['list', 'load', 'create', 'update', 'remove']

const DIAGNOSTIC = ['log', 'debug', 'audit', 'telemetry', 'cost', 'metrics', 'clienttrack']


// The canary sweep (twin of TestClean_ts). C is statically typed, so the
// operation candidates the ts sweep finds by reflection are enumerated here
// at generation time; the sweep still DRIVES them to find the first that
// completes with empty arguments.
const TestClean = cmp(function TestClean(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const Name = model.const.Name
  const ident = cIdent(model)

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  const features = Object.keys(targetFeatures(model, target))
    .filter((name) => DIAGNOSTIC.includes(name))
    .sort()

  const candidates: { name: string, fn: string, evar: string, op: string }[] = []
  const entities = each(entityCollection(model)).filter((e: any) => false !== e.active)
  each(entities, (entity: ModelEntity) => {
    const evar = cVarName(entity.name)
    const ops = Object.keys((entity as any).op || {})
      .filter((op) => CRUD.includes(op))
      .sort((a, b) => CRUD.indexOf(a) - CRUD.indexOf(b))
    for (const op of ops) {
      candidates.push({ name: entity.name + '.' + op, fn: 'drive_' + evar + '_' + op, evar, op })
    }
  })

  File({ name: 'clean_test.c' }, () => {
    Content(render({ Name, ident, auth, features, candidates }))
  })
})


function render(spec: {
  Name: string,
  ident: string,
  auth: { suppressed: boolean, where: string, name: string, basic: boolean },
  features: string[],
  candidates: { name: string, fn: string, evar: string, op: string }[],
}): string {
  const { Name, ident, auth, features, candidates } = spec

  const drivers = candidates.map((c) => 'list' === c.op
    ? `static PNError* ${c.fn}(${Name}SDK* sdk, voxgig_value* ctrl, voxgig_value** out) {
  PNError* err = NULL;
  Entity* e = ${ident}_${c.evar}(sdk, NULL);
  Entity** items = e->vt->list(e, v_map(), ctrl, &err);
  if (err) return err;
  voxgig_value* list = v_list();
  for (size_t i = 0; items && items[i]; i++) {
    voxgig_list_push(voxgig_as_list(list), items[i]->vt->data(items[i], NULL));
  }
  *out = list;
  return NULL;
}
`
    : `static PNError* ${c.fn}(${Name}SDK* sdk, voxgig_value* ctrl, voxgig_value** out) {
  PNError* err = NULL;
  Entity* e = ${ident}_${c.evar}(sdk, NULL);
  Entity* r = e->vt->${c.op}(e, v_map(), ctrl, &err);
  if (err) return err;
  *out = r ? r->vt->data(r, NULL) : v_undef();
  return NULL;
}
`).join('\n')

  const table = candidates.map((c) => `  { "${c.name}", ${c.fn} },`).join('\n')

  return `// Generated canary sweep (see TestClean_c): no credential leaves the SDK
// in any form, and the sweep can see one when clean is switched off.

#include "ctest.h"

#include <ctype.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

// Generated: the credential's wire placement is fixed when the SDK is built.
static const bool AUTH_SUPPRESSED = ${auth.suppressed};
static const char* AUTH_WHERE = "${cstr(auth.where)}";
static const char* AUTH_NAME = "${cstr(auth.name)}";

// The diagnostic features this SDK ships.
static const char* FEATURES[] = { ${features.map((f) => '"' + f + '"').join(', ')}${0 < features.length ? ', ' : ''}NULL };

static const char* CANARY_APIKEY = "CANARY-APIKEY-k9x2m7q4p1";
static const char* CANARY_SECRET = "CANARY-SECRET-w3e8r5t2y6";
static const char* CANARY_HEADER = "CANARY-HEADER-z1x4c7v0b3";
static const char* CANARY_VALUE = "CANARY-VALUE-n5m8b2v9c4";

static const char* MASK = "[redacted]";

// The sweep's own encoders: a leak of an encoded form must not hide behind
// the SDK's encoder.
static char* b64(const char* in) {
  static const char ALPHABET[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  size_t n = strlen(in);
  char* out = (char*)malloc((n + 2) / 3 * 4 + 1);
  size_t o = 0;
  for (size_t i = 0; i < n; i += 3) {
    unsigned int v = (unsigned char)in[i] << 16;
    if (i + 1 < n) v |= (unsigned int)(unsigned char)in[i + 1] << 8;
    if (i + 2 < n) v |= (unsigned int)(unsigned char)in[i + 2];
    out[o++] = ALPHABET[(v >> 18) & 0x3f];
    out[o++] = ALPHABET[(v >> 12) & 0x3f];
    out[o++] = (i + 1 < n) ? ALPHABET[(v >> 6) & 0x3f] : '=';
    out[o++] = (i + 2 < n) ? ALPHABET[v & 0x3f] : '=';
  }
  out[o] = '\\0';
  return out;
}

static char* pct(const char* in) {
  size_t n = strlen(in);
  char* out = (char*)malloc(n * 3 + 1);
  size_t o = 0;
  for (size_t i = 0; i < n; i++) {
    unsigned char c = (unsigned char)in[i];
    if (isalnum(c) || strchr("-_.!~*'()", c)) {
      out[o++] = (char)c;
    } else {
      o += (size_t)sprintf(out + o, "%%%02X", c);
    }
  }
  out[o] = '\\0';
  return out;
}

// Every form a canary can travel in.
static const char* FORMS[16];
static size_t NFORMS = 0;

static void build_forms(void) {
  const char* canaries[4] = { CANARY_APIKEY, CANARY_SECRET, CANARY_HEADER, CANARY_VALUE };
  for (int i = 0; i < 4; i++) {
    FORMS[NFORMS++] = canaries[i];
    FORMS[NFORMS++] = b64(canaries[i]);
    FORMS[NFORMS++] = pct(canaries[i]);
  }
  char pair[256];
  snprintf(pair, sizeof(pair), "%s:%s", CANARY_APIKEY, CANARY_SECRET);
  FORMS[NFORMS++] = b64(pair);
}

typedef struct {
  const char* name;
  char* text;
} Sink;

static Sink* SINKS = NULL;
static size_t NSINKS = 0;
static size_t CAPSINKS = 0;

static void push(const char* name, char* text) {
  if (NSINKS == CAPSINKS) {
    CAPSINKS = CAPSINKS ? CAPSINKS * 2 : 64;
    SINKS = (Sink*)realloc(SINKS, CAPSINKS * sizeof(Sink));
  }
  SINKS[NSINKS].name = name;
  SINKS[NSINKS].text = text ? text : strdup("");
  NSINKS++;
}

static void push_value(const char* name, voxgig_value* val) {
  push(name, voxgig_jsonify(val, NULL));
  push(name, voxgig_stringify(val, -1));
}

static void push_error(const char* name, PNError* err) {
  push(name, strdup(err->msg ? err->msg : ""));
  push(name, pn_error_str(err));
  push(name, voxgig_jsonify(err->spec, NULL));
  push(name, voxgig_jsonify(err->result, NULL));
}

static voxgig_value* capture_fn(void* ud, voxgig_value* arg) {
  push_value((const char*)ud, arg);
  return v_undef();
}

// Captures the serialised context from inside the pipeline: what a hook
// author would hand to a logger.
typedef struct {
  Feature base;
} CaptureFeature;

static const char* capture_name(Feature* f) { (void)f; return "capture"; }
static bool capture_active(Feature* f) { (void)f; return true; }
static voxgig_value* capture_add_options(Feature* f) { (void)f; return NULL; }
static void capture_init(Feature* f, Context* ctx, voxgig_value* options) {
  (void)f; (void)ctx; (void)options;
}
static void capture_hook(Feature* f, const char* name, Context* ctx) {
  (void)f;
  if (0 == strcmp(name, "PreRequest") || 0 == strcmp(name, "PreResponse") ||
      0 == strcmp(name, "PreUnexpected")) {
    push("ctx", context_str(ctx));
    push_value("ctx", context_to_value(ctx));
  }
}

static const FeatureVT CAPTURE_VT = {
  capture_name, capture_active, capture_add_options, capture_init, capture_hook, NULL,
};

enum { SC_OK = 0, SC_NOTFOUND, SC_SERVER, SC_TRANSPORT, SC_NOTJSON, SC_COUNT };
static const char* SC_NAMES[] = { "ok", "notfound", "server", "transport", "notjson" };

static voxgig_value* response(int status, voxgig_value* data, const char* hk, const char* hv) {
  voxgig_value* headers = cmap(1, "content-type", v_str("application/json"));
  if (hk) setp(headers, hk, v_str(hv));
  return cmap(5,
    "status", v_num((double)status),
    "statusText", v_str(status < 400 ? "OK" : "ERR"),
    "headers", headers,
    "body", v_str(voxgig_jsonify(data, NULL)),
    "json", json_thunk(data));
}

static voxgig_value* respond(int sc, const char* url) {
  switch (sc) {
    case SC_OK:
      return response(200, cmap(2, "id", v_str("i1"), "name", v_str("n1")),
                      "x-session-token", "RESP-TOKEN-a1b2c3d4e5");
    case SC_NOTFOUND:
      return response(404, cmap(1, "error", v_str("no such record")), NULL, NULL);
    case SC_SERVER:
      return response(500, cmap(1, "error", v_str("boom")), NULL, NULL);
    case SC_TRANSPORT: {
      char msg[2048];
      snprintf(msg, sizeof(msg), "socket hang up (URL was: \\"%s\\")", url);
      return cmap(1, "__err__", v_str(msg));
    }
    default:
      return cmap(5,
        "status", v_num(200),
        "statusText", v_str("OK"),
        "headers", v_map(),
        "body", v_str("<html>"),
        "json", json_thunk(v_undef()));
  }
}

// The transport seam: system.fetch is called with [url, fetchdef].
static voxgig_value* transport_fn(void* ud, voxgig_value* args) {
  int sc = (int)(intptr_t)ud;
  const char* url = "";
  if (voxgig_is_list(args) && 0 < voxgig_as_list(args)->len) {
    voxgig_value* u = voxgig_as_list(args)->items[0];
    if (voxgig_is_string(u)) url = voxgig_as_string(u);
  }
  return respond(sc, url);
}

static ${Name}SDK* make_sdk(int sc, voxgig_value* cleanopts) {
  voxgig_value* feature = v_map();
  for (size_t i = 0; FEATURES[i]; i++) {
    const char* name = FEATURES[i];
    voxgig_value* fopts = cmap(1, "active", v_bool(true));
    if (0 == strcmp(name, "log")) setp(fopts, "logger", vfn(capture_fn, (void*)"log"));
    else if (0 == strcmp(name, "debug")) setp(fopts, "onEntry", vfn(capture_fn, (void*)"debug"));
    else if (0 == strcmp(name, "audit")) setp(fopts, "sink", vfn(capture_fn, (void*)"audit"));
    else if (0 == strcmp(name, "telemetry")) setp(fopts, "exporter", vfn(capture_fn, (void*)"telemetry"));
    else if (0 == strcmp(name, "cost")) setp(fopts, "sink", vfn(capture_fn, (void*)"cost"));
    setp(feature, name, fopts);
  }

  voxgig_value* clean = cmap(1, "values", v_str(CANARY_VALUE));
  if (voxgig_is_map(cleanopts)) {
    voxgig_map* m = voxgig_as_map(cleanopts);
    for (size_t i = 0; i < m->len; i++) {
      setp(clean, m->entries[i].key, voxgig_retain(m->entries[i].value));
    }
  }

  ${Name}SDK* sdk = ${ident}_sdk_new(cmap(6,
    "apikey", v_str(CANARY_APIKEY),
    "secret", v_str(CANARY_SECRET),
    "headers", cmap(1, "X-Custom-Token", v_str(CANARY_HEADER)),
    "clean", clean,
    "feature", feature,
    "system", cmap(1, "fetch", vfn(transport_fn, (void*)(intptr_t)sc))));

  // C options are pure data, so the extension feature is added after
  // construction (the \`extend\` option of the ts client).
  CaptureFeature* cf = (CaptureFeature*)calloc(1, sizeof(CaptureFeature));
  cf->base.vt = &CAPTURE_VT;
  sdk_features_push(sdk, (Feature*)cf);

  return sdk;
}

typedef PNError* (*Drive)(${Name}SDK* sdk, voxgig_value* ctrl, voxgig_value** out);

${drivers}
// Generated: every CRUD operation of every active entity, list and load
// first (they need no body).
static const struct { const char* name; Drive fn; } CANDIDATES[] = {
${table}
  { NULL, NULL },
};

// The first operation that completes against a plain 200 with no arguments
// (a required path parameter would fail before the request is built).
static Drive usable_op(void) {
  ${Name}SDK* plain = ${ident}_sdk_new(cmap(2,
    "apikey", v_str(CANARY_APIKEY),
    "system", cmap(1, "fetch", vfn(transport_fn, (void*)(intptr_t)SC_OK))));
  for (size_t i = 0; CANDIDATES[i].name; i++) {
    voxgig_value* out = NULL;
    PNError* err = CANDIDATES[i].fn(plain, NULL, &out);
    if (!err) return CANDIDATES[i].fn;
  }
  return NULL;
}

static PNError* drive(${Name}SDK* sdk, Drive op, voxgig_value* ctrl) {
  voxgig_value* out = NULL;
  PNError* err = op(sdk, ctrl, &out);
  if (err) {
    push_error("error", err);
  } else {
    push_value("result", out ? out : v_undef());
  }
  return err;
}

// Header maps keep the caller's spelling; the assertion should not care.
static const char* header(voxgig_value* map, const char* name) {
  if (!voxgig_is_map(map)) return NULL;
  voxgig_map* m = voxgig_as_map(map);
  for (size_t i = 0; i < m->len; i++) {
    if (0 == strcasecmp(m->entries[i].key, name)) {
      voxgig_value* v = m->entries[i].value;
      return voxgig_is_string(v) ? voxgig_as_string(v) : voxgig_stringify(v, -1);
    }
  }
  return NULL;
}

static size_t leaks(const char* text, char* found, size_t cap) {
  size_t n = 0;
  found[0] = '\\0';
  for (size_t i = 0; i < NFORMS; i++) {
    if (strstr(text, FORMS[i])) {
      if (n) strncat(found, ", ", cap - strlen(found) - 1);
      strncat(found, FORMS[i], cap - strlen(found) - 1);
      n++;
    }
  }
  return n;
}

static bool ends_with(const char* s, const char* suffix) {
  size_t sl = strlen(s);
  size_t xl = strlen(suffix);
  return sl >= xl && 0 == strcmp(s + sl - xl, suffix);
}

int main(void) {
  build_forms();

  Drive op = usable_op();
  CHECK(op != NULL, "no operation completes without arguments; nothing to sweep");
  if (!op) TEST_SUMMARY("clean");

  PNError* notfound = NULL;
  voxgig_value* explained = NULL;

  for (int sc = 0; sc < SC_COUNT; sc++) {
    for (int variant = 0; variant < 3; variant++) {
      ${Name}SDK* sdk = make_sdk(sc, NULL);
      voxgig_value* explain = v_map();
      voxgig_value* ctrl = NULL;
      if (1 == variant) ctrl = cmap(1, "explain", explain);
      if (2 == variant) ctrl = cmap(2, "throw", v_bool(false), "explain", explain);
      PNError* err = drive(sdk, op, ctrl);
      if (SC_NOTFOUND == sc && 0 == variant) notfound = err;
      if (0 != variant) {
        push_value("explain", explain);
        if (SC_OK == sc && 1 == variant) explained = explain;
      }
      (void)SC_NAMES;
    }
  }

  size_t nleaks = 0;
  char found[4096];
  for (size_t i = 0; i < NSINKS; i++) {
    if (leaks(SINKS[i].text, found, sizeof(found))) {
      fprintf(stderr, "credential leaked through: %s [%s]\\n", SINKS[i].name, found);
      nleaks++;
    }
  }

  printf("clean: swept %zu surface(s), %zu leak(s)\\n", NSINKS, nleaks);
  CHECK(0 == nleaks, "a credential leaked (see above)");

  // The positive half: the slot the credential travelled in is masked, and
  // an unregistered token in a response header is masked by name.
  CHECK(notfound != NULL, "the 404 scenario must throw");
  if (notfound) {
    CHECK_INT_EQ(to_int(getp(notfound->result, "status")), 404, "the 404 error carries its status");
    voxgig_value* headers = getp(notfound->spec, "headers");
    if (!AUTH_SUPPRESSED) {
      if (0 == strcmp(AUTH_WHERE, "query")) {
        CHECK_STR_EQ(header(getp(notfound->spec, "query"), AUTH_NAME), MASK, "the query credential is masked");
      } else if (0 == strcmp(AUTH_WHERE, "cookie")) {
        const char* cookie = header(headers, "cookie");
        CHECK(cookie && strstr(cookie, MASK), "the cookie credential is masked");
      } else {
        const char* cred = header(headers, AUTH_NAME);
        CHECK(cred && ends_with(cred, MASK), "the header credential is masked");
      }
    }
    CHECK_STR_EQ(header(headers, "x-custom-token"), MASK, "a custom token header is masked by name");
  }

  CHECK(explained != NULL && voxgig_is_map(getp(explained, "result")),
        "the explain record should carry the result");
  if (explained) {
    CHECK_STR_EQ(header(getp(getp(explained, "result"), "headers"), "x-session-token"), MASK,
                 "a response token header is masked by name");
  }

  // The negative control: with clean switched off the canary MUST show, or
  // the sweep is blind.
  size_t before = NSINKS;
  ${Name}SDK* raw = make_sdk(SC_NOTFOUND, cmap(1, "active", v_bool(false)));
  PNError* rawerr = drive(raw, op, NULL);
  CHECK(rawerr != NULL, "the 404 scenario must throw with clean off");
  size_t shown = 0;
  for (size_t i = before; i < NSINKS; i++) {
    if (leaks(SINKS[i].text, found, sizeof(found))) shown++;
  }
  CHECK(0 < shown, "with clean off, nothing showed the canary: the sweep is blind");
  if (rawerr && !AUTH_SUPPRESSED) {
    char* text = voxgig_jsonify(rawerr->spec, NULL);
    char pair[256];
    snprintf(pair, sizeof(pair), "%s:%s", CANARY_APIKEY, CANARY_SECRET);
    char* pairb64 = b64(pair);
    CHECK(strstr(text, CANARY_APIKEY) || strstr(text, pairb64),
          "the raw spec should carry the credential when clean is off");
  }

  TEST_SUMMARY("clean");
}
`
}


function cstr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}


export {
  TestClean
}
