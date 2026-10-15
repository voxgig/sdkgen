// The TLS backend of a build without TLS (TLS=none): it links nothing, and
// utility/http.c refuses an https:// request before it reaches here.

#include "tls.h"

#include <stdlib.h>
#include <string.h>

int http_tls_available(void) { return 0; }

char* http_tls_open(HttpTlsIo io, const char* host, const unsigned char* pin,
                    const char* bundle, HttpTls** out) {
  (void)io; (void)host; (void)pin; (void)bundle;
  *out = NULL;
  char* why = (char*)malloc(32);
  strcpy(why, "this build has no TLS");
  return why;
}

long http_tls_write(HttpTls* tls, const char* data, size_t len, const char** why) {
  (void)tls; (void)data; (void)len;
  *why = "this build has no TLS";
  return -1;
}

long http_tls_read(HttpTls* tls, char* data, size_t len, const char** why) {
  (void)tls; (void)data; (void)len;
  *why = "this build has no TLS";
  return -1;
}

void http_tls_close(HttpTls* tls) { (void)tls; }
