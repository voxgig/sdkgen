#ifndef SDK_TEST_AUTH_CREDENTIAL_H
#define SDK_TEST_AUTH_CREDENTIAL_H

#include "feature_harness.h"

typedef struct {
  const char* bag;
  const char* name;
  char* pair;
} AuthCredential;

static voxgig_value* auth_bag(Spec* spec, AuthCredential cred) {
  return strcmp(cred.bag, "query") == 0 ? spec->query : spec->headers;
}

static AuthCredential auth_probe(bool basic) {
  ProjectNameSDK* client = test_sdk(v_undef(), cmap(3,
    "apikey", v_str("K"), "secret", v_str(basic ? "S" : ""),
    "auth", cmap(2, "prefix", v_str("Bearer"), "basic", v_bool(basic))));
  CtxSpec cs = {0};
  cs.client = client;
  cs.utility = sdk_get_utility(client);
  Context* ctx = make_context_util(cs, sdk_get_root_ctx(client));
  ctx->spec = spec_new(cmap(2, "headers", v_map(), "query", v_map()));
  PNError* err = NULL;
  prepare_auth_util(ctx, &err);
  CHECK(err == NULL, "credential probe failed");
  AuthCredential cred = {"headers", NULL, ""};
  const char* bags[] = {"headers", "query"};
  for (int i = 0; i < 2; i++) {
    cred.bag = bags[i];
    voxgig_map* bag = voxgig_as_map(auth_bag(ctx->spec, cred));
    if (bag && bag->len) {
      cred.name = bag->entries[0].key;
      const char* value = get_str(auth_bag(ctx->spec, cred), cred.name);
      const char* eq = value ? strchr(value, '=') : NULL;
      if (i == 0 && strcmp(cred.name, "cookie") == 0 && eq && eq > value &&
          strcmp(eq, "=K") == 0 && !strchr(value, ';')) {
        cred.pair = strndup(value, (size_t)(eq - value + 1));
      }
      return cred;
    }
  }
  return cred;
}

static AuthCredential auth_credential(void) {
  AuthCredential cred = auth_probe(false);
  AuthCredential any = auth_probe(true);
  CHECK((cred.name == NULL) == (any.name == NULL), "credential probe missed Basic auth");
  return cred;
}

static voxgig_value* auth_expected(AuthCredential cred, const char* prefix, const char* key) {
  if (!cred.name) return v_undef();
  char text[2048];
  if (*cred.pair) snprintf(text, sizeof(text), "%s%s", cred.pair, key);
  else if (strcmp(cred.bag, "headers") == 0 && *prefix)
    snprintf(text, sizeof(text), "%s %s", prefix, key);
  else snprintf(text, sizeof(text), "%s", key);
  return v_str(text);
}

static voxgig_value* auth_actual(Spec* spec, AuthCredential cred) {
  if (cred.name) return getp(auth_bag(spec, cred), cred.name);
  CHECK(voxgig_as_map(spec->headers)->len == 0 && voxgig_as_map(spec->query)->len == 0,
        "public API placed a credential");
  return v_undef();
}

static Spec* auth_seed(AuthCredential cred) {
  Spec* spec = spec_new(cmap(2, "headers", v_map(), "query", v_map()));
  if (cred.name) setp(auth_bag(spec, cred), cred.name, auth_expected(cred, "", "stale"));
  return spec;
}

#endif
