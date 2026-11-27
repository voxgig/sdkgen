// The bounded raw reader (mirrors utility/codec/RawCodec.ts).

#include "index.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static PNError* too_large(Context* ctx, const char* code, size_t max, long long declared) {
  char msg[160];
  if (declared < 0) {
    snprintf(msg, sizeof(msg), "response: body is longer than maxBuffer (%llu bytes)",
      (unsigned long long)max);
  } else {
    snprintf(msg, sizeof(msg), "response: body of %lld bytes exceeds maxBuffer (%llu bytes)",
      declared, (unsigned long long)max);
  }
  return context_make_error(ctx, code, msg);
}

// The declared content-length when it is all digits, else -1.
static long long declared_length(voxgig_value* headers) {
  const char* cl = response_header(headers, "content-length");
  while (isspace((unsigned char)*cl)) cl++;
  size_t n = strlen(cl);
  while (0 < n && isspace((unsigned char)cl[n - 1])) n--;
  if (0 == n || 18 < n) return 0 == n ? -1 : (long long)1e18;
  long long v = 0;
  for (size_t i = 0; i < n; i++) {
    if (!isdigit((unsigned char)cl[i])) return -1;
    v = v * 10 + (cl[i] - '0');
  }
  return v;
}

// The whole body, refused past the bound: by its declared length, then by
// its count. A body stopped early by the transport is past the bound.
static voxgig_value* read_bounded(Context* ctx, size_t max, const char* code, PNError** err) {
  Response* response = ctx->response;
  long long declared = declared_length(response->headers);
  if (0 <= declared && (unsigned long long)max < (unsigned long long)declared) {
    *err = too_large(ctx, code, max, declared);
    return NULL;
  }
  voxgig_value* body = response->body;
  size_t count = voxgig_is_string(body) ? voxgig_string_len(body) : 0;
  if (response->overflow || max < count) {
    *err = too_large(ctx, code, max, -1);
    return NULL;
  }
  return voxgig_is_string(body) ? body : voxgig_new_string_n("", 0);
}

// Text into the record under `$body`; bytes only into a binary handle's
// read, never into the record.
PNError* codec_read_raw(Context* ctx) {
  SdkResult* result = ctx->result;
  voxgig_value* transfer = NULL != ctx->ctrl ? ctx->ctrl->transfer : NULL;
  size_t max = binary_max_buffer(ctx);
  PNError* err = NULL;

  bool binary = false;
  if (get_bool(getp(ctx->point, "response"), "binary", &binary) && binary) {
    result->body = voxgig_new_undef();
    if (voxgig_is_map(transfer) && v_str_eq(getp(transfer, "direction"), "read")) {
      voxgig_value* bytes = read_bounded(ctx, max, "binary_too_large", &err);
      if (NULL == err) setp(transfer, "bytes", bytes);
    }
    return err;
  }

  voxgig_value* text = read_bounded(ctx, max, "response_too_large", &err);
  if (NULL == err) result->body = cmap(1, "$body", v_share(text));
  return err;
}
