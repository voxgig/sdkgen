// prepare_method utility (mirrors utility/prepare_method.rs).

#include "sdk.h"

#include <string.h>

const char* prepare_method_util(Context* ctx) {
  const char* op = ctx->op->name;
  if (strcmp(op, "create") == 0) return "POST";
  if (strcmp(op, "update") == 0) return "PUT";
  if (strcmp(op, "load") == 0) return "GET";
  if (strcmp(op, "list") == 0) return "GET";
  if (strcmp(op, "remove") == 0) return "DELETE";
  if (strcmp(op, "patch") == 0) return "PATCH";
  return "GET";
}
