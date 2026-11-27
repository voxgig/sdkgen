// application/x-www-form-urlencoded encoder (mirrors utility/codec/FormCodec.ts).

#include "index.h"

#include <stdlib.h>
#include <string.h>

#define FORM_MEDIA "application/x-www-form-urlencoded"

static const char HEX[] = "0123456789ABCDEF";

// Alphanumerics and `*-._` as they are, a space as `+`, every other byte as
// %HH. The length, not a NUL, ends the input.
static void form_escape(char** out, size_t* len, size_t* cap, const char* in, size_t n) {
  if (*cap < *len + 3 * n + 2) {
    *cap = *len + 3 * n + 2;
    *out = (char*)realloc(*out, *cap);
  }
  for (size_t i = 0; i < n; i++) {
    unsigned char b = (unsigned char)in[i];
    if (('0' <= b && b <= '9') || ('A' <= b && b <= 'Z') || ('a' <= b && b <= 'z') ||
        '*' == b || '-' == b || '.' == b || '_' == b) {
      (*out)[(*len)++] = (char)b;
    } else if (' ' == b) {
      (*out)[(*len)++] = '+';
    } else {
      (*out)[(*len)++] = '%';
      (*out)[(*len)++] = HEX[b >> 4];
      (*out)[(*len)++] = HEX[b & 15];
    }
  }
}

voxgig_value* codec_encode_form(Context* ctx, voxgig_value* data, char** type, PNError** err) {
  *err = NULL;
  size_t n = 0;
  BodyItem* items = binary_body_items(ctx, data, &n);

  char* out = (char*)malloc(1);
  size_t len = 0;
  size_t cap = 1;
  for (size_t i = 0; i < n; i++) {
    if (0 < i) out[len++] = '&';
    form_escape(&out, &len, &cap, items[i].name, strlen(items[i].name));
    out[len++] = '=';
    form_escape(&out, &len, &cap, items[i].bytes, items[i].len);
  }
  binary_body_items_free(items, n);
  out[len] = '\0';

  const char* media = get_str(getp(ctx->point, "body"), "media");
  *type = strdup(NULL != media && '\0' != media[0] ? media : FORM_MEDIA);
  return voxgig_new_string_take(out, len);
}
