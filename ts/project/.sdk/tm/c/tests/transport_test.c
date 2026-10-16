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

int main(void) {
  int port = 0;
  int fd = listen_loopback(&port);
  CHECK(0 <= fd, "a loopback listener");
  if (fd < 0) TEST_SUMMARY("transport");

  fflush(NULL);
  pid_t server = fork();
  if (0 == server) {
    serve(fd);
    _exit(0);
  }
  close(fd);

  char base[64];
  char url[256];
  snprintf(base, sizeof(base), "http://127.0.0.1:%d", port);
  ProjectNameSDK* sdk = projectname_sdk_new(cmap(2, "base", v_str(base),
    "allow", cmap(1, "op", v_str("direct"))));
  PNError* err = NULL;

  // A GET with a query, and what the transport put on the wire.
  voxgig_value* sent = v_map();
  snprintf(url, sizeof(url), "%s/echo?x=1&y=two", base);
  voxgig_value* res = fetch(sdk, url, cmap(2, "method", v_str("GET"), "headers", sent), &err);
  CHECK(NULL == err, "a GET with a query is answered");
  voxgig_value* seen = json_of(res);
  CHECK_INT_EQ(to_int(getp(res, "status")), 200, "the GET's status");
  CHECK_STR_EQ(get_str(seen, "target"), "/echo?x=1&y=two", "the query reaches the server");
  CHECK_STR_EQ(get_str(seen, "user-agent"), "Mozilla/5.0 (compatible; ProjectNameSDK/1.0)",
    "the default agent is sent");
  CHECK_STR_EQ(get_str(sent, "user-agent"), "Mozilla/5.0 (compatible; ProjectNameSDK/1.0)",
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

  kill(server, SIGKILL);
  waitpid(server, NULL, 0);
  TEST_SUMMARY("transport");
}

#endif
