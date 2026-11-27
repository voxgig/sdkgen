// multipart/form-data encoder (mirrors utility/codec/MultipartCodec.ts).

#if defined(_WIN32)
#define _CRT_RAND_S
#endif

#include "index.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#if defined(__linux__)
#include <sys/random.h>
#endif

#define MULTIPART_MEDIA "multipart/form-data"
#define OCTET_MEDIA "application/octet-stream"

// Sixteen bytes from the platform's cryptographic source, as lowercase hex.
// Malloc'd; the caller frees it.
char* codec_multipart_boundary(Context* ctx) {
  (void)ctx;
  unsigned char bytes[16];
#if defined(__linux__)
  size_t got = 0;
  while (got < sizeof(bytes)) {
    ssize_t r = getrandom(bytes + got, sizeof(bytes) - got, 0);
    if (r <= 0) abort();
    got += (size_t)r;
  }
#elif defined(_WIN32)
  for (size_t i = 0; i < sizeof(bytes); i += 4) {
    unsigned int r = 0;
    if (0 != rand_s(&r)) abort();
    memcpy(bytes + i, &r, 4);
  }
#else
  arc4random_buf(bytes, sizeof(bytes));
#endif
  char* out = (char*)malloc(2 * sizeof(bytes) + 1);
  for (size_t i = 0; i < sizeof(bytes); i++) snprintf(out + 2 * i, 3, "%02x", bytes[i]);
  return out;
}

typedef struct {
  char* data;
  size_t len;
  size_t cap;
} Buf;

static void put(Buf* b, const char* s, size_t n) {
  if (b->cap < b->len + n + 1) {
    b->cap = 2 * (b->len + n + 1);
    b->data = (char*)realloc(b->data, b->cap);
  }
  memcpy(b->data + b->len, s, n);
  b->len += n;
  b->data[b->len] = '\0';
}

static void puts_(Buf* b, const char* s) { put(b, s, strlen(s)); }

// Inside a quoted header parameter nothing may end the quote or the line.
static void put_quoted(Buf* b, const char* s) {
  for (; *s; s++) {
    if ('\\' == *s) puts_(b, "%5C");
    else if ('"' == *s) puts_(b, "%22");
    else if ('\r' == *s) puts_(b, "%0D");
    else if ('\n' == *s) puts_(b, "%0A");
    else put(b, s, 1);
  }
}

// A local path never leaves: only its last segment, and nothing for an empty one.
static const char* base_name(const char* name) {
  if (NULL == name) return NULL;
  const char* base = name;
  for (const char* p = name; *p; p++) {
    if ('/' == *p || '\\' == *p) base = p + 1;
  }
  return '\0' == *base ? NULL : base;
}

static PNError* line_break(Context* ctx, const char* name) {
  size_t n = strlen(name) + 96;
  char* msg = (char*)malloc(n);
  snprintf(msg, n, "The media type of the multipart field \"%s\" contains a line break.", name);
  PNError* err = context_make_error(ctx, "binary_source_refused", msg);
  free(msg);
  return err;
}

voxgig_value* codec_encode_multipart(Context* ctx, voxgig_value* data, char** type,
                                     PNError** err) {
  *err = NULL;
  BoundaryFn boundary_of = NULL != ctx->utility && NULL != ctx->utility->multipart_boundary
    ? ctx->utility->multipart_boundary : codec_multipart_boundary;
  char* boundary = boundary_of(ctx);

  size_t n = 0;
  BodyItem* items = binary_body_items(ctx, data, &n);
  Buf b = { NULL, 0, 0 };
  puts_(&b, "");

  for (size_t i = 0; i < n; i++) {
    BodyItem* item = &items[i];
    const char* filename = NULL;
    const char* ptype = item->media;
    if (item->binary) {
      if (NULL != item->source) {
        filename = base_name(item->source->name);
        if (NULL != item->source->type) ptype = item->source->type;
      }
      if (NULL == ptype) ptype = OCTET_MEDIA;
    }
    if (NULL != ptype && NULL != strpbrk(ptype, "\r\n")) {
      *err = line_break(ctx, item->name);
      break;
    }

    puts_(&b, "--");
    puts_(&b, boundary);
    puts_(&b, "\r\nContent-Disposition: form-data; name=\"");
    put_quoted(&b, item->name);
    puts_(&b, "\"");
    if (NULL != filename) {
      puts_(&b, "; filename=\"");
      put_quoted(&b, filename);
      puts_(&b, "\"");
    }
    puts_(&b, "\r\n");
    if (NULL != ptype) {
      puts_(&b, "Content-Type: ");
      puts_(&b, ptype);
      puts_(&b, "\r\n");
    }
    puts_(&b, "\r\n");
    put(&b, item->bytes, item->len);
    puts_(&b, "\r\n");
  }
  binary_body_items_free(items, n);

  if (NULL != *err) {
    free(b.data);
    free(boundary);
    return NULL;
  }

  puts_(&b, "--");
  puts_(&b, boundary);
  puts_(&b, "--\r\n");

  const char* media = get_str(getp(ctx->point, "body"), "media");
  const char* lead = NULL == media ? "" : media;
  size_t elen = strcspn(lead, ";");
  while (0 < elen && (' ' == lead[elen - 1] || '\t' == lead[elen - 1])) elen--;
  while (0 < elen && (' ' == *lead || '\t' == *lead)) {
    lead++;
    elen--;
  }
  if (0 == elen) {
    lead = MULTIPART_MEDIA;
    elen = strlen(MULTIPART_MEDIA);
  }
  size_t tlen = elen + strlen(boundary) + 16;
  *type = (char*)malloc(tlen);
  snprintf(*type, tlen, "%.*s; boundary=%s", (int)elen, lead, boundary);
  free(boundary);

  return voxgig_new_string_take(b.data, b.len);
}
