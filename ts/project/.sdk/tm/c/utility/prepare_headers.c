// prepare_headers utility (mirrors utility/prepare_headers.rs).

#include "sdk.h"

#include <ctype.h>
#include <stdlib.h>
#include <string.h>

static bool same_name(const char* a, const char* b) {
  for (; *a && *b; a++, b++) {
    if (tolower((unsigned char)*a) != tolower((unsigned char)*b)) return false;
  }
  return *a == *b;
}

voxgig_value* prepare_headers_util(Context* ctx) {
  voxgig_value* options = ctx->client ? sdk_options_map(ctx->client) : ctx->options;

  voxgig_value* headers = getp(options, "headers");
  voxgig_value* out = NULL;
  if (!v_is_noval(headers) && !v_is_null(headers)) {
    voxgig_value* cloned = voxgig_clone(headers);
    if (voxgig_is_map(cloned)) out = cloned;
  }
  if (NULL == out) out = voxgig_new_map();
  media_headers(ctx->point, out);

  // A header argument replaces a default of the same name, whatever its case.
  voxgig_value* hargs = call_args(ctx, "header");
  voxgig_list* hl = voxgig_as_list(hargs);
  for (size_t i = 0; i < hl->len; i++) {
    voxgig_list* arg = voxgig_as_list(hl->items[i]);
    const char* wire = voxgig_as_string(arg->items[1]);
    voxgig_value* val = arg->items[2];
    if (v_is_noval(val) || v_is_null(val)) continue;

    size_t n = strlen(wire);
    char* key = (char*)malloc(n + 1);
    for (size_t k = 0; k < n; k++) key[k] = (char)tolower((unsigned char)wire[k]);
    key[n] = '\0';
    voxgig_map* om = voxgig_as_map(out);
    for (size_t j = om->len; j > 0; j--) {
      if (same_name(om->entries[j - 1].key, key)) {
        voxgig_value* dk = voxgig_new_string(om->entries[j - 1].key);
        voxgig_delprop(out, dk);
        voxgig_release(dk);
      }
    }
    char* text = voxgig_stringify(val, -1);
    setp(out, key, voxgig_new_string_take(text, strlen(text)));
    free(key);
  }
  voxgig_release(hargs);

  return out;
}
