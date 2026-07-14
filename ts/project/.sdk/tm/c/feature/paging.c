// Pagination support for list operations (mirrors feature/paging.rs). On the
// way out (PreRequest) it stamps page/limit (or a cursor) into the request
// query; on the way back (PreResult) it reads the server's pagination
// signals — a `Link: rel="next"` header, `X-Page`/`X-Next-Page`/
// `X-Total-Count` headers, or `next`/`cursor`/`nextCursor`/`hasMore` fields
// in the body — and records them on `result.paging`. A per-call cursor/page
// from ctrl takes priority (used by auto-iteration). Parameter names
// (`pageParam`, `limitParam`, `cursorParam`), the page size (`limit`) and
// the start page (`startPage`, default 1) are configurable.

#include "sdk.h"

#include <ctype.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  Feature base;
  char* name;
  bool active;
  voxgig_value* add_opts;
  voxgig_value* options;

  // Activity tracking (mirrors the ts client._paging record).
  voxgig_value* last;
} PagingFeature;

// True when opname is in the configured "ops" list (default ["list"]).
static bool is_list_op(voxgig_value* options, const char* opname) {
  voxgig_value* ops = fopt_list(options, "ops");
  if (voxgig_is_list(ops)) {
    voxgig_list* l = voxgig_as_list(ops);
    for (size_t i = 0; i < l->len; i++) {
      voxgig_value* v = l->items[i];
      if (voxgig_is_string(v) && strcmp(voxgig_as_string(v), opname) == 0) return true;
    }
    return false;
  }
  return strcmp(opname, "list") == 0;
}

// Extract the URL of the `rel="next"` entry from a Link header value. Returns
// a malloc'd string (caller frees) or NULL.
static char* link_next(const char* link) {
  const char* p = link;
  while (1) {
    const char* comma = strchr(p, ',');
    size_t seglen = comma ? (size_t)(comma - p) : strlen(p);

    // Lowercase copy of the segment for the rel="next" test.
    char* lower = (char*)malloc(seglen + 1);
    for (size_t i = 0; i < seglen; i++) lower[i] = (char)tolower((unsigned char)p[i]);
    lower[seglen] = '\0';
    bool match = strstr(lower, "rel=\"next\"") != NULL || strstr(lower, "rel=next") != NULL;
    free(lower);

    if (match) {
      // rust: seg.find('<')? and seg.find('>')? — absence returns None from
      // the whole function.
      const char* open = NULL;
      for (size_t i = 0; i < seglen; i++) {
        if (p[i] == '<') { open = &p[i]; break; }
      }
      if (!open) return NULL;
      const char* close = NULL;
      for (size_t i = 0; i < seglen; i++) {
        if (p[i] == '>') { close = &p[i]; break; }
      }
      if (!close) return NULL;
      if (open < close) {
        size_t len = (size_t)(close - open) - 1;
        char* out = (char*)malloc(len + 1);
        memcpy(out, open + 1, len);
        out[len] = '\0';
        return out;
      }
    }

    if (!comma) break;
    p = comma + 1;
  }
  return NULL;
}

static void header_num(voxgig_value* headers, const char* name, voxgig_value* paging,
                       const char* key) {
  voxgig_value* v = fheader_get(headers, name);
  if (v_is_noval(v)) return; // None
  if (voxgig_is_string(v)) {
    int64_t n = fparse_int(voxgig_as_string(v), -1);
    if (n >= 0) setp(paging, key, v_num((double)n));
  } else if (voxgig_is_number(v)) {
    double d = voxgig_is_int(v) ? (double)voxgig_as_int(v) : voxgig_as_double(v);
    setp(paging, key, v_num(d));
  }
}

static const char* paging_name(Feature* f) { return ((PagingFeature*)f)->name; }
static bool paging_active(Feature* f) { return ((PagingFeature*)f)->active; }
static voxgig_value* paging_add_options(Feature* f) { return ((PagingFeature*)f)->add_opts; }

static void paging_init(Feature* f, Context* ctx, voxgig_value* options) {
  (void)ctx;
  PagingFeature* pf = (PagingFeature*)f;
  pf->options = options;
  pf->active = fopt_bool(options, "active", false);
}

static void paging_pre_request(PagingFeature* pf, Context* ctx) {
  voxgig_value* options = pf->options;
  if (!pf->active || !is_list_op(options, ctx->op->name)) return;
  if (!ctx->spec) return;

  voxgig_value* query = ctx->spec->query;
  if (!voxgig_is_map(query)) {
    query = voxgig_new_map();
    ctx->spec->query = query;
  }

  const char* page_param = fopt_str(options, "pageParam", "page");
  const char* limit_param = fopt_str(options, "limitParam", "limit");
  const char* cursor_param = fopt_str(options, "cursorParam", "cursor");

  // A per-call cursor/page from ctrl takes priority (auto-iteration).
  voxgig_value* paging = ctx->ctrl->paging;

  voxgig_value* cursor = getp(paging, "cursor");
  if (!v_is_noval(cursor) && !v_is_null(cursor)) {
    setp(query, cursor_param, cursor);
  } else if (v_is_noval(getp(query, page_param))) {
    voxgig_value* page = getp(paging, "page");
    if (!v_is_noval(page) && !v_is_null(page)) {
      setp(query, page_param, page);
    } else {
      setp(query, page_param, v_num((double)fopt_int(options, "startPage", 1)));
    }
  }

  if (!v_is_noval(getp(options, "limit")) && v_is_noval(getp(query, limit_param))) {
    setp(query, limit_param, v_num((double)fopt_int(options, "limit", 0)));
  }
}

static void paging_pre_result(PagingFeature* pf, Context* ctx) {
  voxgig_value* options = pf->options;
  if (!pf->active || !is_list_op(options, ctx->op->name)) return;
  if (!ctx->result) return;

  voxgig_value* headers = ctx->result->headers;
  voxgig_value* body = ctx->result->body;

  voxgig_value* paging = voxgig_new_map();
  setp(paging, "hasMore", v_bool(false));
  header_num(headers, "x-page", paging, "page");
  header_num(headers, "x-total-count", paging, "totalCount");
  header_num(headers, "x-next-page", paging, "nextPage");

  // Link: <...>; rel="next"
  voxgig_value* linkv = fheader_get(headers, "link");
  if (voxgig_is_string(linkv)) {
    char* next = link_next(voxgig_as_string(linkv));
    if (next) {
      setp(paging, "next", v_str(next));
      free(next);
    }
  }

  // Body-level cursors.
  if (voxgig_is_map(body)) {
    voxgig_value* next = getp(body, "next");
    if (!v_is_noval(next) && !v_is_null(next) && v_is_noval(getp(paging, "next"))) {
      setp(paging, "next", next);
    }
    voxgig_value* cursor = getp(body, "cursor");
    if (!v_is_noval(cursor) && !v_is_null(cursor)) {
      setp(paging, "cursor", cursor);
    }
    voxgig_value* next_cursor = getp(body, "nextCursor");
    if (!v_is_noval(next_cursor) && !v_is_null(next_cursor)) {
      setp(paging, "cursor", next_cursor);
    }
    bool has_more;
    if (get_bool(body, "hasMore", &has_more)) {
      setp(paging, "hasMore", v_bool(has_more));
    }
  }

  bool hm = false;
  bool has = get_bool(paging, "hasMore", &hm);
  bool is_true = has && hm;
  if (!is_true && (!v_is_noval(getp(paging, "next")) || !v_is_noval(getp(paging, "cursor")) ||
                   !v_is_noval(getp(paging, "nextPage")))) {
    setp(paging, "hasMore", v_bool(true));
  }

  ctx->result->paging = paging;
  pf->last = paging;
}

static void paging_hook(Feature* f, const char* name, Context* ctx) {
  PagingFeature* pf = (PagingFeature*)f;
  if (strcmp(name, "PreRequest") == 0) {
    paging_pre_request(pf, ctx);
  } else if (strcmp(name, "PreResult") == 0) {
    paging_pre_result(pf, ctx);
  }
}

static const FeatureVT PAGING_VT = {
  paging_name, paging_active, paging_add_options, paging_init, paging_hook,
  NULL, // paging state observed via result.paging, not a track snapshot
};

Feature* feature_paging_new(void) {
  PagingFeature* pf = (PagingFeature*)calloc(1, sizeof(PagingFeature));
  pf->base.vt = &PAGING_VT;
  pf->name = strdup("paging");
  pf->active = true; // matches rust new() (overridden by init from options)
  pf->add_opts = NULL;
  pf->options = voxgig_new_undef();
  pf->last = voxgig_new_undef();
  return (Feature*)pf;
}
