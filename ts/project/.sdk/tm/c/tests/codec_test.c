// Every form, multipart and raw point this SDK has, driven through a real
// entity operation against a loopback listener that records what arrives.
// The cases come from the client's own config, so no case names an entity.

#if !defined(_WIN32) && !defined(_POSIX_C_SOURCE)
#define _POSIX_C_SOURCE 200809L
#endif
#if defined(__APPLE__) && !defined(_DARWIN_C_SOURCE)
#define _DARWIN_C_SOURCE
#endif

#include "ctest.h"
#include "../utility/codec/index.h"

#include <stdlib.h>
#include <string.h>

#if defined(_WIN32)

int main(void) {
  printf("codec: skipped, this platform has no POSIX sockets\n");
  return 0;
}

#else

#include <arpa/inet.h>
#include <netinet/in.h>
#include <signal.h>
#include <strings.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

typedef struct {
  char* data;
  size_t len;
} Bytes;

static void bytes_add(Bytes* b, const void* s, size_t n) {
  b->data = (char*)realloc(b->data, b->len + n + 1);
  memcpy(b->data + b->len, s, n);
  b->len += n;
  b->data[b->len] = '\0';
}

static bool bytes_eq(const char* a, size_t alen, const char* b, size_t blen) {
  return alen == blen && 0 == memcmp(a, b, alen);
}

// `file:<name>` NUL 0xFF CR LF `--`: a part that ends early, or is read as a
// C string, loses its tail.
static Bytes content(const char* name) {
  Bytes b = { NULL, 0 };
  bytes_add(&b, "file:", 5);
  bytes_add(&b, name, strlen(name));
  bytes_add(&b, "\0\xFF\r\n--", 6);
  return b;
}

// ---- the listener -----------------------------------------------------------

static int LISTEN = -1;
static int PORT = 0;
static pid_t SERVER = -1;
static int ARRIVAL = -1;

static int listen_loopback(int* port) {
  struct sockaddr_in addr;
  socklen_t len = sizeof(addr);
  int fd = socket(AF_INET, SOCK_STREAM, 0);
  int one = 1;
  setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));
  memset(&addr, 0, sizeof(addr));
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  addr.sin_port = 0;
  if (0 != bind(fd, (struct sockaddr*)&addr, sizeof(addr)) || 0 != listen(fd, 16)) return -1;
  getsockname(fd, (struct sockaddr*)&addr, &len);
  *port = ntohs(addr.sin_port);
  return fd;
}

static void write_all(int fd, const char* s, size_t n) {
  while (0 < n) {
    ssize_t w = write(fd, s, n);
    if (w <= 0) return;
    s += w;
    n -= (size_t)w;
  }
}

static const char* head_end(const Bytes* b) {
  for (size_t i = 0; i + 3 < b->len; i++) {
    if (0 == memcmp(b->data + i, "\r\n\r\n", 4)) return b->data + i;
  }
  return NULL;
}

// A header's value in a request head, malloc'd; "" when absent.
static char* header_of(const char* head, size_t hlen, const char* name) {
  size_t n = strlen(name);
  for (size_t i = 0; i + n + 3 < hlen; i++) {
    if ('\n' == head[i] && 0 == strncasecmp(head + i + 1, name, n) && ':' == head[i + 1 + n]) {
      const char* v = head + i + 2 + n;
      while (' ' == *v) v++;
      size_t vlen = strcspn(v, "\r\n");
      char* out = (char*)malloc(vlen + 1);
      memcpy(out, v, vlen);
      out[vlen] = '\0';
      return out;
    }
  }
  return strdup("");
}

// One exchange in a child: the request it reads goes back through a pipe,
// then the answer is sent.
static void serve(const char* type, const char* body, size_t blen) {
  int fds[2];
  if (0 != pipe(fds)) abort();
  SERVER = fork();
  if (0 == SERVER) {
    close(fds[0]);
    alarm(10);
    int c = accept(LISTEN, NULL, NULL);
    Bytes req = { NULL, 0 };
    char chunk[4096];
    const char* end = NULL;
    while (NULL == (end = head_end(&req))) {
      ssize_t r = read(c, chunk, sizeof(chunk));
      if (r <= 0) _exit(1);
      bytes_add(&req, chunk, (size_t)r);
    }
    size_t hlen = (size_t)(end - req.data) + 4;
    char* cl = header_of(req.data, hlen, "content-length");
    size_t want = hlen + (size_t)strtoul(cl, NULL, 10);
    while (req.len < want) {
      ssize_t r = read(c, chunk, sizeof(chunk));
      if (r <= 0) break;
      bytes_add(&req, chunk, (size_t)r);
    }
    write_all(fds[1], req.data, req.len);
    close(fds[1]);
    char head[256];
    snprintf(head, sizeof(head), "HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %lu\r\n"
      "Connection: close\r\n\r\n", type, (unsigned long)blen);
    write_all(c, head, strlen(head));
    write_all(c, body, blen);
    close(c);
    _exit(0);
  }
  close(fds[1]);
  ARRIVAL = fds[0];
}

typedef struct {
  Bytes raw;
  size_t hlen;
  char* type;
  const char* body;
  size_t blen;
} Arrived;

static Arrived arrived(void) {
  Arrived a;
  memset(&a, 0, sizeof(a));
  char chunk[4096];
  ssize_t r;
  while (0 < (r = read(ARRIVAL, chunk, sizeof(chunk)))) bytes_add(&a.raw, chunk, (size_t)r);
  close(ARRIVAL);
  waitpid(SERVER, NULL, 0);
  const char* end = NULL == a.raw.data ? NULL : head_end(&a.raw);
  if (NULL == end) {
    a.type = strdup("");
    a.body = "";
    return a;
  }
  a.hlen = (size_t)(end - a.raw.data) + 4;
  a.type = header_of(a.raw.data, a.hlen, "content-type");
  a.body = a.raw.data + a.hlen;
  a.blen = a.raw.len - a.hlen;
  return a;
}

static void arrived_free(Arrived* a) {
  free(a->raw.data);
  free(a->type);
}

// ---- the parts a body must arrive as -----------------------------------------

typedef struct {
  char* name;
  Bytes value;
  char* filename; // NULL for a text part
  char* type;     // NULL when the part carries none
} Part;

typedef struct {
  Part* items;
  size_t n;
} Parts;

static void part_add(Parts* ps, const char* name, const char* v, size_t vlen,
                     const char* filename, const char* type) {
  ps->items = (Part*)realloc(ps->items, (ps->n + 1) * sizeof(Part));
  Part* p = &ps->items[ps->n++];
  p->name = strdup(name);
  p->value.data = NULL;
  p->value.len = 0;
  bytes_add(&p->value, v, vlen);
  p->filename = NULL == filename ? NULL : strdup(filename);
  p->type = NULL == type ? NULL : strdup(type);
}

static void parts_free(Parts* ps) {
  for (size_t i = 0; i < ps->n; i++) {
    free(ps->items[i].name);
    free(ps->items[i].value.data);
    free(ps->items[i].filename);
    free(ps->items[i].type);
  }
  free(ps->items);
}

static const char* find(const char* hay, size_t hlen, const char* needle, size_t nlen) {
  for (size_t i = 0; i + nlen <= hlen; i++) {
    if (0 == memcmp(hay + i, needle, nlen)) return hay + i;
  }
  return NULL;
}

static char* param_of(const char* head, size_t hlen, const char* key) {
  const char* at = find(head, hlen, key, strlen(key));
  if (NULL == at) return NULL;
  at += strlen(key);
  size_t n = 0;
  while (at + n < head + hlen && '"' != at[n]) n++;
  char* out = (char*)malloc(n + 1);
  memcpy(out, at, n);
  out[n] = '\0';
  return out;
}

static bool multipart_parts(const Arrived* a, Parts* out) {
  const char* b = strstr(a->type, "boundary=");
  if (NULL == b) return false;
  char delim[256];
  snprintf(delim, sizeof(delim), "--%s", b + 9);
  size_t dlen = strlen(delim);
  char close_[260];
  snprintf(close_, sizeof(close_), "%s--\r\n", delim);
  size_t clen = strlen(close_);
  if (a->blen < clen || 0 != memcmp(a->body + a->blen - clen, close_, clen)) return false;

  const char* at = find(a->body, a->blen, delim, dlen);
  while (NULL != at) {
    const char* start = at + dlen;
    const char* stop = a->body + a->blen;
    const char* next = find(start, (size_t)(stop - start), delim, dlen);
    if (NULL == next) break;
    if (!(2 <= stop - start && '\r' == start[0] && '\n' == start[1])) return false;
    start += 2;
    const char* hend = find(start, (size_t)(next - start), "\r\n\r\n", 4);
    if (NULL == hend) return false;
    size_t hlen = (size_t)(hend - start);
    char* name = param_of(start, hlen, "; name=\"");
    char* filename = param_of(start, hlen, "; filename=\"");
    char* type = NULL;
    const char* ct = find(start, hlen, "Content-Type: ", 14);
    if (NULL != ct) {
      size_t tn = strcspn(ct + 14, "\r");
      if (ct + 14 + tn > start + hlen) tn = (size_t)(start + hlen - ct - 14);
      type = (char*)malloc(tn + 1);
      memcpy(type, ct + 14, tn);
      type[tn] = '\0';
    }
    const char* body = hend + 4;
    size_t blen = (size_t)(next - body) - 2;
    part_add(out, NULL == name ? "" : name, body, blen, filename, type);
    free(name);
    free(filename);
    free(type);
    at = next;
  }
  return true;
}

static int hexv(char c) {
  return '0' <= c && c <= '9' ? c - '0' : 'A' <= c && c <= 'F' ? c - 'A' + 10 :
    'a' <= c && c <= 'f' ? c - 'a' + 10 : -1;
}

static Bytes form_decode(const char* s, size_t n) {
  Bytes out = { NULL, 0 };
  bytes_add(&out, "", 0);
  for (size_t i = 0; i < n; i++) {
    char c = s[i];
    if ('+' == c) c = ' ';
    else if ('%' == c && i + 2 < n + 0 && 0 <= hexv(s[i + 1]) && 0 <= hexv(s[i + 2])) {
      c = (char)(hexv(s[i + 1]) * 16 + hexv(s[i + 2]));
      i += 2;
    }
    bytes_add(&out, &c, 1);
  }
  return out;
}

static void form_parts(const Arrived* a, Parts* out) {
  const char* s = a->body;
  const char* end = a->body + a->blen;
  while (s < end) {
    const char* amp = memchr(s, '&', (size_t)(end - s));
    const char* stop = NULL == amp ? end : amp;
    const char* eq = memchr(s, '=', (size_t)(stop - s));
    const char* vstart = NULL == eq ? stop : eq + 1;
    Bytes name = form_decode(s, (size_t)((NULL == eq ? stop : eq) - s));
    Bytes value = form_decode(vstart, (size_t)(stop - vstart));
    part_add(out, name.data, value.data, value.len, NULL, NULL);
    free(name.data);
    free(value.data);
    s = NULL == amp ? end : amp + 1;
  }
}

static bool opt_eq(const char* a, const char* b) {
  return (NULL == a && NULL == b) || (NULL != a && NULL != b && 0 == strcmp(a, b));
}

static bool expected_name(const Parts* expect, const char* name) {
  for (size_t i = 0; i < expect->n; i++) {
    if (0 == strcmp(expect->items[i].name, name)) return true;
  }
  return false;
}

// The arrived parts the case declares, in order, against the expected ones.
static bool parts_match(const Parts* got, const Parts* expect, const char* label) {
  size_t j = 0;
  for (size_t i = 0; i < got->n; i++) {
    const Part* g = &got->items[i];
    if (!expected_name(expect, g->name)) continue;
    if (j == expect->n) return false;
    const Part* e = &expect->items[j++];
    if (0 != strcmp(g->name, e->name) ||
        !bytes_eq(g->value.data, g->value.len, e->value.data, e->value.len) ||
        !opt_eq(g->filename, e->filename) || !opt_eq(g->type, e->type)) {
      fprintf(stderr, "codec: %s: the part \"%s\" arrived as %zu byte(s), filename %s, type %s\n",
        label, g->name, g->value.len, g->filename ? g->filename : "(none)",
        g->type ? g->type : "(none)");
      return false;
    }
  }
  return j == expect->n;
}

// ---- the cases ------------------------------------------------------------------

static int RAN = 0;
static int FAILED = 0;
static ProjectNameSDK* CLIENT = NULL;

static const char* str_of(voxgig_value* m, const char* k) {
  const char* s = get_str(m, k);
  return NULL == s ? "" : s;
}

// A value for each path parameter a point names.
static voxgig_value* params(voxgig_value* point) {
  voxgig_value* out = voxgig_new_map();
  voxgig_value* parts = getp(point, "parts");
  voxgig_list* pl = voxgig_is_list(parts) ? voxgig_as_list(parts) : NULL;
  for (size_t i = 0; NULL != pl && i < pl->len; i++) {
    if (!voxgig_is_string(pl->items[i])) continue;
    const char* p = voxgig_as_string(pl->items[i]);
    size_t n = strlen(p);
    if (2 < n && '{' == p[0] && '}' == p[n - 1]) {
      char name[128];
      snprintf(name, sizeof(name), "%.*s", (int)(n - 2), p + 1);
      setp(out, name, v_str("p1"));
    }
  }
  return out;
}

static const char* action_of(voxgig_value* point) {
  return get_str(getp(point, "select"), "$action");
}

static voxgig_value* call_data(voxgig_value* point) {
  voxgig_value* data = params(point);
  if (NULL != action_of(point)) setp(data, "$action", v_str(action_of(point)));
  return data;
}

static Entity* fresh(const char* ename, voxgig_value* point) {
  Entity* e = sdk_entity(CLIENT, ename, NULL);
  e->vt->data(e, params(point));
  e->vt->matchv(e, params(point));
  return e;
}

static Entity* send_with(Entity* e, const char* op, voxgig_value* data, const BinaryField* src,
                         size_t n, PNError** err) {
  if (0 == strcmp(op, "update")) return entity_update_with(e, data, src, n, NULL, err);
  if (0 == strcmp(op, "patch")) return entity_patch_with(e, data, src, n, NULL, err);
  return entity_create_with(e, data, src, n, NULL, err);
}

static void report(bool ok, const char* label, PNError* err) {
  RAN++;
  if (!ok) {
    FAILED++;
    fprintf(stderr, "codec: FAIL %s%s%s\n", label, NULL == err ? "" : ": ",
      NULL == err ? "" : err->msg);
  }
}

static void encoded_case(const char* ename, const char* op, voxgig_value* point, const char* label) {
  voxgig_value* rb = getp(point, "body");
  bool form = v_str_eq(getp(rb, "kind"), "form");
  voxgig_value* data = call_data(point);
  BinaryField sources[16];
  Bytes contents[16];
  char paths[16][160];
  size_t nsrc = 0;
  Parts expect = { NULL, 0 };

  voxgig_value* fields = getp(rb, "fields");
  voxgig_list* fl = voxgig_is_list(fields) ? voxgig_as_list(fields) : NULL;
  for (size_t i = 0; NULL != fl && i < fl->len; i++) {
    voxgig_value* field = fl->items[i];
    const char* name = str_of(field, "name");
    bool binary = false;
    bool list = false;
    get_bool(field, "binary", &binary);
    get_bool(field, "list", &list);
    const char* join = get_str(field, "join");
    if (binary && nsrc < 16) {
      const char* media = get_str(field, "media");
      const char* type = form ? NULL : NULL == media ? "application/octet-stream" : media;
      contents[nsrc] = content(name);
      snprintf(paths[nsrc], sizeof(paths[nsrc]), "/local/dir/%s.bin", name);
      sources[nsrc].name = name;
      sources[nsrc].source = binary_bytes(contents[nsrc].data, contents[nsrc].len,
        paths[nsrc], type);
      char filename[160];
      snprintf(filename, sizeof(filename), "%s.bin", name);
      part_add(&expect, name, contents[nsrc].data, contents[nsrc].len, form ? NULL : filename,
        type);
      nsrc++;
    } else if (list) {
      setp(data, name, clist(2, v_str("a"), v_str("b c")));
      part_add(&expect, name, "a", 1, NULL, NULL);
      part_add(&expect, name, "b c", 3, NULL, NULL);
    } else if (NULL != join) {
      setp(data, name, clist(2, v_str("a"), v_str("b")));
      char joined[128];
      snprintf(joined, sizeof(joined), "a%sb", join);
      part_add(&expect, name, joined, strlen(joined), NULL, NULL);
    } else {
      char text[160];
      snprintf(text, sizeof(text), "v\"%s\r\n", name);
      setp(data, name, v_str(text));
      part_add(&expect, name, text, strlen(text), NULL, get_str(field, "media"));
    }
  }

  serve("application/json", "{\"id\":\"p1\"}", 11);
  PNError* err = NULL;
  Entity* e = sdk_entity(CLIENT, ename, NULL);
  Entity* got = send_with(e, op, data, sources, nsrc, &err);
  Arrived a = arrived();
  bool ok = NULL == err && got == e;
  Parts parts = { NULL, 0 };
  if (ok && form) {
    ok = 0 == strcmp(a.type, str_of(rb, "media"));
    form_parts(&a, &parts);
  } else if (ok) {
    ok = multipart_parts(&a, &parts);
  }
  ok = ok && parts_match(&parts, &expect, label);
  report(ok, label, err);

  parts_free(&parts);
  parts_free(&expect);
  arrived_free(&a);
  for (size_t i = 0; i < nsrc; i++) free(contents[i].data);
}

static void raw_send_case(const char* ename, const char* op, voxgig_value* point,
                          const char* label) {
  voxgig_value* rb = getp(point, "body");
  bool binary = false;
  get_bool(rb, "binary", &binary);
  const char* media = str_of(rb, "media");
  Entity* e = fresh(ename, point);
  PNError* err = NULL;
  bool ok = true;
  Bytes want = { NULL, 0 };

  serve("application/json", "{\"id\":\"p1\"}", 11);
  if (binary) {
#if CODEC_HAS_HANDLE
    want = content(label);
    BinaryHandle h = entity_binary(e, action_of(point));
    Entity* got = binary_handle_put(&h, binary_bytes(want.data, want.len, NULL, media), NULL, &err);
    ok = got == e;
#else
    ok = false;
#endif
  } else {
    char text[256];
    snprintf(text, sizeof(text), "text \"%s\"\n", label);
    bytes_add(&want, text, strlen(text));
    voxgig_value* data = call_data(point);
    setp(data, "$body", v_str(text));
    send_with(e, op, data, NULL, 0, &err);
  }
  Arrived a = arrived();
  ok = ok && NULL == err && bytes_eq(a.body, a.blen, want.data, want.len) &&
    0 == strcmp(a.type, media);
  report(ok, label, err);
  arrived_free(&a);
  free(want.data);
}

static void raw_read_case(const char* ename, voxgig_value* point, const char* label) {
  voxgig_value* rs = getp(point, "response");
  bool binary = false;
  get_bool(rs, "binary", &binary);
  const char* media = str_of(rs, "media");
  Entity* e = fresh(ename, point);
  PNError* err = NULL;
  bool ok = false;

  if (binary) {
#if CODEC_HAS_HANDLE
    Bytes want = content(label);
    serve(media, want.data, want.len);
    BinaryHandle h = entity_binary(e, action_of(point));
    size_t len = 0;
    uint8_t* got = binary_handle_bytes(&h, NULL, NULL, &len, &err);
    Arrived a = arrived();
    ok = NULL != got && bytes_eq((const char*)got, len, want.data, want.len);
    free(got);
    arrived_free(&a);
    if (ok) {
      PNError* refused = NULL;
      e->vt->load(e, call_data(point), NULL, &refused);
      ok = NULL != refused && 0 == strcmp(refused->code, "binary_sink_required");
    }
    free(want.data);
#endif
  } else {
    char text[256];
    snprintf(text, sizeof(text), "caf\xC3\xA9 %s", label);
    serve(media, text, strlen(text));
    Entity* got = e->vt->load(e, call_data(point), NULL, &err);
    Arrived a = arrived();
    voxgig_value* body = getp(e->vt->data(e, NULL), "$body");
    ok = got == e && voxgig_is_string(body) &&
      bytes_eq(voxgig_as_string(body), voxgig_string_len(body), text, strlen(text));
    arrived_free(&a);
  }
  report(ok, label, err);
}

static int key_cmp(const void* a, const void* b) {
  return strcmp(*(const char* const*)a, *(const char* const*)b);
}

static const char** sorted_keys(voxgig_value* map, size_t* n) {
  *n = voxgig_is_map(map) ? voxgig_as_map(map)->len : 0;
  const char** keys = (const char**)malloc((*n + 1) * sizeof(char*));
  for (size_t i = 0; i < *n; i++) keys[i] = voxgig_as_map(map)->entries[i].key;
  qsort(keys, *n, sizeof(char*), key_cmp);
  return keys;
}

int main(void) {
  signal(SIGPIPE, SIG_IGN);
  LISTEN = listen_loopback(&PORT);
  CHECK(0 <= LISTEN, "a loopback listener");

  char base[64];
  snprintf(base, sizeof(base), "http://127.0.0.1:%d", PORT);
  PNError* cerr = NULL;
  CLIENT = projectname_sdk_new(cmap(1, "base", v_str(base)), &cerr);
  CHECK(NULL != CLIENT, "a live client");

  voxgig_value* entities = getp(shared_config(), "entity");
  size_t ne = 0;
  const char** enames = sorted_keys(entities, &ne);
  for (size_t i = 0; NULL != CLIENT && i < ne; i++) {
    const char* ename = enames[i];
    if (NULL == sdk_entity(CLIENT, ename, NULL)) continue;
    voxgig_value* ops = getp(getp(entities, ename), "op");
    size_t no = 0;
    const char** onames = sorted_keys(ops, &no);
    for (size_t j = 0; j < no; j++) {
      const char* op = onames[j];
      bool writes = 0 == strcmp(op, "create") || 0 == strcmp(op, "update") ||
        0 == strcmp(op, "patch");
      voxgig_value* points = getp(getp(ops, op), "points");
      voxgig_list* pl = voxgig_is_list(points) ? voxgig_as_list(points) : NULL;
      for (size_t k = 0; NULL != pl && k < pl->len; k++) {
        voxgig_value* point = pl->items[k];
        const char* action = action_of(point);
        char label[160];
        snprintf(label, sizeof(label), "%s.%s%s%s", ename, op, NULL == action ? "" : ":",
          NULL == action ? "" : action);
        const char* rbk = str_of(getp(point, "body"), "kind");
        if (writes && (0 == strcmp(rbk, "form") || 0 == strcmp(rbk, "multipart"))) {
          encoded_case(ename, op, point, label);
        }
        if (writes && 0 == strcmp(rbk, "raw")) raw_send_case(ename, op, point, label);
        if (0 == strcmp(op, "load") && v_str_eq(getp(getp(point, "response"), "kind"), "raw")) {
          raw_read_case(ename, point, label);
        }
      }
    }
    free(onames);
  }
  free(enames);

  printf("codec: ran %d case(s), %d failed\n", RAN, FAILED);
  CHECK(0 < RAN, "this SDK has a point to drive");
  CHECK(0 == FAILED, "every case passes");
  TEST_SUMMARY("codec");
}

#endif
