// The default transport (utility/http.c), live against a server this test
// forks on the loopback interface.

#if !defined(_WIN32) && !defined(_POSIX_C_SOURCE)
#define _POSIX_C_SOURCE 200809L
#endif

#include "ctest.h"

#include <stdlib.h>
#include <string.h>

#if defined(_WIN32)

int main(void) {
  printf("transport: skipped, this platform has no POSIX sockets\n");
  return 0;
}

#else

#include "../utility/tls/tls.h"

#include <arpa/inet.h>
#include <netinet/in.h>
#include <signal.h>
#include <strings.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

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

static void say(int c, const char* text) {
  size_t n = strlen(text);
  while (0 < n) {
    ssize_t w = write(c, text, n);
    if (w <= 0) return;
    text += w;
    n -= (size_t)w;
  }
}

static void reply(int c, const char* status, const char* type, const char* body) {
  char head[512];
  snprintf(head, sizeof(head), "HTTP/1.1 %s\r\nContent-Type: %s\r\nContent-Length: %lu\r\n\r\n",
    status, type, (unsigned long)strlen(body));
  say(c, head);
  say(c, body);
}

static const char* header_of(const char* head, const char* name) {
  static char value[512];
  size_t n = strlen(name);
  for (const char* line = strstr(head, "\r\n"); NULL != line; line = strstr(line + 2, "\r\n")) {
    if (0 == strncasecmp(line + 2, name, n) && ':' == line[2 + n]) {
      const char* v = line + 3 + n;
      while (' ' == *v) v++;
      size_t len = strcspn(v, "\r");
      if (len >= sizeof(value)) len = sizeof(value) - 1;
      memcpy(value, v, len);
      value[len] = '\0';
      return value;
    }
  }
  return NULL;
}

#define REDIRECT_SECRET "REDIRECT-SECRET-q7w3e9r1"

// All but the last are credentials: x-acme-auth by the value it holds.
static const char* SENT[] = {
  "authorization", "cookie", "x-api-key", "private-token", "x-acme-auth", "x-tenant",
};
#define SENT_COUNT (sizeof(SENT) / sizeof(SENT[0]))
#define SENT_CREDENTIALS (SENT_COUNT - 1)

// The other origin: another port on the loopback interface.
static int other_port = 0;

// The origins' routes: the API's redirects, to the other origin or to
// itself. Each keeps what it is sent, and "/seen" answers with that and
// forgets it. 0 when the target is none of them.
static int answer_origin(int c, const char* head, const char* target, const char* body) {
  static voxgig_value* arrived = NULL;
  if (NULL == arrived) arrived = v_list();
  if (0 == strcmp(target, "/seen")) {
    reply(c, "200 OK", "application/json", voxgig_jsonify(arrived, NULL));
    arrived = v_list();
    return 1;
  }
  int away = 0 == strcmp(target, "/out") || 0 == strcmp(target, "/out307");
  int landed = 0 == strcmp(target, "/landed");
  if (!away && !landed && 0 != strcmp(target, "/in")) return 0;

  voxgig_value* headers = v_map();
  for (size_t i = 0; i < SENT_COUNT; i++) {
    const char* value = header_of(head, SENT[i]);
    if (NULL != value) setp(headers, SENT[i], v_str(value));
  }
  voxgig_list_push(voxgig_as_list(arrived),
    cmap(3, "target", v_str(target), "body", v_str(body), "headers", headers));

  if (landed) {
    reply(c, "200 OK", "application/json", "{\"id\":\"r1\"}");
    return 1;
  }
  char moved[256];
  if (away) {
    snprintf(moved, sizeof(moved), "HTTP/1.1 %s\r\nLocation: http://127.0.0.1:%d/landed\r\n"
      "Content-Length: 0\r\n\r\n", 0 == strcmp(target, "/out") ? "302 Found" : "307 Temporary Redirect",
      other_port);
  } else {
    snprintf(moved, sizeof(moved), "HTTP/1.1 302 Found\r\nLocation: /landed\r\nContent-Length: 0\r\n\r\n");
  }
  say(c, moved);
  return 1;
}

// One request, answered as its path says; the routes are the cases below.
static void answer(int c) {
  char buf[65536];
  size_t n = 0;
  char* end = NULL;
  while (NULL == end && n < sizeof(buf) - 1) {
    ssize_t got = read(c, buf + n, sizeof(buf) - 1 - n);
    if (got <= 0) return;
    n += (size_t)got;
    buf[n] = '\0';
    // A TLS handshake record: this server speaks none, and says so at once.
    if (0x16 == (unsigned char)buf[0]) {
      say(c, "HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }
    end = strstr(buf, "\r\n\r\n");
  }
  if (NULL == end) return;
  *end = '\0';
  const char* cl = header_of(buf, "content-length");
  size_t want = NULL == cl ? 0 : (size_t)strtoul(cl, NULL, 10);
  char* body = end + 4;
  while ((size_t)(buf + n - body) < want && n < sizeof(buf) - 1) {
    ssize_t got = read(c, buf + n, sizeof(buf) - 1 - n);
    if (got <= 0) break;
    n += (size_t)got;
  }
  if ((size_t)(buf + n - body) < want) want = (size_t)(buf + n - body);
  body[want] = '\0';

  char method[16] = "";
  char target[1024] = "";
  sscanf(buf, "%15s %1023s", method, target);
  if (0 == strncmp(target, "http://", 7)) {
    voxgig_value* seen = cmap(2, "proxied", v_str(target),
      "auth", v_str(NULL == header_of(buf, "proxy-authorization") ? ""
        : header_of(buf, "proxy-authorization")));
    reply(c, "200 OK", "application/json", voxgig_jsonify(seen, NULL));
    return;
  }

  if (answer_origin(c, buf, target, body)) return;

  // A Django route answers its slashless form with a relative Location.
  if (0 == strcmp(target, "/redirect/r1")) {
    say(c, "HTTP/1.1 301 Moved Permanently\r\nLocation: /redirect/r1/\r\nContent-Length: 0\r\n\r\n");
    return;
  }
  if (0 == strcmp(target, "/redirect/r1/")) {
    say(c, "HTTP/1.1 308 Permanent Redirect\r\nLocation: done\r\nContent-Length: 0\r\n\r\n");
    return;
  }
  if (0 == strcmp(target, "/redirect/r1/done")) {
    reply(c, "200 OK", "application/json", "{\"id\":\"r1\"}");
    return;
  }

  // The last segment names the case, whatever prefix the API's config adds.
  char path[256];
  size_t plen = strcspn(target, "?");
  const char* seg = target;
  for (size_t i = 0; i < plen; i++) {
    if ('/' == target[i]) seg = target + i;
  }
  snprintf(path, sizeof(path), "%.*s", (int)(target + plen - seg), seg);

  if (0 == strcmp(path, "/echo")) {
    const char* names[] = { "user-agent", "content-type", "content-length", "connection", "host" };
    voxgig_value* seen = cmap(3, "method", v_str(method), "target", v_str(target),
      "body", v_str(body));
    for (size_t i = 0; i < sizeof(names) / sizeof(names[0]); i++) {
      const char* v = header_of(buf, names[i]);
      if (NULL != v) setp(seen, names[i], v_str(v));
    }
    reply(c, "200 OK", "application/json", voxgig_jsonify(seen, NULL));
  } else if (0 == strcmp(path, "/length")) {
    reply(c, "200 OK", "application/json", "{\"framing\":\"length\"}");
  } else if (0 == strcmp(path, "/chunked")) {
    say(c, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n"
      "X-Twice: a\r\nX-Twice: b\r\n\r\n"
      "5\r\n{\"fra\r\n7;ext=1\r\nming\":\"\r\n8\r\nchunked\"\r\n1\r\n}\r\n0\r\nX-Trailer: t\r\n\r\n");
  } else if (0 == strcmp(path, "/close")) {
    say(c, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n"
      "{\"framing\":\"close\"}");
  } else if (0 == strcmp(path, "/informational")) {
    say(c, "HTTP/1.1 100 Continue\r\n\r\n");
    reply(c, "200 OK", "application/json", "{\"after\":100}");
  } else if (0 == strcmp(path, "/head")) {
    say(c, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n");
  } else if (0 == strcmp(path, "/moved")) {
    say(c, "HTTP/1.1 302 Found\r\nLocation: /length\r\nContent-Length: 0\r\n\r\n");
  } else if (0 == strcmp(path, "/missing")) {
    reply(c, "404 Not Found", "application/json", "{\"error\":\"no such thing\"}");
  } else if (0 == strcmp(path, "/text")) {
    reply(c, "200 OK", "text/plain", "plain words");
  } else if (0 == strcmp(path, "/partial")) {
    reply(c, "200 OK", "application/json", "{\"id\": \"x01\", \"title\":");
  } else if (0 == strcmp(path, "/huge")) {
    say(c, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
      "Content-Length: 1099511627776\r\n\r\n{");
  } else if (0 == strcmp(path, "/endless")) {
    static char chunk[65536 + 16];
    memset(chunk, ' ', sizeof(chunk));
    memcpy(chunk, "10000\r\n", 7);
    memcpy(chunk + 7 + 65536, "\r\n", 2);
    say(c, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n");
    for (;;) {
      if (write(c, chunk, 7 + 65536 + 2) <= 0) return;
    }
  } else if (0 == strcmp(path, "/truncated")) {
    say(c, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n"
      "{\"short\":");
  } else {
    reply(c, "400 Bad Request", "application/json", "{}");
  }
}

static void serve(int fd) {
  signal(SIGPIPE, SIG_IGN);
  for (;;) {
    int c = accept(fd, NULL, NULL);
    if (c < 0) continue;
    answer(c);
    shutdown(c, SHUT_WR);
    close(c);
  }
}

static int closed_port(void) {
  int port = 0;
  int fd = listen_loopback(&port);
  close(fd);
  return port;
}

static voxgig_value* fetch(ProjectNameSDK* sdk, const char* url, voxgig_value* fetchdef,
                           PNError** err) {
  return http_fetch(sdk_get_root_ctx(sdk), url, fetchdef, err);
}

static voxgig_value* get(ProjectNameSDK* sdk, const char* url, PNError** err) {
  return fetch(sdk, url, cmap(2, "method", v_str("GET"), "headers", v_map()), err);
}

static voxgig_value* json_of(voxgig_value* res) { return call_json(getp(res, "json")); }

static int mentions(PNError* err, const char* code, const char* text) {
  return NULL != err && 0 == strcmp(err->code, code) && NULL != strstr(err->msg, text);
}

// Through the fetcher, on a context of the client's own: its options hold
// what the client registered as a secret.
static voxgig_value* fetch_on(ProjectNameSDK* sdk, const char* url, voxgig_value* fetchdef,
                              PNError** err) {
  CtxSpec cs;
  memset(&cs, 0, sizeof(cs));
  cs.opname = "load";
  *err = NULL;
  return utility_fetch(sdk_get_utility(sdk), make_context_util(cs, sdk_get_root_ctx(sdk)), url,
    fetchdef, err);
}

static voxgig_value* credential_headers(void) {
  return cmap(6, "authorization", v_str("Bearer " REDIRECT_SECRET),
    "cookie", v_str("sid=" REDIRECT_SECRET), "x-api-key", v_str(REDIRECT_SECRET),
    "private-token", v_str("pt-12345"), "x-acme-auth", v_str("v1 " REDIRECT_SECRET),
    "x-tenant", v_str("acme"));
}

// What the origin on `port` was sent since it was last asked.
static voxgig_value* seen_by(ProjectNameSDK* sdk, int port) {
  char url[64];
  PNError* err = NULL;
  snprintf(url, sizeof(url), "http://127.0.0.1:%d/seen", port);
  voxgig_value* seen = json_of(get(sdk, url, &err));
  return voxgig_is_list(seen) ? seen : v_list();
}

static size_t count_of(voxgig_value* seen) { return voxgig_as_list(seen)->len; }

static voxgig_value* headers_of(voxgig_value* seen, size_t at) {
  return at < count_of(seen) ? getp(voxgig_as_list(seen)->items[at], "headers") : NULL;
}

int main(void) {
  int port = 0;
  int fd = listen_loopback(&port);
  int otherfd = listen_loopback(&other_port);
  CHECK(0 <= fd && 0 <= otherfd, "a loopback listener");
  if (fd < 0 || otherfd < 0) TEST_SUMMARY("transport");

  fflush(NULL);
  pid_t server = fork();
  if (0 == server) {
    close(otherfd);
    serve(fd);
    _exit(0);
  }
  pid_t other = fork();
  if (0 == other) {
    close(fd);
    serve(otherfd);
    _exit(0);
  }
  close(fd);
  close(otherfd);

  char base[64];
  char url[256];
  snprintf(base, sizeof(base), "http://127.0.0.1:%d", port);
  ProjectNameSDK* sdk = projectname_sdk_new(cmap(2, "base", v_str(base),
    "allow", cmap(1, "op", v_str("direct"))), NULL);
  PNError* err = NULL;

  // A GET with a query, and what the transport put on the wire.
  voxgig_value* sent = v_map();
  snprintf(url, sizeof(url), "%s/echo?x=1&y=two", base);
  voxgig_value* res = fetch(sdk, url, cmap(2, "method", v_str("GET"), "headers", sent), &err);
  CHECK(NULL == err, "a GET with a query is answered");
  voxgig_value* seen = json_of(res);
  CHECK_INT_EQ(to_int(getp(res, "status")), 200, "the GET's status");
  CHECK_STR_EQ(get_str(seen, "target"), "/echo?x=1&y=two", "the query reaches the server");
  CHECK_STR_EQ(get_str(seen, "user-agent"), "PROJECTUSERAGENT",
    "the default agent is sent");
  CHECK_STR_EQ(get_str(sent, "user-agent"), "PROJECTUSERAGENT",
    "the default agent is recorded with the headers sent");
  CHECK_STR_EQ(get_str(seen, "connection"), "close", "one request per connection");
  snprintf(url, sizeof(url), "127.0.0.1:%d", port);
  CHECK_STR_EQ(get_str(seen, "host"), url, "the Host header names the authority");
  CHECK(NULL == get_str(seen, "content-length"), "a GET without a body sends no length");

  // A POST with a JSON body, byte for byte.
  snprintf(url, sizeof(url), "%s/echo", base);
  err = NULL;
  res = fetch(sdk, url, cmap(3, "method", v_str("POST"),
    "headers", cmap(1, "content-type", v_str("application/json")),
    "body", v_str("{\"a\":1,\"b\":\"two\"}")), &err);
  CHECK(NULL == err, "a POST is answered");
  seen = json_of(res);
  CHECK_STR_EQ(get_str(seen, "method"), "POST", "the method is sent");
  CHECK_STR_EQ(get_str(seen, "content-type"), "application/json", "the caller's header is sent");
  CHECK_STR_EQ(get_str(seen, "content-length"), "17", "the body's length is sent");
  CHECK_STR_EQ(get_str(seen, "body"), "{\"a\":1,\"b\":\"two\"}", "the body arrives intact");

  // Three framings, a 1xx, a HEAD, a status and a body that is not JSON.
  const char* framed[][2] = {
    { "/length", "length" }, { "/chunked", "chunked" }, { "/close", "close" },
  };
  for (size_t i = 0; i < 3; i++) {
    snprintf(url, sizeof(url), "%s%s", base, framed[i][0]);
    err = NULL;
    res = get(sdk, url, &err);
    CHECK(NULL == err, framed[i][0]);
    CHECK_STR_EQ(get_str(json_of(res), "framing"), framed[i][1], framed[i][0]);
    if (0 == i) CHECK_STR_EQ(get_str(getp(res, "headers"), "content-length"), "20",
      "response headers are read, in lower case");
    if (1 == i) CHECK_STR_EQ(get_str(getp(res, "headers"), "x-twice"), "a, b",
      "a repeated header is joined");
  }

  snprintf(url, sizeof(url), "%s/informational", base);
  err = NULL;
  res = get(sdk, url, &err);
  CHECK(NULL == err && 100 == to_int(getp(json_of(res), "after")), "a 1xx is passed over");

  snprintf(url, sizeof(url), "%s/head", base);
  err = NULL;
  res = fetch(sdk, url, cmap(2, "method", v_str("HEAD"), "headers", v_map()), &err);
  CHECK(NULL == err && 0 == voxgig_string_len(getp(res, "body")), "a HEAD reads no body");

  snprintf(url, sizeof(url), "%s/missing", base);
  err = NULL;
  res = get(sdk, url, &err);
  CHECK(NULL == err, "a 404 is a response, not a transport failure");
  CHECK_INT_EQ(to_int(getp(res, "status")), 404, "the 404's status");
  CHECK_STR_EQ(get_str(res, "statusText"), "Not Found", "the 404's reason");
  CHECK_STR_EQ(get_str(json_of(res), "error"), "no such thing", "the 404's body");

  snprintf(url, sizeof(url), "%s/moved", base);
  err = NULL;
  res = get(sdk, url, &err);
  CHECK(NULL == err && 302 == to_int(getp(res, "status")), "a redirect is answered as it is");
  CHECK_STR_EQ(get_str(getp(res, "headers"), "location"), "/length", "and is not followed");

  snprintf(url, sizeof(url), "%s/text", base);
  err = NULL;
  res = get(sdk, url, &err);
  bool unreadable = false;
  CHECK(get_bool(res, "unreadable", &unreadable) && unreadable, "a body that is not JSON");
  CHECK_STR_EQ(get_str(res, "body"), "plain words", "and its text is kept");

  snprintf(url, sizeof(url), "%s/partial", base);
  err = NULL;
  res = get(sdk, url, &err);
  unreadable = false;
  CHECK(get_bool(res, "unreadable", &unreadable) && unreadable,
    "a JSON document cut short is not read as the part that arrived");

  // The failures, each a fetch_transport error.
  snprintf(url, sizeof(url), "http://127.0.0.1:%d/length", closed_port());
  err = NULL;
  CHECK(NULL == get(sdk, url, &err) && mentions(err, "fetch_transport", "cannot connect"),
    "a refused connection");

  const char* failed[][2] = {
    { "/huge", "larger than" }, { "/endless", "larger than" },
    { "/truncated", "ended before its content-length" },
  };
  for (size_t i = 0; i < 3; i++) {
    snprintf(url, sizeof(url), "%s%s", base, failed[i][0]);
    err = NULL;
    CHECK(NULL == get(sdk, url, &err) && mentions(err, "fetch_transport", failed[i][1]),
      failed[i][0]);
  }

  err = NULL;
  CHECK(NULL == fetch(sdk, base, cmap(2, "method", v_str("GET"),
    "headers", cmap(1, "x-split", v_str("one\r\nInjected: two"))), &err) &&
    mentions(err, "fetch_transport", "cannot carry"), "a header with a line break is refused");

  snprintf(url, sizeof(url), "%s/x HTTP/1.1\r\nInjected: two\r\n\r\nGET /echo", base);
  err = NULL;
  CHECK(NULL == get(sdk, url, &err) && mentions(err, "fetch_transport", "control character"),
    "a path with a line break is refused");

  snprintf(url, sizeof(url), "%s/a b/echo?q=\xC3\xA9 f", base);
  err = NULL;
  res = get(sdk, url, &err);
  CHECK(NULL == err, "a path with a space is answered");
  CHECK_STR_EQ(get_str(json_of(res), "target"), "/a%20b/echo?q=%C3%A9%20f",
    "a space and a byte past ASCII are percent-encoded");

  // A name resolves through getaddrinfo.
  snprintf(url, sizeof(url), "http://localhost:%d/length", port);
  err = NULL;
  res = get(sdk, url, &err);
  CHECK(NULL == err && 200 == to_int(getp(res, "status")), "a host name");

  // An http:// request through a proxy names the whole URL, with credentials.
  err = NULL;
  snprintf(url, sizeof(url), "http://u:p@127.0.0.1:%d", port);
  res = fetch(sdk, "http://origin.invalid/path?q=1", cmap(3, "method", v_str("GET"),
    "headers", v_map(), "proxy", v_str(url)), &err);
  CHECK(NULL == err, "a request through a proxy");
  CHECK_STR_EQ(get_str(json_of(res), "proxied"), "http://origin.invalid/path?q=1",
    "the proxy is sent the whole URL");
  CHECK_STR_EQ(get_str(json_of(res), "auth"), "Basic dTpw", "and the proxy's own credentials");

  // https:// without TLS says so; with it, a server that speaks no TLS fails
  // the handshake.
  snprintf(url, sizeof(url), "https://127.0.0.1:%d/length", port);
  err = NULL;
  CHECK(NULL == get(sdk, url, &err), "https:// to a plain server");
  if (http_tls_available()) {
    CHECK(mentions(err, "fetch_transport", "TLS with 127.0.0.1 failed"), "the handshake fails");
  } else {
    CHECK(mentions(err, "fetch_transport", "TLS=none") &&
      mentions(err, "fetch_transport", "options.system.fetch"),
      "a build without TLS names it, and the seam that replaces it");
  }

  // The pipeline reaches it: no system.fetch, so fetcher_util calls it.
  err = NULL;
  voxgig_value* direct = sdk_direct(sdk, cmap(2, "method", v_str("GET"),
    "path", v_str("/length")), &err);
  CHECK(NULL == err && v_eq(getp(direct, "ok"), v_bool(true)), "a direct request goes live");
  CHECK_STR_EQ(get_str(getp(direct, "data"), "framing"), "length", "and reads the response");

  // The fetcher follows each hop, relative Location and all, and answers a
  // "manual" fetch with the 3xx.
  Utility* util = sdk_get_utility(sdk);
  CtxSpec cs;
  memset(&cs, 0, sizeof(cs));
  cs.opname = "load";
  cs.client = sdk;
  cs.utility = util;
  Context* ctx = make_context_util(cs, NULL);
  snprintf(url, sizeof(url), "%s/redirect/r1", base);
  err = NULL;
  res = utility_fetch(util, ctx, url, cmap(2, "method", v_str("GET"), "headers", v_map()), &err);
  CHECK(NULL == err && 200 == to_int(getp(res, "status")), "a redirect is followed, hop by hop");
  CHECK_STR_EQ(get_str(json_of(res), "id"), "r1", "to the route its Location names");
  err = NULL;
  res = utility_fetch(util, ctx, url, cmap(3, "method", v_str("GET"), "headers", v_map(),
    "redirect", v_str("manual")), &err);
  CHECK(NULL == err && 301 == to_int(getp(res, "status")), "a manual fetch is answered by the 301");

  // The API's origin redirects, and the other origin keeps what reaches it.
  // The secret is registered as a caller's is: as the apikey.
  char msg[128];
  for (int cleanon = 1; 0 <= cleanon; cleanon--) {
    const char* with = cleanon ? "" : ", with clean switched off";
    ProjectNameSDK* keyed = projectname_sdk_new(cmap(3, "base", v_str(base),
      "apikey", v_str(REDIRECT_SECRET), "clean", cmap(1, "active", v_bool(1 == cleanon))), NULL);
    snprintf(url, sizeof(url), "%s/out", base);
    res = fetch_on(keyed, url, cmap(2, "method", v_str("GET"), "headers", credential_headers()),
      &err);
    snprintf(msg, sizeof(msg), "a hop to another origin is followed%s", with);
    CHECK(NULL == err && 200 == to_int(getp(res, "status")), msg);
    voxgig_value* api = seen_by(sdk, port);
    voxgig_value* away = seen_by(sdk, other_port);
    snprintf(msg, sizeof(msg), "each origin is sent one request%s", with);
    CHECK(1 == count_of(api) && 1 == count_of(away), msg);
    for (size_t i = 0; i < SENT_CREDENTIALS; i++) {
      snprintf(msg, sizeof(msg), "the API itself is sent %s%s", SENT[i], with);
      CHECK(NULL != get_str(headers_of(api, 0), SENT[i]), msg);
      snprintf(msg, sizeof(msg), "another origin is not sent %s%s", SENT[i], with);
      CHECK(NULL == get_str(headers_of(away, 0), SENT[i]), msg);
    }
    snprintf(msg, sizeof(msg), "another origin is sent what is no credential%s", with);
    CHECK_STR_EQ(get_str(headers_of(away, 0), "x-tenant"), "acme", msg);
    snprintf(msg, sizeof(msg), "another origin is sent no secret%s", with);
    CHECK(NULL == strstr(voxgig_jsonify(away, NULL), REDIRECT_SECRET), msg);
  }

  ProjectNameSDK* keyed = projectname_sdk_new(cmap(2, "base", v_str(base),
    "apikey", v_str(REDIRECT_SECRET)), NULL);
  snprintf(url, sizeof(url), "%s/in", base);
  res = fetch_on(keyed, url, cmap(2, "method", v_str("GET"), "headers", credential_headers()), &err);
  CHECK(NULL == err && 200 == to_int(getp(res, "status")), "a hop on the same origin is followed");
  voxgig_value* api = seen_by(sdk, port);
  CHECK(2 == count_of(api) && 0 == count_of(seen_by(sdk, other_port)), "and stays on it");
  for (size_t i = 0; i < SENT_COUNT; i++) {
    snprintf(msg, sizeof(msg), "the same origin keeps %s", SENT[i]);
    CHECK(NULL != get_str(headers_of(api, 1), SENT[i]), msg);
  }

  // A PUT follows nothing. A GET follows, and the transport sends the body
  // it is given.
  const char* bodied[] = { "PUT", "GET" };
  snprintf(url, sizeof(url), "%s/out307", base);
  for (size_t i = 0; i < sizeof(bodied) / sizeof(bodied[0]); i++) {
    res = fetch_on(keyed, url, cmap(3, "method", v_str(bodied[i]), "headers", credential_headers(),
      "body", v_str("BODY-" REDIRECT_SECRET)), &err);
    snprintf(msg, sizeof(msg), "a %s's body is not sent on: the 307 is the answer", bodied[i]);
    CHECK(NULL == err && 307 == to_int(getp(res, "status")), msg);
    api = seen_by(sdk, port);
    snprintf(msg, sizeof(msg), "another origin is sent nothing of a %s", bodied[i]);
    CHECK(1 == count_of(api) && 0 == count_of(seen_by(sdk, other_port)), msg);
    snprintf(msg, sizeof(msg), "the API itself is sent the %s's body", bodied[i]);
    CHECK_STR_EQ(1 == count_of(api) ? get_str(voxgig_as_list(api)->items[0], "body") : NULL,
      "BODY-" REDIRECT_SECRET, msg);
  }

  kill(server, SIGKILL);
  kill(other, SIGKILL);
  waitpid(server, NULL, 0);
  waitpid(other, NULL, 0);
  TEST_SUMMARY("transport");
}

#endif
