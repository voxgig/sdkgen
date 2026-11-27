// The keys an operation is looked up and filed by (mirrors ts
// src/utility/OpKeyUtility.ts).

#include "sdk.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// An unset name reads as `_` on an Operation (operation_new).
static bool op_name_set(const char* s) {
  return NULL != s && '\0' != s[0] && 0 != strcmp(s, "_");
}

const char* op_action(Context* ctx) {
  if (NULL == ctx || NULL == ctx->op) return NULL;
  bool is_data = NULL != ctx->op->input && 0 == strcmp(ctx->op->input, "data");
  voxgig_value* v = getp(is_data ? ctx->reqdata : ctx->reqmatch, "$action");
  const char* action = voxgig_is_string(v) ? voxgig_as_string(v) : NULL;
  // The request map keeps its own reference, so the string outlives this one.
  voxgig_release(v);
  return (NULL != action && '\0' != action[0]) ? action : NULL;
}

static char* op_key_join(const char* a, const char* sep, const char* b) {
  size_t n = strlen(a) + strlen(sep) + strlen(b) + 1;
  char* s = (char*)malloc(n);
  snprintf(s, n, "%s%s%s", a, sep, b);
  return s;
}

OpKeys op_keys(Context* ctx) {
  OpKeys keys;
  memset(&keys, 0, sizeof(keys));

  Operation* op = ctx ? ctx->op : NULL;
  const char* name = (op && op_name_set(op->name)) ? op->name : "_";
  const char* entity = "_";
  if (op && op_name_set(op->entity)) {
    entity = op->entity;
  } else if (ctx && ctx->entity) {
    const char* ename = ctx->entity->vt->get_name(ctx->entity);
    if (op_name_set(ename)) entity = ename;
  }

  char* base = op_key_join(entity, ".", name);
  const char* action = op_action(ctx);
  if (NULL != action) keys.items[keys.len++] = op_key_join(base, ":", action);
  keys.items[keys.len++] = base;
  keys.items[keys.len++] = strdup(name);
  keys.items[keys.len++] = strdup("*");
  return keys;
}

void op_keys_free(OpKeys* keys) {
  for (size_t i = 0; i < keys->len; i++) {
    free(keys->items[i]);
    keys->items[i] = NULL;
  }
  keys->len = 0;
}
