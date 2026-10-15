// The default live transport: HTTP/1.1 over a socket, one request per
// connection. https:// goes through the TLS backend the Makefile selects
// (utility/tls/), and a build without one refuses it by name.

#if !defined(_WIN32) && !defined(_POSIX_C_SOURCE)
#define _POSIX_C_SOURCE 200809L
#endif
#if defined(__APPLE__) && !defined(_DARWIN_C_SOURCE)
#define _DARWIN_C_SOURCE
#endif

#include "sdk.h"

#include "tls/tls.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// The whole exchange, from resolving the host to the last byte read.
#ifndef HTTP_TIMEOUT_MS
#define HTTP_TIMEOUT_MS 30000
#endif

// Every byte of a response, its headers included.
#ifndef HTTP_MAX_BYTES
#define HTTP_MAX_BYTES (32 * 1024 * 1024)
#endif

#define HTTP_USER_AGENT "Mozilla/5.0 (compatible; ProjectNameSDK/1.0)"

// The URL as an error may quote it: no userinfo, query or fragment.
static char* bare_url(const char* url) {
  const char* scheme = strstr(url, "://");
  const char* auth = NULL == scheme ? url : scheme + 3;
  size_t alen = strcspn(auth, "/?#");
  const char* from = auth;
  for (size_t i = 0; i < alen; i++) {
    if ('@' == auth[i]) from = auth + i + 1;
  }
  size_t head = (size_t)(auth - url);
  size_t tail = strcspn(from, "?#");
  char* out = (char*)malloc(head + tail + 1);
  memcpy(out, url, head);
  memcpy(out + head, from, tail);
  out[head + tail] = '\0';
  return out;
}

static PNError* transport_error(Context* ctx, const char* url, const char* what,
                                const char* why) {
  char* bare = bare_url(url);
  size_t n = strlen(what) + (NULL == why ? 0 : strlen(why) + 2) + strlen(bare) + 16;
  char* msg = (char*)malloc(n);
  snprintf(msg, n, "%s%s%s (URL was: \"%s\")", what, NULL == why ? "" : ": ",
    NULL == why ? "" : why, bare);
  PNError* e = context_make_error(ctx, "fetch_transport", msg);
  free(bare);
  free(msg);
  return e;
}

#if defined(_WIN32)

voxgig_value* http_fetch(Context* ctx, const char* url, voxgig_value* fetchdef, PNError** err) {
  (void)fetchdef;
  *err = transport_error(ctx, NULL == url ? "" : url, "the default transport needs POSIX "
    "sockets, which this platform does not have; supply options.system.fetch", NULL);
  return NULL;
}

#else

#include <errno.h>
#include <fcntl.h>
#include <netdb.h>
#include <poll.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>

#if defined(MSG_NOSIGNAL)
#define HTTP_SEND_FLAGS MSG_NOSIGNAL
#else
#define HTTP_SEND_FLAGS 0
#endif

// ---- bytes and words -----------------------------------------------------------

typedef struct {
  char* data;
  size_t len;
  size_t cap;
} HttpBuf;

static void buf_add(HttpBuf* b, const char* s, size_t n) {
  if (b->len + n + 1 > b->cap) {
    size_t cap = 0 == b->cap ? 1024 : b->cap;
    while (b->len + n + 1 > cap) cap *= 2;
    b->data = (char*)realloc(b->data, cap);
    b->cap = cap;
  }
  if (0 < n) memcpy(b->data + b->len, s, n);
  b->len += n;
  b->data[b->len] = '\0';
}

static void buf_str(HttpBuf* b, const char* s) { buf_add(b, s, strlen(s)); }

static int ieqn(const char* a, size_t n, const char* b) {
  if (strlen(b) != n) return 0;
  for (size_t i = 0; i < n; i++) {
    if (tolower((unsigned char)a[i]) != tolower((unsigned char)b[i])) return 0;
  }
  return 1;
}

static int ieq(const char* a, const char* b) { return ieqn(a, strlen(a), b); }

static int is_token(const char* s) {
  if ('\0' == *s) return 0;
  for (; *s; s++) {
    unsigned char ch = (unsigned char)*s;
    if (!isalnum(ch) && NULL == strchr("!#$%&'*+-.^_`|~", ch)) return 0;
  }
  return 1;
}

static int is_field_value(const char* s, size_t n) {
  for (size_t i = 0; i < n; i++) {
    if ('\r' == s[i] || '\n' == s[i] || '\0' == s[i]) return 0;
  }
  return 1;
}

static int hexval(char ch) {
  return isdigit((unsigned char)ch) ? ch - '0' : tolower((unsigned char)ch) - 'a' + 10;
}

static int percent_decode(char* out, size_t cap, const char* s, size_t n) {
  size_t o = 0;
  for (size_t i = 0; i < n; i++) {
    char ch = s[i];
    if ('%' == ch && i + 2 < n && isxdigit((unsigned char)s[i + 1]) &&
        isxdigit((unsigned char)s[i + 2])) {
      ch = (char)(hexval(s[i + 1]) * 16 + hexval(s[i + 2]));
      i += 2;
    }
    if (o + 1 >= cap) return 0;
    out[o++] = ch;
  }
  out[o] = '\0';
  return 1;
}

// ---- URLs ---------------------------------------------------------------------

typedef struct {
  int tls;
  char host[256];      // bare: what is dialled, and what TLS verifies
  char authority[300]; // as the Host header carries it
  int port;
  const char* target;  // path and query, pointing into the URL
  size_t target_len;
  char user[256];      // a proxy URL's userinfo, decoded
  char pass[256];
} HttpUrl;

// Splits an absolute http:// or https:// URL; a message on failure. Only a
// proxy's URL may carry userinfo.
static const char* parse_url(const char* url, HttpUrl* u, int userinfo) {
  memset(u, 0, sizeof(*u));
  const char* auth;
  if (0 == strncmp(url, "http://", 7)) {
    auth = url + 7;
  } else if (0 == strncmp(url, "https://", 8)) {
    auth = url + 8;
    u->tls = 1;
  } else {
    return "it is not an http:// or https:// URL";
  }

  size_t alen = strcspn(auth, "/?#");
  const char* at = NULL;
  for (size_t i = 0; i < alen; i++) {
    if ('@' == auth[i]) at = auth + i;
  }
  if (NULL != at) {
    if (!userinfo) return "the URL carries credentials, and a URL never sends them";
    const char* colon = memchr(auth, ':', (size_t)(at - auth));
    size_t ulen = (size_t)((NULL == colon ? at : colon) - auth);
    if (!percent_decode(u->user, sizeof(u->user), auth, ulen) ||
        (NULL != colon &&
         !percent_decode(u->pass, sizeof(u->pass), colon + 1, (size_t)(at - colon - 1)))) {
      return "the URL's userinfo is too long";
    }
    alen -= (size_t)(at + 1 - auth);
    auth = at + 1;
  }

  const char* end = auth + alen;
  const char* port = NULL;
  const char* host = auth;
  size_t hlen;
  if (0 < alen && '[' == auth[0]) {
    const char* close = memchr(auth, ']', alen);
    if (NULL == close) return "the URL's IPv6 address has no closing bracket";
    host = auth + 1;
    hlen = (size_t)(close - host);
    if (close + 1 < end) {
      if (':' != close[1]) return "the URL's authority is malformed";
      port = close + 2;
    }
  } else {
    const char* colon = memchr(auth, ':', alen);
    hlen = (size_t)((NULL == colon ? end : colon) - auth);
    if (NULL != colon) port = colon + 1;
  }
  if (0 == hlen) return "the URL has no host";
  if (hlen >= sizeof(u->host)) return "the URL's host is too long";
  for (size_t i = 0; i < hlen; i++) {
    unsigned char ch = (unsigned char)host[i];
    if (ch <= 0x20 || 0x7f <= ch || NULL != strchr("\"<>\\^`{|}/?#@[]", ch)) {
      return "the URL's host is malformed";
    }
  }
  memcpy(u->host, host, hlen);
  u->host[hlen] = '\0';

  int fallback = u->tls ? 443 : 80;
  u->port = fallback;
  if (NULL != port) {
    long n = 0;
    if (port == end) return "the URL's port is malformed";
    for (const char* p = port; p < end; p++) {
      if (!isdigit((unsigned char)*p) || 65535 < (n = n * 10 + (*p - '0'))) {
        return "the URL's port is malformed";
      }
    }
    if (0 == n) return "the URL's port is malformed";
    u->port = (int)n;
  }

  const char* open = NULL == strchr(u->host, ':') ? "" : "[";
  const char* shut = '\0' == open[0] ? "" : "]";
  if (fallback == u->port) {
    snprintf(u->authority, sizeof(u->authority), "%s%s%s", open, u->host, shut);
  } else {
    snprintf(u->authority, sizeof(u->authority), "%s%s%s:%d", open, u->host, shut, u->port);
  }

  u->target = end;
  u->target_len = strcspn(end, "#");
  return NULL;
}

// A SHA-256 fingerprint, as hex with or without colons.
static int parse_pin(const char* text, unsigned char pin[32]) {
  size_t n = 0;
  for (const char* p = text; *p; p++) {
    if (':' == *p) continue;
    if (!isxdigit((unsigned char)*p) || 64 <= n) return 0;
    if (0 == n % 2) pin[n / 2] = (unsigned char)(hexval(*p) << 4);
    else pin[n / 2] |= (unsigned char)hexval(*p);
    n++;
  }
  return 64 == n;
}

// ---- the connection -------------------------------------------------------------

typedef struct {
  int fd;
  int64_t deadline;
  HttpTls* tls;
} HttpConn;

static int64_t monotonic_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (int64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
}

static int64_t remaining(HttpConn* c) { return c->deadline - monotonic_ms(); }

// What is left of the deadline, as the socket's bound on one call.
static void bound(int fd, int opt, int64_t ms) {
  struct timeval tv;
  if (ms < 1) ms = 1;
  tv.tv_sec = (time_t)(ms / 1000);
  tv.tv_usec = (suseconds_t)((ms % 1000) * 1000);
  setsockopt(fd, SOL_SOCKET, opt, &tv, sizeof(tv));
}

static long sock_send(void* io, const char* data, size_t len, const char** why) {
  HttpConn* c = (HttpConn*)io;
  for (;;) {
    int64_t left = remaining(c);
    if (left <= 0) {
      *why = "timed out";
      return -1;
    }
    bound(c->fd, SO_SNDTIMEO, left);
    ssize_t n = send(c->fd, data, len, HTTP_SEND_FLAGS);
    if (0 <= n) return (long)n;
    if (EINTR == errno) continue;
    *why = EAGAIN == errno || EWOULDBLOCK == errno ? "timed out" : strerror(errno);
    return -1;
  }
}

static long sock_recv(void* io, char* data, size_t len, const char** why) {
  HttpConn* c = (HttpConn*)io;
  for (;;) {
    int64_t left = remaining(c);
    if (left <= 0) {
      *why = "timed out";
      return -1;
    }
    bound(c->fd, SO_RCVTIMEO, left);
    ssize_t n = recv(c->fd, data, len, 0);
    if (0 <= n) return (long)n;
    if (EINTR == errno) continue;
    *why = EAGAIN == errno || EWOULDBLOCK == errno ? "timed out" : strerror(errno);
    return -1;
  }
}

static long conn_recv(HttpConn* c, char* data, size_t len, const char** why) {
  return NULL == c->tls ? sock_recv(c, data, len, why) : http_tls_read(c->tls, data, len, why);
}

static const char* send_all(HttpConn* c, const char* data, size_t len) {
  while (0 < len) {
    const char* why = "the connection closed";
    long n = NULL == c->tls ? sock_send(c, data, len, &why)
                            : http_tls_write(c->tls, data, len, &why);
    if (n <= 0) return why;
    data += n;
    len -= (size_t)n;
  }
  return NULL;
}

// Connects within the exchange's deadline. Every address a name resolves to
// shares it, so a name with many addresses cannot multiply the wait.
static const char* dial(HttpConn* c, const char* host, int port, char* why, size_t whylen) {
  struct addrinfo hints;
  struct addrinfo* found = NULL;
  char service[16];
  memset(&hints, 0, sizeof(hints));
  hints.ai_family = AF_UNSPEC;
  hints.ai_socktype = SOCK_STREAM;
  snprintf(service, sizeof(service), "%d", port);

  int code = getaddrinfo(host, service, &hints, &found);
  if (0 != code) {
    snprintf(why, whylen, "cannot resolve %s: %s", host, gai_strerror(code));
    return why;
  }

  const char* last = "no address";
  for (struct addrinfo* at = found; NULL != at; at = at->ai_next) {
    if (remaining(c) <= 0) {
      last = "timed out";
      break;
    }
    int fd = socket(at->ai_family, at->ai_socktype, at->ai_protocol);
    if (fd < 0) {
      last = strerror(errno);
      continue;
    }
#if defined(SO_NOSIGPIPE)
    int one = 1;
    setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof(one));
#endif
    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags | O_NONBLOCK);
    int connected = 0 == connect(fd, at->ai_addr, at->ai_addrlen);
    if (!connected && EINPROGRESS == errno) {
      struct pollfd wait;
      int ready;
      wait.fd = fd;
      wait.events = POLLOUT;
      wait.revents = 0;
      do {
        int64_t left = remaining(c);
        ready = left <= 0 ? 0 : poll(&wait, 1, (int)left);
      } while (ready < 0 && EINTR == errno);
      if (0 < ready) {
        int problem = 0;
        socklen_t size = sizeof(problem);
        getsockopt(fd, SOL_SOCKET, SO_ERROR, &problem, &size);
        connected = 0 == problem;
        if (!connected) last = strerror(problem);
      } else {
        last = 0 == ready ? "timed out" : strerror(errno);
      }
    } else if (!connected) {
      last = strerror(errno);
    }
    if (connected) {
      fcntl(fd, F_SETFL, flags);
      freeaddrinfo(found);
      c->fd = fd;
      return NULL;
    }
    close(fd);
  }
  freeaddrinfo(found);
  snprintf(why, whylen, "cannot connect to %s port %d: %s", host, port, last);
  return why;
}

// ---- the response -----------------------------------------------------------------

typedef struct {
  HttpBuf raw;
  HttpBuf body;
  int status;
  char reason[128];
  voxgig_value* headers;
  char why[128];
} HttpResp;

static const char* too_large(HttpResp* r) {
  snprintf(r->why, sizeof(r->why), "the response is larger than %ld bytes",
    (long)HTTP_MAX_BYTES);
  return r->why;
}

static const char* find_end_of_head(const char* s, size_t n) {
  for (size_t i = 0; i + 3 < n; i++) {
    if ('\r' == s[i] && '\n' == s[i + 1] && '\r' == s[i + 2] && '\n' == s[i + 3]) return s + i;
  }
  return NULL;
}

// Reads more of the response into raw: 0 at the end of the stream, -1 on
// failure, which includes a response grown past the bound.
static long fill(HttpConn* c, HttpResp* r, const char** why) {
  char chunk[16384];
  long n = conn_recv(c, chunk, sizeof(chunk), why);
  if (0 < n) {
    if ((size_t)HTTP_MAX_BYTES < r->raw.len + (size_t)n) {
      *why = too_large(r);
      return -1;
    }
    buf_add(&r->raw, chunk, (size_t)n);
  }
  return n;
}

// Repeated header lines are joined with ", ", under the name in lower case.
static void add_header(voxgig_value* headers, const char* name, size_t nlen, const char* value,
                       size_t vlen) {
  char* key = (char*)malloc(nlen + 1);
  for (size_t i = 0; i < nlen; i++) key[i] = (char)tolower((unsigned char)name[i]);
  key[nlen] = '\0';
  voxgig_value* prior = getp(headers, key);
  HttpBuf joined = { NULL, 0, 0 };
  if (voxgig_is_string(prior)) {
    buf_add(&joined, voxgig_as_string(prior), voxgig_string_len(prior));
    buf_str(&joined, ", ");
  }
  buf_add(&joined, value, vlen);
  setp(headers, key, voxgig_new_string_n(joined.data, joined.len));
  free(joined.data);
  free(key);
}

// The status line and headers in raw[from, from + n); a message on failure.
static const char* parse_head(HttpResp* r, size_t from, size_t n) {
  const char* s = r->raw.data + from;
  size_t eol = 0;
  while (eol < n && '\n' != s[eol]) eol++;
  size_t line = 0 < eol && '\r' == s[eol - 1] ? eol - 1 : eol;
  if (line < 12 || 0 != strncmp(s, "HTTP/1.", 7) || ' ' != s[8] ||
      !isdigit((unsigned char)s[9]) || !isdigit((unsigned char)s[10]) ||
      !isdigit((unsigned char)s[11]) || (12 < line && ' ' != s[12])) {
    return "its status line is malformed";
  }
  r->status = (s[9] - '0') * 100 + (s[10] - '0') * 10 + (s[11] - '0');
  r->reason[0] = '\0';
  if (13 < line) {
    size_t rlen = line - 13 < sizeof(r->reason) ? line - 13 : sizeof(r->reason) - 1;
    memcpy(r->reason, s + 13, rlen);
    r->reason[rlen] = '\0';
  }

  r->headers = voxgig_new_map();
  const char* name = NULL;
  size_t nlen = 0;
  HttpBuf value = { NULL, 0, 0 };
  for (size_t at = eol + 1; at < n;) {
    size_t e = at;
    while (e < n && '\n' != s[e]) e++;
    size_t len = e - at;
    if (0 < len && '\r' == s[at + len - 1]) len--;
    if (0 < len && (' ' == s[at] || '\t' == s[at])) {
      // An obsolete folded line continues the header before it.
      size_t skip = 0;
      while (skip < len && (' ' == s[at + skip] || '\t' == s[at + skip])) skip++;
      if (NULL != name) {
        buf_str(&value, " ");
        buf_add(&value, s + at + skip, len - skip);
      }
    } else {
      if (NULL != name) add_header(r->headers, name, nlen, value.data, value.len);
      name = NULL;
      value.len = 0;
      const char* colon = memchr(s + at, ':', len);
      if (NULL != colon && colon > s + at) {
        const char* v = colon + 1;
        const char* vend = s + at + len;
        while (v < vend && (' ' == *v || '\t' == *v)) v++;
        while (vend > v && (' ' == vend[-1] || '\t' == vend[-1])) vend--;
        name = s + at;
        nlen = (size_t)(colon - name);
        buf_add(&value, v, (size_t)(vend - v));
      }
    }
    at = e + 1;
  }
  if (NULL != name) add_header(r->headers, name, nlen, value.data, value.len);
  free(value.data);
  return NULL;
}

// Whether chunked is the last coding a transfer-encoding names.
static int ends_chunked(const char* te) {
  const char* last = te;
  for (const char* p = te; *p; p++) {
    if (',' == *p) last = p + 1;
  }
  while (' ' == *last || '\t' == *last) last++;
  size_t n = strlen(last);
  while (0 < n && (' ' == last[n - 1] || '\t' == last[n - 1])) n--;
  return ieqn(last, n, "chunked");
}

// The one length a content-length names, -1 for none it could mean: a list
// of equal lengths is one length, and a list that disagrees is no length.
static long long content_length(const char* s) {
  long long len = -1;
  while (*s) {
    while (' ' == *s || '\t' == *s || ',' == *s) s++;
    if ('\0' == *s) break;
    if (!isdigit((unsigned char)*s)) return -1;
    long long v = 0;
    for (; isdigit((unsigned char)*s); s++) {
      if (v > (long long)HTTP_MAX_BYTES) return (long long)HTTP_MAX_BYTES + 1;
      v = v * 10 + (*s - '0');
    }
    while (' ' == *s || '\t' == *s) s++;
    if (('\0' != *s && ',' != *s) || (0 <= len && v != len)) return -1;
    len = v;
  }
  return len;
}

// Decodes the chunks from raw[*at]: 1 when the body is complete, 0 when more
// is needed, -1 when the framing is malformed, -2 past the bound.
static int dechunk(HttpResp* r, size_t* at, int* trailer) {
  for (;;) {
    const char* s = r->raw.data + *at;
    size_t n = r->raw.len - *at;
    const char* lf = memchr(s, '\n', n);
    if (NULL == lf) return 0;
    size_t line = (size_t)(lf - s);
    if (*trailer) {
      *at += line + 1;
      if (0 == line || (1 == line && '\r' == s[0])) return 1;
      continue;
    }
    size_t size = 0;
    size_t i = 0;
    for (; i < line && isxdigit((unsigned char)s[i]); i++) {
      if (size > (size_t)HTTP_MAX_BYTES) return -2;
      size = size * 16 + (size_t)hexval(s[i]);
    }
    if (0 == i || (i < line && ('\0' == s[i] || NULL == strchr("; \t\r", s[i])))) return -1;
    if (0 == size) {
      *at += line + 1;
      *trailer = 1;
      continue;
    }
    if ((size_t)HTTP_MAX_BYTES < r->body.len + size) return -2;
    if (n < line + 1 + size + 2) return 0;
    const char* data = lf + 1;
    size_t crlf = '\r' == data[size] && '\n' == data[size + 1] ? 2 : '\n' == data[size] ? 1 : 0;
    if (0 == crlf) return -1;
    buf_add(&r->body, data, size);
    *at += line + 1 + size + crlf;
  }
}

// Reads the final response, past any 1xx, framed as its headers say.
static const char* read_response(HttpConn* c, HttpResp* r, int head) {
  const char* why = NULL;
  size_t from = 0;
  for (;;) {
    const char* end = NULL;
    while (r->raw.len < from + 4 ||
           NULL == (end = find_end_of_head(r->raw.data + from, r->raw.len - from))) {
      long n = fill(c, r, &why);
      if (n < 0) return why;
      if (0 == n) return 0 == r->raw.len ? "the server closed the connection without answering"
                                         : "the response ended inside its headers";
    }
    size_t stop = (size_t)(end - r->raw.data);
    const char* bad = parse_head(r, from, stop + 2 - from);
    if (NULL != bad) return bad;
    from = stop + 4;
    if (101 == r->status || 200 <= r->status) break;
  }

  if (head || 204 == r->status || 304 == r->status || r->status < 200) return NULL;

  const char* te = get_str(r->headers, "transfer-encoding");
  const char* cl = get_str(r->headers, "content-length");

  if (NULL != te && ends_chunked(te)) {
    size_t at = from;
    int trailer = 0;
    for (;;) {
      int done = dechunk(r, &at, &trailer);
      if (1 == done) return NULL;
      if (-1 == done) return "its chunked framing is malformed";
      if (-2 == done) return too_large(r);
      long n = fill(c, r, &why);
      if (n < 0) return why;
      if (0 == n) return "the response ended before its last chunk";
    }
  }

  if (NULL == te && NULL != cl) {
    long long want = content_length(cl);
    if (want < 0) return "its content-length is malformed";
    if ((long long)HTTP_MAX_BYTES < want) return too_large(r);
    while ((long long)(r->raw.len - from) < want) {
      long n = fill(c, r, &why);
      if (n < 0) return why;
      if (0 == n) return "the response ended before its content-length";
    }
    buf_add(&r->body, r->raw.data + from, (size_t)want);
    return NULL;
  }

  for (;;) {
    long n = fill(c, r, &why);
    if (n < 0) return why;
    if (0 == n) break;
  }
  buf_add(&r->body, r->raw.data + from, r->raw.len - from);
  return NULL;
}

// ---- JSON ----------------------------------------------------------------------

// A strict recognizer, because the vendored parser reads a truncated
// document as the part it got, and that part is not what the server sent.
typedef struct {
  const char* s;
  size_t n;
  size_t i;
  int depth;
} JsonScan;

static void js_space(JsonScan* j) {
  while (j->i < j->n && NULL != memchr(" \t\r\n", j->s[j->i], 4)) j->i++;
}

static int js_digits(JsonScan* j) {
  size_t from = j->i;
  while (j->i < j->n && isdigit((unsigned char)j->s[j->i])) j->i++;
  return j->i > from;
}

static int js_string(JsonScan* j) {
  if (j->i >= j->n || '"' != j->s[j->i]) return 0;
  j->i++;
  while (j->i < j->n) {
    unsigned char ch = (unsigned char)j->s[j->i++];
    if ('"' == ch) return 1;
    if (ch < 0x20) return 0;
    if ('\\' != ch) continue;
    if (j->i >= j->n) return 0;
    char e = j->s[j->i++];
    if ('u' == e) {
      for (int k = 0; k < 4; k++, j->i++) {
        if (j->i >= j->n || !isxdigit((unsigned char)j->s[j->i])) return 0;
      }
    } else if ('\0' == e || NULL == strchr("\"\\/bfnrt", e)) {
      return 0;
    }
  }
  return 0;
}

static int js_value(JsonScan* j) {
  js_space(j);
  if (j->i >= j->n) return 0;
  char c = j->s[j->i];
  if ('{' == c || '[' == c) {
    char close = '{' == c ? '}' : ']';
    if (1024 < ++j->depth) return 0;
    j->i++;
    js_space(j);
    if (j->i < j->n && close == j->s[j->i]) {
      j->i++;
      j->depth--;
      return 1;
    }
    for (;;) {
      if ('}' == close) {
        js_space(j);
        if (!js_string(j)) return 0;
        js_space(j);
        if (j->i >= j->n || ':' != j->s[j->i++]) return 0;
      }
      if (!js_value(j)) return 0;
      js_space(j);
      if (j->i >= j->n) return 0;
      char d = j->s[j->i++];
      if (close == d) {
        j->depth--;
        return 1;
      }
      if (',' != d) return 0;
    }
  }
  if ('"' == c) return js_string(j);
  const char* words[] = { "true", "false", "null" };
  for (size_t k = 0; k < 3; k++) {
    size_t len = strlen(words[k]);
    if (len <= j->n - j->i && 0 == memcmp(j->s + j->i, words[k], len)) {
      j->i += len;
      return 1;
    }
  }
  if ('-' == c) j->i++;
  if (j->i < j->n && '0' == j->s[j->i]) j->i++;
  else if (!js_digits(j)) return 0;
  if (j->i < j->n && '.' == j->s[j->i]) {
    j->i++;
    if (!js_digits(j)) return 0;
  }
  if (j->i < j->n && ('e' == j->s[j->i] || 'E' == j->s[j->i])) {
    j->i++;
    if (j->i < j->n && ('+' == j->s[j->i] || '-' == j->s[j->i])) j->i++;
    if (!js_digits(j)) return 0;
  }
  return 1;
}

static int json_valid(const char* s, size_t n) {
  JsonScan j = { s, n, 0, 0 };
  if (!js_value(&j)) return 0;
  js_space(&j);
  return j.i == n;
}

// ---- the request ------------------------------------------------------------------

// The transport frames the request itself, and a proxy credential goes only
// to the proxy, never to an origin.
static int owned_header(const char* name) {
  return ieq(name, "host") || ieq(name, "content-length") || ieq(name, "transfer-encoding") ||
    ieq(name, "connection") || ieq(name, "proxy-authorization");
}

static void proxy_credentials(HttpBuf* req, const HttpUrl* proxy) {
  if ('\0' == proxy->user[0]) return;
  HttpBuf plain = { NULL, 0, 0 };
  buf_str(&plain, proxy->user);
  buf_str(&plain, ":");
  buf_str(&plain, proxy->pass);
  char* encoded = clean_base64(plain.data);
  buf_str(req, "Proxy-Authorization: Basic ");
  buf_str(req, encoded);
  buf_str(req, "\r\n");
  free(encoded);
  free(plain.data);
}

// The bytes to send, or a message naming what cannot be sent.
static const char* build_request(HttpBuf* req, const char* method, const HttpUrl* u,
                                 const char* url, const HttpUrl* proxy, voxgig_value* fetchdef) {
  buf_str(req, method);
  buf_str(req, " ");
  // Through a proxy, an http:// request names the whole URL.
  if (NULL != proxy && !u->tls) buf_add(req, url, (size_t)(u->target - url));
  if (0 == u->target_len || '/' != u->target[0]) buf_str(req, "/");
  buf_add(req, u->target, u->target_len);
  buf_str(req, " HTTP/1.1\r\nHost: ");
  buf_str(req, u->authority);
  buf_str(req, "\r\n");

  int agent = 0;
  voxgig_value* headers = getp(fetchdef, "headers");
  if (voxgig_is_map(headers)) {
    voxgig_map* hm = voxgig_as_map(headers);
    for (size_t i = 0; i < hm->len; i++) {
      const char* name = hm->entries[i].key;
      voxgig_value* val = hm->entries[i].value;
      char num[64];
      const char* text = num;
      size_t tlen;
      if (voxgig_is_string(val)) {
        text = voxgig_as_string(val);
        tlen = voxgig_string_len(val);
      } else if (voxgig_is_int(val)) {
        tlen = (size_t)snprintf(num, sizeof(num), "%lld", (long long)voxgig_as_int(val));
      } else if (voxgig_is_double(val)) {
        tlen = (size_t)snprintf(num, sizeof(num), "%.17g", voxgig_as_double(val));
      } else if (voxgig_is_bool(val)) {
        tlen = (size_t)snprintf(num, sizeof(num), "%s", voxgig_as_bool(val) ? "true" : "false");
      } else {
        continue;
      }
      if (owned_header(name)) continue;
      if (!is_token(name) || !is_field_value(text, tlen)) {
        return "a request header has a name or a value HTTP cannot carry";
      }
      if (ieq(name, "user-agent")) agent = 1;
      buf_str(req, name);
      buf_str(req, ": ");
      buf_add(req, text, tlen);
      buf_str(req, "\r\n");
    }
  }
  if (!agent) {
    buf_str(req, "User-Agent: " HTTP_USER_AGENT "\r\n");
    if (voxgig_is_map(headers)) setp(headers, "user-agent", v_str(HTTP_USER_AGENT));
  }
  if (NULL != proxy && !u->tls) proxy_credentials(req, proxy);

  voxgig_value* body = getp(fetchdef, "body");
  char* encoded = NULL;
  const char* bytes = NULL;
  size_t blen = 0;
  if (voxgig_is_string(body)) {
    bytes = voxgig_as_string(body);
    blen = voxgig_string_len(body);
  } else if (!v_is_noval(body) && !v_is_null(body)) {
    encoded = voxgig_jsonify(body, NULL);
    bytes = NULL == encoded ? "" : encoded;
    blen = strlen(bytes);
  }
  if (NULL != bytes || ieq(method, "POST") || ieq(method, "PUT") || ieq(method, "PATCH")) {
    char len[48];
    snprintf(len, sizeof(len), "Content-Length: %lu\r\n", (unsigned long)blen);
    buf_str(req, len);
  }
  buf_str(req, "Connection: close\r\n\r\n");
  if (NULL != bytes) buf_add(req, bytes, blen);
  free(encoded);
  return NULL;
}

// Through an http:// proxy to an https:// origin: CONNECT, then TLS inside it.
static const char* tunnel(HttpConn* c, const HttpUrl* u, const HttpUrl* proxy) {
  char target[300];
  const char* open = NULL == strchr(u->host, ':') ? "" : "[";
  snprintf(target, sizeof(target), "%s%s%s:%d", open, u->host, '\0' == open[0] ? "" : "]",
    u->port);
  HttpBuf req = { NULL, 0, 0 };
  buf_str(&req, "CONNECT ");
  buf_str(&req, target);
  buf_str(&req, " HTTP/1.1\r\nHost: ");
  buf_str(&req, target);
  buf_str(&req, "\r\n");
  proxy_credentials(&req, proxy);
  buf_str(&req, "\r\n");
  const char* failed = send_all(c, req.data, req.len);
  free(req.data);
  if (NULL != failed) return failed;

  // A byte at a time, so nothing after the proxy's answer is consumed.
  char head[4096];
  size_t n = 0;
  while (n < 4 || NULL == find_end_of_head(head, n)) {
    const char* why = "the proxy closed the connection";
    if (sizeof(head) == n) return "the proxy's answer is too long";
    if (1 != sock_recv(c, head + n, 1, &why)) return why;
    n++;
  }
  return 12 <= n && 0 == strncmp(head, "HTTP/1.", 7) && '2' == head[9]
    ? NULL : "the proxy refused the tunnel";
}

voxgig_value* http_fetch(Context* ctx, const char* url, voxgig_value* fetchdef, PNError** err) {
  *err = NULL;
  if (NULL == url) url = "";

  HttpUrl u;
  const char* bad = parse_url(url, &u, 0);
  if (NULL != bad) {
    *err = transport_error(ctx, url, "the request cannot be sent", bad);
    return NULL;
  }

  HttpUrl proxy;
  const char* via = get_str(fetchdef, "proxy");
  int proxied = NULL != via && '\0' != via[0];
  if (proxied) {
    bad = parse_url(via, &proxy, 1);
    if (NULL == bad && proxy.tls) bad = "the default transport reaches no https:// proxy";
    if (NULL != bad) {
      *err = transport_error(ctx, url, "the proxy cannot be used", bad);
      return NULL;
    }
  }

  const char* pintext = getenv("PROJECTENV_TLS_PIN");
  const char* bundle = getenv("PROJECTENV_CA_BUNDLE");
  int pinned = NULL != pintext && '\0' != pintext[0];
  unsigned char pin[32];
  if (u.tls) {
    if (!http_tls_available()) {
      *err = transport_error(ctx, url, "an https:// request needs TLS, and this SDK was built "
        "without it (TLS=none): rebuild it with TLS=openssl, or supply options.system.fetch",
        NULL);
      return NULL;
    }
    if (pinned && !parse_pin(pintext, pin)) {
      *err = transport_error(ctx, url, "the server cannot be verified", "PROJECTENV_TLS_PIN "
        "is not a SHA-256 fingerprint (64 hex digits, colons allowed)");
      return NULL;
    }
  }

  const char* method = get_str(fetchdef, "method");
  if (NULL == method || '\0' == method[0]) method = "GET";
  if (!is_token(method)) {
    *err = transport_error(ctx, url, "the request cannot be sent", "its method is not a token");
    return NULL;
  }

  HttpBuf req = { NULL, 0, 0 };
  bad = build_request(&req, method, &u, url, proxied ? &proxy : NULL, fetchdef);
  if (NULL != bad) {
    free(req.data);
    *err = transport_error(ctx, url, "the request cannot be sent", bad);
    return NULL;
  }

  HttpConn c;
  char why[512];
  c.fd = -1;
  c.tls = NULL;
  c.deadline = monotonic_ms() + HTTP_TIMEOUT_MS;
  bad = dial(&c, proxied ? proxy.host : u.host, proxied ? proxy.port : u.port, why, sizeof(why));
  if (NULL == bad && proxied && u.tls) bad = tunnel(&c, &u, &proxy);
  if (NULL == bad && u.tls) {
    HttpTlsIo io;
    io.io = &c;
    io.send = sock_send;
    io.recv = sock_recv;
    // Verified before it returns: a refused certificate is refused before
    // any byte of the request is written.
    char* refused = http_tls_open(io, u.host, pinned ? pin : NULL,
      NULL != bundle && '\0' != bundle[0] ? bundle : NULL, &c.tls);
    if (NULL != refused) {
      snprintf(why, sizeof(why), "TLS with %s failed: %s", u.host, refused);
      free(refused);
      bad = why;
    }
  }
  if (NULL == bad) bad = send_all(&c, req.data, req.len);
  free(req.data);

  HttpResp r;
  memset(&r, 0, sizeof(r));
  if (NULL == bad) bad = read_response(&c, &r, ieq(method, "HEAD"));
  if (NULL != c.tls) http_tls_close(c.tls);
  if (0 <= c.fd) close(c.fd);
  if (NULL != bad) {
    *err = transport_error(ctx, url, "the request failed", bad);
    free(r.raw.data);
    free(r.body.data);
    return NULL;
  }

  const char* text = NULL == r.body.data ? "" : r.body.data;
  size_t len = r.body.len;
  // A byte order mark is not part of the document, as fetch reads one.
  size_t bom = 3 <= len && 0 == memcmp(text, "\xEF\xBB\xBF", 3) ? 3 : 0;
  int blank = 1;
  for (size_t i = bom; i < len && blank; i++) blank = isspace((unsigned char)text[i]);
  int valid = !blank && json_valid(text + bom, len - bom);
  voxgig_value* parsed = valid ? voxgig_parse_json(text + bom, len - bom) : voxgig_new_undef();

  voxgig_value* out = cmap(6,
    "status", v_num((double)r.status),
    "statusText", v_str(r.reason),
    "headers", r.headers,
    "json", json_thunk(parsed),
    "body", voxgig_new_string_n(text, len),
    "unreadable", v_bool(!blank && !valid));
  free(r.raw.data);
  free(r.body.data);
  return out;
}

#endif
