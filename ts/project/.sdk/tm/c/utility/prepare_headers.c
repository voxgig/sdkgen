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

  // A header parameter travels as a header, under the name the definition
  // gives it, and only from this call's own arguments. It replaces a default
  // of the same name, whatever its case.
  voxgig_value* aheader = getpath2(ctx->point, "args", "header");
  if (voxgig_is_list(aheader)) {
    voxgig_list* hl = voxgig_as_list(aheader);
    for (size_t i = 0; i < hl->len; i++) {
      voxgig_value* name = getp(hl->items[i], "name");
      if (!voxgig_is_string(name) || voxgig_as_string(name)[0] == '\0') continue;
      voxgig_value* orig = getp(hl->items[i], "orig");
      const char* wire = voxgig_is_string(orig) && voxgig_as_string(orig)[0] != '\0'
        ? voxgig_as_string(orig) : voxgig_as_string(name);

      voxgig_value* val = getp(ctx->reqmatch, voxgig_as_string(name));
      if (v_is_noval(val) || v_is_null(val)) val = getp(ctx->reqdata, voxgig_as_string(name));
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
  }

  return out;
}
