// Binary sources, the lift and the body items (mirrors utility/BinaryUtility.ts).
// Nothing here opens a file: a string is content.

#include "sdk.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define RAW_BODY "$body"
#define MAX_BUFFER_DEFAULT 16777216

BinarySource binary_bytes(const void* data, size_t len, const char* name, const char* type) {
  BinarySource src;
  src.data = (const uint8_t*)data;
  src.len = NULL == data ? 0 : len;
  src.name = name;
  src.type = NULL != type && '\0' != type[0] ? type : NULL;
  return src;
}

voxgig_value* binary_source_describe(const BinarySource* src) {
  voxgig_value* desc = cmap(2, "binary$", v_str("bytes"), "size", v_int((int64_t)src->len));
  if (NULL != src->type) setp(desc, "type", v_str(src->type));
  return desc;
}

Entity* entity_create_with(Entity* e, voxgig_value* data, const BinaryField* sources, size_t n,
                           voxgig_value* ctrl, PNError** err) {
  if (NULL == e->vt->create_with) return e->vt->create(e, data, ctrl, err);
  return e->vt->create_with(e, data, sources, n, ctrl, err);
}

Entity* entity_update_with(Entity* e, voxgig_value* data, const BinaryField* sources, size_t n,
                           voxgig_value* ctrl, PNError** err) {
  if (NULL == e->vt->update_with) return e->vt->update(e, data, ctrl, err);
  return e->vt->update_with(e, data, sources, n, ctrl, err);
}

Entity* entity_patch_with(Entity* e, voxgig_value* data, const BinaryField* sources, size_t n,
                          voxgig_value* ctrl, PNError** err) {
  if (NULL == e->vt->patch_with) return e->vt->patch(e, data, ctrl, err);
  return e->vt->patch_with(e, data, sources, n, ctrl, err);
}

static bool names_have(voxgig_value* names, const char* name) {
  voxgig_list* nl = voxgig_as_list(names);
  for (size_t i = 0; i < nl->len; i++) {
    if (0 == strcmp(voxgig_as_string(nl->items[i]), name)) return true;
  }
  return false;
}

voxgig_value* binary_names(voxgig_value* point) {
  voxgig_value* names = voxgig_new_list();
  voxgig_value* body = getp(point, "body");
  const char* kind = get_str(body, "kind");
  if (NULL == kind) return names;
  if (0 == strcmp(kind, "raw")) {
    voxgig_list_push(voxgig_as_list(names), v_str(RAW_BODY));
  } else if (0 == strcmp(kind, "multipart") || 0 == strcmp(kind, "form")) {
    voxgig_value* fields = getp(body, "fields");
    voxgig_list* fl = voxgig_is_list(fields) ? voxgig_as_list(fields) : NULL;
    for (size_t i = 0; NULL != fl && i < fl->len; i++) {
      bool binary = false;
      const char* name = get_str(fl->items[i], "name");
      if (NULL != name && get_bool(fl->items[i], "binary", &binary) && binary) {
        voxgig_list_push(voxgig_as_list(names), v_str(name));
      }
    }
  }
  return names;
}

static PNError* refused_at(Context* ctx, const char* where) {
  size_t n = strlen(where) + 128;
  char* msg = (char*)malloc(n);
  snprintf(msg, n, "A binary source was passed in \"%s\", which is not a field the "
    "operation declares binary.", where);
  PNError* err = context_make_error(ctx, "binary_source_refused", msg);
  free(msg);
  return err;
}

// Closed union: a source cannot hide inside the data, so instead of walking
// it for strays the lift refuses a given source under a name the point does
// not declare binary. A data value under a binary name is content.
PNError* binary_lift_sources(Context* ctx) {
  if (ctx->sources_lifted) return NULL;

  voxgig_value* names = binary_names(ctx->point);
  for (size_t i = 0; i < ctx->ngiven; i++) {
    const char* name = NULL == ctx->given[i].name ? "" : ctx->given[i].name;
    if (!names_have(names, name)) {
      voxgig_release(names);
      return refused_at(ctx, name);
    }
  }

  voxgig_value* reqdata = ctx->reqdata;
  if (voxgig_is_map(reqdata)) {
    voxgig_map* rm = voxgig_as_map(reqdata);
    bool any = false;
    for (size_t i = 0; i < rm->len && !any; i++) any = names_have(names, rm->entries[i].key);
    if (any) {
      voxgig_value* copy = voxgig_new_map();
      for (size_t i = 0; i < rm->len; i++) {
        voxgig_value* target = names_have(names, rm->entries[i].key) ? ctx->lifted : copy;
        setp(target, rm->entries[i].key, voxgig_retain(rm->entries[i].value));
      }
      ctx->reqdata = copy;
    }
  }

  voxgig_release(names);
  ctx->sources_lifted = true;
  return NULL;
}

bool binary_raw_response(voxgig_value* point) {
  return v_str_eq(getp(getp(point, "response"), "kind"), "raw");
}

PNError* binary_bytes_refused(Context* ctx) {
  voxgig_value* response = getp(ctx->point, "response");
  bool binary = false;
  if (!binary_raw_response(ctx->point) || !get_bool(response, "binary", &binary) || !binary ||
      (NULL != ctx->ctrl && voxgig_is_map(ctx->ctrl->transfer))) {
    return NULL;
  }
  const char* action = get_str(getp(ctx->point, "select"), "$action");
  const char* opname = ctx->op ? ctx->op->name : "";
  const char* entity = ctx->op ? ctx->op->entity : "";
  size_t n = strlen(opname) + strlen(entity) + (action ? strlen(action) : 0) + 256;
  char* msg = (char*)malloc(n);
  snprintf(msg, n, "Operation \"%s\" on entity \"%s\" answers bytes, which never enter the "
    "entity's data: read them with binary_handle_bytes(entity_binary(entity, %s%s%s)).",
    opname, entity, action ? "\"" : "", action ? action : "NULL", action ? "\"" : "");
  PNError* err = context_make_error(ctx, "binary_sink_required", msg);
  free(msg);
  return err;
}

const BinarySource* binary_lifted_source(Context* ctx, const char* name) {
  for (size_t i = 0; i < ctx->ngiven; i++) {
    if (NULL != ctx->given[i].name && 0 == strcmp(ctx->given[i].name, name)) {
      return &ctx->given[i].source;
    }
  }
  return NULL;
}

size_t binary_max_buffer(Context* ctx) {
  voxgig_value* found[2] = { getp(ctx->options, "maxBuffer"),
    getp(shared_optspec(), "maxBuffer") };
  for (size_t i = 0; i < 2; i++) {
    if (voxgig_is_int(found[i]) && 0 <= voxgig_as_int(found[i])) {
      return (size_t)voxgig_as_int(found[i]);
    }
    if (voxgig_is_double(found[i]) && 0 <= voxgig_as_double(found[i]) &&
        isfinite(voxgig_as_double(found[i]))) {
      return (size_t)voxgig_as_double(found[i]);
    }
  }
  return MAX_BUFFER_DEFAULT;
}

// A number as JavaScript writes it: no fraction on an integer, else the
// shortest digits that read back the same.
static char* number_text(double d) {
  char buf[40];
  if (d == floor(d) && fabs(d) < 1e21) {
    snprintf(buf, sizeof(buf), "%.0f", d);
  } else {
    for (int p = 1; p <= 17; p++) {
      snprintf(buf, sizeof(buf), "%.*g", p, d);
      if (strtod(buf, NULL) == d) break;
    }
  }
  return strdup(buf);
}

char* binary_item_text(voxgig_value* val, size_t* len) {
  char* out;
  if (voxgig_is_string(val)) {
    *len = voxgig_string_len(val);
    out = (char*)malloc(*len + 1);
    memcpy(out, voxgig_as_string(val), *len);
    out[*len] = '\0';
    return out;
  }
  if (voxgig_is_bool(val)) {
    out = strdup(voxgig_as_bool(val) ? "true" : "false");
  } else if (voxgig_is_int(val)) {
    char buf[32];
    snprintf(buf, sizeof(buf), "%lld", (long long)voxgig_as_int(val));
    out = strdup(buf);
  } else if (voxgig_is_double(val)) {
    out = number_text(voxgig_as_double(val));
  } else {
    voxgig_value* flags = cmap(1, "indent", v_int(0));
    out = voxgig_jsonify(val, flags);
    voxgig_release(flags);
  }
  *len = strlen(out);
  return out;
}

typedef struct {
  BodyItem* items;
  size_t n;
  size_t cap;
} Items;

static BodyItem* item_add(Items* it, const char* name, bool binary, const char* media) {
  if (it->n == it->cap) {
    it->cap = 0 == it->cap ? 8 : it->cap * 2;
    it->items = (BodyItem*)realloc(it->items, it->cap * sizeof(BodyItem));
  }
  BodyItem* item = &it->items[it->n++];
  memset(item, 0, sizeof(*item));
  item->name = name;
  item->binary = binary;
  item->media = media;
  return item;
}

static void item_value(BodyItem* item, voxgig_value* val) {
  if (voxgig_is_string(val)) {
    item->bytes = voxgig_as_string(val);
    item->len = voxgig_string_len(val);
  } else {
    item->own = binary_item_text(val, &item->len);
    item->bytes = item->own;
  }
}

static int name_cmp(const void* a, const void* b) {
  return strcmp(*(const char* const*)a, *(const char* const*)b);
}

static voxgig_value* field_of(voxgig_value* fields, const char* name) {
  voxgig_list* fl = voxgig_as_list(fields);
  for (size_t i = 0; i < fl->len; i++) {
    if (v_str_eq(getp(fl->items[i], "name"), name)) return fl->items[i];
  }
  return NULL;
}

static bool has_key(voxgig_value* map, const char* key) {
  return voxgig_is_map(map) && NULL != voxgig_map_get(voxgig_as_map(map), key);
}

static void items_of(Context* ctx, Items* it, const char* name, voxgig_value* field,
                     voxgig_value* data) {
  bool binary = false;
  if (NULL != field) get_bool(field, "binary", &binary);
  const char* media = NULL == field ? NULL : get_str(field, "media");
  const char* join = NULL == field ? NULL : get_str(field, "join");

  bool given = false;
  for (size_t i = 0; i < ctx->ngiven; i++) {
    if (NULL == ctx->given[i].name || 0 != strcmp(ctx->given[i].name, name)) continue;
    BodyItem* item = item_add(it, name, binary, media);
    item->source = &ctx->given[i].source;
    item->bytes = (const char*)ctx->given[i].source.data;
    item->len = ctx->given[i].source.len;
    given = true;
  }
  if (given) return;

  voxgig_value* val = has_key(ctx->lifted, name) ? voxgig_map_get(voxgig_as_map(ctx->lifted), name)
                                                : voxgig_map_get(voxgig_as_map(data), name);
  if (NULL == val || voxgig_is_undef(val) || voxgig_is_null(val)) return;

  if (!voxgig_is_list(val)) {
    item_value(item_add(it, name, binary, media), val);
    return;
  }

  voxgig_list* vl = voxgig_as_list(val);
  if (!binary && NULL != join) {
    size_t jlen = strlen(join);
    size_t len = 0;
    char* text = (char*)calloc(1, 1);
    bool first = true;
    for (size_t i = 0; i < vl->len; i++) {
      if (voxgig_is_undef(vl->items[i]) || voxgig_is_null(vl->items[i])) continue;
      size_t tlen = 0;
      char* part = binary_item_text(vl->items[i], &tlen);
      text = (char*)realloc(text, len + (first ? 0 : jlen) + tlen + 1);
      if (!first) {
        memcpy(text + len, join, jlen);
        len += jlen;
      }
      memcpy(text + len, part, tlen);
      len += tlen;
      text[len] = '\0';
      free(part);
      first = false;
    }
    BodyItem* item = item_add(it, name, binary, media);
    item->own = text;
    item->bytes = text;
    item->len = len;
    return;
  }

  for (size_t i = 0; i < vl->len; i++) {
    if (voxgig_is_undef(vl->items[i]) || voxgig_is_null(vl->items[i])) continue;
    item_value(item_add(it, name, binary, media), vl->items[i]);
  }
}

// Wire order: the fields the model declares, in its order, then every other
// key of the data in code point order.
BodyItem* binary_body_items(Context* ctx, voxgig_value* data, size_t* n) {
  Items it = { NULL, 0, 0 };
  voxgig_value* fields = getp(getp(ctx->point, "body"), "fields");
  if (!voxgig_is_list(fields)) fields = voxgig_new_list();
  voxgig_value* plain = voxgig_is_map(data) ? data : voxgig_new_map();

  voxgig_list* fl = voxgig_as_list(fields);
  for (size_t i = 0; i < fl->len; i++) {
    const char* name = get_str(fl->items[i], "name");
    if (NULL == name) continue;
    if (has_key(plain, name) || has_key(ctx->lifted, name) ||
        NULL != binary_lifted_source(ctx, name)) {
      items_of(ctx, &it, name, fl->items[i], plain);
    }
  }

  voxgig_map* pm = voxgig_as_map(plain);
  const char** rest = (const char**)malloc((pm->len + 1) * sizeof(char*));
  size_t nrest = 0;
  for (size_t i = 0; i < pm->len; i++) {
    if (NULL == field_of(fields, pm->entries[i].key)) rest[nrest++] = pm->entries[i].key;
  }
  qsort(rest, nrest, sizeof(char*), name_cmp);
  for (size_t i = 0; i < nrest; i++) items_of(ctx, &it, rest[i], NULL, plain);
  free(rest);

  *n = it.n;
  return it.items;
}

void binary_body_items_free(BodyItem* items, size_t n) {
  for (size_t i = 0; i < n; i++) free(items[i].own);
  free(items);
}
